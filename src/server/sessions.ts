import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { sessionIdSchema } from '../core/local-server';
import type { History, HistoryProject } from '../core/session-history';
import type { RoundStore } from './rounds';
import { noContent, readJson, send } from './server';

/**
 * Sessions across projects (#102): the history column the page reads, a past round it opens, a session the person
 * deletes, a session the mod reports ended, and an update that waits for the other sessions.
 */
export interface SessionsContext {
  rounds: RoundStore;
  /** The registrations the mod renews, by session id: a session is live while its lease runs. */
  leases: Map<string, { cwd: string; until: number }>;
  pageChanged(): void;
}

/**
 * Why Claude Code ended the session, as `session.end` words it (`clear`, `resume`, `prompt_input_exit`, `logout`,
 * `other`). Kept open to the words a later Claude Code adds: whatever the reason, the session is no longer live.
 */
const endSchema = z.strictObject({ reason: z.string().regex(/^[a-z_]{1,40}$/) });
const END_PATH = /^\/api\/sessions\/([^/]+)\/end$/;
const SESSION_PATH = /^\/api\/sessions\/([^/]+)$/;
const PAST_ROUND_PATH = /^\/api\/rounds\/([^/]+)\/(\d{1,6})$/;

export async function handleSessions(req: IncomingMessage, res: ServerResponse, path: string, context: SessionsContext): Promise<boolean> {
  const { rounds, leases, pageChanged } = context;
  if (req.method === 'GET' && path === '/api/history') {
    send(res, 200, history(context));
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
      pageChanged();
      noContent(res);
    }
    return true;
  }
  const sessionPath = SESSION_PATH.exec(path);
  if (req.method === 'DELETE' && sessionPath) {
    if (sessionIdSchema.safeParse(sessionPath[1]).success && await rounds.deleteSession(sessionPath[1])) {
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

function history({ rounds, leases }: SessionsContext): History {
  const now = Date.now();
  const projects = new Map<string, HistoryProject & { latestAt: string }>();
  const summaries = rounds.summaries().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const x of summaries) {
    const project = projects.get(x.cwd) ?? { cwd: x.cwd, sessions: [], latestAt: x.latestAt };
    if (x.latestAt > project.latestAt) project.latestAt = x.latestAt;
    const live = (leases.get(x.session)?.until ?? 0) > now;
    project.sessions.push({ session: x.session, startedAt: x.startedAt, live, skill: null, ticket: null, rounds: x.rounds });
    projects.set(x.cwd, project);
  }
  return {
    projects: [...projects.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt)).map(({ cwd, sessions }) => ({ cwd, sessions })),
    update: null,
  };
}
