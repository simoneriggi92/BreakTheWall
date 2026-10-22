// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, parseLocalAddress, ProviderError, type LocalModel, type ProviderFailure } from '../src/core/provider';
import type { CompletionRequest } from '../src/desktop/completion';
import { Generator } from '../src/desktop/generator';
import { LessonStore } from '../src/desktop/lesson-store';
import { checkFormat, closeReasoning, completeLocal, detectServer, discoverServers } from '../src/desktop/local/runtimes';
import { SettingsStore } from '../src/desktop/settings-store';
import { draftFor, userSource } from './draft';

type Handler = (body: unknown) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const stream = (text: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } }), { status: 200 });
const ndjson = (events: object[]) => stream(events.map(e => JSON.stringify(e)).join('\n') + '\n');
const sse = (events: (object | string)[]) => stream(events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''));

/** A fake loopback network: "METHOD url" → handler. Anything else is a refused connection. */
function network(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ key, body });
    if ((init?.signal as AbortSignal | undefined)?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const handler = routes[key];
    if (!handler) throw new TypeError('fetch failed');
    return handler(body);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const request: CompletionRequest = { model: 'm', instructions: 'Istruzioni', messages: [{ role: 'user', content: 'Fonte e obiettivo' }], schemaName: 'lesson', schema: { type: 'object' } };
const fail = async (promise: Promise<unknown>): Promise<ProviderFailure> => {
  try { await promise; } catch (error) { expect(error).toBeInstanceOf(ProviderError); return (error as ProviderError).failure; }
  throw new Error('expected a provider failure');
};
const ollama: LocalModel = { runtime: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'qwen' };
const llamacpp: LocalModel = { runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf' };
const lmstudio: LocalModel = { runtime: 'lmstudio', baseUrl: 'http://127.0.0.1:1234', model: 'qwen/qwen3.6' };

describe('local addresses (T5b)', () => {
  it('accepts only this machine and normalizes to an origin', () => {
    expect(parseLocalAddress('localhost:1234')).toBe('http://127.0.0.1:1234');
    expect(parseLocalAddress('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(parseLocalAddress('[::1]:8080')).toBe('http://[::1]:8080');
    for (const bad of ['192.168.1.20:11434', 'example.com:80', 'https://localhost:1234', 'http://127.0.0.1@evil.example:80', 'http://user:pw@localhost:1234', 'localhost', 'file:///etc/passwd', 'http://127.0.0.2:80']) {
      expect(() => parseLocalAddress(bad), bad).toThrow(ProviderError);
    }
  });
});

describe('discovery (T5b)', () => {
  it('identifies each runtime by its own endpoints and lists usable models', async () => {
    const { fetchImpl } = network({
      'GET http://127.0.0.1:11434/api/version': () => json({ version: '0.30.8' }),
      'GET http://127.0.0.1:11434/api/tags': () => json({ models: [{ name: 'qwen3.6:35b' }, { name: 'nomic-embed-text:latest' }] }),
      'GET http://127.0.0.1:1234/api/version': () => json({}, 404),
      'GET http://127.0.0.1:1234/props': () => json({}, 404),
      'GET http://127.0.0.1:1234/api/v0/models': () => json({ data: [{ id: 'qwen/qwen3.6', type: 'llm' }, { id: 'text-embedding', type: 'embeddings' }] }),
      'GET http://127.0.0.1:8080/props': () => json({ default_generation_settings: {}, model_path: '/models/qwen.gguf' }),
      'GET http://127.0.0.1:8080/v1/models': () => json({ data: [{ id: 'qwen.gguf' }] }),
    });
    expect(await discoverServers(fetchImpl)).toEqual([
      { runtime: 'ollama', baseUrl: 'http://127.0.0.1:11434', version: '0.30.8', models: ['qwen3.6:35b'] },
      { runtime: 'lmstudio', baseUrl: 'http://127.0.0.1:1234', models: ['qwen/qwen3.6'] },
      { runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', models: ['qwen.gguf'] },
    ]);
  });

  it('ignores refused ports and unrelated servers, and recognizes a generic OpenAI-compatible server', async () => {
    const { fetchImpl } = network({
      'GET http://127.0.0.1:3000/api/version': () => new Response('<html>dev server</html>', { status: 200 }),
      'GET http://127.0.0.1:9000/v1/models': () => json({ data: [{ id: 'local-model' }] }),
    });
    expect(await discoverServers(fetchImpl)).toEqual([]);
    expect(await detectServer(fetchImpl, 'localhost:3000')).toBeNull();
    expect(await detectServer(fetchImpl, 'localhost:9000')).toEqual({ runtime: 'openai', baseUrl: 'http://127.0.0.1:9000', models: ['local-model'] });
    await expect(detectServer(fetchImpl, '10.0.0.5:11434')).rejects.toThrow(ProviderError);
  });
});

describe('schema-constrained requests per runtime (T5b)', () => {
  it('Ollama: sends the schema as format, sizes the context window and streams NDJSON', async () => {
    const { fetchImpl, calls } = network({ 'POST http://127.0.0.1:11434/api/chat': () => ndjson([{ message: { content: '{"a":' } }, { message: { content: '1}' } }, { done: true, done_reason: 'stop' }]) });
    const progress: number[] = [];
    await expect(completeLocal(fetchImpl, ollama, request, new AbortController().signal, n => progress.push(n))).resolves.toBe('{"a":1}');
    expect(progress).toEqual([5, 7]);
    expect(calls[0].body).toMatchObject({ model: 'qwen', format: { type: 'object' }, stream: true, think: false, options: { num_ctx: 16_384 }, messages: [{ role: 'system', content: 'Istruzioni' }, { role: 'user', content: 'Fonte e obiettivo' }] });
  });

  it('Ollama: retries without the reasoning switch for models that reject it', async () => {
    let first = true;
    const { fetchImpl, calls } = network({ 'POST http://127.0.0.1:11434/api/chat': () => { if (first) { first = false; return json({ error: '"qwen" does not support thinking' }, 400); } return ndjson([{ message: { content: '{}' } }, { done: true }]); } });
    await expect(completeLocal(fetchImpl, ollama, request, new AbortController().signal, () => {})).resolves.toBe('{}');
    expect(calls.map(c => 'think' in (c.body as object))).toEqual([true, false]);
  });

  it('llama.cpp: applies the chat template, closes an opened reasoning block and constrains /completion with json_schema', async () => {
    const { fetchImpl, calls } = network({
      'POST http://127.0.0.1:8080/apply-template': () => json({ prompt: '<|im_start|>assistant\n<think>\n' }),
      'POST http://127.0.0.1:8080/completion': () => sse([{ content: '{"b":', stop: false }, { content: '2}', stop: true, stop_type: 'eos' }]),
    });
    await expect(completeLocal(fetchImpl, llamacpp, request, new AbortController().signal, () => {})).resolves.toBe('{"b":2}');
    expect(calls[1].body).toMatchObject({ prompt: '<|im_start|>assistant\n<think>\n</think>\n\n', json_schema: { type: 'object' }, stream: true });
    expect(closeReasoning('plain prompt')).toBe('plain prompt');
  });

  it('LM Studio and compatible servers: use response_format json_schema over SSE', async () => {
    const { fetchImpl, calls } = network({ 'POST http://127.0.0.1:1234/v1/chat/completions': () => sse([{ choices: [{ delta: { content: '{"c":' } }] }, { choices: [{ delta: { content: '3}' }, finish_reason: 'stop' }] }, '[DONE]']) });
    await expect(completeLocal(fetchImpl, lmstudio, request, new AbortController().signal, () => {})).resolves.toBe('{"c":3}');
    expect(calls[0].body).toMatchObject({ model: 'qwen/qwen3.6', stream: true, response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema: { type: 'object' } } } });
  });

  it('maps stopped servers, missing models, small contexts, truncation and cancellation to recoverable states', async () => {
    const run = (target: LocalModel, routes: Record<string, Handler>, signal = new AbortController().signal) => fail(completeLocal(network(routes).fetchImpl, target, request, signal, () => {}));
    expect((await run(ollama, {})).code).toBe('local-unreachable');
    expect((await run(ollama, { 'POST http://127.0.0.1:11434/api/chat': () => json({ error: "model 'qwen' not found" }, 404) })).code).toBe('local-model-missing');
    expect((await run(llamacpp, { 'POST http://127.0.0.1:8080/apply-template': () => json({ prompt: 'p' }), 'POST http://127.0.0.1:8080/completion': () => json({ error: { message: 'the request exceeds the available context size' } }, 400) })).code).toBe('local-context');
    expect((await run(llamacpp, { 'POST http://127.0.0.1:8080/apply-template': () => json({ prompt: 'p' }), 'POST http://127.0.0.1:8080/completion': () => sse([{ content: '{', stop: true, stop_type: 'limit' }]) })).code).toBe('incomplete');
    expect((await run(lmstudio, { 'POST http://127.0.0.1:1234/v1/chat/completions': () => sse([{ choices: [{ delta: { content: '{' } }] }]) })).code).toBe('incomplete');
    expect((await run(ollama, { 'POST http://127.0.0.1:11434/api/chat': () => ndjson([{ message: { content: '{' } }, { done: true, done_reason: 'length' }]) })).code).toBe('incomplete');
    const aborted = new AbortController(); aborted.abort();
    expect((await run(ollama, { 'POST http://127.0.0.1:11434/api/chat': () => ndjson([]) }, aborted.signal)).code).toBe('cancelled');
  });
});

describe('format check (T5b)', () => {
  it('reports enforcement only when the server returns the probe schema instead of following the prompt', async () => {
    const enforcing = network({ 'POST http://127.0.0.1:1234/v1/chat/completions': () => sse([{ choices: [{ delta: { content: '{"risposta":"pronto","numero":4}' }, finish_reason: 'stop' }] }, '[DONE]']) });
    expect(await checkFormat(enforcing.fetchImpl, lmstudio)).toMatchObject({ enforced: true });
    expect((enforcing.calls[0].body as { max_tokens: number }).max_tokens).toBe(120);
    // What Ollama 0.30.8 did in the trial: valid JSON that ignores the schema.
    const ignoring = network({ 'POST http://127.0.0.1:11434/api/chat': () => ndjson([{ message: { content: '{"nome":"Luna","colore":"grigio"}' } }, { done: true }]) });
    const check = await checkFormat(ignoring.fetchImpl, ollama);
    expect(check.enforced).toBe(false);
    expect(check.detail).toContain('Luna');
    // Seen live: the model ignoring the schema wrote past the probe's budget instead of closing the object.
    const rambling = network({ 'POST http://127.0.0.1:11434/api/chat': () => ndjson([{ message: { content: 'Ecco un gatto: {"nome": "Luna", "descrizione": "' } }, { done: true, done_reason: 'length' }]) });
    expect(await checkFormat(rambling.fetchImpl, ollama)).toMatchObject({ enforced: false, detail: expect.stringContaining('ignorato lo schema') });
  });
});

describe('local generation with one repair pass (T5b)', () => {
  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
  async function setup(responses: ((sourceId: string) => string)[]) {
    const root = await mkdtemp(join(tmpdir(), 'btw-local-')); dirs.push(root);
    const store = new LessonStore(root);
    const source = await userSource();
    const seen: CompletionRequest[] = [];
    const local = vi.fn(() => ({ complete: async (req: CompletionRequest) => { seen.push(req); return responses[seen.length - 1](source.id); } }));
    const chatgpt = { complete: vi.fn(async (req: CompletionRequest) => { seen.push(req); return responses[seen.length - 1](source.id); }) };
    const generator = new Generator({ chatgpt, local }, store, () => new Date('2026-10-22T10:00:00Z'));
    const goal = { outcome: 'Spiegare il ciclo dell’acqua', priorKnowledge: '' };
    return { root, store, seen, local, chatgpt, generator, request: (route: object) => ({ sources: [source], goal, route }) };
  }
  const broken = (id: string) => JSON.stringify({ ...draftFor(id), activities: draftFor(id).activities.map(a => a.type === 'choice' ? { ...a, options: a.options.map(o => ({ ...o, correct: false })) } : a) });
  const valid = (id: string) => JSON.stringify(draftFor(id));
  const route = { provider: 'local', runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf' };

  it('repairs a structurally invalid local draft once, then saves the lesson labelled with its local origin', async () => {
    const { seen, generator, store, local, request } = await setup([broken, valid]);
    const phases: string[] = [];
    const result = await generator.generate(request(route), p => phases.push(p.phase));
    expect(result.ok).toBe(true);
    expect(local).toHaveBeenCalledWith({ runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf' });
    expect(seen).toHaveLength(2);
    expect(seen[1].messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(seen[1].messages[2].content).toContain('La scelta predict deve avere esattamente un’opzione con correct=true');
    expect(phases).toContain('repairing');
    expect((await store.list()).lessons[0].generation).toMatchObject({ provider: 'local', runtime: 'llamacpp', model: 'qwen.gguf' });
  });

  it('gives up after one repair and saves nothing', async () => {
    const { root, generator, request } = await setup([broken, broken]);
    const result = await generator.generate(request(route), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: expect.arrayContaining(['Anche dopo una correzione automatica:']) } });
    expect(await readdir(root)).toEqual([]);
  });

  it('does not spend a second ChatGPT request on repair', async () => {
    const { seen, generator, request } = await setup([broken, valid]);
    const result = await generator.generate(request({ provider: 'chatgpt', model: 'gpt' }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output' } });
    expect(seen).toHaveLength(1);
  });

  it('refuses a local route that points off this machine before sending anything', async () => {
    const { seen, local, generator, request } = await setup([valid]);
    const result = await generator.generate(request({ ...route, baseUrl: 'http://192.168.1.20:8080' }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'local-address' } });
    expect(local).not.toHaveBeenCalled();
    expect(seen).toHaveLength(0);
  });
});

describe('settings (T5b)', () => {
  it('round-trips the chosen route and falls back to defaults on unreadable or invalid files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'btw-settings-'));
    const store = new SettingsStore(join(dir, 'settings.json'));
    expect(await store.read()).toEqual(defaultSettings);
    const chosen = { version: 1 as const, provider: 'local' as const, local: { ...llamacpp, check: { enforced: true, detail: 'ok', checkedAt: '2026-10-22T10:00:00.000Z' } } };
    await store.write(chosen);
    expect(await store.read()).toEqual(chosen);
    await expect(store.write({ ...chosen, local: { ...llamacpp, baseUrl: 'http://10.0.0.2:8080' } })).rejects.toThrow();
    await writeFile(join(dir, 'settings.json'), '{ broken');
    expect(await store.read()).toEqual(defaultSettings);
    await rm(dir, { recursive: true, force: true });
  });
});
