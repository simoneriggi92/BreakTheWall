import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Home, LockKeyhole, Map, MessageSquareText, Search, X } from 'lucide-react';
import type { DesktopBridge } from '../core/bridge';
import type { Lesson } from '../core/lesson';
import { canVisit, initialState, navigate, restoreState, solved, submit, type LearnerState } from '../core/state';
import { loadPreparedLessons } from '../fixtures/lessons';
import { Brand, Icon } from './icons';
import { LessonBlock } from './blocks';
import { browserBridge } from './storage';

export function App({ bridge = window.breakTheWall ?? browserBridge, prepared }: { bridge?: DesktopBridge; prepared?: Lesson[] }) {
  const [lessons, setLessons] = useState<Lesson[]>(prepared ?? []);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [runtime, setRuntime] = useState('');
  useEffect(() => {
    let active = true;
    if (!prepared) void loadPreparedLessons().then(data => { if (active) setLessons(data); }).catch(() => { if (active) setError('Gli esempi non hanno superato il controllo del formato. Riapri l’app o segnala il problema.'); });
    void bridge.getRuntime().then(info => { if (active) setRuntime(info.mode === 'desktop' ? 'DESKTOP · LOCALE' : 'ANTEPRIMA BROWSER'); }).catch(() => { if (active) setError('Il collegamento al desktop non è disponibile. Riapri l’app.'); });
    return () => { active = false; };
  }, [bridge, prepared]);
  const lesson = lessons.find(x => x.id === selected);
  return <><a href="#main" className="skip-link">Vai al contenuto</a>{lesson ? <Player key={lesson.id} lesson={lesson} bridge={bridge} runtime={runtime} goHome={() => setSelected(undefined)}/> : <>
    <header className="topbar library-top"><Brand/><span className="runtime"><span className="status-dot"/>{runtime || 'APERTURA…'}</span><span className="alpha-tag">PLAYER ALPHA</span></header>
    <main id="main" className="library"><div className="library-intro"><span className="eyebrow">MENO TESTO DA SCORRERE. PIÙ COLLEGAMENTI DA VEDERE.</span><h1>Fai spazio<br/>alla <em>comprensione.</em></h1><p>Esplora un concetto, segui ciò che cambia,<br className="wide-only"/> prova a ricostruirlo. Un passo intenzionale alla volta.</p><div className="learning-loop"><span><Icon name="book" size={16}/> Fonte</span><ChevronRight size={14}/><span><Icon name="route" size={16}/> Esplora</span><ChevronRight size={14}/><span><Icon name="puzzle" size={16}/> Prova</span><ChevronRight size={14}/><span><Icon name="lightbulb" size={16}/> Collega</span></div></div>
      <section className="library-section"><div className="library-section-head"><div><span className="eyebrow">IL TUO PRIMO PERCORSO</span><h2>Due modi per rompere il muro.</h2></div><span className="pill">ESEMPI PREPARATI</span></div><p className="library-disclosure">Contenuti originali già pronti, sullo stesso player. Non sono lezioni generate dall’AI.</p>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="lesson-cards">{lessons.map((item, i) => <button key={item.id} className={`lesson-card card-${i}`} onClick={() => setSelected(item.id)}><span className="card-head"><span className="card-symbol"><Icon name={item.icon} size={32}/></span><span className="micro">0{i + 1} / ESEMPIO</span></span><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><p>{item.subtitle}</p><span className="card-meta"><span>{item.pages.length} tappe</span><span>2 attività</span><span>Fonti consultabili</span></span><span className="card-enter">Apri il percorso<ArrowRight size={19}/></span></button>)}</div>
        {!lessons.length && !error && <p role="status">Controllo del formato e delle fonti…</p>}
      </section><footer className="library-footer"><Icon name="shield" size={17}/><span>Gli esempi funzionano senza account. Progressi e appunti restano su questo dispositivo.</span></footer><div className="roadmap-note"><span>IN COSTRUZIONE</span> Importazione di fonti e generazione AI sono le prossime fasi.</div>
    </main></> }</>;
}

function Player({ lesson, bridge, runtime, goHome }: { lesson: Lesson; bridge: DesktopBridge; runtime: string; goHome: () => void }) {
  const [state, setState] = useState<LearnerState>(() => initialState(lesson));
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Apertura…');
  const [retry, setRetry] = useState(0);
  const [contextTab, setContextTab] = useState<'map' | 'atlas'>('map');
  const [contextOpen, setContextOpen] = useState(false);
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
  useEffect(() => { if (loaded) headingRef.current?.focus(); }, [state.pageId, loaded]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (contextOpen && !dialog?.open) dialog?.showModal();
    if (!contextOpen && dialog?.open) dialog.close();
  }, [contextOpen]);
  const page = lesson.pages.find(x => x.id === state.pageId)!;
  const index = lesson.pages.indexOf(page);
  const solvedCount = lesson.activities.filter(x => solved(lesson, state, x.id)).length;
  const next = lesson.pages[index + 1];
  const nextAllowed = next && canVisit(lesson, state, next.id);
  const change = (update: (s: LearnerState) => LearnerState) => setState(update);
  const go = (id: string) => { setState(s => navigate(lesson, s, id)); setContextOpen(false); };
  const onAttempt = (id: string, answer: string[]) => setState(s => submit(lesson, s, id, answer));
  const context = <Context lesson={lesson} state={state} tab={contextTab} setTab={setContextTab} go={go}/>;
  return <>
    <header className="topbar"><button className="brand-button" onClick={goHome} aria-label="Torna ai percorsi"><Brand/></button><div className="course-title"><span>{lesson.category}</span><strong>{lesson.title}</strong></div><span className="prepared-tag">Esempio preparato</span><span className="runtime"><span className="status-dot"/>{runtime}</span></header>
    {!loaded ? <main id="main" className="loading"><p role="status">{notice || 'Riprendo il tuo percorso…'}</p><button onClick={goHome}>Torna ai percorsi</button></main> : <>
      <div className="workspace"><aside className="lesson-sidebar"><button className="back-library" onClick={goHome}><Home size={16}/>I tuoi percorsi</button><div className="sidebar-label">LE TAPPE DEL PERCORSO<span>{String(index + 1).padStart(2, '0')}/{String(lesson.pages.length).padStart(2, '0')}</span></div><nav aria-label="Tappe della lezione"><ol className="lesson-nav">{lesson.pages.map((p, i) => {
        const allowed = canVisit(lesson, state, p.id); const done = p.checkpoint && solved(lesson, state, p.checkpoint);
        return <li key={p.id}><button aria-current={p.id === page.id ? 'step' : undefined} disabled={!allowed} onClick={() => go(p.id)}><span className={`nav-number ${done ? 'solved' : ''}`}>{done ? <Check size={14}/> : String(i + 1).padStart(2, '0')}</span><span>{p.title}<small>{done ? 'Attività risolta' : state.visited.includes(p.id) ? 'Visitata' : allowed ? 'Da esplorare' : 'Dopo l’attività'}</small></span>{!allowed && <LockKeyhole size={13}/>}</button></li>;
      })}</ol></nav><div className="mode-card"><span className="section-label"><Compass size={16}/>COME VUOI AVANZARE?</span><div className="mode-switch" role="group" aria-label="Modalità di navigazione"><button aria-pressed={state.mode === 'guided'} onClick={() => change(s => ({ ...s, mode: 'guided', pageId: canVisit(lesson, { ...s, mode: 'guided' }, s.pageId) ? s.pageId : lesson.pages.find(p => p.checkpoint && !solved(lesson, s, p.checkpoint))?.id ?? lesson.pages[0].id }))}>Guidata</button><button aria-pressed={state.mode === 'explore'} onClick={() => change(s => ({ ...s, mode: 'explore' }))}>Esplora</button></div><p>{state.mode === 'guided' ? 'Le attività aprono le tappe successive. Puoi sempre tornare indietro.' : 'Tutte le tappe sono accessibili. Puoi provare le attività quando vuoi.'}</p></div><div className="sidebar-bottom"><span><Icon name="eye" size={16}/>{state.visited.length}/{lesson.pages.length} tappe visitate</span><span><Icon name="puzzle" size={16}/>{solvedCount}/{lesson.activities.length} attività risolte</span><p>Visitare o risolvere non dimostra, da solo, padronanza.</p></div></aside>
        <main id="main" className="lesson-main"><div className="page-topline"><span className="eyebrow">{page.eyebrow}</span><button className="context-trigger subtle" onClick={() => setContextOpen(true)}><Map size={16}/>Mappa e atlante</button><span className="save-status" role="status">{saveStatus}</span></div>
          {notice && <div className="notice" role="status">{notice}<button aria-label="Chiudi avviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
          {saveError && <div className="error-banner" role="alert">I tuoi ultimi cambiamenti sono ancora in questa sessione, ma non sono stati salvati. <button onClick={() => setRetry(x => x + 1)}>Riprova il salvataggio</button></div>}
          <h1 ref={headingRef} tabIndex={-1}>{page.title}</h1><p className="page-intro">{page.intro}</p>
          <div className="lesson-blocks" key={page.id}>{page.blocks.map(block => <LessonBlock key={block.id} block={block} lesson={lesson} state={state} change={change} onAttempt={onAttempt}/>)}</div>
          <details className="notes-panel"><summary><MessageSquareText size={18}/><strong>I tuoi collegamenti</strong><span>{state.notes[page.id] ? 'Appunti presenti' : 'Aggiungi un appunto'}</span></summary><label htmlFor="page-note">Cosa vuoi ricordare di questa tappa?</label><textarea id="page-note" rows={3} maxLength={4000} value={state.notes[page.id] ?? ''} placeholder="Un perché, una domanda, uno schema da rifare su carta…" onChange={e => change(s => ({ ...s, notes: { ...s.notes, [page.id]: e.target.value } }))}/><p className="micro">{(state.notes[page.id] ?? '').length}/4000 · salvato con il percorso</p></details>
          <footer className="page-footer"><button className="subtle" disabled={!index} onClick={() => go(lesson.pages[index - 1].id)}><ArrowLeft size={16}/>Tappa precedente</button><span>{next ? nextAllowed ? 'Prenditi il tempo che serve.' : 'Risolvi l’attività per continuare.' : 'Il percorso finisce. I collegamenti continuano.'}</span>{next ? <button className="primary" disabled={!nextAllowed} onClick={() => go(next.id)}>Prossima tappa{nextAllowed ? <ArrowRight size={17}/> : <LockKeyhole size={15}/>}</button> : <button className="primary" onClick={goHome}>Torna ai percorsi<ArrowRight size={17}/></button>}</footer>
        </main><aside className="context-dock" aria-label="Contesto della lezione">{context}</aside>
      </div><dialog ref={dialogRef} className="context-dialog" onClose={() => setContextOpen(false)}><div className="dialog-head"><strong>Il filo del percorso</strong><button className="icon-button" aria-label="Chiudi mappa e atlante" onClick={() => setContextOpen(false)}><X size={19}/></button></div>{context}</dialog>
    </>}
  </>;
}

function Context({ lesson, state, tab, setTab, go }: { lesson: Lesson; state: LearnerState; tab: 'map' | 'atlas'; setTab: (tab: 'map' | 'atlas') => void; go: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const available = lesson.concepts.filter(x => showAll || state.mode === 'explore' || state.visited.includes(x.pageId));
  const filtered = available.filter(x => `${x.title} ${x.definition}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const page = lesson.pages.find(x => x.id === state.pageId)!;
  const concept = lesson.concepts.find(x => x.pageId === page.id);
  return <div className="context-content"><div className="context-tabs" role="tablist" aria-label="Contesto"><button role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}><Map size={16}/>Minimappa</button><button role="tab" aria-selected={tab === 'atlas'} onClick={() => setTab('atlas')}><BookOpen size={16}/>Atlante</button></div>
    {tab === 'map' ? <div role="tabpanel" aria-label="Minimappa"><span className="eyebrow">IL FILO CHE STAI SEGUENDO</span><div className="mini-root"><Icon name={lesson.icon} size={21}/><strong>{lesson.title}</strong></div><div className="mini-branches">{lesson.pages.map(p => <button key={p.id} aria-current={p.id === page.id ? 'location' : undefined} disabled={!canVisit(lesson, state, p.id)} onClick={() => go(p.id)}><Icon name={p.icon} size={18}/><span>{p.title}</span>{p.checkpoint && solved(lesson, state, p.checkpoint) ? <Check size={13}/> : state.visited.includes(p.id) ? <span className="visited-dot" aria-label="Visitata"/> : null}</button>)}</div><div className="context-now"><span className="eyebrow">ORA STAI COLLEGANDO</span><strong>{concept?.title ?? page.title}</strong><p>{concept?.definition ?? 'Ricostruisci la relazione fra i passaggi e prova a spiegarla con parole tue.'}</p></div><p className="context-legend"><span className="visited-dot"/> visitata <Check size={12}/> attività risolta<br/>Le linee collegano le tappe del percorso.</p></div> : <div role="tabpanel" aria-label="Atlante"><label className="atlas-search"><Search size={15}/><input aria-label="Cerca nell’atlante" placeholder="Cerca un concetto…" value={search} onChange={e => setSearch(e.target.value)}/></label><label className="atlas-all"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}/>Mostra anche i concetti futuri</label><p className="micro">{available.length}/{lesson.concepts.length} concetti disponibili</p>{filtered.map(c => <details className="atlas-concept" key={c.id}><summary><Icon name={c.icon} size={18}/>{c.title}</summary><p>{c.definition}</p><button className="text-button" disabled={!canVisit(lesson, state, c.pageId)} onClick={() => go(c.pageId)}>Vai al collegamento<ArrowRight size={13}/></button>{!canVisit(lesson, state, c.pageId) && <span className="micro">Disponibile dopo l’attività</span>}</details>)}{!filtered.length && <p className="micro">Nessun concetto corrisponde. Prova un’altra parola o includi i concetti futuri.</p>}</div>}
    <div className="goal-card"><Icon name="target" size={18}/><span className="eyebrow">IL TUO OBIETTIVO</span><p>{lesson.goal.outcome}</p></div><p className="context-origin">Esempio preparato · fonti originali<br/>Nessuna generazione AI in questo percorso.</p>
  </div>;
}
