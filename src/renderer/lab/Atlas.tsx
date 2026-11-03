import { useId, useMemo } from 'react';
import { atlasLayout } from '../../core/atlas';
import { usePreferences } from '../preferences';
import { wrap } from '../disassembly/Sheet';
import { blob, cable, edgeOf, Label, labelBox, P, Pills, Plateau, pressable, Ring, useScreenScale, viewBox, type Obstacle, type Pill } from './cabinet';
import { markClass, type DrawingProps } from './Bench';

/**
 * The atlas (P-20261103-lab-mode L6): a source drawn as nested regions. A region per top-level part; its sub-parts
 * lie inside its perimeter, so the perimeter means "contains". Relations are arrows from perimeter to perimeter.
 * Distance and size mean nothing, and no relation is given a physics.
 */
const Z = 10, H = 22, KID_H = 9;
/** A load run in the atlas suspends a region: it is drawn as an outline, and its target says what happens to its supports (L12). */
export interface Suspension { part: string; target: string; tag: string }
export function AtlasDrawing({ d, selected, onSelect, onEnter, open, mini = false, quiet = false, built = () => true, jointShown = () => true, onJoint, selectedJoint, marks = {}, currentJoint = () => false, suspended }: DrawingProps & { suspended?: Suspension }) {
  const { t } = usePreferences(), marker = useId().replace(/:/g, ''), words = !mini && !quiet;
  const regions = useMemo(() => atlasLayout(d.parts, d.joints), [d]);
  const byId = useMemo(() => new Map(regions.map(r => [r.id, { r, outline: blob(r.id, r.cx, r.cy, r.rx, r.ry), kids: r.kids.map(k => ({ ...k, outline: blob(k.id, k.cx, k.cy, k.rx, k.ry, 14) })) }])), [regions]);
  const box = useMemo(() => viewBox([...byId.values()].flatMap(({ outline }) => outline.flatMap(([x, y]) => [P(x, y, 0), P(x, y, Z + H + 40)])), mini ? 8 : 28), [byId, mini]);
  const { ref, px } = useScreenScale(box);
  // regions further back are painted first
  const order = [...regions].sort((a, b) => b.cy - a.cy);
  const pills: Pill[] = [], nameAt = (r: typeof regions[number]) => P(r.cx, r.cy + (r.kids.length ? r.ry * 0.62 : 0), Z + H);
  const nameOf = (r: typeof regions[number]) => wrap(d.parts.find(x => x.id === r.id)!.name, r.kids.length ? 34 : 18, 3);
  const apartAt = (r: typeof regions[number]) => P(r.cx, r.cy - r.ry * 0.45, Z + H);
  const tagAt = (r: typeof regions[number]) => P(r.cx, r.cy + r.ry * 0.95, Z + H + 18), target = suspended && regions.find(r => r.id === suspended.target);
  // the target's tag stands just above its name: one obstacle for both, so a pill cannot settle between them
  const union = (a: Obstacle, b: Obstacle): Obstacle => { const x0 = Math.min(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.max(a.x + a.w / 2, b.x + b.w / 2), y0 = Math.min(a.y - a.h / 2, b.y - b.h / 2), y1 = Math.max(a.y + a.h / 2, b.y + b.h / 2);
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }; };
  const obstacles = !words ? [] : regions.filter(r => built(r.id) && open !== r.id).map(r => {
    const name = labelBox(nameAt(r), nameOf(r), px(12.5));
    return r === target ? union(name, labelBox(tagAt(r), [suspended!.tag], px(12))) : r.apart ? union(name, labelBox(apartAt(r), [t.d.lab.noJoint], px(10))) : name;
  });
  const arrows = mini ? [] : d.joints.flatMap((j, i) => {
    if (!jointShown(i) || open === j.from || open === j.to) return [];
    const A = byId.get(j.from)!.r, B = byId.get(j.to)!.r, c = cable(P(...edgeOf(A, B), Z + H), P(...edgeOf(B, A), Z + H), 26);
    pills.push({ key: `${j.from}>${j.to}`, at: c.mid, text: j.label, className: `t-${j.type}${selectedJoint === i ? ' sel' : ''}`, onPress: onJoint && (() => onJoint(i)) });
    return [<g key={i} className={`lab-arrow t-${j.type}${selectedJoint === i ? ' sel' : ''}${currentJoint(i) ? ' reading-current' : ''}${suspended?.part === j.from || suspended?.part === j.to ? ' suspended' : ''}`} data-joint={`${j.from}>${j.to}`}><path className="wire" d={c.d} markerEnd={`url(#${marker}-${j.type})`}/></g>];
  });
  return <svg ref={ref} className={`lab-sheet lab-atlas${mini ? ' mini' : ''}`} viewBox={box} preserveAspectRatio="xMidYMid meet" role="group" aria-label={t.d.lab.atlasLabel(d.whole.name)} aria-hidden={mini || undefined}>
    <defs>{[...new Set(d.joints.map(j => j.type))].map(k => <marker key={k} id={`${marker}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path className={`lab-head t-${k}`} d="M0,0 L10,5 L0,10 z"/></marker>)}</defs>
    {order.map(({ id }) => {
      const { r, outline, kids } = byId.get(id)!, p = d.parts.find(x => x.id === id)!;
      if (open === id && !mini) return <g key={id} data-id={id}><Ring outline={outline} z={Z} className="lab-socket"/></g>;
      if (!built(id)) return <g key={id} data-id={id} data-unread="" aria-hidden="true"><Ring outline={outline} z={Z} className="lab-ghost"/></g>;
      const named = kids.length <= 3, label = [p.name, t.d.kinds[p.kind], kids.length && t.d.subParts(kids.length), r.apart && t.d.lab.noJoint].filter(Boolean).join(' · ');
      const press = mini ? {} : pressable(label, () => onSelect?.(id), selected === id);
      return <g key={id} className={`lab-part lab-region${selected === id ? ' sel' : ''}${r.apart ? ' apart' : ''}${p.parts ? ' assembly' : ''}${markClass(marks[id])}${suspended?.part === id ? ' suspended' : ''}`} data-id={id} {...press} onDoubleClick={() => p.parts && onEnter?.(id)}>
        <Plateau outline={outline} z={Z} h={H}/>
        {kids.map(k => <g key={k.id} data-kid={k.id}><Plateau outline={k.outline} z={Z + H} h={KID_H} className="kid"/>
          {words && named && <Label at={P(k.cx, k.cy, Z + H + KID_H)} lines={wrap(d.parts.find(x => x.id === id)!.parts!.find(q => q.id === k.id)!.name, 14, 3)} size={px(10)} className="lab-kid-name" lang={d.language}/>}</g>)}
        {words && <Label at={nameAt(r)} lines={nameOf(r)} size={px(12.5)} className="lab-name" lang={d.language}/>}
        {words && kids.length > 0 && !named && <Label at={P(r.cx, r.cy - r.ry * 0.62, Z + H)} lines={[t.d.subParts(kids.length)]} size={px(10)} className="lab-sub"/>}
        {words && suspended?.target === id && <Label at={tagAt(r)} lines={[suspended.tag]} size={px(12)} className="lab-tag"/>}
        {words && r.apart && <Label at={apartAt(r)} lines={[t.d.lab.noJoint]} size={px(10)} className="lab-sub"/>}
      </g>;
    })}
    {arrows}
    {words && <Pills pills={pills} px={px} obstacles={obstacles}/>}
  </svg>;
}
