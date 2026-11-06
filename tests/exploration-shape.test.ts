import { describe, expect, it } from 'vitest';
import type { Exploration, ExplorationPart } from '../src/core/exploration';
import { nucleusName, shapeOf } from '../src/core/exploration-shape';
import { bakery } from './explorations';

type Mini = Pick<Exploration, 'parts' | 'links' | 'traces' | 'start'>;
/** A part of kind "part" at a line, so source order is its line. */
const p = (id: string, line: number, kind: ExplorationPart['kind'] = 'part'): ExplorationPart =>
  ({ id, kind, name: id, role: id, cites: [{ from: line, to: line }], points: [], members: [] });
const bond = (from: string, to: string) => ({ from, to, class: 'bond' as const, label: 'to', basis: 'declared' as const, cites: [{ from: 1, to: 1 }] });
const walk = (question: string, ...ids: string[]) => ({ question, steps: ids.map(id => ({ text: id, parts: [id], cites: [] })) });
const layers = (n: { layer: Map<string, number> }) => Object.fromEntries(n.layer);

describe('the detector (X3)', () => {
  it('chooses the trace that covers most of the main nucleus, whatever its position', () => {
    const x: Mini = { start: 'a', parts: ['a', 'b', 'c', 'd', 'e'].map((id, i) => p(id, i + 1)), links: [bond('a', 'b'), bond('b', 'c'), bond('c', 'd'), bond('d', 'e')],
      traces: [walk('one', 'a'), walk('two', 'b', 'c'), walk('most', 'a', 'b', 'c', 'd')] };
    const s = shapeOf(x);
    expect(s.trace).toBe(2);
    expect(s.coverage).toEqual([0.2, 0.4, 0.8]);
    expect(s.entry).toBe('trace');
    expect(s.reason).toEqual({ code: 'trace-covers', covered: 0.8 });
  });

  it('keeps source order on a tie', () => {
    const x: Mini = { start: 'a', parts: [p('a', 1), p('b', 2)], links: [bond('a', 'b')], traces: [walk('first', 'a'), walk('second', 'b')] };
    expect(shapeOf(x).trace).toBe(0);
  });

  it('layers an acyclic chain along its flow, even when the start sits in the middle', () => {
    const x: Mini = { start: 'b', parts: [p('a', 1), p('b', 2), p('c', 3), p('d', 4)], links: [bond('a', 'b'), bond('b', 'c'), bond('a', 'd'), bond('d', 'c')], traces: [] };
    const [n] = shapeOf(x).nuclei;
    expect(n.flow).toBe(true);
    expect(layers(n)).toEqual({ a: 0, b: 1, d: 1, c: 2 });
    expect(n.depth).toBe(3);
  });

  it('layers a cyclic nucleus outward from its start', () => {
    const x: Mini = { start: 'b', parts: [p('a', 1), p('b', 2), p('c', 3)], links: [bond('a', 'b'), bond('b', 'c'), bond('c', 'a')], traces: [] };
    const [n] = shapeOf(x).nuclei;
    expect(n.flow).toBe(false);
    expect(n.root).toBe('b');
    expect(layers(n)).toEqual({ b: 0, a: 1, c: 1 });
  });

  it('gives two components two nuclei, the one with the start first, and reports them as similar', () => {
    const x: Mini = { start: 'c', parts: [p('a', 1), p('b', 2), p('c', 3), p('d', 4)], links: [bond('a', 'b'), bond('c', 'd')], traces: [] };
    const s = shapeOf(x);
    expect(s.nuclei.map(n => n.ids)).toEqual([['c', 'd'], ['a', 'b']]);
    expect(s.entry).toBe('layers');
    expect(s.reason).toEqual({ code: 'similar-nuclei', sizes: [2, 2] });
  });

  it('calls a part with no bond loose, and sets references and procedures aside', () => {
    const x: Mini = { start: 'a', parts: [p('a', 1), p('b', 2), p('c', 3), p('r', 4, 'reference'), p('h', 5, 'procedure')], links: [bond('a', 'b')], traces: [] };
    const s = shapeOf(x);
    expect(s.loose.map(q => q.id)).toEqual(['c']);
    expect(s.aside.map(q => q.id)).toEqual(['r', 'h']);
    expect(s.reason).toEqual({ code: 'dominant-nucleus', size: 2 });
  });

  it('enters from the source when no nucleus exists', () => {
    const s = shapeOf({ start: 'a', parts: [p('a', 1), p('b', 2)], links: [], traces: [] });
    expect(s.nuclei).toEqual([]);
    expect(s.entry).toBe('source');
    expect(s.reason).toEqual({ code: 'no-nucleus' });
  });

  it('enters by the layers when the trace walks too little, and says how much it walks', () => {
    const x: Mini = { start: 'a', parts: ['a', 'b', 'c', 'd'].map((id, i) => p(id, i + 1)), links: [bond('a', 'b'), bond('b', 'c'), bond('c', 'd')], traces: [walk('short', 'a')] };
    expect(shapeOf(x).reason).toEqual({ code: 'dominant-nucleus', size: 4, covered: 0.25 });
  });

  it('finds the bakery: one nucleus along the flow, its prerequisite, annotation and reference; named after its main aspect', async () => {
    const x = await bakery(), s = shapeOf(x);
    expect(s.nuclei).toHaveLength(1);
    expect(layers(s.nuclei[0])).toEqual({ mix: 0, rest: 1, bake: 2, counter: 3, till: 4 });
    expect(s.prerequisites.map(q => [q.part.id, q.opens])).toEqual([['staling', 'bake']]);
    expect(s.annotations.map(q => [q.part.id, q.on])).toEqual([['drift', 'bake']]);
    expect(s.aside.map(q => q.id)).toEqual(['prices']);
    expect(s.entry).toBe('trace');
    expect(nucleusName(x, s.nuclei[0])).toBe('Making the bread');
  });

  it('is deterministic', async () => {
    const x = await bakery();
    expect(JSON.stringify(shapeOf(x), (_, v) => v instanceof Map ? [...v] : v)).toBe(JSON.stringify(shapeOf(structuredClone(x)), (_, v) => v instanceof Map ? [...v] : v));
  });
});
