import { ArrowDownUp, ArrowRightLeft, BookOpen, Check, Code2, Database, Eye, Flame, Gauge, Inbox, Layers, Lightbulb, Puzzle, Repeat2, Route, Send, ShieldCheck, Target, Thermometer, TriangleAlert } from 'lucide-react';
import type { IconName } from '../core/lesson';

const icons = { route: Route, inbox: Inbox, shield: ShieldCheck, database: Database, send: Send, thermometer: Thermometer, target: Target, gauge: Gauge, flame: Flame, loop: Repeat2, eye: Eye, lightbulb: Lightbulb, warning: TriangleAlert, check: Check, layers: Layers, code: Code2, book: BookOpen, compare: ArrowRightLeft, puzzle: Puzzle };
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Component = icons[name] ?? ArrowDownUp;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}
export function Brand() {
  return <span className="brand"><svg width="32" height="29" viewBox="0 0 34 31" fill="currentColor" aria-hidden="true"><g transform="rotate(-6 16 15)"><rect x="1" y="2" width="13" height="9" rx="1.5"/><rect x="17" y="2" width="13" height="9" rx="1.5"/><rect x="1" y="14" width="13" height="9" rx="1.5"/><rect x="21" y="18" width="13" height="9" rx="1.5" opacity=".5" transform="rotate(20 21 18)"/></g></svg><span>Break the Wall<small>UN CONCETTO ALLA VOLTA</small></span></span>;
}
