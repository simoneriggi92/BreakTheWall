// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allParts, checkDisassembly, divisible, isExpansionOf, linesOf, nextRevision, validateDisassembly, type Disassembly } from '../src/core/disassembly';
import { acceptExpansion, buildExpansionInput, expandPart, expansionJsonSchema } from '../src/core/disassembly-generation';
import { carryOver, initialDisassemblyState, openPath, predict, restoreDisassemblyState, selectPart } from '../src/core/disassembly-state';
import { layoutDisassembly, layoutFindings } from '../src/core/layout';
import { failure, ProviderError } from '../src/core/provider';
import type { CompletionRequest } from '../src/desktop/completion';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { Generator } from '../src/desktop/generator';
import { ProgressStore } from '../src/desktop/progress-store';
import { atlas, fixture, PUBLIC_FIXTURES, story } from './disassemblies';
import { deepDisassembly, generatedFrom, splitAnswer } from './disassembly-drafts';

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
    const next = expandPart(d, part.id, splitAnswer(d, part.id), meta);
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
    const next = await validateDisassembly(expandPart(d, part.id, splitAnswer(d, part.id), meta));
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
      const next = await store.save(expandPart(d, part.id, splitAnswer(d, part.id), meta));
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

describe('taking a part apart on demand (D14)', () => {
  it('sends the question, the path to the part and only the part’s lines, with the part’s sources as a closed list', async () => {
    const d = await validateDisassembly(generatedFrom(atlas()));
    const input = buildExpansionInput(d, 'check-tests');
    expect(input).toContain('PART TO TAKE APART: check-tests');
    expect(input).toMatch(/- level 1: .*\[check\]/);
    expect(input).toMatch(/ {2}- level 2: .*\[.*\]/);
    const part = allParts(d).find(x => x.part.id === 'check-tests')!.part;
    const numbered = input.split('ITS LINES')[1].split('\n').filter(l => /^\s*\d+\| /.test(l)).map(l => Number(l.split('|')[0]));
    expect(numbered).toEqual(part.cites.flatMap(c => Array.from({ length: c.to - c.from + 1 }, (_, k) => c.from + k)));
    expect((expansionJsonSchema(d, 'check-tests') as any).properties.parts.items.properties.cites.items.properties.source.enum).toEqual(['runbook']);
  });

  it('accepts a split that accounts for the part’s lines, and locates what is wrong in the answer’s own terms', async () => {
    const d = await validateDisassembly(generatedFrom(millEn()));
    const part = leafOf(d);
    const answer = splitAnswer(d, part.id);
    const next = acceptExpansion(JSON.stringify(answer), d, part.id, meta);
    expect(next.expansions).toEqual([{ part: part.id, ...meta }]);
    await expect(validateDisassembly(next)).resolves.toBeTruthy();
    const short = structuredClone(answer); short.parts[2].cites = short.parts[2].cites.slice(0, 0).concat([{ ...short.parts[2].cites[0], to: short.parts[2].cites[0].from }]);
    const findings = (raw: string) => { try { acceptExpansion(raw, d, part.id, meta); return []; } catch (e) { return (e as { findings: { path: string; message: string }[] }).findings; } };
    expect(findings(JSON.stringify(short))).toContainEqual({ path: 'parts', message: expect.stringMatching(/are cited by .* but by none of its sub-parts, and not excluded/) });
    const outside = structuredClone(answer); outside.parts[0].cites = [{ source: d.sources[0].id, from: 1, to: 1 }];
    expect(findings(JSON.stringify(outside))).toContainEqual({ path: 'parts[0].cites', message: `Lines 1–1 are outside ${part.id}; cite only its own lines` });
    const reused = structuredClone(answer); reused.parts[0].id = d.parts[0].id;
    expect(findings(JSON.stringify(reused)).map(f => f.message)).toContainEqual(`Duplicate part id ${d.parts[0].id}`);
  });

  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map(x => rm(x, { recursive: true, force: true }))); });
  async function setup(answer: (request: CompletionRequest, n: number) => string | Promise<string>) {
    const root = await mkdtemp(join(tmpdir(), 'btw-expand-')); dirs.push(root);
    const store = new DisassemblyStore(root);
    const d = await store.save(generatedFrom(millEn()));
    const seen: CompletionRequest[] = [];
    const carry = vi.fn(async () => true);
    const chatgpt = { complete: vi.fn(async (request: CompletionRequest, signal: AbortSignal) => { seen.push(request); if (signal.aborted) throw new ProviderError(failure('cancelled')); return answer(request, seen.length); }) };
    const generator = new Generator({ chatgpt, local: () => chatgpt }, store, () => new Date('2026-10-26T12:00:00Z'), carry);
    const part = leafOf(d);
    return { root, store, d, part, seen, carry, generator, request: (extra: object = {}) => ({ disassemblyId: d.id, revision: d.revision, part: part.id, route: { provider: 'chatgpt', model: 'strong' }, ...extra }) };
  }

  it('takes a part apart with one request, saves the new revision and moves the progress', async () => {
    const ctx = await setup(() => JSON.stringify(splitAnswer(ctx.d, ctx.part.id)));
    const { generator, request, seen, store, d, part, carry } = ctx;
    const result = await generator.expand(request(), () => {});
    expect(result).toMatchObject({ ok: true, moved: true, stats: { requests: 1, repairs: 0 }, disassembly: { revision: 'v2', expansions: [{ part: part.id, provider: 'chatgpt', model: 'strong' }] } });
    expect(seen.map(x => x.schemaName)).toEqual(['break_the_wall_expansion']);
    expect(carry).toHaveBeenCalledWith(d, expect.objectContaining({ revision: 'v2' }));
    expect((await store.list()).disassemblies[0].revision).toBe('v2');
  });

  it('repairs a split that forgets lines once, then refuses and changes nothing', async () => {
    const forgetful = (d: Disassembly, id: string) => { const a = splitAnswer(d, id); a.parts[2].cites = [{ ...a.parts[2].cites[0], to: a.parts[2].cites[0].from }]; return JSON.stringify(a); };
    const once = await setup((_r, n) => n === 1 ? forgetful(once.d, once.part.id) : JSON.stringify(splitAnswer(once.d, once.part.id)));
    expect(await once.generator.expand(once.request(), () => {})).toMatchObject({ ok: true, stats: { requests: 2, repairs: 1 } });
    expect(once.seen[1].messages[2].content).toMatch(/- parts: Lines .* are cited by .* but by none of its sub-parts, and not excluded/);
    const never = await setup(() => forgetful(never.d, never.part.id));
    const refused = await never.generator.expand(never.request(), () => {});
    expect(refused).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: [expect.stringMatching(new RegExp(`^part ${never.part.id} · parts: `))] } });
    expect(await readdir(join(never.root, never.d.id))).toEqual(['v1.json']);
    expect(never.carry).not.toHaveBeenCalled();
  });

  it('refuses before any request a part that is too small, already open, or in a prepared disassembly', async () => {
    const { generator, request, seen, d } = await setup(() => '{}');
    const small = allParts(d).find(x => !x.part.parts && !divisible(d, x.part))!.part;
    expect(linesOf(d, small.cites).size).toBeLessThan(6);
    expect(await generator.expand(request({ part: small.id }), () => {})).toMatchObject({ ok: false, failure: { code: 'unsupported', reason: 'part-not-divisible' } });
    const open = d.parts.find(p => p.parts)!;
    expect(await generator.expand(request({ part: open.id }), () => {})).toMatchObject({ ok: false, failure: { code: 'unsupported' } });
    expect(await generator.expand(request({ disassemblyId: 'mill-harm-en' }), () => {})).toMatchObject({ ok: false, failure: { code: 'unsupported' } });
    expect(seen).toHaveLength(0);
  });

  it('cancels without saving a revision', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { generator, request, root, d, part } = await setup(async () => { await gate; return JSON.stringify(splitAnswer(d, part.id)); });
    const pending = generator.expand(request(), () => {});
    await vi.waitFor(() => expect(release).toBeDefined());
    generator.cancel(); release();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect(await readdir(join(root, d.id))).toEqual(['v1.json']);
  });
});
