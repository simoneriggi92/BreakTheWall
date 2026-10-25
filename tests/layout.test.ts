import { describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { layoutDisassembly, layoutFindings, layoutLevel, type LevelLayout } from '../src/core/layout';
import { atlas, fixture, mill, PRIVATE_FIXTURES, PUBLIC_FIXTURES, story } from './disassemblies';

const plate = (level: LevelLayout, id: string) => level.plates.find(p => p.id === id)!.rect;
const centre = (level: LevelLayout, id: string) => { const r = plate(level, id); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };

describe('automatic layout', () => {
  it.each([...PUBLIC_FIXTURES, ...PRIVATE_FIXTURES])('lays out every level of %s without overlaps or crossings', async path => {
    const levels = layoutDisassembly(await validateDisassembly(fixture(path)));
    for (const [key, level] of levels) {
      expect(layoutFindings(level), `${path} · ${key}`).toEqual([]);
      expect(level.plates).toHaveLength(key === 'root' ? fixture(path).parts.length : level.plates.length);
    }
  });
  it('keeps the chain order of a mechanism, left to right, with the rollback drawn as a return', () => {
    const d = atlas(); const root = layoutLevel(d.parts, d.joints);
    expect(root.orientation).toBe('flow');
    const xs = ['start', 'check', 'image', 'deploy', 'smoke'].map(id => centre(root, id).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(5);
    expect(root.joints.find(j => j.from === 'rollback' && j.to === 'deploy')!.returns).toBe(true);
    expect(root.joints.filter(j => j.returns)).toHaveLength(1);
  });
  it('puts a conclusion above its grounds, consequences above it, attacks and limits beside it', () => {
    const d = mill(); const root = layoutLevel(d.parts, d.joints);
    expect(root.orientation).toBe('stack');
    const claim = centre(root, 'claim');
    for (const id of ['utility', 'sovereignty']) expect(centre(root, id).y).toBeGreaterThan(claim.y);
    expect(centre(root, 'region').y).toBeLessThan(claim.y);
    for (const id of ['bounds', 'objection']) expect(centre(root, id).y).toBe(claim.y);
    // The rejected brick has no joints: it goes to the side column.
    expect(plate(root, 'abstract-right').x).toBeGreaterThan(Math.max(...root.plates.filter(p => p.id !== 'abstract-right').map(p => p.rect.x)));
  });
  it('runs a story left to right and places a part that only feeds others next to its target', () => {
    const d = story(); const root = layoutLevel(d.parts, d.joints);
    expect(root.orientation).toBe('flow');
    const x = (id: string) => centre(root, id).x;
    expect(x('storm')).toBeLessThan(x('vote'));
    expect(x('vote')).toBeLessThan(x('wall'));
    expect(x('quay')).toBeLessThan(x('hall'));
    expect(x('railway')).toBe(x('wall'));
  });
  it('gives the same output for the same input', () => {
    const d = atlas();
    expect(JSON.stringify(layoutDisassembly(d).get('root'))).toBe(JSON.stringify(layoutDisassembly(atlas()).get('root')));
  });
  it('routes a long joint around the plates in between', () => {
    const parts = ['a', 'b', 'c', 'd'].map(id => ({ id }));
    const level = layoutLevel(parts, [
      { from: 'a', to: 'b', type: 'sends-to', label: 'one' }, { from: 'b', to: 'c', type: 'sends-to', label: 'two' },
      { from: 'c', to: 'd', type: 'sends-to', label: 'three' }, { from: 'a', to: 'd', type: 'sends-to', label: 'shortcut' },
    ]);
    expect(level.joints[3].points.length).toBeGreaterThan(2);
    expect(layoutFindings(level)).toEqual([]);
  });
  it('detects a line through a plate and overlapping boxes', () => {
    const r = (x: number) => ({ x, y: 0, w: 100, h: 50 });
    const level: LevelLayout = {
      orientation: 'flow', width: 600, height: 200,
      plates: [{ id: 'a', rect: r(0) }, { id: 'b', rect: r(150) }, { id: 'c', rect: r(300) }, { id: 'd', rect: r(340) }],
      joints: [{ from: 'a', to: 'c', points: [[100, 25], [300, 25]], label: { x: 110, y: 60, w: 30, h: 18 }, returns: false }],
    };
    expect(layoutFindings(level)).toEqual(['Plates c and d overlap', 'Joint a → c crosses plate b']);
  });
});
