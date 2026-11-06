// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allParts, checkDisassembly, divisible, isExpansionOf, nextRevision, validateDisassembly, type Disassembly } from '../src/core/disassembly';
import { carryOver, initialDisassemblyState, openPath, predict, restoreDisassemblyState, selectPart } from '../src/core/disassembly-state';
import { layoutDisassembly, layoutFindings } from '../src/core/layout';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { ProgressStore } from '../src/desktop/progress-store';
import { atlas, fixture, PUBLIC_FIXTURES, story } from './disassemblies';
import { deepDisassembly, generatedFrom, splitAnswer, takenApart } from './disassembly-drafts';

const meta = { provider: 'chatgpt' as const, model: 'strong', createdAt: '2026-10-26T12:00:00.000Z' };
const millEn = () => fixture(PUBLIC_FIXTURES[4]) as Disassembly;
const issues = (d: unknown) => checkDisassembly(d as Disassembly);
/** The first top-level part of Mill without sub-parts that has enough lines to come apart. */
const leafOf = (d: Disassembly) => d.parts.find(p => !p.parts && divisible(d, p))!;

describe('depth guided by the source (D13)', () => {
  it('validates a disassembly five levels deep, lays out every level, and opens down to the deepest level and back', async () => {
    const d = await validateDisassembly(await deepDisassembly(5));
    expect(Math.max(...allParts(d).map(x => x.depth)) + 1).toBe(5);
    const levels = layoutDisassembly(d);
    expect(levels.size).toBe(5);
    for (const [key, level] of levels) expect(layoutFindings(level), key).toEqual([]);
    const path = ['p1', 'p1-1', 'p1-1-1', 'p1-1-1-1'];
    const deep = openPath(d, initialDisassemblyState(d), path);
    expect(deep.path).toEqual(path);
    expect(restoreDisassemblyState(d, deep).notice).toBeUndefined();
    expect(openPath(d, deep, path.slice(0, 1)).path).toEqual(['p1']);
  });

  it('stops where the source stops: a level under a part with fewer than 6 lines is a located finding', () => {
    const s = story();
    const vote = s.parts.findIndex((p: { id: string }) => p.id === 'vote');
    s.parts[vote].parts = [8, 9, 10].map((n, i) => ({ id: `v${i}`, name: `Line ${n}`, kind: 'event', icon: 'flag', role: 'One line.', explain: 'One line of the vote.', cites: [{ source: 'kessmouth', from: n, to: n }] }));
    expect(issues(s)).toContainEqual({ path: `parts[${vote}].parts`, message: 'vote cites 4 non-blank lines; taking a part apart needs at least 6' });
  });

  it('makes each level account for its parent’s lines, and keeps exclusions and sub-parts inside them', () => {
    const a = atlas();
    const check = a.parts.findIndex((p: { id: string }) => p.id === 'check');
    a.parts[check].excluded = a.parts[check].excluded.filter((x: { from: number }) => x.from !== 72);
    expect(issues(a)).toContainEqual({ path: `parts[${check}]`, message: expect.stringMatching(/^Lines 72–72 of .* are cited by check but by none of its sub-parts, and not excluded$/) });
    a.parts[check].excluded.push({ source: 'runbook', from: 1, to: 1, reason: 'context' });
    expect(issues(a).map(f => f.path)).toContain(`parts[${check}].excluded[${a.parts[check].excluded.length - 1}]`);
    const whole = atlas();
    whole.parts[check].parts[0].cites = structuredClone(whole.parts[check].cites);
    expect(issues(whole)).toContainEqual({ path: `parts[${check}].parts[0].cites`, message: expect.stringMatching(/cites every line of check/) });
    const leaf = atlas(); leaf.parts[0].excluded = [{ source: 'runbook', from: leaf.parts[0].cites[0].from, to: leaf.parts[0].cites[0].from, reason: 'detail' }];
    expect(issues(leaf)).toContainEqual({ path: 'parts[0].excluded', message: 'Exclusions need sub-parts' });
  });

  it('records expansions only on generated disassemblies and on parts that have sub-parts', () => {
    const a = atlas();
    a.expansions = [{ part: 'start', provider: 'chatgpt', model: 'm', createdAt: '2026-10-26T12:00:00.000Z' }];
    expect(issues(a).filter(f => f.path === 'expansions[0]').map(f => f.message)).toEqual(['start is not a part with sub-parts', 'Only generated disassemblies are taken apart after generation']);
  });

  it('tells an expansion from any other change, and numbers the next revision', async () => {
    const d = await validateDisassembly(generatedFrom(millEn()));
    const part = leafOf(d);
    const next = takenApart(d, part.id, splitAnswer(d, part.id), meta);
    expect(next.revision).toBe('v2');
    expect(isExpansionOf(next, d)).toBe(part.id);
    const edited = structuredClone(next); edited.title = 'Another title';
    expect(isExpansionOf(edited, d)).toBeUndefined();
    expect(isExpansionOf(d, d)).toBeUndefined();
    expect([nextRevision('v1'), nextRevision('v9'), nextRevision('draft')]).toEqual(['v2', 'v10', 'draft-2']);
  });

  it('carries every kind of progress to the expanded revision and opens the part, but never across another change', async () => {
    const d = await validateDisassembly(generatedFrom(millEn()));
    const part = leafOf(d);
    const next = await validateDisassembly(takenApart(d, part.id, splitAnswer(d, part.id), meta));
    const caseRun = d.runs.find(r => r.type === 'case')!;
    let state = selectPart(d, initialDisassemblyState(d), part.id);
    state = { ...predict(d, state, caseRun.id, 0, 0), notes: { [part.id]: 'my note' }, reassembly: { placements: { [d.reassemble.slots[0].id]: [d.reassemble.slots[0].accepts].flat()[0] }, locked: [] } };
    const moved = carryOver(d, next, state)!;
    expect(moved).toMatchObject({ revision: 'v2', path: [part.id], notes: { [part.id]: 'my note' }, reassembly: state.reassembly, runs: state.runs });
    expect(restoreDisassemblyState(next, moved).notice).toBeUndefined();
    const other = structuredClone(next); other.title = 'Changed';
    expect(carryOver(d, other, state)).toBeUndefined();
  });

  it('keeps every revision on disk, lists only the latest, and moves the saved progress with the expansion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'btw-depth-'));
    try {
      const store = new DisassemblyStore(join(root, 'disassemblies'));
      const d = await store.save(generatedFrom(millEn()));
      const part = leafOf(d);
      const next = await store.save(takenApart(d, part.id, splitAnswer(d, part.id), meta));
      expect((await store.list()).disassemblies.map(x => [x.id, x.revision])).toEqual([[d.id, 'v2']]);
      expect((await readdir(join(root, 'disassemblies', d.id))).sort()).toEqual(['v1.json', 'v2.json']);
      const progress = new ProgressStore(join(root, 'progress'), [], key => store.find(key.disassemblyId, key.revision));
      expect(await progress.carry(d, next)).toBe(false);
      await progress.save({ ...selectPart(d, initialDisassemblyState(d), part.id), notes: { [part.id]: 'kept' } });
      expect(await progress.carry(d, next)).toBe(true);
      expect((await progress.load({ disassemblyId: d.id, revision: 'v2' })).state).toMatchObject({ revision: 'v2', path: [part.id], notes: { [part.id]: 'kept' } });
      expect(JSON.parse(await readFile(join(root, 'progress', '_disassemblies', d.id, 'v1.json'), 'utf8')).revision).toBe('v1');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
