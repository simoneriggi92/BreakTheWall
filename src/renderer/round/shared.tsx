import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { PhaseBridge } from '../http-bridge';
import { renderMarkdown } from '../markdown';
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
  const marksKey = marks.map(x => `${x.start}:${x.end}:${x.passage}`).join('\n');
  useLayoutEffect(() => { if (host.current) markPassages(host.current, marks); }, [host, rendered, marksKey]);
  return <div ref={host} className="round-markdown" dangerouslySetInnerHTML={{ __html: rendered.html }}/>;
}

/**
 * Saves on every change, one request at a time and always the newest: a slow save never lands over a later one, and
 * edits made while it runs collapse into the next.
 */
export function useLatestSaver<T>(save: (value: T) => Promise<void>, sent: boolean, setFailure: (failure: 'save' | undefined) => void) {
  const state = useRef<{ busy: boolean; pending?: { value: T } }>({ busy: false });
  const sentRef = useRef(sent);
  sentRef.current = sent;
  const saveRef = useRef(save);
  saveRef.current = save;
  return (value: T) => {
    const s = state.current;
    s.pending = { value };
    if (s.busy) return;
    s.busy = true;
    void (async () => {
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
      s.busy = false;
    })();
  };
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
