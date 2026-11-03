import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Layers, Link2, NotebookText } from 'lucide-react';
import { allParts, type Cite, type Disassembly, type Joint, type Part } from '../../core/disassembly';
import { layoutLevel, readingNumbers } from '../../core/layout';
import { readingIndex, readingRoles, readingSteps, sourceReadingRoute, type ReadingPosition } from '../../core/source-reading';
import { isProse, readingBlocks } from '../markdown';
import { usePreferences } from '../preferences';
import { Points } from './PartCard';
import { ObjectSheet } from './ObjectSheet';
import { PartIcon, Sheet, type ReadingMarks } from './Sheet';
import { SourcePane, type SourceView } from './SourcePane';
import { Splitter, usePaneSizes } from './SplitPane';
import { workbenchLayout } from './workbench-layout';

/**
 * A second navigation of the same sources and parts, not another decomposition or learning loop. The drawing follows
 * the reading (P-20261102-guided-reading): x moves through passages, y opens a part where it is, z is the margin.
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
  // The open path (G17): the parts opened from the whole down; each one's level is stacked below the one it comes from.
  const [path, setPath] = useState<string[]>([]);
  const open = path.at(-1);
  const [selected, setSelected] = useState<string>();
  const [margin, setMargin] = useState(false);
  // The object or today's plates (G10), remembered on this device.
  const [style, setStyle] = useState<'object' | 'plates'>(() => { try { return localStorage.getItem(STYLE_KEY) === 'plates' ? 'plates' : 'object'; } catch { return 'object'; } });
  const chooseStyle = (next: 'object' | 'plates') => { setStyle(next); try { localStorage.setItem(STYLE_KEY, next); } catch { /* a preference must not block reading */ } };
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
  const levels = useMemo(() => [{ id: undefined as string | undefined, parts: d.parts, joints: d.joints },
    ...path.map(id => { const p = allParts(d).find(x => x.part.id === id)!.part; return { id, parts: p.parts ?? [], joints: p.joints ?? [] }; })], [d, path]);
  // The top level is drawn twice more: as the minimap (G11) and, inside a part, as the faded level behind it (G14).
  const rootLayout = useMemo(() => layoutLevel(d.parts, d.joints), [d]);
  const rootNumbers = useMemo(() => readingNumbers(rootLayout), [rootLayout]);
  const rootObject = useMemo(() => workbenchLayout(rootLayout, d.joints), [rootLayout, d.joints]);
  const topMarks = useMemo((): ReadingMarks => {
    const plates: ReadingMarks['plates'] = {};
    d.parts.forEach(p => {
      const at = addedAt.get(p.id);
      const mark = at === undefined || at > index ? 'unread' : role.add.includes(p.id) ? 'added' : role.deepen.includes(p.id) ? 'deepened' : undefined;
      if (mark) plates[p.id] = mark;
    });
    return { plates, hidden: new Set(relatedAt.flatMap((at, i) => at < 0 || at > index ? [i] : [])), current: new Set(d.joints.flatMap((j, i) => role.relate.includes(j) ? [i] : [])) };
  }, [role, d, addedAt, relatedAt, index]);
  // Below the whole, a level marks the parts this step cites.
  const citedMarks = (parts: Part[]): ReadingMarks => ({ plates: Object.fromEntries(parts.filter(p => role.subParts.includes(p.id)).map(p => [p.id, 'cited'])) });
  const partOf = (id: string) => d.parts.find(p => p.id === id)!;
  const later = (id: string) => { const at = addedAt.get(id); return at !== undefined && at > index ? <span className="micro"> ({x.comesAt(at + 1)})</span> : null; };
  const chosen = selected ? level.find(p => p.id === selected) : undefined;
  // y (G12): the part the "open" control opens: the selected one, or the first of this step that has a sub-assembly.
  const openTarget = chosen?.parts ? chosen : owner ? level.find(p => p.parts && role.subParts.includes(p.id))
    : [...role.add, ...role.deepen].map(id => d.parts.find(p => p.id === id)!).find(p => p.parts);
  const [showMap, setShowMap] = useState(() => { try { return localStorage.getItem(MAP_KEY) !== 'hidden'; } catch { return true; } });
  const toggleMap = () => setShowMap(v => { try { localStorage.setItem(MAP_KEY, v ? 'hidden' : 'shown'); } catch { /* a preference must not block reading */ } return !v; });
  // G14: opening a part takes it apart in place; going back brings the level back. One class per movement, replayed by key.
  const [motion, setMotion] = useState<'opening' | 'returning'>();
  // The drawing keeps plates readable and scrolls: what this passage marks comes into view.
  const drawingArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    drawingArea.current?.querySelector('.guided-level.focus :is(.plate.read-added, .plate.read-deepened, .plate.read-cited, .reading-current)')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [index, path]);
  const nothing = !role.frame && !role.add.length && !role.deepen.length && !role.relate.length;
  useEffect(() => {
    setFocus(passage);
    setWide(false);
    setPath([]); setSelected(undefined); setMotion(undefined);
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
  const choose = (id: string) => setSelected(s => s === id ? undefined : id);
  const enter = (id: string) => { if (level.some(p => p.id === id && p.parts)) { setPath(p => [...p, id]); setSelected(undefined); setMotion('opening'); } };
  const leave = () => { const left = open; setPath(p => p.slice(0, -1)); setSelected(left); if (left) setMotion('returning'); };
  // An upper level, pressed: its part opens in place of what was open below it; anywhere else, the level takes the focus back.
  const pressUpper = (depth: number, id?: string) => {
    const part = id ? levels[depth].parts.find(p => p.id === id) : undefined;
    if (part?.parts) { setPath(p => [...p.slice(0, depth), part.id]); setSelected(undefined); setMotion('opening'); }
    else { setPath(p => p.slice(0, depth)); setSelected(part?.id ?? path[depth]); setMotion('returning'); }
  };
  // The sub-parts start where their part stands on the faded level, and move out to their own places.
  useLayoutEffect(() => {
    if (motion !== 'opening' || !open) return;
    const from = drawingArea.current?.querySelector(`.guided-level[data-depth="${path.length - 1}"] [data-id="${CSS.escape(open)}"]`)?.getBoundingClientRect();
    const sheet = drawingArea.current?.querySelector<SVGSVGElement>('.guided-level.focus .object-sheet');
    const scale = sheet?.getScreenCTM?.()?.a || 1;
    if (!from || !sheet) return;
    sheet.querySelectorAll<SVGGElement>('.plate').forEach((plate, i) => {
      const r = plate.getBoundingClientRect();
      plate.style.setProperty('--dx', `${(from.x + from.width / 2 - r.x - r.width / 2) / scale}px`);
      plate.style.setProperty('--dy', `${(from.y + from.height / 2 - r.y - r.height / 2) / scale}px`);
      plate.style.setProperty('--delay', `${i * 40}ms`);
    });
  }, [motion, open, path.length]);
  // The level in focus comes into view down the sheet.
  useEffect(() => { drawingArea.current?.querySelector('.guided-level.focus')?.scrollIntoView?.({ block: 'nearest' }); }, [path]);
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
            aria-current={i === index ? 'step' : undefined} onClick={() => go(i)} title={`${sourceTitle(d, p.source)} · ${t.d.lines(p.from, p.to)}`}>
            <span className="guided-number" aria-hidden="true">{i + 1}</span>
            <span>{names[i]}<span className="guided-does-marks" aria-hidden="true">{doesOf(roles[i]).map(k => <i key={k} className={`does-mark d-${k}`} title={doesWord[k]}/>)}</span></span>
          </button>
        </li>)}
      </ol>
    </nav>
    <section ref={stage} className="guided-stage" tabIndex={-1} aria-label={x.drawing} hidden={wide} onKeyDown={step}>
      <div className="guided-drawing-bar">
        <span className="micro">{d.whole.name}{path.map((id, i) => <Fragment key={id}> › {i === path.length - 1 ? <b>{findPart(id)?.name}</b> : findPart(id)?.name}</Fragment>)}</span>
        <span className="guided-drawing-style" role="group" aria-label={x.drawingStyle}>
          <button aria-pressed={style === 'object'} onClick={() => chooseStyle('object')}>{x.object}</button>
          <button aria-pressed={style === 'plates'} onClick={() => chooseStyle('plates')}>{x.plates}</button></span>
      </div>
      <div className={`guided-detail-drawing guided-stack${path.length ? '' : ' single'}${motion ? ` ${motion}` : ''}`} ref={drawingArea}>
        {levels.map((lv, depth) => {
          const focused = depth === levels.length - 1, opened = path[depth];
          const levelMarks = depth === 0 ? topMarks : citedMarks(lv.parts);
          return <Fragment key={lv.id ?? 'root'}>
            {depth > 0 && <div className="guided-stack-link" aria-hidden="true"><span>▼ {findPart(lv.id!)?.name}</span></div>}
            <div className={`guided-level${focused ? ' focus' : ' upper'}${focused && depth > 0 && motion === 'opening' ? ' entering' : ''}`} data-depth={depth}
              onClick={focused ? undefined : e => { if (!(e.target as Element).closest('.plate')) pressUpper(depth); }}>
              <LevelDrawing style={style} parts={lv.parts} joints={lv.joints} title={lv.id ? findPart(lv.id)!.name : d.whole.name} language={d.language}
                subtitle={lv.id ? x.depth(findPart(lv.id)!.name) : x.drawingDetail} reading={levelMarks}
                selected={focused ? selected : opened} here={focused ? undefined : opened}
                onSelect={focused ? choose : id => pressUpper(depth, id)} onEnter={focused ? enter : undefined}/>
            </div>
          </Fragment>;
        })}
      </div>
      {owner && <p className="micro guided-depth-note">{x.citedHere(level.filter(p => role.subParts.includes(p.id)).length, level.length)}</p>}
      <div className="guided-deck">
        {showMap && <button type="button" className={`guided-minimap${owner ? ' inside' : ''}`} disabled={!owner} onClick={leave}
          aria-label={owner ? x.hereLabel(d.whole.name, path.map(id => findPart(id)?.name).join(' › ')) : x.mapLabel(d.whole.name)}>
          <span className="guided-minimap-path" aria-hidden="true">{owner ? <><b>{x.here}</b> · {owner.name}</> : x.mapLabel(d.whole.name)}</span>
          <span className="guided-minimap-drawing" aria-hidden="true">{style === 'object'
            ? <ObjectSheet layout={rootObject} parts={d.parts} joints={d.joints} title={d.whole.name} language={d.language} reading={topMarks} numbering={rootNumbers} mini here={path[0]}/>
            : <Sheet layout={rootLayout} parts={d.parts} joints={d.joints} title={d.whole.name} subtitle="" language={d.language} reading={topMarks} numbering={rootNumbers} fit="contain" detail inert/>}</span>
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
const STYLE_KEY = 'btw:guided-drawing:v1';
const MAP_KEY = 'btw:guided-minimap:v1';

/** One level of the stack (G17), drawn in the chosen style with its own layout and the overview's numbers. */
function LevelDrawing({ style, parts, joints, title, subtitle, language, reading, selected, here, onSelect, onEnter }: {
  style: 'object' | 'plates'; parts: Part[]; joints: Joint[]; title: string; subtitle: string; language: string; reading: ReadingMarks;
  selected?: string; here?: string; onSelect: (id: string) => void; onEnter?: (id: string) => void;
}) {
  const layout = useMemo(() => layoutLevel(parts, joints), [parts, joints]);
  const numbering = useMemo(() => readingNumbers(layout), [layout]);
  // On a board a long chain becomes a long diagonal: the object folds it as the overview's workbench does, same order.
  const objectLayout = useMemo(() => workbenchLayout(layout, joints), [layout, joints]);
  return style === 'object'
    ? <ObjectSheet layout={objectLayout} parts={parts} joints={joints} title={title} language={language} selected={selected} onSelect={onSelect} onEnter={onEnter}
        reading={reading} numbering={numbering} here={here}/>
    : <Sheet layout={layout} parts={parts} joints={joints} title={title} subtitle={subtitle} language={language} selected={selected} onSelect={onSelect} onEnter={onEnter}
        reading={reading} numbering={numbering} fit="contain" detail/>;
}
