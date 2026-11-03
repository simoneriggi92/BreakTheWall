import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Drawing primitives for the lab (P-20261103-lab-mode L5): a cabinet projection, where front faces stay almost
 * frontal so that what is drawn on them reads, and depth is compressed to about a third. Plan coordinates: x to the
 * right, y into the depth, z up. Colours come from the theme through CSS variables (lab.css).
 */
export const KX = [0.95, 0.16] as const, KY = [0.46, -0.34] as const;
/** The direction towards the viewer, in plan: a wall facing it is drawn, one facing away is hidden. */
export const VIEW = [1, -2.065] as const;
export type Pt = [number, number];
export const P = (x: number, y: number, z = 0): Pt => [x * KX[0] + y * KY[0], x * KX[1] + y * KY[1] - z];
export const f1 = (n: number) => Math.round(n * 10) / 10;
export const pts = (ps: Pt[]) => ps.map(p => `${f1(p[0])},${f1(p[1])}`).join(' ');
const mat = (a: number, b: number, c: number, d: number, [e, f]: Pt) => `matrix(${a},${b},${c},${d},${f1(e)},${f1(f)})`;
/** Transforms that put a 2D drawing on a box's front face, or on a horizontal plane, at (x, y, z). */
export const onFront = (x: number, y: number, z: number) => mat(KX[0], KX[1], 0, 1, P(x, y, z));
export const onTop = (x: number, y: number, z: number) => mat(KX[0], KX[1], -KY[0], -KY[1], P(x, y, z));

export type Material = 'steel' | 'ivory' | 'dark' | 'alu' | 'glass' | 'amber' | 'coral';
/** A box: the right side, the top and the front, painted in that order. */
export function Box({ x, y, z, w, d, h, m }: { x: number; y: number; z: number; w: number; d: number; h: number; m: Material }) {
  const front = [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)], side = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  return <g className={`lab-box m-${m}`}><polygon className="lab-s" points={pts(side)}/><polygon className="lab-t" points={pts(top)}/><polygon className="lab-f" points={pts(front)}/></g>;
}
/** A raised region with an irregular outline: the walls that face the viewer, then the top. */
export function Plateau({ outline, z, h, className = '' }: { outline: Pt[]; z: number; h: number; className?: string }) {
  const walls: { depth: number; q: Pt[] }[] = [];
  outline.forEach((a, k) => {
    const b = outline[(k + 1) % outline.length], nx = b[1] - a[1], ny = -(b[0] - a[0]);
    if (nx * VIEW[0] + ny * VIEW[1] <= 0) return;
    walls.push({ depth: (a[0] + b[0]) * VIEW[0] + (a[1] + b[1]) * VIEW[1], q: [P(a[0], a[1], z), P(b[0], b[1], z), P(b[0], b[1], z + h), P(a[0], a[1], z + h)] });
  });
  walls.sort((u, v) => u.depth - v.depth);
  return <g className={`lab-plateau ${className}`}>{walls.map((w, i) => <polygon key={i} className="lab-f" points={pts(w.q)}/>)}<polygon className="lab-t" points={pts(outline.map(([x, y]) => P(x, y, z + h)))}/></g>;
}
/** The outline of a region on a plane at height z: dashed for a part not yet read, or for the place an opened part left. */
export const Ring = ({ outline, z, className }: { outline: Pt[]; z: number; className: string }) => <polygon className={className} points={pts(outline.map(([x, y]) => P(x, y, z)))}/>;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** A deterministic irregular outline around an ellipse, always within 87–113% of its radii. */
export function blob(seed: string, cx: number, cy: number, rx: number, ry: number, n = 18): Pt[] {
  const s = hash(seed);
  return Array.from({ length: n }, (_, k) => { const a = k / n * 2 * Math.PI, f = 1 + 0.08 * Math.sin(3 * a + s % 7) + 0.05 * Math.sin(5 * a + s % 11); return [cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)] as Pt; });
}
/** A cable between two screen points that arcs upward; `mid` is where its label goes. */
export function cable(a: Pt, b: Pt, lift = 40, t = 0.5): { d: string; mid: Pt } {
  const l = lift + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.1, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { d: `M${f1(a[0])},${f1(a[1])} C${f1(a[0])},${f1(a[1] - l)} ${f1(b[0])},${f1(b[1] - l)} ${f1(b[0])},${f1(b[1])}`, mid: [w[0] * a[0] + w[1] * a[0] + w[2] * b[0] + w[3] * b[0], w[0] * a[1] + w[1] * (a[1] - l) + w[2] * (b[1] - l) + w[3] * b[1]] };
}
/** Where a ray from an ellipse's centre towards a point leaves it. */
export const edgeOf = (e: { cx: number; cy: number; rx: number; ry: number }, to: { cx: number; cy: number }): [number, number] => {
  const a = Math.atan2((to.cy - e.cy) / e.ry, (to.cx - e.cx) / e.rx); return [e.cx + e.rx * 0.98 * Math.cos(a), e.cy + e.ry * 0.98 * Math.sin(a)];
};
/** A view box around screen points, with a margin. */
export function viewBox(points: Pt[], margin = 24): string {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), x = Math.min(...xs) - margin, y = Math.min(...ys) - margin;
  return `${f1(x)} ${f1(y)} ${f1(Math.max(...xs) - x + margin)} ${f1(Math.max(...ys) - y + margin)}`;
}
/** Labels keep a readable size on screen however small the drawing is shown: their size is set in screen pixels. */
export function useScreenScale(box: string) {
  const ref = useRef<SVGSVGElement>(null), [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const [, , w, h] = box.split(' ').map(Number);
    // the layout box, not the bounding box: a motion's transform must not change the labels' size
    const measure = () => { const r = el.getBoundingClientRect(), cw = el.clientWidth || r.width, ch = el.clientHeight || r.height; if (cw && ch) setScale(Math.min(cw / w, ch / h)); };
    measure(); const o = new ResizeObserver(measure); o.observe(el); return () => o.disconnect();
  }, [box]);
  return { ref, px: (size: number) => size / Math.max(scale, 0.2) };
}
/** How many characters of a label fit across a width in plan units, at a size in screen pixels: names wrap to their module. */
export const charsAcross = (w: number, px: (n: number) => number, size: number, max = 22) => Math.max(8, Math.min(max, Math.floor(w * KX[0] / (px(size) * 0.56))));
/** The same, never narrower than the name's longest word: a word is not broken, it may run a little past its module. */
export const charsFor = (name: string, w: number, px: (n: number) => number, size: number) => Math.max(charsAcross(w, px, size), Math.min(22, Math.max(...name.split(/\s+/).map(x => x.length))));
/** An upright label at a plan point, centred, wrapped into lines. */
export function Label({ at, lines, size, className, lang }: { at: Pt; lines: string[]; size: number; className: string; lang?: string }) {
  const lh = size * 1.2;
  return <text className={className} x={f1(at[0])} y={f1(at[1] - (lines.length - 1) * lh)} textAnchor="middle" lang={lang} style={{ fontSize: size }}>
    {lines.map((l, i) => <tspan key={i} x={f1(at[0])} dy={i ? lh : 0}>{l}</tspan>)}</text>;
}
/** A pill-shaped joint label, in screen pixels; labels that would overlap are moved apart vertically. */
export interface Pill { key: string; at: Pt; text: string; className?: string; onPress?: () => void }
/** A fixed box a pill must keep clear of, such as a part's name: x and y are its centre. */
export interface Obstacle { x: number; y: number; w: number; h: number }
/** The box a name label takes, from its anchor (the bottom line's baseline, centred) and its lines. */
export const labelBox = (at: Pt, lines: string[], size: number): Obstacle => {
  const lh = size * 1.2, w = Math.max(...lines.map(l => l.length)) * size * 0.56 + size, h = lines.length * lh;
  return { x: at[0], y: at[1] - h / 2 + size * 0.3, w, h };
};
export function Pills({ pills, px, obstacles = [] }: { pills: Pill[]; px: (n: number) => number; obstacles?: Obstacle[] }) {
  const h = px(18), placed = pills.map(p => ({ ...p, w: px(p.text.length * 6.2 + 16), y: p.at[1] }));
  const overlap = (ax: number, aw: number, ay: number, ah: number, bx: number, bw: number, by: number, bh: number) =>
    [Math.min(ax + aw / 2, bx + bw / 2) - Math.max(ax - aw / 2, bx - bw / 2), Math.min(ay + ah / 2, by + bh / 2) - Math.max(ay - ah / 2, by - bh / 2)];
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) for (let k = i + 1; k < placed.length; k++) {
      const a = placed[i], b = placed[k], [ox, oy] = overlap(a.at[0], a.w, a.y, h, b.at[0], b.w, b.y, h);
      if (ox > 0 && oy > 0) { const up = a.y <= b.y ? a : b, dn = up === a ? b : a; up.y -= oy / 2 + 1; dn.y += oy / 2 + 1; moved = true; }
    }
    // names stay where they are: a pill over one moves to whichever side of it is nearer
    for (const p of placed) for (const o of obstacles) {
      const [ox, oy] = overlap(p.at[0], p.w, p.y, h, o.x, o.w, o.y, o.h);
      if (ox > 0 && oy > 0) { p.y = p.y <= o.y ? o.y - o.h / 2 - h / 2 - 1 : o.y + o.h / 2 + h / 2 + 1; moved = true; }
    }
    if (!moved) break;
  }
  // a pill still on a name or a tag goes to the nearest height free of all of them, within six half-heights of its joint
  const covers = (p: typeof placed[number], y: number) => obstacles.some(o => { const [ox, oy] = overlap(p.at[0], p.w, y, h, o.x, o.w, o.y, o.h); return ox > 0 && oy > 0; });
  for (const p of placed) if (covers(p, p.y)) {
    const free = Array.from({ length: 12 }, (_, k) => (k >> 1) + 1).map((k, i) => p.y + (i % 2 ? 1 : -1) * k * h / 2).find(y => !covers(p, y));
    if (free !== undefined) p.y = free;
  }
  return <>{placed.map(p => <g key={p.key} className={`lab-pill ${p.className ?? ''}`} transform={`translate(${f1(p.at[0])},${f1(p.y)})`} data-joint={p.key} onClick={p.onPress}>
    <rect x={f1(-p.w / 2)} y={f1(-h / 2)} width={f1(p.w)} height={f1(h)} rx={f1(h / 2)}/><text y={f1(px(4))} textAnchor="middle" style={{ fontSize: px(11.5) }}>{p.text}</text></g>)}</>;
}
/** Keyboard and pointer behaviour shared by every pressable element of a drawing. */
export const pressable = (label: string, onPress?: () => void, selected?: boolean) => ({
  role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': selected,
  onClick: (e: { stopPropagation(): void }) => { e.stopPropagation(); onPress?.(); },
  onKeyDown: (e: { key: string; preventDefault(): void; stopPropagation(): void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPress?.(); } },
});
export type Children = { children?: ReactNode };
