import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { TurnKey } from '../../core/round-phase';
import type { FoldBridge, PhaseBridge } from '../http-bridge';
import { renderInlineMarkdown, renderMarkdown } from '../markdown';
import { usePreferences } from '../preferences';
import { useDiagrams } from '../use-diagrams';
import { markPassages, type Passage } from './passages';

/** What a round and a free block share in the page (#95, #99). */

const NO_MARKS: readonly Passage[] = [];

/**
 * The agent's Markdown, rendered with raw HTML off: markup in a turn shows as text and never runs. Mermaid fences
 * are drawn in place, so an architecture question is judged from its diagram.
 */
export function Markdown({ text, host: given, marks = NO_MARKS }: { text: string; host?: RefObject<HTMLDivElement | null>; marks?: readonly Passage[] }) {
  const { t, theme } = usePreferences();
  const rendered = useMemo(() => renderMarkdown(text), [text]);
  const own = useRef<HTMLDivElement>(null);
  const host = given ?? own;
  useDiagrams(host, rendered, theme, t.d.diagramFailed);
  // React sets the HTML only when it changes, so the marks are drawn into it after every render that could move them.
  const marksKey = marks.map(x => `${x.kind ?? 'remark'}:${x.start}:${x.end}:${x.passage}`).join('\n');
  useLayoutEffect(() => { if (host.current) markPassages(host.current, marks); }, [host, rendered, marksKey]);
  return <div ref={host} className="round-markdown" dangerouslySetInnerHTML={{ __html: rendered.html }}/>;
}

/**
 * The agent's text at the head of a round or a free block (#126), read like a page: a static chip says where it came
 * from (the project, the session's first 8 characters, the round), then the text. Folded, it is one line: the chip,
 * the text's first line cut, the control. The fold is kept with the entry on the server, so it holds for that round
 * alone; it is reading, not answering, so it works on a sent or superseded entry too.
 */
export function AgentText({ entry, project, text, number, folded: kept, label, className, bridge }: {
  entry: TurnKey;
  /** The project as the server names it: the working directory's last folder. */
  project: string;
  text: string;
  /** The chip's last part: "Round n", or "Block n" for a free block, so two of one session never read the same. */
  number: string;
  folded: boolean;
  label: string;
  className: string;
  bridge: FoldBridge;
}) {
  const { t } = usePreferences();
  const f = t.page.round.folds;
  // The person's fold wins on this page until the server's word changes: another entry shown in the same place, or the
  // same one folded from another tab. Adjusted while rendering, so a stale fold is never drawn for a frame.
  const id = `${entry.kind}/${entry.session}/${entry.number}`;
  const [mine, setMine] = useState({ id, kept, folded: kept });
  if (mine.id !== id || mine.kept !== kept) setMine({ id, kept, folded: kept });
  const folded = mine.id === id && mine.kept === kept ? mine.folded : kept;
  // Saved as a draft is, newest last; a fold the server did not keep still holds on this page, and says so. Folding
  // works on a sent entry too, so a refusal is never expected and always shown.
  const [failure, setFailure] = useState<'save'>();
  const save = useLatestSaver((x: { entry: TurnKey; folded: boolean }) => bridge.foldTurn(x.entry, x.folded), false, setFailure);
  const toggle = () => {
    const next = !folded;
    setMine({ id, kept, folded: next });
    save({ entry, folded: next });
  };
  const chip = [project, entry.session.slice(0, 8), number].join(' · ');
  return (
    <section className={`${className} agent-text${folded ? ' is-folded' : ''}`} aria-label={label}>
      <p className="turn-chip" title={entry.session}>{chip}</p>
      {folded && <p className="turn-line">{firstLine(text)}</p>}
      <button type="button" className="subtle round-fold turn-fold" aria-expanded={!folded} onClick={toggle}>{folded ? f.showTurn : f.hideTurn}</button>
      {failure && <p role="alert">{f.turnFoldFailed}</p>}
      {!folded && <Markdown text={text}/>}
    </section>
  );
}

/** The text folded to one line: its first line with the Markdown marks that open a line or wrap words taken off. */
const firstLine = (text: string) => (text.split('\n').find(x => x.trim() !== '') ?? '')
  .replace(/^\s*(?:#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|`{3,}\S*)*/, '').replace(/[*_`]/g, '').trim();

/**
 * Saves on every change, one request at a time and always the newest: a slow save never lands over a later one, and
 * edits made while it runs collapse into the next. `settle` is for a Send that carries the newest value itself: what
 * has not left yet is dropped, and it resolves once the save on its way has landed, so no save arrives after the Send.
 */
export function useLatestSaver<T>(save: (value: T) => Promise<void>, sent: boolean, setFailure: (failure: 'save' | undefined) => void) {
  const state = useRef<{ running: Promise<void> | null; pending?: { value: T } }>({ running: null });
  const sentRef = useRef(sent);
  sentRef.current = sent;
  const saveRef = useRef(save);
  saveRef.current = save;
  const saver = (value: T) => {
    const s = state.current;
    s.pending = { value };
    if (s.running) return;
    s.running = (async () => {
      while (s.pending) {
        const next = s.pending.value;
        s.pending = undefined;
        try {
          await saveRef.current(next);
          setFailure(undefined);
        } catch {
          // Once sent, the server refuses changes by design: that is not a failure worth showing.
          if (!sentRef.current) setFailure('save');
        }
      }
      s.running = null;
    })();
  };
  const settle = (): Promise<void> => {
    state.current.pending = undefined;
    return state.current.running ?? Promise.resolve();
  };
  return Object.assign(saver, { settle });
}

/**
 * The session's round phase (#99), in the top bar: while it is open, the person can end it, and the agent's next
 * turns without a round stay in the terminal; once ended, the bar says so. The page learns of the change through its
 * poll, as of any other.
 */
export function PhaseControl({ session, open, bridge }: { session: string; open: boolean; bridge: PhaseBridge }) {
  const { t } = usePreferences();
  const p = t.page.phase;
  const [ending, setEnding] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!open) return <span className="round-phase is-ended" role="note" title={p.endedHint}>{p.ended}</span>;
  const end = async () => {
    setEnding(true);
    setFailed(false);
    try { await bridge.endPhase(session); } catch { setFailed(true); } finally { setEnding(false); }
  };
  return (
    <span className="round-phase">
      <button type="button" className="subtle" title={p.endHint} disabled={ending} onClick={() => void end()}>{p.end}</button>
      {failed && <span role="alert">{p.endFailed}</span>}
    </span>
  );
}

/**
 * Copies text the page shows (#103): the way out by hand when a message cannot reach the session. The page is served
 * from 127.0.0.1, a secure context, so the browser's clipboard is open to it; where it still refuses, the person is
 * told to copy by hand.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = usePreferences();
  const x = t.page.session;
  const [done, setDone] = useState<'copied' | 'failed' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone('copied');
    } catch {
      setDone('failed');
    }
  };
  return (
    <span className="round-copy">
      <button type="button" className="subtle" onClick={() => void copy()}>{label}</button>
      {done === 'copied' && <span>{x.copied}</span>}
      {done === 'failed' && <span role="alert">{x.copyFailed}</span>}
    </span>
  );
}

/** A message sent to an ended session waits for it: the command that resumes it, to copy. */
export function QueuedNotice({ session }: { session: string }) {
  const { t } = usePreferences();
  const x = t.page.session;
  const command = `claude --resume ${session}`;
  return <p role="status" className="round-queued">{x.queued} <code>{command}</code> <CopyButton text={command} label={x.copyCommand}/></p>;
}

/**
 * The agent's words or a spec's statement on one line: inline Markdown only, so it can sit inside a button (an option's
 * label) or a sentence (a statement in the backing panel). Raw HTML is off and links render as text, as for `Markdown`.
 */
export function InlineMarkdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInlineMarkdown(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }}/>;
}
