import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { sessionIdSchema } from '../core/local-server';
import type { History, HistoryProject } from '../core/session-history';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { atomicWrite, entries, projectsDir, sessionFolder, type RoundStore } from './rounds';
import { noContent, readJson, send } from './server';

/**
 * Sessions across projects (#102): the history column the page reads, a past round it opens, a session the person
 * deletes, a session the mod reports ended, and an update that waits for the other sessions.
 */
export interface SessionsContext {
  rounds: RoundStore;
  labels: SessionLabels;
  transcripts: SessionTranscripts;
  /** The side chats, whose replies still running stop when their session is deleted (#103). */
  sideChats: { forget(session: string): Promise<void> };
  /** The registrations the mod renews, by session id: a session is live while its lease runs. */
  leases: Map<string, { cwd: string; until: number }>;
  live(session: string): boolean;
  /** A newer version a launcher found this server too old for, while other sessions still used it. */
  update: { version: string | null };
  pageChanged(): void;
}

/**
 * Why Claude Code ended the session, as `session.end` words it (`clear`, `resume`, `prompt_input_exit`, `logout`,
 * `other`). Kept open to the words a later Claude Code adds: whatever the reason, the session is no longer live.
 */
const updateSchema = z.strictObject({ version: z.string().min(1).max(100) });
const endSchema = z.strictObject({ reason: z.string().regex(/^[a-z_]{1,40}$/) });
const END_PATH = /^\/api\/sessions\/([^/]+)\/end$/;
const SESSION_PATH = /^\/api\/sessions\/([^/]+)$/;
const PAST_ROUND_PATH = /^\/api\/rounds\/([^/]+)\/(\d{1,6})$/;

export async function handleSessions(req: IncomingMessage, res: ServerResponse, path: string, context: SessionsContext): Promise<boolean> {
  const { rounds, labels, transcripts, sideChats, leases, update, pageChanged } = context;
  if (req.method === 'GET' && path === '/api/history') {
    send(res, 200, history(context));
    return true;
  }
  if (req.method === 'POST' && path === '/api/update') {
    const body = updateSchema.safeParse(await readJson(req));
    if (!body.success) send(res, 400, { error: 'bad-request' });
    else {
      update.version = body.data.version;
      pageChanged();
      noContent(res);
    }
    return true;
  }
  const endPath = END_PATH.exec(path);
  if (req.method === 'POST' && endPath) {
    const body = endSchema.safeParse(await readJson(req));
    if (!sessionIdSchema.safeParse(endPath[1]).success) send(res, 404, { error: 'not-found' });
    else if (!body.success) send(res, 400, { error: 'bad-request' });
    else {
      // `/clear` and `/resume` go on under another id, which the mod registers next: this one moves to history at
      // once rather than when its lease runs out. A `claude --resume` of it registers it again.
      leases.delete(endPath[1]);
      // What its mod took and had not submitted yet waits for the session's resume, not for its lease.
      rounds.release(endPath[1]);
      pageChanged();
      noContent(res);
    }
    return true;
  }
  const sessionPath = SESSION_PATH.exec(path);
  if (req.method === 'DELETE' && sessionPath) {
    const session = sessionPath[1];
    // A reply still streaming, or a label or transcript still being written, would put a file back into the folder.
    if (sessionIdSchema.safeParse(session).success && (await Promise.all([labels.forget(session), transcripts.forget(session), sideChats.forget(session)]), await rounds.deleteSession(session))) {
      pageChanged();
      noContent(res);
    } else send(res, 404, { error: 'unknown' });
    return true;
  }
  const pastRound = PAST_ROUND_PATH.exec(path);
  if (req.method === 'GET' && pastRound) {
    const view = sessionIdSchema.safeParse(pastRound[1]).success ? rounds.round(pastRound[1], Number(pastRound[2])) : undefined;
    if (view) send(res, 200, view);
    else send(res, 404, { error: 'unknown' });
    return true;
  }
  return false;
}

function history({ rounds, labels, transcripts, live, update }: SessionsContext): History {
  const projects = new Map<string, HistoryProject & { latestAt: string }>();
  const summaries = rounds.summaries().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const x of summaries) {
    const project = projects.get(x.cwd) ?? { cwd: x.cwd, sessions: [], latestAt: x.latestAt };
    if (x.latestAt > project.latestAt) project.latestAt = x.latestAt;
    project.sessions.push({ session: x.session, startedAt: x.startedAt, live: live(x.session), ...labels.of(x.session), transcriptGone: transcripts.gone(x.session), rounds: x.rounds });
    projects.set(x.cwd, project);
  }
  return {
    projects: [...projects.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt)).map(({ cwd, sessions }) => ({ cwd, sessions })),
    update: update.version,
  };
}

const storedLabelSchema = z.strictObject({
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  skill: z.string().min(1).max(200),
  ticket: z.number().int().min(1).nullable(),
});
type StoredLabel = z.infer<typeof storedLabelSchema>;

/**
 * What each session began with (#102): the round skill whose start first marked it, and the issue its arguments
 * name, from the injection marker the plugin sends when a round skill starts. Kept beside the session's rounds as
 * `session.json`, written once, replaced atomically and Zod-checked on read like them.
 */
export class SessionLabels {
  private labels = new Map<string, StoredLabel>();
  private writes = new Map<string, Promise<void>>();

  private constructor(private dir: string) {}

  static async open(dataDir: string): Promise<SessionLabels> {
    const store = new SessionLabels(projectsDir(dataDir));
    for (const project of await entries(store.dir)) {
      for (const session of await entries(join(store.dir, project))) {
        try {
          const x = storedLabelSchema.parse(JSON.parse(await readFile(join(store.dir, project, session, 'session.json'), 'utf8')));
          store.labels.set(x.session, x);
        } catch { /* No label, or one that does not parse: the session stays unnamed. */ }
      }
    }
    return store;
  }

  /** A round skill started in the session; only the first names it. */
  async mark(session: string, cwd: string, skill: string, args = ''): Promise<void> {
    if (this.labels.has(session)) return;
    // Typed or called, bare or under its plugin (`mattpocock-skills:grill-with-docs`): the page names the skill alone.
    const name = skill.trim().replace(/^\//, '').split(':').at(-1) ?? '';
    if (name === '') return;
    const ticket = /#(\d{1,7})\b/.exec(args)?.[1];
    const label: StoredLabel = { version: 1, session, cwd, skill: name, ticket: ticket ? Number(ticket) : null };
    this.labels.set(session, label);
    const write = atomicWrite(join(sessionFolder(this.dir, label), 'session.json'), JSON.stringify(label, null, 2));
    this.writes.set(session, write);
    await write;
  }

  of(session: string): { skill: string | null; ticket: number | null } {
    const label = this.labels.get(session);
    return { skill: label?.skill ?? null, ticket: label?.ticket ?? null };
  }

  /** The session was deleted: its folder goes with its rounds, once the label's own write has landed. */
  async forget(session: string): Promise<void> {
    await this.writes.get(session)?.catch(() => {});
    this.writes.delete(session);
    this.labels.delete(session);
  }
}

const storedTranscriptSchema = z.strictObject({
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  path: z.string().min(1).max(4096).refine(isAbsolute),
});
type StoredTranscript = z.infer<typeof storedTranscriptSchema>;
/** Where Claude Code keeps a session's transcript, as the mod registers it (`$.session.info().transcriptPath`). */
export const transcriptPathSchema = z.string().max(4096).refine(x => x === '' || isAbsolute(x));

/**
 * Where Claude Code keeps each session's transcript (#103), as its mod registered it: once the transcript is gone,
 * nothing can resume or fork the session, so its rounds and side chats turn read-only. Kept as `transcript.json` beside
 * the rounds of a session the page shows, so it outlives a restart; a session that asked nothing gets no folder for it.
 * The server only checks whether the file exists, never reads it.
 */
export class SessionTranscripts {
  private paths = new Map<string, string>();
  private kept = new Map<string, string>();
  private writes = new Map<string, Promise<void>>();

  private constructor(private dir: string, private rounds: RoundStore) {}

  static async open(dataDir: string, rounds: RoundStore): Promise<SessionTranscripts> {
    const store = new SessionTranscripts(projectsDir(dataDir), rounds);
    for (const project of await entries(store.dir)) {
      for (const session of await entries(join(store.dir, project))) {
        try {
          const x = storedTranscriptSchema.parse(JSON.parse(await readFile(join(store.dir, project, session, 'transcript.json'), 'utf8')));
          store.paths.set(x.session, x.path);
          store.kept.set(x.session, x.path);
        } catch { /* None, or one that does not parse: the session stays answerable. */ }
      }
    }
    return store;
  }

  /** The mod registered the session; an empty path says Claude Code keeps no transcript of it here, which tells nothing. */
  async remember(session: string, path: string): Promise<void> {
    if (path === '') return;
    this.paths.set(session, path);
    await this.keep(session);
  }

  /** Kept on disk once the session has a folder: after its first round or free block, or at once when it has one. */
  async keep(session: string): Promise<void> {
    const path = this.paths.get(session);
    const cwd = this.rounds.cwdOf(session);
    if (path === undefined || cwd === undefined || this.kept.get(session) === path) return;
    this.kept.set(session, path);
    const stored: StoredTranscript = { version: 1, session, cwd, path };
    const write = (this.writes.get(session) ?? Promise.resolve()).catch(() => {})
      .then(() => atomicWrite(join(sessionFolder(this.dir, stored), 'transcript.json'), JSON.stringify(stored, null, 2)));
    this.writes.set(session, write);
    await write;
  }

  /** Only a transcript the mod named and that is no longer there: a session never told of stays answerable. */
  gone(session: string): boolean {
    const path = this.paths.get(session);
    return path !== undefined && !existsSync(path);
  }

  async forget(session: string): Promise<void> {
    await this.writes.get(session)?.catch(() => {});
    this.writes.delete(session);
    this.paths.delete(session);
    this.kept.delete(session);
  }
}
