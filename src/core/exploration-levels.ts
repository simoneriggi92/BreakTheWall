import { firstLine, type Exploration, type ExplorationLink, type ExplorationPart, type Trace } from './exploration';
import { shapeOf, type Shape } from './exploration-shape';
import type { Section } from './source-index';

/**
 * The levels of abstraction (plan P-20261105-exploration X5): pure functions of the stored exploration. The aspect
 * level and each aspect's sub-level are derived, never stored, so one document serves every level; each level has the
 * shape of an exploration, so the same detector and layout draw it.
 */
export type LevelBond = { from: string; to: string; label: string };
/** A derived joint keeps the bonds it stands for: which role does what to which. */
export type LevelLink = ExplorationLink & { bonds?: LevelBond[]; labels?: string[] };
export type Level = Pick<Exploration, 'aspects' | 'start'> & { parts: ExplorationPart[]; links: LevelLink[]; traces: Trace[] };

/** Roles with no aspect gather in one block. Its id can never be a stored id, so it never meets one. */
export const OTHER_ASPECT = '~other';

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** The source's aspects as blocks whose members are their roles. None when the exploration names fewer than two. */
export function aspectLevel(x: Pick<Exploration, 'aspects' | 'parts' | 'links' | 'traces' | 'start'>): Level | null {
  if (x.aspects.length < 2) return null;
  const named = new Set(x.aspects.map(a => a.id)), byId = new Map(x.parts.map(p => [p.id, p]));
  const roles = x.parts.filter(p => p.kind === 'part');
  const of = (p: ExplorationPart) => p.aspect && named.has(p.aspect) ? p.aspect : OTHER_ASPECT;
  const toAspect = (id: string) => { const p = byId.get(id); return p?.kind === 'part' ? of(p) : id; };
  const firstOf = (a: string) => Math.min(...roles.filter(r => of(r) === a).map(firstLine));
  const ids = uniq(roles.map(of)).sort((a, b) => firstOf(a) - firstOf(b));
  const blocks: ExplorationPart[] = ids.map(a => {
    const rs = roles.filter(r => of(r) === a);
    return {
      id: a, kind: 'part', aspect: a, name: x.aspects.find(s => s.id === a)?.name ?? '', role: rs.map(r => r.name).join(' · '),
      cites: rs.flatMap(r => r.cites), points: [], members: rs.map(r => ({ id: r.id, name: r.name, does: r.role, cites: r.cites })),
    };
  });
  // prerequisites keep pointing at what they open; annotations and references follow their part to its aspect
  const others = x.parts.filter(p => p.kind !== 'part').map(p => p.on ? { ...p, on: toAspect(p.on) } : { ...p });
  const agg = new Map<string, { from: string; to: string; cls: ExplorationLink['class']; declared: boolean; cites: ExplorationLink['cites']; bonds: LevelBond[] }>();
  for (const l of x.links) {
    if (l.class === 'group') continue;
    const from = toAspect(l.from), to = toAspect(l.to);
    if (from === to) continue;
    const k = `${from}>${to}>${l.class}`, a = agg.get(k) ?? { from, to, cls: l.class, declared: false, cites: [], bonds: [] };
    a.declared ||= l.basis === 'declared'; a.cites.push(...l.cites); a.bonds.push({ from: l.from, to: l.to, label: l.label });
    agg.set(k, a);
  }
  // a joint that stands for several bonds says the first and how many more, never a bare count (owner, 2026-11-06)
  const links: LevelLink[] = [...agg.values()].map(a => {
    const labels = uniq(a.bonds.map(b => b.label));
    return { from: a.from, to: a.to, class: a.cls, basis: a.declared ? 'declared' : 'interpreted', cites: a.cites.slice(0, 12),
      label: labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`, labels, bonds: a.bonds };
  });
  return {
    aspects: x.aspects, start: toAspect(x.start), parts: [...blocks, ...others], links,
    traces: x.traces.map(t => ({ ...t, steps: t.steps.map(s => ({ ...s, parts: uniq(s.parts.map(toAspect)) })) })),
  };
}

/** One aspect's roles, with their annotations and the links among them. No prerequisite: they open the level on the whole. */
export function subLevel(x: Pick<Exploration, 'aspects' | 'parts' | 'links' | 'traces'>, aspect: string): Level {
  const named = new Set(x.aspects.map(a => a.id));
  const roles = x.parts.filter(p => p.kind === 'part' && (p.aspect && named.has(p.aspect) ? p.aspect : OTHER_ASPECT) === aspect);
  const ids = new Set(roles.map(r => r.id)), notes = x.parts.filter(p => p.kind === 'annotation' && p.on && ids.has(p.on));
  const keep = new Set([...ids, ...notes.map(p => p.id)]);
  const start = [...roles].sort((a, b) => firstLine(a) - firstLine(b))[0]?.id ?? '';
  return {
    aspects: [], start, parts: [...roles, ...notes], links: x.links.filter(l => keep.has(l.from) && keep.has(l.to)),
    traces: x.traces.map(t => ({ ...t, steps: t.steps.map(s => ({ ...s, parts: s.parts.filter(p => ids.has(p)) })).filter(s => s.parts.length) })).filter(t => t.steps.length),
  };
}

/**
 * Every block of a level is drawn. In a sub-level, roles with no bond join the first layer and other nuclei join the
 * first; a level with no bond at all is laid out in rows of three, in source order. The aspect level takes the same
 * rule when no bond joins its aspects; otherwise it keeps its own shape.
 */
export function levelShape(level: Level, kind: 'aspects' | 'sub'): Shape {
  const shape = shapeOf(level);
  const loose = shape.loose.filter(p => p.kind === 'part');
  if (kind === 'aspects' && !loose.length) return shape;
  const parts = level.parts.filter(p => p.kind === 'part').sort((a, b) => firstLine(a) - firstLine(b));
  if (!shape.nuclei.length) {
    if (!parts.length) return shape;
    const layer = new Map(parts.map((p, i) => [p.id, Math.floor(i / 3)]));
    return { ...shape, loose: [], nuclei: [{ ids: parts.map(p => p.id), root: parts[0].id, layer, flow: true, depth: Math.max(...layer.values()) + 1 }] };
  }
  const [n, ...rest] = shape.nuclei, ids = [...n.ids], layer = new Map(n.layer);
  for (const p of loose) { ids.push(p.id); layer.set(p.id, 0); }
  for (const m of rest) for (const id of m.ids) { ids.push(id); layer.set(id, m.layer.get(id)!); }
  return { ...shape, loose: [], nuclei: [{ ...n, ids, layer, depth: Math.max(...layer.values()) + 1 }] };
}

/**
 * The source's starting point, read first and alone: the earliest-cited prerequisite, when no part opens in its top
 * section of the source (with no index: when it comes before every part). Otherwise none.
 */
export function premiseOf(x: Pick<Exploration, 'parts'>, index: Section[]): ExplorationPart | null {
  const p = x.parts.filter(q => q.kind === 'prerequisite').sort((a, b) => firstLine(a) - firstLine(b))[0];
  if (!p) return null;
  const at = firstLine(p), roles = x.parts.filter(q => q.kind === 'part');
  const sec = index.filter(s => !s.sub && s.line <= at && at <= s.end).pop();
  const alone = sec ? !roles.some(q => sec.line <= firstLine(q) && firstLine(q) <= sec.end) : roles.every(q => firstLine(q) > at);
  return alone ? p : null;
}
