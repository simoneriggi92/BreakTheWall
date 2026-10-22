import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Home, LockKeyhole, MessageSquareText, PanelRight, X } from 'lucide-react';
import type { DesktopBridge } from '../core/bridge';
import { validateLesson, type Lesson } from '../core/lesson';
import { canVisit, initialState, navigate, restoreState, solved, submit, type LearnerState } from '../core/state';
import { loadPreparedLessons } from '../fixtures/lessons';
import { Brand } from './icons';
import { LessonBlock } from './blocks';
import { browserBridge } from './storage';
import { emptyDraft, type StudioDraft } from './Studio';
import { Library, rememberLesson } from './Library';
import { StudyTools, type ToolTab } from './StudyTools';

export function App({ bridge = window.breakTheWall ?? browserBridge, prepared }: { bridge?: DesktopBridge; prepared?: Lesson[] }) {
  const [lessons, setLessons] = useState<Lesson[]>(prepared ?? []);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [runtime, setRuntime] = useState('');
  const [generated, setGenerated] = useState<Lesson[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [draft, setDraft] = useState<StudioDraft>(emptyDraft);
  useEffect(() => {
    let active = true;
    void bridge.studio?.listLessons().then(async result => {
      const checked = await Promise.allSettled(result.lessons.map(x => validateLesson(x)));
      if (!active) return;
      setGenerated(checked.flatMap(x => x.status === 'fulfilled' && x.value.kind === 'generated' ? [x.value] : []));
      setSkipped(result.skipped + checked.filter(x => x.status === 'rejected').length);
    }).catch(() => { if (active) setError('I percorsi generati non sono leggibili in questo momento.'); });
    return () => { active = false; };
  }, [bridge]);
  useEffect(() => {
    let active = true;
    if (!prepared) void loadPreparedLessons().then(data => { if (active) setLessons(data); }).catch(() => { if (active) setError('Gli esempi non hanno superato il controllo del formato. Riapri l’app o segnala il problema.'); });
    void bridge.getRuntime().then(info => { if (active) setRuntime(info.mode === 'desktop' ? 'DESKTOP · LOCALE' : 'ANTEPRIMA BROWSER'); }).catch(() => { if (active) setError('Il collegamento al desktop non è disponibile. Riapri l’app.'); });
    return () => { active = false; };
  }, [bridge, prepared]);
  const open = (id: string) => { rememberLesson(id); setSelected(id); };
  const lesson = [...generated, ...lessons].find(x => x.id === selected);
  const created = (item: Lesson) => { setGenerated(list => [item, ...list.filter(x => x.id !== item.id)]); setDraft(emptyDraft); open(item.id); };
  return <><a href="#main" className="skip-link">Vai al contenuto</a>{lesson
    ? <Player key={lesson.id} lesson={lesson} bridge={bridge} runtime={runtime} goHome={() => setSelected(undefined)}/>
    : <><header className="topbar library-top"><Brand/><span className="runtime"><span className="status-dot"/>{runtime || 'APERTURA…'}</span></header><Library lessons={lessons} generated={generated} bridge={bridge} error={error} skipped={skipped} draft={draft} setDraft={setDraft} onOpen={open} onCreated={created}/></>}
  </>;
}

function Player({ lesson, bridge, runtime, goHome }: { lesson: Lesson; bridge: DesktopBridge; runtime: string; goHome: () => void }) {
  const [state, setState] = useState<LearnerState>(() => initialState(lesson));
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Apertura…');
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
      setState(restored.state); setNotice(result.notice ?? restored.notice ?? ''); setLoaded(true);
    }).catch(() => { if (active) setNotice('Non è stato possibile leggere i progressi. Per proteggere i dati, il player non è stato aperto. Torna ai percorsi e riprova.'); });
    return () => { active = false; };
  }, [bridge, lesson]);
  useEffect(() => {
    if (!loaded) return;
    const version = ++saveVersion.current;
    setSaveStatus('Salvataggio…');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => bridge.saveProgress(state)).then(() => {
      if (version === saveVersion.current) { setSaveStatus('Salvato sul dispositivo'); setSaveError(false); }
    }).catch(() => { if (version === saveVersion.current) { setSaveStatus('Salvataggio non riuscito'); setSaveError(true); } });
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
  return <>
    <header className="topbar"><button className="brand-button" onClick={goHome} aria-label="Torna ai percorsi"><Brand/></button><div className="course-title"><span>{lesson.category}</span><strong>{lesson.title}</strong></div><span className={`prepared-tag ${lesson.kind === 'generated' ? 'generated-tag' : ''}`}>{lesson.kind === 'generated' ? 'Generato con AI' : 'Esempio preparato'}</span>{loaded && <button className="subtle tools-trigger" onClick={() => openTools('map')}><PanelRight size={17}/>Strumenti</button>}</header>
    {!loaded ? <main id="main" className="loading"><p role="status">{notice || 'Riprendo il tuo percorso…'}</p><button onClick={goHome}>Torna ai percorsi</button></main> : <>
      <div className="workspace"><aside className="lesson-sidebar"><button className="back-library" onClick={goHome}><Home size={15}/>I tuoi percorsi</button><div className="sidebar-label">IL PERCORSO<span>{index + 1}/{lesson.pages.length}</span></div><nav aria-label="Tappe della lezione"><ol className="lesson-nav">{lesson.pages.map((p, i) => {
        const allowed = canVisit(lesson, state, p.id); const done = p.checkpoint && solved(lesson, state, p.checkpoint);
        return <li key={p.id}><button aria-current={p.id === page.id ? 'step' : undefined} disabled={!allowed} onClick={() => go(p.id)}><span className={`nav-number ${done ? 'solved' : ''}`}>{done ? <Check size={14}/> : String(i + 1).padStart(2, '0')}</span><span>{p.title}</span>{!allowed && <LockKeyhole size={12}/>}</button></li>;
      })}</ol></nav><div className="mode-card"><span className="section-label">NAVIGAZIONE</span><div className="mode-switch" role="group" aria-label="Modalità di navigazione"><button aria-pressed={state.mode === 'guided'} onClick={() => change(s => ({ ...s, mode: 'guided', pageId: canVisit(lesson, { ...s, mode: 'guided' }, s.pageId) ? s.pageId : lesson.pages.find(p => p.checkpoint && !solved(lesson, s, p.checkpoint))?.id ?? lesson.pages[0].id }))}>Guidata</button><button aria-pressed={state.mode === 'explore'} onClick={() => change(s => ({ ...s, mode: 'explore' }))}>Esplora</button></div><details className="navigation-help"><summary>Come funziona?</summary><p>In modalità guidata le attività aprono le tappe successive. Esplora ti permette di muoverti liberamente.</p></details></div><details className="progress-details"><summary>{state.visited.length}/{lesson.pages.length} tappe visitate</summary><p>{solvedCount}/{lesson.activities.length} attività risolte. Visitare o risolvere non dimostra, da solo, padronanza.</p></details></aside>
        <main id="main" className="lesson-main"><div className="page-topline"><span className="eyebrow">TAPPA {index + 1} DI {lesson.pages.length}</span><span className="save-status" role="status">{saveStatus}</span></div>
          {notice && <div className="notice" role="status">{notice}<button aria-label="Chiudi avviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
          {saveError && <div className="error-banner" role="alert">I tuoi ultimi cambiamenti sono ancora in questa sessione, ma non sono stati salvati. <button onClick={() => setRetry(x => x + 1)}>Riprova il salvataggio</button></div>}
          <h1 ref={headingRef} tabIndex={-1}>{page.title}</h1>
          <PageContent key={page.id} lesson={lesson} state={state} change={change} onAttempt={onAttempt} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned} go={go} goHome={goHome} openNotes={() => openTools('notes')}/>
        </main>
      </div><dialog ref={dialogRef} className="tools-drawer" aria-labelledby="tools-title" onClose={() => setToolsOpen(false)}><div className="dialog-head"><div><span className="eyebrow">A SUPPORTO DEL TUO STUDIO</span><h2 id="tools-title">Strumenti</h2></div><button className="icon-button" aria-label="Chiudi strumenti" onClick={() => setToolsOpen(false)}><X size={19}/></button></div>{toolsOpen && <StudyTools lesson={lesson} state={state} tab={toolTab} setTab={setToolTab} change={change} go={go}/>}<p className="micro plain tool-runtime">{runtime} · {saveStatus}</p></dialog>
    </>}
  </>;
}

function PageContent({ lesson, state, change, onAttempt, sourcePinned, setSourcePinned, go, goHome, openNotes }: {
  lesson: Lesson; state: LearnerState; change: (update: (s: LearnerState) => LearnerState) => void;
  onAttempt: (id: string, answer: string[]) => void; sourcePinned: boolean; setSourcePinned: (value: boolean) => void;
  go: (id: string) => void; goHome: () => void; openNotes: () => void;
}) {
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
    <p className="page-intro">{practicing && hasBoth ? 'Metti alla prova il collegamento. Puoi tornare alla spiegazione quando vuoi.' : page.intro}</p>
    {hasBoth && practicing && <button className="text-button" onClick={() => setPracticing(false)}><ArrowLeft size={15}/>Rivedi la spiegazione</button>}
    <div className="lesson-blocks" ref={bodyRef} aria-label={practicing ? 'Attività della tappa' : 'Spiegazione della tappa'}>{(practicing ? activities : explanation).map(block => <LessonBlock key={block.id} block={block} lesson={lesson} state={state} change={change} onAttempt={onAttempt} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}/>)}</div>
    {hasBoth && !practicing && <section className="practice-invite"><div><h2>Prova a ricostruire il collegamento.</h2><p>Passa dalla spiegazione a una tua previsione.</p></div><button className="primary" onClick={() => setPracticing(true)}>{activities.every(b => b.type === 'activity' && solved(lesson, state, b.activityId)) ? 'Rivedi l’attività' : 'Ora prova tu'}<ArrowRight size={16}/></button></section>}
    <div className="page-utilities"><button className="text-button" onClick={openNotes}><MessageSquareText size={16}/>{state.notes[page.id] ? 'Rivedi i tuoi appunti' : 'Aggiungi un collegamento'}</button></div>
    <footer className="page-footer"><button className="subtle" disabled={lesson.pages[0].id === page.id} onClick={() => go(lesson.pages[lesson.pages.indexOf(page) - 1].id)}><ArrowLeft size={16}/>Tappa precedente</button><span>{next && !nextAllowed ? hasBoth && !practicing ? 'Apri l’attività per continuare.' : 'Risolvi l’attività per continuare.' : ''}</span>{next ? <button className="primary" disabled={!nextAllowed} onClick={() => go(next.id)}>Prossima tappa{nextAllowed ? <ArrowRight size={17}/> : <LockKeyhole size={15}/>}</button> : <button className="primary" onClick={goHome}>Torna ai percorsi<ArrowRight size={17}/></button>}</footer>
  </>;
}
