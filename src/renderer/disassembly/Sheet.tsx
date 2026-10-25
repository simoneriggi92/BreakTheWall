import { Ban, BookOpen, ClipboardCheck, Code2, Cpu, Database, Download, FileText, Fingerprint, Flag, Funnel, Gauge, GitBranch, Hammer, KeyRound, Layers, ListChecks, Lock, Map, MessageCircle, Package, Play, Plug, Repeat, Rocket, RotateCcw, Ruler, Scale, Search, Send, Settings, ShieldCheck, Sprout, Timer, TriangleAlert, UserRound, Users } from 'lucide-react';
import { JOINT_FAMILY, type Joint, type Part } from '../../core/disassembly';
import type { LevelLayout, Point, Rect } from '../../core/layout';
import { usePreferences } from '../preferences';

const ICONS = {
  play: Play, 'list-checks': ListChecks, package: Package, rocket: Rocket, 'clipboard-check': ClipboardCheck, 'rotate-ccw': RotateCcw, lock: Lock, search: Search,
  layers: Layers, 'file-text': FileText, database: Database, send: Send, download: Download, timer: Timer, repeat: Repeat, filter: Funnel, 'key-round': KeyRound,
  fingerprint: Fingerprint, settings: Settings, plug: Plug, cpu: Cpu, gauge: Gauge, 'shield-check': ShieldCheck, 'triangle-alert': TriangleAlert, scale: Scale,
  sprout: Sprout, ban: Ban, 'user-round': UserRound, users: Users, map: Map, ruler: Ruler, 'message-circle': MessageCircle, 'book-open': BookOpen, code: Code2,
  hammer: Hammer, 'git-branch': GitBranch, flag: Flag,
} satisfies Record<Part['icon'], unknown>;
export function PartIcon({ name, size = 18, x, y }: { name: Part['icon']; size?: number; x?: number; y?: number }) {
  const Component = ICONS[name];
  return <Component size={size} strokeWidth={1.6} aria-hidden="true" x={x} y={y}/>;
}

/** Breaks a name into lines of about `width` characters; very long words are cut so nothing leaves the plate. */
export function wrap(text: string, width: number, max = 3): string[] {
  const words = text.split(/\s+/).flatMap(w => w.length > width ? w.match(new RegExp(`.{1,${width}}`, 'g'))! : [w]);
  const lines: string[] = [];
  for (const word of words) {
    if (lines.length && (lines.at(-1)! + ' ' + word).length <= width) lines[lines.length - 1] += ' ' + word;
    else lines.push(word);
  }
  return lines.length > max ? [...lines.slice(0, max - 1), lines.slice(max - 1).join(' ').slice(0, width - 1) + '…'] : lines;
}

/** A joint drawn along the layout's polyline: color, line style and end mark all say its kind, never color alone. */
export function JointPath({ joint, points, label, muted = false, flowing = false, broken = false }: { joint: Pick<Joint, 'type' | 'label'>; points: Point[]; label?: Rect; muted?: boolean; flowing?: boolean; broken?: boolean }) {
  const family = JOINT_FAMILY[joint.type];
  const [a, b] = [points.at(-2)!, points.at(-1)!];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const ux = (b[0] - a[0]) / len; const uy = (b[1] - a[1]) / len;
  const [s0, s1] = [points[0], points[1]];
  const slen = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1; const sx = (s1[0] - s0[0]) / slen; const sy = (s1[1] - s0[1]) / slen;
  const cls = `joint fam-${family} t-${joint.type}${muted ? ' muted' : ''}${flowing ? ' flowing' : ''}${broken ? ' broken' : ''}`;
  return <g className={cls}>
    <polyline points={points.map(p => p.join(',')).join(' ')} className="joint-line"/>
    {joint.type === 'limits'
      ? <path className="joint-line" d={`M${b[0] - uy * 7},${b[1] + ux * 7} L${b[0] + uy * 7},${b[1] - ux * 7}`}/>
      : <polygon className="joint-head" points={`${b[0]},${b[1]} ${b[0] - ux * 10 - uy * 4.5},${b[1] - uy * 10 + ux * 4.5} ${b[0] - ux * 10 + uy * 4.5},${b[1] - uy * 10 - ux * 4.5}`}/>}
    {joint.type === 'attacks' && <path className="joint-line" d={`M${s0[0] + sx * 12 - 5},${s0[1] + sy * 12 - 5} l10,10 m0,-10 l-10,10`}/>}
    {label && <g className="joint-label"><rect x={label.x} y={label.y} width={label.w} height={label.h} rx={2}/><text x={label.x + label.w / 2} y={label.y + label.h / 2 + 4} textAnchor="middle">{joint.label}</text></g>}
  </g>;
}

export interface SheetProps {
  layout: LevelLayout; parts: Part[]; joints: Joint[]; title: string; subtitle: string; language: string;
  selected?: string; onSelect?: (id: string) => void; onEnter?: (id: string) => void;
  /** Run decorations: scenario states, the joints that carry the current step, a removed brick and the target's verdict. */
  states?: Record<string, string>; flow?: [string, string][]; bricks?: string[]; removed?: string; target?: { id: string; verdict: 'falls' | 'weakens' | 'holds' };
}
const TITLE_BLOCK = 64;

/** The exploded view: one level drawn from the automatic layout, as a technical sheet with a title block. */
export function Sheet({ layout, parts, joints, title, subtitle, language, selected, onSelect, onEnter, states = {}, flow = [], bricks = [], removed, target }: SheetProps) {
  const { t } = usePreferences();
  const width = Math.max(layout.width, 560); const height = layout.height + TITLE_BLOCK;
  const flowing = (j: Joint) => flow.some(([a, b]) => (a === j.from && b === j.to) || (a === j.to && b === j.from));
  // Only the drawing scrolls sideways when it is wider than the room; the panels around it never do.
  return <div className="sheet-scroll"><svg className="sheet" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t.d.sheetLabel(title)} style={{ minWidth: `${Math.round(width * 0.7)}px`, maxWidth: `${Math.round(width * 1.15)}px` }}>
    <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" className="hatch-line"/></pattern></defs>
    <rect className="frame" x={8} y={8} width={width - 16} height={height - 16}/>
    <rect className="frame-inner" x={13} y={13} width={width - 26} height={height - 26}/>
    {layout.joints.map((j, i) => <JointPath key={i} joint={joints[i]} points={j.points} label={j.label} flowing={flowing(joints[i])} broken={removed === j.from} muted={!!removed && removed !== j.from && removed !== j.to}/>)}
    {layout.plates.map(({ id, rect }) => {
      const index = parts.findIndex(p => p.id === id); const part = parts[index];
      const state = target?.id === id ? (target.verdict === 'falls' ? 'failed' : target.verdict === 'weakens' ? 'active' : 'ok') : states[id];
      const cls = ['plate', part.parts && 'assembly', part.parts && part.relevant === false && 'closed', selected === id && 'selected', state && `state-${state}`,
        bricks.includes(id) && 'brick', removed === id && 'removed'].filter(Boolean).join(' ');
      const lines = wrap(part.name, 20);
      const top = rect.h / 2 - (lines.length * 15) / 2 + 13;
      const tilt = target?.id === id && target.verdict !== 'holds' ? `rotate(${target.verdict === 'falls' ? 3 : 1.2} ${rect.w / 2} ${rect.h})` : undefined;
      return <g key={id} className={cls} data-id={id} transform={`translate(${rect.x} ${rect.y})`} role="button" tabIndex={0}
        aria-pressed={selected === id} aria-label={`${index + 1}. ${part.name} · ${t.d.kinds[part.kind]}${state ? ` · ${t.d.states[state as keyof typeof t.d.states]}` : ''}`}
        onClick={() => onSelect?.(id)} onDoubleClick={() => part.parts && onEnter?.(id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id); } }}>
        {part.parts && <rect className="outer" x={-4} y={-4} width={rect.w + 8} height={rect.h + 8} rx={4}/>}
        <g transform={tilt}><rect className="body" width={rect.w} height={rect.h} rx={3}/>
          {part.parts && part.relevant === false && <rect className="hatch" width={rect.w} height={rect.h} rx={3}/>}
          <text className="kind-tag" x={10} y={15}>{t.d.kinds[part.kind]}</text>
          {part.parts && <text className="sub-count" x={rect.w - 8} y={15} textAnchor="end">{part.relevant === false ? '▨' : '⊕'} {t.d.subParts(part.parts.length)}</text>}
          <g className="plate-icon"><PartIcon name={part.icon} size={20} x={10} y={rect.h / 2 - 6}/></g>
          <text className="name" lang={language}>{lines.map((line, i) => <tspan key={i} x={40} y={top + i * 15}>{line}</tspan>)}</text>
        </g>
        <g className="balloon" aria-hidden="true"><line x1={-9} y1={-9} x2={6} y2={6}/><circle cx={-15} cy={-15} r={10}/><text x={-15} y={-11} textAnchor="middle">{index + 1}</text></g>
        {target?.id === id && <text className={`verdict v-${target.verdict}`} x={rect.w / 2} y={-10} textAnchor="middle">{t.d.run.verdicts[target.verdict]}</text>}
        {state && target?.id !== id && <g className={`state-mark s-${state}`} aria-hidden="true"><circle cx={rect.w} cy={0} r={10}/><text x={rect.w} y={4} textAnchor="middle">{{ ok: '✓', failed: '✕', active: '…', restored: '↺' }[state]}</text></g>}
      </g>;
    })}
    <g className="title-block" transform={`translate(${width - 13 - 320} ${height - 13 - 50})`}>
      <rect className="frame-inner" width={320} height={50}/><line className="tb-line" x1={0} y1={28} x2={320} y2={28}/>
      <text className="tb-title" x={10} y={19} lang={language}>{title.length > 40 ? title.slice(0, 39) + '…' : title}</text>
      <text className="tb-text" x={10} y={43}>{subtitle}</text>
    </g>
  </svg></div>;
}
