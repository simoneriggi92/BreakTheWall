import { firstLine, type Exploration, type ExplorationCite, type ExplorationPart } from '../../core/exploration';
import { aspectLevel, levelShape, premiseOf, subLevel, type Level, type LevelLink } from '../../core/exploration-levels';
import { shapeOf, type Shape } from '../../core/exploration-shape';
import { sourceIndex, type Section } from '../../core/source-index';

/**
 * What the exploration view reads (plan P-20261105-exploration X12, X13): the level drawn on the whole (the aspect level
 * when the exploration names aspects, otherwise the roles), its shape, the premise, each aspect's hue, and the guide's
 * steps and what each step shows. Pure functions of the stored exploration and the view's position, so the guide can
 * be tested without a DOM.
 */
export type Tone = 'a1' | 'a2' | 'a3' | 'a4';
export type Shaped = { level: Level; shape: Shape; parts: Map<string, ExplorationPart> };
export type SubLevel = Shaped & { aspect: string; name: string };
export interface Model extends Shaped {
  x: Exploration;
  index: Section[];
  /** True when the whole is the aspect level, so each block opens a sub-level of roles. */
  aspects: boolean;
  premise: ExplorationPart | null;
  /** Every part of the exploration, at any level. */
  all: Map<string, ExplorationPart>;
  tone: (id: string) => Tone | null;
  sub: (aspect: string) => SubLevel;
  /** The aspect a role belongs to, at the aspect level; none for anything else. */
  aspectOf: (id: string) => string | null;
  steps: LayerStep[];
}

export type LayerStep = { premise: true } | { nucleus: number; layer?: number };
const shaped = (level: Level, shape: Shape): Shaped => ({ level, shape, parts: new Map(level.parts.map(p => [p.id, p])) });

export function modelOf(x: Exploration): Model {
  const index = sourceIndex(x.source.text), aspect = aspectLevel(x);
  const top = aspect ? shaped(aspect, levelShape(aspect, 'aspects')) : shaped({ aspects: x.aspects, start: x.start, parts: x.parts, links: x.links, traces: x.traces }, shapeOf(x));
  const all = new Map(x.parts.map(p => [p.id, p]));
  const order = new Map(x.aspects.map((a, i) => [a.id, i]));
  // the hue says which aspect: its block, its roles, its sub-level; a prerequisite keeps its own colour
  const tone = (id: string): Tone | null => {
    const p = all.get(id), i = order.get(id) ?? (p?.kind === 'part' && p.aspect ? order.get(p.aspect) : undefined);
    return i === undefined ? null : `a${i % 4 + 1}` as Tone;
  };
  const cache = new Map<string, SubLevel>();
  const sub = (a: string) => {
    if (!cache.has(a)) { const level = subLevel(x, a); cache.set(a, { ...shaped(level, levelShape(level, 'sub')), aspect: a, name: top.parts.get(a)?.name ?? a }); }
    return cache.get(a)!;
  };
  const aspectOf = (id: string) => {
    if (!aspect) return null;
    const p = all.get(id);
    if (p?.kind !== 'part') return null;
    return p.aspect && order.has(p.aspect) ? p.aspect : top.parts.has('~other') ? '~other' : null;
  };
  const premise = premiseOf(x, index);
  const n0 = top.shape.nuclei[0];
  const steps: LayerStep[] = n0 ? [
    ...(premise ? [{ premise: true as const }] : []),
    ...Array.from({ length: n0.depth }, (_, k) => ({ nucleus: 0, layer: k })),
    ...top.shape.nuclei.slice(1).map((_, i) => ({ nucleus: i + 1 })),
  ] : [];
  return { ...top, x, index, aspects: !!aspect, premise, all, tone, sub, aspectOf, steps };
}

/** Where the guide is. `trace` is the question chosen when the source walks several. */
export type Guide = { kind: 'whole'; at: number } | { kind: 'question'; trace: number; at: number };
export type Shown = { vis: Set<string>; fresh: Set<string>; lit: Set<string>; done: Set<string> };

/** The part an annotation is about stands for it in the drawing. */
export const standIn = (m: Shaped, id: string) => m.parts.get(id)?.kind === 'annotation' ? m.parts.get(id)!.on ?? id : id;
const opens = (m: Shaped, id: string) => m.level.links.find(l => l.from === id && l.class === 'prerequisite')?.to;

/**
 * What the guide shows at its position: the parts in view, the ones entering now, the ones a question's step lights,
 * and the ones already walked. `all` shows the whole level, whatever the step; `visited` is what a question walked.
 */
export function shown(m: Model, guide: Guide, all = false, visited: Set<string> = new Set()): Shown {
  const vis = new Set<string>(), fresh = new Set<string>(), lit = new Set<string>(), done = new Set(visited);
  const nucleusIds = m.shape.nuclei.flatMap(n => n.ids), prereqs = m.shape.prerequisites.map(p => p.part.id);
  if (!m.shape.nuclei.length || all) {
    nucleusIds.forEach(id => vis.add(id)); prereqs.forEach(id => vis.add(id));
  } else if (guide.kind === 'question') {
    const trace = m.level.traces[guide.trace];
    nucleusIds.forEach(id => vis.add(id));
    trace.steps.forEach((s, i) => s.parts.forEach(p => {
      if (m.parts.get(p)?.kind === 'prerequisite') vis.add(p);
      if (i < guide.at) done.add(standIn(m, p));
    }));
    trace.steps[guide.at]?.parts.forEach(p => lit.add(standIn(m, p)));
  } else {
    const upTo = (i: number) => {
      const v = new Set<string>();
      for (let j = 0; j <= i; j++) {
        const s = m.steps[j];
        if (!s || 'premise' in s) continue;
        const n = m.shape.nuclei[s.nucleus];
        n.ids.filter(id => s.layer === undefined || n.layer.get(id)! <= s.layer).forEach(id => v.add(id));
      }
      return v;
    };
    const now = upTo(guide.at), before = guide.at ? upTo(guide.at - 1) : new Set<string>();
    now.forEach(id => { vis.add(id); if (!before.has(id)) fresh.add(id); });
    // a prerequisite shows with the step before the part it opens, and stays
    for (const id of prereqs) {
      const to = opens(m, id);
      const at = m.steps.findIndex((_, j) => to !== undefined && upTo(j).has(to));
      if (at >= 0 && guide.at >= at - 1) { vis.add(id); if (guide.at === Math.max(0, at - 1)) fresh.add(id); }
    }
    if (m.steps[guide.at] && 'premise' in m.steps[guide.at]) { vis.clear(); fresh.clear(); fresh.add(m.premise!.id); }
  }
  if (m.premise) vis.add(m.premise.id);
  return { vis, fresh, lit, done };
}

/** The part the guide puts forward at its position: a question's first lit part, or the earliest part entering now. */
export function guided(m: Model, guide: Guide, view: Shown): string | undefined {
  if (guide.kind === 'question') {
    const step = m.level.traces[guide.trace]?.steps[guide.at];
    return step?.parts.map(p => standIn(m, p)).find(id => view.vis.has(id)) ?? step?.parts[0];
  }
  const fresh = [...view.fresh].map(id => m.parts.get(id)).filter((p): p is ExplorationPart => !!p);
  return (fresh.filter(p => p.kind === 'part').sort((a, b) => firstLine(a) - firstLine(b))[0] ?? fresh[0])?.id;
}

/** The references that join a nucleus to the others: what the banner names when the guide changes aspect. */
export function crossing(m: Shaped, nucleus: number): LevelLink[] {
  const of = (id: string) => m.shape.nuclei.findIndex(n => n.ids.includes(id));
  return m.level.links.filter(l => l.class !== 'group' && of(l.from) >= 0 && of(l.to) >= 0 && of(l.from) !== of(l.to) && (of(l.from) === nucleus || of(l.to) === nucleus));
}

const span = (cs: ExplorationCite[]) => cs.reduce((s, c) => s + c.to - c.from + 1, 0);
const cites = (cs: ExplorationCite[], line: number) => cs.some(c => c.from <= line && line <= c.to);
/** The narrowest part that cites a line, among the given parts; annotations count, members do not. */
export function citing(parts: ExplorationPart[], line: number): ExplorationPart | undefined {
  return parts.filter(p => cites(p.cites, line)).sort((a, b) => span(a.cites) - span(b.cites))[0];
}
/** The narrowest top section that holds a line, or its subsection. */
export const sectionOf = (index: Section[], line: number) => index.reduce<number>((at, s, i) => s.line <= line && line <= s.end ? i : at, -1);
