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
    /** The mod on `turn.complete`: the turn's final text, with the session it came from. */
    turn: (text: string, session = SESSION, cwd = CWD) => call('/api/turns', { method: 'POST', body: { session, cwd, text } }),
    /** The mod's long-poll for its session: the message to submit, or nothing when the hold runs out. */
    delivery: async (session = SESSION, signal?: AbortSignal): Promise<string | undefined> => (await (await call(`/api/sessions/${session}/delivery`, { signal })).json()).message,
    /** The same poll, with the round the message answers, which the mod confirms once it has submitted it. */
    take: async (session = SESSION): Promise<{ round?: number; message?: string }> => (await call(`/api/sessions/${session}/delivery`)).json(),
    /** The mod once `$.prompt.submit` has taken the message. */
    confirm: (round: number, session = SESSION) => call(`/api/sessions/${session}/delivery/${round}`, { method: 'POST' }),
    /** What the page shows. */
    round: async () => (await (await call('/api/round')).json()).round,
    /** The page on every change to an answer. */
    saveDraft: (number: number, draft: unknown, session = SESSION) => call(`/api/rounds/${session}/${number}/draft`, { method: 'PUT', body: draft }),
    /** The page's one Send. */
    send: (number: number, draft: unknown, language = 'en', session = SESSION) => call(`/api/rounds/${session}/${number}/send`, { method: 'POST', body: { draft, language } }),
  };
}
