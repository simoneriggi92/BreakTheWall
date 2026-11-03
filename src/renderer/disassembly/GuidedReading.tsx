import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Layers, Link2, NotebookText } from 'lucide-react';
import { allParts, type Cite, type Disassembly, type Part } from '../../core/disassembly';
import { chooseRepresentation } from '../../core/representation';
import { readingIndex, readingRoles, readingSteps, sourceReadingRoute, type ReadingPosition } from '../../core/source-reading';
import { isProse, readingBlocks } from '../markdown';
import { usePreferences } from '../preferences';
import type { ReadMark } from '../lab/Bench';
import type { FacePick } from '../lab/Opened';
import { LabStage, WholeDrawing } from '../lab/Stage';
import { runsOnSupports, suspension, SuspendRun } from '../lab/Suspend';
import { Annotations, InDrawing, WhyRepresentation } from '../lab/Why';
import { Cites, Points } from './PartCard';
import { PartIcon } from './Sheet';
import { SourcePane, type SourceView } from './SourcePane';
import { Splitter, usePaneSizes } from './SplitPane';

/**
 * A second navigation of the same sources and parts, not another decomposition or learning loop. The drawing follows
 * the reading (P-20261102-guided-reading): x moves through passages, y opens a part where it is, z is the margin.
 * The drawing is the representation the metaphor test chose, an object or an atlas (P-20261103-lab-mode): an opened
 * part lifts out of it, and what the learner explores is kept apart from the step being read.
 */
export function GuidedReading({ d, position, onPosition, onExplore, takeApart }: {
  d: Disassembly; position?: ReadingPosition; onPosition: (position: ReadingPosition) => void; onExplore: (part?: string) => void;
  /** The overview's own "take this part apart", for a part with no sub-assembly; absent where it does not apply. */
  takeApart?: (part: Part) => ReactNode;
}) {
  const { t } = usePreferences();
  const x = t.d.guided;
  // Passages grouped into steps (G13): one step where the drawing changes. From here on, `route` is the steps.
  const route = useMemo(() => {
    const passages = sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text, isProse(s))])));
    return readingSteps(passages, readingRoles(d, passages));
  }, [d]);
  const roles = useMemo(() => route.map(s => s.role), [route]);
  // A step whose heading repeats the one before (a long section, or a source with no headings) is named by its first words (G16).
  const names = useMemo(() => route.map((s, i) => {
    if (s.title && (i === 0 || route[i - 1].title !== s.title || route[i - 1].source !== s.source)) return s.title;
    const first = d.sources.find(x => x.id === s.source)!.text.split('\n').slice(s.from - 1, s.to).find(l => l.trim())?.replace(/^[#>*\-\d.\s|]+/, '').trim() ?? '';
    return first.length > 48 ? `${first.slice(0, 47).trimEnd()}…` : first || x.passage(i + 1);
  }), [route, d, x]);
  const index = readingIndex(route, position), passage = route[index], role = roles[index];
  const source = d.sources.find(s => s.id === passage.source)!;
  const [focus, setFocus] = useState<Cite>(passage);
  const [views, setViews] = useState<Record<string, SourceView>>({});
  const [wide, setWide] = useState(false);
  // One representation for the whole source, chosen by the metaphor test (L8).
  const choice = useMemo(() => chooseRepresentation(d), [d]);
  // The open path: the parts opened from the whole down. The last one is lifted out of its level (L9).
  const [path, setPath] = useState<string[]>([]);
  const open = path.at(-1);
  const [selected, setSelected] = useState<string>();
  // What else can be explored besides a part: an element of a face, or a top-level joint.
  const [face, setFace] = useState<FacePick>();
  const [joint, setJoint] = useState<number>();
  // L12: a part suspended by the atlas's load run, from the card.
  const [suspended, setSuspended] = useState<string>();
  const [margin, setMargin] = useState(false);
  // Where the reading was when a part was opened from the whole: the return restores it (L9).
  const saved = useRef<{ focus: Cite } | undefined>(undefined);
  // "Read from here" moves the reading without closing what is being explored (L10).
  const keep = useRef(false);
  const panes = usePaneSizes();
  const workspace = useRef<HTMLDivElement>(null);
  const cited = useMemo(() => [passage], [passage]);
  const navigation = useRef<HTMLOListElement>(null);
  const stage = useRef<HTMLElement>(null);
  const proof = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // Where each part and each top-level joint first enters the reading: the drawing never runs ahead of the text.
  const addedAt = useMemo(() => new Map(roles.flatMap((r, i) => r.add.map(id => [id, i] as const))), [roles]);
  const relatedAt = useMemo(() => d.joints.map(j => roles.findIndex(r => r.relate.includes(j))), [d, roles]);
  const findPart = (id: string) => allParts(d).find(x => x.part.id === id)?.part;
  const owner = open ? findPart(open) : undefined;
  const level = owner?.parts ?? d.parts;
  // Progressive building (G2, G13): a part not yet read is an outline, a joint is drawn from the step that relates it.
  const built = (id: string) => { const at = addedAt.get(id); return at !== undefined && at <= index; };
  const jointShown = (i: number) => relatedAt[i] >= 0 && relatedAt[i] <= index;
  const currentJoint = (i: number) => role.relate.includes(d.joints[i]);
  const topMarks = useMemo(() => Object.fromEntries(d.parts.flatMap((p): [string, ReadMark][] => role.add.includes(p.id) ? [[p.id, 'added']] : role.deepen.includes(p.id) ? [[p.id, 'deepened']] : [])), [role, d]);
  // Below the whole, a level marks the parts this step cites.
  const citedMarks = (parts: Part[]) => Object.fromEntries(parts.filter(p => role.subParts.includes(p.id)).map(p => [p.id, 'cited'])) as Record<string, ReadMark>;
  const partOf = (id: string) => d.parts.find(p => p.id === id)!;
  const later = (id: string) => { const at = addedAt.get(id); return at !== undefined && at > index ? <span className="micro"> ({x.comesAt(at + 1)})</span> : null; };
  const chosen = selected ? level.find(p => p.id === selected) : undefined;
  const chosenJoint = joint !== undefined && !open ? d.joints[joint] : undefined;
  // L10: what is explored (a face element, a joint, a part, or else the opened part) ≠ the step being read.
  const meets = (c: Cite, s: Cite) => c.source === s.source && c.from <= s.to && c.to >= s.from;
  const explored = face ? { name: face.item.label, cites: [{ source: face.item.source, from: face.item.from, to: face.item.to }] }
    : chosenJoint ? { name: `${partOf(chosenJoint.from).name} → ${partOf(chosenJoint.to).name}`, cites: chosenJoint.cites ?? [] }
    : chosen ? { name: chosen.name, cites: chosen.cites } : owner ? { name: owner.name, cites: owner.cites } : undefined;
  const citing = explored ? route.flatMap((s, i) => explored.cites.some(c => meets(c, s)) ? [i] : []) : [];
  const away = explored && explored.cites.length > 0 && !citing.includes(index) ? explored : undefined;
  // The source shows what is explored when the step does not; otherwise it stays on the step.
  const show = (cites?: Cite[]) => setFocus(cites?.length && !cites.some(c => meets(c, passage)) ? cites[0] : passage);
  // The atlas's load run, offered on the card of its target and of its bricks (L12).
  const load = d.runs.find((r): r is Extract<typeof r, { type: 'load' }> => r.type === 'load' && runsOnSupports(d, choice.view, r));
  const suspendRun = load && <div className="guided-block lab-run"><SuspendRun d={d} run={load} current={suspended} onSuspend={setSuspended} focus={focus} onFocus={c => locate(c)}/></div>;
  // Context lines come from the margin the reading already has (z), not from a second computation.
  const context = useMemo(() => roles.flatMap(r => r.margin).filter(m => m.reason === 'context'), [roles]);
  const loadTag = load && suspended ? t.d.lab.suspend.tags[suspension(d, load, suspended).tag] : undefined;
  // y (G12): the part the "open" control opens: the selected one, or the first of this step that has a sub-assembly.
  const openTarget = chosen?.parts ? chosen : owner ? level.find(p => p.parts && role.subParts.includes(p.id))
    : [...role.add, ...role.deepen].map(id => d.parts.find(p => p.id === id)!).find(p => p.parts);
  const [showMap, setShowMap] = useState(() => { try { return localStorage.getItem(MAP_KEY) !== 'hidden'; } catch { return true; } });
  const toggleMap = () => setShowMap(v => { try { localStorage.setItem(MAP_KEY, v ? 'hidden' : 'shown'); } catch { /* a preference must not block reading */ } return !v; });
  // G14: opening a part takes it apart in place; going back brings the level back. One class per movement, replayed by key.
  const [motion, setMotion] = useState<'opening' | 'returning'>();
  const drawingArea = useRef<HTMLDivElement>(null);
  const nothing = !role.frame && !role.add.length && !role.deepen.length && !role.relate.length;
  useEffect(() => {
    setFocus(passage);
    setWide(false);
    if (keep.current) keep.current = false;
    else { setPath([]); setSelected(undefined); setFace(undefined); setJoint(undefined); setMotion(undefined); }
    if (moved.current) { stage.current?.focus({ preventScroll: true }); moved.current = false; }
    const rail = navigation.current, current = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (rail && current) rail.scrollTop += current.getBoundingClientRect().top - rail.getBoundingClientRect().top - rail.clientHeight / 2 + current.clientHeight / 2;
  }, [passage]);
  const go = (next: number) => {
    const p = route[Math.min(route.length - 1, Math.max(0, next))];
    moved.current = true;
    onPosition({ source: p.source, from: p.from, view: 'guided' });
  };
  const locate = (cite: Cite) => { setFocus(cite); proof.current?.focus({ preventScroll: true }); };
  const jumpPart = (id: string) => {
    const part = d.parts.find(p => p.id === id);
    const next = route.findIndex(p => part?.cites.some(c => c.source === p.source && c.from <= p.to && c.to >= p.from));
    if (next >= 0) go(next);
  };
  const choose = (id: string) => { const next = selected === id ? undefined : id; setSelected(next); setFace(undefined); setJoint(undefined); show(next ? findPart(next)?.cites : undefined); };
  const pickFace = (pick: FacePick) => { const same = face?.part === pick.part && face.index === pick.index; setFace(same ? undefined : pick); setSelected(pick.part); setJoint(undefined);
    show(same ? undefined : [{ source: pick.item.source, from: pick.item.from, to: pick.item.to }]); };
  const pickJoint = (i: number) => { const next = joint === i ? undefined : i; setJoint(next); setSelected(undefined); setFace(undefined); show(next === undefined ? undefined : d.joints[next].cites); };
  // Opening from the whole remembers where the source stood; coming back to the whole restores it.
  const opening = (next: string[]) => { if (!path.length) saved.current = { focus }; setPath(next); setSelected(undefined); setFace(undefined); setJoint(undefined); setMotion('opening'); };
  const returning = (next: string[], select?: string) => {
    setPath(next); setSelected(select); setFace(undefined); setJoint(undefined); setMotion('returning');
    if (!next.length && saved.current) { setFocus({ ...saved.current.focus }); saved.current = undefined; }
  };
  const enter = (id: string) => { if (level.some(p => p.id === id && p.parts)) opening([...path, id]); };
  const leave = () => { if (open) returning(path.slice(0, -1), open); };
  // The strip, pressed: its part opens in place of what was open; anywhere else, its level takes the focus back.
  const pressUpper = (depth: number, id?: string) => {
    const parts = depth ? findPart(path[depth - 1])?.parts ?? [] : d.parts, part = id ? parts.find(p => p.id === id) : undefined;
    if (part?.parts) opening([...path.slice(0, depth), part.id]);
    else returning(path.slice(0, depth), part?.id ?? path[depth]);
  };
  // L10: leave the exploration and go back to the step's lines, or move the reading to the first step citing it.
  const backToStep = () => { if (path.length) { setPath([]); setMotion('returning'); saved.current = undefined; } setSelected(undefined); setFace(undefined); setJoint(undefined); setFocus({ ...passage }); };
  const readFrom = (i: number) => { keep.current = true; go(i); };
  // Escape and Alt+↑ go up a level, as in the overview; Z shows the margin. Never while typing or in a dialog.
  const keys = useRef({ open, leave }); keys.current = { open, leave };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.defaultPrevented || target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      if (keys.current.open && (e.key === 'Escape' || (e.altKey && e.key === 'ArrowUp'))) { e.preventDefault(); keys.current.leave(); }
      else if ((e.key === 'z' || e.key === 'Z') && !e.altKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setMargin(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // ← and → move between passages from the drawing or the panel; the source band and the splitters keep their own keys.
  const step = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || target.closest('input, textarea, select, [role="separator"], details > summary')) return;
    if (e.key === 'ArrowDown' && openTarget) { e.preventDefault(); enter(openTarget.id); }
    else if (e.key === 'ArrowUp' && path.length) { e.preventDefault(); leave(); }
    else if (e.key === 'ArrowRight' && index + 1 < route.length) { e.preventDefault(); go(index + 1); }
    else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); go(index - 1); }
  };
  const doesOf = (r: (typeof roles)[number]) => [r.frame && 'frame', r.add.length && 'add', r.deepen.length && 'deepen', r.relate.length && 'relate', r.margin.length && 'margin']
    .filter((k): k is 'frame' | 'add' | 'deepen' | 'relate' | 'margin' => !!k);
  const doesWord = { frame: x.frames, add: x.adds, deepen: x.deepens, relate: x.relates, margin: x.margin };
  // The prototype's structure (G9): route, drawing at the centre, panel, and the source once, in a band below.
  return <div ref={workspace} className={`guided-reading${wide ? ' guided-source-wide' : ''}`}
    style={{ '--guided-top': panes.sizes.guided, '--guided-panel': panes.sizes.panel } as CSSProperties}>
    <nav className="guided-navigation" aria-label={x.contents} hidden={wide}>
      <h2>{x.routeTitle}</h2>
      <ul className="guided-legend" aria-label={x.legend}>{(['frame', 'add', 'deepen', 'relate', 'margin'] as const).map(k =>
        <li key={k}><i className={`does-mark d-${k}`} aria-hidden="true"/>{doesWord[k]}</li>)}</ul>
      <ol ref={navigation}>
        {route.map((p, i) => <li key={`${p.source}:${p.from}`}>
          {d.sources.length > 1 && (i === 0 || route[i - 1].source !== p.source) && <span className="guided-source-name">{d.sources.find(s => s.id === p.source)!.title}</span>}
          <button aria-label={`${x.passage(i + 1)}: ${names[i]} · ${t.d.lines(p.from, p.to)}${doesOf(roles[i]).length ? ` · ${doesOf(roles[i]).map(k => doesWord[k]).join(', ')}` : ''}`}
            aria-current={i === index ? 'step' : undefined} data-explored={citing.includes(i) || undefined} onClick={() => go(i)} title={`${sourceTitle(d, p.source)} · ${t.d.lines(p.from, p.to)}`}>
            <span className="guided-number" aria-hidden="true">{i + 1}</span>
            <span>{names[i]}{citing.includes(i) && <span className="sr-only"> · {t.d.lab.citesExplored}</span>}<span className="guided-does-marks" aria-hidden="true">{doesOf(roles[i]).map(k => <i key={k} className={`does-mark d-${k}`} title={doesWord[k]}/>)}</span></span>
          </button>
        </li>)}
      </ol>
    </nav>
    <section ref={stage} className="guided-stage" tabIndex={-1} aria-label={x.drawing} hidden={wide} onKeyDown={step}>
      <div className="guided-drawing-bar">
        {/* the way up from the whole: every level above the open one can be pressed */}
        <span className="micro guided-path">{path.length ? <button className="link" onClick={() => pressUpper(0)}>{d.whole.name}</button> : d.whole.name}{path.map((id, i) => <Fragment key={id}> › {i === path.length - 1
          ? <b>{findPart(id)?.name}</b> : <button className="link" onClick={() => pressUpper(i + 1)}>{findPart(id)?.name}</button>}</Fragment>)}</span>
      </div>
      {away && <div className="lab-explore" role="status">
        <span lang={d.language}>{t.d.lab.exploring(away.name, t.d.lines(away.cites[0].from, away.cites[0].to), index + 1)}</span>
        <button className="text-button" onClick={backToStep}>{t.d.lab.backToStep(index + 1)}</button>
        {citing.length > 0 && <button className="text-button" onClick={() => readFrom(citing[0])}>{t.d.lab.readFrom(citing[0] + 1)}</button>}
      </div>}
      <div className={`guided-detail-drawing${path.length ? '' : ' single'}${motion ? ` ${motion}` : ''}`} ref={drawingArea}>
        <LabStage d={d} choice={choice} path={path} selected={selected} onSelect={choose} onEnter={enter} onUpper={pressUpper}
          selectedFace={face && `${face.part}#${face.index}`} onFace={pickFace} selectedJoint={joint} onJoint={pickJoint}
          built={built} jointShown={jointShown} currentJoint={currentJoint} marks={topMarks} levelMarks={citedMarks}
          suspended={suspended && load && loadTag ? { part: suspended, target: load.target, tag: loadTag } : undefined} motion={motion}/>
      </div>
      {owner && <p className="micro guided-depth-note">{x.citedHere(level.filter(p => role.subParts.includes(p.id)).length, level.length)}</p>}
      <div className="guided-deck">
        {showMap && <button type="button" className={`guided-minimap${owner ? ' inside' : ''}`} disabled={!owner} onClick={leave}
          aria-label={owner ? x.hereLabel(d.whole.name, path.map(id => findPart(id)?.name).join(' › ')) : x.mapLabel(d.whole.name)}>
          <span className="guided-minimap-path" aria-hidden="true">{owner ? <><b>{x.here}</b> · {owner.name}</> : x.mapLabel(d.whole.name)}</span>
          <span className="guided-minimap-drawing" aria-hidden="true"><WholeDrawing d={d} choice={choice} mini built={built} marks={path[0] ? { ...topMarks, [path[0]]: 'here' } : topMarks}/></span>
        </button>}
        <div className="guided-axes" role="toolbar" aria-label={x.controls}>
          <div className="guided-axis"><span className="guided-axis-name" aria-hidden="true">x</span>
            <button className="text-button" disabled={index === 0} onClick={() => go(index - 1)} title={x.keyHint('←')}><ArrowLeft size={15}/>{x.back}</button>
            <span className="guided-position" aria-label={x.position(index + 1, route.length)}>{index + 1} / {route.length}</span>
            {index + 1 < route.length ? <button className="primary" onClick={() => go(index + 1)} title={x.keyHint('→')}>{x.next}<ArrowRight size={15}/></button>
              : <button className="primary" onClick={() => onExplore()}><Layers size={15}/>{x.end}</button>}
          </div>
          <div className="guided-axis"><span className="guided-axis-name" aria-hidden="true">y</span>
            <button className="text-button" disabled={!openTarget} onClick={() => openTarget && enter(openTarget.id)} title={x.keyHint('↓')}>
              <ArrowDown size={15}/>{openTarget ? x.openNamed(openTarget.name) : x.openNone}</button>
            <button className="text-button" disabled={!owner} onClick={leave} title={x.keyHint('↑ · Esc')}><ArrowUp size={15}/>{x.backToWhole}</button>
          </div>
          <div className="guided-axis"><span className="guided-axis-name" aria-hidden="true">z</span>
            <button className="text-button guided-margin-toggle" aria-pressed={margin} aria-label={x.marginLabel(role.margin.length)} onClick={() => setMargin(v => !v)} title={x.keyHint('Z')}>
              <NotebookText size={14}/>{x.margin}<span className="guided-count">{role.margin.length}</span></button>
          </div>
          <button className="text-button guided-map-toggle" aria-pressed={showMap} onClick={toggleMap}>{showMap ? x.hideMap : x.showMap}</button>
        </div>
      </div>
    </section>
    {panes.wide && !wide && <Splitter pane="panel" orientation="vertical" grows="ArrowLeft" value={panes.sizes.panel} label={x.resizeDrawing}
      onChange={v => panes.set('panel', v)} onReset={() => panes.reset('panel')}
      fromPointer={px => { const r = workspace.current?.getBoundingClientRect(); return r?.width ? (r.right - px) / r.width : undefined; }}/>}
    <aside className="guided-context" hidden={wide} aria-label={x.does} onKeyDown={step}>
      <div className="guided-drafting">
        <p className="micro guided-where">{x.position(index + 1, route.length)} · {t.d.lines(passage.from, passage.to)}</p>
        <h2 className="guided-title" lang={isProse(source) ? source.language : undefined}>{names[index]}</h2>
        {margin && <section className="guided-margin" aria-label={x.margin}>
          {role.margin.length ? <ul>{role.margin.map((m, i) => <li key={i}>
            <button className="cite" onClick={() => locate(m)}>{t.d.lines(m.from, m.to)}</button> {t.d.reasons[m.reason]}{m.note && <> · <span lang={d.language}>{m.note}</span></>}
          </li>)}</ul> : <p>{x.marginEmpty}</p>}
        </section>}
        {chosen && <section className="guided-block guided-selected" lang={d.language}>
          <h3>{x.selected}</h3>
          <h4><PartIcon name={chosen.icon}/>{chosen.name}</h4><p>{chosen.role}</p>
          <div className="guided-context-actions">
            {(chosen.parts ? <button className="text-button" onClick={() => enter(chosen.id)}><Layers size={14}/>{x.openParts(chosen.parts.length)}</button>
              : takeApart?.(chosen) ?? <span className="micro">{x.noSub}</span>)}
            {!owner && <button className="text-button" onClick={() => jumpPart(chosen.id)}><BookOpen size={14}/>{x.firstPassage}</button>}
          </div>
          <InDrawing choice={choice} part={chosen} top={!owner}/>
          {load && !owner && (chosen.id === load.target || load.bricks.some(b => b.part === chosen.id)) && suspendRun}
        </section>}
        {face && <section className="guided-block lab-face-card" lang={d.language}>
          <h3>{t.d.lab.face}</h3><h4>{face.item.label}</h4>
          {face.item.cells && <p>{face.item.cells.join(' · ')}</p>}{face.item.text && <p>{face.item.text}</p>}
          <Cites d={d} cites={[{ source: face.item.source, from: face.item.from, to: face.item.to }]} focus={focus} onFocus={locate}/>
        </section>}
        {chosenJoint && <section className="guided-block lab-joint-card" lang={d.language}>
          <h3>{t.d.lab.joint}</h3><p><b>{partOf(chosenJoint.from).name}</b> {t.d.verbs[chosenJoint.type]} <b>{partOf(chosenJoint.to).name}</b></p><p className="muted">«{chosenJoint.label}»</p>
          {chosenJoint.cites?.length ? <Cites d={d} cites={chosenJoint.cites} focus={focus} onFocus={locate}/> : <p className="micro">{t.d.lab.noLines}</p>}
        </section>}
        <section className="guided-does" aria-label={x.does} lang={d.language}>
          {role.frame && <div className="guided-block b-frame"><h3>{x.frames}</h3><p>{d.whole.does}</p><p className="muted">{d.whole.why}</p></div>}
          {role.add.map(id => { const p = partOf(id); return <div key={id} className="guided-block b-add"><h3>{x.adds}</h3>
            <h4><PartIcon name={p.icon}/>{p.name}</h4><p>{p.role}</p>
            {p.metaphor && <p className="guided-analogy">{p.metaphor.text}<span>{x.analogyLimit}: {p.metaphor.limit}</span></p>}
            {p.parts && !path.length && <button className="text-button" onClick={() => enter(p.id)}><Layers size={14}/>{x.openParts(p.parts.length)}</button>}</div>; })}
          {role.deepen.map(id => { const p = partOf(id); return <div key={id} className="guided-block b-deepen"><h3>{x.deepens}</h3>
            <h4><PartIcon name={p.icon}/>{p.name}</h4>{p.points && <Points points={p.points}/>}</div>; })}
          {role.relate.length > 0 && <div className="guided-block b-relate"><h3>{x.relates}</h3><ul>{role.relate.map((j, i) => <li key={i}>
            <b>{partOf(j.from).name}</b>{later(j.from)} — {j.label} → <b>{partOf(j.to).name}</b>{later(j.to)}</li>)}</ul></div>}
          {nothing && <div className="guided-source-context"><BookOpen size={20}/><p>{x.noPart}</p></div>}
          <div className="guided-context-actions"><button className="text-button" onClick={() => locate(passage)}><Link2 size={14}/>{x.showSource}</button>
            <button className="text-button" onClick={() => onExplore(role.add[0] ?? role.deepen[0])}><Layers size={14}/>{x.openOverview}</button></div>
        </section>
        {/* the whole's card: why this representation, the annotations, and the atlas's load run once its target is read */}
        {!chosen && !chosenJoint && <section className="lab-whole-card" lang={d.language}>
          <WhyRepresentation d={d} choice={choice}/>
          <Annotations d={d} choice={choice} context={context} onCite={locate} onPart={id => { if (!open && built(id)) choose(id); }}/>
          {load && built(load.target) && suspendRun}
        </section>}
      </div>
    </aside>
    {!wide && <Splitter pane="guided" orientation="horizontal" grows="ArrowDown" value={panes.sizes.guided} label={x.resizeReading}
      onChange={v => panes.set('guided', v)} onReset={() => panes.reset('guided')}
      fromPointer={(_x, y) => { const r = workspace.current?.getBoundingClientRect(); return r?.height ? (y - r.top) / r.height : undefined; }}/>}
    <div className="guided-proof" ref={proof} tabIndex={-1}>
      <SourcePane d={d} sourceId={focus.source} onSource={id => go(route.findIndex(p => p.source === id))} focus={focus} cited={cited}
        wide={wide} onWide={() => setWide(v => !v)} view={views[focus.source] ?? 'lines'}
        onView={view => setViews(v => ({ ...v, [focus.source]: view }))}/>
    </div>
    {wide && <div className="guided-wide-controls"><button className="text-button" onClick={() => setWide(false)}>{x.returnReading}</button></div>}
  </div>;
}

const sourceTitle = (d: Disassembly, id: string) => d.sources.find(s => s.id === id)!.title;
const MAP_KEY = 'btw:guided-minimap:v1';
