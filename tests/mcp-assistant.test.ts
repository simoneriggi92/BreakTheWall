// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Disassembly } from '../src/core/disassembly';
import { acceptContent, acceptRuns, acceptStructure, assembleDisassembly } from '../src/core/disassembly-generation';
import { saveFromAssistant } from '../src/desktop/assistants';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { answer, IncomingServer, incomingAddress, type IncomingHandlers } from '../src/desktop/incoming';
import { MAX_ATTEMPTS } from '../src/mcp/assistant';
import { createBreakTheWallServer } from '../src/mcp/server';
import { atlas, mill } from './disassemblies';
import { draftsFrom, pastedSource } from './disassembly-drafts';

const call = (server: ReturnType<typeof createBreakTheWallServer>, name: string, args: object, id = 2) =>
  server.handle(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })) as Promise<{ result: { content: { text: string }[]; isError?: boolean } }>;
const textOf = (reply: { result: { content: { text: string }[] } }) => reply.result.content[0].text;
const initialize = (server: ReturnType<typeof createBreakTheWallServer>) =>
  server.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.303' } } }));

/** The app's side of M7, as main.ts wires it: `saveFromAssistant`, then the window opens what was saved. */
function appWith(store: DisassemblyStore, opened: Disassembly[]): IncomingHandlers {
  return {
    version: 'test',
    open: async () => ({ title: 'x', lines: 1 }),
    save: async input => {
      const saved = await saveFromAssistant(store, input);
      opened.push(saved);
      return { id: saved.id, title: saved.title };
    },
  };
}

describe('level B: the assistant writes a disassembly the app checks (M6–M7)', () => {
  const folders: string[] = []; const listeners: IncomingServer[] = [];
  afterEach(async () => {
    for (const l of listeners.splice(0)) await l.setEnabled(false);
    for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true });
  });
  const folder = () => { const f = mkdtempSync(join(tmpdir(), 'btw-')); folders.push(f); return f; };
  async function running(opened: Disassembly[] = []) {
    const data = folder();
    const store = new DisassemblyStore(join(data, 'disassemblies'));
    const address = incomingAddress(process.platform, data);
    const listener = new IncomingServer(address, appWith(store, opened));
    listeners.push(listener);
    await listener.setEnabled(true);
    return { store, address, opened, listener };
  }

  it.each([['Atlas (English)', atlas], ['Mill (Italian)', mill]])('takes %s through every step into the app\'s library', async (_name, load) => {
    const d = load() as Disassembly;
    const app = await running();
    const server = createBreakTheWallServer({ address: app.address, launch: async () => false }, '0.3.0');
    await initialize(server);
    const source = await pastedSource(d);
    const drafts = draftsFrom(d, source.id);

    const started = await call(server, 'start_disassembly', { text: d.sources[0].text, title: d.sources[0].title, question: d.question, language: d.language });
    expect(started.result.isError).toBeUndefined();
    expect(textOf(started)).toContain(`STEP 1: the structure`);
    expect(textOf(started)).toContain('JSON SCHEMA');
    const total = drafts.structure.parts.length + 2;
    const structure = await call(server, 'submit_structure', { json: JSON.stringify(drafts.structure) });
    expect(textOf(structure)).toContain(`STEP 2 of ${total}: the content of part 0`);
    let runsRequest = '';
    for (const [index, content] of drafts.contents.entries()) {
      // A model may pass the JSON as an object rather than a string; both are accepted.
      const reply = await call(server, 'submit_part', { index, json: index % 2 ? content : JSON.stringify(content) });
      expect(reply.result.isError).toBeUndefined();
      expect(textOf(reply)).toContain(index + 1 < drafts.contents.length ? `STEP ${index + 3} of ${total}` : `STEP ${total} of ${total}: the runs`);
      runsRequest = textOf(reply);
    }
    // P-20261029-source-limits S3: the sources are numbered once, in step 1; the runs step names them instead.
    const numbered = /^ *\d+\| /m;
    expect(textOf(started)).toMatch(numbered);
    expect(runsRequest).not.toMatch(numbered);
    expect(runsRequest).toContain(`Cite the line numbers of the numbered sources from step 1:\n  ${source.id} «${source.title}», ${source.text.split('\n').length} lines`);
    const done = await call(server, 'submit_runs', { json: JSON.stringify(drafts.runs) });
    expect(done.result.isError).toBeUndefined();
    expect(textOf(done)).toContain('It is saved in the user\'s Break the Wall library and open there.');

    // What the app stored is exactly what the app's own three phases would have assembled from the same answers.
    const saved = (await app.store.list()).disassemblies;
    expect(saved).toHaveLength(1);
    const [stored] = saved;
    expect(stored.generation).toMatchObject({ provider: 'assistant', model: 'claude-code 2.1.303' });
    const base = { sources: [source], goal: { outcome: d.question ?? '', priorKnowledge: '' }, language: d.language, meta: { id: stored.id, createdAt: stored.generation!.createdAt, provider: 'assistant' as const, model: 'claude-code 2.1.303' } };
    const s = acceptStructure(JSON.stringify(drafts.structure), base);
    const contents = drafts.contents.map((c, i) => acceptContent(JSON.stringify(c), s, i, d.language));
    const runs = acceptRuns(JSON.stringify(drafts.runs), { ...base, structure: s, contents });
    expect(stored).toEqual(await assembleDisassembly({ ...base, structure: s, contents, runs }));
    expect(app.opened.map(x => x.id)).toEqual([stored.id]);
  });

  it('returns the app\'s findings, counts attempts, and after the limit keeps the work and waits for the user (M6a)', async () => {
    const d = atlas() as Disassembly;
    const server = createBreakTheWallServer({ address: 'unused', launch: async () => false }, '0.3.0');
    await call(server, 'start_disassembly', { text: d.sources[0].text, question: d.question });
    const drafts = draftsFrom(d, (await pastedSource(d)).id);
    const broken = structuredClone(drafts.structure);
    broken.parts[0].role = 'x'.repeat(300);
    const first = await call(server, 'submit_structure', { json: JSON.stringify(broken) });
    expect(first.result.isError).toBe(true);
    expect(textOf(first)).toMatch(new RegExp(`^Not accepted \\(attempt 1 of ${MAX_ATTEMPTS} for the structure\\)\\. `));
    expect(textOf(first)).toContain('parts[0].role');
    // A good answer resets the count; then the first part fails every time.
    expect((await call(server, 'submit_structure', { json: JSON.stringify(drafts.structure) })).result.isError).toBeUndefined();
    for (let i = 1; i < MAX_ATTEMPTS; i++) expect(textOf(await call(server, 'submit_part', { index: 0, json: '{"points":[]}' }))).toContain(`attempt ${i} of ${MAX_ATTEMPTS}`);
    const last = await call(server, 'submit_part', { index: 0, json: 'not json' });
    expect(last.result.isError).toBe(true);
    expect(textOf(last)).toContain(`did not accept part 0 after ${MAX_ATTEMPTS} attempts. Everything accepted so far is kept`);
    expect(textOf(last)).toContain('ask whether to try this step again');
    expect(textOf(last)).toContain('open_in_break_the_wall');
    expect(textOf(last)).toContain('The previous answer does not pass the app checks');
    // The structure is still accepted: a new try at part 0 starts a new count, and the rest finishes.
    expect(textOf(await call(server, 'submit_part', { index: 0, json: '{"points":[]}' }))).toContain(`attempt 1 of ${MAX_ATTEMPTS}`);
    for (const [index, content] of drafts.contents.entries()) expect((await call(server, 'submit_part', { index, json: JSON.stringify(content) })).result.isError).toBeUndefined();
    expect(textOf(await call(server, 'submit_runs', { json: JSON.stringify(drafts.runs) }))).toContain('is complete: 6 parts');
  });

  it('takes the whole text apart when no question is given (P-20261029-source-entry E6)', async () => {
    const d = mill() as Disassembly;
    const server = createBreakTheWallServer({ address: (await running()).address, launch: async () => false }, '0.3.0');
    await initialize(server);
    const whole = await call(server, 'start_disassembly', { text: d.sources[0].text, title: d.sources[0].title });
    expect(whole.result.isError).toBeUndefined();
    expect(textOf(whole)).toContain('No question was given: take apart the whole text');
    expect(textOf(whole)).toContain('FOCUS: none. The learner wants to understand the whole source.');
    expect(textOf(whole)).not.toContain('QUESTION:');
    expect(textOf(whole)).not.toContain('outside-question');
    // Without a question or a language, the assistant's default applies: English.
    expect(textOf(whole)).toContain('written in English');
    const asked = await call(server, 'start_disassembly', { text: d.sources[0].text, title: d.sources[0].title, question: d.question });
    expect(textOf(asked)).toContain(`QUESTION: ${d.question}`);
    expect(textOf(asked)).not.toContain('No question was given');
  });

  it('refuses steps out of order, a short question and an oversized text; a new start replaces an unfinished session', async () => {
    const d = mill() as Disassembly;
    const server = createBreakTheWallServer({ address: 'unused', launch: async () => false }, '0.3.0');
    expect(textOf(await call(server, 'submit_structure', { json: '{}' }))).toBe('No disassembly is in progress: call start_disassembly first.');
    expect(textOf(await call(server, 'start_disassembly', { text: 'one line', question: 'Why?' }))).toContain('10 to 400 characters');
    expect(textOf(await call(server, 'start_disassembly', { text: 'x'.repeat(120_001), question: 'What does this text say?' }))).toContain('at most 120000');
    expect((await call(server, 'start_disassembly', { text: 'a\nb', question: 'What does this text say?' })).result.isError).toBeUndefined();
    expect(textOf(await call(server, 'submit_runs', { json: '{}' }))).toBe('That step is not the current one. Next: submit_structure.');
    // The real session: Mill, from the start again.
    await call(server, 'start_disassembly', { text: d.sources[0].text, question: d.question, language: 'it' });
    const drafts = draftsFrom(d, (await pastedSource(d)).id);
    await call(server, 'submit_structure', { json: JSON.stringify(drafts.structure) });
    expect(textOf(await call(server, 'submit_part', { index: 1, json: JSON.stringify(drafts.contents[1]) }))).toContain('Submit part 0 next (index 0');
    expect(textOf(await call(server, 'start_disassembly', {}))).toContain('needs "text" as a string');
  });

  it('keeps a finished disassembly when the app cannot be reached, and saves it on the next call', async () => {
    const d = atlas() as Disassembly;
    const data = folder();
    const address = incomingAddress(process.platform, data);
    const server = createBreakTheWallServer({ address, launch: async () => false }, '0.3.0');
    const drafts = draftsFrom(d, (await pastedSource(d)).id);
    await call(server, 'start_disassembly', { text: d.sources[0].text, question: d.question });
    await call(server, 'submit_structure', { json: JSON.stringify(drafts.structure) });
    for (const [index, content] of drafts.contents.entries()) await call(server, 'submit_part', { index, json: JSON.stringify(content) });
    const offline = await call(server, 'submit_runs', { json: JSON.stringify(drafts.runs) });
    expect(offline.result.isError).toBe(true);
    expect(textOf(offline)).toContain('It could not be saved yet');
    expect(textOf(offline)).toContain('call submit_runs again');
    const opened: Disassembly[] = [];
    const store = new DisassemblyStore(join(data, 'disassemblies'));
    const listener = new IncomingServer(address, appWith(store, opened));
    listeners.push(listener);
    await listener.setEnabled(true);
    const retried = await call(server, 'submit_runs', { json: JSON.stringify(drafts.runs) });
    expect(retried.result.isError).toBeUndefined();
    expect((await store.list()).disassemblies.map(x => x.generation?.provider)).toEqual(['assistant']);
    // The same save again is harmless: still one disassembly.
    await call(server, 'submit_runs', { json: '{}' });
    expect((await store.list()).disassemblies).toHaveLength(1);
  });

  it('answers an invalid save with the validation findings, and an app without save support as an unknown type', async () => {
    const opened: Disassembly[] = [];
    const store = new DisassemblyStore(join(folder(), 'disassemblies'));
    const refused = await answer(JSON.stringify({ v: 1, type: 'save', disassembly: { schemaVersion: 1 } }), appWith(store, opened));
    expect(refused).toMatchObject({ ok: false, code: 'invalid' });
    expect((refused as { message: string }).message).toContain('id');
    expect(await answer('{"v":1,"type":"save"}', appWith(store, opened))).toMatchObject({ ok: false, code: 'bad-request' });
    expect(await answer('{"v":1,"type":"save","disassembly":{}}', { version: '1', open: async () => ({ title: '', lines: 0 }) })).toMatchObject({ ok: false, code: 'unknown-type' });
    expect(opened).toEqual([]);
  });

  it('saves only a new disassembly written by an assistant', async () => {
    const store = new DisassemblyStore(join(folder(), 'disassemblies'));
    const written = { ...(atlas() as Disassembly), id: 'g-written', kind: 'generated' as const, generation: { provider: 'assistant' as const, model: 'claude-code 2.1.303', createdAt: '2026-10-28T10:00:00.000Z' } };
    const prepared = atlas() as Disassembly;
    await expect(saveFromAssistant(store, prepared)).rejects.toThrow('Only a new disassembly written by an assistant');
    await expect(saveFromAssistant(store, { ...written, generation: { ...written.generation, provider: 'chatgpt' } })).rejects.toThrow('Only a new disassembly written by an assistant');
    await expect(saveFromAssistant(store, { ...written, expansions: [{ part: written.parts[0].id, provider: 'assistant', model: 'x', createdAt: '2026-10-28T10:00:00.000Z' }] })).rejects.toThrow();
    expect((await saveFromAssistant(store, written)).id).toBe('g-written');
    expect((await saveFromAssistant(store, written)).id).toBe('g-written');
    await expect(saveFromAssistant(store, { ...written, title: 'Another one' })).rejects.toThrow('g-written is already saved');
    expect((await store.list()).disassemblies.map(x => x.title)).toEqual([written.title]);
  });
});

describe('the assistant origin (M5)', () => {
  it('is accepted next to the existing origins, which stay valid', async () => {
    const { validateDisassembly } = await import('../src/core/disassembly');
    const base = { ...(atlas() as Disassembly), id: 'g-origin', kind: 'generated' as const };
    for (const provider of ['chatgpt', 'local', 'assistant'] as const) {
      await expect(validateDisassembly({ ...base, generation: { provider, model: 'm', createdAt: '2026-10-28T10:00:00.000Z' } })).resolves.toMatchObject({ generation: { provider } });
    }
    await expect(validateDisassembly({ ...base, generation: { provider: 'claude', model: 'm', createdAt: '2026-10-28T10:00:00.000Z' } })).rejects.toThrow();
  });
});
