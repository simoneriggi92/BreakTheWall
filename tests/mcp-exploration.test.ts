// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Exploration } from '../src/core/exploration';
import { explorationInstructions, explorationJsonSchema } from '../src/core/exploration-generation';
import { exploreFromAssistant } from '../src/desktop/assistants';
import { ExplorationStore } from '../src/desktop/exploration-store';
import { IncomingServer, incomingAddress, type IncomingHandlers } from '../src/desktop/incoming';
import { REPLY_CHARS } from '../src/mcp/assistant';
import { createBreakTheWallServer } from '../src/mcp/server';
import { BAKERY, bakery, toAnswer } from './explorations';

type Reply = { result: { content: { text: string }[]; isError?: boolean } };
const call = (server: ReturnType<typeof createBreakTheWallServer>, name: string, args: object, id = 2) =>
  server.handle(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })) as Promise<Reply>;
const textOf = (reply: Reply) => reply.result.content[0].text;
const initialize = (server: ReturnType<typeof createBreakTheWallServer>) =>
  server.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.303' } } }));
const answer = async () => JSON.stringify(toAnswer(await bakery()));
async function broken() { const a = toAnswer(await bakery()); a.parts[1].members[0].cites = [[40, 41]]; return JSON.stringify(a); }

describe('Claude writes an exploration the app checks (X9)', () => {
  const folders: string[] = []; const listeners: IncomingServer[] = [];
  afterEach(async () => {
    for (const l of listeners.splice(0)) await l.setEnabled(false);
    for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true });
  });
  /** The app's side, as main.ts wires it: `exploreFromAssistant`, then the window opens what was saved. */
  async function running(enabled = true) {
    const folder = mkdtempSync(join(tmpdir(), 'btw-x-')); folders.push(folder);
    const store = new ExplorationStore(join(folder, 'explorations')), opened: Exploration[] = [];
    const handlers: IncomingHandlers = {
      version: 'test', open: async () => ({ title: 'x', lines: 1 }),
      explore: async input => { const saved = await exploreFromAssistant(store, input); opened.push(saved); return { id: saved.id, title: saved.title }; },
    };
    const address = incomingAddress(process.platform, folder), listener = new IncomingServer(address, handlers);
    listeners.push(listener);
    if (enabled) await listener.setEnabled(true);
    const server = createBreakTheWallServer({ address, launch: async () => false }, '0.3.0');
    await initialize(server);
    return { server, store, opened };
  }

  it('start returns the instructions, the schema and the numbered source of the structure request', async () => {
    const { server } = await running();
    const reply = await call(server, 'start_exploration', { text: BAKERY, title: 'The night bakery', language: 'en' });
    expect(reply.result.isError).toBeUndefined();
    const text = textOf(reply);
    expect(text).toMatch(/^Break the Wall exploration started: "The night bakery", 19 lines, written in English\./);
    expect(text).toContain(`INSTRUCTIONS\n${explorationInstructions('en')}\n\nJSON SCHEMA (the JSON must match it exactly)\n${JSON.stringify(explorationJsonSchema())}`);
    expect(text).toContain('Read this source and return its structure.\n\nPAGE 1 of 1');
    expect(text).toContain(' 7| Flour and water are mixed into a dough.');
  });

  it('saves a valid submission with the assistant as its origin, and opens it', async () => {
    const { server, store, opened } = await running();
    await call(server, 'start_exploration', { text: BAKERY, title: 'The night bakery', language: 'en' });
    const reply = await call(server, 'submit_exploration', { json: await answer() });
    expect(reply.result.isError).toBeUndefined();
    expect(textOf(reply)).toMatch(/^Exploration accepted: "The night bakery" is saved/);
    const { explorations } = await store.list();
    expect(explorations).toHaveLength(1);
    expect(explorations[0].generation).toMatchObject({ provider: 'assistant', model: 'claude-code 2.1.303' });
    expect(opened.map(x => x.id)).toEqual([explorations[0].id]);
    expect(textOf(await call(server, 'submit_exploration', { json: await answer() }))).toMatch(/finished/);
  });

  it('returns the findings with their paths for one repair, then saves the repaired answer', async () => {
    const { server, store } = await running();
    await call(server, 'start_exploration', { text: BAKERY, title: 'The night bakery', language: 'en' });
    const first = await call(server, 'submit_exploration', { json: await broken() });
    expect(first.result.isError).toBe(true);
    expect(textOf(first)).toContain('Not accepted (attempt 1 of 2)');
    expect(textOf(first)).toContain('- parts[1].members[0].cites[0]: Line 41 is past the end of the source');
    expect((await store.list()).explorations).toEqual([]);
    expect(textOf(await call(server, 'submit_exploration', { json: await answer() }))).toMatch(/^Exploration accepted/);
    expect((await store.list()).explorations).toHaveLength(1);
  });

  it('saves nothing after a second invalid submission and ends the session', async () => {
    const { server, store, opened } = await running();
    await call(server, 'start_exploration', { text: BAKERY, title: 'The night bakery', language: 'en' });
    await call(server, 'submit_exploration', { json: await broken() });
    const second = await call(server, 'submit_exploration', { json: await broken() });
    expect(textOf(second)).toMatch(/^Break the Wall did not accept the exploration after one repair, and nothing was saved/);
    expect(textOf(await call(server, 'submit_exploration', { json: await answer() }))).toMatch(/finished/);
    expect((await store.list()).explorations).toEqual([]);
    expect(opened).toEqual([]);
  });

  it('sends a long source in pages within the reply limit, and waits for every page before checking', async () => {
    const { server } = await running();
    const text = Array.from({ length: 480 }, (_, i) => `Line ${i + 1}: ${'the oven warms the cold dough before dawn '.repeat(2)}`).join('\n');
    const start = textOf(await call(server, 'start_exploration', { text, title: 'Long', language: 'en' }));
    expect(start.length).toBeLessThanOrEqual(REPLY_CHARS);
    expect(start).toMatch(/The numbered source is in 2 pages/);
    const early = await call(server, 'submit_exploration', { json: '{}' });
    expect(textOf(early)).toMatch(/^Read page 2 of the numbered source first.*This does not count as an attempt\./);
    const page = textOf(await call(server, 'read_source', { page: 2 }));
    expect(page).toMatch(/^PAGE 2 of 2/);
    expect(page.length).toBeLessThanOrEqual(REPLY_CHARS);
    expect(page).toContain('Every page is read');
  });

  it('refuses a text over the exploration limit before anything is written', async () => {
    const { server } = await running();
    const text = Array.from({ length: 600 }, () => 'a'.repeat(99)).join('\n');
    const reply = await call(server, 'start_exploration', { text });
    expect(reply.result.isError).toBe(true);
    expect(textOf(reply)).toContain('an exploration reads at most 52,000 in one request');
  });

  it('reaches nothing while the local entry point is off, and keeps the attempt', async () => {
    const { server, store } = await running(false);
    await call(server, 'start_exploration', { text: BAKERY, title: 'The night bakery', language: 'en' });
    const reply = await call(server, 'submit_exploration', { json: await answer() });
    expect(reply.result.isError).toBe(true);
    expect(textOf(reply)).toMatch(/could not be checked yet: .*This does not count as an attempt\./);
    expect((await store.list()).explorations).toEqual([]);
  });
});
