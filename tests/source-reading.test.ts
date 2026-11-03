import { describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, locateReading, restoreDisassemblyState } from '../src/core/disassembly-state';
import { readingContext, readingIndex, readingRoles, readingSteps, sourceReadingRoute, type ReadingPassage } from '../src/core/source-reading';
import { readingBlocks, renderMarkdown } from '../src/renderer/markdown';
import { atlas, fixture, PUBLIC_FIXTURES } from './disassemblies';

const routeFor = (text: string, prose = true) => sourceReadingRoute([{ id: 's', text }], { s: readingBlocks(text, prose) });
describe('finite, source-ordered reading', () => {
  it('accounts for every line, including preamble, blank lines and a final heading', () => {
    const text = '\nPreamble\n\n# One\n\nText\n\n## Two\n\nOther\n\n## Empty\n';
    const route = routeFor(text);
    expect(route.flatMap(p => Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i)))
      .toEqual(text.split('\n').map((_, i) => i + 1));
    expect(route[0].from).toBe(1);
    expect(route.at(-1)!.to).toBe(text.split('\n').length);
  });
  it('does not split a fence, nested list, table or blockquote, even beyond the soft size', () => {
    const text = ['# Start', '', 'Intro', '', '```md', '# Not a heading', 'x'.repeat(2200), '```', '',
      '- Definition', '  - ' + 'condition '.repeat(300), '', '| A | B |', '|---|---|', '| ' + 'a'.repeat(2200) + ' | b |', '',
      '> ' + 'context '.repeat(300), '', '# End', '', 'Done'].join('\n');
    const blocks = readingBlocks(text), route = routeFor(text);
    expect(blocks.filter(b => b.heading !== undefined).map(b => b.heading)).toEqual(['Start', 'End']);
    for (const block of blocks) expect(route.some(p => p.from <= block.from && p.to >= block.to)).toBe(true);
    expect(route.at(-1)!.title).toBe('End');
  });
  it('has a finite fallback for headingless text and code, and preserves source order', () => {
    const text = 'word '.repeat(800);
    expect(routeFor(text)).toHaveLength(1);
    const code = '# comment\n\nconst a = 1;\n\n# another comment';
    expect(routeFor(code, false)).toEqual([{ source: 's', from: 1, to: 5, title: undefined }]);
    const sources = [{ id: 'b', text: 'First' }, { id: 'a', text: 'Second' }];
    expect(sourceReadingRoute(sources, {}).map(p => p.source)).toEqual(['b', 'a']);
  });
  it('retains absolute source positions when rendering just a passage', () => {
    const host = document.createElement('div');
    host.innerHTML = renderMarkdown('## Heading\n\nParagraph\n\n```ts\nconst a = 1;\n```', 20).html;
    expect(host.querySelector('h2')!.getAttribute('data-from')).toBe('20');
    expect(host.querySelector('p')!.getAttribute('data-from')).toBe('22');
    expect(host.querySelector('pre')!.getAttribute('data-to')).toBe('26');
  });
  it('uses existing citations and does not invent a part for unrelated material', async () => {
    const d = await validateDisassembly(atlas());
    expect(readingContext(d, d.parts[0].cites[0]).root).toBe(d.parts[0]);
    expect(readingContext(d, { source: 'unknown', from: 1, to: 2 })).toEqual({});
    const route = sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text)])));
    for (const source of d.sources) {
      const own = route.filter(p => p.source === source.id);
      expect(own[0].from).toBe(1);
      expect(own.at(-1)!.to).toBe(source.text.split('\n').length);
      expect(own.slice(1).every((p, i) => p.from === own[i].to + 1)).toBe(true);
    }
  });
});

describe('saved reading location', () => {
  it('restores a location inside a passage and preserves legacy progress and the rest of the loop', async () => {
    const d = await validateDisassembly(atlas()), initial = initialDisassemblyState(d);
    expect(restoreDisassemblyState(d, initial)).toEqual({ state: initial });
    const reading = { source: d.sources[0].id, from: 7, view: 'guided' as const };
    const saved = locateReading(d, initial, reading);
    expect(saved.runs).toBe(initial.runs);
    expect(saved.reassembly).toBe(initial.reassembly);
    expect(restoreDisassemblyState(d, saved).state.reading).toEqual(reading);
    expect(readingIndex([{ source: reading.source, from: 1, to: 5 }, { source: reading.source, from: 6, to: 10 }], reading)).toBe(1);
    expect(locateReading(d, initial, { ...reading, from: 0 })).toBe(initial);
    expect(locateReading(d, initial, { ...reading, from: 999999 })).toBe(initial);
    expect(locateReading(d, initial, { ...reading, source: 'missing' })).toBe(initial);
    expect(restoreDisassemblyState(d, { ...saved, reading: { ...reading, from: 999999 } }).notice).toBe('references-changed');
    expect(restoreDisassemblyState({ ...d, revision: 'v2' }, saved).notice).toBe('revision-changed');
  });
});

// P-20261102-guided-reading G2: what each passage does to the drawing, from citations alone.
describe('what each passage does', () => {
  /** A route cut at every heading, as in research R-20261102-guided-reading. */
  const byHeading = (d: any): ReadingPassage[] => d.sources.flatMap((s: any) => {
    const lines: string[] = s.text.split('\n');
    const starts = [1, ...lines.flatMap((l, i) => i > 0 && /^#{1,3} /.test(l) ? [i + 1] : [])];
    return starts.map((from, k) => ({ source: s.id, from, to: (starts[k + 1] ?? lines.length + 1) - 1 }));
  });
  const realRoute = (d: any) => sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map((s: any) => [s.id, readingBlocks(s.text)])));
  const summary = (r: ReturnType<typeof readingRoles>[number]) => [r.frame && 'frame', r.add.length && `add ${r.add}`, r.deepen.length && `deepen ${r.deepen}`,
    r.relate.length && `relate ${r.relate.map(j => `${j.from}>${j.to}`)}`, r.margin.length && `margin ${r.margin.map(x => x.reason)}`].filter(Boolean).join(' | ');

  it.each(['src/fixtures/disassemblies/importer-signals.json', 'src/fixtures/disassemblies/importer-signals-en.json'])('builds the importer in the order the text does (%s)', async path => {
    const d = await validateDisassembly(fixture(path));
    const route = byHeading(d);
    expect(route.map(p => `${p.from}-${p.to}`).slice(0, 4)).toEqual(['1-8', '9-22', '23-46', '47-69']);
    expect(readingRoles(d, route).map(summary)).toEqual([
      'margin context',
      'frame',
      'frame',
      'add round | relate round>heartbeat,round>finished | margin context,context',
      'add heartbeat',
      'add finished',
      'add outcomes',
      'deepen outcomes | relate round>outcomes',
      'deepen outcomes',
      'add pause | relate round>pause',
      'add restart | relate heartbeat>restart',
      'add board | relate heartbeat>board,finished>board,outcomes>board',
      'deepen board',
      'deepen board,pause,restart | margin context',
      'deepen outcomes,restart,board | margin context',
      'margin repetition',
    ]);
    // The depth view: the round's section names all five of its steps.
    expect(readingRoles(d, route)[3].subParts).toEqual(['round-stamp', 'round-switch', 'round-fetch', 'round-hand', 'round-close']);
  });

  it.each(PUBLIC_FIXTURES)('adds each part once, relates each joint and keeps every exclusion in the margin, on the real route (%s)', async path => {
    const d = await validateDisassembly(fixture(path));
    const route = realRoute(d), roles = readingRoles(d, route);
    const adds = roles.flatMap(r => r.add);
    expect([...adds].sort()).toEqual(d.parts.map(p => p.id).sort());
    roles.forEach((r, i) => r.deepen.forEach(id => expect(roles.slice(0, i).some(x => x.add.includes(id))).toBe(true)));
    for (const j of d.joints) expect(roles.some(r => r.relate.includes(j))).toBe(true);
    const exclusions = [...d.bom.excluded, ...d.parts.flatMap(function all(p: any): any[] { return [...(p.excluded ?? []), ...(p.parts ?? []).flatMap(all)]; })];
    for (const x of exclusions) route.forEach((p, i) => {
      const overlaps = p.source === x.source && p.from <= x.to && p.to >= x.from;
      expect(roles[i].margin.some(m => m.source === x.source && m.from === x.from && m.to === x.to)).toBe(overlaps);
    });
  });

  it('relates a joint without citations at the passage where its later end is added', async () => {
    const d = fixture('src/fixtures/disassemblies/importer-signals-en.json');
    delete d.joints.find((j: any) => j.from === 'heartbeat' && j.to === 'restart').cites;
    const valid = await validateDisassembly(d), route = byHeading(valid), roles = readingRoles(valid, route);
    const at = roles.findIndex(r => r.relate.some(j => j.from === 'heartbeat' && j.to === 'restart'));
    expect(roles[at].add).toContain('restart');
    expect(roles.filter(r => r.relate.some(j => j.from === 'heartbeat' && j.to === 'restart'))).toHaveLength(1);
  });
});

// P-20261102-guided-reading G13: one step where the drawing changes.
describe('steps of the guided reading', () => {
  const realRoute = (d: any) => sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map((s: any) => [s.id, readingBlocks(s.text)])));
  it.each([['atlas-release-en', 14, 9], ['mill-harm-en', 5, 4], ['importer-signals-en', 15, 10]])('groups %s from %i passages into %i steps', async (name, passages, count) => {
    const d = await validateDisassembly(fixture(`src/fixtures/disassemblies/${name}.json`));
    const route = realRoute(d), roles = readingRoles(d, route), steps = readingSteps(route, roles);
    expect(route).toHaveLength(passages);
    expect(steps).toHaveLength(count);
    expect(steps.length).toBeLessThanOrEqual(1 + d.parts.length + d.joints.length);
  });
  it.each(PUBLIC_FIXTURES)('keeps every line in one step and every step a change of the drawing (%s)', async path => {
    const d = await validateDisassembly(fixture(path));
    const route = realRoute(d), roles = readingRoles(d, route), steps = readingSteps(route, roles);
    for (const s of d.sources) {
      const own = steps.filter(x => x.source === s.id);
      expect(own[0].from).toBe(1);
      expect(own.at(-1)!.to).toBe(s.text.split('\n').length);
      own.slice(1).forEach((x, i) => expect(x.from).toBe(own[i].to + 1));
    }
    steps.slice(1).forEach((x, i) => { if (x.source === steps[i].source) expect(x.role.frame || x.role.add.length > 0 || x.role.relate.length > 0).toBe(true); });
    // G2's invariants hold on steps.
    expect(steps.flatMap(x => x.role.add).sort()).toEqual(d.parts.map(p => p.id).sort());
    for (const j of d.joints) expect(steps.some(x => x.role.relate.includes(j))).toBe(true);
    const exclusions = [...d.bom.excluded, ...d.parts.flatMap(function all(p: any): any[] { return [...(p.excluded ?? []), ...(p.parts ?? []).flatMap(all)]; })];
    for (const e of exclusions) steps.forEach(x => {
      const overlaps = x.source === e.source && x.from <= e.to && x.to >= e.from;
      expect(x.role.margin.some(m => m.source === e.source && m.from === e.from && m.to === e.to)).toBe(overlaps);
    });
  });
});
