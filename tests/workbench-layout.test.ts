import { describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { layoutDisassembly, type Rect } from '../src/core/layout';
import { workbenchLayout } from '../src/renderer/disassembly/workbench-layout';
import { atlas, fixture, PUBLIC_FIXTURES } from './disassemblies';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('compact technical sheets', () => {
  it('keeps release order and every joint but makes the long release chain legible beside its reading panel', async () => {
    const d = await validateDisassembly(atlas()); const original = layoutDisassembly(d).get('root')!;
    const compact = workbenchLayout(original, d.joints);
    expect(compact.width).toBeLessThan(original.width);
    expect(compact.order).toEqual(original.order);
    expect(compact.joints.map(j => [j.from, j.to])).toEqual(d.joints.map(j => [j.from, j.to]));
    expect(new Set(compact.plates.map(p => p.rect.y)).size).toBe(2);
    // The rollback still returns to deploy; it never becomes the next release step.
    const back = compact.joints.find(j => j.from === 'rollback' && j.to === 'deploy')!;
    expect(back.returns).toBe(true);
    expect(back.points[0][1]).toBe(back.points.at(-1)![1]);
  });
  it.each(PUBLIC_FIXTURES)('keeps plates and labels apart, and retains every edge endpoint for %s', async path => {
    const d = await validateDisassembly(fixture(path)); const original = layoutDisassembly(d).get('root')!;
    const compact = workbenchLayout(original, d.joints);
    expect(compact.plates.map(p => p.id).sort()).toEqual(d.parts.map(p => p.id).sort());
    expect(compact.order).toEqual(original.order);
    for (const [i, a] of compact.plates.entries()) for (const b of compact.plates.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false);
    for (const j of compact.joints) {
      for (const p of compact.plates) expect(overlaps(j.label, p.rect)).toBe(false);
      const from = compact.plates.find(p => p.id === j.from)!.rect;
      const to = compact.plates.find(p => p.id === j.to)!.rect;
      const onEdge = ([x, y]: number[], r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && (x === r.x || x === r.x + r.w || y === r.y || y === r.y + r.h);
      expect(onEdge(j.points[0], from)).toBe(true);
      expect(onEdge(j.points.at(-1)!, to)).toBe(true);
    }
  });
});
