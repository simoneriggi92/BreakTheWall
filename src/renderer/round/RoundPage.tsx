import { useEffect, useMemo, useRef, useState } from 'react';
import { isAnswered, returnMessage, type Answer, type Draft, type RoundView } from '../../core/round-answers';
import type { RoundBridge } from '../http-bridge';
import { Brand } from '../icons';
import { renderMarkdown } from '../markdown';
import { PreferencesMenu, usePreferences } from '../preferences';

/**
 * A round in the page (#95): the turn's text above, the outline of its questions on the left, one question in focus
 * in the middle, and on the right "what the agent receives", worded live by the same function the server sends with.
 * Every change is saved at once; after Send the round is read-only and shows the message as delivered.
 */
export function RoundPage({ round, bridge }: { round: RoundView; bridge: RoundBridge }) {
  const { t, language } = usePreferences();
  const r = t.page.round;
  const [draft, setDraft] = useState<Draft>(round.draft);
  // Changes read the latest draft from here, so two quick edits never build on the same stale copy.
  const latest = useRef(round.draft);
  const [focus, setFocus] = useState(() => (round.questions.find(q => !isAnswered(round.draft.answers[String(q.number)])) ?? round.questions[0]).number);
  const [delivered, setDelivered] = useState<string | null>(round.sent?.message ?? null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'send' | 'save'>();
  const saver = useDraftSaver(round, bridge, delivered !== null, setFailure);

  // A round sent from another tab arrives through the page's poll.
  useEffect(() => { if (round.sent) setDelivered(round.sent.message); }, [round.sent]);

  const readOnly = delivered !== null || round.superseded;
  const message = delivered ?? returnMessage(round.questions, draft, language);
  const index = Math.max(0, round.questions.findIndex(q => q.number === focus));
  const question = round.questions[index];
  const answer = draft.answers[String(question.number)];
  const answered = round.questions.filter(q => isAnswered(draft.answers[String(q.number)])).length;

  const change = (next: Draft) => {
    if (readOnly) return;
    latest.current = next;
    setDraft(next);
    saver(next);
  };
  const changeAnswer = (patch: Partial<Answer>) => {
    const key = String(question.number);
    const merged: Answer = { ...(latest.current.answers[key] ?? { note: '' }), ...patch };
    if (merged.choice === undefined) delete merged.choice;
    change({ ...latest.current, answers: { ...latest.current.answers, [key]: merged } });
  };
  // Choosing the same thing again takes the choice back; the note stays.
  const toggle = (choice: NonNullable<Answer['choice']>) => changeAnswer({ choice: latest.current.answers[String(question.number)]?.choice === choice ? undefined : choice });

  async function send() {
    setSending(true);
    setFailure(undefined);
    try {
      setDelivered(await bridge.sendRound(round, latest.current, language));
    } catch {
      setFailure('send');
    } finally {
      setSending(false);
    }
  }

  const stateOf = (a: Answer | undefined) => !isAnswered(a) ? r.states.unanswered
    : a!.choice === 'recommendation' ? r.states.recommendation : a!.choice === 'none' ? r.states.none : r.states.note;

  return (
    <div className="round-page">
      <header className="topbar"><Brand/><div className="course-title"><strong>{r.title(round.number)}</strong></div><PreferencesMenu/></header>
      <main className="round-layout">
        {round.turnText && <section className="round-turn" aria-label={r.turnText}><Markdown text={round.turnText}/></section>}
        <nav className="round-outline" aria-label={r.outline}>
          <p className="round-progress">{r.progress(answered, round.questions.length)}</p>
          <ol>
            {round.questions.map(q => (
              <li key={q.number}>
                <button type="button" className={`round-outline-item${isAnswered(draft.answers[String(q.number)]) ? ' is-answered' : ''}`} aria-current={q.number === question.number ? 'true' : undefined} onClick={() => setFocus(q.number)}>
                  <span className="round-outline-title">{r.question(q.number, q.title)}</span>
                  <span className="round-outline-state">{stateOf(draft.answers[String(q.number)])}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <article className="round-question" aria-labelledby="round-question-title">
          <h2 id="round-question-title">{r.question(question.number, question.title)}</h2>
          <Markdown text={question.body}/>
          <section className="round-recommendation" aria-label={r.recommendation}>
            <h3>{r.recommendation}</h3>
            {question.recommendation ? <Markdown text={question.recommendation}/> : <p>{r.noRecommendation}</p>}
          </section>
          {!readOnly && (
            <div className="round-answer">
              <div className="round-choices">
                {question.recommendation && <button type="button" className="subtle" aria-pressed={answer?.choice === 'recommendation'} onClick={() => toggle('recommendation')}>{r.accept}</button>}
                <button type="button" className="subtle" aria-pressed={answer?.choice === 'none'} onClick={() => toggle('none')}>{r.none}</button>
              </div>
              <label className="round-field">{r.note}<textarea value={answer?.note ?? ''} rows={4} onChange={event => changeAnswer({ note: event.target.value })}/></label>
            </div>
          )}
          <div className="round-steps">
            <button type="button" className="subtle" disabled={index === 0} onClick={() => setFocus(round.questions[index - 1].number)}>{r.previous}</button>
            <button type="button" className="subtle" disabled={index === round.questions.length - 1} onClick={() => setFocus(round.questions[index + 1].number)}>{r.next}</button>
          </div>
        </article>
        <section className="round-return" aria-label={r.receives}>
          {!readOnly && (
            <div className="round-field">
              <label htmlFor="round-general-note">{r.generalNote}</label>
              <textarea id="round-general-note" aria-describedby="round-general-hint" value={draft.generalNote} rows={3} onChange={event => change({ ...latest.current, generalNote: event.target.value })}/>
              <small id="round-general-hint">{r.generalNoteHint}</small>
            </div>
          )}
          <h2>{r.receives}</h2>
          <pre className="round-message" data-testid="return-message">{message}</pre>
          {delivered !== null
            ? <p role="status">{r.sent}</p>
            : !round.superseded && <button type="button" className="primary" disabled={sending} onClick={() => void send()}>{sending ? r.sending : r.send}</button>}
          {failure && delivered === null && <p role="alert">{failure === 'send' ? r.sendFailed : r.saveFailed}</p>}
        </section>
      </main>
    </div>
  );
}

/**
 * Saves the draft on every change, one request at a time and always the newest: a slow save never lands over a
 * later one, and edits made while it runs collapse into the next.
 */
function useDraftSaver(round: RoundView, bridge: RoundBridge, sent: boolean, setFailure: (failure: 'save' | undefined) => void) {
  const state = useRef<{ busy: boolean; pending?: Draft }>({ busy: false });
  const sentRef = useRef(sent);
  sentRef.current = sent;
  return (draft: Draft) => {
    const s = state.current;
    s.pending = draft;
    if (s.busy) return;
    s.busy = true;
    void (async () => {
      while (s.pending) {
        const next = s.pending;
        s.pending = undefined;
        try {
          await bridge.saveDraft(round, next);
          setFailure(undefined);
        } catch {
          // Once sent, the server refuses drafts by design: that is not a failure worth showing.
          if (!sentRef.current) setFailure('save');
        }
      }
      s.busy = false;
    })();
  };
}

/** The agent's Markdown, rendered with raw HTML off: markup in a round shows as text and never runs. */
function Markdown({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text).html, [text]);
  return <div className="round-markdown" dangerouslySetInnerHTML={{ __html: html }}/>;
}
