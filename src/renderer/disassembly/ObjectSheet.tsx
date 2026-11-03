import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { Joint, Part } from '../../core/disassembly';
import type { LevelLayout } from '../../core/layout';
import { usePreferences } from '../preferences';
import { wrap, type ReadingMarks } from './Sheet';
import { shapeOf, type Shape } from './shapes';

/**
 * The object (P-20261102-guided-reading G10): the level drawn as a 2.5D board, each part as a functional shape on the
 * place the overview's layout gives it. Every line between two parts is a joint of the level, drawn by its kind; lines
 * inside a shape belong to the shape. Parts keep a button, name and kind for the keyboard and screen readers.
 */
export function ObjectSheet({ layout, parts, joints, title, language, selected, onSelect, onEnter, reading, numbering, mini = false, here }: {
  layout: LevelLayout; parts: Part[]; joints: Joint[]; title: string; language: string;
  selected?: string; onSelect?: (id: string) => void; onEnter?: (id: string) => void;
  reading?: ReadingMarks; numbering: ReadonlyMap<string, number>;
  /** The minimap (G11): the same object, small, with no labels and nothing to press; `here` is the part the learner is inside. */
  mini?: boolean; here?: string;
}) {
  const { t } = usePreferences();
  // The layout's places, drawn closer together: on a board the gaps between plates would dwarf the parts.
  const feet = useMemo(() => new Map(layout.plates.map(({ id, rect }) => {
    const w = rect.w * FOOT, d = rect.h * DEPTH, cx = (rect.x + rect.w / 2) * PACK_X, cy = (rect.y + rect.h / 2) * PACK_Y;
    return [id, { x: cx - w / 2, y: cy - d / 2, w, d }];
  })), [layout]);
  const board = useMemo(() => {
    const all = [...feet.values()];
    const x0 = Math.min(...all.map(f => f.x)) - 30, y0 = Math.min(...all.map(f => f.y)) - 30;
    return { x: x0, y: y0, w: Math.max(...all.map(f => f.x + f.w)) + 30 - x0, d: Math.max(...all.map(f => f.y + f.d)) + 30 - y0 };
  }, [feet]);
  // The view box: the board's own corners (they mix the extremes of different parts), raised for the tallest shape and its label.
  const box = useMemo(() => {
    const corners = [[board.x, board.y], [board.x + board.w, board.y], [board.x, board.y + board.d], [board.x + board.w, board.y + board.d]];
    const xs = corners.map(([x, y]) => iso(x, y)[0]), ys = corners.flatMap(([x, y]) => [iso(x, y, 0)[1], iso(x, y, 130)[1]]);
    return { x: Math.min(...xs) - 16, y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 32, h: Math.max(...ys) - Math.min(...ys) + 16 };
  }, [board]);
  // Labels keep a readable size on screen however small the board is drawn: their size is set in screen pixels.
  const svg = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setScale(Math.min(r.width / box.w, r.height / box.h)); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  const px = (size: number) => size / Math.max(scale, 0.2);
  // Painter's order: what stands further back is drawn first.
  const order = useMemo(() => [...feet.entries()].sort(([, a], [, b]) => (a.x + a.w / 2 + a.y + a.d / 2) - (b.x + b.w / 2 + b.y + b.d / 2)).map(([id]) => id), [feet]);
  return <svg ref={svg} className={`object-sheet${mini ? ' mini' : ''}`} aria-hidden={mini || undefined} style={{ '--name': `${px(13)}px`, '--small': `${px(11)}px` } as CSSProperties} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={t.d.sheetLabel(title)}>
    <Box f={{ ...board, h: BOARD_H }} z={0} c={{ top: 'var(--obj-board)', front: 'var(--obj-board-side)', side: 'var(--obj-board-side)' }}/>
    {joints.map((j, i) => {
      if (reading?.hidden?.has(i)) return null;
      const a = feet.get(j.from), b = feet.get(j.to);
      if (!a || !b) return null;
      return <g key={i} className={reading?.current?.has(i) ? 'reading-current' : undefined}><JointLine joint={j} from={a} to={b} label={!mini}/></g>;
    })}
    {order.map(id => {
      const part = parts.find(p => p.id === id)!, f = feet.get(id)!, mark = reading?.plates[id];
      if (mark === 'unread') return <g key={id} className="plate unread" data-id={id} aria-hidden="true"><Ring f={f} className="object-outline"/></g>;
      if (mini) return <g key={id} className={`plate${here === id ? ' here' : ''}${mark ? ` read-${mark}` : ''}`} data-id={id} aria-hidden="true">
        {here === id && <Ring f={{ x: f.x - 12, y: f.y - 12, w: f.w + 24, d: f.d + 24 }} className="object-here"/>}
        <g transform={`translate(0 ${-BOARD_H})`}><ShapeBody shape={shapeOf(part)} f={{ ...f, h: HEIGHT[shapeOf(part)] }} c={{ top: mark ? 'var(--obj-top-marked)' : 'var(--obj-top)', front: 'var(--obj-front)', side: 'var(--obj-side)', accent: 'var(--obj-accent)' }}/></g></g>;
      const shape = shapeOf(part), h = HEIGHT[shape], number = numbering.get(id);
      const accent = mark === 'added' || mark === 'cited' ? 'var(--active)' : mark === 'deepened' ? 'var(--story)' : 'var(--obj-accent)';
      const c: Colors = { top: mark ? 'var(--obj-top-marked)' : 'var(--obj-top)', front: 'var(--obj-front)', side: 'var(--obj-side)', accent };
      const lines = wrap(part.name, 20, 2), lh = px(15);
      const [lx, ly] = iso(f.x + f.w / 2, f.y + f.d / 2, BOARD_H + h + 34);
      const cls = ['plate', part.parts && 'assembly', selected === id && 'selected', mark && `read-${mark}`].filter(Boolean).join(' ');
      return <g key={id} className={cls} data-id={id} data-shape={shape} role="button" tabIndex={0} aria-pressed={selected === id}
        aria-label={`${number ? `${number}. ` : ''}${part.name} · ${t.d.kinds[part.kind]}${mark ? ` · ${t.d.guided.marks[mark]}` : ''}`}
        onClick={() => onSelect?.(id)} onDoubleClick={() => part.parts && onEnter?.(id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id); } }}>
        {selected === id && <Ring f={{ x: f.x - 8, y: f.y - 8, w: f.w + 16, d: f.d + 16 }} className="object-selected"/>}
        {here === id && <Ring f={{ x: f.x - 14, y: f.y - 14, w: f.w + 28, d: f.d + 28 }} className="object-here"/>}
        {part.parts && <Ring f={{ x: f.x - 4, y: f.y - 4, w: f.w + 8, d: f.d + 8 }} className="object-assembly"/>}
        <g transform={`translate(0 ${-BOARD_H})`}><ShapeBody shape={shape} f={{ ...f, h }} c={c}/></g>
        <text className="object-name" x={lx} y={ly - (lines.length - 1) * lh} textAnchor="middle" lang={language}>
          {lines.map((line, i) => <tspan key={i} x={lx} dy={i ? lh : 0}>{i === 0 && number ? `${number}. ` : ''}{line}</tspan>)}
        </text>
        {part.parts && <text className="object-sub" x={lx} y={ly + px(14)} textAnchor="middle">⊕ {t.d.subParts(part.parts.length)}</text>}
        {mark && <g className={`reading-mark m-${mark}`} aria-hidden="true" transform={`translate(${lx} ${ly - (lines.length - 1) * lh - px(26)}) scale(${px(1)})`}>
          <circle r={9}/><text y={4} textAnchor="middle">{{ added: '+', deepened: '↺', cited: '•' }[mark]}</text></g>}
      </g>;
    })}
  </svg>;
}

// ---- Isometric geometry: board units are the layout's pixels. ----
const BOARD_H = 10;
/**
 * Footprint width and depth as shares of a plate, and how much closer the places come along each axis. Across, the
 * layout's gaps are wide and close up; in depth, shapes rise and would cover the part behind, so places keep their distance.
 */
const FOOT = 0.6, DEPTH = 0.7, PACK_X = 0.62, PACK_Y = 1;
const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * 0.866, (x + y) * 0.5 - z];
const pts = (...ps: [number, number, number][]) => ps.map(p => iso(...p).map(v => v.toFixed(1)).join(',')).join(' ');
interface Foot { x: number; y: number; w: number; d: number }
interface Colors { top: string; front: string; side: string; accent?: string }
const HEIGHT: Record<Shape, number> = { beam: 46, pillar: 30, foundation: 12, clamp: 26, wedge: 26, field: 10, aside: 14, marker: 12, figure: 12,
  cycle: 26, register: 24, tape: 24, switch: 24, comparator: 26, gauge: 34, conveyor: 14, chamber: 40, block: 24 };

function Box({ f, z, c }: { f: Foot & { h: number }; z: number; c: Colors }) {
  const { x, y, w, d, h } = f, top = z + h;
  return <g className="object-box">
    <polygon points={pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, top], [x, y + d, top])} fill={c.front}/>
    <polygon points={pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, top], [x + w, y, top])} fill={c.side}/>
    <polygon points={pts([x, y, top], [x + w, y, top], [x + w, y + d, top], [x, y + d, top])} fill={c.top}/>
  </g>;
}
function Ellipse({ cx, cy, z, r, fill }: { cx: number; cy: number; z: number; r: number; fill: string }) {
  const [X, Y] = iso(cx, cy, z);
  return <ellipse cx={X} cy={Y} rx={r * 1.2247} ry={r * 0.7071} fill={fill}/>;
}
function Cylinder({ cx, cy, z, r, h, c }: { cx: number; cy: number; z: number; r: number; h: number; c: Colors }) {
  const [X, Yb] = iso(cx, cy, z), Yt = Yb - h, rx = r * 1.2247, ry = r * 0.7071;
  return <g className="object-box"><path d={`M${X - rx},${Yb} A${rx},${ry} 0 0 0 ${X + rx},${Yb} L${X + rx},${Yt} L${X - rx},${Yt} Z`} fill={c.front}/>
    <Ellipse cx={cx} cy={cy} z={z + h} r={r} fill={c.top}/></g>;
}
function Ring({ f, className }: { f: Foot; className: string }) {
  return <polygon className={className} points={pts([f.x, f.y, BOARD_H], [f.x + f.w, f.y, BOARD_H], [f.x + f.w, f.y + f.d, BOARD_H], [f.x, f.y + f.d, BOARD_H])}/>;
}
const Line = ({ a, b, className, width = 2 }: { a: [number, number, number]; b: [number, number, number]; className?: string; width?: number }) => {
  const [x1, y1] = iso(...a), [x2, y2] = iso(...b);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={className ?? 'object-detail'} strokeWidth={width}/>;
};

/** What the part does, said by its form. Every line here belongs to the shape, never to a relation. */
function ShapeBody({ shape, f, c }: { shape: Shape; f: Foot & { h: number }; c: Colors }) {
  const { x, y, w, d, h } = f, cx = x + w / 2, cy = y + d / 2, r = Math.min(w, d) / 2;
  const dark: Colors = { top: 'var(--obj-dark)', front: 'var(--obj-dark)', side: 'var(--obj-dark)' };
  switch (shape) {
    case 'cycle': return <g>
      <Box f={{ x, y, w, d, h: 6 }} z={0} c={c}/><Cylinder cx={cx} cy={cy} z={6} r={r - 6} h={h - 6} c={c}/>
      <Ellipse cx={cx} cy={cy} z={h + 0.5} r={(r - 6) * 0.55} fill="var(--obj-front)"/>
      {[0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return <Ellipse key={i} cx={cx + Math.cos(a) * (r - 6) * 0.8} cy={cy + Math.sin(a) * (r - 6) * 0.8} z={h + 1} r={4} fill={c.accent!}/>; })}
    </g>;
    case 'register': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/><Box f={{ x: x + 12, y: y + 12, w: w - 24, d: d - 24, h: 1 }} z={h} c={dark}/>
      {[0, 1, 2, 3].map(i => <Box key={i} f={{ x: x + 20 + i * (w - 40) / 4, y: cy - 3, w: (w - 40) / 6, d: 6, h: 1 }} z={h + 1} c={{ top: c.accent!, front: c.accent!, side: c.accent! }}/>)}
    </g>;
    case 'tape': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/>
      <Cylinder cx={x + w * 0.3} cy={cy} z={h} r={Math.min(18, d / 3)} h={6} c={c}/><Ellipse cx={x + w * 0.3} cy={cy} z={h + 6} r={5} fill={c.accent!}/>
      <Cylinder cx={x + w * 0.72} cy={cy} z={h} r={Math.min(18, d / 3)} h={6} c={c}/><Ellipse cx={x + w * 0.72} cy={cy} z={h + 6} r={5} fill={c.accent!}/>
      <Line a={[x + w * 0.3, cy + Math.min(18, d / 3), h + 6]} b={[x + w * 0.72, cy + Math.min(18, d / 3), h + 6]}/>
    </g>;
    case 'switch': { const [bx, by] = iso(cx, cy, h + 4); return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/><Box f={{ x: x + w * 0.35, y: y + d * 0.3, w: w * 0.3, d: d * 0.4, h: 3 }} z={h} c={dark}/>
      <line x1={bx} y1={by} x2={bx + 16} y2={by - 24} className="object-detail" strokeWidth={4}/><circle cx={bx + 16} cy={by - 24} r={6} fill={c.accent}/>
    </g>; }
    case 'comparator': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/>
      <Box f={{ x: x + 18, y: cy - 8, w: 16, d: 16, h: 28 }} z={h} c={{ ...c, top: c.accent! }}/><Box f={{ x: x + w - 34, y: cy - 8, w: 16, d: 16, h: 14 }} z={h} c={c}/>
      <Line a={[x + 26, cy, h + 28]} b={[x + w - 26, cy, h + 14]} width={1.6}/>
    </g>;
    case 'gauge': { const [X, Y] = iso(cx - 8, cy, h + 1); return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/><Ellipse cx={cx - 8} cy={cy} z={h + 0.5} r={Math.min(w, d) * 0.3} fill="var(--obj-top)"/>
      {[0, 1, 2, 3, 4, 5, 6].map(i => { const a = Math.PI * (1.1 + i * 0.13); return <line key={i} x1={X + Math.cos(a) * 26} y1={Y + Math.sin(a) * 15} x2={X + Math.cos(a) * 33} y2={Y + Math.sin(a) * 19} className="object-detail" strokeWidth={1.4}/>; })}
      <line x1={X} y1={Y} x2={X + 22} y2={Y - 12} stroke={c.accent} strokeWidth={3} strokeLinecap="round"/>
      {['var(--ok)', 'var(--active)', 'var(--fail)'].map((fill, i) => <Ellipse key={i} cx={x + w - 18} cy={y + 16 + i * (d - 32) / 2} z={h + 1} r={6} fill={fill}/>)}
    </g>; }
    case 'conveyor': return <g>
      <Box f={{ x, y: y + d * 0.25, w, d: d * 0.5, h }} z={0} c={c}/>
      {[0.15, 0.4, 0.65, 0.9].map((u, i) => <Line key={i} a={[x + w * u, y + d * 0.25, h]} b={[x + w * u, y + d * 0.75, h]} width={1.2}/>)}
      <Line a={[x + w * 0.2, cy, h + 1]} b={[x + w * 0.8, cy, h + 1]} className="object-flow" width={3}/>
    </g>;
    case 'chamber': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/><Box f={{ x: x + w * 0.3, y: y + d - 1, w: w * 0.4, d: 1, h: h * 0.6 }} z={0} c={dark}/>
      <Box f={{ x: x + w * 0.2, y: y + d * 0.2, w: w * 0.6, d: d * 0.6, h: 6 }} z={h} c={{ ...c, top: c.accent! }}/>
    </g>;
    case 'beam': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/><Box f={{ x: x - 8, y: y + d * 0.2, w: w + 16, d: d * 0.6, h: 10 }} z={h} c={{ ...c, top: c.accent! }}/>
    </g>;
    case 'pillar': return <g>
      <Box f={{ x, y, w, d, h: 8 }} z={0} c={c}/><Cylinder cx={cx} cy={cy} z={8} r={r - 14} h={h + 18} c={c}/>
      <Ellipse cx={cx} cy={cy} z={h + 26} r={r - 14} fill={c.accent!}/>
    </g>;
    case 'foundation': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={c}/>
      {[1, 2, 3].map(i => <Line key={i} a={[x + i * w / 4, y, h]} b={[x + i * w / 4, y + d, h]} width={1}/>)}<Line a={[x, cy, h]} b={[x + w, cy, h]} width={1}/>
    </g>;
    case 'clamp': return <g>
      <Box f={{ x, y, w, d, h: 8 }} z={0} c={c}/>
      <Box f={{ x: x + 10, y: y + 10, w: 14, d: d - 20, h: h + 14 }} z={8} c={c}/><Box f={{ x: x + w - 24, y: y + 10, w: 14, d: d - 20, h: h + 14 }} z={8} c={c}/>
      <Box f={{ x: x + 10, y: y + 10, w: w - 20, d: d - 20, h: 7 }} z={h + 22} c={{ ...c, top: c.accent! }}/>
    </g>;
    case 'wedge': return <g className="object-box">
      <polygon points={pts([x, y + d, 0], [x + w, y + d, 0], [x + w, cy, h + 12], [x, cy, h + 12])} fill={c.front}/>
      <polygon points={pts([x + w, y + d, 0], [x + w, y, 0], [x + w, cy, h + 12])} fill={c.side}/>
      <polygon points={pts([x, y, 0], [x + w, y, 0], [x + w, cy, h + 12], [x, cy, h + 12])} fill={c.top}/>
      <Line a={[x, cy, h + 12]} b={[x + w, cy, h + 12]} className="object-edge-accent" width={2.4}/>
    </g>;
    case 'field': return <g>
      <Box f={{ x, y, w, d, h }} z={0} c={{ ...c, top: 'var(--obj-field)' }}/>
      {[[0.25, 0.3], [0.6, 0.25], [0.45, 0.7]].map(([u, v], i) => <g key={i}><Cylinder cx={x + w * u} cy={y + d * v} z={h} r={6} h={10} c={c}/><Ellipse cx={x + w * u} cy={y + d * v} z={h + 10} r={6} fill={c.accent!}/></g>)}
    </g>;
    case 'aside': return <g className="object-aside">
      <Box f={{ x, y, w, d, h }} z={0} c={{ top: 'var(--obj-front)', front: 'var(--obj-side)', side: 'var(--obj-side)' }}/>
      <Line a={[x + 18, y + 14, h]} b={[x + w - 18, y + d - 14, h]} width={2.4}/><Line a={[x + w - 18, y + 14, h]} b={[x + 18, y + d - 14, h]} width={2.4}/>
    </g>;
    case 'marker': { const [px, py] = iso(cx, cy, h); return <g>
      <Box f={{ x, y: y + d * 0.35, w, d: d * 0.3, h: 4 }} z={0} c={c}/><Box f={{ x: cx - 18, y: cy - 18, w: 36, d: 36, h }} z={0} c={c}/>
      <line x1={px} y1={py} x2={px} y2={py - 38} className="object-detail" strokeWidth={2}/><polygon points={`${px},${py - 38} ${px + 22},${py - 31} ${px},${py - 24}`} fill={c.accent}/>
    </g>; }
    case 'figure': { const [hx, hy] = iso(cx, cy, h + 30); return <g>
      <Box f={{ x, y, w, d, h: 6 }} z={0} c={c}/><Cylinder cx={cx} cy={cy} z={6} r={Math.min(16, r - 8)} h={h + 14} c={c}/>
      <circle cx={hx} cy={hy - 4} r={10} fill={c.accent} className="object-head"/>
    </g>; }
    default: return <Box f={f} z={0} c={c}/>;
  }
}

/** A joint between two footprints, at board level, drawn by its kind; colour is never the only sign. */
function JointLine({ joint, from, to, label = true }: { joint: Joint; from: Foot; to: Foot; label?: boolean }) {
  const center = (f: Foot): [number, number] => [f.x + f.w / 2, f.y + f.d / 2];
  const a0 = center(from), b0 = center(to), a = leave(from, b0, a0), b = leave(to, a0, b0);
  const [x1, y1] = iso(a[0], a[1], BOARD_H), [x2, y2] = iso(b[0], b[1], BOARD_H);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
  const head = <polygon className="object-joint-head" points={`${x2},${y2} ${x2 - ux * 11 - nx * 5},${y2 - uy * 11 - ny * 5} ${x2 - ux * 11 + nx * 5},${y2 - uy * 11 + ny * 5}`}/>;
  const bar = <line x1={x2 + nx * 9} y1={y2 + ny * 9} x2={x2 - nx * 9} y2={y2 - ny * 9} className="object-joint-line" strokeWidth={3.4}/>;
  let body: ReactElement;
  switch (joint.type) {
    case 'supports': body = <g>{[3, -3].map(o => <line key={o} x1={x1 + nx * o} y1={y1 + ny * o} x2={x2 + nx * o} y2={y2 + ny * o} className="object-joint-line solid" pathLength={1}/>)}{bar}</g>; break;
    case 'attacks': body = <g><line x1={x1} y1={y1} x2={x2} y2={y2} className="object-joint-line attack" strokeDasharray="7 5"/>
      <polygon className="object-joint-head attack" points={`${x2},${y2} ${x2 - ux * 14 - nx * 7},${y2 - uy * 14 - ny * 7} ${x2 - ux * 9},${y2 - uy * 9} ${x2 - ux * 14 + nx * 7},${y2 - uy * 14 + ny * 7}`}/></g>; break;
    case 'limits': body = <g><line x1={x1} y1={y1} x2={x2} y2={y2} className="object-joint-line" strokeDasharray="2 4"/>{bar}</g>; break;
    case 'depends-on': body = <g><line x1={x1} y1={y1} x2={x2} y2={y2} className="object-joint-line" strokeDasharray="3 4"/>{head}</g>; break;
    case 'leads-to': body = <g>{[2.5, -2.5].map(o => <line key={o} x1={x1 + nx * o} y1={y1 + ny * o} x2={x2 + nx * o} y2={y2 + ny * o} className="object-joint-line thin"/>)}
      {Array.from({ length: Math.max(1, Math.floor(len / 14)) }, (_, i) => { const k = (i + 0.5) * 14 / len; const px = x1 + (x2 - x1) * k, py = y1 + (y2 - y1) * k;
        return <line key={i} x1={px + nx * 5} y1={py + ny * 5} x2={px - nx * 5} y2={py - ny * 5} className="object-joint-line thin"/>; })}{head}</g>; break;
    case 'because': body = <g><circle cx={x1} cy={y1} r={4} className="object-joint-head"/><line x1={x1} y1={y1} x2={x2} y2={y2} className="object-joint-line solid" pathLength={1}/>{head}</g>; break;
    default: body = <g><line x1={x1} y1={y1} x2={x2} y2={y2} className="object-joint-line solid" pathLength={1}/>{head}</g>;
  }
  return <g className={`joint t-${joint.type}`} data-joint={`${joint.from}>${joint.to}`}>
    {body}{label && <text className="object-joint-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">{joint.label}</text>}
  </g>;
}
/** Where the segment from `inside` toward `toward` leaves the footprint. */
function leave(f: Foot, toward: [number, number], inside: [number, number]): [number, number] {
  const dx = toward[0] - inside[0], dy = toward[1] - inside[1];
  let k = 1;
  if (dx) for (const edge of [f.x, f.x + f.w]) { const s = (edge - inside[0]) / dx, o = inside[1] + s * dy; if (s > 0 && s < k && o >= f.y && o <= f.y + f.d) k = s; }
  if (dy) for (const edge of [f.y, f.y + f.d]) { const s = (edge - inside[1]) / dy, o = inside[0] + s * dx; if (s > 0 && s < k && o >= f.x && o <= f.x + f.w) k = s; }
  return [inside[0] + dx * k, inside[1] + dy * k];
}
