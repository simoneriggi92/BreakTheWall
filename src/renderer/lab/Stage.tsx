import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { atlasLayout } from '../../core/atlas';
import { benchLayout, flowOrder } from '../../core/bench';
import { allParts, type Disassembly, type Joint, type Part } from '../../core/disassembly';
import type { RepresentationChoice } from '../../core/representation';
import { AtlasDrawing, type Suspension } from './Atlas';
import { BenchDrawing, type DrawingProps, type ReadMark } from './Bench';
import { OpenedBench, OpenedRegion, type FacePick } from './Opened';
import { f1, pts, type Pt } from './cabinet';

/** The whole, drawn as the representation the metaphor test chose (L8): the bench for an object, the atlas otherwise. */
export function WholeDrawing({ choice, suspended, ...props }: DrawingProps & { choice: RepresentationChoice; suspended?: Suspension }) {
  return choice.view === 'object' ? <BenchDrawing {...props} choice={choice}/> : <AtlasDrawing {...props} suspended={suspended}/>;
}

/** Where the part at the other end of an outer joint stands, seen from the opened part, in the level they share. */
function towardsIn(d: Disassembly, view: RepresentationChoice['view'], level: { parts: Part[]; joints: Joint[] }, depth: number, from: string) {
  if (depth === 0 && view === 'object') {
    const m = benchLayout(d.parts, d.joints).modules, c = (id: string) => [m[id].x + m[id].w / 2, m[id].y + m[id].d / 2];
    return (other: string) => { const [ax, ay] = c(from), [bx, by] = m[other] ? c(other) : [ax + 1, ay]; return { side: bx < ax ? 'left' as const : 'right' as const, angle: Math.atan2(by - ay, bx - ax) }; };
  }
  if (depth === 0) {
    const r = new Map(atlasLayout(d.parts, d.joints).map(x => [x.id, x]));
    return (other: string) => { const a = r.get(from)!, b = r.get(other) ?? a, angle = Math.atan2(b.cy - a.cy, b.cx - a.cx || 1); return { side: Math.cos(angle) < 0 ? 'left' as const : 'right' as const, angle }; };
  }
  // below the whole, siblings stand in flow order: what comes before is on the left
  const order = flowOrder(level.parts.map(p => p.id), level.joints);
  return (other: string) => { const left = order.indexOf(other) < order.indexOf(from); return { side: left ? 'left' as const : 'right' as const, angle: left ? Math.PI : 0 }; };
}

export interface StageProps {
  d: Disassembly; choice: RepresentationChoice;
  /** The parts opened from the whole down. */
  path: string[]; selected?: string; onSelect: (id: string) => void; onEnter: (id: string) => void;
  /** A press on the strip: on one of its parts, or on the strip itself (`id` undefined). */
  onUpper: (depth: number, id?: string) => void;
  selectedFace?: string; onFace: (pick: FacePick) => void; selectedJoint?: number; onJoint: (index: number) => void;
  built: (id: string) => boolean; jointShown: (index: number) => boolean; currentJoint: (index: number) => boolean;
  /** Reading marks for the whole, and for an opened level. */
  marks: Record<string, ReadMark>; levelMarks: (parts: Part[]) => Record<string, ReadMark>;
  suspended?: Suspension; motion?: 'opening' | 'returning';
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
type Box = { x: number; y: number; w: number; h: number };
const rel = (r: DOMRect, o: DOMRect): Box => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });

/**
 * L9: opening a part lifts it out of the whole. The level it belongs to sinks to a strip at the bottom, with the
 * part's place outlined; the opened level takes the space above; a beam joins the place to the level. The level
 * moves from the place to its own (FLIP: measure both, start at the first, play to the last), and closing plays the
 * part back into its place. Under "reduce motion" nothing moves.
 */
export function LabStage({ d, choice, path, selected, onSelect, onEnter, onUpper, selectedFace, onFace, selectedJoint, onJoint, built, jointShown, currentJoint, marks, levelMarks, suspended, motion }: StageProps) {
  const host = useRef<HTMLDivElement>(null), last = useRef<Box | undefined>(undefined), [beam, setBeam] = useState<Pt[]>();
  const find = (id: string) => allParts(d).find(x => x.part.id === id)!.part;
  const levelOf = (depth: number) => depth ? { parts: find(path[depth - 1]).parts ?? [], joints: find(path[depth - 1]).joints ?? [] } : { parts: d.parts, joints: d.joints };
  const open = path.at(-1), depth = path.length;
  const towards = useMemo(() => open ? towardsIn(d, choice.view, levelOf(depth - 1), depth - 1, open) : () => ({ side: 'right' as const, angle: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, choice.view, path]);
  const opened = (part: Part, at: number, props: { open?: string; marks: Record<string, ReadMark>; onSelect: (id: string) => void; selected?: string; quiet?: boolean }) => {
    const around = levelOf(at).joints, t = at === depth - 1 ? towards : towardsIn(d, choice.view, levelOf(at), at, part.id);
    return choice.view === 'object'
      ? <OpenedBench d={d} part={part} outer={around} towards={t} selectedFace={selectedFace} onFace={onFace} {...props}/>
      : <OpenedRegion d={d} part={part} outer={around} towards={t} {...props}/>;
  };
  const whole = (lifted: boolean) => <WholeDrawing d={d} choice={choice} open={lifted ? open : undefined} built={built} jointShown={jointShown} currentJoint={currentJoint}
    marks={marks} selected={lifted ? undefined : selected} onSelect={lifted ? id => onUpper(0, id) : onSelect} onEnter={lifted ? undefined : onEnter}
    selectedJoint={lifted ? undefined : selectedJoint} onJoint={lifted ? undefined : onJoint} suspended={suspended} quiet={lifted}/>;

  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const frame = el.getBoundingClientRect(), box = (q: string) => { const r = el.querySelector(q)?.getBoundingClientRect(); return r && rel(r, frame); };
    const L = box('.guided-level.focus'), T = box('.guided-level.focus .lab-tray') ?? L, S = open ? box(`.guided-level.upper [data-id="${CSS.escape(open)}"]`) : undefined;
    // the beam: from the opened tray's lower edge down to the place it was lifted from
    setBeam(T && S && T.w && S.w ? [[T.x, T.y + T.h], [T.x + T.w, T.y + T.h], [S.x + S.w, S.y], [S.x, S.y]] : undefined);
    // the level in focus plays from where it came from: the part's place when opening, the strip when returning
    const target = el.querySelector<HTMLElement>('.guided-level.focus'), from = motion === 'opening' ? S : last.current;
    if (motion && target && typeof target.animate === 'function' && !reducedMotion()) {
      target.animate(from && L && from.w && L.w
        ? [{ transform: `translate(${f1(from.x - L.x)}px, ${f1(from.y - L.y)}px) scale(${f1(from.w / L.w * 100) / 100})`, opacity: 0.35 }, { transform: 'none', opacity: 1 }]
        : [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    }
    last.current = box('.guided-level.upper');
  }, [path, motion, open]);

  if (!open) return <div ref={host} className="lab-stage">
    <div className="guided-level focus" data-depth={0}>{whole(false)}</div>
  </div>;
  const part = find(open);
  return <div ref={host} className={`lab-stage lifted${motion ? ` ${motion}` : ''}`}>
    <div className="guided-level focus" data-depth={depth}>
      {opened(part, depth - 1, { marks: levelMarks(part.parts ?? []), onSelect, selected })}
    </div>
    <svg className="lab-beam" aria-hidden="true">{beam && <polygon points={pts(beam)}/>}</svg>
    <div className="guided-level upper lab-strip" data-depth={depth - 1}
      onClick={e => { if (!(e.target as Element).closest('.lab-part')) onUpper(depth - 1); }}>
      {depth === 1 ? whole(true) : opened(find(path[depth - 2]), depth - 2, { open, marks: {}, onSelect: id => onUpper(depth - 1, id), selected: open, quiet: true })}
    </div>
  </div>;
}
