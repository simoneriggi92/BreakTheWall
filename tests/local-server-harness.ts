import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { startLocalServer, type LocalServer, type LocalServerOptions } from '../src/server/server';

/**
 * The local server in process, on temporary folders, for tests that drive it over HTTP (seam ① of #92). Call
 * `useLocalServers()` once at the top of a test file: every server it starts is stopped and every folder removed
 * after each test.
 */
export function useLocalServers() {
  const folders: string[] = [];
  const servers: LocalServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(x => x.stop()));
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  function folder() {
    const path = mkdtempSync(join(tmpdir(), 'btw-server-'));
    folders.push(path);
    return path;
  }
  /** A page build with one file, so static serving has something to serve. */
  function pageFolder() {
    const path = folder();
    writeFileSync(join(path, 'index.html'), '<!doctype html><title>page</title>');
    mkdirSync(join(path, 'assets'));
    writeFileSync(join(path, 'assets', 'app.js'), 'console.log(1)');
    return path;
  }
  const options = (overrides: Partial<LocalServerOptions> = {}): LocalServerOptions => ({ dataDir: folder(), staticDir: pageFolder(), version: '0.6.0-test', ...overrides });
  /** Servers started some other way (a race of several) are stopped after the test too. */
  const track = (...started: LocalServer[]) => { servers.push(...started); };
  async function start(overrides: Partial<LocalServerOptions> = {}) {
    const server = await startLocalServer(options(overrides));
    if (!server) throw new Error('the server did not start');
    track(server);
    return server;
  }
  return { folder, pageFolder, options, track, start };
}

export const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
export const CWD = '/work/project';

/** The server as the mod and the page reach it: same origin, the per-launch secret in its header. */
export function serverClient(server: LocalServer) {
  const call = (path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) => fetch(`http://127.0.0.1:${server.port}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'x-btw-secret': server.secret, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  return {
    call,
    /** The mod on `turn.complete`: every turn's final text as the engine reports it, with the session it came from. */
    turn: (text: string, session = SESSION, cwd = CWD, more: { reason?: string; agent?: string } = {}) => call('/api/turns', { method: 'POST', body: { session, cwd, text, reason: 'answer', ...more } }),
    /** The mod's long-poll for its session: the message to submit, or nothing when the hold runs out. */
    delivery: async (session = SESSION, signal?: AbortSignal): Promise<string | undefined> => (await (await call(`/api/sessions/${session}/delivery`, { signal })).json()).message,
    /** The same poll, with what the message answers (`round-2`, `free-1`), which the mod confirms once it has submitted it. */
    take: async (session = SESSION): Promise<{ id?: string; message?: string }> => (await call(`/api/sessions/${session}/delivery`)).json(),
    /** The mod once `$.prompt.submit` has taken the message. */
    confirm: (id: string, session = SESSION) => call(`/api/sessions/${session}/delivery/${id}`, { method: 'POST' }),
    /** What the page shows: the latest round or free block, and whether its session is in the round phase. */
    current: async () => (await (await call('/api/current')).json()).current,
    /** The round the page shows, or null when it shows a free block or nothing. */
    round: async () => { const { current } = await (await call('/api/current')).json(); return current?.kind === 'round' ? current.round : null; },
    /** The free block the page shows, or null when it shows a round or nothing. */
    free: async () => { const { current } = await (await call('/api/current')).json(); return current?.kind === 'free' ? current.block : null; },
    /** The plugin's injection hook, through the launcher: the session was asked for rounds (#99). */
    startPhase: (session = SESSION, cwd = CWD) => call(`/api/sessions/${session}/phase`, { method: 'POST', body: { cwd } }),
    /** The page's "end the round phase". */
    endPhase: (session = SESSION) => call(`/api/sessions/${session}/phase`, { method: 'DELETE' }),
    /** The page on every change to a free block's reply. */
    saveReply: (number: number, reply: string, session = SESSION) => call(`/api/free/${session}/${number}/reply`, { method: 'PUT', body: { reply } }),
    /** The page's Send under a free block. */
    reply: (number: number, reply: string, session = SESSION) => call(`/api/free/${session}/${number}/send`, { method: 'POST', body: { reply } }),
    /** The page on every change to an answer. */
    saveDraft: (number: number, draft: unknown, session = SESSION) => call(`/api/rounds/${session}/${number}/draft`, { method: 'PUT', body: draft }),
    /** The page's one Send. */
    send: (number: number, draft: unknown, language = 'en', session = SESSION) => call(`/api/rounds/${session}/${number}/send`, { method: 'POST', body: { draft, language } }),
  };
}
