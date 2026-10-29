import { describe, expect, it } from 'vitest';
import { sectionCoverage, validateDisassembly } from '../src/core/disassembly';
import { renderMarkdown } from '../src/renderer/markdown';
import { fixture, PUBLIC_FIXTURES } from './disassemblies';

const atlasEn = () => validateDisassembly(fixture(PUBLIC_FIXTURES[3]));
const sections = async (path: string) => {
  const d = await validateDisassembly(fixture(path));
  return d.sources.flatMap(s => sectionCoverage(d, s.id, renderMarkdown(s.text).headings));
};

describe('how a source is organised (P-20261029-source-entry E3)', () => {
  it('maps each section of the runbook to the parts that take it apart', async () => {
    const d = await atlasEn();
    const rows = sectionCoverage(d, 'runbook', renderMarkdown(d.sources[0].text).headings);
    const by = (start: string) => rows.find(x => x.heading.text.startsWith(start))!;
    // The lone top heading is the title: the sections are the two levels below it.
    expect(rows.some(x => x.heading.level === 1)).toBe(false);
    expect(rows.map(x => x.heading.level)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 2, 2]);
    expect(by('3. Before you start')).toMatchObject({ to: 46, parts: ['start'], excluded: [] });
    expect(by('9. Rollback').to).toBe(162);
    expect(by('9.3').parts).toEqual(['rollback']);
    expect(by('1. What a release is').whole).toBe(true);
    // A joint's lines belong to both of its ends.
    expect(by('7.').parts).toEqual(['image', 'deploy', 'smoke']);
  });
  it('says when only an exclusion covers a section', async () => {
    const d = await atlasEn();
    const rows = sectionCoverage(d, 'runbook', renderMarkdown(d.sources[0].text).headings);
    expect(rows.at(-1)).toMatchObject({ parts: [], whole: false, excluded: [{ reason: 'outside-question', lines: 3 }] });
  });
  it.each(PUBLIC_FIXTURES)('leaves no section of %s unaccounted for', async path => {
    for (const row of await sections(path)) expect(row.whole || row.parts.length > 0 || row.excluded.length > 0, row.heading.text).toBe(true);
  });
  it('returns nothing for a source without headings, or an unknown source', async () => {
    const d = await atlasEn();
    expect(sectionCoverage(d, 'runbook', [])).toEqual([]);
    expect(sectionCoverage(d, 'missing', [{ level: 2, text: 'x', from: 1 }])).toEqual([]);
  });
});
