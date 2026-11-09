import { firstLine, type Exploration, type ExplorationPart, type Trace } from './exploration';

/**
 * The detector (plan P-20261105-exploration X3): the app computes the shape from the cited relations. The model never
 * says "this is the core"; the bonds do, and the way in follows from the shape, never from a genre.
 */
export const ENTRY_RULE = {
  /** The chosen trace walks at least this share of the main nucleus: the reader enters by following it. */
  traceCovers: 0.6,
  /** A second nucleus at least this share of the first is reported as a similar one. */
  similarNucleus: 0.6,
} as const;

export type Nucleus = {
  /** Its parts, in the order the walk found them. */
  ids: string[];
  /** Where its layers start: the start when it holds it, else its earliest-cited part. */
  root: string;
  /** Each part's layer, 0 first. */
  layer: Map<string, number>;
  /** True when the bonds form no cycle and the layers follow their way; false when they grow outward from the root. */
  flow: boolean;
  depth: number;
};
export type EntryCode = 'source' | 'trace' | 'layers';
export type EntryReason =
  | { code: 'no-nucleus' }
  | { code: 'trace-covers'; covered: number }
  | { code: 'dominant-nucleus'; size: number; covered?: number }
  | { code: 'similar-nuclei'; sizes: [number, number] };
export type Shape = {
  nuclei: Nucleus[];
  /** Parts of kind "part" that no bond joins to another. */
  loose: ExplorationPart[];
  /** Each prerequisite, with the part it opens (none when no prerequisite link starts from it). */
  prerequisites: { part: ExplorationPart; opens?: string }[];
  /** Each annotation, with the part it is about. */
  annotations: { part: ExplorationPart; on: string }[];
  /** References and procedures: material set apart by choice. */
  aside: ExplorationPart[];
  /** Each trace's share of the main nucleus, in the traces' order. */
  coverage: number[];
  /** The index of the trace that covers most (ties keep source order), or none. */
  trace?: number;
  entry: EntryCode;
  reason: EntryReason;
};

export function shapeOf(x: Pick<Exploration, 'parts' | 'links' | 'traces' | 'start'>): Shape {
  const parts = new Map(x.parts.map(p => [p.id, p]));
  const core = x.parts.filter(p => p.kind === 'part').sort((a, b) => firstLine(a) - firstLine(b));
  const adj = new Map(core.map(p => [p.id, new Set<string>()]));
  const bonds = x.links.filter(l => l.class === 'bond' && adj.has(l.from) && adj.has(l.to));
  for (const l of bonds) { adj.get(l.from)!.add(l.to); adj.get(l.to)!.add(l.from); }

  // connected components of the bonds, walked in source order
  const seen = new Set<string>(), comps: string[][] = [];
  for (const p of core) {
    if (seen.has(p.id)) continue;
    const c: string[] = [], q = [p.id]; seen.add(p.id);
    while (q.length) { const id = q.shift()!; c.push(id); for (const n of adj.get(id)!) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    comps.push(c);
  }
  const first = (id: string) => firstLine(parts.get(id)!);
  const nuclei = comps.filter(c => c.length > 1).map(ids => layered(ids, x.start, bonds, adj, first));
  // the nucleus that holds the start comes first, then the others in source order
  const holds = (n: Nucleus) => n.ids.includes(x.start) ? 1 : 0;
  nuclei.sort((a, b) => holds(b) - holds(a) || first(a.root) - first(b.root));

  const main = nuclei[0];
  const cover = (t: Trace) => main ? main.ids.filter(id => t.steps.some(s => s.parts.includes(id))).length / main.ids.length : 0;
  const coverage = x.traces.map(cover);
  let trace: number | undefined;
  coverage.forEach((v, i) => { if (trace === undefined || v > coverage[trace]) trace = i; });
  const covered = trace === undefined ? 0 : coverage[trace];

  let entry: EntryCode, reason: EntryReason;
  if (!main) { entry = 'source'; reason = { code: 'no-nucleus' }; }
  else if (covered >= ENTRY_RULE.traceCovers) { entry = 'trace'; reason = { code: 'trace-covers', covered }; }
  else if (nuclei[1] && nuclei[1].ids.length / main.ids.length >= ENTRY_RULE.similarNucleus) { entry = 'layers'; reason = { code: 'similar-nuclei', sizes: [main.ids.length, nuclei[1].ids.length] }; }
  else { entry = 'layers'; reason = trace === undefined ? { code: 'dominant-nucleus', size: main.ids.length } : { code: 'dominant-nucleus', size: main.ids.length, covered }; }

  return {
    nuclei,
    loose: comps.filter(c => c.length === 1).map(([id]) => parts.get(id)!),
    prerequisites: x.parts.filter(p => p.kind === 'prerequisite').map(part => ({ part, opens: x.links.find(l => l.from === part.id && l.class === 'prerequisite')?.to })),
    annotations: x.parts.filter(p => p.kind === 'annotation' && p.on).map(part => ({ part, on: part.on! })),
    aside: x.parts.filter(p => p.kind === 'reference' || p.kind === 'procedure'),
    coverage, trace, entry, reason,
  };
}

/** Layers along the bonds' way when they form no cycle (the longest path from where nothing enters), else outward from the root. */
function layered(ids: string[], start: string, bonds: { from: string; to: string }[], adj: Map<string, Set<string>>, first: (id: string) => number): Nucleus {
  const root = ids.includes(start) ? start : ids.reduce((a, b) => first(a) <= first(b) ? a : b);
  const own = new Set(ids), mine = bonds.filter(l => own.has(l.from) && own.has(l.to));
  const indeg = new Map(ids.map(i => [i, 0]));
  for (const l of mine) indeg.set(l.to, indeg.get(l.to)! + 1);
  const layer = new Map<string, number>(), q = ids.filter(i => !indeg.get(i));
  let visited = 0;
  q.forEach(i => layer.set(i, 0));
  while (q.length) {
    const id = q.shift()!; visited++;
    for (const l of mine.filter(b => b.from === id)) {
      layer.set(l.to, Math.max(layer.get(l.to) ?? 0, layer.get(id)! + 1));
      indeg.set(l.to, indeg.get(l.to)! - 1);
      if (!indeg.get(l.to)) q.push(l.to);
    }
  }
  const flow = visited === ids.length;
  if (!flow) {
    layer.clear(); layer.set(root, 0);
    const r = [root];
    while (r.length) { const id = r.shift()!; for (const n of adj.get(id)!) if (!layer.has(n)) { layer.set(n, layer.get(id)! + 1); r.push(n); } }
  }
  return { ids, root, layer, flow, depth: Math.max(...layer.values()) + 1 };
}

/** A nucleus is named after the aspect most of its roles belong to, when the exploration names aspects; else after its root. */
export function nucleusName(x: Pick<Exploration, 'parts' | 'aspects'>, n: Nucleus): string {
  const parts = new Map(x.parts.map(p => [p.id, p])), count = new Map<string, number>();
  for (const id of n.ids) { const a = parts.get(id)?.aspect; if (a) count.set(a, (count.get(a) ?? 0) + 1); }
  const best = [...count].sort((a, b) => b[1] - a[1])[0];
  return (best && x.aspects.find(a => a.id === best[0])?.name) ?? parts.get(n.root)!.name;
}
