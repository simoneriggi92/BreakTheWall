import type { Cite, Disassembly, ExclusionReason, Joint, Part } from './disassembly';

/** Root source blocks, supplied by the format parser. Lists, tables and fences stay indivisible. */
export interface ReadingBlock { from: number; to: number; heading?: string }
export interface ReadingPassage extends Cite { title?: string }
export interface ReadingPosition { source: string; from: number; view: 'guided' | 'overview' }

/** A soft reading size, never a reason to cut an original block. Advancing never generates more steps. */
const TARGET_CHARS = 1800;
export function sourceReadingRoute(sources: Pick<Disassembly['sources'][number], 'id' | 'text'>[], blocks: Record<string, ReadingBlock[]>): ReadingPassage[] {
  return sources.flatMap(source => {
    const lines = source.text.split('\n');
    const structural = (blocks[source.id] ?? []).filter(b => b.from >= 1 && b.to >= b.from && b.to <= lines.length).sort((a, b) => a.from - b.from);
    const route: ReadingPassage[] = [];
    let from = 1, content = false, title: string | undefined;
    const flush = (to: number) => { if (to >= from) route.push({ source: source.id, from, to, title }); from = to + 1; content = false; };
    for (const block of structural) {
      if (block.from < from) continue;
      const large = content && lines.slice(from - 1, block.to).join('\n').length > TARGET_CHARS;
      if (content && (block.heading !== undefined || large)) flush(block.from - 1);
      if (block.heading !== undefined) title = block.heading;
      else content = true;
    }
    // A trailing title without a body stays with the preceding passage rather than becoming an empty step.
    if (!content && route.length) route.at(-1)!.to = lines.length;
    else flush(lines.length);
    return route;
  });
}

export function readingIndex(route: ReadingPassage[], position?: Pick<ReadingPosition, 'source' | 'from'>): number {
  const i = position && route.findIndex(p => p.source === position.source && p.from <= position.from && p.to >= position.from);
  return i === undefined || i < 0 ? 0 : i;
}
const overlap = (a: Cite, b: Cite) => a.source === b.source ? Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from) + 1) : 0;

/** Existing citations alone supply context. Unassigned text never gets an invented part. */
export function readingContext(d: Disassembly, passage: Cite): { root?: Part; part?: Part } {
  let chosen: { root: Part; part: Part; score: number; depth: number } | undefined;
  const visit = (part: Part, root: Part, depth: number) => {
    const score = part.cites.reduce((n, c) => n + overlap(c, passage), 0);
    if (score > 0 && (!chosen || score > chosen.score || score === chosen.score && depth > chosen.depth)) chosen = { root, part, score, depth };
    part.parts?.forEach(p => visit(p, root, depth + 1));
  };
  d.parts.forEach(p => visit(p, p, 0));
  return chosen ? { root: chosen.root, part: chosen.part } : {};
}

/** A line the drawing leaves out, beside it in the margin with its reason; `part` when the exclusion is inside a part. */
export interface ReadingMargin extends Cite { reason: ExclusionReason; note?: string; part?: string }
/**
 * What a passage does to the drawing (P-20261102-guided-reading G2). Computed from citations alone, in route order:
 * it frames the whole, adds top-level parts it cites for the first time, deepens parts already added, relates them
 * through the joints it cites, and leaves out lines that go to the margin. `subParts` serves the depth view.
 */
export interface ReadingRole { frame: boolean; add: string[]; deepen: string[]; relate: Joint[]; subParts: string[]; margin: ReadingMargin[] }

export function readingRoles(d: Disassembly, route: ReadingPassage[]): ReadingRole[] {
  const key = (source: string, line: number) => `${source}:${line}`;
  const mark = (map: Map<string, string[]>, cites: Cite[], id: string) => cites.forEach(c => {
    for (let n = c.from; n <= c.to; n++) { const k = key(c.source, n), ids = map.get(k) ?? []; if (!ids.includes(id)) map.set(k, [...ids, id]); }
  });
  // A sub-part's lines count for its top-level part; the sub-part itself is kept for the depth view.
  const top = new Map<string, string[]>(), sub = new Map<string, string[]>();
  const descend = (part: Part, root: string) => part.parts?.forEach(p => { mark(top, p.cites, root); mark(sub, p.cites, p.id); descend(p, root); });
  d.parts.forEach(p => { mark(top, p.cites, p.id); descend(p, p.id); });
  const whole = new Set<string>(); d.whole.cites.forEach(c => { for (let n = c.from; n <= c.to; n++) whole.add(key(c.source, n)); });
  const exclusions: ReadingMargin[] = [...d.bom.excluded];
  const collect = (part: Part) => { part.excluded?.forEach(x => exclusions.push({ ...x, part: part.id })); part.parts?.forEach(collect); };
  d.parts.forEach(collect);
  const overlaps = (a: Cite, b: Cite) => a.source === b.source && a.from <= b.to && a.to >= b.from;
  const text = new Map(d.sources.map(s => [s.id, s.text.split('\n')]));

  const added = new Map<string, number>();
  const roles = route.map((passage, index): ReadingRole => {
    const lines: string[] = [];
    for (let n = passage.from; n <= passage.to; n++) if (text.get(passage.source)?.[n - 1]?.trim()) lines.push(key(passage.source, n));
    const tops = [...new Set(lines.flatMap(k => top.get(k) ?? []))];
    const add = tops.filter(id => !added.has(id)), deepen = tops.filter(id => added.has(id));
    add.forEach(id => added.set(id, index));
    return {
      frame: !tops.length && lines.some(k => whole.has(k)), add, deepen,
      relate: d.joints.filter(j => j.cites?.some(c => overlaps(c, passage))),
      subParts: [...new Set(lines.flatMap(k => sub.get(k) ?? []))],
      margin: exclusions.filter(x => overlaps(x, passage)),
    };
  });
  // A joint without citations has no passage of its own: it comes with its later end.
  d.joints.filter(j => !j.cites?.length).forEach(j => {
    const at = Math.max(added.get(j.from) ?? -1, added.get(j.to) ?? -1);
    if (at >= 0 && added.has(j.from) && added.has(j.to)) roles[at].relate.push(j);
  });
  return roles;
}
