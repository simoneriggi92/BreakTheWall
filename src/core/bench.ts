import type { Joint, Part } from './disassembly';

/**
 * The bench layout (P-20261103-lab-mode L3): the object for a mechanism, in plan coordinates (x to the right, y into
 * the depth). Modules stand in columns by the order of the flows: what sends comes before what receives, what is
 * depended on before what depends on it. In a column, modules stand one behind the other. Each module is moved next
 * to the modules it is joined to. Flows longer than `perBand` columns fold into a further band, so the bench does not
 * grow only in width. Pure and deterministic.
 */
export const BENCH = { depth: 86, minW: 150, perSub: 50, maxSubs: 5, colGap: 58, rowGap: 200, perBand: 3, bandGap: 70, margin: 34 } as const;
/** The cabinet projection the drawing uses, here only to measure a layout's on-screen proportions. */
export const CABINET = { x: [0.95, 0.16], y: [0.46, -0.34], height: 120 } as const;

export interface Module { id: string; x: number; y: number; w: number; d: number }
export interface BenchLayout { modules: Record<string, Module>; area: { x: number; y: number; w: number; d: number } }
type J = Pick<Joint, 'from' | 'to' | 'type'>;

/** A dependency is drawn from what is depended on to what depends: the direction information travels. */
export const flowOf = (j: J): [string, string] => j.type === 'depends-on' ? [j.to, j.from] : [j.from, j.to];
export const moduleWidth = (p: Pick<Part, 'parts'>) => Math.max(BENCH.minW, 40 + BENCH.perSub * Math.min(BENCH.maxSubs, p.parts?.length ?? 0));

/** Longest path along the flows, capped so that a cycle cannot grow without end. */
export function flowLevels(ids: string[], joints: J[]): Record<string, number> {
  const L = Object.fromEntries(ids.map(i => [i, 0])), js = joints.filter(j => ids.includes(j.from) && ids.includes(j.to));
  for (let k = 0; k < ids.length; k++) for (const j of js) { const [u, v] = flowOf(j); if (L[v] < L[u] + 1) L[v] = Math.min(ids.length - 1, L[u] + 1); }
  return L;
}

/** Flow order first, then each part moved next to the parts it is joined to (barycentre), so cables stay short. */
export function flowOrder(ids: string[], joints: J[]): string[] {
  const L = flowLevels(ids, joints), near = Object.fromEntries(ids.map(i => [i, joints.flatMap(j => j.from === i && ids.includes(j.to) ? [j.to] : j.to === i && ids.includes(j.from) ? [j.from] : [])]));
  let order = [...ids].sort((a, b) => L[a] - L[b] || ids.indexOf(a) - ids.indexOf(b));
  for (let it = 0; it < 6; it++) {
    const ix = Object.fromEntries(order.map((i, k) => [i, k])), bc = (i: string) => (ix[i] + near[i].reduce((t, n) => t + ix[n], 0)) / (1 + near[i].length);
    order = [...order].sort((a, b) => bc(a) - bc(b) || ix[a] - ix[b]);
  }
  return order;
}

export function benchLayout(parts: Pick<Part, 'id' | 'parts'>[], joints: J[]): BenchLayout {
  const ids = parts.map(p => p.id), L = flowLevels(ids, joints), order = flowOrder(ids, joints), width = Object.fromEntries(parts.map(p => [p.id, moduleWidth(p)]));
  const levels = [...new Set(ids.map(i => L[i]))].sort((a, b) => a - b);
  const columns = levels.map(l => order.filter(i => L[i] === l));
  const bands = Math.ceil(columns.length / BENCH.perBand), deepest = Math.max(...columns.map(c => c.length));
  const bandDepth = (deepest - 1) * BENCH.rowGap + BENCH.depth + BENCH.bandGap;
  const modules: Record<string, Module> = {};
  // The first band stands at the back, so the flow reads from the top of the screen down. Further bands run back
  // the other way, like a snake: each starts in front of where the band behind it ended, so the flow stays short.
  let end = 0;
  for (let b = 0; b < bands; b++) {
    const y0 = (bands - 1 - b) * bandDepth, cols = columns.slice(b * BENCH.perBand, (b + 1) * BENCH.perBand), back = b % 2 === 1;
    let x = back ? end : 0;
    for (const col of cols) {
      const w = Math.max(...col.map(i => width[i]));
      if (back) x -= w;
      col.forEach((i, r) => { modules[i] = { id: i, x: x + (w - width[i]) / 2, y: y0 + (col.length - 1 - r) * BENCH.rowGap, w: width[i], d: BENCH.depth }; });
      if (back) x -= BENCH.colGap; else x += w + BENCH.colGap;
    }
    end = back ? x + BENCH.colGap : x - BENCH.colGap;
  }
  const all = Object.values(modules), m = BENCH.margin;
  const x0 = Math.min(...all.map(o => o.x)), y0 = Math.min(...all.map(o => o.y));
  return { modules, area: { x: x0 - m, y: y0 - m, w: Math.max(...all.map(o => o.x + o.w)) - x0 + 2 * m, d: Math.max(...all.map(o => o.y + o.d)) - y0 + 2 * m } };
}

/** On-screen width over height of an area in the cabinet projection, with room for the modules' height. */
export function projectedRatio(a: { w: number; d: number }): number {
  return (CABINET.x[0] * a.w + CABINET.y[0] * a.d) / (CABINET.x[1] * a.w - CABINET.y[1] * a.d + CABINET.height);
}

/**
 * An opened level, in one row when it is small, in two rows above five parts: the first half at the back, raised by
 * `z` so that no face is hidden. `widthOf` comes from the drawing, since a component may need more room than a module.
 */
export interface Placed { id: string; x: number; y: number; z: number; w: number }
export function openedLayout(parts: Pick<Part, 'id'>[], joints: J[], widthOf: (id: string) => number, gap = 22): Placed[] {
  const ids = parts.map(p => p.id), order = flowOrder(ids, joints);
  if (ids.length <= 5) { let x = 0; return order.map(id => { const p = { id, x, y: 0, z: 0, w: widthOf(id) }; x += p.w + gap; return p; }); }
  const half = Math.ceil(order.length / 2);
  return [order.slice(0, half), order.slice(half)].flatMap((row, r) => { let x = 0; return row.map(id => { const p = { id, x, y: r ? 0 : 150, z: r ? 0 : 70, w: widthOf(id) }; x += p.w + gap; return p; }); });
}
