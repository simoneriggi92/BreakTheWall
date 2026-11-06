import { describe, expect, it } from 'vitest';
import { sectionAt, sourceIndex } from '../src/core/source-index';
import { BAKERY } from './explorations';

describe('the source index (X4)', () => {
  it('reads the headings, takes a lone first-level heading as the title, and knows each extent', () => {
    expect(sourceIndex(BAKERY).map(s => [s.title, s.line, s.end])).toEqual([
      ['Why bread goes stale', 3, 5], ['The dough', 6, 9], ['The oven', 10, 13], ['Selling', 14, 17], ['Price list', 18, 20],
    ]);
  });

  it('ignores headings inside code fences', () => {
    const text = ['## Setup', '```', '# not a heading', '```', '## Run', 'go'].join('\n');
    expect(sourceIndex(text).map(s => s.title)).toEqual(['Setup', 'Run']);
  });

  it('keeps two depths, and a parent\'s own lines stop at its first subsection', () => {
    const text = ['# A', 'intro', '## A.1', 'x', '### deep', 'y', '# B', 'z'].join('\n');
    const index = sourceIndex(text);
    expect(index.map(s => [s.title, s.sub])).toEqual([['A', false], ['A.1', true], ['B', false]]);
    expect(index[0].own).toBe(2);
    expect(index[0].end).toBe(6);
  });

  it('opens with the lines before the first section only when they say something', () => {
    expect(sourceIndex(['Some words first.', '## One', 'a'].join('\n'))[0]).toMatchObject({ opening: true, line: 1, end: 1 });
    expect(sourceIndex(['', '## One', 'a'].join('\n'))[0].opening).toBeUndefined();
  });

  it('gives no index to plain text', () => {
    expect(sourceIndex('just\nlines\nof text')).toEqual([]);
  });

  it('finds the narrowest section that holds a line', () => {
    expect(sectionAt(sourceIndex(BAKERY), 11)?.title).toBe('The oven');
  });
});
