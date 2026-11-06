import { firstLine, type Exploration } from './exploration';
import type { Nucleus, Shape } from './exploration-shape';

/**
 * The layout of the structure (plan P-20261105-exploration X4). Positions are numbers, so the renderer only draws:
 * each open nucleus's layers as rows with a labelled strip each, closed nuclei as islands, the premise on a row of its
 * own at the top, prerequisites above the part they open, and joint labels placed clear of blocks and of each other.
 */
export const NODE_HEIGHT = 46;
/** E's spacing (owner, 2026-11-06): the whole has wider gaps than a sub-level. */
export const SPACING = {
  whole: { width: 184, gap: 120, row: 200 },
  sub: { width: 172, gap: 110, row: 180 },
} as const;

export type Box = { x: number; y: number; w: number; h: number };
export type Strip = Box & { nucleus?: number; layer?: number; ghost?: boolean; count?: number; premise?: boolean };
export type Island = Box & { nucleus: number; open: boolean };
export type Layout = { pos: Record<string, Box & { pre?: boolean }>; strips: Strip[]; islands: Island[]; width: number; height: number };
export type LayoutOptions = {
  /** The nuclei drawn open; the others are islands. All by default. */
  open?: Set<number>;
  visible?: (id: string) => boolean;
  /** One labelled strip per layer, with a gutter for its label. */
  bands?: boolean;
  /** The next layer, still closed, as an empty strip that says how many parts it holds. */
  ghost?: { nucleus: number; layer: number; count: number } | null;
  spacing?: { width: number; gap: number; row: number };
  heightOf?: (id: string) => number;
  /** The source's starting point (X5): a row of its own above everything, prerequisites included. */
  premise?: string | null;
};

type Shaped = Pick<Shape, 'nuclei' | 'prerequisites'>;

export function layoutOf(x: Pick<Exploration, 'parts' | 'links'>, shape: Shaped, o: LayoutOptions = {}): Layout {
  const { open = new Set(shape.nuclei.map((_, i) => i)), visible = () => true, bands = false, ghost = null, spacing = SPACING.whole, heightOf = () => NODE_HEIGHT, premise = null } = o;
  const { width: w, gap: gx, row } = spacing, parts = new Map(x.parts.map(p => [p.id, p]));
  const first = (id: string) => firstLine(parts.get(id)!);
  const pos: Layout['pos'] = {}, islands: Island[] = [], strips: Strip[] = [], gut = bands ? 40 : 0, gap = row - NODE_HEIGHT;
  const hasPremise = !!premise && visible(premise);
  const pres = shape.prerequisites.map(p => p.part).filter(p => visible(p.id) && p.id !== premise);
  const y0 = hasPremise ? 14 + heightOf(premise!) + 76 : 14;
  const top = pres.length ? y0 + Math.max(...pres.map(p => heightOf(p.id))) + 64 : hasPremise ? y0 + 16 : 24;
  let x0 = 20, bottom = top;

  shape.nuclei.forEach((n: Nucleus, i) => {
    if (!open.has(i)) { islands.push({ nucleus: i, x: x0, y: top, w: 190, h: 76, open: false }); x0 += 230; bottom = Math.max(bottom, top + 76); return; }
    const rows: string[][] = [];
    for (const id of n.ids) if (visible(id)) (rows[n.layer.get(id)!] ??= []).push(id);
    const width = Math.max(1, ...rows.map(r => r?.length ?? 0)) * (w + gx) - gx;
    const gk = ghost && ghost.nucleus === i && !rows[ghost.layer] ? ghost.layer : -1, last = Math.max(rows.length - 1, gk);
    // the top of each row: earlier rows' tallest node plus the gap
    const ys: number[] = []; let y = top;
    for (let k = 0; k <= last; k++) { ys[k] = y; y += (rows[k] ? Math.max(...rows[k].map(heightOf)) : NODE_HEIGHT) + gap; }
    rows.forEach((r, k) => {
      if (!r) return;
      r.sort((a, b) => first(a) - first(b));
      const rw = r.length * (w + gx) - gx, hk = Math.max(...r.map(heightOf));
      r.forEach((id, j) => { pos[id] = { x: x0 + gut + (width - rw) / 2 + j * (w + gx), y: ys[k], w, h: heightOf(id) }; bottom = Math.max(bottom, ys[k] + heightOf(id)); });
      if (bands) strips.push({ nucleus: i, layer: k, x: x0 - 6, y: ys[k] - 12, w: width + gut + 12, h: hk + 24 });
    });
    if (bands && gk >= 0) { strips.push({ nucleus: i, layer: gk, x: x0 - 6, y: ys[gk] - 12, w: width + gut + 12, h: NODE_HEIGHT + 24, ghost: true, count: ghost!.count }); bottom = Math.max(bottom, ys[gk] + NODE_HEIGHT); }
    islands.push({ nucleus: i, x: x0 - 12, y: top - 30, w: width + gut + 24, h: bottom - top + 52, open: true });
    x0 += width + gut + 90;
  });

  // prerequisites: above the part they open, pushed right so they never overlap
  const opens = (id: string) => x.links.find(l => l.from === id && l.class === 'prerequisite')?.to;
  const want = pres.map(p => ({ p, at: pos[opens(p.id) ?? '']?.x ?? 20 })).sort((a, b) => a.at - b.at);
  let px = 20;
  for (const { p, at } of want) { const xx = Math.max(at, px); pos[p.id] = { x: xx, y: y0, w, h: heightOf(p.id), pre: true }; px = xx + w + gx / 2; }
  const width = Math.max(x0, px, w + 80) + 20;
  // the premise: left-aligned, so it keeps its place at every step (owner, 2026-11-06)
  if (hasPremise) {
    const ph = heightOf(premise!);
    pos[premise!] = { x: 20 + gut, y: 14, w, h: ph, pre: true };
    if (bands) strips.push({ premise: true, x: 8, y: 2, w: width - 16, h: ph + 24 });
  }
  return { pos, strips, islands, width, height: bottom + 40 };
}

/** The way a joint runs on screen, from the block that acts to the one acted on: the arrow inside its label. */
export type Way = '→' | '←' | '↓' | '↑';
export type JointGeometry = { from: [number, number]; to: [number, number]; mid: [number, number]; way: Way };

/** A joint between two boxes: side to side on one row, else bottom to top. The midpoint anchors the label. */
export function jointGeometry(a: Box, b: Box): JointGeometry {
  let from: [number, number], to: [number, number];
  if (Math.abs(a.y - b.y) < 4) { const right = a.x < b.x; from = [right ? a.x + a.w : a.x, a.y + a.h / 2]; to = [right ? b.x : b.x + b.w, b.y + b.h / 2]; }
  else { const down = a.y < b.y; from = [a.x + a.w / 2, down ? a.y + a.h : a.y]; to = [b.x + b.w / 2, down ? b.y : b.y + b.h]; }
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const way: Way = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
  return { from, to, mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], way };
}

export type LabelBox = {
  key: string;
  /** The joint's midpoint. */
  mid: [number, number];
  w: number;
  h: number;
  /** A lit label (its block is chosen) is placed first, at its own size. */
  lit?: boolean;
  /** A label the reader moved keeps its offset from the midpoint. */
  moved?: [number, number];
};

/** Candidate offsets around a midpoint, nearest first. */
const TRIES: [number, number][] = [[0, 0]];
for (let r = 1; r <= 10; r++) TRIES.push([0, -24 * r], [0, 24 * r], [70 * r, 0], [-70 * r, 0], [60 * r, -22 * r], [-60 * r, 22 * r], [60 * r, 22 * r], [-60 * r, -22 * r]);

/**
 * Each label's offset from its joint's midpoint: lit labels first, then the others, each at the nearest position that
 * covers no block and no label already placed; if none is free it stays on its midpoint. A moved label keeps its offset.
 */
export function placeLabels(blocks: Box[], labels: LabelBox[]): Map<string, [number, number]> {
  const taken = blocks.map(b => ({ x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 }));
  const hit = (b: Box) => taken.some(o => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  const out = new Map<string, [number, number]>();
  for (const l of [...labels].sort((a, b) => Number(!!b.lit) - Number(!!a.lit))) {
    const box = ([dx, dy]: [number, number]) => ({ x: l.mid[0] + dx - l.w / 2, y: l.mid[1] + dy - l.h / 2, w: l.w, h: l.h });
    const off = l.moved ?? TRIES.find(t => !hit(box(t))) ?? [0, 0];
    const b = box(off); taken.push({ x: b.x - 4, y: b.y - 3, w: b.w + 8, h: b.h + 6 });
    out.set(l.key, off);
  }
  return out;
}
