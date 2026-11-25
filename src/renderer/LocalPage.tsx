import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentView } from '../core/round-phase';
import { projectName, type History } from '../core/session-history';
import type { SpecList, SpecView, UnreadableHandover } from '../core/spec';
import { App } from './App';
import { httpBridge, RefusedError, type RoundKey } from './http-bridge';
import { PreferencesProvider, usePreferences } from './preferences';
import { FreeBlockPage } from './round/FreeBlockPage';
import { PageNotices, SessionHistory, UnreadableNotices } from './round/History';
import { RoundPage } from './round/RoundPage';
import { newestSpec, SpecPage } from './spec/SpecPage';
import { browserBridge } from './storage';

const SECRET_KEY = 'btw:page-secret';
const RETRY_MS = 2000;

/**
 * The secret `/break-the-wall` put in the fragment (`#t=…`), kept for this tab only and cleared from the address, so
 * it is not left in the address bar, the history or a copied link. A reload finds it in `sessionStorage`.
 */
function takeSecret(): string | null {
  const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('t');
  if (fromLink) {
    try { sessionStorage.setItem(SECRET_KEY, fromLink); } catch { /* A tab without storage still works until reload. */ }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return fromLink;
  }
  try { return sessionStorage.getItem(SECRET_KEY); } catch { return null; }
}
function forgetSecret() {
  try { sessionStorage.removeItem(SECRET_KEY); } catch { /* nothing kept */ }
}

/** The local page's entry (#94): the app over the HTTP bridge, or one line saying where to open it from. */
export function LocalPage({ fetch: fetcher }: { fetch?: typeof fetch }) {
  const [secret] = useState(takeSecret);
  const bridge = useMemo(() => secret ? httpBridge(secret, fetcher) : undefined, [secret, fetcher]);
  const [state, setState] = useState<'checking' | 'open' | 'refused'>(bridge ? 'checking' : 'refused');
  /**
   * What the page shows: the latest round or free block the server holds, read again after every poll, which answers
   * early when it changes; or a round the person opened from the history column.
   */
  const [current, setCurrent] = useState<CurrentView | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** A newer round or free block held back while the person writes or reads history (#102): the notice offers it. */
  const [arrived, setArrived] = useState<CurrentView | null>(null);
  const held = useRef<CurrentView | null>(null);
  const shown = useRef<CurrentView | null>(null);
  /** The latest the server held when the page last followed it: what is not newer than this is no news. */
  const followed = useRef<string | null>(null);
  /** The person opened an earlier round from the history column. */
  const reading = useRef(false);
  /** The page has read the server's latest once: from then on, what arrives behind the spec waits for the person. */
  const primed = useRef(false);
  const show = (view: CurrentView | null) => { shown.current = view; setCurrent(view); };
  const hold = (view: CurrentView | null) => { held.current = view; setArrived(view); };
  /** The page shows the latest again, and follows the ones after it. */
  const followNow = (latest: CurrentView | null) => {
    followed.current = viewKey(latest);
    reading.current = false;
    hold(null);
    show(latest);
  };
  /**
   * The latest round or free block, as the server holds it. The page follows it, except while the person writes in a
   * field, reads history or has the spec in front: then a newer one is only announced, and stays announced until the
   * person opens it. The spec is held like history because it is read at length: leaving it unasked would drop the
   * part being explored, and a round that slipped in behind it would go unseen.
   */
  const follow = (latest: CurrentView | null) => {
    // The first read is what the page opens on, never held; after it, a spec in front holds what comes behind it, even
    // when no round came before the spec.
    const behindSpec = specInFront.current && primed.current;
    primed.current = true;
    const key = viewKey(latest);
    if (key === viewKey(shown.current)) { followed.current = key; show(latest); return; }
    if (key === followed.current) return;
    if (latest && (reading.current || held.current || behindSpec || isWriting())) return hold(latest);
    followNow(latest);
  };
  const followRef = useRef(follow);
  followRef.current = follow;
  /** The specs handed over (#104), read with it; the newest opens unless a later turn came after it, or the person closed it. */
  const [specs, setSpecs] = useState<SpecView[]>([]);
  const [closedSpec, setClosedSpec] = useState<string>();
  /** The person opened the spec again from a round (#105), to write remarks while the round waits. */
  const [specOpened, setSpecOpened] = useState(false);
  /** The newest spec the page let open; undefined until the specs are first read. */
  const takenSpec = useRef<string | null | undefined>(undefined);
  /** A spec handed over while the person writes or reads history: like a round, only announced (#102). */
  const [arrivedSpec, setArrivedSpec] = useState<SpecView | null>(null);
  const heldSpec = useRef<SpecView | null>(null);
  /** The spec, not a round, is in front: a new version there is the spec page's own business. */
  const specInFront = useRef(false);
  const holdSpec = (spec: SpecView | null) => { heldSpec.current = spec; setArrivedSpec(spec); };
  /** Handovers that could not be read (#104), less those the person closed. */
  const [unreadable, setUnreadable] = useState<UnreadableHandover[]>([]);
  const [closedUnreadable, setClosedUnreadable] = useState<string[]>([]);
  const unreadableKey = (x: UnreadableHandover) => `${x.session}/${x.at}`;
  const followSpecs = ({ specs: next, unreadable: failed }: SpecList) => {
    setUnreadable(failed);
    setSpecs(next);
    const newest = newestSpec(next);
    if (!newest) { takenSpec.current ??= null; return; }
    if (newest.id === takenSpec.current) return;
    const busy = reading.current || held.current !== null || heldSpec.current !== null || isWriting();
    if (takenSpec.current !== undefined && !specInFront.current && shown.current !== null && busy) return holdSpec(newest);
    takenSpec.current = newest.id;
    holdSpec(null);
  };
  const followSpecsRef = useRef(followSpecs);
  followSpecsRef.current = followSpecs;

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    // Any failure, a refused secret or a stopped server, has the same remedy: open the page again from Claude Code.
    void bridge.getRuntime().then(() => { if (active) setState('open'); }, error => {
      if (!active) return;
      if (error instanceof RefusedError) forgetSecret();
      setState('refused');
    });
    return () => { active = false; };
  }, [bridge]);

  useEffect(() => {
    if (!bridge || state !== 'open') return;
    const stop = new AbortController();
    // The history column reads alongside: a server that cannot answer it still shows the round.
    const refresh = () => {
      void bridge.listSpecs().then(next => { if (!stop.signal.aborted) followSpecsRef.current(next); }, () => {});
      return Promise.all([bridge.getCurrent(), bridge.getHistory().catch(() => null)]).then(([next, column]) => {
        if (stop.signal.aborted) return;
        if (column) setHistory(column);
        followRef.current(next);
      }, () => {});
    };
    void refresh();
    void (async () => {
      while (!stop.signal.aborted) {
        try {
          if (await bridge.poll(stop.signal) === 'refused') { forgetSecret(); setState('refused'); return; }
          void refresh();
        } catch {
          if (stop.signal.aborted) return;
          // A broken poll is either a hiccup or a stopped server; a restarted one listens on another port with
          // another secret, so this tab can never reconnect. Only then does it say where to open the page again.
          const alive = await bridge.getRuntime().then(() => true, error => { if (error instanceof RefusedError) forgetSecret(); return false; });
          if (stop.signal.aborted) return;
          if (!alive) { setState('refused'); return; }
          await new Promise(done => setTimeout(done, RETRY_MS));
        }
      }
    })();
    return () => stop.abort();
  }, [bridge, state]);

  if (state === 'open' && bridge) {
    const spec = newestSpec(specs);
    const shownAt = current?.kind === 'round' ? current.round.receivedAt : current?.block.receivedAt;
    specInFront.current = Boolean(spec && (specOpened || (spec.id === takenSpec.current && spec.id !== closedSpec && (shownAt === undefined || spec.handedOverAt >= shownAt))));
    const notReadNotices = <UnreadableNotices unreadable={unreadable.filter(x => !closedUnreadable.includes(unreadableKey(x)))}
      onClose={x => setClosedUnreadable(kept => [...kept, unreadableKey(x)])}/>;
    const projectOf = (session: string | null) => {
      const cwd = history?.projects.find(p => p.sessions.some(x => x.session === session))?.cwd;
      return cwd ? projectName(cwd) : null;
    };
    // Opening it leaves the spec, whatever put the spec in front: a version handed over after the round would otherwise
    // keep it there. The spec stays a click away in the dock.
    const openArrived = () => { setSpecOpened(false); if (spec) setClosedSpec(spec.id); followNow(held.current); };
    if (spec && specInFront.current) {
      const close = () => { setSpecOpened(false); setClosedSpec(spec.id); };
      return <PreferencesProvider bridge={bridge}>
        <SpecPage specs={specs} bridge={bridge} onClose={close}/>
        <div className="page-dock">
          <PageNotices arrived={arrived?.kind ?? null} project={projectOf(sessionOf(arrived))} onOpen={openArrived}
            spec={null} update={history?.update ?? null}/>
          {notReadNotices}
        </div>
      </PreferencesProvider>;
    }
    if (!current) return <App bridge={bridge}/>;
    const openRound = (round: RoundKey) => {
      setHistoryOpen(false);
      void bridge.getRound(round).then(view => {
        // Reading an earlier round holds the page there; opening the latest one follows the server again.
        reading.current = viewKey(view) !== followed.current;
        show(view);
      }, () => {});
    };
    const deleted = (session: string) => {
      // The page cannot keep showing what is gone: it follows the server again.
      if (sessionOf(shown.current) === session) { reading.current = false; followed.current = null; shown.current = null; }
      if (sessionOf(held.current) === session) hold(null);
      void Promise.all([bridge.getCurrent(), bridge.getHistory()]).then(([next, column]) => { setHistory(column); followRef.current(next); }, () => {});
    };
    const openSpec = () => {
      // Opened by the person, the newest spec is the one the page follows from now on.
      if (spec) takenSpec.current = spec.id;
      holdSpec(null);
      setSpecOpened(true);
    };
    const shownRound = current.kind === 'round' ? current.round : null;
    // Keyed by what is shown, so a new round or free block starts with its own draft and focus.
    return <PreferencesProvider bridge={bridge}>
      {current.kind === 'round'
        ? <RoundPage key={`round/${current.round.session}/${current.round.number}`} round={current.round} phaseOpen={current.phaseOpen} queued={current.queued} transcriptGone={current.transcriptGone} riding={current.riding} bridge={bridge}/>
        : <FreeBlockPage key={`free/${current.block.session}/${current.block.number}`} block={current.block} phaseOpen={current.phaseOpen} queued={current.queued} transcriptGone={current.transcriptGone} bridge={bridge}/>}
      {historyOpen && history && <SessionHistory history={history} shown={shownRound} bridge={bridge} onOpen={openRound} onDeleted={deleted} onClose={() => setHistoryOpen(false)}/>}
      <div className="page-dock">
        {!historyOpen && history && history.projects.length > 0 && <HistoryToggle onOpen={() => setHistoryOpen(true)}/>}
        {spec && <SpecToggle title={spec.title} onOpen={openSpec}/>}
        <PageNotices
          arrived={arrived?.kind ?? null} project={projectOf(sessionOf(arrived))} onOpen={openArrived}
          spec={arrivedSpec && { project: projectOf(arrivedSpec.session), onOpen: openSpec }} update={history?.update ?? null}/>
        {notReadNotices}
      </div>
    </PreferencesProvider>;
  }
  if (state === 'checking') return null;
  return <PreferencesProvider bridge={browserBridge}><Secretless/></PreferencesProvider>;
}

function HistoryToggle({ onOpen }: { onOpen(): void }) {
  const { t } = usePreferences();
  return <button type="button" className="subtle page-history-toggle" aria-expanded={false} onClick={onOpen}>{t.page.history.open}</button>;
}

/** The newest spec, opened again from a round. */
function SpecToggle({ title, onOpen }: { title: string; onOpen(): void }) {
  const { t } = usePreferences();
  return <button type="button" className="subtle page-history-toggle" onClick={onOpen}>{t.page.spec.open(title)}</button>;
}

const viewKey = (view: CurrentView | null) => view && (view.kind === 'round' ? `round/${view.round.session}/${view.round.number}` : `free/${view.block.session}/${view.block.number}`);
const sessionOf = (view: CurrentView | null) => view && (view.kind === 'round' ? view.round.session : view.block.session);

/** The person is typing an answer, a note, a remark, a response or a side chat: the field holds the focus. */
function isWriting() {
  const field = document.activeElement;
  if (field instanceof HTMLTextAreaElement) return true;
  if (field instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(field.type);
  return field instanceof HTMLElement && field.isContentEditable;
}

function Secretless() {
  const { t } = usePreferences();
  return <main className="secretless">{t.page.secretless} <code>/break-the-wall</code></main>;
}
