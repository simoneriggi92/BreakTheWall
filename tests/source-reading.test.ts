import { describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, locateReading, restoreDisassemblyState } from '../src/core/disassembly-state';
import { readingContext, readingIndex, sourceReadingRoute } from '../src/core/source-reading';
import { readingBlocks, renderMarkdown } from '../src/renderer/markdown';
import { atlas } from './disassemblies';

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
