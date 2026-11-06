import { describe, expect, it } from 'vitest';
import type { Exploration, ExplorationPart } from '../src/core/exploration';
import { shapeOf } from '../src/core/exploration-shape';
import { countedLines, readingReport, VERDICTS } from '../src/core/reading-report';
import { sourceIndex } from '../src/core/source-index';
import { bakery } from './explorations';

const report = (x: Exploration) => readingReport(x, shapeOf(x), sourceIndex(x.source.text));

describe('how it was read (X6)', () => {
  it('counts text lines only: no blank lines, headings or fence markers', () => {
    expect(countedLines(['# T', '', 'a', '```', '# in code', '```', 'b'].join('\n'))).toEqual([3, 5, 7]);
  });

  it('gives every counted line one verdict, and the counts add up', async () => {
    const r = report(await bakery());
    expect(r.total).toBe(8);
    expect(VERDICTS.reduce((s, k) => s + r.counts[k], 0)).toBe(r.total);
    expect(r.counts).toMatchObject({ main: 5, prerequisite: 1, annotation: 1, aside: 1, none: 0 });
    expect(r.inMap).toBe(8);
  });

  it('lets an annotation outrank its part, and a part outrank a trace', async () => {
    const x = await bakery();
    x.parts.find(p => p.id === 'bake')!.cites = [{ from: 10, to: 12 }];
    const r = report(x), oven = r.groups.find(g => g.title === 'The oven')!;
    expect(oven.lines).toEqual([{ line: 11, verdict: 'main' }, { line: 12, verdict: 'annotation' }]);
  });

  it('does not call a section cited only by a trace "not extracted", and marks it walked', async () => {
    const x = await bakery();
    x.parts = x.parts.filter(p => p.id !== 'prices'); x.links = x.links.filter(l => l.from !== 'prices');
    x.traces[0].steps.push({ text: 'It is priced.', parts: ['till'], cites: [{ from: 19, to: 19 }] });
    const r = report(x), list = r.groups.find(g => g.title === 'Price list')!;
    expect(list.lines).toEqual([{ line: 19, verdict: 'trace' }]);
    expect(list.walked).toBe(true);
    expect(r.leftOut).toEqual([]);
  });

  it('lists a section nothing cites as left out', async () => {
    const x = await bakery();
    x.parts = x.parts.filter(p => p.id !== 'prices'); x.links = x.links.filter(l => l.from !== 'prices');
    expect(report(x).leftOut).toEqual(['Price list']);
  });

  it('gives a member\'s lines its role\'s verdict', async () => {
    // line 7 is cited only by the mix's members: the role itself cites its heading, its link and its step cite line 8
    const x = await bakery();
    x.parts.find(p => p.id === 'mix')!.cites = [{ from: 6, to: 6 }];
    x.links[0].cites = [{ from: 8, to: 8 }]; x.traces[0].steps[0].cites = [{ from: 8, to: 8 }];
    expect(report(x).groups.find(g => g.title === 'The dough')!.lines[0]).toEqual({ line: 7, verdict: 'main' });
  });

  it('agrees fully with a chain written in flow order, and not at all with its reverse', async () => {
    expect(report(await bakery()).order.agreement).toBe(1);
    const r = await bakery(), lines = [16, 15, 11, 8, 7];
    ['mix', 'rest', 'bake', 'counter', 'till'].forEach((id, i) => { r.parts.find(p => p.id === id)!.cites = [{ from: lines[i], to: lines[i] }]; });
    expect(report(r).order.agreement).toBe(0);
  });

  it('lists the interpreted links apart, and records the shape and the entry', async () => {
    const r = report(await bakery());
    expect(r.basis).toMatchObject({ declared: 3, interpreted: 3 });
    expect(r.basis.interpretedLinks.map(l => `${l.from}>${l.to}`)).toEqual(['bake>counter', 'counter>till', 'staling>bake']);
    expect(r.shape).toEqual({ nuclei: [5], aspects: 2, roles: 5, members: 2, prerequisites: 1, annotations: 1, aside: 1, loose: 0 });
    expect(r.entry).toEqual({ code: 'trace', trace: 0, covered: 0.8 });
    expect(r.order.sections).toBe(3);
  });

  it('frames a source with no index as one group', async () => {
    const x = await bakery(), part: ExplorationPart = x.parts[1];
    const r = readingReport(x, shapeOf(x), []);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({ lead: true, line: 1 });
    expect(part.id).toBe('mix');
  });
});
