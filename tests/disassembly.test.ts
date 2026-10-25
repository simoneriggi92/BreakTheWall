import { describe, expect, it } from 'vitest';
import { hashText } from '../src/core/lesson';
import { billOfMaterials, citedLines, DisassemblyError, formatPath, pagesOf, validateDisassembly, type Finding } from '../src/core/disassembly';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { atlas, fixture, mill, PRIVATE_FIXTURES, PUBLIC_FIXTURES, story } from './disassemblies';

async function findings(input: unknown): Promise<Finding[]> {
  try { await validateDisassembly(input); return []; }
  catch (error) { if (error instanceof DisassemblyError) return error.findings; throw error; }
}
async function withPages(input: any) {
  input.sources[0].pages = [{ page: 1, from: 1 }, { page: 2, from: 12 }];
  return input;
}

describe('disassembly fixtures', () => {
  it.each(PUBLIC_FIXTURES)('%s validates', async path => {
    expect(await findings(fixture(path))).toEqual([]);
  });
  it('loads the prepared disassemblies through the boundary', async () => {
    expect((await loadPreparedDisassemblies()).map(x => `${x.id}:${x.language}`)).toEqual(['atlas-release:it', 'mill-harm:it', 'atlas-release-en:en', 'mill-harm-en:en']);
  });
  it.skipIf(!PRIVATE_FIXTURES.length).each(PRIVATE_FIXTURES)('local-only %s validates', async path => {
    expect(await findings(fixture(path))).toEqual([]);
  });
  it('accepts a weakening verdict, a slot set, a page map and a file-level exclusion', async () => {
    const input = await withPages(story());
    input.bom.excludedFiles = [{ path: 'config/settings.json', reason: 'secrets', note: 'Keys found by content.' }, { path: 'dist/**', reason: 'generated' }];
    input.scope = { kind: 'document', title: 'Kessmouth', pages: { from: 1, to: 2 } };
    const d = await validateDisassembly(input);
    expect(d.runs[0].type === 'load' && d.runs[0].bricks.map(b => b.verdict)).toEqual(['falls', 'weakens', 'holds']);
    expect(d.reassemble.slots.filter(s => Array.isArray(s.accepts))).toHaveLength(2);
    expect(pagesOf(d.sources[0], { from: 10, to: 14 })).toEqual({ first: 1, last: 2 });
    const repo = story(); repo.scope = { kind: 'repository', root: 'kessmouth', commit: 'a1b2c3d', modified: ['src/a.ts'] };
    expect(await findings(repo)).toEqual([]);
  });
  it('copies cited lines from the source instead of storing quotes', async () => {
    const d = await validateDisassembly(story());
    expect(citedLines(d, d.parts[0].cites[0])).toEqual(d.sources[0].text.split('\n').slice(4, 6));
  });
});

describe('located findings', () => {
  it.each<[string, () => any, (x: any) => void, string, RegExp?]>([
    ['unknown part kind', atlas, x => { x.parts[0].kind = 'module'; }, 'parts[0].kind'],
    ['icon outside the closed list', atlas, x => { x.parts[0].icon = 'rocket-launch'; }, 'parts[0].icon'],
    ['citation outside its source', atlas, x => { x.parts[0].cites[0].to = 9999; }, 'parts[0].cites[0]', /outside the source/],
    ['citation of an unknown source', atlas, x => { x.parts[1].parts[0].cites[0].source = 'missing'; }, 'parts[1].parts[0].cites[0]', /Unknown source/],
    ['duplicate part id', atlas, x => { x.parts[1].parts[0].id = 'start'; }, 'parts[1].parts[0]', /Duplicate part/],
    ['fewer than three parts in a level', atlas, x => { x.parts[2].parts.pop(); x.parts[2].joints.pop(); }, 'parts[2].parts', /expected 3–7/],
    ['more than three levels', atlas, x => { x.parts[2].parts[0].parts = [{ ...x.parts[2].parts[1], id: 'deep', parts: [] }]; }, 'parts[2].parts[0].parts[0]'],
    ['joint across levels', atlas, x => { x.joints[0].to = 'check-lock'; }, 'joints[0]', /same level/],
    ['joints without sub-parts', atlas, x => { x.parts[0].joints = [{ from: 'start', to: 'check', type: 'causes', label: 'x' }]; }, 'parts[0].joints'],
    ['long joint label', atlas, x => { x.joints[0].label = 'a label far too long to draw'; }, 'joints[0].label', /at most 24/],
    ['long part name', atlas, x => { x.parts[0].name = 'n'.repeat(49); }, 'parts[0].name', /at most 48/],
    ['long point', atlas, x => { x.parts[0].points[0].text = 'p'.repeat(131); }, 'parts[0].points[0]', /at most 130/],
    ['top-level part with one point', atlas, x => { x.parts[1].points = [x.parts[1].points[0]]; }, 'parts[1].points', /2–4 points/],
    ['sub-part without its sentence', atlas, x => { delete x.parts[1].parts[0].explain; }, 'parts[1].parts[0].explain'],
    ['scenario effect on a sub-part', atlas, x => { x.runs[0].steps[0].effect = { 'check-lock': 'ok' }; }, 'runs[0].steps[0].effect.check-lock', /not a top-level part/],
    ['scene state outside the vocabulary', atlas, x => { x.runs[0].steps[0].effect = { start: 'exploded' }; }, 'runs[0].steps[0].effect.start'],
    ['flow without a joint', atlas, x => { x.runs[0].steps[0].flow = [['start', 'smoke']]; }, 'runs[0].steps[0].flow[0]', /No joint/],
    ['prediction with two right answers', atlas, x => { x.runs[0].steps[0].predict.options[0].correct = true; }, 'runs[0].steps[0].predict.options', /Exactly one/],
    ['load test on a sub-part', mill, x => { x.runs[0].target = 'bounds-' + 'x'; }, 'runs[0].target'],
    ['brick that is its own target', mill, x => { x.runs[0].bricks[0].part = 'claim'; }, 'runs[0].bricks[0].part', /cannot be the target/],
    ['verdict outside the three outcomes', mill, x => { x.runs[0].bricks[0].verdict = 'bends'; }, 'runs[0].bricks[0].verdict'],
    ['case with no right answer', mill, x => { x.runs[1].options.forEach((o: any) => { o.correct = false; }); }, 'runs[1].options'],
    ['slot for an unknown part', atlas, x => { x.reassemble.slots[0].accepts = 'missing'; }, 'reassemble.slots[0].accepts'],
    ['slot set without enough slots', story, x => { x.reassemble.slots.splice(3, 1); }, 'reassemble.slots[2]', /need 2 slots/],
    ['part with no slot', story, x => { x.reassemble.slots.pop(); }, 'parts[6]', /No reassembly slot/],
    ['part with no hint', story, x => { delete x.reassemble.hints.storm; }, 'reassemble.hints.storm'],
    ['question in another language', mill, x => { x.question = 'When can society legitimately coerce an individual, according to Mill?'; }, 'question', /reads as en/],
    ['forgotten lines', atlas, x => { x.bom.excluded.shift(); }, 'sources[0]', /Lines 1–6 of release-runbook\.md/],
    ['exclusion reason outside the list', atlas, x => { x.bom.excluded[0].reason = 'boring'; }, 'bom.excluded[0].reason'],
    ['file exclusion reason outside the list', atlas, x => { x.bom.excludedFiles = [{ path: 'a', reason: 'boring' }]; }, 'bom.excludedFiles[0].reason'],
    ['edited source text', atlas, x => { x.sources[0].text += '\nmore'; }, 'sources[0].sha256'],
    ['generation metadata on a prepared disassembly', atlas, x => { x.generation = { provider: 'local', model: 'm', createdAt: '2026-10-25T10:00:00Z' }; }, 'generation'],
    ['pages that go backwards', story, x => { x.sources[0].pages = [{ page: 1, from: 1 }, { page: 2, from: 1 }]; }, 'sources[0].pages[1]', /increase/],
    ['reversed document range', story, x => { x.scope = { kind: 'document', title: 'K', pages: { from: 9, to: 2 } }; }, 'scope.pages'],
    ['repository scope without a commit', story, x => { x.scope = { kind: 'repository', root: 'k', commit: 'main', modified: [] }; }, 'scope.commit'],
  ])('%s', async (_name, base, mutate, path, message) => {
    const input = base(); mutate(input);
    const found = await findings(input);
    const match = found.filter(x => x.path === path);
    expect(match, JSON.stringify(found)).not.toHaveLength(0);
    if (message) expect(match.map(x => x.message).join('\n')).toMatch(message);
  });
  it('formats paths with indexes', () => {
    expect(formatPath(['parts', 2, 'parts', 0, 'cites', 1])).toBe('parts[2].parts[0].cites[1]');
  });
});

describe('bill of materials', () => {
  it('accounts for every line of every fixture', async () => {
    for (const path of [...PUBLIC_FIXTURES, ...PRIVATE_FIXTURES]) {
      const bom = billOfMaterials(await validateDisassembly(fixture(path)));
      expect(bom.counts.missing, path).toBe(0);
      expect(bom.counts.assigned, path).toBeGreaterThan(0);
    }
  });
  it('reports a forgotten range once, across the blank lines inside it', async () => {
    const input = story(); input.bom.excluded = [];
    const bom = billOfMaterials(input);
    expect(bom.sources[0].forgotten).toEqual([{ from: 1, to: 3 }]);
    expect(bom.counts).toMatchObject({ missing: 2, excluded: 0 });
  });
  it('counts runs as readers, not as owners of lines', async () => {
    const input = story(); input.parts[6].cites = [{ source: 'kessmouth', from: 24, to: 25 }];
    expect(billOfMaterials(input).sources[0].forgotten).toEqual([{ from: 26, to: 26 }]);
  });
  it('checks the source hash before trusting the text', async () => {
    const input = story(); input.sources[0].text = input.sources[0].text.replace('1871', '1872');
    input.sources[0].sha256 = await hashText(input.sources[0].text);
    expect(await findings(input)).toEqual([]);
  });
});
