import { useId, useMemo } from 'react';
import { benchLayout, flowOf, type Module } from '../../core/bench';
import type { Disassembly, Part } from '../../core/disassembly';
import type { BenchComponent, RepresentationChoice } from '../../core/representation';
import { usePreferences } from '../preferences';
import { PartIcon, wrap } from '../disassembly/Sheet';
import { Box, cable, charsFor, f1, Label, labelBox, onFront, onTop, P, Pills, pressable, pts, useScreenScale, viewBox, type Pill, type Pt } from './cabinet';

/**
 * The bench (P-20261103-lab-mode L5): a mechanism drawn as an object. Each top-level part stands on the bench as the
 * component the metaphor test gave it; the cables are the joints. Every label is a part's name or a joint's label,
 * and nothing shows a value the source does not give.
 */
export const BZ = 24;
export interface DrawingProps {
  d: Disassembly; selected?: string; onSelect?: (id: string) => void; onEnter?: (id: string) => void;
  /** The part lifted out of the whole: its place stays outlined. */
  open?: string;
  /** The minimap: the same drawing, small, with no labels and nothing to press. */
  mini?: boolean;
  /** The strip under a lifted part: the same drawing, pressable, without the words that would crowd it. */
  quiet?: boolean;
  /** Progressive building: a part not yet read is an outline, a joint not yet related is not drawn. */
  built?: (id: string) => boolean; jointShown?: (index: number) => boolean;
  onJoint?: (index: number) => void; selectedJoint?: number;
  /** What the step being read does to each part (G2), and the joints it relates; `here` marks the opened part on the minimap. */
  marks?: Record<string, ReadMark>; currentJoint?: (index: number) => boolean;
}
export type ReadMark = 'added' | 'deepened' | 'cited' | 'here';
export const markClass = (m?: ReadMark) => m ? ` read-${m}` : '';

const caveats = (p: Part) => (p.points ?? []).filter(x => x.mark === 'caveat').length;
/** How tall each whole component stands, so cables land on its top. */
function heightOf(c: BenchComponent | undefined, p: Part, incoming: number): number {
  switch (c) {
    case 'round-track': return 34;
    case 'clock-register': return 64;
    case 'tape-printer': return 44;
    case 'key-switch': return 36;
    case 'relay': return 52;
    case 'control-panel': return 12 + 22 + Math.max(2, incoming) * 18;
    default: return p.parts?.length ? 46 : 58;
  }
}

/** A whole component inside its module's footprint. Each drawing says what the component does; none adds a relation. */
function Whole({ c, part, m, h, lights, mini }: { c: BenchComponent | undefined; part: Part; m: Module; h: number; lights: string[]; mini: boolean }) {
  switch (c) {
    case 'round-track': {   // an oval track: one station per step of the round, in order, the first marked
      const subs = part.parts ?? [], rx = m.w / 2 - 10, ry = m.d / 2 - 6, cx = m.w / 2, cy = m.d / 2;
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m="steel"/>
        <g transform={onTop(m.x, m.y + m.d, BZ + h)}>
          <ellipse className="lab-dark" cx={cx} cy={cy} rx={rx + 4} ry={ry + 4}/><ellipse className="lab-track" cx={cx} cy={cy} rx={rx} ry={ry}/>
          <ellipse className="lab-track-inner" cx={cx} cy={cy} rx={rx - 20} ry={Math.max(6, ry - 20)}/>
        </g>
        {/* one post per station, standing on the track so that it reads in depth; the first is marked */}
        {subs.map((q, k) => ({ q, k, a: Math.PI + k * 2 * Math.PI / subs.length })).sort((s1, s2) => Math.sin(s2.a) - Math.sin(s1.a)).map(({ q, k, a }) => {
          const u = cx + (rx - 12) * Math.cos(a), v = cy + (ry - 12) * Math.sin(a), wx = m.x + u - 6, wy = m.y + m.d - v - 6, [lx, ly] = P(wx + 6, wy, BZ + h + 18);
          return <g key={q.id} data-station={k + 1}><Box x={wx} y={wy} z={BZ + h} w={12} d={12} h={14} m={k ? 'ivory' : 'coral'}/>{!mini && <text className="lab-station-n" x={f1(lx)} y={f1(ly)} textAnchor="middle">{k + 1}</text>}</g>; })}
        </g>;
    }
    case 'clock-register':  // a register with a clock: it keeps a moment
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m="ivory"/>
        <g transform={onFront(m.x, m.y, BZ + h)}><rect className="lab-screen" x={12} y={14} width={m.w - 24} height={30} rx={4}/>
          <circle className="lab-clock" cx={30} cy={29} r={9}/><line className="lab-clock" x1={30} y1={29} x2={30} y2={23}/><line className="lab-clock" x1={30} y1={29} x2={35} y2={31}/></g></g>;
    case 'tape-printer':    // a tape printer: one line per event
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m="steel"/><Box x={m.x + 24} y={m.y + m.d * 0.45} z={BZ + h} w={m.w - 48} d={3} h={44} m="ivory"/>
        <g transform={onFront(m.x + 24, m.y + m.d * 0.45, BZ + h + 44)}>{[0, 1, 2, 3, 4].map(k => <line key={k} className="lab-ink" x1={8} y1={8 + k * 7} x2={m.w - 64 - (k % 2) * 30} y2={8 + k * 7}/>)}</g>
        <g transform={onFront(m.x, m.y, BZ + h)}><rect className="lab-dark" x={20} y={18} width={m.w - 40} height={5} rx={2}/></g></g>;
    case 'key-switch':      // a key switch: it opens or closes a passage
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m="dark"/>
        <g transform={onFront(m.x, m.y, BZ + h)}><circle className="lab-knob" cx={22} cy={18} r={12}/><rect className="lab-key" x={20} y={8} width={4} height={13} rx={1.5}/></g></g>;
    case 'relay':           // a relay with a dial: it reads one value and acts past a threshold
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m="alu"/>
        <g transform={onFront(m.x, m.y, BZ + h)}><circle className="lab-dial" cx={30} cy={26} r={12}/><path className="lab-threshold" d="M30,26 L30,15 A11,11 0 0 1 40,22 Z"/><line className="lab-needle" x1={30} y1={26} x2={22} y2={19}/></g></g>;
    case 'control-panel': { // a control panel: one light for each joint that reaches it, named by that joint
      const ph = h - 12;
      return <g data-component={c}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={12} m="dark"/><Box x={m.x + 6} y={m.y + m.d - 16} z={BZ + 12} w={m.w - 12} d={12} h={ph} m="ivory"/>
        <g transform={onFront(m.x + 6, m.y + m.d - 16, BZ + 12 + ph)}>{lights.map((l, k) => <g key={k} data-light={k + 1}><circle className="lab-light" cx={16} cy={24 + k * 18} r={6}/>{!mini && <text className="lab-face-text" x={28} y={27 + k * 18}>{l}</text>}</g>)}</g></g>;
    }
    default:                // a module of the library: its icon on the front, its sub-parts as small blocks on the lid
      return <g data-component={c ?? 'module'}><Box x={m.x} y={m.y} z={BZ} w={m.w} d={m.d} h={h} m={part.kind === 'step' ? 'steel' : part.kind === 'artifact' ? 'ivory' : 'alu'}/>
        {(part.parts ?? []).slice(0, 5).map((q, i) => <Box key={q.id} x={m.x + 14 + i * 50} y={m.y + 22} z={BZ + h} w={40} d={42} h={12} m={i % 2 ? 'steel' : 'glass'}/>)}
        {!mini && <g transform={onFront(m.x, m.y, BZ + h)}><rect className="lab-dark" x={8} y={8} width={26} height={26} rx={5}/><g className="lab-glyph"><PartIcon name={part.icon} size={18} x={12} y={12}/></g></g>}</g>;
  }
}

export function BenchDrawing({ d, choice, selected, onSelect, onEnter, open, mini = false, quiet = false, built = () => true, jointShown = () => true, onJoint, selectedJoint, marks = {}, currentJoint = () => false }: DrawingProps & { choice: RepresentationChoice }) {
  const { t } = usePreferences(), marker = useId().replace(/:/g, ''), words = !mini && !quiet;
  const lay = useMemo(() => benchLayout(d.parts, d.joints), [d]);
  const component = useMemo(() => new Map(choice.parts.flatMap(x => x.as === 'component' ? [[x.part, x.component] as const] : [])), [choice]);
  const geometry = useMemo(() => d.parts.map(p => {
    const lights = d.joints.filter(j => flowOf(j)[1] === p.id).map(j => j.label);
    return { p, m: lay.modules[p.id], c: component.get(p.id), lights, h: heightOf(component.get(p.id), p, lights.length) };
  }), [d, lay, component]);
  const top = new Map(geometry.map(g => [g.p.id, g]));
  const A = lay.area;
  const box = useMemo(() => viewBox([P(A.x, A.y, 0), P(A.x + A.w, A.y, 0), P(A.x, A.y + A.d, 0), P(A.x + A.w, A.y + A.d, 0),
    ...geometry.flatMap(g => [P(g.m.x, g.m.y + g.m.d, BZ + g.h + 70), P(g.m.x + g.m.w, g.m.y, BZ + g.h + 50)])], mini ? 8 : 24), [A, geometry, mini]);
  const { ref, px } = useScreenScale(box);
  const order = [...geometry].sort((a, b) => (b.m.y - a.m.y) || (a.m.x - b.m.x));
  const pills: Pill[] = [], nameAt = (g: typeof geometry[number]) => P(g.m.x + g.m.w / 2, g.m.y + g.m.d, BZ + g.h + 14);   // above the back edge, so it never covers a front face
  const obstacles = !words ? [] : geometry.filter(g => built(g.p.id) && open !== g.p.id).map(g => labelBox(nameAt(g), wrap(g.p.name, charsFor(g.p.name, g.m.w, px, 13), 3), px(13)));
  const cables = mini ? [] : d.joints.flatMap((j, i) => {
    if (!jointShown(i) || open === j.from || open === j.to) return [];
    // a joint is drawn from the step that relates it, even to a part still outlined: it then lands on the footprint
    const [u, v] = flowOf(j), a = top.get(u)!, b = top.get(v)!, at = (g: typeof a) => built(g.p.id) ? BZ + g.h + 6 : BZ;
    const from = P(a.m.x + a.m.w * 0.62, a.m.y + a.m.d / 2, at(a)), to = P(b.m.x + b.m.w * 0.38, b.m.y + b.m.d / 2, at(b)), c = cable(from, to, 40);
    pills.push({ key: `${j.from}>${j.to}`, at: c.mid, text: j.label, className: `t-${j.type}${selectedJoint === i ? ' sel' : ''}`, onPress: onJoint && (() => onJoint(i)) });
    return [<g key={i} className={`lab-cable t-${j.type}${selectedJoint === i ? ' sel' : ''}${currentJoint(i) ? ' reading-current' : ''}`} data-joint={`${j.from}>${j.to}`}>
      <path className="under" d={c.d}/><path className="wire" d={c.d} markerEnd={`url(#${marker}-${j.type})`}/><circle className="lab-plug" cx={f1(from[0])} cy={f1(from[1])} r={3.2}/></g>];
  });
  return <svg ref={ref} className={`lab-sheet lab-bench${mini ? ' mini' : ''}`} viewBox={box} preserveAspectRatio="xMidYMid meet" role="group" aria-label={t.d.lab.benchLabel(d.whole.name)} aria-hidden={mini || undefined}>
    <defs>{(['sends-to', 'causes', 'depends-on'] as const).map(k => <marker key={k} id={`${marker}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path className={`lab-head t-${k}`} d="M0,0 L10,5 L0,10 z"/></marker>)}</defs>
    <Box x={A.x} y={A.y} z={0} w={A.w} d={A.d} h={10} m="dark"/><Box x={A.x} y={A.y} z={10} w={A.w} d={A.d} h={14} m="alu"/>
    {order.map(({ p, m, c, h, lights }) => {
      const foot: Pt[] = [P(m.x, m.y, BZ), P(m.x + m.w, m.y, BZ), P(m.x + m.w, m.y + m.d, BZ), P(m.x, m.y + m.d, BZ)];
      if (open === p.id && !mini) return <polygon key={p.id} className="lab-socket" points={pts(foot)} data-id={p.id}/>;
      if (!built(p.id)) return <polygon key={p.id} className="lab-ghost" points={pts(foot)} data-id={p.id} data-unread="" aria-hidden="true"/>;
      const n = caveats(p), name = wrap(p.name, charsFor(p.name, m.w, px, 13), 3), label = [p.name, t.d.kinds[p.kind], c && t.d.lab.components[c], n && t.d.lab.caveats(n)].filter(Boolean).join(' · ');
      const press = mini ? {} : pressable(label, () => onSelect?.(p.id), selected === p.id);
      return <g key={p.id} className={`lab-part${selected === p.id ? ' sel' : ''}${p.parts ? ' assembly' : ''}${markClass(marks[p.id])}`} data-id={p.id} {...press} onDoubleClick={() => p.parts && onEnter?.(p.id)}>
        <Whole c={c} part={p} m={m} h={h} lights={lights} mini={!words}/>
        {words && <Label at={nameAt({ p, m, c, h, lights })} lines={name} size={px(13)} className="lab-name" lang={d.language}/>}
        {words && n > 0 && <g className="lab-note" aria-hidden="true" transform={`translate(${f1(P(m.x + m.w - 8, m.y, BZ + h + 8)[0])},${f1(P(m.x + m.w - 8, m.y, BZ + h + 8)[1])})`}>
          <rect x={-px(15)} y={-px(9)} width={px(30)} height={px(17)} rx={px(8)}/><text y={px(4)} textAnchor="middle" style={{ fontSize: px(10) }}>⚠ {n}</text></g>}
      </g>;
    })}
    {cables}
    {words && <Pills pills={pills} px={px} obstacles={obstacles}/>}
  </svg>;
}
