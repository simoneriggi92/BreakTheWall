import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { ExplorationPart } from '../../core/exploration';
import { jointGeometry, placeLabels, type Layout, type Strip, type Way } from '../../core/exploration-layout';
import type { LevelLink } from '../../core/exploration-levels';
import { usePreferences } from '../preferences';
import type { Shaped, Tone } from './model';

/**
 * One level drawn (plan P-20261105-exploration X12, X15): blocks as buttons, the layer strips, islands for closed
 * nuclei, the joints with their basis in the stroke, and each joint's label: a short tag with an arrow the way the
 * joint runs, in the hue of the block that acts. Pointing at a label marks "who" and "to whom"; a chosen block lights
 * its joints; a label can be dragged or moved with the arrow keys, tied to its joint by a dashed leader, and a click or
 * Enter on it chooses its link (X21).
 */
export type NodeState = { sel?: boolean; near?: boolean; fresh?: boolean; lit?: boolean; done?: boolean; quiet?: boolean; opened?: boolean; faded?: boolean; premise?: boolean };
export type Members = { list: { id: string; name: string; does: string }[]; open: boolean; sel?: string | null; noun: 'roles' | 'components'; lifted?: boolean };
export type StripState = 'active' | 'seen' | 'next' | 'premise';

export const NODE = 46, MEMBER_ROW = 21;
/** A block's height: taller when it shows its components in place. */
export const heightOf = (members: number, open: boolean) => open && members ? NODE + 26 + members * MEMBER_ROW : NODE + (members ? 18 : 0);

/** A label's key: the level it belongs to and its joint, so a moved label keeps its place across steps and sub-levels. */
export const labelKey = (level: string, l: Pick<LevelLink, 'from' | 'to' | 'class'>) => `${level}|${l.from}>${l.to}|${l.class}`;
/** A release this close to where the pointer went down is a click, not a move (X21): a tremor must not eat the click. */
export const CLICK_SLOP = 4;
const verbs = (l: LevelLink) => l.labels && l.labels.length > 1 ? l.labels : [l.label];
const sizeOf = (l: LevelLink, lit: boolean) => {
  const list = lit && verbs(l).length > 1, longest = list ? Math.max(...verbs(l).map(v => v.length)) + 4 : l.label.length + 2;
  return { w: Math.min(list ? 220 : 170, longest * 6.1 + 18), h: list ? verbs(l).length * 17 + 12 : 19, list };
};

interface Props {
  level: Shaped;
  layout: Layout;
  /** The level's key for moved labels: "top" or the aspect of a sub-level. */
  levelKey: string;
  visible: (id: string) => boolean;
  tone: (id: string) => Tone | null;
  nodeState: (id: string) => NodeState;
  members: (id: string) => Members | null;
  notes: (id: string) => ExplorationPart[];
  stripState: (s: Strip) => StripState;
  /** The block whose joints are lit, or none. */
  hot: string | null;
  /** Joints a question's step lights, when no block is chosen. */
  litJoint?: (l: LevelLink) => boolean;
  moved: Record<string, [number, number]>;
  onMove: (key: string, offset: [number, number] | null) => void;
  /** The link chosen on its label, if any; a click or Enter on a label chooses its link. */
  chosen?: (l: LevelLink) => boolean;
  onJoint?: (l: LevelLink) => void;
  onNode: (id: string) => void;
  onToggle: (id: string) => void;
  onMember: (id: string, member: string) => void;
  onIsland?: (nucleus: number) => void;
  names: (id: string) => string;
  className?: string;
  children?: ReactNode;
}

export function Graph(p: Props) {
  const { t } = usePreferences(), x = t.x;
  const marker = useId().replace(/:/g, '');
  const [pointing, setPointing] = useState<LevelLink | null>(null);
  const { layout: L, level } = p;
  const edges = level.level.links.filter(l => l.class !== 'group' && p.visible(l.from) && p.visible(l.to) && L.pos[l.from] && L.pos[l.to]);
  const hotOf = (l: LevelLink) => p.hot ? (l.from === p.hot || l.to === p.hot ? 'hot' : 'cold') : p.litJoint?.(l) ? 'hot' : '';
  const geometry = new Map(edges.map(l => [l, jointGeometry(L.pos[l.from], L.pos[l.to])]));
  const offsets = placeLabels(Object.values(L.pos), edges.map(l => {
    const key = labelKey(p.levelKey, l), { w, h } = sizeOf(l, hotOf(l) === 'hot');
    return { key, mid: geometry.get(l)!.mid, w, h, lit: hotOf(l) === 'hot', moved: p.moved[key] };
  }));
  const faded = (id: string) => !!p.nodeState(id).faded;
  const strip = (s: Strip) => s.premise ? x.structure.premise : x.structure.layer((s.layer ?? 0) + 1);

  return <div className={`xp-graph ${p.className ?? ''}`} style={{ width: L.width, height: L.height + 30 }} aria-label={x.structure.label}>
    <svg className="xp-edges" width={L.width} height={L.height + 30} aria-hidden="true">
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.6"/></marker></defs>
      {L.islands.filter(i => i.open).map(i => <rect key={`band-${i.nucleus}`} className="xp-band" x={i.x} y={i.y} width={i.w} height={i.h} rx={14}/>)}
      {L.strips.map((s, k) => <g key={`strip-${k}`} className="xp-strip-g">
        <rect className="xp-strip" data-state={s.ghost ? 'next' : p.stripState(s)} x={s.x} y={s.y} width={s.w} height={s.h} rx={9}/>
        <text className="xp-strip-label" data-state={s.ghost ? 'next' : p.stripState(s)} x={s.x + 8} y={s.y + s.h / 2 + 4}>{strip(s)}</text>
        {s.ghost && <text className="xp-strip-label" data-state="next" x={s.x + s.w / 2 + 16} y={s.y + s.h / 2 + 4} textAnchor="middle">{x.structure.ghost((s.layer ?? 0) + 1, s.count ?? 0)}</text>}
      </g>)}
      {edges.map(l => {
        const g = geometry.get(l)!, [x1, y1] = g.from, [x2, y2] = g.to;
        const d = Math.abs(y1 - y2) < 4 ? `M${x1},${y1}L${x2},${y2}` : `M${x1},${y1}C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
        const state = hotOf(l), fade = faded(l.from) && faded(l.to);
        return <path key={labelKey(p.levelKey, l)} d={d} markerEnd={`url(#${marker})`} data-joint={`${l.from}>${l.to}`} data-basis={l.basis} data-class={l.class}
          className={`xp-edge ${state ? `xp-${state}` : ''} ${fade ? 'xp-whole xp-faded' : ''}`}/>;
      })}
      {edges.map(l => {
        const key = labelKey(p.levelKey, l), mid = geometry.get(l)!.mid, off = offsets.get(key) ?? [0, 0], far = Math.hypot(off[0], off[1]) > 12;
        return far ? <g key={`lead-${key}`} className="xp-label-lead" data-for={key}>
          <line className="xp-label-leader" x1={mid[0]} y1={mid[1]} x2={mid[0] + off[0]} y2={mid[1] + off[1]}/>
          <circle className="xp-label-dot" r={2.4} cx={mid[0]} cy={mid[1]}/>
        </g> : null;
      })}
    </svg>
    {L.islands.filter(i => !i.open).map(i => {
      const n = level.shape.nuclei[i.nucleus];
      return <button key={`island-${i.nucleus}`} className="xp-island" style={{ left: i.x, top: i.y, width: i.w, height: i.h }} onClick={() => p.onIsland?.(i.nucleus)}>
        <b>{p.names(n.root)}</b><span>{x.structure.island(n.ids.length)}</span></button>;
    })}
    {Object.entries(L.pos).map(([id, box]) => {
      const part = level.parts.get(id); if (!part) return null;
      const s = p.nodeState(id), m = p.members(id), notes = p.notes(id), tone = p.tone(id);
      const role = part.kind === 'part' ? 'main' : part.kind === 'prerequisite' ? 'prerequisite' : part.kind === 'annotation' ? 'annotation' : 'aside';
      const classes = ['xp-node', s.sel && 'xp-sel', s.near && 'xp-near', s.fresh && 'xp-step', s.lit && 'xp-lit', s.done && 'xp-done', s.quiet && 'xp-quiet', s.opened && 'xp-opened', s.faded && 'xp-whole xp-faded', s.premise && 'xp-premise',
        pointing?.from === id && 'xp-who', pointing?.to === id && 'xp-whom', m?.list.length && 'xp-has-members', m?.open && 'xp-open'].filter(Boolean).join(' ');
      const key = (e: KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onNode(id); } };
      return <div key={id} data-id={id} data-role={role} data-tone={tone ?? undefined} className={classes} role="button" tabIndex={0} aria-pressed={!!s.sel}
        aria-label={part.name} style={{ left: box.x, top: box.y, width: box.w, minHeight: box.h }} onClick={() => p.onNode(id)} onKeyDown={key}>
        {pointing?.from === id && <span className="xp-badge" data-badge="who">{x.structure.who}</span>}
        {pointing?.to === id && <span className="xp-badge" data-badge="whom">{x.structure.whom}</span>}
        <span className="xp-kind">{part.kind === 'part' ? (m?.noun === 'roles' ? x.kinds.aspect : x.kinds.role) : x.kinds[part.kind]}</span>
        <span className="xp-name">{part.name}</span>
        {notes.length > 0 && <span className="xp-notes" title={notes.map(n => n.name).join(' · ')}>⚠ {notes[0].name}{notes.length > 1 ? ` +${notes.length - 1}` : ''}</span>}
        {m && m.list.length > 0 && <button className="xp-mcount" aria-expanded={!!(m.open || m.lifted)} aria-label={m.noun === 'roles' ? x.structure.toggleSub(part.name) : x.card.components(m.list.length)}
          onClick={e => { e.stopPropagation(); p.onToggle(id); }}>{m.open || m.lifted ? '▾' : '▸'} {m.noun === 'roles' ? x.structure.roles(m.list.length) : x.structure.components(m.list.length)}</button>}
        {m && m.open && !m.lifted && <div className="xp-members">{m.list.map(c => <button key={c.id} className={`xp-member ${m.sel === c.id ? 'xp-on' : ''}`} title={c.does}
          onClick={e => { e.stopPropagation(); p.onMember(id, c.id); }}>{c.name}</button>)}</div>}
        {m && !m.open && !m.lifted && m.list.length > 0 && <div className="xp-peek" aria-hidden="true"><b>{part.role}</b>{m.list.map(c => <span key={c.id}>{c.name}</span>)}</div>}
      </div>;
    })}
    {edges.map(l => {
      const key = labelKey(p.levelKey, l), g = geometry.get(l)!, off = offsets.get(key) ?? [0, 0], state = hotOf(l), { list } = sizeOf(l, state === 'hot');
      return <Label key={`label-${key}`} l={l} way={g.way} at={[g.mid[0] + off[0], g.mid[1] + off[1]]} off={off} list={list} state={state} faded={faded(l.from) && faded(l.to)}
        tone={p.tone(l.from)} names={p.names} hint={x.structure.labelHint}
        chosen={!!p.chosen?.(l)} onChoose={() => p.onJoint?.(l)}
        onMove={o => p.onMove(key, o)} onPoint={on => setPointing(on ? l : null)}/>;
    })}
    {p.children}
  </div>;
}

/** The arrow sits on the side the joint runs to, so the block at its tail is the one that acts. */
function Arrowed({ text, way, tone }: { text: string; way: Way; tone: Tone | null }) {
  const arrow = <span className="xp-way" data-tone={tone ?? undefined} data-way={way}>{way}</span>;
  return way === '←' || way === '↑' ? <>{arrow} {text}</> : <>{text} {arrow}</>;
}

function Label({ l, way, at, off, list, state, faded, tone, names, hint, chosen, onChoose, onMove, onPoint }: {
  l: LevelLink; way: Way; at: [number, number]; off: [number, number]; list: boolean; state: string; faded: boolean; tone: Tone | null;
  names: (id: string) => string; hint: string; chosen: boolean; onChoose: () => void;
  onMove: (offset: [number, number] | null) => void; onPoint: (on: boolean) => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number; from: [number, number]; now: [number, number] } | null>(null);
  const shownOff = drag?.now ?? off, place = drag ? [at[0] - off[0] + drag.now[0], at[1] - off[1] + drag.now[1]] : at;
  const who = (l.bonds?.length ? l.bonds : [{ from: l.from, label: l.label, to: l.to }]).map(b => `${names(b.from)} → ${b.label} → ${names(b.to)}`);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, from: off, now: off });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (drag) setDrag({ ...drag, now: [drag.from[0] + e.clientX - drag.x, drag.from[1] + e.clientY - drag.y] }); };
  // within the slop the release is a click: it chooses the link and leaves the label where it was
  // a cancelled pointer never chooses
  const up = (cancelled: boolean) => {
    if (!drag) return;
    const now = drag.now; setDrag(null);
    if (Math.hypot(now[0] - drag.from[0], now[1] - drag.from[1]) > CLICK_SLOP) onMove(now); else if (!cancelled) onChoose();
  };
  // while a label has focus, the arrows move it and never step the guide
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const by: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
    if (by[e.key]) { e.preventDefault(); e.stopPropagation(); onMove([shownOff[0] + by[e.key][0], shownOff[1] + by[e.key][1]]); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); onMove(null); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChoose(); }
  };
  return <div className={`xp-label ${state ? `xp-${state}` : ''} ${list ? 'xp-many' : ''} ${drag ? 'xp-drag' : ''} ${faded ? 'xp-whole xp-faded' : ''} ${chosen ? 'xp-chosen' : ''}`} data-joint={`${l.from}>${l.to}`} data-offset={`${Math.round(shownOff[0])},${Math.round(shownOff[1])}`}
    role="button" aria-pressed={chosen} tabIndex={0} title={[...who, hint].join('\n')} aria-label={who.join('; ')} style={{ left: place[0], top: place[1] }}
    onPointerDown={down} onPointerMove={move} onPointerUp={() => up(false)} onPointerCancel={() => up(true)} onClick={e => e.stopPropagation()} onDoubleClick={e => { e.stopPropagation(); onMove(null); }}
    onPointerEnter={() => onPoint(true)} onPointerLeave={() => onPoint(false)} onFocus={() => onPoint(true)} onBlur={() => onPoint(false)} onKeyDown={key}>
    {list ? <ul className="xp-bonds">{verbs(l).map((v, i) => <li key={i}><Arrowed text={v} way={way} tone={tone}/></li>)}</ul> : <Arrowed text={l.label} way={way} tone={tone}/>}
  </div>;
}
