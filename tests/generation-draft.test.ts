// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Disassembly } from '../src/core/disassembly';
import { failure, previewSchema, ProviderError, resumable, type GenerationProgress } from '../src/core/provider';
import { importSource } from '../src/core/source';
import type { CompletionRequest } from '../src/desktop/completion';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { DraftStore } from '../src/desktop/generation-draft';
import { Generator } from '../src/desktop/generator';
import { story } from './disassemblies';
import { draftsFrom, pastedSource, scriptedAnswer } from './disassembly-drafts';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
type Answer = (request: CompletionRequest) => string | undefined | Promise<string | undefined>;
const gpt = { provider: 'chatgpt', model: 'm' };

/** A generator with a real draft file and saved-disassembly store, answering from the story fixture unless `answer` says otherwise. */
async function setup(d: Disassembly = story()) {
  const root = await mkdtemp(join(tmpdir(), 'btw-draft-')); dirs.push(root);
  const source = await pastedSource(d);
  const drafts = draftsFrom(d, source.id);
  const seen: CompletionRequest[] = [];
  const state = { answer: undefined as Answer | undefined };
  const complete = vi.fn(async (request: CompletionRequest, signal: AbortSignal) => {
    seen.push(request);
    if (signal.aborted) throw new ProviderError(failure('cancelled'));
    const own = await state.answer?.(request);
    // A real route rejects once its signal is aborted, even when the answer was already on its way.
    if (signal.aborted) throw new ProviderError(failure('cancelled'));
    return own ?? scriptedAnswer(drafts, request.schemaName, request.messages[0].content);
  });
  const file = join(root, 'generation-draft.json');
  const keeper = new DraftStore(file);
  const generator = new Generator({ chatgpt: { complete }, local: () => ({ complete }) }, new DisassemblyStore(join(root, 'disassemblies')), () => new Date('2026-10-27T10:00:00Z'), undefined, keeper);
  const request = (extra: object = {}) => ({ sources: [source], goal: { outcome: d.question ?? '', priorKnowledge: '' }, language: d.language, setup: { structure: gpt, content: gpt }, ...extra });
  const names = () => seen.map(x => x.schemaName);
  return { root, file, keeper, generator, request, seen, names, state, source, drafts };
}
const writing = (part: string) => (request: CompletionRequest) => request.schemaName === 'break_the_wall_part' && request.messages[0].content.includes(`PART TO WRITE: ${part}`);
/** Five points, one over the schema's limit: a mix of findings, so no shorten request either. */
const broken = (drafts: ReturnType<typeof draftsFrom>) => JSON.stringify({ ...drafts.contents[3], points: [{ text: 'x'.repeat(2001), mark: null }, ...Array(4).fill({ text: 'The bell rings.', mark: null })] });

describe('keeping a failed generation and resuming it (D21)', () => {
  it('keeps the other parts when one fails twice, then resumes with one content request and the runs request', async () => {
    const { generator, request, keeper, names, seen, state, drafts, file } = await setup();
    state.answer = r => writing('bell')(r) ? broken(drafts) : undefined;
    const failed = await generator.generate(request(), () => {});
    expect(failed).toMatchObject({ ok: false, failure: { code: 'invalid-output' }, stats: { content: { requests: 8, repairs: 1 } } });
    expect(names().filter(x => x === 'break_the_wall_part')).toHaveLength(8);
    expect(await keeper.state()).toEqual({ draft: { sources: [expect.objectContaining({ sha256: expect.any(String) })], question: story().question, language: 'en', title: story().title, parts: 7, kept: 6, runs: false } });

    seen.length = 0; state.answer = undefined;
    const progress: GenerationProgress[] = [];
    const resumed = await generator.generate(request({ resume: true }), p => progress.push(p));
    expect(resumed).toMatchObject({ ok: true, stats: { structure: { requests: 1 }, content: { requests: 9, repairs: 1 }, runs: { requests: 1 } } });
    expect(names()).toEqual(['break_the_wall_part', 'break_the_wall_runs']);
    expect(seen[0].messages[0].content).toContain('PART TO WRITE: bell');
    // D22: the preview of a resumed generation starts with its kept parts done.
    expect(progress.find(p => p.preview)!.preview!.parts.map(p => p.status)).toEqual(['done', 'done', 'done', 'waiting', 'done', 'done', 'done']);
    expect(await keeper.state()).toEqual({ draft: null });
    expect(await readdir(join(file, '..'))).not.toContain('generation-draft.json');
  });

  it('resumes a failed runs phase with only the runs request', async () => {
    const { generator, request, keeper, names, seen, state } = await setup();
    state.answer = r => r.schemaName === 'break_the_wall_runs' ? '{"runs": []}' : undefined;
    expect(await generator.generate(request(), () => {})).toMatchObject({ ok: false, failure: { code: 'invalid-output' } });
    expect((await keeper.state()).draft).toMatchObject({ parts: 7, kept: 7, runs: false });
    seen.length = 0; state.answer = undefined;
    expect(await generator.generate(request({ resume: true }), () => {})).toMatchObject({ ok: true });
    expect(names()).toEqual(['break_the_wall_runs']);
  });

  it('offers only a fresh start when the source, the question or the language changed', async () => {
    const { generator, request, keeper, seen, state, source } = await setup();
    state.answer = r => r.schemaName === 'break_the_wall_runs' ? '{"runs": []}' : undefined;
    await generator.generate(request(), () => {});
    const draft = (await keeper.state()).draft!;
    const changed = await importSource({ kind: 'paste', title: source.title, text: source.text + '\nOne more line.' });
    const same = { sources: [source], question: story().question, language: 'en' as const };
    expect(resumable(draft, same)).toBe(true);
    expect(resumable(draft, { ...same, sources: [changed] })).toBe(false);
    expect(resumable(draft, { ...same, question: 'Why was the bell rung twice that night?' })).toBe(false);
    expect(resumable(draft, { ...same, language: 'it' })).toBe(false);
    seen.length = 0;
    for (const extra of [{ sources: [changed] }, { goal: { outcome: 'Why was the bell rung twice that night?', priorKnowledge: '' } }]) {
      expect(await generator.generate(request({ ...extra, resume: true }), () => {})).toMatchObject({ ok: false, failure: { code: 'unsupported', reason: 'draft-changed' } });
    }
    expect(seen).toHaveLength(0);
    // A new generation starts over: the draft is deleted before the structure request.
    state.answer = undefined;
    expect(await generator.generate(request(), () => {})).toMatchObject({ ok: true });
    expect(seen[0].schemaName).toBe('break_the_wall_structure');
    expect(await keeper.state()).toEqual({ draft: null });
  });

  it('keeps what was accepted when cancelled, and the cancelled part is not among it', async () => {
    const { generator, request, keeper, state } = await setup();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    state.answer = async r => { if (writing('bell')(r)) await gate; return undefined; };
    const pending = generator.generate(request(), () => {});
    await vi.waitFor(async () => expect((await keeper.state()).draft?.kept).toBe(6));
    generator.cancel(); release();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect((await keeper.state()).draft).toMatchObject({ parts: 7, kept: 6, runs: false });
  });

  it('sets an unreadable draft aside once, with a notice, and starts fresh', async () => {
    const { generator, request, keeper, file, names } = await setup();
    await writeFile(file, '{"version": 1, "structure": ');
    expect(await keeper.state()).toEqual({ draft: null, setAside: true });
    expect(await readdir(join(file, '..'))).toContain('generation-draft.unreadable.json');
    expect(await keeper.state()).toEqual({ draft: null });
    expect(await generator.generate(request(), () => {})).toMatchObject({ ok: true });
    expect(names()[0]).toBe('break_the_wall_structure');
  });
});

describe('the drawing while it is written (D22)', () => {
  it('previews the top level after the structure, part by part, with leads and points of the parts that are done, and a failed part', async () => {
    const { generator, request, state, drafts } = await setup();
    state.answer = r => writing('bell')(r) ? broken(drafts) : undefined;
    const progress: GenerationProgress[] = [];
    await generator.generate(request(), p => progress.push(p));
    expect(progress.filter(p => p.phase === 'structure').every(p => !p.preview)).toBe(true);
    const previews = progress.flatMap(p => p.preview ? [p.preview] : []);
    expect(previews.every(p => previewSchema.safeParse(p).success)).toBe(true);
    expect(previews[0].parts.map(p => p.status)).toEqual(Array(7).fill('waiting'));
    expect(previews[0].joints).toEqual(drafts.structure.joints.map(({ from, to, type, label }) => ({ from, to, type, label })));
    // Statuses change one part at a time: each preview has at most one more part done than the one before.
    const done = previews.map(p => p.parts.filter(x => x.status === 'done').length);
    expect(done.every((n, i) => !i || n - done[i - 1] <= 1)).toBe(true);
    expect(previews.some(p => p.parts.some(x => x.status === 'writing'))).toBe(true);
    const last = previews.at(-1)!;
    expect(last.parts.map(p => p.status)).toEqual(['done', 'done', 'done', 'failed', 'done', 'done', 'done']);
    expect(last.parts[0]).toMatchObject({ id: drafts.structure.parts[0].id, lead: drafts.structure.parts[0].role, points: drafts.contents[0].points.map(x => x.text) });
    expect(last.parts[3]).not.toHaveProperty('lead');
  });

  it('marks every plate done during the runs phase', async () => {
    const { generator, request } = await setup();
    const progress: GenerationProgress[] = [];
    await generator.generate(request(), p => progress.push(p));
    const runs = progress.filter(p => p.phase === 'runs');
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every(p => p.preview?.parts.every(x => x.status === 'done'))).toBe(true);
  });
});

describe('suggested break-downs through the host (D23)', () => {
  const cites = (id: string) => [{ source: id, from: 1, to: 4 }];
  const valid = (id: string) => JSON.stringify({ suggestions: [
    { question: 'Why did the town vote to build the wall?', kind: 'story', parts: ['Storm', 'Vote', 'Wall'], cites: cites(id) },
    { question: 'How did the storm reach the quay and the hall?', kind: 'story', parts: ['Storm', 'Quay', 'Hall'], cites: cites(id) },
    { question: 'What did the railway change for the quay?', kind: 'story', parts: ['Railway', 'Quay', 'Bell'], cites: cites(id) },
  ] });
  const ask = (source: { id: string }, extra: object = {}) => ({ sources: [source], language: 'en', priorKnowledge: '', route: gpt, avoid: [], ...extra });

  it('sends one request to the given route only when asked, and returns the checked suggestions', async () => {
    const { generator, seen, state, source } = await setup();
    state.answer = r => r.schemaName === 'break_the_wall_suggestions' ? valid(source.id) : undefined;
    expect(seen).toHaveLength(0);
    const result = await generator.suggest(ask(source, { avoid: ['An earlier question?'] }));
    expect(result).toMatchObject({ ok: true, suggestions: [{ kind: 'story' }, {}, {}] });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ model: 'm', schemaName: 'break_the_wall_suggestions' });
    expect(seen[0].messages[0].content).toContain('- An earlier question?');
  });

  it('repairs duplicate questions, another language or a range outside the sources once, then refuses with a notice', async () => {
    const { generator, seen, state, source } = await setup();
    const bad = JSON.parse(valid(source.id)); bad.suggestions[1].question = bad.suggestions[0].question; bad.suggestions[2].cites = [{ source: source.id, from: 30, to: 40 }];
    state.answer = () => JSON.stringify(bad);
    const result = await generator.suggest(ask(source));
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: [expect.stringMatching(/^suggestions · suggestions\[1\]\.question/), expect.stringMatching(/cites/)] } });
    expect(seen).toHaveLength(2);
    expect(seen[1].messages[2].content).toContain('suggestions[1].question: Repeats another question');
  });

  it('stops on cancel, and when a generation starts', async () => {
    const { generator, state, source, request } = await setup();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    state.answer = async r => { if (r.schemaName === 'break_the_wall_suggestions') { await gate; return valid(source.id); } return undefined; };
    const first = generator.suggest(ask(source));
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(await generator.suggest(ask(source))).toMatchObject({ ok: false, failure: { code: 'busy' } });
    generator.cancelSuggestions(); release();
    expect(await first).toMatchObject({ ok: false, failure: { code: 'cancelled' } });

    let again!: () => void;
    const second = new Promise<void>(resolve => { again = resolve; });
    state.answer = async r => { if (r.schemaName === 'break_the_wall_suggestions') { await second; return valid(source.id); } return undefined; };
    const pending = generator.suggest(ask(source));
    const generated = generator.generate(request(), () => {});
    again();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect(await generated).toMatchObject({ ok: true });
  });
});
