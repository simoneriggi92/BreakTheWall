import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentView } from '../core/round-phase';
import { projectName, type History } from '../core/session-history';
import { App } from './App';
import { httpBridge, RefusedError, type RoundKey } from './http-bridge';
import { PreferencesProvider, usePreferences } from './preferences';
import { FreeBlockPage } from './round/FreeBlockPage';
import { PageNotices, SessionHistory } from './round/History';
import { RoundPage } from './round/RoundPage';
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
   * field or reads history: then a newer one is only announced, and stays announced until the person opens it.
   */
  const follow = (latest: CurrentView | null) => {
    const key = viewKey(latest);
    if (key === viewKey(shown.current)) { followed.current = key; show(latest); return; }
    if (key === followed.current) return;
    if (latest && (reading.current || held.current || isWriting())) return hold(latest);
    followNow(latest);
  };
  const followRef = useRef(follow);
  followRef.current = follow;

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
    const refresh = () => Promise.all([bridge.getCurrent(), bridge.getHistory().catch(() => null)]).then(([next, column]) => {
      if (stop.signal.aborted) return;
      if (column) setHistory(column);
      followRef.current(next);
    }, () => {});
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
    if (!current) return <App bridge={bridge}/>;
    const openArrived = () => followNow(held.current);
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
    const arrivedProject = history?.projects.find(p => p.sessions.some(x => x.session === sessionOf(arrived)))?.cwd;
    const shownRound = current.kind === 'round' ? current.round : null;
    // Keyed by what is shown, so a new round or free block starts with its own draft and focus.
    return <PreferencesProvider bridge={bridge}>
      {current.kind === 'round'
        ? <RoundPage key={`round/${current.round.session}/${current.round.number}`} round={current.round} phaseOpen={current.phaseOpen} bridge={bridge}/>
        : <FreeBlockPage key={`free/${current.block.session}/${current.block.number}`} block={current.block} phaseOpen={current.phaseOpen} bridge={bridge}/>}
      {historyOpen && history && <SessionHistory history={history} shown={shownRound} bridge={bridge} onOpen={openRound} onDeleted={deleted} onClose={() => setHistoryOpen(false)}/>}
      <div className="page-dock">
        {!historyOpen && history && history.projects.length > 0 && <HistoryToggle onOpen={() => setHistoryOpen(true)}/>}
        <PageNotices arrived={arrived?.kind ?? null} project={arrivedProject ? projectName(arrivedProject) : null} update={history?.update ?? null} onOpen={openArrived}/>
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
