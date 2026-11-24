import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { idSchema } from '../core/lesson';
import { sessionIdSchema } from '../core/local-server';
import { detectLanguage } from '../core/generation';
import { failure, ProviderError, type ProviderFailure } from '../core/provider';
import { importSource, normalizeText, SOURCE_LIMITS } from '../core/source';
import { parseSpecHandover, specIdSchema, type SpecLocation, type SpecRun, type SpecView } from '../core/spec';
import { claudeCompleter, spawnClaude, type ClaudeRunner } from '../desktop/claude/completer';
import type { Completer } from '../desktop/completion';
import { ExplorationStore } from '../desktop/exploration-store';
import { Generator } from '../desktop/generator';

/**
 * Specs handed over with `Spec: <location>` (#104): read as they were at handover, kept as numbered versions of their
 * location, and explored through the `claude` route with the app's exploration generator, acceptance and store. The
 * page names a version by its id only; every path and text comes from the agent's turn.
 */

/** One run of `gh`, in the session's folder, so `#n` names an issue of that session's repository. */
export interface GhRun { args: string[]; cwd: string; signal: AbortSignal }
export interface GhExit { code: number | null; stdout: string; stderr: string }
/** The seam tests replace: the `gh` CLI in the server, a script in tests. */
export type GhRunner = (run: GhRun) => Promise<GhExit>;

/** The processes the server starts, injected so tests run fakes. */
export interface SpecRunners { claude?: ClaudeRunner; gh?: GhRunner }

/** The model `claude -p` writes a spec's structure with: Claude is the only route in this phase (#79). */
export const SPEC_MODEL = 'sonnet';
const GH_TIMEOUT_MS = 30_000;

const storedSpecSchema = z.strictObject({
  version: z.literal(1),
  /** What makes two handovers versions of one spec: the issue's URL, the file's real path, or the session for a paste. */
  key: z.string().min(1).max(4200),
  location: z.string().min(1).max(1024),
  number: z.number().int().min(1),
  handedOverAt: z.iso.datetime(),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  title: z.string().min(1).max(200),
  text: z.string().max(SOURCE_LIMITS.maxFileBytes),
  exploration: z.strictObject({ id: idSchema, revision: idSchema }).nullable(),
});
type StoredSpec = z.infer<typeof storedSpecSchema>;

const ghIssueSchema = z.object({ title: z.string().max(1000), body: z.string(), url: z.string().url().max(1000) });

interface Read { key: string; title: string; text: string }

export interface SpecRoutes {
  /**
   * The spec a turn hands over, read and stored as a new version, its structure started: the version's id, or null
   * when the turn names no spec or the spec could not be read.
   */
  handover(turn: { session: string; cwd: string; text: string }): Promise<string | null>;
  /** The spec and exploration endpoints; true when the request was one of them. */
  handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean>;
  /** Stops every structure still being written. */
  close(): void;
}

const SPEC_PATH = /^\/api\/specs\/([^/]+)$/;
const EXPLORE_PATH = /^\/api\/specs\/([^/]+)\/exploration$/;
const EXPLORATION_PATH = /^\/api\/explorations\/([^/]+)\/([^/]+)$/;

export async function openSpecs(options: {
  dataDir: string;
  runners?: SpecRunners;
  /** Wakes the page's poll: what it shows has changed. */
  changed: () => void;
  send: (res: ServerResponse, status: number, body: unknown) => void;
  now?: () => Date;
}): Promise<SpecRoutes> {
  const { changed, send, now = () => new Date() } = options;
  const claude = options.runners?.claude ?? spawnClaude();
  const gh = options.runners?.gh ?? spawnGh();
  const dir = join(options.dataDir, 'specs');
  const explorations = new ExplorationStore(join(options.dataDir, 'explorations'));
  const specs = new Map<string, StoredSpec>();
  /** Structures being written, or why the last one stopped; in memory, so a restart offers to write it again. */
  const runs = new Map<string, { run: NonNullable<SpecRun>; generator?: Generator }>();
  const writes = new Map<string, Promise<void>>();

  const idOf = (x: Pick<StoredSpec, 'key' | 'number'>) => `spec-${hash(x.key)}-${x.number}`;
  const versionsOf = (key: string) => [...specs.values()].filter(x => x.key === key);
  const latestOf = (key: string) => versionsOf(key).reduce((a, b) => b.number > a.number ? b : a);
  const view = (x: StoredSpec): SpecView => {
    const latest = latestOf(x.key);
    return {
      id: idOf(x), location: x.location, title: x.title, number: x.number, handedOverAt: x.handedOverAt, session: x.session,
      superseded: latest.number > x.number, latest: idOf(latest), exploration: x.exploration, run: runs.get(idOf(x))?.run ?? null,
    };
  };

  async function handover(turn: { session: string; cwd: string; text: string }): Promise<string | null> {
    const found = parseSpecHandover(turn.text);
    if (!found) return null;
    let read: Read | null;
    try { read = await readSpec(found.location, found.above, turn); } catch { read = null; }
    if (!read) return null;
    const number = versionsOf(read.key).reduce((most, x) => Math.max(most, x.number), 0) + 1;
    const stored: StoredSpec = {
      version: 1, key: read.key, location: found.written, number, handedOverAt: now().toISOString(),
      session: turn.session, cwd: turn.cwd, title: read.title, text: read.text, exploration: null,
    };
    await save(stored);
    const id = idOf(stored);
    explore(id);
    return id;
  }

  async function readSpec(location: SpecLocation, above: string, turn: { session: string; cwd: string }): Promise<Read | null> {
    if (location.kind === 'pasted') return above === '' ? null : { key: `pasted:${turn.session}`, title: titleOf(above, 'Spec'), text: normalizeText(above) };
    if (location.kind === 'github') {
      const exit = await gh({ args: ['issue', 'view', location.issue, '--json', 'title,body,url'], cwd: turn.cwd, signal: AbortSignal.timeout(GH_TIMEOUT_MS) });
      if (exit.code !== 0) return null;
      const issue = ghIssueSchema.parse(JSON.parse(exit.stdout));
      const text = normalizeText(issue.body);
      return text === '' ? null : { key: issue.url, title: issue.title.trim().slice(0, 200) || 'Spec', text };
    }
    // Only a file inside the session's folder: the location comes from the agent's turn, never from the page.
    const root = await realpath(turn.cwd);
    const file = await realpath(resolve(root, location.path));
    if (!file.startsWith(root + sep)) return null;
    const info = await stat(file);
    if (!info.isFile() || info.size > SOURCE_LIMITS.maxFileBytes) return null;
    const text = normalizeText(new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file)));
    return text === '' ? null : { key: file, title: titleOf(text, basename(file)), text };
  }

  /** Writes the version's structure in the background; the page follows it through its poll. */
  function explore(id: string): 'started' | 'running' | 'unknown' {
    const spec = specs.get(id);
    if (!spec) return 'unknown';
    if (runs.get(id)?.run.state === 'running') return 'running';
    const generator = new Generator({ chatgpt: refusing, local: () => refusing, claude: claudeCompleter(claude) }, { save: async x => x }, now, undefined, explorations);
    runs.set(id, { run: { state: 'running', repairing: false }, generator });
    changed();
    void (async () => {
      let ended: ProviderFailure | null = null;
      try {
        const source = await importSource({ kind: 'paste', title: spec.title, text: spec.text });
        const language = detectLanguage(spec.text) ?? 'en';
        const result = await generator.explore({ source, language, route: { provider: 'claude', model: SPEC_MODEL } }, progress => {
          const current = runs.get(id);
          if (current?.generator !== generator || current.run.state !== 'running' || current.run.repairing === progress.repairing) return;
          runs.set(id, { run: { state: 'running', repairing: progress.repairing }, generator });
          changed();
        });
        if (result.ok) await save({ ...specs.get(id) ?? spec, exploration: { id: result.exploration.id, revision: result.exploration.revision } });
        else ended = result.failure;
      } catch (error) {
        ended = error instanceof ProviderError ? error.failure : failure('unsupported', { message: (error as Error)?.message ?? 'La specifica non si può esplorare.' });
      }
      if (runs.get(id)?.generator !== generator) return;
      if (ended) runs.set(id, { run: { state: 'failed', failure: { code: ended.code, ...(ended.reason ? { reason: ended.reason } : {}), ...(ended.issues ? { issues: ended.issues.slice(0, 8) } : {}) } } });
      else runs.delete(id);
      changed();
    })();
    return 'started';
  }

  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    if (req.method === 'GET' && path === '/api/specs') {
      send(res, 200, { specs: [...specs.values()].sort((a, b) => b.handedOverAt.localeCompare(a.handedOverAt) || b.number - a.number).map(view) });
      return true;
    }
    if (req.method === 'GET' && path === '/api/explorations') {
      send(res, 200, await explorations.list());
      return true;
    }
    const one = EXPLORATION_PATH.exec(path);
    if (req.method === 'GET' && one) {
      const found = idSchema.safeParse(one[1]).success && idSchema.safeParse(one[2]).success ? await explorations.find(one[1], one[2]) : undefined;
      if (!found) send(res, 404, { error: 'unknown' });
      else send(res, 200, { exploration: found });
      return true;
    }
    const specPath = SPEC_PATH.exec(path);
    if (req.method === 'GET' && specPath) {
      const spec = specIdSchema.safeParse(specPath[1]).success ? specs.get(specPath[1]) : undefined;
      if (!spec) send(res, 404, { error: 'unknown' });
      else send(res, 200, { spec: view(spec), text: spec.text });
      return true;
    }
    const explorePath = EXPLORE_PATH.exec(path);
    if (explorePath && (req.method === 'POST' || req.method === 'DELETE')) {
      const id = specIdSchema.safeParse(explorePath[1]).success ? explorePath[1] : '';
      if (req.method === 'POST') {
        if (specs.get(id)?.exploration) { send(res, 409, { error: 'explored' }); return true; }
        const started = explore(id);
        if (started === 'unknown') send(res, 404, { error: 'unknown' });
        else if (started === 'running') send(res, 409, { error: 'running' });
        else send(res, 202, { spec: view(specs.get(id)!) });
        return true;
      }
      const running = runs.get(id);
      if (running?.run.state !== 'running' || !running.generator) { send(res, 404, { error: 'not-running' }); return true; }
      running.generator.cancel();
      res.writeHead(204, { 'cache-control': 'no-store' }).end();
      return true;
    }
    return false;
  }

  function close() {
    for (const { generator } of runs.values()) generator?.cancel();
  }

  function save(x: StoredSpec): Promise<void> {
    const id = idOf(x);
    specs.set(id, x);
    const file = join(dir, hash(x.key), `v${x.number}.json`);
    const write = (writes.get(id) ?? Promise.resolve()).catch(() => {}).then(() => atomicWrite(file, JSON.stringify(x, null, 2)));
    writes.set(id, write);
    return write;
  }

  async function load() {
    for (const folder of await entries(dir)) {
      for (const name of (await entries(join(dir, folder))).filter(x => /^v\d{1,6}\.json$/.test(x))) {
        try {
          const x = storedSpecSchema.parse(JSON.parse(await readFile(join(dir, folder, name), 'utf8')));
          if (hash(x.key) === folder && `v${x.number}.json` === name) specs.set(idOf(x), x);
        } catch { /* A file that does not parse is left on disk untouched. */ }
      }
    }
  }

  await load();
  return { handover, handle, close };
}

/** The spec's own first heading names it; without one, the file's name or a plain word. */
function titleOf(text: string, fallback: string): string {
  const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(text)?.[1];
  return (heading || fallback).slice(0, 200);
}

const hash = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 16);

/** The generator asks for a ChatGPT and a local route too; a spec is only ever explored through Claude Code. */
const refusing: Completer = { complete: async () => { throw new ProviderError(failure('unsupported', { reason: 'exploration-claude' })); } };

/** Runs the `gh` CLI with the person's own login, in the session's folder. */
export function spawnGh(command = 'gh'): GhRunner {
  return ({ args, cwd, signal }) => new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], signal, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', fail);
    child.on('close', code => done({ code, stdout, stderr }));
  });
}

async function entries(dir: string): Promise<string[]> {
  try { return await readdir(dir); } catch { return []; }
}

async function atomicWrite(file: string, data: string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(6).toString('hex')}.pending`;
  try {
    await writeFile(temp, data, { mode: 0o600 });
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
