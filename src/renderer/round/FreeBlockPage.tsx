import { useEffect, useRef, useState } from 'react';
import { startsAsCommand } from '../../core/round-answers';
import type { FreeBlockView } from '../../core/round-phase';
import type { FreeBlockBridge } from '../http-bridge';
import { Brand } from '../icons';
import { PreferencesMenu, usePreferences } from '../preferences';
import { Markdown, PhaseControl, useLatestSaver } from './shared';

/**
 * A turn without a round, during the round phase (#99): the agent's text, read-only, and one reply field, returned as
 * one message. Nothing in the text is parsed, and the reply is the person's own words: what Claude Code would take
 * for a command, the server sends as text.
 */
export function FreeBlockPage({ block, phaseOpen, bridge }: { block: FreeBlockView; phaseOpen: boolean; bridge: FreeBlockBridge }) {
  const { t } = usePreferences();
  const f = t.page.free;
  const [reply, setReply] = useState(block.reply);
  const latest = useRef(block.reply);
  const [delivered, setDelivered] = useState<string | null>(block.sent?.message ?? null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'send' | 'save'>();
  const saver = useLatestSaver((next: string) => bridge.saveReply(block, next), delivered !== null, setFailure);

  // A reply sent from another tab arrives through the page's poll.
  useEffect(() => { if (block.sent) setDelivered(block.sent.message); }, [block.sent]);

  const readOnly = delivered !== null || block.superseded;
  const canSend = !readOnly && !sending && reply.trim() !== '';
  const looksLikeCommand = startsAsCommand(reply);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setFailure(undefined);
    try {
      setDelivered(await bridge.sendReply(block, latest.current));
    } catch {
      setFailure('send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="round-page">
      <header className="topbar"><Brand/><div className="course-title"><strong>{f.title}</strong></div>
        <PhaseControl session={block.session} open={phaseOpen} bridge={bridge}/>
        <PreferencesMenu/>
      </header>
      <main className="free-layout">
        <section className="free-turn" aria-label={f.title}><Markdown text={block.text}/></section>
        {delivered !== null
          ? <>
            <pre className="round-message" data-testid="free-message">{delivered}</pre>
            <p role="status">{f.sent}</p>
          </>
          : block.superseded
            ? <p role="note">{f.superseded}</p>
            : (
              <div className="round-field free-reply">
                <label htmlFor="free-reply">{f.reply}</label>
                <textarea
                  id="free-reply" autoFocus rows={5} value={reply} aria-describedby={looksLikeCommand ? 'free-reply-hint' : undefined}
                  onChange={event => { latest.current = event.target.value; setReply(event.target.value); saver(event.target.value); }}
                  onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void send(); } }}
                />
                {looksLikeCommand && <small id="free-reply-hint">{f.asText}</small>}
                <div className="round-steps"><button type="button" className="primary" disabled={!canSend} onClick={() => void send()}>{sending ? f.sending : f.send}</button></div>
              </div>
            )}
        {failure && delivered === null && <p role="alert">{failure === 'send' ? f.sendFailed : f.saveFailed}</p>}
      </main>
    </div>
  );
}
