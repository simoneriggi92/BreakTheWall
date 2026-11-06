import type { ExplorationLink } from '../../core/exploration';
import type { Guide, Model } from './model';

/**
 * The view's one shared state (plan P-20261105-exploration X12): the guide and its position, what is explored off it,
 * the selected point, link or section, the open sub-level with its role, open roles and component, the moved labels,
 * the folded panels and "how it was read". Every panel reads it and every click writes it.
 */
export type Link = Pick<ExplorationLink, 'from' | 'to' | 'class'>;
export type Pick_ = { point: number } | { link: Link } | null;
export interface ViewState {
  guide: Guide;
  /** "All the layers": the whole level at once; the guide keeps its step. */
  all: boolean;
  /** Parts a question walked, outlined once the guide turns to the whole source. */
  visited: string[];
  /** A block the reader chose off the guide: shown, its joints lit. */
  explore: string | null;
  pick: Pick_;
  /** A section with no part, chosen in the index or the source. */
  section: number | null;
  /** The aspect whose sub-level is open, the role chosen in it, the roles showing their components, and the component. */
  sub: string | null;
  subSel: string | null;
  opened: string[];
  member: { part: string; id: string } | null;
  /** What was explored when the sub-level opened: closing returns to it. */
  before: string | null;
  /** True right after a sub-level opens, so it grows out of its block once. */
  grow: boolean;
  /** Labels the reader moved, by key, as an offset from their joint's midpoint. Not stored. */
  moved: Record<string, [number, number]>;
  folded: { index: boolean; source: boolean };
  /** The panel shown on a narrow window. */
  tab: 'index' | 'structure' | 'source';
  report: boolean;
}

export function initialState(m: Model): ViewState {
  const question = m.shape.entry === 'trace' && m.shape.trace !== undefined;
  return {
    guide: question ? { kind: 'question', trace: m.shape.trace!, at: 0 } : { kind: 'whole', at: 0 },
    all: false, visited: [], explore: null, pick: null, section: null,
    sub: null, subSel: null, opened: [], member: null, before: null, grow: false,
    moved: {}, folded: { index: false, source: false }, tab: 'structure', report: false,
  };
}

export type Action =
  | { type: 'step'; by: number }
  | { type: 'goto'; at: number }
  | { type: 'guide'; guide: 'whole' | 'question'; trace?: number }
  /** The end of a question: the whole source, with what the question walked outlined. */
  | { type: 'whole-after-question'; at: number; visited: string[] }
  | { type: 'all'; on: boolean }
  | { type: 'choose'; id: string }
  | { type: 'explore'; id: string | null }
  | { type: 'back' }
  | { type: 'pick'; pick: Pick_ }
  | { type: 'section'; index: number }
  | { type: 'open'; aspect: string; role?: string | null; components?: boolean }
  | { type: 'close' }
  | { type: 'sub-select'; id: string | null; components?: boolean }
  | { type: 'components'; id: string }
  | { type: 'member'; part: string; id: string | null }
  | { type: 'grown' }
  | { type: 'move'; key: string; offset: [number, number] | null }
  | { type: 'fold'; panel: 'index' | 'source' }
  | { type: 'tab'; tab: ViewState['tab'] }
  | { type: 'report'; on: boolean }
  | { type: 'escape' };

const offGuide: Partial<ViewState> = { explore: null, pick: null, section: null, member: null };
const closed: Partial<ViewState> = { sub: null, subSel: null, opened: [], member: null, before: null, grow: false };

export function reduce(m: Model, s: ViewState, a: Action): ViewState {
  switch (a.type) {
    case 'step': return reduce(m, s, { type: 'goto', at: s.guide.at + a.by });
    case 'goto': {
      const last = s.guide.kind === 'question' ? m.level.traces[s.guide.trace].steps.length - 1 : m.steps.length - 1;
      const at = Math.max(0, Math.min(last, a.at));
      // stepping returns to the guide; an open sub-level waits on its step, so stepping closes it first
      return { ...s, ...offGuide, ...closed, guide: { ...s.guide, at } };
    }
    case 'guide': {
      const guide: Guide = a.guide === 'question' ? { kind: 'question', trace: a.trace ?? m.shape.trace ?? 0, at: 0 } : { kind: 'whole', at: 0 };
      return { ...s, ...offGuide, ...closed, guide, all: false };
    }
    case 'whole-after-question': return { ...s, ...offGuide, ...closed, guide: { kind: 'whole', at: a.at }, visited: a.visited };
    case 'all': return { ...s, all: a.on };
    // choosing a block explores it and lights its joints; choosing it again returns the view as it was
    case 'choose': return { ...s, ...closed, explore: s.explore === a.id && !s.sub ? null : a.id, pick: null, section: null };
    case 'explore': return { ...s, explore: a.id, pick: null, section: null, member: null };
    case 'back': return { ...s, ...offGuide, ...closed };
    case 'pick': return { ...s, pick: a.pick };
    case 'section': return { ...s, ...closed, explore: null, pick: null, member: null, section: a.index };
    case 'open': {
      const moving = s.sub !== a.aspect;
      const opened = a.role && a.components ? [...new Set([...(moving ? [] : s.opened), a.role])] : moving ? [] : s.opened;
      return { ...s, sub: a.aspect, subSel: a.role ?? null, opened, member: null, pick: null, section: null,
        explore: a.aspect, before: s.sub ? s.before : s.explore, grow: moving || s.grow };
    }
    case 'close': return { ...s, ...closed, explore: s.before, pick: null };
    case 'sub-select': {
      if (s.subSel === a.id && a.id) return { ...s, subSel: null, member: null, pick: null };
      const opened = a.id && a.components && !s.opened.includes(a.id) ? [...s.opened, a.id] : s.opened;
      return { ...s, subSel: a.id, opened, member: null, pick: null };
    }
    case 'components': return { ...s, subSel: a.id, opened: s.opened.includes(a.id) ? s.opened.filter(x => x !== a.id) : [...s.opened, a.id] };
    case 'member': return a.id ? { ...s, member: { part: a.part, id: a.id }, pick: null, ...(s.sub ? { subSel: a.part, opened: s.opened.includes(a.part) ? s.opened : [...s.opened, a.part] } : { explore: a.part }) } : { ...s, member: null };
    case 'grown': return s.grow ? { ...s, grow: false } : s;
    case 'move': {
      const moved = { ...s.moved };
      if (a.offset) moved[a.key] = a.offset; else delete moved[a.key];
      return { ...s, moved };
    }
    case 'fold': return { ...s, folded: { ...s.folded, [a.panel]: !s.folded[a.panel] } };
    case 'tab': return { ...s, tab: a.tab };
    case 'report': return { ...s, report: a.on };
    // Escape closes the sub-level first, then returns from exploring, then leaves "all the layers"
    case 'escape': return s.report ? { ...s, report: false } : s.sub ? reduce(m, s, { type: 'close' }) : s.explore || s.pick || s.section !== null ? reduce(m, s, { type: 'back' }) : s.all ? { ...s, all: false } : s;
  }
}
