import { useId, useMemo, type ReactNode } from 'react';
import { kidsOf } from '../../core/atlas';
import { flowOf, openedLayout, BENCH } from '../../core/bench';
import { allParts, linesOf, type Disassembly, type Joint, type Part } from '../../core/disassembly';
import { faceOf, type Face, type FaceItem } from '../../core/faces';
import { usePreferences } from '../preferences';
import { PartIcon, wrap } from '../disassembly/Sheet';
import { blob, Box, cable, charsFor, edgeOf, f1, Label, labelBox, onFront, onTop, P, Pills, Plateau, pressable, pts, Ring, useScreenScale, viewBox, type Pill, type Pt } from './cabinet';
import { markClass, type ReadMark } from './Bench';

/**
 * Opened levels (P-20261103-lab-mode L7). A bench module opens into components whose faces come from the sub-parts'
 * own lines (src/core/faces.ts); a part with no structure stays a plain module. A region opens into sub-regions inside
 * its perimeter. Joints that leave the level run towards the side of the part they reach. Each face element is a
 * button whose press hands over the lines it comes from.
 */
export interface FacePick { part: string; index: number; item: FaceItem }
interface OpenedProps {
  d: Disassembly; part: Part; selected?: string; onSelect?: (id: string) => void;
  selectedFace?: string; onFace?: (pick: FacePick) => void;
  /** Where the part at the other end of an outer joint stands, seen from the opened part. */
  towards: (other: string) => { side: 'left' | 'right'; angle: number };
  /** The joints of the level the part stands in: those that reach it leave this level. The whole's by default. */
  outer?: Joint[];
  /** A sub-part lifted out of this level (L9): its place stays outlined. */
  open?: string;
  marks?: Record<string, ReadMark>;
  /** In the strip: no names and no joint labels, which would crowd it. */
  quiet?: boolean;
}
const BASE = 20, W = BENCH.minW, D = 66, WIDE_DIALS = 52;
const shared = (d: Pick<Disassembly, 'sources'>, a: Part['cites'], b: Part['cites'] = []) => { const s = linesOf(d, b); return [...linesOf(d, a)].some(l => s.has(l)); };
const nameOf = (d: Disassembly, id: string) => allParts(d).find(x => x.part.id === id)?.part.name ?? id;
const fit = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

/** One band of a face per item: pressable, with a mark that says what kind of thing it is. */
function Rows({ part, face, w, top, selectedFace, onFace, mark }: { part: Part; face: Face; w: number; top: number; selectedFace?: string; onFace?: (p: FacePick) => void; mark: (it: FaceItem, v: number) => ReactNode }) {
  const shown = face.items.slice(0, 7);
  return <>{shown.map((it, i) => { const key = `${part.id}#${i}`, v = top + i * 15;
    return <g key={key} className={`lab-face-item${selectedFace === key ? ' sel' : ''}${it.warn ? ' warn' : ''}`} data-face={key} {...pressable(it.label, () => onFace?.({ part: part.id, index: i, item: it }), selectedFace === key)}>
      <rect className="lab-face-band" x={4} y={v} width={w - 8} height={13} rx={2}/>{mark(it, v + 6.5)}<text className="lab-face-text" x={20} y={v + 9.6}>{fit(it.label, Math.floor((w - 28) / 4.7))}</text></g>; })}
    {face.items.length > shown.length && <text className="lab-face-more" x={w - 6} y={top - 4} textAnchor="end">+{face.items.length - shown.length}</text>}</>;
}
const MARK: Partial<Record<Face['face'], (it: FaceItem, v: number) => ReactNode>> = {
  drawers: (_, v) => <rect className="lab-handle" x={6} y={v - 1.5} width={9} height={3} rx={1.5}/>,
  dials: (_, v) => <><circle className="lab-dial" cx={11} cy={v} r={5.4}/><line className="lab-needle" x1={11} y1={v} x2={14} y2={v - 3}/></>,
  // a rack: one peg per method of the group, empty when the source marks the row ⚠ (nobody calls it)
  holders: (it, v) => <><rect className="lab-handle" x={6} y={v - 1.5} width={9} height={3} rx={1.5}/>{(it.rows ?? []).slice(0, 5).map((r, k) => <circle key={k} className={r.warn ? 'lab-peg empty' : 'lab-peg'} cx={100 + k * 9} cy={v} r={3.2}/>)}</>,
  sheets: (_, v) => <path className="lab-sheet-mark" d={`M7.5,${v - 4.5} h5 l2,2 v7 h-7 Z`}/>,
  notes: (it, v) => <circle className={it.warn ? 'lab-pin warn' : 'lab-pin'} cx={11} cy={v} r={3.2}/>,
  warnings: (_, v) => <path className="lab-warn" d={`M11,${v - 4.5} L15.6,${v + 3.8} L6.4,${v + 3.8} Z`}/>,
  legend: (it, v) => <circle className={it.warn ? 'lab-pin warn' : 'lab-pin'} cx={11} cy={v} r={3.2}/>,
  sockets: (_, v) => <><circle className="lab-dark" cx={11} cy={v} r={4.2}/><circle className="lab-hole" cx={9.5} cy={v} r={0.9}/><circle className="lab-hole" cx={12.5} cy={v} r={0.9}/></>,
  lenses: (_, v) => <><circle className="lab-lens" cx={10} cy={v - 1} r={3}/><line className="lab-needle" x1={12.2} y1={v + 1.2} x2={14.6} y2={v + 3.6}/></>,
  knobs: (_, v) => <><circle className="lab-knob" cx={11} cy={v} r={4.4}/><line className="lab-needle" x1={11} y1={v} x2={11} y2={v - 3.6}/></>,
  checks: (it, v) => <rect className={it.warn ? 'lab-check warn' : 'lab-check'} x={7.2} y={v - 3.8} width={7.6} height={7.6} rx={1}/>,
};

/** A sub-part as the component its face asks for; the height it stands at is returned for the cables. */
function subComponent({ part, x, y, z, w, face, selectedFace, onFace }: { part: Part; x: number; y: number; z: number; w: number; face?: Face; selectedFace?: string; onFace?: (p: FacePick) => void }): { node: ReactNode; h: number } {
  const z0 = z + BASE;
  if (!face) return { node: <g data-component="module"><Box x={x} y={y} z={z0} w={w} d={D} h={46} m={part.kind === 'step' ? 'steel' : part.kind === 'artifact' ? 'ivory' : 'alu'}/>
    <g transform={onFront(x, y, z0 + 46)}><rect className="lab-dark" x={8} y={9} width={26} height={26} rx={5}/><g className="lab-glyph"><PartIcon name={part.icon} size={18} x={12} y={13}/></g></g></g>, h: 46 };
  const n = Math.min(7, face.items.length), rowsH = 22 + n * 15;
  switch (face.face) {
    case 'wheel': {   // a turntable: one station per numbered step, in order from the marked one
      const H = 26, r = D / 2 - 6, steps = face.items.slice(0, 16);
      return { h: H, node: <g data-component="wheel"><Box x={x} y={y} z={z0} w={w} d={D} h={H} m="steel"/>
        <g transform={onTop(x, y + D, z0 + H)}><circle className="lab-dark" cx={w / 2} cy={D / 2} r={r + 3}/><circle className="lab-track" cx={w / 2} cy={D / 2} r={r}/>
          {steps.map((it, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / steps.length, key = `${part.id}#${k}`;
            return <circle key={key} data-face={key} className={`lab-station${k ? '' : ' first'}${selectedFace === key ? ' sel' : ''}`} cx={f1(w / 2 + (r - 5) * Math.cos(a))} cy={f1(D / 2 + (r - 5) * Math.sin(a))} r={4} {...pressable(it.label, () => onFace?.({ part: part.id, index: k, item: it }), selectedFace === key)}/>; })}
        </g></g> };
    }
    case 'screen': {  // code as a screen of lines: the shape of the code, not its text
      const lines = face.items.slice(0, 12), H = 26 + lines.length * 5.2;
      return { h: 12 + H, node: <g data-component="screen"><Box x={x} y={y} z={z0} w={w} d={D} h={12} m="dark"/><Box x={x + 10} y={y + D - 16} z={z0 + 12} w={w - 20} d={10} h={H} m="dark"/>
        <g transform={onFront(x + 10, y + D - 16, z0 + 12 + H)}><rect className="lab-screen" x={0} y={0} width={w - 20} height={H}/>
          {lines.map((c, k) => { const indent = (c.label.match(/^\s*/)?.[0].length ?? 0) * 2.2; return <rect key={k} className={/←|⚠/.test(c.label) ? 'lab-code warn' : 'lab-code'} x={8 + indent} y={10 + k * 5.2} width={f1(Math.min(w - 40 - indent, 8 + c.label.trim().length * 1.5))} height={2.6} rx={1}/>; })}</g></g> };
    }
    case 'cards': {   // a card index: one card per entry; an entry the source marks ⚠ has an amber card
      const H = 30, k = Math.min(12, face.items.length), warn = face.items.filter(i => i.warn).length;
      return { h: H + 25, node: <g data-component="cards"><Box x={x} y={y} z={z0} w={w} d={D} h={H} m="steel"/>
        {Array.from({ length: k }, (_, i) => <Box key={i} x={x + 14 + i * 10.4} y={y + 12} z={z0 + H} w={3.2} d={D - 24} h={16 + (i % 3) * 3} m={face.items[Math.floor(i * face.items.length / k)].warn ? 'amber' : 'ivory'}/>)}
        <g transform={onFront(x, y, z0 + H)}><text className="lab-face-text" x={8} y={18}><tspan className="strong">{face.items.length}</tspan> · <tspan className="warn">⚠ {warn}</tspan></text></g></g> };
    }
    case 'drawers': case 'holders': case 'sheets': case 'notes': {   // a cabinet, a rack or a file box: one band per item on its front
      const m = face.face === 'holders' ? 'steel' : 'ivory', H = rowsH;
      return { h: H, node: <g data-component={face.face}><Box x={x} y={y} z={z0} w={w} d={D} h={H} m={m}/>
        {face.face === 'sheets' && face.items.slice(0, 6).map((_, k) => <Box key={k} x={x + 12} y={y + 10 + k * ((D - 20) / Math.min(6, face.items.length))} z={z0 + H} w={w - 24} d={1.6} h={9 + (k % 2) * 4} m="ivory"/>)}
        <g transform={onFront(x, y, z0 + H)}><Rows part={part} face={face} w={w} top={10} selectedFace={selectedFace} onFace={onFace} mark={MARK[face.face]!}/></g></g> };
    }
    default: {        // an upright panel on a base: dials, warnings, a legend, sockets, lenses, knobs or checks
      const H = rowsH, pw = w - 12, panel = face.face === 'warnings' ? 'amber' : face.face === 'knobs' || face.face === 'sockets' ? 'steel' : 'ivory';
      return { h: 12 + H, node: <g data-component={face.face}><Box x={x} y={y} z={z0} w={w} d={D} h={12} m="dark"/><Box x={x + 6} y={y + D - 18} z={z0 + 12} w={pw} d={12} h={H} m={panel}/>
        <g transform={onFront(x + 6, y + D - 18, z0 + 12 + H)}><Rows part={part} face={face} w={pw} top={10} selectedFace={selectedFace} onFace={onFace} mark={MARK[face.face]!}/></g></g> };
    }
  }
}

export function OpenedBench({ d, part, selected, onSelect, selectedFace, onFace, towards, outer: around = d.joints, open, marks = {}, quiet = false }: OpenedProps) {
  const { t } = usePreferences(), marker = useId().replace(/:/g, '');
  const subs = part.parts ?? [], joints = part.joints ?? [];
  const faces = useMemo(() => new Map(subs.map(q => [q.id, faceOf(d, q)])), [d, subs]);
  const placed = useMemo(() => openedLayout(subs, joints, id => W + (faces.get(id)?.face === 'dials' ? WIDE_DIALS : 0)), [subs, joints, faces]);
  const at = new Map(placed.map(p => [p.id, p]));
  const drawn = new Map(subs.map(q => { const p = at.get(q.id)!; return [q.id, subComponent({ part: q, x: p.x, y: p.y, z: p.z, w: p.w, face: faces.get(q.id), selectedFace, onFace })]; }));
  const X0 = Math.min(...placed.map(p => p.x)) - 18, X1 = Math.max(...placed.map(p => p.x + p.w)) + 18, Y0 = Math.min(...placed.map(p => p.y)) - 18, Y1 = Math.max(...placed.map(p => p.y)) + D + 18;
  const outer = around.filter(j => j.from === part.id || j.to === part.id);
  const box = useMemo(() => viewBox([P(X0 - 60, Y0 - 30, 0), P(X1 + 60, Y0 - 30, 0), P(X0, Y1, 0), P(X1, Y1, 0),
    ...placed.flatMap(p => [P(p.x, p.y + D, p.z + BASE + (drawn.get(p.id)?.h ?? 46) + 60), P(p.x + p.w, p.y, p.z + BASE + (drawn.get(p.id)?.h ?? 46) + 40)])], 24), [X0, X1, Y0, Y1, placed, drawn]);
  const { ref, px } = useScreenScale(box);
  const pills: Pill[] = [], top = (id: string) => { const p = at.get(id)!; return p.z + BASE + (drawn.get(id)?.h ?? 46); };
  const nameAt = (p: typeof placed[number]) => P(p.x + p.w / 2, p.y + D, top(p.id) + 12);   // above the back edge, clear of every face
  const obstacles = placed.map(p => labelBox(nameAt(p), wrap(subs.find(s => s.id === p.id)!.name, charsFor(subs.find(s => s.id === p.id)!.name, p.w, px, 12), 3), px(12)));
  const inner = joints.map((j, i) => {
    const [u, v] = flowOf(j), a = at.get(u)!, b = at.get(v)!, A = P(a.x + a.w * 0.75, a.y + D / 2, top(u)), B = P(b.x + b.w * 0.25, b.y + D / 2, top(v)), c = cable(A, B, 28);
    pills.push({ key: `${j.from}>${j.to}`, at: c.mid, text: j.label, className: `t-${j.type}` });
    return <g key={`i${i}`} className={`lab-cable t-${j.type}`} data-joint={`${j.from}>${j.to}`}><path className="under" d={c.d}/><path className="wire" d={c.d} markerEnd={`url(#${marker}-${j.type})`}/></g>;
  });
  // a joint that leaves the level starts at the sub-part citing the same lines and runs along the tray's front lip
  const stubs = outer.flatMap((j, i) => {
    const other = j.from === part.id ? j.to : j.from, q = subs.find(s => shared(d, s.cites, j.cites)); if (!q) return [];
    const p = at.get(q.id)!, { side } = towards(other), lane = Y0 - 8 - (i % 3) * 7, cx = p.x + p.w * (side === 'left' ? 0.3 : 0.7), out = flowOf(j)[0] === part.id;
    const route: Pt[] = [P(cx, p.y, p.z + BASE + 2), P(cx, lane, BASE + 1), P(side === 'left' ? X0 - 26 : X1 + 26, lane, BASE + 1)];
    const path = (out ? route : [...route].reverse()).map((pt, k) => `${k ? 'L' : 'M'}${f1(pt[0])},${f1(pt[1])}`).join(' ');
    const name = fit(nameOf(d, other), 20), text = out ? `→ ${name}` : `${name} →`;
    pills.push({ key: `o${i}`, at: [route[2][0] + (side === 'left' ? 1 : -1) * px(text.length * 3.2 + 8), route[2][1] + px(14)], text, className: `t-${j.type} outer` });
    return [<g key={`o${i}`} className={`lab-cable t-${j.type} outer`} data-joint={`${j.from}>${j.to}`}><path className="wire" d={path} markerEnd={`url(#${marker}-${j.type})`}/></g>];
  });
  const order = [...placed].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  return <svg ref={ref} className="lab-sheet lab-opened" viewBox={box} preserveAspectRatio="xMidYMax meet" role="group" aria-label={t.d.lab.openedLabel(part.name)}>
    <defs>{[...new Set([...joints, ...outer].map(j => j.type))].map(k => <marker key={k} id={`${marker}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path className={`lab-head t-${k}`} d="M0,0 L10,5 L0,10 z"/></marker>)}</defs>
    <g className="lab-tray" data-tray={part.id} {...pressable(part.name, () => onSelect?.(part.id), selected === part.id)}>
      <Box x={X0} y={Y0} z={0} w={X1 - X0} d={Y1 - Y0} h={BASE} m="dark"/><polygon className="lab-tray-edge" points={pts([P(X0, Y0, BASE), P(X1, Y0, BASE), P(X1, Y1, BASE), P(X0, Y1, BASE)])}/></g>
    {order.map(p => { const q = subs.find(s => s.id === p.id)!;
      if (open === q.id) return <polygon key={p.id} className="lab-socket" data-id={q.id} points={pts([P(p.x, p.y, p.z + BASE), P(p.x + p.w, p.y, p.z + BASE), P(p.x + p.w, p.y + D, p.z + BASE), P(p.x, p.y + D, p.z + BASE)])}/>;
      return <g key={p.id}>{p.z > 0 && <Box x={p.x - 6} y={p.y - 6} z={BASE} w={p.w + 12} d={D + 12} h={p.z} m="steel"/>}
        <g className={`lab-part${selected === q.id ? ' sel' : ''}${q.parts ? ' assembly' : ''}${markClass(marks[q.id])}`} data-id={q.id} data-face-kind={faces.get(q.id)?.face ?? 'none'} {...pressable([q.name, t.d.kinds[q.kind]].join(' · '), () => onSelect?.(q.id), selected === q.id)}>
          {drawn.get(p.id)!.node}{!quiet && <Label at={nameAt(p)} lines={wrap(q.name, charsFor(q.name, p.w, px, 12), 3)} size={px(12)} className="lab-name" lang={d.language}/>}</g></g>; })}
    {inner}{stubs}{!quiet && <Pills pills={pills} px={px} obstacles={obstacles}/>}
  </svg>;
}

export function OpenedRegion({ d, part, selected, onSelect, towards, outer: around = d.joints, open, marks = {}, quiet = false }: Omit<OpenedProps, 'selectedFace' | 'onFace'>) {
  const { t } = usePreferences(), marker = useId().replace(/:/g, '');
  const subs = part.parts ?? [], n = subs.length, rows = n > 3 ? 2 : 1, cols = Math.ceil(n / rows);
  // the view compresses depth to a third: the region is deeper than wide, and more than three sub-regions take two rows
  const A = { cx: 0, cy: 0, rx: 120 + cols * 100, ry: rows === 1 ? 300 : 430 }, outline = useMemo(() => blob(part.id, A.cx, A.cy, A.rx, A.ry, 24), [part.id, A.rx, A.ry]);
  const kids = useMemo(() => kidsOf(subs, A).map(k => ({ ...k, outline: blob(k.id, k.cx, k.cy, k.rx, k.ry, 16) })), [subs, A.rx, A.ry]);
  // room on both sides for the labels of the joints that leave the perimeter
  const box = useMemo(() => viewBox([...outline.flatMap(([x, y]) => [P(x, y, 0), P(x, y, 60)]), P(-A.rx - 330, 0, 0), P(A.rx + 330, 0, 0)], 24), [outline, A.rx]);
  const { ref, px } = useScreenScale(box);
  const pills: Pill[] = [], K = new Map(kids.map(k => [k.id, k]));
  const inner = (part.joints ?? []).map((j, i) => { const a = K.get(j.from)!, b = K.get(j.to)!, c = cable(P(...edgeOf(a, b), 32), P(...edgeOf(b, a), 32), 24);
    pills.push({ key: `${j.from}>${j.to}`, at: c.mid, text: j.label, className: `t-${j.type}` });
    return <g key={`i${i}`} className={`lab-arrow t-${j.type}`} data-joint={`${j.from}>${j.to}`}><path className="wire" d={c.d} markerEnd={`url(#${marker}-${j.type})`}/></g>; });
  // relations with the rest of the atlas leave the perimeter towards the region they reach
  const stubs = around.filter(j => j.from === part.id || j.to === part.id).map((j, i) => {
    const other = j.from === part.id ? j.to : j.from, { angle } = towards(other), e: [number, number] = [A.rx * Math.cos(angle), A.ry * Math.sin(angle)], o: [number, number] = [(A.rx + 70) * Math.cos(angle), (A.ry + 120) * Math.sin(angle)];
    const out = j.from === part.id, [a, b] = out ? [P(...e, 16), P(...o, 16)] : [P(...o, 16), P(...e, 16)];
    const name = fit(nameOf(d, other), 22);
    pills.push({ key: `o${i}`, at: [P(...o, 16)[0], P(...o, 16)[1] - px(14)], text: out ? `${j.label} · ${name}` : `${name} · ${j.label}`, className: `t-${j.type} outer` });
    return <g key={`o${i}`} className={`lab-arrow t-${j.type} outer`} data-joint={`${j.from}>${j.to}`}><path className="wire" d={`M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}`} markerEnd={`url(#${marker}-${j.type})`}/></g>;
  });
  return <svg ref={ref} className="lab-sheet lab-opened lab-atlas" viewBox={box} preserveAspectRatio="xMidYMax meet" role="group" aria-label={t.d.lab.openedLabel(part.name)}>
    <defs>{[...new Set([...(part.joints ?? []), ...around].map(j => j.type))].map(k => <marker key={k} id={`${marker}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path className={`lab-head t-${k}`} d="M0,0 L10,5 L0,10 z"/></marker>)}</defs>
    <g className="lab-tray lab-region" data-tray={part.id} {...pressable(part.name, () => onSelect?.(part.id), selected === part.id)}>
      <Plateau outline={outline} z={0} h={16}/><Label at={P(A.cx, A.cy - A.ry * 0.74, 16)} lines={[part.name.toUpperCase()]} size={px(11)} className="lab-sub"/></g>
    {[...kids].sort((a, b) => b.cy - a.cy).map(k => { const q = subs.find(s => s.id === k.id)!;
      if (open === q.id) return <g key={k.id} data-id={q.id}><Ring outline={k.outline} z={16} className="lab-socket"/></g>;
      return <g key={k.id} className={`lab-part lab-region${selected === k.id ? ' sel' : ''}${q.parts ? ' assembly' : ''}${markClass(marks[q.id])}`} data-id={k.id} {...pressable([q.name, t.d.kinds[q.kind]].join(' · '), () => onSelect?.(k.id), selected === k.id)}>
        <Plateau outline={k.outline} z={16} h={16}/>{!quiet && <Label at={P(k.cx, k.cy, 32)} lines={wrap(q.name, 16, 3)} size={px(11.5)} className="lab-name" lang={d.language}/>}</g>; })}
    {inner}{stubs}{!quiet && <Pills pills={pills} px={px}/>}
  </svg>;
}
