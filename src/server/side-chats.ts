import { spawn } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isAbsolute, join, relative } from 'node:path';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { sessionIdSchema } from '../core/local-server';
import type { Question, Round } from '../core/round';
import { sideChatAskSchema, sideChatTurnSchema, type SideChat, type SideChatTurn, type SideChatsView } from '../core/side-chat';
import { atomicWrite, entries, sessionFolder, type RoundStore } from './rounds';

/**
 * Side chats (#100): a question of a round asked about in a throwaway, read-only fork of the agent's session, started
 * only when the person asks. The fork knows the conversation as of the question; the prompt adds the question and this
 * question's own earlier turns, never another question's side chat or an unsent draft. Nothing it says reaches the
 * agent. Threads are kept beside the session's rounds (`side-chat-<round>-<question>.json`).
 */

/** One run of `claude`: what it is told (stdin) and allowed (arguments), in which folder; each stdout line as it comes. */
export interface SideChatRun { args: string[]; input: string; cwd: string; signal: AbortSignal; onLine: (line: string) => void }
export interface SideChatExit { code: number | null; stderr: string }
/** The seam tests replace: a real `claude` on the server, a script in tests. */
export type SideChatRunner = (run: SideChatRun) => Promise<SideChatExit>;

/** A model name as `--model` takes it; never one that would read as an option. */
export const modelSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,199}$/);

const READ_ONLY_TOOLS = 'Read,Grep,Glob';

export interface SideChatCommand {
  /** The agent's session, forked; `fresh` when forking it failed and a new run answers from the round's text. */
  route: 'fork' | 'fresh';
  session: string;
  model?: string;
  round: { number: number } & Round;
  question: Question;
  /** This question's earlier turns, finished. */
  earlier: readonly Pick<SideChatTurn, 'ask' | 'reply'>[];
  ask: string;
}

/**
 * What one side-chat run is told and allowed. `--tools` leaves the fork Read, Grep and Glob and nothing else, and
 * `--allowedTools` lets them run without a prompt nobody could answer; `--strict-mcp-config` drops MCP servers, whose
 * tools could write. `--no-session-persistence` keeps the fork off disk, so it never shows among the person's sessions.
 */
export function sideChatCommand(x: SideChatCommand): { args: string[]; input: string } {
  const args = [
    '-p', ...(x.route === 'fork' ? ['--resume', x.session, '--fork-session'] : []), '--no-session-persistence',
    '--tools', READ_ONLY_TOOLS, '--allowedTools', READ_ONLY_TOOLS, '--strict-mcp-config',
    '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    ...(x.model ? ['--model', x.model] : []),
  ];
  return { args, input: sideChatPrompt(x) };
}

function sideChatPrompt(x: SideChatCommand): string {
  const intro = x.route === 'fork'
    ? `The person opened a side chat on one question of your round ${x.round.number}. You are a read-only copy of this session: you can read the repository with Read, Grep and Glob, you change nothing, and nothing you write here reaches the main conversation. Answer what the person asks about this question, grounded in the code where it matters; do not answer the round for them.`
    : `The person opened a side chat on one question of a round an agent asked in this repository. You cannot see the agent's conversation: the round, as the agent wrote it, is below. You are read-only: you can read the repository with Read, Grep and Glob and you change nothing. Answer what the person asks about this question, grounded in the code where it matters; do not answer the round for them.`;
  const parts = [intro];
  if (x.route === 'fresh') {
    const others = x.round.questions.map(questionText).join('\n\n---\n\n');
    parts.push(`The round ${x.round.number}:\n\n${x.round.turnText ? `${x.round.turnText}\n\n` : ''}${others}`);
  }
  parts.push(`The question of this side chat:\n\n${questionText(x.question)}`);
  if (x.earlier.length > 0) parts.push(`Earlier in this side chat:\n\n${x.earlier.map(t => `The person asked:\n${t.ask}\n\nYou replied:\n${t.reply}`).join('\n\n')}`);
  parts.push(`The person asks:\n${x.ask}`);
  return parts.join('\n\n');
}

function questionText(q: Question): string {
  const options = q.options.length > 0 ? `\n\nOptions:\n${q.options.map(o => `- (${o.letter}) ${o.label}${o.consequence ? `: ${o.consequence}` : ''}`).join('\n')}` : '';
  const recommendation = q.recommendation ? `\n\nRecommendation: ${q.recommendation}` : '';
  return `Q${q.number} · ${q.title}\n\n${q.body}${options}${recommendation}`;
}

/** Only the fields read here of `--output-format stream-json`'s lines (witnessed on Claude Code 2.1.331). */
const streamLineSchema = z.union([
  z.object({ type: z.literal('stream_event'), event: z.object({ type: z.string(), delta: z.object({ type: z.string(), text: z.string().optional() }).optional() }) }),
  z.object({ type: z.literal('assistant'), message: z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional(), name: z.string().optional(), input: z.record(z.string(), z.unknown()).optional() })) }) }),
  z.object({ type: z.literal('result'), is_error: z.boolean(), result: z.string().optional() }),
]);

/** What one run produced, read line by line: the reply growing, the files it read, how it ended. */
class RunReading {
  reply = '';
  files: string[] = [];
  result: { ok: boolean; text?: string } | undefined;
  private streamed = false;
  /** The folder as given and as the process sees it: on macOS `/var/…` runs as `/private/var/…`. */
  private roots: string[];
  constructor(cwd: string) {
    let real = cwd;
    try { real = realpathSync(cwd); } catch { /* a folder that is gone shows its paths whole */ }
    this.roots = real === cwd ? [cwd] : [cwd, real];
  }

  /** True when the line changed what the page shows. */
  read(line: string): 'reply' | 'files' | null {
    let parsed;
    try { parsed = streamLineSchema.safeParse(JSON.parse(line)); } catch { return null; }
    if (!parsed.success) return null;
    const x = parsed.data;
    if (x.type === 'result') { this.result = { ok: !x.is_error, text: x.result }; return null; }
    if (x.type === 'stream_event') {
      if (x.event.type !== 'content_block_delta' || x.event.delta?.type !== 'text_delta' || !x.event.delta.text) return null;
      this.streamed = true;
      this.reply += x.event.delta.text;
      return 'reply';
    }
    let changed: 'reply' | 'files' | null = null;
    for (const block of x.message.content) {
      // Without partial messages the text arrives whole, once per message.
      if (block.type === 'text' && block.text && !this.streamed) { this.reply += (this.reply ? '\n\n' : '') + block.text; changed = 'reply'; }
      const read = block.type === 'tool_use' ? this.readOf(block.name, block.input ?? {}) : null;
      if (read && !this.files.includes(read)) { this.files.push(read); changed ??= 'files'; }
    }
    return changed;
  }

  private readOf(tool: string | undefined, input: Record<string, unknown>): string | null {
    const text = (key: string) => typeof input[key] === 'string' ? input[key] as string : undefined;
    const count = (key: string) => typeof input[key] === 'number' && Number.isInteger(input[key]) && (input[key] as number) > 0 ? input[key] as number : undefined;
    const where = (path: string | undefined) => path ? ` in ${this.shown(path)}` : '';
    if (tool === 'Read' && text('file_path')) {
      const offset = count('offset'), limit = count('limit');
      const lines = offset || limit ? `:${offset ?? 1}-${limit ? (offset ?? 1) + limit - 1 : ''}` : '';
      return this.shown(text('file_path')!) + lines;
    }
    if (tool === 'Grep' && text('pattern')) return `grep "${text('pattern')}"${where(text('path'))}`;
    if (tool === 'Glob' && text('pattern')) return `glob "${text('pattern')}"${where(text('path'))}`;
    return null;
  }

  /** Inside the project, relative to it; elsewhere, whole. */
  private shown(path: string): string {
    for (const root of this.roots) {
      const inside = relative(root, path);
      if (inside && !inside.startsWith('..') && !isAbsolute(inside)) return inside.split('\\').join('/');
    }
    return path;
  }
}

/**
 * Runs `claude` as a child process in the session's folder, where the fork finds the session and the repository, and
 * hands on each line of its output as it comes. The prompt goes through stdin.
 */
export function spawnSideChat(command = 'claude', leading: string[] = []): SideChatRunner {
  return ({ args, input, cwd, signal, onLine }) => new Promise((resolve, reject) => {
    const child = spawn(command, [...leading, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'], signal });
    let pending = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const x of lines) if (x.trim()) onLine(x);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4_000); });
    child.on('error', reject);
    child.on('close', code => { if (pending.trim()) onLine(pending); resolve({ code, stderr }); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const storedThreadSchema = z.strictObject({
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  round: z.number().int().min(1),
  question: z.number().int().min(1),
  turns: z.array(sideChatTurnSchema),
});
type StoredThread = z.infer<typeof storedThreadSchema>;
const FILE = /^side-chat-(\d+)-(\d+)\.json$/;
const askBodySchema = z.strictObject({ ask: sideChatAskSchema });
const ROUND_CHATS_PATH = /^\/api\/side-chats\/([^/]+)\/(\d{1,6})$/;
const ASK_PATH = /^\/api\/side-chats\/([^/]+)\/(\d{1,6})\/(\d{1,3})$/;

export interface SideChatDeps {
  dataDir: string;
  rounds: RoundStore;
  runner: SideChatRunner;
  /** The model a side chat of this session runs on: the plugin's setting, else the session's; none when unknown. */
  modelOf: (session: string) => string | undefined;
  /** How long a read of the side chats that names the version it has is held. */
  holdMs: number;
  io: {
    readJson: (req: IncomingMessage, maxBytes?: number) => Promise<unknown>;
    send: (res: ServerResponse, status: number, body: unknown) => void;
  };
}

/** The side chats' routes, for the server's guarded `handle`: true when the request was theirs. */
export async function sideChatRoutes(deps: SideChatDeps) {
  const projects = join(deps.dataDir, 'projects');
  const threads = new Map<string, StoredThread>();
  const writes = new Map<string, Promise<void>>();
  const running = new Set<AbortController>();
  /** Grows on every change, from the start time, so a version read before a restart is never ahead of one after it. */
  let clock = Date.now();
  const started = clock;
  const versions = new Map<string, number>();
  const waiting = new Map<string, Set<() => void>>();

  for (const project of await entries(projects)) {
    for (const session of await entries(join(projects, project))) {
      for (const name of await entries(join(projects, project, session))) {
        if (!FILE.test(name)) continue;
        try {
          const x = storedThreadSchema.parse(JSON.parse(await readFile(join(projects, project, session, name), 'utf8')));
          // A reply the last server was still streaming when it stopped will never finish.
          threads.set(threadKey(x.session, x.round, x.question), { ...x, turns: x.turns.map(t => t.status === 'running' ? { ...t, status: 'failed' } : t) });
        } catch { /* A file that does not parse is left on disk untouched. */ }
      }
    }
  }

  const roundKey = (session: string, round: number) => `${session}/${round}`;
  const view = (session: string, round: number): SideChatsView => ({
    version: versions.get(roundKey(session, round)) ?? started,
    sideChats: [...threads.values()].filter(x => x.session === session && x.round === round)
      .sort((a, b) => a.question - b.question)
      .map((x): SideChat => ({ question: x.question, turns: x.turns })),
  });
  const changed = (x: StoredThread) => {
    const key = roundKey(x.session, x.round);
    versions.set(key, ++clock);
    for (const wake of [...waiting.get(key) ?? []]) wake();
  };
  const save = (x: StoredThread) => {
    const key = threadKey(x.session, x.round, x.question);
    const file = join(sessionFolder(projects, x), `side-chat-${x.round}-${x.question}.json`);
    const write = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => atomicWrite(file, JSON.stringify(x, null, 2)));
    writes.set(key, write);
    return write.catch(() => {});
  };
  /** The thread's turn, changed in memory at once and on disk when `persist`; every change reaches a held read. */
  const update = (key: string, number: number, patch: Partial<SideChatTurn>, persist: boolean) => {
    const thread = threads.get(key);
    if (!thread) return;
    const next = { ...thread, turns: thread.turns.map(t => t.number === number ? { ...t, ...patch } : t) };
    threads.set(key, next);
    changed(next);
    if (persist) void save(next);
  };

  async function answer(key: string, number: number, command: Omit<SideChatCommand, 'route'>, cwd: string) {
    const stop = new AbortController();
    running.add(stop);
    try {
      for (const route of ['fork', 'fresh'] as const) {
        update(key, number, { route, reply: '', files: [] }, false);
        const reading = new RunReading(cwd);
        const { args, input } = sideChatCommand({ ...command, route });
        let code: number | null = null;
        try {
          ({ code } = await deps.runner({
            args, input, cwd, signal: stop.signal,
            onLine: line => {
              const what = reading.read(line);
              if (what) update(key, number, { reply: reading.reply, files: [...reading.files] }, what === 'files');
            },
          }));
        } catch { code = null; }
        if (stop.signal.aborted) return;
        if (code === 0 && reading.result?.ok !== false) {
          return update(key, number, { status: 'done', reply: reading.result?.text || reading.reply, files: reading.files }, true);
        }
        // Forking may fail before a word (an unknown or busy session): a fresh run then answers from the round's text.
        // A reply that broke off halfway is shown as it stands.
        if (route === 'fresh' || reading.reply !== '') return update(key, number, { status: 'failed', reply: reading.reply, files: reading.files }, true);
      }
    } finally {
      running.delete(stop);
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    const chats = ROUND_CHATS_PATH.exec(path);
    if (req.method === 'GET' && chats && sessionIdSchema.safeParse(chats[1]).success) {
      const session = chats[1], round = Number(chats[2]);
      if (!deps.rounds.round(session, round)) return deps.io.send(res, 404, { error: 'unknown' }), true;
      const after = new URL(req.url ?? '/', 'http://local').searchParams.get('after');
      if (after !== null && !/^\d{1,16}$/.test(after)) return deps.io.send(res, 400, { error: 'bad-request' }), true;
      hold(req, res, session, round, after === null ? -1 : Number(after));
      return true;
    }
    const ask = ASK_PATH.exec(path);
    if (req.method === 'POST' && ask && sessionIdSchema.safeParse(ask[1]).success) {
      const session = ask[1], round = Number(ask[2]), number = Number(ask[3]);
      const body = askBodySchema.safeParse(await deps.io.readJson(req));
      if (!body.success) return deps.io.send(res, 400, { error: 'bad-request' }), true;
      const found = deps.rounds.round(session, round);
      const question = found?.round.questions.find(q => q.number === number);
      if (!found || !question) return deps.io.send(res, 404, { error: 'unknown' }), true;
      const key = threadKey(session, round, number);
      const thread = threads.get(key) ?? { version: 1 as const, session, cwd: found.cwd, round, question: number, turns: [] };
      // One reply at a time per question: the next question's prompt carries this one's reply.
      if (thread.turns.some(t => t.status === 'running')) return deps.io.send(res, 409, { error: 'busy' }), true;
      const turn: SideChatTurn = { number: thread.turns.length + 1, ask: body.data.ask, reply: '', files: [], status: 'running', route: 'fork', at: new Date().toISOString() };
      const next = { ...thread, turns: [...thread.turns, turn] };
      threads.set(key, next);
      changed(next);
      await save(next);
      const earlier = thread.turns.filter(t => t.status === 'done').map(t => ({ ask: t.ask, reply: t.reply }));
      const model = deps.modelOf(session);
      void answer(key, turn.number, { session, round: { number: round, ...found.round }, question, earlier, ask: turn.ask, ...(model ? { model } : {}) }, found.cwd);
      deps.io.send(res, 202, { turn: turn.number });
      return true;
    }
    return false;
  }

  /** Answers at once when the side chats changed past `after`, else when they next change or the hold runs out. */
  function hold(req: IncomingMessage, res: ServerResponse, session: string, round: number, after: number) {
    const key = roundKey(session, round);
    if (view(session, round).version > after) return deps.io.send(res, 200, view(session, round));
    const wakers = waiting.get(key) ?? new Set<() => void>();
    waiting.set(key, wakers);
    let ended = false;
    const end = () => {
      if (ended) return false;
      ended = true;
      clearTimeout(timer);
      wakers.delete(wake);
      if (wakers.size === 0) waiting.delete(key);
      return true;
    };
    const wake = () => { if (end()) deps.io.send(res, 200, view(session, round)); };
    const timer = setTimeout(wake, deps.holdMs);
    wakers.add(wake);
    req.on('close', end);
    res.on('close', end);
  }

  return {
    handle,
    /** The server stops: every reply still running stops with it. */
    stop() { for (const x of running) x.abort(); },
  };
}

const threadKey = (session: string, round: number, question: number) => `${session}/${round}/${question}`;
