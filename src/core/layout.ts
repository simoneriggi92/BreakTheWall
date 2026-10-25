import { JOINT_FAMILY, type Disassembly, type Joint, type Part } from './disassembly';

/**
 * Sizes shared with the renderer. Label width is estimated from a monospaced 11px font,
 * so the renderer must draw joint labels in that font for the geometry to hold.
 */
export const LAYOUT = {
  plate: { w: 176, h: 84 },
  label: { charW: 6.6, h: 18, padX: 6, clear: 6 },
  margin: 40, rankGap: 72, itemGap: { flow: 28, stack: 44 }, lane: 8, sideGap: 56, grow: 24,
} as const;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = [number, number];
/** `flow` runs left to right (mechanisms, stories); `stack` runs bottom to top (arguments). */
export type Orientation = 'flow' | 'stack';
export type LevelLayout = {
  orientation: Orientation;
  plates: { id: string; rect: Rect }[];
  /** One entry per joint of the level, in the same order; points run from `from` to `to`. */
  joints: { from: string; to: string; points: Point[]; label: Rect; returns: boolean }[];
  width: number; height: number;
};

export function labelSize(label: string): { w: number; h: number } {
  return { w: Math.ceil(label.length * LAYOUT.label.charW) + 2 * LAYOUT.label.padX, h: LAYOUT.label.h };
}

type Item = { node?: string; v0: number; size: number };
type Routed = { joint: number; up: string; down: string; dummies: Item[]; reversed: boolean };

/**
 * A pure, deterministic layered layout for one level. Joints that carry the flow (sends-to, causes, leads-to,
 * because, supports, and depends-on read backwards) set the ranks; parts that only attack or limit sit beside
 * their target; parts without joints go to a side column. Long joints pass through reserved lanes, so a line
 * never crosses a plate.
 */
export function layoutLevel(parts: Pick<Part, 'id'>[], joints: Pick<Joint, 'from' | 'to' | 'type' | 'label'>[]): LevelLayout {
  const ids = parts.map(p => p.id);
  const touched = new Set(joints.flatMap(j => [j.from, j.to]));
  const loose = ids.filter(id => !touched.has(id));
  const argument = joints.filter(j => JOINT_FAMILY[j.type] === 'argument').length;
  const orientation: Orientation = joints.length && argument * 2 > joints.length ? 'stack' : 'flow';
  if (!joints.length) return finish(orientation, [], [], loose, []);

  // Side parts: every joint they have attacks or limits one host. At most two fit beside a host.
  const side = new Map<string, { host: string; joint: number }>();
  const perHost = new Map<string, number>();
  for (const id of ids) {
    const own = joints.map((j, i) => ({ j, i })).filter(({ j }) => j.from === id || j.to === id);
    if (!own.length || !own.every(({ j }) => j.type === 'attacks' || j.type === 'limits')) continue;
    const { j, i } = own[0];
    const host = j.from === id ? j.to : j.from;
    if (side.has(host) || (perHost.get(host) ?? 0) >= 2 || own.some(({ j }) => (j.from === id ? j.to : j.from) !== host)) continue;
    side.set(id, { host, joint: i }); perHost.set(host, (perHost.get(host) ?? 0) + 1);
  }
  const sideJoints = new Set([...side.values()].map(x => x.joint));
  const main = ids.filter(id => touched.has(id) && !side.has(id));

  // Rank edges point downstream; depends-on is read backwards (the dependency comes first). Cycles are broken
  // by reversing back edges found depth-first in input order, so a rollback can return to an earlier step.
  const edges: { joint: number; up: string; down: string; reversed: boolean }[] = [];
  joints.forEach((j, i) => {
    if (sideJoints.has(i)) return;
    const backwards = j.type === 'depends-on';
    edges.push({ joint: i, up: backwards ? j.to : j.from, down: backwards ? j.from : j.to, reversed: backwards });
  });
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const e of edges.filter(e => e.up === id)) {
      if (state.get(e.down) === 'open') { [e.up, e.down] = [e.down, e.up]; e.reversed = !e.reversed; }
      else if (!state.has(e.down)) visit(e.down);
    }
    state.set(id, 'done');
  };
  main.forEach(id => { if (!state.has(id)) visit(id); });

  const rank = new Map(main.map(id => [id, 0]));
  for (let pass = 0; pass < main.length; pass++) {
    for (const e of edges) rank.set(e.down, Math.max(rank.get(e.down)!, rank.get(e.up)! + 1));
  }
  // A part that only feeds others sits just before the earliest of them, not at the far left.
  for (const id of main) {
    const out = edges.filter(e => e.up === id);
    if (out.length && !edges.some(e => e.down === id)) rank.set(id, Math.min(...out.map(e => rank.get(e.down)!)) - 1);
  }
  const low = Math.min(...rank.values());
  for (const id of main) rank.set(id, rank.get(id)! - low);
  const ranks = Math.max(...rank.values()) + 1;

  // Layers of nodes and lane dummies, ordered by barycenters over a few sweeps; ties keep input order.
  const routed: Routed[] = edges.map(e => ({ ...e, dummies: [] }));
  const layers: Item[][] = Array.from({ length: ranks }, () => []);
  main.forEach(id => layers[rank.get(id)!].push({ node: id, v0: 0, size: 0 }));
  for (const e of routed) for (let r = rank.get(e.up)! + 1; r < rank.get(e.down)!; r++) {
    const dummy: Item = { v0: 0, size: LAYOUT.lane };
    e.dummies.push(dummy); layers[r].push(dummy);
  }
  const neighbours = (item: Item, r: number, dir: -1 | 1): Item[] => {
    const out: Item[] = [];
    for (const e of routed) {
      const chain: Item[] = [layers[rank.get(e.up)!].find(x => x.node === e.up)!, ...e.dummies, layers[rank.get(e.down)!].find(x => x.node === e.down)!];
      const at = chain.indexOf(item);
      if (at >= 0 && chain[at + dir] && layers[r + dir]?.includes(chain[at + dir])) out.push(chain[at + dir]);
    }
    return out;
  };
  for (let sweep = 0; sweep < 4; sweep++) {
    const dir = sweep % 2 ? 1 : -1;
    for (let k = 1; k < ranks; k++) {
      const r = dir === -1 ? k : ranks - 1 - k;
      const other = layers[r + dir];
      const score = (x: Item, i: number) => {
        const n = neighbours(x, r, dir as -1 | 1).map(y => other.indexOf(y));
        return n.length ? n.reduce((a, b) => a + b, 0) / n.length : i;
      };
      const scored = layers[r].map((x, i) => ({ x, i, s: score(x, i) }));
      layers[r] = scored.sort((a, b) => a.s - b.s || a.i - b.i).map(y => y.x);
    }
  }
  // Side parts sit right after their host, the second one right before it.
  for (const [id, { host }] of side) {
    const layer = layers[rank.get(host)!];
    const at = layer.findIndex(x => x.node === host);
    const placed = layer.some(x => x.node && side.get(x.node)?.host === host);
    layer.splice(placed ? at : at + 1, 0, { node: id, v0: 0, size: 0 });
    rank.set(id, rank.get(host)!);
  }
  const sideRoutes = [...side].map(([id, s]) => ({ id, ...s }));
  return finish(orientation, layers, routed, loose, sideRoutes, rank, joints);
}

function finish(
  orientation: Orientation, layers: Item[][], routed: Routed[], loose: string[],
  sideRoutes: { id: string; host: string; joint: number }[],
  rank = new Map<string, number>(), joints: Pick<Joint, 'from' | 'to' | 'label'>[] = [],
): LevelLayout {
  const P = LAYOUT.plate; const flow = orientation === 'flow';
  const extentU = flow ? P.w : P.h; const plateV = flow ? P.h : P.w;
  const pad = LAYOUT.label.clear;
  // A label's extent along the rank axis (u) and across it (v).
  const lu = (j: number) => { const s = labelSize(joints[j].label); return flow ? s.w : s.h; };
  const lv = (j: number) => { const s = labelSize(joints[j].label); return flow ? s.h : s.w; };
  const gaps = Array.from({ length: Math.max(0, layers.length - 1) }, () => LAYOUT.rankGap as number);
  for (const e of routed) { const r = rank.get(e.up)!; gaps[r] = Math.max(gaps[r], lu(e.joint) + 2 * pad); }
  const sideOf = new Map(sideRoutes.map(s => [s.id, s]));

  // Across the ranks: stack each layer, then centre it on the axis.
  for (const layer of layers) {
    let cursor = 0;
    layer.forEach((item, i) => {
      if (item.node) item.size = plateV;
      item.v0 = cursor;
      const next = layer[i + 1];
      if (!next) return;
      const pair = [item.node, next.node].map(x => x && sideOf.get(x)).find(s => s && (s.host === item.node || s.host === next.node));
      cursor += item.size + Math.max(LAYOUT.itemGap[orientation], pair ? lv(pair.joint) + 2 * pad : 0);
    });
    const total = cursor + (layer.at(-1)?.size ?? 0);
    layer.forEach(item => { item.v0 -= total / 2; });
  }
  const find = (id: string) => layers[rank.get(id)!].find(x => x.node === id)!;

  for (let attempt = 0; ; attempt++) {
    const uStart: number[] = [];
    layers.forEach((_, r) => { uStart.push(r ? uStart[r - 1] + extentU + gaps[r - 1] : 0); });
    // Ports: the joints on one face are spread along it, ordered by where their other end lies.
    const faces = new Map<string, { joint: number; other: number }[]>();
    const attach = (node: string, face: 'in' | 'out', joint: number, other: number) => {
      const key = `${node}:${face}`; faces.set(key, [...faces.get(key) ?? [], { joint, other }]);
    };
    const centre = (x: Item) => x.v0 + x.size / 2;
    for (const e of routed) {
      const up = find(e.up); const down = find(e.down);
      attach(e.up, 'out', e.joint, centre(e.dummies[0] ?? down));
      attach(e.down, 'in', e.joint, centre(e.dummies.at(-1) ?? up));
    }
    const port = (node: string, face: 'in' | 'out', joint: number) => {
      const item = find(node); const list = [...faces.get(`${node}:${face}`)!].sort((a, b) => a.other - b.other || a.joint - b.joint);
      const inset = Math.min(14, item.size / 4);
      return item.v0 + inset + (item.size - 2 * inset) * (list.findIndex(x => x.joint === joint) + 1) / (list.length + 1);
    };
    const lines: { joint: number; points: Point[]; label?: [number, number, number, number] }[] = [];
    const placed: [number, number, number, number][] = [];
    const overlaps = (a: number[], b: number[]) => a[0] < b[0] + b[2] + pad && b[0] < a[0] + a[2] + pad && a[1] < b[1] + b[3] + pad && b[1] < a[1] + a[3] + pad;
    // Side joints first: their label sits in the gap between host and side part.
    for (const s of sideRoutes) {
      const host = find(s.host); const part = find(s.id);
      const u = uStart[rank.get(s.host)!] + extentU / 2;
      const [a, b] = host.v0 < part.v0 ? [host.v0 + host.size, part.v0] : [host.v0, part.v0 + part.size];
      const fromHost = joints[s.joint].from === s.host;
      const box: [number, number, number, number] = [u - lu(s.joint) / 2, (a + b) / 2 - lv(s.joint) / 2, lu(s.joint), lv(s.joint)];
      placed.push(box);
      lines.push({ joint: s.joint, points: fromHost ? [[u, a], [u, b]] : [[u, b], [u, a]], label: box });
    }
    const grow = new Set<number>();
    for (const e of routed) {
      const r = rank.get(e.up)!;
      const points: Point[] = [[uStart[r] + extentU, port(e.up, 'out', e.joint)]];
      e.dummies.forEach((d, k) => { const ur = uStart[r + 1 + k]; points.push([ur, centre(d)], [ur + extentU, centre(d)]); });
      points.push([uStart[rank.get(e.down)!], port(e.down, 'in', e.joint)]);
      // The label slides along the first gap's segment, from its middle outwards, until it touches no other label.
      const [[u1, v1], [u2, v2]] = points;
      const w = lu(e.joint); const h = lv(e.joint);
      const lo = u1 + pad + w / 2; const hi = u2 - pad - w / 2;
      let box: [number, number, number, number] | undefined;
      if (hi >= lo) {
        const steps = 12;
        const tries = Array.from({ length: steps + 1 }, (_, i) => lo + (hi - lo) * i / steps).sort((a, b) => Math.abs(a - (lo + hi) / 2) - Math.abs(b - (lo + hi) / 2) || a - b);
        for (const u of tries) {
          const v = v1 + (v2 - v1) * (u - u1) / (u2 - u1);
          const candidate: [number, number, number, number] = [u - w / 2, v - h / 2, w, h];
          if (!placed.some(p => overlaps(candidate, p))) { box = candidate; break; }
        }
      }
      if (!box) { grow.add(r); continue; }
      placed.push(box);
      lines.push({ joint: e.joint, points: e.reversed ? [...points].reverse() : points, label: box });
    }
    if (grow.size && attempt < 40) { grow.forEach(r => { gaps[r] += LAYOUT.grow; }); continue; }
    return toScreen(orientation, layers, lines, loose, joints, uStart, extentU);
  }
}

function toScreen(
  orientation: Orientation, layers: Item[][], lines: { joint: number; points: Point[]; label?: [number, number, number, number] }[],
  loose: string[], joints: Pick<Joint, 'from' | 'to' | 'label'>[], uStart: number[], extentU: number,
): LevelLayout {
  const flow = orientation === 'flow'; const P = LAYOUT.plate;
  const pt = ([u, v]: Point): Point => flow ? [u, v] : [v, -u];
  const rect = (u0: number, v0: number, du: number, dv: number): Rect => flow ? { x: u0, y: v0, w: du, h: dv } : { x: v0, y: -(u0 + du), w: dv, h: du };
  const plates = layers.flatMap((layer, r) => layer.filter(x => x.node).map(x => ({ id: x.node!, rect: rect(uStart[r], x.v0, extentU, x.size) })));
  let out = lines.map(l => ({ joint: l.joint, points: l.points.map(pt), label: l.label ? rect(l.label[0], l.label[1], l.label[2], l.label[3]) : { x: 0, y: 0, w: 0, h: 0 } }));
  const boxes = [...plates.map(p => p.rect), ...out.map(l => l.label)];
  // Parts without joints: a side column to the right, or a small grid when the level has no joints at all.
  const right = boxes.length ? Math.max(...boxes.map(b => b.x + b.w)) + LAYOUT.sideGap : 0;
  const top = boxes.length ? Math.min(...boxes.map(b => b.y)) : 0;
  const columns = boxes.length ? 1 : Math.min(3, loose.length);
  loose.forEach((id, i) => plates.push({ id, rect: { x: right + (i % columns) * (P.w + LAYOUT.sideGap), y: top + Math.floor(i / columns) * (P.h + LAYOUT.itemGap.flow), w: P.w, h: P.h } }));
  const all = [...plates.map(p => p.rect), ...out.map(l => l.label)];
  const dx = LAYOUT.margin - Math.min(...all.map(b => b.x)); const dy = LAYOUT.margin - Math.min(...all.map(b => b.y));
  const move = (r: Rect): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
  const placedPlates = plates.map(p => ({ id: p.id, rect: move(p.rect) }));
  out = out.map(l => ({ ...l, points: l.points.map(([x, y]): Point => [x + dx, y + dy]), label: move(l.label) }));
  const byJoint = new Map(out.map(l => [l.joint, l]));
  const placedJoints = joints.map((j, i) => {
    const l = byJoint.get(i)!;
    // A joint that runs against the reading direction is drawn as a return.
    const [a, b] = [l.points[0], l.points.at(-1)!];
    return { from: j.from, to: j.to, points: l.points, label: l.label, returns: flow ? b[0] < a[0] : b[1] > a[1] };
  });
  const finalBoxes = [...placedPlates.map(p => p.rect), ...placedJoints.map(j => j.label)];
  return {
    orientation, plates: placedPlates, joints: placedJoints,
    width: Math.ceil(Math.max(...finalBoxes.map(b => b.x + b.w)) + LAYOUT.margin),
    height: Math.ceil(Math.max(...finalBoxes.map(b => b.y + b.h)) + LAYOUT.margin),
  };
}

/** Every level of a disassembly: the whole (`root`) and each sub-assembly, keyed by its part id. */
export function layoutDisassembly(d: Pick<Disassembly, 'parts' | 'joints'>): Map<string, LevelLayout> {
  const out = new Map<string, LevelLayout>([['root', layoutLevel(d.parts, d.joints)]]);
  const walk = (parts: Part[]) => parts.forEach(p => { if (p.parts) { out.set(p.id, layoutLevel(p.parts, p.joints ?? [])); walk(p.parts); } });
  walk(d.parts);
  return out;
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Liang–Barsky clipping: does the segment enter the rectangle's interior? */
function crosses([x1, y1]: Point, [x2, y2]: Point, r: Rect): boolean {
  const e = 0.5; const left = r.x + e, right = r.x + r.w - e, topY = r.y + e, bottom = r.y + r.h - e;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x1 - left], [dx, right - x1], [-dy, y1 - topY], [dy, bottom - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}
/** Geometry findings for one level: overlapping plates or labels, and joint lines that cross a plate. */
export function layoutFindings(level: LevelLayout): string[] {
  const out: string[] = [];
  const { plates, joints } = level;
  plates.forEach((a, i) => plates.slice(i + 1).forEach(b => { if (overlap(a.rect, b.rect)) out.push(`Plates ${a.id} and ${b.id} overlap`); }));
  joints.forEach((a, i) => {
    joints.slice(i + 1).forEach(b => { if (overlap(a.label, b.label)) out.push(`Labels «${a.from} → ${a.to}» and «${b.from} → ${b.to}» overlap`); });
    plates.forEach(p => { if (overlap(a.label, p.rect)) out.push(`Label «${a.from} → ${a.to}» overlaps plate ${p.id}`); });
    for (let k = 1; k < a.points.length; k++) for (const p of plates) {
      if (p.id !== a.from && p.id !== a.to && crosses(a.points[k - 1], a.points[k], p.rect)) out.push(`Joint ${a.from} → ${a.to} crosses plate ${p.id}`);
    }
    // A line may leave its own plates only through their edges, never through their interior.
    for (let k = 2; k < a.points.length - 1; k++) for (const p of plates.filter(p => p.id === a.from || p.id === a.to)) {
      if (crosses(a.points[k - 1], a.points[k], p.rect)) out.push(`Joint ${a.from} → ${a.to} crosses its own plate ${p.id}`);
    }
  });
  for (const r of [...plates.map(p => p.rect), ...joints.map(j => j.label)]) {
    if (r.x < 0 || r.y < 0 || r.x + r.w > level.width || r.y + r.h > level.height) { out.push('Drawing exceeds the sheet'); break; }
  }
  return out;
}
