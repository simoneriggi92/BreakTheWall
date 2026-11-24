import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { answerKind, answerOf, attachedOf, isAnswered, quoted, REMARK_PARTS, remarkKey, remarksOf, sortRemarks, type Answer, type Draft, type Remark, type RemarkPart, type RoundView } from '../../core/round-answers';
import type { SideChatPassage } from '../../core/side-chat';
import { answersWithRemarks, type SpecRemarksSection } from '../../core/spec-remarks';
import type { RoundBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import { Brand } from '../icons';
import { renderInlineMarkdown } from '../markdown';
import { PreferencesMenu, usePreferences } from '../preferences';
import { passageIn, type Passage } from './passages';
import { CopyButton, Markdown, PhaseControl, QueuedNotice, useLatestSaver } from './shared';
import { SideChat, useSideChats } from './SideChat';

/**
 * A round in the page (#95): the turn's text above, the outline of its questions on the left, one question in focus
 * in the middle, and on the right "what the agent receives", worded live by the same function the server sends with.
 * Every change is saved at once; after Send the round is read-only and shows the message as delivered. A side chat on
 * the focused question (#100) takes the right column, follows the focus, and folds the return to a strip. A round
 * of an ended session still takes answers, which wait queued for `claude --resume <id>`; once Claude Code no longer
 * keeps the session's transcript it is read-only, its side chats too (#103). Every round copies as Markdown.
 */
export function RoundPage({ round, phaseOpen, queued = false, transcriptGone = false, riding = NO_RIDING, bridge }: {
  round: RoundView;
  phaseOpen: boolean;
  queued?: boolean;
  transcriptGone?: boolean;
  /** Remarks on a spec written while this round awaits answers (#105): they ride in its message, after the answers. */
  riding?: readonly SpecRemarksSection[];
  bridge: RoundBridge;
}) {
  const { t, language } = usePreferences();
  const r = t.page.round;
  const s = t.page.sideChat;
  const x = t.page.session;
  const [draft, setDraft] = useState<Draft>(round.draft);
  // Changes read the latest draft from here, so two quick edits never build on the same stale copy.
  const latest = useRef(round.draft);
  const [focus, setFocus] = useState(() => (round.questions.find(q => !isAnswered(answerOf(round.draft, q))) ?? round.questions[0]).number);
  const [delivered, setDelivered] = useState<string | null>(round.sent?.message ?? null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'send' | 'save'>();
  const saver = useLatestSaver((next: Draft) => bridge.saveDraft(round, next), delivered !== null, setFailure);

  // A round sent from another tab arrives through the page's poll.
  useEffect(() => { if (round.sent) setDelivered(round.sent.message); }, [round.sent]);

  const readOnly = delivered !== null || round.superseded || transcriptGone;
  const message = delivered ?? answersWithRemarks(round.questions, draft, language, riding);
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
    if (!merged.remarks?.length) delete merged.remarks;
    if (!merged.attached?.length) delete merged.attached;
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

  // Remarks (#98): a passage selected in the question's body or recommendation offers "Remark"; the remark's field
  // opens focused, and the passage stays marked while the remark exists. Beside it, "Ask here" (#101) asks about the
  // passage in the side chat, which reads and so works on a sent or superseded round too.
  const remarks = remarksOf(answer);
  const article = useRef<HTMLElement>(null);
  const hosts: Record<RemarkPart, RefObject<HTMLDivElement | null>> = { body: useRef(null), recommendation: useRef(null) };
  const [selected, setSelected] = useState<Passage & { part: RemarkPart; top: number; left: number } | null>(null);
  /** The remark whose field opens focused: the one just made, or the one its passage already had. */
  const [focusRemark, setFocusRemark] = useState<string | null>(null);
  const readSelection = () => {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    for (const part of REMARK_PARTS) {
      const host = hosts[part].current;
      const passage = range && host ? passageIn(host, range) : null;
      if (passage) return setSelected({ part, ...passage, ...below(range!, article.current) });
    }
    setSelected(null);
  };
  useEffect(() => {
    // A click elsewhere empties the selection, and the offer goes with it.
    const cleared = () => { if (document.getSelection()?.isCollapsed !== false) setSelected(null); };
    document.addEventListener('selectionchange', cleared);
    return () => document.removeEventListener('selectionchange', cleared);
  }, []);
  const takeSelection = () => { setSelected(null); document.getSelection()?.removeAllRanges(); };
  const changeRemarks = (next: Remark[]) => changeAnswer({ remarks: sortRemarks(next) });
  const addRemark = () => {
    if (!selected) return;
    const { part, start, end, passage } = selected;
    const kept = remarksOf(answerOf(latest.current, question));
    // The same passage twice is one remark: selecting it again only opens its field.
    const key = remarkKey(selected);
    if (!kept.some(x => remarkKey(x) === key)) changeRemarks([...kept, { part, start, end, passage, text: '' }]);
    setFocusRemark(key);
    takeSelection();
  };
  const editRemark = (target: Remark, patch: Partial<Remark> | null) => changeRemarks(remarksOf(answerOf(latest.current, question)).flatMap(x =>
    remarkKey(x) !== remarkKey(target) ? [x] : patch ? [{ ...x, ...patch }] : []));

  const band = useWidthBand();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showReturn = band !== 'drawer' || drawerOpen;

  // Side chats (#100): one per question; the column, once open, shows the side chat of the question in focus.
  const sideChats = useSideChats(bridge, round);
  const sideChatOf = (number: number) => sideChats.find(x => x.question === number);
  const [chatOpen, setChatOpen] = useState(false);
  /** What the person is typing in each question's side chat, kept while the focus moves. */
  const [asks, setAsks] = useState<Record<number, string>>({});
  /** The passage each question's next side-chat question quotes, chosen with "Ask here" (#101). */
  const [asking, setAsking] = useState<Record<number, SideChatPassage | undefined>>({});
  // In the narrowest layout the column is the drawer, so opening the chat opens it.
  const openChat = () => { setChatOpen(true); setDrawerOpen(true); };
  const askHere = () => {
    if (!selected) return;
    const { part, start, end, passage } = selected;
    setAsking(kept => ({ ...kept, [question.number]: { part, start, end, passage } }));
    openChat();
    takeSelection();
  };
  const askSideChat = async (number: number, text: string) => {
    await bridge.askSideChat(round, number, text, asking[number]);
    setAsks(kept => ({ ...kept, [number]: '' }));
    setAsking(kept => ({ ...kept, [number]: undefined }));
  };
  // The passages asked about are marked in the question in the side chat's colour, apart from remarks.
  const askedPassages = [...sideChatOf(question.number)?.turns.map(x => x.passage) ?? [], asking[question.number]]
    .filter((x): x is SideChatPassage => x !== undefined);
  const marksIn = (part: RemarkPart) => [
    ...remarks.filter(x => x.part === part),
    ...askedPassages.filter(x => x.part === part).map(x => ({ ...x, kind: 'ask' as const })),
  ];
  /** 📎 (#101): attaches a finished reply to the question's answer, copied whole, or takes it back. */
  const toggleAttached = (number: number) => {
    const turn = sideChatOf(question.number)?.turns.find(x => x.number === number);
    if (!turn || turn.status !== 'done') return;
    const kept = attachedOf(answerOf(latest.current, question));
    changeAnswer({
      attached: kept.some(x => x.turn === number)
        ? kept.filter(x => x.turn !== number)
        : attachedOf({ note: '', attached: [...kept, { turn: number, ask: turn.ask, ...(turn.passage ? { passage: turn.passage.passage } : {}), reply: turn.reply }] }),
    });
  };
  // The review before Send counts the side chats with a reply to attach and none attached.
  const unattached = sideChats.filter(x => x.turns.some(t => t.status === 'done') && attachedOf(answerOf(draft, { number: x.question })).length === 0).length;

  const goTo = (number: number) => { setFocus(number); setNoteOpen(null); setSelected(null); setFocusRemark(null); };
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
    if (event.key === 'Escape' && chatOpen) return setChatOpen(false), true;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'j') return move(1), true;
    if (event.key === 'k') return move(-1), true;
    // Asking is reading, not answering: it works on a sent or superseded round too.
    if (event.key === 'c') return openChat(), true;
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

  const drawerBar = band === 'drawer' && <div className="round-drawer-bar">
    <PhaseControl session={round.session} open={phaseOpen} bridge={bridge}/>
    <button type="button" className="subtle round-drawer-close" onClick={() => { setDrawerOpen(false); drawerToggle.current?.focus(); }}>{r.closeReceives}</button>
  </div>;
  const generalField = !readOnly && (showGeneral
    ? (
      <div className="round-field">
        <label htmlFor="round-general-note">{r.generalNote}</label>
        <textarea id="round-general-note" autoFocus={generalOpen} aria-describedby="round-general-hint" value={draft.generalNote} rows={3} onChange={event => { setGeneralOpen(true); change({ ...latest.current, generalNote: event.target.value }); }}/>
        <small id="round-general-hint">{r.generalNoteHint}</small>
      </div>
    )
    : <button type="button" className="round-write" onClick={() => setGeneralOpen(true)}>{r.writeGeneralNote}</button>);
  const returnBody = <>
    <pre className="round-message" data-testid="return-message">{message}</pre>
    {!readOnly && unattached > 0 && <p className="round-unattached">{s.unattached(unattached)}</p>}
    {delivered !== null
      ? queued ? <QueuedNotice session={round.session}/> : <p role="status">{r.sent}</p>
      : !round.superseded && !transcriptGone && <button type="button" className="primary" disabled={sending} onClick={() => void send()}>{sending ? r.sending : r.send}</button>}
    {transcriptGone && <p role="note">{x.transcriptGone}</p>}
    {/* The way out by hand, whatever happens to the delivery: what the agent receives, or received, as Markdown. */}
    <CopyButton text={message} label={x.copyMarkdown}/>
    {failure && delivered === null && <p role="alert">{failure === 'send' ? r.sendFailed : r.saveFailed}</p>}
  </>;

  return (
    <div className="round-page">
      {/* Progress sits in the sticky top bar, so it stays in view at every width, the outline folded or not. */}
      <header className="topbar"><Brand/><div className="course-title"><strong>{r.title(round.number)}</strong></div><span className="round-progress">{r.progress(answered, round.questions.length)}</span>
        {band === 'drawer' && <button ref={drawerToggle} type="button" className="subtle" aria-expanded={drawerOpen} aria-controls={drawerOpen ? 'round-return' : undefined} onClick={() => setDrawerOpen(open => !open)}>{r.receives}</button>}
        {/* Below ~860 px the bar has no room for it: it goes into the drawer with the rest of the right column. */}
        {band !== 'drawer' && <PhaseControl session={round.session} open={phaseOpen} bridge={bridge}/>}
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
              const asked = sideChatOf(q.number)?.turns.length ?? 0;
              return (
                <li key={q.number}>
                  <button
                    type="button" className={`round-outline-item${done ? ' is-answered' : ''}${collapsed ? ' is-collapsed' : ''}`}
                    aria-current={q.number === question.number ? 'true' : undefined} onClick={() => goTo(q.number)}
                    {...(collapsed ? { title: q.title, 'aria-label': r.collapsed(q.number, q.title, answerState(a)) } : {})}
                  >
                    <span className="round-outline-title">{rail ? `${r.number(q.number)}${done ? ' ✓' : ''}` : collapsed ? r.number(q.number) : r.question(q.number, q.title)}</span>
                    {!rail && <span className="round-outline-state">{answerState(a)}</span>}
                    {asked > 0 && <span className="round-outline-chat" title={s.count(asked)}>💬 {asked}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <article ref={article} className={`round-question${chatOpen ? ' is-chatting' : ''}`} aria-labelledby="round-question-title" onMouseUp={readSelection} onKeyUp={readSelection}>
          <div className="round-question-head">
            <h2 id="round-question-title">{r.question(question.number, question.title)}</h2>
            <button type="button" className="subtle round-chat-open" aria-label={s.open} title={s.open} aria-pressed={chatOpen} aria-keyshortcuts="c" onClick={() => chatOpen ? setChatOpen(false) : openChat()}>{s.openShort}</button>
          </div>
          <Markdown text={question.body} host={hosts.body} marks={marksIn('body')}/>
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
            {question.recommendation ? <Markdown text={question.recommendation} host={hosts.recommendation} marks={marksIn('recommendation')}/> : <p>{r.noRecommendation}</p>}
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
          {/* Without the session's transcript there is nothing to ask (#103), and a read-only round takes no remark. */}
          {selected && !transcriptGone && (
            // Pressing either must not empty the selection it acts on.
            <div className="round-selection-offer" style={{ top: selected.top, left: selected.left }} onMouseDown={event => event.preventDefault()}>
              {!readOnly && <button type="button" className="round-remark-offer" onClick={addRemark}>{r.remark}</button>}
              <button type="button" className="round-ask-offer" onClick={askHere}>{r.askHere}</button>
            </div>
          )}
          {remarks.length > 0 && (
            <section className="round-remarks" aria-label={r.remarks}>
              <h3>{r.remarks}</h3>
              <ol>
                {remarks.map(remark => {
                  const quote = quoted(remark.passage);
                  return (
                    <li key={remarkKey(remark)}>
                      <q className="round-remark-passage">{quote}</q>
                      {readOnly
                        ? <p className="round-remark-text">{remark.text}</p>
                        : <>
                          <textarea aria-label={r.remarkOn(quote)} autoFocus={focusRemark === remarkKey(remark)} value={remark.text} rows={2} onChange={event => editRemark(remark, { text: event.target.value })}/>
                          <button type="button" className="subtle" aria-label={r.removeRemarkOn(quote)} onClick={() => editRemark(remark, null)}>{r.removeRemark}</button>
                        </>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          <p className="round-keys">{keyHint(r.keys, s.key, question.options.length, Boolean(question.recommendation), readOnly)}</p>
          {/* Moving is the outline's job and j/k's; the step forward shows up here once the question is answered. */}
          {!readOnly && isAnswered(answer) && index < round.questions.length - 1 && (
            <div className="round-steps"><button type="button" className="primary" onClick={() => move(1)}>{r.next}</button></div>
          )}
        </article>
        {showReturn && (chatOpen
          ? <div className="round-side">
            {drawerBar}
            <SideChat
              question={question} sideChat={sideChatOf(question.number)} readOnly={transcriptGone}
              ask={asks[question.number] ?? ''} onAskChange={text => setAsks(kept => ({ ...kept, [question.number]: text }))}
              passage={asking[question.number]} onDropPassage={() => setAsking(kept => ({ ...kept, [question.number]: undefined }))}
              attached={attachedOf(answer).map(x => x.turn)} onAttach={readOnly ? undefined : toggleAttached}
              onAsk={text => askSideChat(question.number, text)} onClose={() => setChatOpen(false)}
            />
            <details id="round-return" className="round-return-strip" aria-label={r.receives}>
              <summary>{r.receives} · {r.progress(answered, round.questions.length)}</summary>
              <div className="round-return-body">{generalField}{returnBody}</div>
            </details>
          </div>
          : <section id="round-return" className="round-return" aria-label={r.receives}>
            {drawerBar}
            {generalField}
            <h2>{r.receives}</h2>
            {returnBody}
          </section>)}
      </main>
    </div>
  );
}

const NO_RIDING: readonly SpecRemarksSection[] = [];

/**
 * Where the "Remark" and "Ask here" offer goes. Under the selection's end, so it covers neither the passage nor the line it starts
 * on; measured against the question, which positions it, so scrolling the page never leaves it behind.
 */
function below(range: Range, frame: HTMLElement | null): { top: number; left: number } {
  // jsdom lays nothing out and has no rectangle for a range.
  if (!frame || typeof range.getBoundingClientRect !== 'function') return { top: 0, left: 0 };
  const rect = range.getBoundingClientRect(), box = frame.getBoundingClientRect();
  return { top: rect.bottom - box.top + 4, left: Math.max(0, rect.right - box.left - 40) };
}

/** The keys that work on the question in focus, and only those: no pick without options, no accept without a recommendation. */
function keyHint(keys: Messages['page']['round']['keys'], chat: string, options: number, accept: boolean, readOnly: boolean): string {
  if (readOnly) return [keys.move, chat].join(' · ');
  const pick = options > 1 ? keys.pick(`1–${options}`) : options === 1 ? keys.pick('1') : null;
  return [keys.move, pick, accept ? keys.accept : null, keys.note, chat, keys.send].filter(Boolean).join(' · ');
}

type WidthBand = 'wide' | 'rail' | 'drawer';
const RAIL = '(max-width: 1180px)', DRAWER = '(max-width: 860px)';
/**
 * How wide the window is, in the page's two steps: below ~1180 px the outline folds into a rail, below ~860 px the
 * right column becomes a drawer. Read from `matchMedia` so the layout and what is on the page change together;
 * without it (a test environment) the page is wide.
 */
function useWidthBand(): WidthBand {
  return useSyncExternalStore(subscribeToWidth, widthBand);
}
// At module level: React subscribes again whenever it is handed a new subscribe function, so an inline one would
// re-register both listeners on every render.
function subscribeToWidth(changed: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const lists = [window.matchMedia(RAIL), window.matchMedia(DRAWER)];
  lists.forEach(list => list.addEventListener('change', changed));
  return () => lists.forEach(list => list.removeEventListener('change', changed));
}
function widthBand(): WidthBand {
  if (typeof window.matchMedia !== 'function') return 'wide';
  return window.matchMedia(DRAWER).matches ? 'drawer' : window.matchMedia(RAIL).matches ? 'rail' : 'wide';
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

/** An option's label or consequence: inline Markdown only, as it sits inside a button. */
function Inline({ text, className }: { text: string; className: string }) {
  const html = useMemo(() => renderInlineMarkdown(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }}/>;
}
