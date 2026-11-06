import { describe, expect, it } from 'vitest';
import { jointGeometry, layoutOf, NODE_HEIGHT, placeLabels, type Box } from '../src/core/exploration-layout';
import { shapeOf } from '../src/core/exploration-shape';
import { bakery } from './explorations';

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const pairs = <T>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map(b => [a, b] as const));

describe('the layout (X4)', () => {
  it('places every visible part, with no two nodes overlapping', async () => {
    const x = await bakery(), L = layoutOf(x, shapeOf(x));
    expect(Object.keys(L.pos).sort()).toEqual(['bake', 'counter', 'mix', 'rest', 'staling', 'till']);
    for (const [a, b] of pairs(Object.values(L.pos))) expect(overlap(a, b)).toBe(false);
  });

  it('draws one strip per layer that covers its row, and an empty strip that counts the next layer', async () => {
    const x = await bakery(), s = shapeOf(x);
    const L = layoutOf(x, s, { bands: true, visible: id => ['mix', 'rest'].includes(id), ghost: { nucleus: 0, layer: 2, count: 1 } });
    const strips = L.strips.filter(t => !t.ghost && !t.premise);
    expect(strips.map(t => t.layer)).toEqual([0, 1]);
    for (const t of strips) for (const id of ['mix', 'rest'].filter(i => s.nuclei[0].layer.get(i) === t.layer)) {
      const b = L.pos[id]; expect(b.x >= t.x && b.x + b.w <= t.x + t.w && b.y >= t.y && b.y + b.h <= t.y + t.h).toBe(true);
    }
    expect(L.strips.find(t => t.ghost)).toMatchObject({ layer: 2, count: 1 });
  });

  it('puts the premise on a row of its own above every other block, at the same place at every step', async () => {
    const x = await bakery(), s = shapeOf(x);
    const steps = [['staling'], ['staling', 'mix'], ['staling', 'mix', 'rest', 'bake']];
    const at = steps.map(v => layoutOf(x, s, { bands: true, premise: 'staling', visible: id => v.includes(id) }));
    for (const L of at) {
      const p = L.pos.staling;
      expect(p).toEqual(at[0].pos.staling);
      for (const [id, b] of Object.entries(L.pos)) if (id !== 'staling') expect(b.y).toBeGreaterThan(p.y + p.h + 40);
      expect(L.strips.some(t => t.premise)).toBe(true);
    }
  });

  it('closes a nucleus to an island when it is not open', async () => {
    const x = await bakery(), L = layoutOf(x, shapeOf(x), { open: new Set() });
    expect(L.islands).toEqual([expect.objectContaining({ nucleus: 0, open: false })]);
    expect(L.pos.mix).toBeUndefined();
  });

  it('grows a node with the members shown inside it', async () => {
    const x = await bakery(), L = layoutOf(x, shapeOf(x), { heightOf: id => id === 'mix' ? 120 : NODE_HEIGHT });
    expect(L.pos.mix.h).toBe(120);
    expect(L.pos.rest.y).toBeGreaterThan(L.pos.mix.y + 120);
  });
});

describe('joint labels (X4)', () => {
  it('gives each joint the way it runs on screen', () => {
    const a = { x: 0, y: 0, w: 100, h: 40 };
    expect(jointGeometry(a, { x: 300, y: 0, w: 100, h: 40 }).way).toBe('→');
    expect(jointGeometry({ x: 300, y: 0, w: 100, h: 40 }, a).way).toBe('←');
    expect(jointGeometry(a, { x: 0, y: 200, w: 100, h: 40 }).way).toBe('↓');
    expect(jointGeometry({ x: 0, y: 200, w: 100, h: 40 }, a).way).toBe('↑');
  });

  const placed = (blocks: Box[], labels: Parameters<typeof placeLabels>[1]) => {
    const off = placeLabels(blocks, labels);
    return labels.map(l => { const [dx, dy] = off.get(l.key)!; return { x: l.mid[0] + dx - l.w / 2, y: l.mid[1] + dy - l.h / 2, w: l.w, h: l.h }; });
  };

  it('places the bakery\'s labels clear of blocks and of each other', async () => {
    const x = await bakery(), L = layoutOf(x, shapeOf(x)), blocks = Object.values(L.pos);
    const labels = x.links.filter(l => L.pos[l.from] && L.pos[l.to]).map(l => ({ key: `${l.from}>${l.to}`, mid: jointGeometry(L.pos[l.from], L.pos[l.to]).mid, w: l.label.length * 6.1 + 18, h: 19 }));
    const boxes = placed(blocks, labels);
    for (const [a, b] of pairs(boxes)) expect(overlap(a, b)).toBe(false);
    for (const b of boxes) for (const n of blocks) expect(overlap(b, n)).toBe(false);
  });

  it('keeps a crowded knot of labels apart, lit ones first, and a moved label where the reader put it', () => {
    const blocks = [{ x: 0, y: 0, w: 180, h: 46 }, { x: 0, y: 240, w: 180, h: 46 }];
    const labels = Array.from({ length: 6 }, (_, i) => ({ key: 'l' + i, mid: [90, 143] as [number, number], w: 120, h: 19, lit: i === 5 }));
    const boxes = placed(blocks, labels);
    for (const [a, b] of pairs(boxes)) expect(overlap(a, b)).toBe(false);
    expect(placeLabels(blocks, labels).get('l5')).toEqual([0, 0]);
    expect(placeLabels(blocks, [{ key: 'm', mid: [90, 143], w: 120, h: 19, moved: [40, -10] }]).get('m')).toEqual([40, -10]);
  });
});
