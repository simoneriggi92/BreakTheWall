// @vitest-environment node
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationMeta } from '../src/core/disassembly-generation';
import { acceptExploration, EXPLORATION_SOURCE_LIMIT } from '../src/core/exploration-generation';
import { hashText } from '../src/core/lesson';
import { importSource, type UserSource } from '../src/core/source';
import type { CompletionRequest } from '../src/desktop/completion';
import { ExplorationStore } from '../src/desktop/exploration-store';
import { Generator } from '../src/desktop/generator';
import { BAKERY, bakery, toAnswer } from './explorations';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'btw-explorations-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const meta: GenerationMeta = { id: 'x-stored', createdAt: '2026-11-06T10:00:00.000Z', provider: 'chatgpt', model: 'model-a' };
const source = () => importSource({ kind: 'paste', title: 'The night bakery', text: BAKERY });
const answer = async () => JSON.stringify(toAnswer(await bakery()));
async function broken() { const a = toAnswer(await bakery()); a.parts[1].members[0].cites = [[40, 41]]; return JSON.stringify(a); }
const chatgpt = { provider: 'chatgpt' as const, model: 'model-a' };

function setup(answers: (string | ((signal: AbortSignal) => Promise<string>))[]) {
  const requests: CompletionRequest[] = [];
  const complete = vi.fn(async (request: CompletionRequest, signal: AbortSignal) => {
    requests.push(request);
    const next = answers.shift();
    if (next === undefined) throw new Error('no answer scripted');
    return typeof next === 'string' ? next : next(signal);
  });
  const store = new ExplorationStore(join(root, 'explorations'));
  const generator = new Generator({ chatgpt: { complete }, local: () => ({ complete }) }, { save: async d => d }, () => new Date('2026-11-06T12:00:00Z'), undefined, undefined, store);
  return { generator, store, requests, complete };
}

describe('the exploration store (X8)', () => {
  it('round-trips a generated exploration and finds it by id and revision', async () => {
    const store = new ExplorationStore(join(root, 'explorations'));
    const x = acceptExploration(await answer(), { source: await source(), language: 'en', meta });
    expect(await store.save(x)).toEqual(x);
    expect(await store.list()).toEqual({ explorations: [x], skipped: 0 });
    expect(await store.find('x-stored', 'v1')).toEqual(x);
    expect(await store.find('x-stored', 'v2')).toBeUndefined();
  });

  it('skips and counts an invalid or misplaced file, and refuses to store a prepared one', async () => {
    const store = new ExplorationStore(join(root, 'explorations'));
    const x = acceptExploration(await answer(), { source: await source(), language: 'en', meta });
    await store.save(x);
    await mkdir(join(root, 'explorations', 'x-bad'), { recursive: true });
    await writeFile(join(root, 'explorations', 'x-bad', 'v1.json'), '{"schemaVersion":1}');
    await mkdir(join(root, 'explorations', 'x-other'), { recursive: true });
    await writeFile(join(root, 'explorations', 'x-other', 'v1.json'), JSON.stringify(x));
    const listed = await store.list();
    expect(listed.explorations.map(e => e.id)).toEqual(['x-stored']);
    expect(listed.skipped).toBe(2);
    await expect(store.save(await bakery())).rejects.toThrow(/Only generated/);
  });

  it('lists nothing when the folder does not exist yet', async () => {
    expect(await new ExplorationStore(join(root, 'none')).list()).toEqual({ explorations: [], skipped: 0 });
  });
});

describe('explore: one request, one repair, saved after the final check (X8)', () => {
  it('saves a valid answer with the route that produced it', async () => {
    const { generator, store, requests } = setup([await answer()]);
    const progress = vi.fn();
    const result = await generator.explore({ source: await source(), language: 'en', route: chatgpt }, progress);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exploration.generation).toMatchObject({ provider: 'chatgpt', model: 'model-a', createdAt: '2026-11-06T12:00:00.000Z' });
    expect(result.exploration.id).toMatch(/^x-/);
    expect(result.stats).toMatchObject({ requests: 1, repairs: 0 });
    expect(requests[0]).toMatchObject({ model: 'model-a', schemaName: 'break_the_wall_exploration' });
    expect(requests[0].messages[0].content).toMatch(/^Read this source and return its structure\./);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'structure', repairing: false }));
    expect((await store.list()).explorations).toHaveLength(1);
  });

  it('sends one repair with the findings and saves the repaired answer', async () => {
    const first = await broken();
    const { generator, store, requests } = setup([first, await answer()]);
    const result = await generator.explore({ source: await source(), language: 'en', route: chatgpt }, () => {});
    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(requests[1].messages[1].content).toBe(first);
    expect(requests[1].messages[2].content).toContain('- parts[1].members[0].cites[0]: Line 41 is past the end of the source');
    expect((await store.list()).explorations).toHaveLength(1);
  });

  it('saves nothing after a second failure and reports the findings', async () => {
    const { generator, store, requests } = setup([await broken(), await broken()]);
    const result = await generator.explore({ source: await source(), language: 'en', route: chatgpt }, () => {});
    expect(requests).toHaveLength(2);
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output' } });
    if (result.ok) return;
    expect(result.failure.issues).toEqual([expect.stringMatching(/^exploration · parts\[1\]\.members\[0\]\.cites\[0\]: Line 41/)]);
    expect(await readdir(root)).toEqual([]);
    expect((await store.list()).explorations).toEqual([]);
  });

  it('stops the request on cancel and saves nothing', async () => {
    const waiting = (signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const { generator, store, complete } = setup([waiting]);
    const running = generator.explore({ source: await source(), language: 'en', route: chatgpt }, () => {});
    expect(await generator.explore({ source: {}, language: 'en', route: chatgpt }, () => {})).toMatchObject({ failure: { code: 'busy' } });
    await vi.waitFor(() => expect(complete).toHaveBeenCalled());
    generator.cancel();
    expect(await running).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect((await store.list()).explorations).toEqual([]);
  });

  it('refuses the local route with a code, and a source over the limit before any request', async () => {
    const { generator, complete } = setup([]);
    const local = { provider: 'local' as const, runtime: 'ollama' as const, baseUrl: 'http://127.0.0.1:11434', model: 'm' };
    expect(await generator.explore({ source: await source(), language: 'en', route: local }, () => {}))
      .toMatchObject({ ok: false, failure: { code: 'unsupported', reason: 'exploration-local' } });
    const text = Array.from({ length: 600 }, () => 'a'.repeat(99)).join('\n'), sha256 = await hashText(text);
    const long: UserSource = { id: `src-${sha256.slice(0, 12)}`, title: 'Long', origin: 'user-pasted', revision: 'v1', text, sha256 };
    const result = await generator.explore({ source: long, language: 'en', route: chatgpt }, () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'unsupported', reason: 'exploration-too-long' } });
    if (!result.ok) expect(result.failure.issues?.[0]).toContain(`at most ${EXPLORATION_SOURCE_LIMIT}`);
    expect(complete).not.toHaveBeenCalled();
  });
});
