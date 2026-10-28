import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Home, LockKeyhole, MessageSquareText, PanelRight, X } from 'lucide-react';
import type { DesktopBridge, ProgressResult } from '../core/bridge';
import type { IncomingSource } from '../core/provider';
import { validateLesson, type Lesson } from '../core/lesson';
import { canVisit, initialState, navigate, restoreState, solved, submit, type LearnerState, type RestoredState } from '../core/state';
import { validateDisassembly, type Disassembly } from '../core/disassembly';
import { loadPreparedDisassemblies } from '../fixtures/disassemblies';
import { DisassemblyPlayer } from './disassembly/DisassemblyPlayer';
import { Brand } from './icons';
import { LessonBlock } from './blocks';
import { browserBridge } from './storage';
import { emptyDraft, type StudioDraft } from './Studio';
import { Library, rememberLesson } from './Library';
import { PreferencesMenu, PreferencesProvider, restoreText, usePreferences } from './preferences';
import { StudyTools, type ToolTab } from './StudyTools';

/**
 * `prepared` lessons are shown as earlier paths. The desktop app passes none: prepared disassemblies replaced them,
 * and saved generated lessons come from the store.
 */
export function App({ bridge = window.breakTheWall ?? browserBridge, prepared, disassemblies }: { bridge?: DesktopBridge; prepared?: Lesson[]; disassemblies?: Disassembly[] }) {
  return <PreferencesProvider bridge={bridge}><Shell bridge={bridge} prepared={prepared} preparedDisassemblies={disassemblies}/></PreferencesProvider>;
}

function Shell({ bridge, prepared, preparedDisassemblies }: { bridge: DesktopBridge; prepared?: Lesson[]; preparedDisassemblies?: Disassembly[] }) {
  const { t } = usePreferences();
  const lessons = prepared ?? [];
  const [disassemblies, setDisassemblies] = useState<Disassembly[]>(preparedDisassemblies ?? []);
  const [generatedDisassemblies, setGeneratedDisassemblies] = useState<Disassembly[]>([]);
  const [selected, setSelected] = useState<{ kind: 'lesson' | 'disassembly'; id: string }>();
  // Errors and notices are kept as codes and worded at render time, so they follow a language switch.
  const [error, setError] = useState<keyof typeof t.shell>();
  const [runtime, setRuntime] = useState<'desktop' | 'browser'>();
  const [generated, setGenerated] = useState<Lesson[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [draft, setDraft] = useState<StudioDraft>(emptyDraft);
  // Texts an AI assistant handed over: the library opens Studio, which takes them once no generation is running.
  const [incoming, setIncoming] = useState<IncomingSource[]>([]);
  useEffect(() => bridge.studio?.onIncomingSource?.(item => { setIncoming(list => [...list, item]); setSelected(undefined); }), [bridge]);
  useEffect(() => {
    let active = true;
    void bridge.studio?.listLessons().then(async result => {
      const checked = await Promise.allSettled(result.lessons.map(x => validateLesson(x)));
      if (!active) return;
      setGenerated(checked.flatMap(x => x.status === 'fulfilled' && x.value.kind === 'generated' ? [x.value] : []));
      setSkipped(result.skipped + checked.filter(x => x.status === 'rejected').length);
    }).catch(() => { if (active) setError('generatedUnreadable'); });
    void bridge.studio?.listDisassemblies?.().then(async result => {
      const checked = await Promise.allSettled(result.disassemblies.map(x => validateDisassembly(x)));
      if (!active) return;
      setGeneratedDisassemblies(checked.flatMap(x => x.status === 'fulfilled' && x.value.kind === 'generated' ? [x.value] : []));
      setSkipped(n => n + result.skipped + checked.filter(x => x.status === 'rejected').length);
    }).catch(() => { if (active) setError('generatedUnreadable'); });
    return () => { active = false; };
  }, [bridge]);
  useEffect(() => {
    let active = true;
    if (!preparedDisassemblies) void loadPreparedDisassemblies().then(data => { if (active) setDisassemblies(data); }).catch(() => { if (active) setError('examplesInvalid'); });
    void bridge.getRuntime().then(info => { if (active) setRuntime(info.mode); }).catch(() => { if (active) setError('desktopUnavailable'); });
    return () => { active = false; };
  }, [bridge, preparedDisassemblies]);
  const open = (id: string) => { rememberLesson(id); setSelected({ kind: 'lesson', id }); };
  const openDisassembly = (id: string) => { rememberLesson(id); setSelected({ kind: 'disassembly', id }); };
  const allDisassemblies = [...generatedDisassemblies, ...disassemblies];
  const lesson = selected?.kind === 'lesson' ? [...generated, ...lessons].find(x => x.id === selected.id) : undefined;
  const disassembly = selected?.kind === 'disassembly' ? allDisassemblies.find(x => x.id === selected.id) : undefined;
  const created = (item: Disassembly) => { setGeneratedDisassemblies(list => [item, ...list.filter(x => x.id !== item.id)]); setDraft(emptyDraft); openDisassembly(item.id); };
  // A part taken apart is a new revision of the same disassembly; the player reopens on it, with progress moved by the host.
  const expanded = (next: Disassembly) => setGeneratedDisassemblies(list => list.map(x => x.id === next.id ? next : x));
  const runtimeLabel = runtime === 'desktop' ? t.common.desktopRuntime : runtime === 'browser' ? t.common.browserRuntime : '';
  return <><a href="#main" className="skip-link">{t.common.skip}</a>{disassembly
    ? <DisassemblyPlayer key={`${disassembly.id}:${disassembly.revision}`} d={disassembly} bridge={bridge} goHome={() => setSelected(undefined)} onExpanded={expanded}
        versions={disassembly.family ? allDisassemblies.filter(x => x.family === disassembly.family && x.id !== disassembly.id) : []} openVersion={openDisassembly}/>
    : lesson
    ? <Player key={lesson.id} lesson={lesson} bridge={bridge} runtime={runtimeLabel} goHome={() => setSelected(undefined)}/>
    : <><header className="topbar library-top"><Brand/><span className="runtime"><span className="status-dot"/>{runtimeLabel || t.common.opening}</span><PreferencesMenu/></header><Library lessons={lessons} generated={generated} disassemblies={allDisassemblies} bridge={bridge} error={error ? t.shell[error] : ''} skipped={skipped} draft={draft} setDraft={setDraft} onOpen={open} onOpenDisassembly={openDisassembly} onCreated={created}
        incoming={incoming} onIncomingTaken={n => setIncoming(list => list.slice(n))}/></>}
  </>;
}

function Player({ lesson, bridge, runtime, goHome }: { lesson: Lesson; bridge: DesktopBridge; runtime: string; goHome: () => void }) {
  const { t } = usePreferences();
  const [state, setState] = useState<LearnerState>(() => initialState(lesson));
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<RestoredState | ProgressResult>();
  const [saveError, setSaveError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'opening' | 'saving' | 'saved' | 'failed'>('opening');
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [toolTab, setToolTab] = useState<ToolTab>('map');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sourcePinned, setSourcePinned] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  useEffect(() => {
    let active = true;
    void bridge.loadProgress({ lessonId: lesson.id, revision: lesson.revision }).then(result => {
      if (!active) return;
      const restored = restoreState(lesson, result.state);
      setState(restored.state); setNotice(result.notice || result.noticeCode ? result : restored.notice ? restored : undefined); setLoaded(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [bridge, lesson]);
  useEffect(() => {
    if (!loaded) return;
    const version = ++saveVersion.current;
    setSaveStatus('saving');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => bridge.saveProgress(state)).then(() => {
      if (version === saveVersion.current) { setSaveStatus('saved'); setSaveError(false); }
    }).catch(() => { if (version === saveVersion.current) { setSaveStatus('failed'); setSaveError(true); } });
  }, [state, loaded, bridge, retry]);
  useEffect(() => {
    if (loaded) {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo?.({ top: 0 });
    }
  }, [state.pageId, loaded]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (toolsOpen && !dialog?.open) dialog?.showModal();
    if (!toolsOpen && dialog?.open) dialog.close();
  }, [toolsOpen]);
  const page = lesson.pages.find(x => x.id === state.pageId)!;
  const index = lesson.pages.indexOf(page);
  const solvedCount = lesson.activities.filter(x => solved(lesson, state, x.id)).length;
  const change = (update: (s: LearnerState) => LearnerState) => setState(update);
  const go = (id: string) => { setState(s => navigate(lesson, s, id)); setToolsOpen(false); };
  const onAttempt = (id: string, answer: string[]) => setState(s => submit(lesson, s, id, answer));
  const openTools = (tab: ToolTab) => { setToolTab(tab); setToolsOpen(true); };
  const saveText = { opening: t.player.opening, saving: t.player.saving, saved: t.player.saved, failed: t.player.saveFailed }[saveStatus];
  const tag = lesson.kind !== 'generated' ? t.player.prepared : lesson.generation?.provider === 'local' ? t.player.generatedLocal : t.player.generatedAi;
  const origin = lesson.generation ? t.tools.generatedBy(lesson.generation.provider === 'local', lesson.generation.model) : t.player.prepared;
  return <>
    <header className="topbar"><button className="brand-button" onClick={goHome} aria-label={t.player.backToLibrary}><Brand/></button><div className="course-title"><span>{lesson.category}</span><strong>{lesson.title}</strong></div><span className={`prepared-tag ${lesson.kind === 'generated' ? 'generated-tag' : ''}`} title={origin}>{tag}</span>{loaded && <button className="subtle tools-trigger" onClick={() => openTools('map')}><PanelRight size={17}/>{t.player.tools}</button>}<PreferencesMenu/></header>
    {!loaded ? <main id="main" className="loading"><p role="status">{loadFailed ? t.player.loadFailed : notice ? restoreText(t, notice, 'lesson') : t.player.resuming}</p><button onClick={goHome}>{t.player.backToLibrary}</button></main> : <>
      <div className="workspace"><aside className="lesson-sidebar"><button className="back-library" onClick={goHome}><Home size={15}/>{t.player.yourPaths}</button><div className="sidebar-label">{t.player.path}<span>{index + 1}/{lesson.pages.length}</span></div><nav aria-label={t.player.stepsNav}><ol className="lesson-nav">{lesson.pages.map((p, i) => {
        const allowed = canVisit(lesson, state, p.id); const done = p.checkpoint && solved(lesson, state, p.checkpoint);
        return <li key={p.id}><button aria-current={p.id === page.id ? 'step' : undefined} disabled={!allowed} onClick={() => go(p.id)}><span className={`nav-number ${done ? 'solved' : ''}`}>{done ? <Check size={14}/> : String(i + 1).padStart(2, '0')}</span><span>{p.title}</span>{!allowed && <LockKeyhole size={12}/>}</button></li>;
      })}</ol></nav><div className="mode-card"><span className="section-label">{t.player.navigation}</span><div className="mode-switch" role="group" aria-label={t.player.navigationMode}><button aria-pressed={state.mode === 'guided'} onClick={() => change(s => ({ ...s, mode: 'guided', pageId: canVisit(lesson, { ...s, mode: 'guided' }, s.pageId) ? s.pageId : lesson.pages.find(p => p.checkpoint && !solved(lesson, s, p.checkpoint))?.id ?? lesson.pages[0].id }))}>{t.player.guided}</button><button aria-pressed={state.mode === 'explore'} onClick={() => change(s => ({ ...s, mode: 'explore' }))}>{t.player.explore}</button></div><details className="navigation-help"><summary>{t.player.howItWorks}</summary><p>{t.player.howItWorksBody}</p></details></div><details className="progress-details"><summary>{t.player.visited(state.visited.length, lesson.pages.length)}</summary><p>{t.player.solvedNote(solvedCount, lesson.activities.length)}</p></details></aside>
        <main id="main" className="lesson-main"><div className="page-topline"><span className="eyebrow">{t.player.stepOf(index + 1, lesson.pages.length)}</span><span className="save-status" role="status">{saveText}</span></div>
          {notice && <div className="notice" role="status">{restoreText(t, notice, 'lesson')}<button aria-label={t.common.closeNotice} onClick={() => setNotice(undefined)}><X size={15}/></button></div>}
          {saveError && <div className="error-banner" role="alert">{t.player.unsaved} <button onClick={() => setRetry(x => x + 1)}>{t.player.retrySave}</button></div>}
          <h1 ref={headingRef} tabIndex={-1}>{page.title}</h1>
          <PageContent key={page.id} lesson={lesson} state={state} change={change} onAttempt={onAttempt} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned} go={go} goHome={goHome} openNotes={() => openTools('notes')}/>
        </main>
      </div><dialog ref={dialogRef} className="tools-drawer" aria-labelledby="tools-title" onClose={() => setToolsOpen(false)}><div className="dialog-head"><div><span className="eyebrow">{t.player.supportEyebrow}</span><h2 id="tools-title">{t.player.tools}</h2></div><button className="icon-button" aria-label={t.player.closeTools} onClick={() => setToolsOpen(false)}><X size={19}/></button></div>{toolsOpen && <StudyTools lesson={lesson} state={state} tab={toolTab} setTab={setToolTab} change={change} go={go}/>}<p className="micro plain tool-runtime">{runtime} · {saveText}</p></dialog>
    </>}
  </>;
}

function PageContent({ lesson, state, change, onAttempt, sourcePinned, setSourcePinned, go, goHome, openNotes }: {
  lesson: Lesson; state: LearnerState; change: (update: (s: LearnerState) => LearnerState) => void;
  onAttempt: (id: string, answer: string[]) => void; sourcePinned: boolean; setSourcePinned: (value: boolean) => void;
  go: (id: string) => void; goHome: () => void; openNotes: () => void;
}) {
  const { t } = usePreferences();
  const page = lesson.pages.find(x => x.id === state.pageId)!;
  const activities = page.blocks.filter(x => x.type === 'activity');
  const explanation = page.blocks.filter(x => x.type !== 'activity');
  const [practicing, setPracticing] = useState(!explanation.length || activities.some(b => b.type === 'activity' && state.attempts.some(a => a.activityId === b.activityId)));
  const bodyRef = useRef<HTMLDivElement>(null);
  const next = lesson.pages[lesson.pages.indexOf(page) + 1];
  const nextAllowed = next && canVisit(lesson, state, next.id);
  const hasBoth = !!activities.length && !!explanation.length;
  useEffect(() => {
    if (!hasBoth || !practicing) return;
    const heading = bodyRef.current?.querySelector('h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0 });
  }, [practicing, hasBoth]);
  return <>
    {practicing && hasBoth ? <p className="page-intro">{t.player.practiceIntro}</p> : <p className="page-intro">{page.intro}</p>}
    {hasBoth && practicing && <button className="text-button" onClick={() => setPracticing(false)}><ArrowLeft size={15}/>{t.player.reviewExplanation}</button>}
    <div className="lesson-blocks" ref={bodyRef} aria-label={practicing ? t.player.activitiesLabel : t.player.explanationLabel}>{(practicing ? activities : explanation).map(block => <LessonBlock key={block.id} block={block} lesson={lesson} state={state} change={change} onAttempt={onAttempt} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}/>)}</div>
    {hasBoth && !practicing && <section className="practice-invite"><div><h2>{t.player.practiceTitle}</h2><p>{t.player.practiceBody}</p></div><button className="primary" onClick={() => setPracticing(true)}>{activities.every(b => b.type === 'activity' && solved(lesson, state, b.activityId)) ? t.player.reviewActivity : t.player.tryNow}<ArrowRight size={16}/></button></section>}
    <div className="page-utilities"><button className="text-button" onClick={openNotes}><MessageSquareText size={16}/>{state.notes[page.id] ? t.player.reviewNotes : t.player.addLink}</button></div>
    <footer className="page-footer"><button className="subtle" disabled={lesson.pages[0].id === page.id} onClick={() => go(lesson.pages[lesson.pages.indexOf(page) - 1].id)}><ArrowLeft size={16}/>{t.player.previous}</button><span>{next && !nextAllowed ? hasBoth && !practicing ? t.player.openActivity : t.player.solveActivity : ''}</span>{next ? <button className="primary" disabled={!nextAllowed} onClick={() => go(next.id)}>{t.player.next}{nextAllowed ? <ArrowRight size={17}/> : <LockKeyhole size={15}/>}</button> : <button className="primary" onClick={goHome}>{t.player.backToLibrary}<ArrowRight size={17}/></button>}</footer>
  </>;
}
