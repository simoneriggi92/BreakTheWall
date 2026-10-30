import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Layers, Link2 } from 'lucide-react';
import type { Cite, Disassembly, Joint, Part } from '../../core/disassembly';
import { layoutLevel, readingNumbers, type LevelLayout } from '../../core/layout';
import { readingContext, readingIndex, sourceReadingRoute, type ReadingPosition } from '../../core/source-reading';
import { isProse, readingBlocks } from '../markdown';
import { usePreferences } from '../preferences';
import { Points } from './PartCard';
import { PartIcon, Sheet } from './Sheet';
import { SourceDocument } from './SourceDocument';
import { SourcePane, type SourceView } from './SourcePane';

/** A second navigation of the same sources and parts, not another decomposition or learning loop. */
export function GuidedReading({ d, position, onPosition, onExplore }: {
  d: Disassembly; position?: ReadingPosition; onPosition: (position: ReadingPosition) => void; onExplore: (part?: string) => void;
}) {
  const { t } = usePreferences();
  const x = t.d.guided;
  const route = useMemo(() => sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text, isProse(s))]))), [d]);
  const index = readingIndex(route, position), passage = route[index];
  const source = d.sources.find(s => s.id === passage.source)!;
  const context = useMemo(() => readingContext(d, passage), [d, passage]);
  const [focus, setFocus] = useState<Cite>(passage);
  const [views, setViews] = useState<Record<string, SourceView>>({});
  const [wide, setWide] = useState(false);
  const navigation = useRef<HTMLOListElement>(null);
  const article = useRef<HTMLElement>(null);
  const proof = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const exclusions = d.bom.excluded.filter(c => c.source === passage.source && c.from <= passage.to && c.to >= passage.from);
  // One existing joint and its two endpoints: a readable detail of the canonical drawing, not invented content.
  const drawing = useMemo(() => {
    const joint = context.root && d.joints.find(j => j.from === context.root!.id || j.to === context.root!.id);
    const ids = new Set(joint ? [joint.from, joint.to] : context.root ? [context.root.id] : []);
    const parts = d.parts.filter(p => ids.has(p.id)), joints = joint ? [joint] : [];
    return { parts, joints, layout: parts.length ? detailLayout(parts, joints) : undefined };
  }, [d, context.root]);
  const numbering = useMemo(() => readingNumbers(layoutLevel(d.parts, d.joints)), [d]);
  useEffect(() => {
    setFocus(passage);
    setWide(false);
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
  return <div className={`guided-reading${wide ? ' guided-source-wide' : ''}`}>
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
    <div className="guided-center">
      <article ref={article} className="guided-passage" tabIndex={-1} aria-label={x.passage(index + 1)} hidden={wide} lang={isProse(source) ? source.language : undefined}>
        {isProse(source) ? <SourceDocument key={`${passage.source}:${passage.from}`} source={source} passage={passage} cited={[]}/>
          : <pre className="guided-code">{source.text.split('\n').slice(passage.from - 1, passage.to).join('\n')}</pre>}
        {exclusions.length > 0 && <details className="guided-exclusions"><summary>{x.excluded}</summary><ul>{exclusions.map((c, i) => <li key={i}>
          <button className="cite" onClick={() => locate(c)}>{t.d.lines(c.from, c.to)}</button> {t.d.reasons[c.reason]}{c.note && <> · {c.note}</>}
        </li>)}</ul></details>}
      </article>
      <div className="guided-proof" ref={proof} tabIndex={-1}>
        <SourcePane d={d} sourceId={focus.source} onSource={id => go(route.findIndex(p => p.source === id))} focus={focus} cited={[passage]}
          wide={wide} onWide={() => setWide(v => !v)} view={views[focus.source] ?? 'lines'}
          onView={view => setViews(v => ({ ...v, [focus.source]: view }))}/>
      </div>
    </div>
    <aside className="guided-context" hidden={wide} aria-label={x.drawing}>
      <div className="guided-drafting">
        {context.root ? <>
          <div className="guided-detail-drawing"><Sheet layout={drawing.layout!} parts={drawing.parts} joints={drawing.joints} numbering={numbering}
            title={context.root.name} subtitle={x.drawingDetail} language={d.language} selected={context.root.id}
            onSelect={jumpPart} fit="contain" detail/></div>
          {context.part && <details className="guided-part-detail" lang={d.language}><summary><PartIcon name={context.part.icon}/>{context.part.name}</summary>
            <p lang={d.language}>{context.part.role}</p>{context.part.points && <Points points={context.part.points}/>}
          </details>}
          <div className="guided-context-actions"><button className="text-button" onClick={() => locate(passage)}><Link2 size={14}/>{x.showSource}</button>
            <button className="text-button" onClick={() => onExplore(context.root!.id)}><Layers size={14}/>{x.openOverview}</button></div>
        </> : <div className="guided-source-context"><BookOpen size={24}/><p>{x.noPart}</p><button className="text-button" onClick={() => onExplore()}><Layers size={15}/>{x.openOverview}</button></div>}
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

/** A readable vertical projection of one existing joint. Ids, direction, type and numbering do not change. */
function detailLayout(parts: Part[], joints: Joint[]): LevelLayout {
  const base = layoutLevel(parts, joints);
  if (parts.length !== 2 || joints.length !== 1) return base;
  const plates = base.order.map((id, i) => ({ id, rect: { x: 40, y: 40 + i * 156, w: 176, h: 84 } }));
  const joint = base.joints[0], a = plates.find(p => p.id === joint.from)!.rect, b = plates.find(p => p.id === joint.to)!.rect;
  const down = a.y < b.y, label = { ...joint.label, x: 140, y: 151 };
  return { ...base, orientation: 'stack', plates, width: Math.max(256, label.x + label.w + 24), height: 320,
    joints: [{ ...joint, points: [[128, down ? a.y + a.h : a.y], [128, down ? b.y : b.y + b.h]], label }] };
}
