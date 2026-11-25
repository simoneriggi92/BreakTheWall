import { useState } from 'react';
import { projectName, type History, type HistorySession } from '../../core/session-history';
import type { UnreadableHandover } from '../../core/spec';
import type { HistoryBridge, RoundKey } from '../http-bridge';
import { usePreferences } from '../preferences';

/**
 * The history column (#102): every project, its sessions (when they started, live or ended, the round skill and
 * ticket they began with) and their numbered rounds with their state. A round opens in the page; a session is
 * deleted only once the person confirms, since nothing brings it back.
 */
export function SessionHistory({ history, shown, bridge, onOpen, onDeleted, onClose }: {
  history: History;
  /** The round the page shows, marked in the column. */
  shown: RoundKey | null;
  bridge: HistoryBridge;
  onOpen(round: RoundKey): void;
  onDeleted(session: string): void;
  onClose(): void;
}) {
  const { t } = usePreferences();
  const h = t.page.history;
  return (
    <aside className="page-history" aria-label={h.title}>
      <header className="page-history-bar"><h2>{h.title}</h2><button type="button" className="subtle" onClick={onClose}>{h.close}</button></header>
      {history.projects.map(project => (
        <section key={project.cwd} className="page-history-project" aria-label={projectName(project.cwd)}>
          <h3 title={project.cwd}>{projectName(project.cwd)}</h3>
          <ul>{project.sessions.map(session => (
            <li key={session.session}><SessionEntry session={session} shown={shown} bridge={bridge} onOpen={onOpen} onDeleted={onDeleted}/></li>
          ))}</ul>
        </section>
      ))}
    </aside>
  );
}

function SessionEntry({ session, shown, bridge, onOpen, onDeleted }: { session: HistorySession; shown: RoundKey | null; bridge: HistoryBridge; onOpen(round: RoundKey): void; onDeleted(session: string): void }) {
  const { t, language } = usePreferences();
  const h = t.page.history;
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.startedAt));
  const began = [session.ticket === null ? null : `#${session.ticket}`, session.skill].filter(Boolean);
  async function remove() {
    setFailed(false);
    try {
      await bridge.deleteSession(session.session);
      onDeleted(session.session);
    } catch {
      setFailed(true);
      setConfirming(false);
    }
  }
  return (
    <div className="page-history-session">
      <p className="page-history-meta">
        <time dateTime={session.startedAt}>{started}</time>
        {' · '}<span className={session.live ? 'is-live' : undefined}>{[session.live ? h.live : h.ended, session.transcriptGone ? h.transcriptGone : null, ...began].filter(Boolean).join(' · ')}</span>
      </p>
      <ol className="page-history-rounds">
        {session.rounds.map(round => (
          <li key={round.number}>
            <button
              type="button" className={`page-history-round is-${round.state}`}
              aria-current={shown?.session === session.session && shown.number === round.number ? 'true' : undefined}
              onClick={() => onOpen({ session: session.session, number: round.number })}
            >{`${h.round(round.number)} · ${h.states[round.state]}`}</button>
          </li>
        ))}
      </ol>
      {confirming
        ? <div className="page-history-confirm">
          <button type="button" className="subtle page-history-delete" onClick={() => void remove()}>{h.confirmDelete}</button>
          <button type="button" className="subtle" onClick={() => setConfirming(false)}>{h.keep}</button>
        </div>
        : <button type="button" className="subtle" onClick={() => setConfirming(true)}>{h.delete}</button>}
      {failed && <p role="alert">{h.deleteFailed}</p>}
    </div>
  );
}

/**
 * What the page says beside what it shows: a round or a spec that arrived while the person was writing or reading
 * history, named by its project, with the action that opens it; and a newer version waiting for the other sessions to end.
 */
export function PageNotices({ arrived, project, spec, update, onOpen }: {
  arrived: 'round' | 'free' | null;
  project: string | null;
  /** A spec handed over meanwhile (#104), with the project it came from. */
  spec: { project: string | null; onOpen(): void } | null;
  update: string | null;
  onOpen(): void;
}) {
  const { t } = usePreferences();
  const n = t.page.notice;
  if (!arrived && !spec && !update) return null;
  return (
    <div className="page-notices">
      {arrived && <Arrived words={arrived === 'free' ? n.newTurn : n.newRound} project={project} onOpen={onOpen}/>}
      {spec && <Arrived words={n.newSpec} project={spec.project} onOpen={spec.onOpen}/>}
      {update && <p className="page-notice">{n.update(update)}</p>}
    </div>
  );
}

function Arrived({ words, project, onOpen }: { words: string; project: string | null; onOpen(): void }) {
  const { t } = usePreferences();
  return <p role="status" className="page-notice" aria-label={project ? `${words} ${project}` : words}>
    <span>{words} {project && <em>{project}</em>}</span>
    <button type="button" className="primary" onClick={onOpen}>{t.page.notice.open}</button>
  </p>;
}

/**
 * Handovers the server could not read (#104): the location as the agent wrote it and why, so a spec that never
 * opened is not mistaken for one still being read. The person closes each; the next read handover clears it anyway.
 */
export function UnreadableNotices({ unreadable, onClose }: { unreadable: readonly UnreadableHandover[]; onClose(x: UnreadableHandover): void }) {
  const { t } = usePreferences();
  const n = t.page.notice;
  if (unreadable.length === 0) return null;
  return (
    <div className="page-notices">
      {unreadable.map(x => <p key={`${x.session}/${x.at}`} role="alert" className="page-notice">
        <span>{n.unreadable(x.location, n.unreadableWhy[x.why])}</span>
        <button type="button" className="subtle" onClick={() => onClose(x)}>{t.common.closeNotice}</button>
      </p>)}
    </div>
  );
}
