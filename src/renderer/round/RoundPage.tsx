import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { answerKind, answerOf, isAnswered, returnMessage, type Answer, type Draft, type RoundView } from '../../core/round-answers';
import type { RoundBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import { Brand } from '../icons';
import { renderInlineMarkdown, renderMarkdown } from '../markdown';
import { PreferencesMenu, usePreferences } from '../preferences';
import { useDiagrams } from '../use-diagrams';

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
  const [focus, setFocus] = useState(() => (round.questions.find(q => !isAnswered(answerOf(round.draft, q))) ?? round.questions[0]).number);
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
  const answer = answerOf(draft, question);
  const answered = round.questions.filter(q => isAnswered(answerOf(draft, q))).length;

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
  const toggle = (choice: NonNullable<Answer['choice']>) => changeAnswer({ choice: answerOf(latest.current, question)?.choice === choice ? undefined : choice });
  const answerState = (a: Answer | undefined) => {
    const kind = answerKind(a);
    return kind === 'option' ? r.optionState(a?.choice ?? '') : r.states[kind];
  };

  // Fields stay folded behind a small button until used, so a question opens with its answers and little else. A
  // field with text is always open; one opened by hand stays open while emptied, so typing never makes it vanish.
  const note = useRef<HTMLTextAreaElement>(null);
  const [noteOpen, setNoteOpen] = useState<number | null>(null);
  const showNote = noteOpen === question.number || Boolean(answer?.note);
  const [generalOpen, setGeneralOpen] = useState(false);
  const showGeneral = generalOpen || draft.generalNote !== '';
  const openNote = () => { if (note.current) note.current.focus(); else setNoteOpen(question.number); };

  const band = useWidthBand();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showReturn = band !== 'drawer' || drawerOpen;

  const goTo = (number: number) => { setFocus(number); setNoteOpen(null); };
  const move = (step: number) => goTo(round.questions[Math.min(round.questions.length - 1, Math.max(0, index + step))].number);
  const canSend = !readOnly && !sending;
  const drawerToggle = useRef<HTMLButtonElement>(null);

  useRoundKeys(event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return canSend ? (void send(), true) : false;
    if (inField(event.target)) {
      // Escape hands the keys back to the round without losing what was typed.
      if (event.key !== 'Escape') return false;
      (event.target as HTMLElement).blur();
      return true;
    }
    // A focused button inside a closing drawer would vanish with it and drop the focus on the page.
    if (event.key === 'Escape' && band === 'drawer' && drawerOpen) return setDrawerOpen(false), drawerToggle.current?.focus(), true;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'j') return move(1), true;
    if (event.key === 'k') return move(-1), true;
    if (readOnly) return false;
    // "y" only accepts: pressed twice it keeps the answer, unlike the button, which toggles.
    if (event.key === 'y' && question.recommendation) return changeAnswer({ choice: 'recommendation' }), true;
    if (event.key === 'n') return openNote(), true;
    // Digits pick options in their order, as in the owner's prototype (#78): an option may carry any letter a–z, so
    // letter keys would collide with j, k, n and y.
    const option = /^[1-9]$/.test(event.key) ? question.options[Number(event.key) - 1] : undefined;
    if (option) return toggle(option.letter), true;
    return false;
  });

  async function send() {
    // In the narrowest layout the result shows in the drawer, so sending opens it.
    setDrawerOpen(true);
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

  return (
    <div className="round-page">
      {/* Progress sits in the sticky top bar, so it stays in view at every width, the outline folded or not. */}
      <header className="topbar"><Brand/><div className="course-title"><strong>{r.title(round.number)}</strong></div><span className="round-progress">{r.progress(answered, round.questions.length)}</span>
        {band === 'drawer' && <button ref={drawerToggle} type="button" className="subtle" aria-expanded={drawerOpen} aria-controls={drawerOpen ? 'round-return' : undefined} onClick={() => setDrawerOpen(open => !open)}>{r.receives}</button>}
        <PreferencesMenu/>
      </header>
      <main className={`round-layout is-${band}`}>
        {round.turnText && <section className="round-turn" aria-label={r.turnText}><Markdown text={round.turnText}/></section>}
        <nav className="round-outline" aria-label={r.outline}>
          <ol>
            {round.questions.map(q => {
              const a = answerOf(draft, q);
              const done = isAnswered(a);
              // An answered question out of focus folds to its number and answer: what is left to do stands out. In the
              // rail every question is its number, with a tick once answered; the title stays in its name and tooltip.
              const rail = band !== 'wide';
              const collapsed = rail || (done && q.number !== question.number);
              return (
                <li key={q.number}>
                  <button
                    type="button" className={`round-outline-item${done ? ' is-answered' : ''}${collapsed ? ' is-collapsed' : ''}`}
                    aria-current={q.number === question.number ? 'true' : undefined} onClick={() => goTo(q.number)}
                    {...(collapsed ? { title: q.title, 'aria-label': r.collapsed(q.number, q.title, answerState(a)) } : {})}
                  >
                    <span className="round-outline-title">{rail ? `${r.number(q.number)}${done ? ' ✓' : ''}` : collapsed ? r.number(q.number) : r.question(q.number, q.title)}</span>
                    {!rail && <span className="round-outline-state">{answerState(a)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <article className="round-question" aria-labelledby="round-question-title">
          <h2 id="round-question-title">{r.question(question.number, question.title)}</h2>
          <Markdown text={question.body}/>
          {question.options.length > 0 && (
            <div className="round-options" role="group" aria-label={r.options}>
              {question.options.map(option => (
                <button
                  key={option.letter} type="button" className={`round-option${option.letter === question.recommended ? ' is-recommended' : ''}`}
                  aria-pressed={answer?.choice === option.letter} disabled={readOnly} onClick={() => toggle(option.letter)}
                >
                  <span className="round-option-head">
                    <span className="round-option-letter">({option.letter})</span>
                    <Inline className="round-option-label" text={option.label}/>
                    {option.letter === question.recommended && <span className="round-option-badge">{r.recommended}</span>}
                  </span>
                  {option.consequence && <Inline className="round-option-consequence" text={option.consequence}/>}
                </button>
              ))}
            </div>
          )}
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
              {showNote
                ? <label className="round-field">{r.note}<textarea ref={note} autoFocus={noteOpen === question.number} value={answer?.note ?? ''} rows={4} onChange={event => { setNoteOpen(question.number); changeAnswer({ note: event.target.value }); }}/></label>
                : <button type="button" className="round-write" onClick={openNote}>{r.writeNote}</button>}
            </div>
          )}
          <p className="round-keys">{keyHint(r.keys, question.options.length, Boolean(question.recommendation), readOnly)}</p>
          {/* Moving is the outline's job and j/k's; the step forward shows up here once the question is answered. */}
          {!readOnly && isAnswered(answer) && index < round.questions.length - 1 && (
            <div className="round-steps"><button type="button" className="primary" onClick={() => move(1)}>{r.next}</button></div>
          )}
        </article>
        {showReturn && <section id="round-return" className="round-return" aria-label={r.receives}>
          {band === 'drawer' && <button type="button" className="subtle round-drawer-close" onClick={() => { setDrawerOpen(false); drawerToggle.current?.focus(); }}>{r.closeReceives}</button>}
          {!readOnly && (showGeneral
            ? (
              <div className="round-field">
                <label htmlFor="round-general-note">{r.generalNote}</label>
                <textarea id="round-general-note" autoFocus={generalOpen} aria-describedby="round-general-hint" value={draft.generalNote} rows={3} onChange={event => { setGeneralOpen(true); change({ ...latest.current, generalNote: event.target.value }); }}/>
                <small id="round-general-hint">{r.generalNoteHint}</small>
              </div>
            )
            : <button type="button" className="round-write" onClick={() => setGeneralOpen(true)}>{r.writeGeneralNote}</button>)}
          <h2>{r.receives}</h2>
          <pre className="round-message" data-testid="return-message">{message}</pre>
          {delivered !== null
            ? <p role="status">{r.sent}</p>
            : !round.superseded && <button type="button" className="primary" disabled={sending} onClick={() => void send()}>{sending ? r.sending : r.send}</button>}
          {failure && delivered === null && <p role="alert">{failure === 'send' ? r.sendFailed : r.saveFailed}</p>}
        </section>}
      </main>
    </div>
  );
}

/** The keys that work on the question in focus, and only those: no pick without options, no accept without a recommendation. */
function keyHint(keys: Messages['page']['round']['keys'], options: number, accept: boolean, readOnly: boolean): string {
  if (readOnly) return keys.move;
  const pick = options > 1 ? keys.pick(`1–${options}`) : options === 1 ? keys.pick('1') : null;
  return [keys.move, pick, accept ? keys.accept : null, keys.note, keys.send].filter(Boolean).join(' · ');
}

type WidthBand = 'wide' | 'rail' | 'drawer';
const RAIL = '(max-width: 1180px)', DRAWER = '(max-width: 860px)';
/**
 * How wide the window is, in the page's two steps: below ~1180 px the outline folds into a rail, below ~860 px the
 * right column becomes a drawer. Read from `matchMedia` so the layout and what is on the page change together;
 * without it (a test environment) the page is wide.
 */
function useWidthBand(): WidthBand {
  return useSyncExternalStore(changed => {
    if (typeof window.matchMedia !== 'function') return () => {};
    const lists = [window.matchMedia(RAIL), window.matchMedia(DRAWER)];
    lists.forEach(list => list.addEventListener('change', changed));
    return () => lists.forEach(list => list.removeEventListener('change', changed));
  }, () => {
    if (typeof window.matchMedia !== 'function') return 'wide';
    return window.matchMedia(DRAWER).matches ? 'drawer' : window.matchMedia(RAIL).matches ? 'rail' : 'wide';
  });
}

const inField = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The round's keys, listened to on the whole document so they work wherever the focus rests. The handler is read
 * from a ref on every key, so it always sees the current question and draft; it returns true for a key it used.
 */
function useRoundKeys(handle: (event: KeyboardEvent) => boolean) {
  const current = useRef(handle);
  current.current = handle;
  useEffect(() => {
    const listen = (event: KeyboardEvent) => { if (!event.defaultPrevented && current.current(event)) event.preventDefault(); };
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);
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

/** An option's label or consequence: inline Markdown only, as it sits inside a button. */
function Inline({ text, className }: { text: string; className: string }) {
  const html = useMemo(() => renderInlineMarkdown(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }}/>;
}

/**
 * The agent's Markdown, rendered with raw HTML off: markup in a round shows as text and never runs. Mermaid fences
 * are drawn in place, so an architecture question is judged from its diagram.
 */
function Markdown({ text }: { text: string }) {
  const { t, theme } = usePreferences();
  const rendered = useMemo(() => renderMarkdown(text), [text]);
  const host = useRef<HTMLDivElement>(null);
  useDiagrams(host, rendered, theme, t.d.diagramFailed);
  return <div ref={host} className="round-markdown" dangerouslySetInnerHTML={{ __html: rendered.html }}/>;
}
