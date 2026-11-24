import { useEffect, useRef, useState } from 'react';
import type { Question } from '../../core/round';
import { quoted } from '../../core/round-answers';
import type { SideChatPassage, SideChat as Thread } from '../../core/side-chat';
import type { RoundKey, SideChatBridge } from '../http-bridge';
import { usePreferences } from '../preferences';
import { Markdown } from './shared';

const RETRY_MS = 2000;

/**
 * A round's side chats (#100), kept current: one held read after another, each answered as soon as a reply grows, so
 * a reply streams in. A failed read (a server that stopped, a round it does not know) is tried again after a pause.
 */
export function useSideChats(bridge: SideChatBridge, round: RoundKey): Thread[] {
  const [threads, setThreads] = useState<Thread[]>([]);
  const { session, number } = round;
  useEffect(() => {
    const stop = new AbortController();
    void (async () => {
      let after: number | null = null;
      while (!stop.signal.aborted) {
        try {
          const view = await bridge.getSideChats({ session, number }, after, stop.signal);
          if (stop.signal.aborted) return;
          after = view.version;
          setThreads(view.sideChats);
        } catch {
          if (stop.signal.aborted) return;
          await new Promise(done => setTimeout(done, RETRY_MS));
        }
      }
    })();
    return () => stop.abort();
  }, [bridge, session, number]);
  return threads;
}

/**
 * The side chat of the question in focus, in the right column: the person's questions and the replies of a read-only
 * copy of the session, each with what it read. Nothing here reaches the agent unless the person attaches a reply to
 * their answer with 📎 (#101).
 */
export function SideChat({ question, thread, ask, passage, attached, onAsk, onAskChange, onDropPassage, onAttach, onClose }: {
  question: Question;
  thread: Thread | undefined;
  /** What the person is typing for this question, kept while the focus moves. */
  ask: string;
  /** The passage chosen with "Ask here", which the next question quotes (#101). */
  passage: SideChatPassage | undefined;
  /** The turns whose exchange is attached to the answer. */
  attached: readonly number[];
  onAsk: (ask: string) => Promise<void>;
  onAskChange: (ask: string) => void;
  onDropPassage: () => void;
  /** Attaches a turn's exchange, or takes it back; absent where the answer can no longer change. */
  onAttach?: (turn: number) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const s = t.page.sideChat;
  const turns = thread?.turns ?? [];
  const running = turns.some(x => x.status === 'running');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = running || sending;
  const field = useRef<HTMLTextAreaElement>(null);
  // A passage chosen while the chat is already open hands it the focus, as opening it does.
  useEffect(() => { if (passage) field.current?.focus(); }, [passage]);

  const submit = async () => {
    if (busy || ask.trim() === '') return;
    setSending(true);
    setFailed(false);
    try { await onAsk(ask); } catch { setFailed(true); } finally { setSending(false); }
  };

  return (
    <section className="side-chat" aria-labelledby="side-chat-title">
      <header className="side-chat-head">
        <h2 id="side-chat-title">{s.title(question.number)}</h2>
        <button type="button" className="subtle" aria-label={s.close} title={s.close} onClick={onClose}>×</button>
      </header>
      <p className="side-chat-fork">{s.fork}</p>
      {turns.length === 0
        ? <p className="side-chat-empty">{s.empty(question.number)}</p>
        : <ol className="side-chat-turns">
          {turns.map(turn => (
            <li key={turn.number}>
              <p className="side-chat-ask"><span className="sr-only">{s.you}: </span>
                {turn.passage && <q className="side-chat-passage">{quoted(turn.passage.passage)}</q>}
                <span>{turn.ask}</span>
              </p>
              <div className="side-chat-reply"><span className="sr-only">{s.reply}:</span>
                {turn.reply !== '' && <Markdown text={turn.reply}/>}
                {turn.status === 'running' && <p className="side-chat-running" role="status">{s.running}</p>}
                {turn.status === 'failed' && <p role="alert">{s.failed}</p>}
                {turn.route === 'fresh' && <p className="side-chat-note">{s.fresh}</p>}
                {onAttach && turn.status === 'done' && (
                  <button type="button" className="subtle side-chat-attach" aria-pressed={attached.includes(turn.number)} onClick={() => onAttach(turn.number)}>{s.attach}</button>
                )}
                {turn.files.length > 0 && (
                  <ul className="side-chat-read" aria-label={s.read}>
                    {turn.files.map(file => <li key={file}>{file}</li>)}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>}
      {passage && (
        <figure className="side-chat-asking" aria-label={s.askingAbout}>
          <q className="side-chat-passage">{quoted(passage.passage)}</q>
          <button type="button" className="subtle" aria-label={s.wholeQuestion} title={s.wholeQuestion} onClick={onDropPassage}>×</button>
        </figure>
      )}
      <form className="side-chat-composer" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <textarea
          ref={field} aria-label={s.field} placeholder={s.placeholder} rows={2} autoFocus value={ask}
          onChange={event => onAskChange(event.target.value)}
          onKeyDown={event => {
            // Enter asks, Shift+Enter starts a new line; Ctrl+Enter is left to the round's Send.
            if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void submit();
          }}
        />
        <button type="submit" className="primary" disabled={busy}>{s.send}</button>
      </form>
      {failed && <p role="alert">{s.askFailed}</p>}
    </section>
  );
}
