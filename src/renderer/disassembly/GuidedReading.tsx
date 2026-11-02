import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, Layers, Link2, NotebookText } from 'lucide-react';
import type { Cite, Disassembly, Part } from '../../core/disassembly';
import { layoutLevel, readingNumbers } from '../../core/layout';
import { readingIndex, readingRoles, sourceReadingRoute, type ReadingPosition } from '../../core/source-reading';
import { isProse, readingBlocks } from '../markdown';
import { usePreferences } from '../preferences';
import { Points } from './PartCard';
import { PartIcon, Sheet, type ReadingMarks } from './Sheet';
import { SourceDocument } from './SourceDocument';
import { SourcePane, type SourceView } from './SourcePane';
import { Splitter, usePaneSizes } from './SplitPane';

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
  const route = useMemo(() => sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text, isProse(s))]))), [d]);
  const roles = useMemo(() => readingRoles(d, route), [d, route]);
  const index = readingIndex(route, position), passage = route[index], role = roles[index];
  const source = d.sources.find(s => s.id === passage.source)!;
  const [focus, setFocus] = useState<Cite>(passage);
  const [views, setViews] = useState<Record<string, SourceView>>({});
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [margin, setMargin] = useState(false);
  const panes = usePaneSizes();
  const workspace = useRef<HTMLDivElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const cited = useMemo(() => [passage], [passage]);
  const navigation = useRef<HTMLOListElement>(null);
  const article = useRef<HTMLElement>(null);
  const proof = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // Where each part and each top-level joint first enters the reading: the drawing never runs ahead of the text.
  const addedAt = useMemo(() => new Map(roles.flatMap((r, i) => r.add.map(id => [id, i] as const))), [roles]);
  const relatedAt = useMemo(() => d.joints.map(j => roles.findIndex(r => r.relate.includes(j))), [d, roles]);
  const owner = open ? d.parts.find(p => p.id === open) : undefined;
  const level = owner?.parts ?? d.parts, levelJoints = owner ? owner.joints ?? [] : d.joints;
  // Top to bottom, to fit the narrow column beside the reading; the numbers stay those of the overview.
  const layout = useMemo(() => layoutLevel(level, levelJoints, 'stack'), [level, levelJoints]);
  const numbering = useMemo(() => readingNumbers(layoutLevel(level, levelJoints)), [level, levelJoints]);
  const marks = useMemo((): ReadingMarks => {
    if (owner) return { plates: Object.fromEntries(level.filter(p => role.subParts.includes(p.id)).map(p => [p.id, 'cited'])) };
    const plates: ReadingMarks['plates'] = {};
    d.parts.forEach(p => {
      const at = addedAt.get(p.id);
      const mark = at === undefined || at > index ? 'unread' : role.add.includes(p.id) ? 'added' : role.deepen.includes(p.id) ? 'deepened' : undefined;
      if (mark) plates[p.id] = mark;
    });
    return { plates, hidden: new Set(relatedAt.flatMap((at, i) => at < 0 || at > index ? [i] : [])), current: new Set(d.joints.flatMap((j, i) => role.relate.includes(j) ? [i] : [])) };
  }, [owner, level, role, d, addedAt, relatedAt, index]);
  const partOf = (id: string) => d.parts.find(p => p.id === id)!;
  const later = (id: string) => { const at = addedAt.get(id); return at !== undefined && at > index ? <span className="micro"> ({x.comesAt(at + 1)})</span> : null; };
  const chosen = selected ? level.find(p => p.id === selected) : undefined;
  // The drawing keeps plates readable and scrolls: what this passage marks comes into view.
  const drawingArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    drawingArea.current?.querySelector('.plate.read-added, .plate.read-deepened, .plate.read-cited, .reading-current')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [marks]);
  const nothing = !role.frame && !role.add.length && !role.deepen.length && !role.relate.length;
  useEffect(() => {
    setFocus(passage);
    setWide(false);
    setOpen(undefined); setSelected(undefined);
    if (moved.current) { article.current?.focus({ preventScroll: true }); moved.current = false; }
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
  const enter = (id: string) => { if (!owner && partOf(id)?.parts) { setOpen(id); setSelected(undefined); } };
  const leave = () => { const left = open; setOpen(undefined); setSelected(left); };
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
  // ← and → move between passages from the passage or the drawing; the source pane and the splitters keep their own keys.
  const step = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || target.closest('input, textarea, select, [role="separator"], details > summary')) return;
    if (e.key === 'ArrowRight' && index + 1 < route.length) { e.preventDefault(); go(index + 1); }
    else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); go(index - 1); }
  };
  return <div ref={workspace} className={`guided-reading${wide ? ' guided-source-wide' : ''}`}
    style={{ '--guided-reading': panes.sizes.reading, '--guided-drawing': panes.sizes.source } as CSSProperties}>
    <nav className="guided-navigation" aria-label={x.contents}>
      <h2>{x.contents}</h2>
      <ol ref={navigation}>
        {route.map((p, i) => <li key={`${p.source}:${p.from}`}>
          {d.sources.length > 1 && (i === 0 || route[i - 1].source !== p.source) && <span className="guided-source-name">{d.sources.find(s => s.id === p.source)!.title}</span>}
          <button aria-label={`${x.passage(i + 1)}: ${p.title ?? sourceTitle(d, p.source)} · ${t.d.lines(p.from, p.to)}`}
            aria-current={i === index ? 'step' : undefined} onClick={() => go(i)} title={`${sourceTitle(d, p.source)} · ${t.d.lines(p.from, p.to)}`}>
            <span className="guided-number" aria-hidden="true">{i + 1}</span><span>{p.title ?? x.passage(i + 1)}</span>
          </button>
        </li>)}
      </ol>
    </nav>
    <div className="guided-center" ref={center}>
      <article ref={article} className="guided-passage" tabIndex={-1} aria-label={x.passage(index + 1)} hidden={wide} lang={isProse(source) ? source.language : undefined} onKeyDown={step}>
        {isProse(source) ? <SourceDocument key={`${passage.source}:${passage.from}`} source={source} passage={passage} cited={[]}/>
          : <pre className="guided-code">{source.text.split('\n').slice(passage.from - 1, passage.to).join('\n')}</pre>}
      </article>
      {!wide && <Splitter pane="reading" orientation="horizontal" grows="ArrowDown" value={panes.sizes.reading} label={x.resizeReading}
        onChange={v => panes.set('reading', v)} onReset={() => panes.reset('reading')}
        fromPointer={(_x, y) => { const r = center.current?.getBoundingClientRect(); return r?.height ? (y - r.top) / r.height : undefined; }}/>}
      <div className="guided-proof" ref={proof} tabIndex={-1}>
        <SourcePane d={d} sourceId={focus.source} onSource={id => go(route.findIndex(p => p.source === id))} focus={focus} cited={cited}
          wide={wide} onWide={() => setWide(v => !v)} view={views[focus.source] ?? 'lines'}
          onView={view => setViews(v => ({ ...v, [focus.source]: view }))}/>
      </div>
    </div>
    {panes.wide && !wide && <Splitter pane="source" orientation="vertical" grows="ArrowLeft" value={panes.sizes.source} label={x.resizeDrawing}
      onChange={v => panes.set('source', v)} onReset={() => panes.reset('source')}
      fromPointer={x => { const r = workspace.current?.getBoundingClientRect(); return r?.width ? (r.right - x) / r.width : undefined; }}/>}
    <aside className="guided-context" hidden={wide} aria-label={x.drawing} onKeyDown={step}>
      <div className="guided-drafting">
        <div className="guided-drawing-bar">
          {owner ? <button className="text-button" onClick={leave}><ArrowUp size={14}/>{x.backToWhole}</button> : <span className="micro">{d.whole.name}</span>}
          <button className="text-button guided-margin-toggle" aria-pressed={margin} aria-label={x.marginLabel(role.margin.length)} onClick={() => setMargin(v => !v)}>
            <NotebookText size={14}/>{x.margin}<span className="guided-count">{role.margin.length}</span></button>
        </div>
        <div className="guided-detail-drawing" ref={drawingArea}>
          <Sheet layout={layout} parts={level} joints={levelJoints} title={owner?.name ?? d.whole.name} subtitle={owner ? x.depth(owner.name) : x.drawingDetail}
            language={d.language} selected={selected} onSelect={choose} onEnter={enter} reading={marks} numbering={numbering} detail/>
        </div>
        {margin && <section className="guided-margin" aria-label={x.margin}>
          {role.margin.length ? <ul>{role.margin.map((m, i) => <li key={i}>
            <button className="cite" onClick={() => locate(m)}>{t.d.lines(m.from, m.to)}</button> {t.d.reasons[m.reason]}{m.note && <> · <span lang={d.language}>{m.note}</span></>}
          </li>)}</ul> : <p>{x.marginEmpty}</p>}
        </section>}
        {owner && <p className="micro guided-depth-note">{x.citedHere(level.filter(p => role.subParts.includes(p.id)).length, level.length)}</p>}
        {chosen && <section className="guided-block guided-selected" lang={d.language}>
          <h3>{x.selected}</h3>
          <h4><PartIcon name={chosen.icon}/>{chosen.name}</h4><p>{chosen.role}</p>
          <div className="guided-context-actions">
            {!owner && (chosen.parts ? <button className="text-button" onClick={() => enter(chosen.id)}><Layers size={14}/>{x.openParts(chosen.parts.length)}</button>
              : takeApart?.(chosen) ?? <span className="micro">{x.noSub}</span>)}
            {!owner && <button className="text-button" onClick={() => jumpPart(chosen.id)}><BookOpen size={14}/>{x.firstPassage}</button>}
          </div>
        </section>}
        <section className="guided-does" aria-label={x.does} lang={d.language}>
          {role.frame && <div className="guided-block b-frame"><h3>{x.frames}</h3><p>{d.whole.does}</p><p className="muted">{d.whole.why}</p></div>}
          {role.add.map(id => { const p = partOf(id); return <div key={id} className="guided-block b-add"><h3>{x.adds}</h3>
            <h4><PartIcon name={p.icon}/>{p.name}</h4><p>{p.role}</p>
            {p.metaphor && <p className="guided-analogy">{p.metaphor.text}<span>{x.analogyLimit}: {p.metaphor.limit}</span></p>}
            {p.parts && !owner && <button className="text-button" onClick={() => enter(p.id)}><Layers size={14}/>{x.openParts(p.parts.length)}</button>}</div>; })}
          {role.deepen.map(id => { const p = partOf(id); return <div key={id} className="guided-block b-deepen"><h3>{x.deepens}</h3>
            <h4><PartIcon name={p.icon}/>{p.name}</h4>{p.points && <Points points={p.points}/>}</div>; })}
          {role.relate.length > 0 && <div className="guided-block b-relate"><h3>{x.relates}</h3><ul>{role.relate.map((j, i) => <li key={i}>
            <b>{partOf(j.from).name}</b>{later(j.from)} — {j.label} → <b>{partOf(j.to).name}</b>{later(j.to)}</li>)}</ul></div>}
          {nothing && <div className="guided-source-context"><BookOpen size={20}/><p>{x.noPart}</p></div>}
          <div className="guided-context-actions"><button className="text-button" onClick={() => locate(passage)}><Link2 size={14}/>{x.showSource}</button>
            <button className="text-button" onClick={() => onExplore(role.add[0] ?? role.deepen[0])}><Layers size={14}/>{x.openOverview}</button></div>
        </section>
      </div>
      <footer className="guided-controls"><button className="text-button" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={15}/>{x.back}</button>
        <span className="guided-position" aria-label={x.position(index + 1, route.length)}>{index + 1} / {route.length}</span>
        {index + 1 < route.length ? <button className="primary" onClick={() => go(index + 1)}>{x.next}<ArrowRight size={15}/></button>
          : <button className="primary" onClick={() => onExplore()}><Layers size={15}/>{x.end}</button>}
      </footer>
    </aside>
    {wide && <div className="guided-wide-controls"><button className="text-button" onClick={() => setWide(false)}>{x.returnReading}</button></div>}
  </div>;
}

const sourceTitle = (d: Disassembly, id: string) => d.sources.find(s => s.id === id)!.title;
