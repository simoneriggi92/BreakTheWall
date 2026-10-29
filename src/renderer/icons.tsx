import { ArrowDownUp, ArrowRightLeft, BookOpen, Check, Code2, Database, Eye, Flame, Gauge, Inbox, Layers, Lightbulb, Puzzle, Repeat2, Route, Send, ShieldCheck, Target, Thermometer, TriangleAlert } from 'lucide-react';
import type { IconName } from '../core/lesson';
import { usePreferences } from './preferences';

const icons = { route: Route, inbox: Inbox, shield: ShieldCheck, database: Database, send: Send, thermometer: Thermometer, target: Target, gauge: Gauge, flame: Flame, loop: Repeat2, eye: Eye, lightbulb: Lightbulb, warning: TriangleAlert, check: Check, layers: Layers, code: Code2, book: BookOpen, compare: ArrowRightLeft, puzzle: Puzzle };
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Component = icons[name] ?? ArrowDownUp;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}
/**
 * The mark (docs/images/brand/mark.svg): four lines of text, the second one's end pulled out and still linked to its
 * place. Its colours come from the theme's brand tokens, so paper and blueprint both work; the piece is decorative.
 */
export function Brand() {
  const { t } = usePreferences();
  return <span className="brand"><BrandMark/><span>Break the Wall<small>{t.common.brandTagline}</small></span></span>;
}
/** The mark alone, for the player's top bar, where the name would only add weight. */
export function BrandMark() {
  return <svg className="brand-mark" width="38" height="32" viewBox="0 0 104 88" aria-hidden="true">
    <path className="brand-link" d="M40 33H60V29H78" fill="none" strokeWidth="5"/>
    <g className="brand-bars"><rect x="4" y="6" width="54" height="12" rx="1"/><rect x="4" y="27" width="36" height="12" rx="1"/><rect x="4" y="48" width="54" height="12" rx="1"/><rect x="4" y="69" width="54" height="12" rx="1"/></g>
    <rect className="brand-piece" x="78" y="20" width="24" height="18"/>
  </svg>;
}
