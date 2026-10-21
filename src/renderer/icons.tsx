import { ArrowDownUp, ArrowRightLeft, BookOpen, Check, Code2, Database, Eye, Flame, Gauge, Inbox, Layers, Lightbulb, Puzzle, Repeat2, Route, Send, ShieldCheck, Target, Thermometer, TriangleAlert } from 'lucide-react';
import type { IconName } from '../core/lesson';

const icons = { route: Route, inbox: Inbox, shield: ShieldCheck, database: Database, send: Send, thermometer: Thermometer, target: Target, gauge: Gauge, flame: Flame, loop: Repeat2, eye: Eye, lightbulb: Lightbulb, warning: TriangleAlert, check: Check, layers: Layers, code: Code2, book: BookOpen, compare: ArrowRightLeft, puzzle: Puzzle };
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Component = icons[name] ?? ArrowDownUp;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}
export function Brand() {
  return <span className="brand"><svg width="35" height="32" viewBox="0 0 35 32" fill="currentColor" aria-hidden="true"><rect x="0" y="23" width="14" height="8" rx="2"/><rect x="17" y="23" width="14" height="8" rx="2"/><rect x="4" y="12" width="14" height="8" rx="2"/><rect x="21" y="11" width="12" height="8" rx="2" transform="rotate(-13 21 11)"/><rect x="8" y="1" width="13" height="8" rx="2"/><rect x="26" y="0" width="7" height="6" rx="1.5" transform="rotate(13 26 0)"/></svg><span>Break the Wall<small>UN CONCETTO ALLA VOLTA</small></span></span>;
}
