import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUp, ChevronRight, X } from 'lucide-react';
import type { DesktopBridge, ProgressResult } from '../../core/bridge';
import type { Cite, Disassembly, Part } from '../../core/disassembly';
import {
  answerCase, checkReassembly, clearReassembly, execute, initialDisassemblyState, openLevel, openPath, place, predict, removeBrick, restartRun,
  restoreDisassemblyState, scenarioView, selectPart, type DisassemblyState, type RestoredDisassemblyState,
} from '../../core/disassembly-state';
import { layoutDisassembly, readingNumbers } from '../../core/layout';
import type { GenerationProgress, GenerationRoute, ProviderFailure } from '../../core/provider';
import { Brand } from '../icons';
import { PreferencesMenu, restoreText, usePreferences } from '../preferences';
import { BillOfMaterials } from './BillOfMaterials';
import { PartCard, TakeApart } from './PartCard';
import { Reassemble } from './Reassemble';
import { RunPanel } from './RunPanel';
import { Sheet } from './Sheet';
import { SourcePane, type SourceView } from './SourcePane';
import { PANES, Splitter, usePaneSizes } from './SplitPane';

type Mode = 'explode' | 'run' | 'reassemble' | 'bom';
const MODES: Mode[] = ['explode', 'run', 'reassemble', 'bom'];

/** Plays one disassembly: exploded view, runs, reassembly and bill of materials, with progress kept on the device. */
/** How long a step shows as running before its effects land; zero when the system asks for reduced motion. */
const STEP_MS = 900;
const stepDelay = () => typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? STEP_MS : 0;

export function DisassemblyPlayer({ d, bridge, goHome, versions = [], openVersion, onExpanded }: { d: Disassembly; bridge: DesktopBridge; goHome: () => void; versions?: Disassembly[]; openVersion?: (id: string) => void; onExpanded?: (next: Disassembly) => void }) {
  const { t, language, settings } = usePreferences();
  const [expanding, setExpanding] = useState<{ part: string; progress: GenerationProgress }>();
  const [expandProblem, setExpandProblem] = useState<{ part: string; failure: ProviderFailure }>();
  const [state, setState] = useState<DisassemblyState>(() => initialDisassemblyState(d));
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<RestoredDisassemblyState | ProgressResult>();
  const [saveStatus, setSaveStatus] = useState<'opening' | 'saving' | 'saved' | 'failed'>('opening');
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<Mode>('explode');
  const [runId, setRunId] = useState(d.runs[0].id);
  const [focus, setFocus] = useState<Cite>();
  const [sourceId, setSourceId] = useState(d.sources[0].id);
  // Lines or document, per source, while the disassembly is open (D18).
  const [views, setViews] = useState<Record<string, SourceView>>({});
  const viewProps = { view: views[sourceId] ?? 'lines', onView: (v: SourceView) => setViews(x => ({ ...x, [sourceId]: v })) };
  const [feedback, setFeedback] = useState<{ wrong?: { part: string; hint: string }; complete: boolean }>();
  // A step runs in two beats: first its parts show as running, then its effects and explanation land.
  const [running, setRunning] = useState<{ runId: string; step: number }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const layouts = useMemo(() => layoutDisassembly(d), [d]);
  // Resizable panes (D17): the drawing's height, the source's width, and a source widened to the whole row.
  const panes = usePaneSizes();
  const [sourceWide, setSourceWide] = useState(false);
  const work = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLElement>(null);
  const wideRow = useRef<HTMLDivElement>(null);
  // Until the learner sets a height, the drawing pane is as tall as the whole sheet needs at the pane's width.
  const [workWidth, setWorkWidth] = useState(0);
  useEffect(() => {
    const el = work.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWorkWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded, mode]);
  const drawingAt = (_x: number, y: number) => { const top = work.current?.getBoundingClientRect().top; return top === undefined ? undefined : (y - top) / window.innerHeight; };
  const sourceAt = (target: { current: HTMLElement | null }) => (x: number) => { const r = target.current?.getBoundingClientRect(); return r?.width ? (r.right - x) / r.width : undefined; };
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);

  useEffect(() => {
    let active = true;
    void bridge.loadProgress({ disassemblyId: d.id, revision: d.revision }).then(result => {
      if (!active) return;
      const restored = restoreDisassemblyState(d, result.state);
      setState(restored.state); setNotice(result.noticeCode ? result : restored.notice ? restored : undefined); setLoaded(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [bridge, d]);
  useEffect(() => {
    if (!loaded) return;
    const version = ++saveVersion.current;
    setSaveStatus('saving');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => bridge.saveProgress(state)).then(() => {
      if (version === saveVersion.current) setSaveStatus('saved');
    }).catch(() => { if (version === saveVersion.current) setSaveStatus('failed'); });
  }, [state, loaded, bridge, retry]);

  const focusCite = (c: Cite) => { setFocus(c); setSourceId(c.source); };
  // Taking a part apart: only generated disassemblies in the desktop app, through the structure model of the Studio setup.
  const studio = bridge.studio;
  const chatgptModel = settings?.chatgptModel ?? (d.generation?.provider === 'chatgpt' ? d.generation.model.split(' + ')[0] : undefined);
  const expandRoute: GenerationRoute | undefined = settings?.provider === 'local'
    ? settings.local && { provider: 'local', runtime: settings.local.runtime, baseUrl: settings.local.baseUrl, model: settings.local.model }
    : chatgptModel ? { provider: 'chatgpt', model: chatgptModel } : undefined;
  const takeApart = async (partId: string) => {
    if (!studio?.expandPart || !expandRoute || expanding) return;
    setExpandProblem(undefined);
    setExpanding({ part: partId, progress: { phase: 'structure', repairing: false, received: 0, requests: 0 } });
    const stop = studio.onGenerationProgress(progress => setExpanding(x => x && { ...x, progress }));
    try {
      // The progress the host moves to the new revision must include the last change.
      await saveQueue.current.catch(() => {});
      const result = await studio.expandPart({ disassemblyId: d.id, revision: d.revision, part: partId, route: expandRoute });
      if (result.ok) onExpanded?.(result.disassembly);
      else setExpandProblem({ part: partId, failure: result.failure });
    } finally { stop(); setExpanding(undefined); }
  };
  const level = openLevel(d, state.path) ?? d.parts;
  const owner = state.path.length ? findPart(d.parts, state.path.at(-1)!) : undefined;
  const joints = owner ? owner.joints ?? [] : d.joints;
  const layout = layouts.get(owner?.id ?? 'root')!;
  const part = state.selected ? level.find(p => p.id === state.selected) : undefined;
  const run = d.runs.find(r => r.id === runId) ?? d.runs[0];
  const crumbs = state.path.map((id, i) => ({ id, name: findPart(d.parts, id)?.name ?? id, depth: i + 1 }));
  const above = crumbs.length > 1 ? crumbs.at(-2)!.name : d.whole.name;
  const select = (id: string) => {
    const next = state.selected === id ? undefined : id;
    setState(s => selectPart(d, s, next));
    const cite = next ? level.find(p => p.id === next)?.cites[0] : undefined;
    if (cite) focusCite(cite);
  };
  const enter = (id: string) => { setState(s => openPath(d, s, [...s.path, id])); setFocus(undefined); };
  const leave = (depth: number) => { setState(s => openPath(d, s, s.path.slice(0, depth))); setFocus(undefined); };
  // Up one level: the part just left stays selected and its plate takes the focus, so the learner keeps their place.
  const [refocus, setRefocus] = useState<string>();
  const up = () => {
    const left = state.path.at(-1);
    if (!left) return;
    setState(s => selectPart(d, openPath(d, s, s.path.slice(0, -1)), left)); setFocus(undefined); setRefocus(left);
  };
  useEffect(() => {
    if (!refocus) return;
    document.querySelector<SVGGElement>(`.sheet .plate[data-id="${CSS.escape(refocus)}"]`)?.focus({ preventScroll: true });
    setRefocus(undefined);
  }, [refocus]);
  const upRef = useRef(up); upRef.current = up;
  useEffect(() => {
    if (mode !== 'explode' || !state.path.length) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"], dialog');
      if (e.defaultPrevented || typing || !(e.key === 'Escape' || (e.altKey && e.key === 'ArrowUp'))) return;
      e.preventDefault(); upRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, state.path.length]);
  // Runs act on the whole: the drawing returns to the top level while a run is open.
  const setModeAndLevel = (next: Mode) => { setMode(next); setFeedback(undefined); if (next === 'run' || next === 'reassemble') setState(s => openPath(d, s, [])); };
  const runDecor = mode === 'run' && run.type === 'scenario' ? (() => {
    const v = scenarioView(run, state.runs[run.id]);
    const step = running?.runId === run.id ? run.steps[running.step] : undefined;
    if (!step) return { states: v.states, flow: v.flow };
    return { states: { ...v.states, ...Object.fromEntries(Object.keys(step.effect ?? {}).map(id => [id, 'active'])) }, flow: step.flow ?? [] };
  })()
    : mode === 'run' && run.type === 'load' ? (() => {
      const removed = state.runs[run.id]?.tried.at(-1); const brick = run.bricks.find(b => b.part === removed);
      return { bricks: run.bricks.map(b => b.part), removed, target: brick ? { id: run.target, verdict: brick.verdict } : undefined };
    })() : {};
  const sized = panes.wide && (mode === 'explode' || mode === 'run');
  const sheetW = Math.max(layout.width, 560); const sheetH = layout.height + 64;
  const fitted = workWidth ? Math.min(PANES.drawing.max, Math.max(PANES.drawing.min, ((workWidth - 26) * sheetH / sheetW + 22 + (state.path.length ? 34 : 0)) / window.innerHeight)) : PANES.drawing.initial;
  const drawingShare = panes.sizes.drawing ?? fitted;
  const sourceWidth = { '--source-w': String(panes.sizes.source) } as CSSProperties;
  const sourceSplitter = (target: { current: HTMLElement | null }) => <Splitter pane="source" orientation="vertical" grows="ArrowLeft" value={panes.sizes.source} label={t.d.panes.source}
    onChange={v => panes.set('source', v)} onReset={() => panes.reset('source')} fromPointer={sourceAt(target)}/>;
  const splitSide = panes.wide && mode !== 'reassemble' && !sourceWide;
  const save = { opening: t.player.opening, saving: t.player.saving, saved: t.player.saved, failed: t.player.saveFailed }[saveStatus];
  const index = (id: string) => readingNumbers(layout).get(id);
  // Content never changes language by itself; when a version in the interface language exists, the player offers it.
  const other = d.language !== language ? versions.find(v => v.language === language) : undefined;

  return <>
    <header className="topbar"><button className="brand-button" onClick={goHome} aria-label={t.player.backToLibrary}><Brand/></button>
      <div className="course-title"><span>{t.d.whole}</span><strong lang={d.language}>{d.title}</strong></div>
      <span className="prepared-tag" title={d.generation ? t.tools.generatedBy(d.generation.provider === 'local', d.generation.model) : undefined}>{d.kind === 'generated' ? t.d.tagGenerated : t.d.tag}</span>
      <span className="save-status micro" role="status">{save}</span><PreferencesMenu/></header>
    {!loaded ? <main id="main" className="loading"><p role="status">{loadFailed ? t.player.loadFailed : t.player.resuming}</p><button onClick={goHome}>{t.player.backToLibrary}</button></main> :
      <main id="main" className={`disassembly mode-${mode}`}>
        <div className="d-bar">
          <nav className="crumbs" aria-label={t.d.breadcrumbs}><ol>
            <li>{crumbs.length ? <button className="text-button" onClick={() => leave(0)} lang={d.language}>{d.whole.name}</button> : <span aria-current="location" lang={d.language}>{d.whole.name}</span>}</li>
            {crumbs.map(c => <li key={c.id}><ChevronRight size={13} aria-hidden="true"/>{c.depth < crumbs.length ? <button className="text-button" onClick={() => leave(c.depth)} lang={d.language}>{c.name}</button> : <span aria-current="location" lang={d.language}>{c.name}</span>}</li>)}
          </ol></nav>
          <div className="mode-tabs" role="group" aria-label={t.d.modesLabel}>{MODES.map(m => <button key={m} aria-pressed={mode === m} onClick={() => setModeAndLevel(m)}>{t.d.modes[m]}</button>)}</div>
        </div>
        <p className="question" lang={d.language}>{d.question}</p>
        {other && openVersion && <div className="notice version-notice" role="status"><span>{t.d.otherVersion(t.languageNames[other.language])}</span><button onClick={() => openVersion(other.id)}>{t.d.openVersion}</button></div>}
        {notice && <div className="notice" role="status">{restoreText(t, notice, 'disassembly')}<button aria-label={t.common.closeNotice} onClick={() => setNotice(undefined)}><X size={15}/></button></div>}
        {saveStatus === 'failed' && <div className="error-banner" role="alert">{t.player.unsaved} <button onClick={() => setRetry(x => x + 1)}>{t.player.retrySave}</button></div>}
        {mode === 'bom' ? <div className={`d-wide${panes.wide ? ' split' : ''}`} ref={wideRow} style={sourceWidth}><BillOfMaterials d={d} onFocus={focusCite}/>
            {panes.wide && sourceSplitter(wideRow)}
            <SourcePane d={d} sourceId={sourceId} onSource={setSourceId} focus={focus} cited={[]} {...viewProps}/></div>
          : <div className={`d-work${sized ? ' sized' : ''}`} ref={work}>
            <div className={`d-drawing${sized ? ' sized' : ''}`} style={sized ? { height: `${Math.floor(drawingShare * 1000) / 10}vh` } : undefined}>
              {mode === 'explode' && state.path.length > 0 && <button className="subtle level-up" onClick={up} aria-label={t.d.upLabel(above)} lang={d.language}><ArrowUp size={15}/>{above}</button>}
              {mode === 'reassemble'
                ? <Reassemble d={d} layout={layouts.get('root')!} state={state} feedback={feedback}
                    place={(slot, p) => { setFeedback(undefined); setState(s => place(d, s, slot, p)); }}
                    check={() => { const result = checkReassembly(d, state); setState(result.state); setFeedback({ wrong: result.wrong, complete: result.complete }); }}
                    clear={() => { setFeedback(undefined); setState(clearReassembly); }}/>
                : <Sheet layout={layout} parts={level} joints={joints} title={owner?.name ?? d.whole.name} language={d.language}
                    subtitle={t.d.sheetSub(t.d.modes[mode], state.path.length + 1, level.length)} selected={state.selected}
                    onSelect={id => mode === 'run' && run.type === 'load' && run.bricks.some(b => b.part === id) ? setState(s => removeBrick(d, s, run.id, id)) : select(id)}
                    onEnter={id => mode === 'explode' && enter(id)} fit={sized ? panes.sizes.drawing === null ? 'contain' : 'height' : undefined} {...runDecor}/>}
            </div>
            {sized && <Splitter pane="drawing" orientation="horizontal" grows="ArrowDown" value={drawingShare} label={t.d.panes.drawing}
              onChange={v => panes.set('drawing', v)} onReset={() => panes.reset('drawing')} fromPointer={drawingAt}/>}
            <aside className={`d-side${splitSide ? ' split' : ''}`} ref={row} style={sourceWidth}>
              {mode === 'explode' && !sourceWide && <PartCard d={d} part={part} owner={owner} above={state.path.length ? above : undefined} onUp={up} joints={joints} level={level} number={part && index(part.id)} focus={focus} onFocus={focusCite} onEnter={enter}
                note={part ? state.notes[part.id] ?? '' : ''} onNote={value => part && setState(s => ({ ...s, notes: { ...s.notes, [part.id]: value } }))}
                takeApart={part && d.kind === 'generated' && studio?.expandPart && <TakeApart d={d} part={part} route={expandRoute} progress={expanding?.part === part.id ? expanding.progress : undefined}
                  problem={expandProblem?.part === part.id ? expandProblem.failure : undefined} onRun={() => void takeApart(part.id)} onCancel={() => void studio.cancelGeneration()}/>}/>}
              {mode === 'run' && !sourceWide && <RunPanel d={d} run={run} state={state} focus={focus} running={running?.runId === run.id} actions={{
                choose: id => { if (!running) setRunId(id); }, focus: focusCite,
                predict: (step, option) => setState(s => predict(d, s, run.id, step, option)),
                execute: () => {
                  if (running || run.type !== 'scenario') return;
                  const index = (state.runs[run.id]?.step ?? -1) + 1; const next = run.steps[index];
                  const land = () => { setState(s => execute(d, s, run.id)); setRunning(undefined); if (next?.cites?.[0]) focusCite(next.cites[0]); };
                  const delay = stepDelay();
                  if (!delay) { land(); return; }
                  setRunning({ runId: run.id, step: index }); timer.current = setTimeout(land, delay);
                },
                restart: () => setState(s => restartRun(s, run.id)),
                remove: p => setState(s => removeBrick(d, s, run.id, p)),
                answer: option => setState(s => answerCase(d, s, run.id, option)),
              }}/>}
              {splitSide && sourceSplitter(row)}
              {mode !== 'reassemble' && <SourcePane d={d} sourceId={sourceId} onSource={setSourceId} focus={focus} cited={mode === 'explode' && part ? part.cites : []}
                wide={sourceWide} onWide={() => setSourceWide(x => !x)} {...viewProps}/>}
            </aside>
          </div>}
      </main>}
  </>;
}

function findPart(parts: Part[], id: string): Part | undefined {
  for (const p of parts) { if (p.id === id) return p; const inner = p.parts && findPart(p.parts, id); if (inner) return inner; }
  return undefined;
}
