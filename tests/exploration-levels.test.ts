import { describe, expect, it } from 'vitest';
import type { Exploration, ExplorationPart } from '../src/core/exploration';
import { aspectLevel, levelShape, OTHER_ASPECT, premiseOf, subLevel } from '../src/core/exploration-levels';
import { sourceIndex } from '../src/core/source-index';
import { bakery } from './explorations';

const role = (id: string, aspect: string | undefined, line: number): ExplorationPart => ({ id, kind: 'part', aspect, name: id.toUpperCase(), role: id, cites: [{ from: line, to: line }], points: [], members: [] });
const link = (from: string, to: string, basis: 'declared' | 'interpreted' = 'interpreted', label = `${from} to ${to}`) => ({ from, to, class: 'bond' as const, label, basis, cites: [{ from: 1, to: 1 }] });
type Mini = Pick<Exploration, 'aspects' | 'parts' | 'links' | 'traces' | 'start'>;
const two = (): Mini => ({
  start: 'a1', traces: [], aspects: [{ id: 'a', name: 'Aspect A' }, { id: 'b', name: 'Aspect B' }],
  parts: [role('a1', 'a', 1), role('a2', 'a', 2), role('b1', 'b', 3), role('b2', 'b', 4)],
  links: [link('a1', 'a2'), link('a1', 'b1', 'interpreted', 'feeds'), link('a2', 'b1', 'declared', 'checks'), link('a2', 'b2', 'interpreted', 'feeds'), link('b1', 'b2')],
});

describe('the aspect level (X5)', () => {
  it('turns three cross bonds into one aspect joint that keeps them all, labelled by the first and how many more', () => {
    const L = aspectLevel(two())!;
    expect(L.parts.map(p => [p.id, p.members.map(m => m.id)])).toEqual([['a', ['a1', 'a2']], ['b', ['b1', 'b2']]]);
    expect(L.links).toHaveLength(1);
    const [j] = L.links;
    expect(j).toMatchObject({ from: 'a', to: 'b', class: 'bond', basis: 'declared', label: 'feeds +1', labels: ['feeds', 'checks'] });
    expect(j.bonds).toEqual([{ from: 'a1', to: 'b1', label: 'feeds' }, { from: 'a2', to: 'b1', label: 'checks' }, { from: 'a2', to: 'b2', label: 'feeds' }]);
  });

  it('is declared only when one of its bonds is', () => {
    const x = two(); x.links[2].basis = 'interpreted';
    expect(aspectLevel(x)!.links[0].basis).toBe('interpreted');
  });

  it('points a prerequisite at what it opens, and moves an annotation with its role to the role\'s aspect', async () => {
    const L = aspectLevel(await bakery())!;
    expect(L.links.find(l => l.from === 'staling')).toMatchObject({ to: 'make', class: 'prerequisite' });
    expect(L.parts.find(p => p.id === 'drift')!.on).toBe('make');
    expect(L.start).toBe('make');
  });

  it('gathers roles with no aspect in one block, and gives no level below two aspects', () => {
    const x = two(); delete x.parts[3].aspect;
    expect(aspectLevel(x)!.parts.map(p => p.id)).toEqual(['a', 'b', OTHER_ASPECT]);
    expect(aspectLevel({ ...two(), aspects: [] })).toBeNull();
  });

  it('draws every aspect when no bond joins them', () => {
    const x = two(); x.links = [link('a1', 'a2'), link('b1', 'b2')];
    const L = aspectLevel(x)!, s = levelShape(L, 'aspects');
    expect(s.nuclei).toHaveLength(1);
    expect(s.nuclei[0].ids).toEqual(['a', 'b']);
    expect(s.loose).toEqual([]);
  });

  it('keeps the aspect level\'s own shape when its aspects are bonded', () => {
    const L = aspectLevel(two())!;
    expect(levelShape(L, 'aspects').nuclei[0].layer.get('b')).toBe(1);
  });

  it('maps a trace\'s steps onto the aspects that hold their parts', async () => {
    const L = aspectLevel(await bakery())!;
    expect(L.traces[0].steps.map(s => s.parts)).toEqual([['make'], ['make'], ['make'], ['sell']]);
  });
});

describe('the sub-level (X5)', () => {
  it('holds the aspect\'s roles and their annotations, and no prerequisite', async () => {
    const S = subLevel(await bakery(), 'make');
    expect(S.parts.map(p => p.id)).toEqual(['mix', 'rest', 'bake', 'drift']);
    expect(S.parts.some(p => p.kind === 'prerequisite')).toBe(false);
    expect(S.links.map(l => `${l.from}>${l.to}`)).toEqual(['mix>rest', 'rest>bake']);
  });

  it('places every role, even with no bond among them', () => {
    const x = two(); x.links = [];
    const s = levelShape(subLevel(x, 'a'), 'sub');
    expect(s.nuclei[0].ids).toEqual(['a1', 'a2']);
    expect([...s.nuclei[0].layer.values()]).toEqual([0, 0]);
  });

  it('lays a level with no bond in rows of three, in source order', () => {
    const x: Mini = { ...two(), parts: ['p', 'q', 'r', 's'].map((id, i) => role(id, 'a', i + 1)), links: [] };
    const s = levelShape(subLevel(x, 'a'), 'sub');
    expect(Object.fromEntries(s.nuclei[0].layer)).toEqual({ p: 0, q: 0, r: 0, s: 1 });
  });
});

describe('the premise (X5)', () => {
  it('is the earliest prerequisite when no part opens in its section', async () => {
    const x = await bakery();
    expect(premiseOf(x, sourceIndex(x.source.text))?.id).toBe('staling');
  });

  it('is none when a part opens in the same section', async () => {
    const x = await bakery();
    x.parts.find(p => p.id === 'mix')!.cites = [{ from: 4, to: 7 }];
    expect(premiseOf(x, sourceIndex(x.source.text))).toBeNull();
  });

  it('with no index, comes before every part', async () => {
    const x = await bakery();
    expect(premiseOf(x, [])?.id).toBe('staling');
    x.parts.find(p => p.id === 'staling')!.cites = [{ from: 12, to: 12 }];
    expect(premiseOf(x, [])).toBeNull();
  });

  it('is deterministic', async () => {
    const x = await bakery(), a = aspectLevel(x), b = aspectLevel(structuredClone(x));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
