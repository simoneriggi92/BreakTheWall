import type { Joint, Part } from './disassembly';

/**
 * The atlas layout (P-20261103-lab-mode L4), in plan coordinates (x to the right, y into the depth). A region per
 * top-level part; its sub-parts are regions inside its perimeter, so the perimeter means "contains". The most joined
 * part is the centre and the largest; the others take the side given by their relation to it: what supports it in
 * front, what follows from it behind, limits on the left, attacks on the right, mechanism joints by direction. A part
 * joined only to a placed part goes beyond it; a part with no joint lies apart. Distance and size mean nothing.
 * The drawing compresses depth to about a third, so regions and gaps are deeper than wide. Pure and deterministic.
 */
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }
export interface Region extends Ellipse { id: string; apart: boolean; kids: (Ellipse & { id: string })[] }
type J = Pick<Joint, 'from' | 'to' | 'type'>;
type Side = 'front' | 'back' | 'left' | 'right';

const size = (p: Pick<Part, 'parts'>) => { const n = p.parts?.length ?? 0; return n ? { rx: 96 + n * 30, ry: 150 + n * 12 } : { rx: 70, ry: 104 }; };

function sideOf(j: J, id: string): Side {
  const from = j.from === id;
  if (j.type === 'supports' || j.type === 'because') return from ? 'front' : 'back';
  if (j.type === 'limits') return 'left';
  if (j.type === 'attacks') return 'right';
  if (j.type === 'sends-to' || j.type === 'causes' || j.type === 'leads-to') return from ? 'left' : 'right';
  return from ? 'back' : 'front';
}

/** Sub-regions inside the perimeter: one row up to three, two rows above, all within 85% of the parent's radii. */
export function kidsOf(parts: Pick<Part, 'id'>[], A: Ellipse): (Ellipse & { id: string })[] {
  const n = parts.length; if (!n) return [];
  const rows = n > 3 ? 2 : 1, cols = Math.ceil(n / rows), w = (A.rx * 1.5) / cols, h = (A.ry * 1.2) / rows;
  return parts.map((q, k) => {
    const r = Math.floor(k / cols), c = k % cols, inRow = Math.min(cols, n - r * cols), off = (cols - inRow) * w / 2;
    const cx = A.cx - A.rx * 0.75 + off + w * (c + 0.5), cy = A.cy - A.ry * 0.1 + (rows === 1 ? 0 : ((rows - 1) / 2 - r) * h);
    return { id: q.id, cx, cy, rx: w * 0.42, ry: h * (rows === 1 ? 0.36 : 0.4) };
  });
}

export function atlasLayout(parts: Pick<Part, 'id' | 'kind' | 'parts'>[], joints: J[]): Region[] {
  const ids = parts.map(p => p.id), byId = new Map(parts.map(p => [p.id, p])), js = joints.filter(j => ids.includes(j.from) && ids.includes(j.to));
  const degree = (id: string) => js.filter(j => j.from === id || j.to === id).length;
  const center = [...ids].sort((a, b) => degree(b) - degree(a) || Number(byId.get(b)!.kind === 'conclusion') - Number(byId.get(a)!.kind === 'conclusion') || ids.indexOf(a) - ids.indexOf(b))[0];
  const C = size(byId.get(center)!), placed = new Map<string, Ellipse & { apart?: boolean }>([[center, { cx: 0, cy: 0, rx: C.rx * 1.45, ry: C.ry * 1.3 }]]);
  const sides: Record<Side, string[]> = { front: [], back: [], left: [], right: [] }, loose: string[] = [];
  for (const id of ids) {
    if (id === center) continue;
    const j = js.find(j => (j.from === id && j.to === center) || (j.to === id && j.from === center));
    if (j) sides[sideOf(j, id)].push(id); else loose.push(id);
  }
  const c = placed.get(center)!;
  for (const [s, list] of Object.entries(sides) as [Side, string[]][]) list.forEach((id, k) => {
    const R = size(byId.get(id)!), spread = k - (list.length - 1) / 2;
    if (s === 'front') placed.set(id, { ...R, cx: spread * (R.rx * 2 + 70), cy: -(c.ry + R.ry + 150) });
    if (s === 'back') placed.set(id, { ...R, cx: spread * (R.rx * 2 + 70), cy: c.ry + R.ry + 150 });
    if (s === 'left') placed.set(id, { ...R, cx: -(c.rx + R.rx + 80), cy: spread * (R.ry * 2 + 120) });
    if (s === 'right') placed.set(id, { ...R, cx: c.rx + R.rx + 80, cy: spread * (R.ry * 2 + 120) });
  });
  let apart = 0; const beyond = new Map<string, number>();
  for (const id of loose) {
    const R = size(byId.get(id)!), j = js.find(j => (j.from === id && placed.has(j.to)) || (j.to === id && placed.has(j.from)));
    if (j) {
      // parts beyond the same neighbour stand one after another, further out
      const n = j.from === id ? j.to : j.from, o = placed.get(n)!, k = beyond.get(n) ?? 0, dx = Math.sign(o.cx) || 1, dy = Math.sign(o.cy) || 1;
      beyond.set(n, k + 1);
      placed.set(id, { ...R, cx: o.cx + dx * (o.rx + R.rx + 60 + k * (R.rx * 2 + 60)), cy: o.cy + dy * 60 });
    }
    else placed.set(id, { ...R, cx: c.rx + R.rx + 140, cy: -(c.ry + R.ry + 150) - apart++ * 240, apart: true });
  }
  // nothing may overlap: regions are pushed apart along the line between their centres; the centre stays
  const metric = 0.68;
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const A = placed.get(ids[a])!, B = placed.get(ids[b])!, same = A.cx === B.cx && A.cy === B.cy, dx = same ? 1 : B.cx - A.cx, dy = same ? 0 : (B.cy - A.cy) * metric, d = Math.hypot(dx, dy);
      const need = Math.max(A.rx, A.ry * metric) + Math.max(B.rx, B.ry * metric) + 40;
      if (d >= need) continue;
      moved = true;
      const m = (need - d) / 2, ux = dx / d, uy = dy / d / metric;
      const fa = ids[a] === center ? 0 : ids[b] === center ? 2 : 1, fb = ids[b] === center ? 0 : ids[a] === center ? 2 : 1;
      A.cx -= ux * m * fa; A.cy -= uy * m * fa; B.cx += ux * m * fb; B.cy += uy * m * fb;
    }
    if (!moved) break;
  }
  return ids.map(id => { const e = placed.get(id)!; return { id, cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, apart: !!e.apart, kids: kidsOf(byId.get(id)!.parts ?? [], e) }; });
}

/** Whether ellipse `k` lies inside ellipse `p`, sampled on its outline. */
export function inside(k: Ellipse, p: Ellipse): boolean {
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * 2 * Math.PI, x = k.cx + k.rx * Math.cos(a), y = k.cy + k.ry * Math.sin(a);
    if (((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 > 1) return false;
  }
  return true;
}
/** Whether two regions overlap, in the same metric the layout uses. */
export function overlaps(A: Ellipse, B: Ellipse): boolean {
  const metric = 0.68, d = Math.hypot(B.cx - A.cx, (B.cy - A.cy) * metric);
  return d < Math.max(A.rx, A.ry * metric) + Math.max(B.rx, B.ry * metric) + 39;
}
