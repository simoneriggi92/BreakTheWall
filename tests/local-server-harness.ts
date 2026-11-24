import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { specListSchema } from '../src/core/spec';
import { startLocalServer, type LocalServer, type LocalServerOptions } from '../src/server/server';
import type { SideChatsView } from '../src/core/side-chat';
import type { SideChatRunner } from '../src/server/side-chats';

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
  // No test reaches a real CLI: each process the server starts answers as a failure unless the test passes its own.
  const options = (overrides: Partial<LocalServerOptions> = {}): LocalServerOptions => ({
    dataDir: folder(), staticDir: pageFolder(), version: '0.6.0-test', ...overrides,
    runners: { claude: refusingRunner, gh: refusingRunner, sideChat: refusingSideChat, ...overrides.runners },
  });
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

const refusingRunner = async () => ({ code: 1, stdout: '', stderr: 'no process runs in tests' });
/** A side chat no test asked for: as if `claude` were not installed. */
const refusingSideChat: SideChatRunner = async () => { throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }); };

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
    /** The plugin's injection hook, through the launcher: the session was asked for rounds (#99), by a skill started with its arguments (#102). */
    startPhase: (session = SESSION, cwd = CWD, marker: { skill?: string; args?: string } = {}) => call(`/api/sessions/${session}/phase`, { method: 'POST', body: { cwd, ...marker } }),
    /** The page's "end the round phase". */
    endPhase: (session = SESSION) => call(`/api/sessions/${session}/phase`, { method: 'DELETE' }),
    /** The page on every change to a free block's response. */
    saveResponse: (number: number, response: string, session = SESSION) => call(`/api/free/${session}/${number}/response`, { method: 'PUT', body: { response } }),
    /** The page's Send under a free block. */
    respond: (number: number, response: string, session = SESSION) => call(`/api/free/${session}/${number}/send`, { method: 'POST', body: { response } }),
    /** The page on every change to an answer. */
    saveDraft: (number: number, draft: unknown, session = SESSION) => call(`/api/rounds/${session}/${number}/draft`, { method: 'PUT', body: draft }),
    /** The page's one Send. */
    send: (number: number, draft: unknown, language = 'en', session = SESSION) => call(`/api/rounds/${session}/${number}/send`, { method: 'POST', body: { draft, language } }),
    /**
     * The mod on `session.start`, on every renewal, and with the new id once `/clear` or `/resume` changed it (#102); with
     * the session's model and the plugin's side-chat model (#100), and where Claude Code keeps its transcript (#103).
     */
    register: (session = SESSION, cwd = CWD, more: { model?: string; sideChatModel?: string; transcript?: string } = {}) => call('/api/sessions', { method: 'POST', body: { id: session, cwd, ...more } }),
    /** The mod on `session.end`: the ending session's id and why it ends. */
    end: (session = SESSION, reason = 'clear') => call(`/api/sessions/${session}/end`, { method: 'POST', body: { reason } }),
    /** The page's history column: project → session → numbered rounds, and an update waiting for the other sessions. */
    history: async () => (await call('/api/history')).json(),
    /** The page opening a round from the history column. */
    pastRound: (number: number, session = SESSION) => call(`/api/rounds/${session}/${number}`),
    /** The page's "delete session". */
    deleteSession: (session = SESSION) => call(`/api/sessions/${session}`, { method: 'DELETE' }),
    /** A newer mod's launcher that found this server with other sessions still registered. */
    updateWaits: (version: string) => call('/api/update', { method: 'POST', body: { version } }),
    /** The page's specs (#104): every version handed over, newest first. */
    specs: async () => specListSchema.parse(await (await call('/api/specs')).json()).specs,
    /** One version, with its text as handed over. */
    spec: (id: string) => call(`/api/specs/${id}`),
    specText: async (id: string): Promise<string> => (await (await call(`/api/specs/${id}`)).json()).text,
    /** The page's "write the structure" for a version, and its cancel. */
    explore: (id: string) => call(`/api/specs/${id}/exploration`, { method: 'POST' }),
    cancelExplore: (id: string) => call(`/api/specs/${id}/exploration`, { method: 'DELETE' }),
    /** The saved explorations, and one of them by id and revision. */
    explorations: async () => (await (await call('/api/explorations')).json()).explorations as unknown[],
    exploration: (id: string, revision: string) => call(`/api/explorations/${id}/${revision}`),
    /** The page's question in a side chat (#100): answered at once, the reply streams into the round's side chats. */
    ask: (round: number, question: number, ask: string, session = SESSION) => call(`/api/side-chats/${session}/${round}/${question}`, { method: 'POST', body: { ask } }),
    /** A round's side chats; with `after`, held until they change past that version. */
    sideChats: async (round: number, after?: number, session = SESSION): Promise<SideChatsView> =>
      (await call(`/api/side-chats/${session}/${round}${after === undefined ? '' : `?after=${after}`}`)).json(),
  };
}
