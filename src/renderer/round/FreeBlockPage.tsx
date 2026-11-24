import { useEffect, useRef, useState } from 'react';
import { startsAsCommand } from '../../core/round-answers';
import type { FreeBlockView } from '../../core/round-phase';
import type { FreeBlockBridge } from '../http-bridge';
import { Brand } from '../icons';
import { PreferencesMenu, usePreferences } from '../preferences';
import { Markdown, PhaseControl, QueuedNotice, useLatestSaver } from './shared';

/**
 * A turn without a round, during the round phase (#99): the agent's text, read-only, and one response field, returned as
 * one message. Nothing in the text is parsed, and the response is the person's own words: what Claude Code would take
 * for a command, the server sends as text. A response to an ended session waits queued for `claude --resume <id>`; once
 * Claude Code no longer keeps the session's transcript, the block is read-only (#103).
 */
export function FreeBlockPage({ block, phaseOpen, queued = false, transcriptGone = false, bridge }: {
  block: FreeBlockView;
  phaseOpen: boolean;
  queued?: boolean;
  transcriptGone?: boolean;
  bridge: FreeBlockBridge;
}) {
  const { t } = usePreferences();
  const f = t.page.free;
  const [response, setResponse] = useState(block.response);
  const latest = useRef(block.response);
  const [delivered, setDelivered] = useState<string | null>(block.sent?.message ?? null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'send' | 'save'>();
  const saver = useLatestSaver((next: string) => bridge.saveResponse(block, next), delivered !== null, setFailure);

  // A response sent from another tab arrives through the page's poll.
  useEffect(() => { if (block.sent) setDelivered(block.sent.message); }, [block.sent]);

  const readOnly = delivered !== null || block.superseded || transcriptGone;
  const canSend = !readOnly && !sending && response.trim() !== '';
  const looksLikeCommand = startsAsCommand(response);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setFailure(undefined);
    try {
      setDelivered(await bridge.sendResponse(block, latest.current));
    } catch {
      setFailure('send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="round-page">
      <header className="topbar"><Brand tagline={false}/><div className="course-title"><strong>{f.title}</strong></div>
        <PhaseControl session={block.session} open={phaseOpen} bridge={bridge}/>
        <PreferencesMenu/>
      </header>
      <main className="free-layout">
        <section className="free-turn" aria-label={f.title}><Markdown text={block.text}/></section>
        {/* A card of its own, so what follows the turn is read on the surface and never on the grid (#123). */}
        <div className="free-reply">
        {delivered !== null
          ? <>
            <pre className="round-message" data-testid="free-message">{delivered}</pre>
            {queued ? <QueuedNotice session={block.session}/> : <p role="status">{f.sent}</p>}
          </>
          : block.superseded || transcriptGone
            ? <p role="note">{transcriptGone ? t.page.session.transcriptGone : f.superseded}</p>
            : (
              <div className="round-field free-response">
                <label htmlFor="free-response">{f.response}</label>
                <textarea
                  id="free-response" autoFocus rows={5} value={response} aria-describedby={looksLikeCommand ? 'free-response-hint' : undefined}
                  onChange={event => { latest.current = event.target.value; setResponse(event.target.value); saver(event.target.value); }}
                  onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void send(); } }}
                />
                {looksLikeCommand && <small id="free-response-hint">{f.asText}</small>}
                <div className="round-steps"><button type="button" className="primary" disabled={!canSend} onClick={() => void send()}>{sending ? f.sending : f.send}</button></div>
              </div>
            )}
        {failure && delivered === null && <p role="alert">{failure === 'send' ? f.sendFailed : f.saveFailed}</p>}
        </div>
      </main>
    </div>
  );
}
