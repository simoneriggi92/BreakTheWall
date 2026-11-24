import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { z } from 'zod';
import { SECRET_HEADER, sessionIdSchema, type ServerStatus } from '../core/local-server';
import { parseRound } from '../core/round';
import { draftSchema, fitsQuestions, messageLanguageSchema, returnMessage } from '../core/round-answers';
import { freeBlockMessage, responseSchema } from '../core/round-phase';
import { answers, createLock, ownsLock, readLock, releaseLock, removeLock, type ServerLock } from './lock';
import { RoundStore, type Kind, type RoundRefusal } from './rounds';
import { modelSchema, sideChatRoutes, spawnSideChat, type SideChatRunner } from './side-chats';

/**
 * The local server behind the page `/break-the-wall` opens (#94): one per person, bound to 127.0.0.1, serving the
 * built page to anyone on this machine and its API only to a page that holds the per-launch secret.
 */
export interface LocalServerOptions {
  /** The per-user folder for the lock file and, later, the rounds; outside the repository and the plugin folder. */
  dataDir: string;
  /** The built page. */
  staticDir: string;
  version: string;
  /** With no session registered and no page connected for this long, the server stops. 10 minutes by default. */
  idleMs?: number;
  /** How often the idle rule is checked. */
  checkEveryMs?: number;
  /** A session's registration lasts this long unless renewed; the mod renews it while the session lives. */
  sessionTtlMs?: number;
  /** How long a page poll is held open before it answers empty and the page polls again. */
  pollHoldMs?: number;
  /** A page still counts as connected for this long after a poll ends, the gap before its next poll. */
  pageGraceMs?: number;
  /** How long the mod's delivery poll is held: below `$.http.fetch`'s 30 seconds per call. */
  deliveryHoldMs?: number;
  /**
   * How long a message handed to the mod waits for its confirmation before it is offered again. Long, because
   * `$.prompt.submit` first waits for the session to be idle: a shorter lease would deliver twice.
   */
  deliveryLeaseMs?: number;
  /** The processes the server starts, replaced in tests: `sideChat` streams a side chat's reply (#100). */
  runners?: { sideChat?: SideChatRunner };
}
export interface LocalServer {
  port: number;
  secret: string;
  /** Settles once the server has stopped, by itself or through `stop`. */
  stopped: Promise<void>;
  stop(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

const cwdSchema = z.string().min(1).max(4096);
/**
 * A session as the mod registers it: its id, its folder, the model it runs on, and the side-chat model set in the
 * plugin, if any (#100).
 */
const registrationSchema = z.strictObject({ id: sessionIdSchema, cwd: cwdSchema, model: modelSchema.optional(), sideChatModel: modelSchema.optional() });
/**
 * Every turn as the mod posts it on `turn.complete`, with how it ended and, for a subagent's run, its agent: the server
 * decides whether it holds a round, so the mod decides nothing.
 */
const turnSchema = z.strictObject({
  session: sessionIdSchema,
  cwd: cwdSchema,
  text: z.string().max(1_000_000),
  reason: z.enum(['answer', 'aborted', 'refusal', 'error']),
  agent: z.string().min(1).max(200).optional(),
});
const MAX_BODY_BYTES = 64 * 1024;
/** A turn's text, with room for the JSON escaping of a long round. */
const MAX_TURN_BYTES = 4 * 1024 * 1024;
const MAX_ANSWER_BYTES = 1024 * 1024;
const sendSchema = z.strictObject({ draft: draftSchema, language: messageLanguageSchema });
const responseBodySchema = z.strictObject({ response: responseSchema });
const phaseSchema = z.strictObject({ cwd: cwdSchema });
const ROUND_PATH = /^\/api\/rounds\/([^/]+)\/(\d{1,6})\/(draft|send)$/;
const FREE_PATH = /^\/api\/free\/([^/]+)\/(\d{1,6})\/(response|send)$/;
const PHASE_PATH = /^\/api\/sessions\/([^/]+)\/phase$/;
const DELIVERY_PATH = /^\/api\/sessions\/([^/]+)\/delivery$/;
const CONFIRM_PATH = /^\/api\/sessions\/([^/]+)\/delivery\/(round|free)-(\d{1,6})$/;
const REFUSED: Record<RoundRefusal, number> = { unknown: 404, sent: 409, superseded: 409 };

export async function startLocalServer(options: LocalServerOptions): Promise<LocalServer | null> {
  const { idleMs = 10 * 60_000, checkEveryMs = 15_000, sessionTtlMs = 2 * 60_000, pollHoldMs = 25_000, pageGraceMs = 10_000, deliveryHoldMs = 20_000, deliveryLeaseMs = 10 * 60_000 } = options;
  const secret = randomBytes(32).toString('base64url');
  const server = createServer();
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => { server.off('error', fail); done(); }); });
  const port = (server.address() as { port: number }).port;
  const local = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const staticRoot = await realpath(options.staticDir);
  const own: ServerLock = { port, pid: process.pid, version: options.version, secret };
  if (!await takeLock(options.dataDir, own)) { await close(server); return null; }
  const rounds = await RoundStore.open(options.dataDir);
  /** The models each session registered with, kept past its lease, so a side chat on an ended session still runs on its model. */
  const models = new Map<string, { model?: string; sideChatModel?: string }>();
  const sideChats = await sideChatRoutes({
    dataDir: options.dataDir, rounds, runner: options.runners?.sideChat ?? spawnSideChat(), holdMs: pollHoldMs,
    modelOf: session => { const x = models.get(session); return x?.sideChatModel ?? x?.model; },
    io: { readJson, send },
  });

  // Presence: who keeps the server alive. A session holds a lease it renews; a page holds a poll open.
  const sessions = new Map<string, { cwd: string; until: number }>();
  /** Open page polls, answered early when what the page shows has changed. */
  const pagePolls = new Set<() => void>();
  /** Mod polls waiting for a message, by session, so a Send wakes only the session it answers. */
  const deliveryPolls = new Map<string, Set<() => void>>();
  const pageChanged = () => { for (const wake of [...pagePolls]) wake(); };
  let openPolls = 0;
  let lastPollEnd = -Infinity;
  let lastBusy = Date.now();
  const pageConnected = () => openPolls > 0 || Date.now() - lastPollEnd < pageGraceMs;
  const busy = () => {
    const now = Date.now();
    for (const [id, lease] of sessions) if (lease.until <= now) sessions.delete(id);
    return sessions.size > 0 || pageConnected();
  };
  let finish!: () => void;
  const stopped = new Promise<void>(done => { finish = done; });
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    clearInterval(idle);
    sideChats.stop();
    releaseLock(options.dataDir, own);
    await close(server);
    finish();
  })();
  const idle = setInterval(() => {
    // Two servers that raced for the lock both believe they won only until one of them looks: the lock decides.
    if (!ownsLock(options.dataDir, own)) return void stop();
    if (busy()) lastBusy = Date.now();
    else if (Date.now() - lastBusy >= idleMs) void stop();
  }, checkEveryMs);

  server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch(() => { if (!res.headersSent) send(res, 500, { error: 'internal' }); else res.destroy(); });
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    // A rebinding DNS name points another site at 127.0.0.1; its requests still carry its own Host.
    if (!local.has(req.headers.host ?? '')) return send(res, 403, { error: 'host' });
    const path = new URL(req.url ?? '/', 'http://local').pathname;
    if (!path.startsWith('/api/')) return serveStatic(path, res);
    // No CORS headers, ever: a foreign page cannot read an answer or send the secret header without a preflight.
    const origin = req.headers.origin;
    if (origin !== undefined && !local.has(origin.replace(/^http:\/\//, ''))) return send(res, 403, { error: 'origin' });
    if (!hasSecret(req.headers[SECRET_HEADER])) return send(res, 401, { error: 'secret' });
    if (req.method === 'GET' && path === '/api/status') {
      // A launcher that just found this server is about to use it: the idle clock starts over.
      lastBusy = Date.now();
      const status: ServerStatus = { app: 'break-the-wall', version: options.version, platform: process.platform, pageConnected: pageConnected() };
      return send(res, 200, status);
    }
    if (req.method === 'POST' && path === '/api/sessions') {
      const registration = registrationSchema.safeParse(await readJson(req));
      if (!registration.success) return send(res, 400, { error: 'bad-request' });
      const { id, cwd, model, sideChatModel } = registration.data;
      sessions.set(id, { cwd, until: Date.now() + sessionTtlMs });
      models.set(id, { model, sideChatModel });
      lastBusy = Date.now();
      return noContent(res);
    }
    if (req.method === 'POST' && path === '/api/turns') {
      const turn = turnSchema.safeParse(await readJson(req, MAX_TURN_BYTES));
      if (!turn.success) return send(res, 400, { error: 'bad-request' });
      const { session, cwd, text } = turn.data;
      // A subagent's report is not the session asking the person, and an interrupted turn holds at most half a round:
      // neither is a turn of the round phase.
      if (turn.data.agent !== undefined || turn.data.reason !== 'answer') return send(res, 200, { round: null });
      const round = parseRound(text);
      if (round) {
        const stored = await rounds.add(session, cwd, round);
        pageChanged();
        return send(res, 200, { round: stored.number });
      }
      // A turn with nothing to read asks the person nothing.
      const free = text.trim() === '' ? null : await rounds.addTurn(session, cwd, text);
      if (!free) return send(res, 200, { round: null });
      pageChanged();
      return send(res, 200, { round: null, free: free.number });
    }
    if (req.method === 'GET' && path === '/api/current') return send(res, 200, { current: rounds.current() });
    const phasePath = PHASE_PATH.exec(path);
    if (phasePath && sessionIdSchema.safeParse(phasePath[1]).success) {
      if (req.method === 'POST') {
        const body = phaseSchema.safeParse(await readJson(req));
        if (!body.success) return send(res, 400, { error: 'bad-request' });
        await rounds.startPhase(phasePath[1], body.data.cwd);
        pageChanged();
        return noContent(res);
      }
      if (req.method === 'DELETE') {
        if (!await rounds.endPhase(phasePath[1])) return send(res, 404, { error: 'unknown' });
        pageChanged();
        return noContent(res);
      }
    }
    const freePath = FREE_PATH.exec(path);
    if (freePath && sessionIdSchema.safeParse(freePath[1]).success) {
      const [, session, number, action] = freePath;
      const body = responseBodySchema.safeParse(await readJson(req, MAX_ANSWER_BYTES));
      if (req.method === 'PUT' && action === 'response') {
        if (!body.success) return send(res, 400, { error: 'bad-request' });
        const refused = await rounds.saveResponse(session, Number(number), body.data.response);
        if (refused) return send(res, REFUSED[refused], { error: refused });
        return noContent(res);
      }
      if (req.method === 'POST' && action === 'send') {
        if (!body.success) return send(res, 400, { error: 'bad-request' });
        const message = freeBlockMessage(body.data.response);
        // An empty response would hand the agent an empty prompt.
        if (message === '') return send(res, 400, { error: 'bad-request' });
        const refused = await rounds.sendResponse(session, Number(number), body.data.response, message);
        if (refused) return send(res, REFUSED[refused], { error: refused });
        queued(session);
        return send(res, 200, { message });
      }
    }
    const roundPath = ROUND_PATH.exec(path);
    if (roundPath && sessionIdSchema.safeParse(roundPath[1]).success) {
      const [, session, number, action] = roundPath;
      if (req.method === 'PUT' && action === 'draft') {
        const draft = draftSchema.safeParse(await readJson(req, MAX_ANSWER_BYTES));
        if (!draft.success) return send(res, 400, { error: 'bad-request' });
        const questions = rounds.questions(session, Number(number));
        if (questions && !fitsQuestions(questions, draft.data)) return send(res, 400, { error: 'bad-request' });
        const refused = await rounds.saveDraft(session, Number(number), draft.data);
        if (refused) return send(res, REFUSED[refused], { error: refused });
        return noContent(res);
      }
      if (req.method === 'POST' && action === 'send') {
        const body = sendSchema.safeParse(await readJson(req, MAX_ANSWER_BYTES));
        if (!body.success) return send(res, 400, { error: 'bad-request' });
        const questions = rounds.questions(session, Number(number));
        if (!questions) return send(res, 404, { error: 'unknown' });
        if (!fitsQuestions(questions, body.data.draft)) return send(res, 400, { error: 'bad-request' });
        // The server words the message with the same function the page previews it with: what the person saw is
        // what the agent receives.
        const message = returnMessage(questions, body.data.draft, body.data.language);
        const refused = await rounds.send(session, Number(number), body.data.draft, message);
        if (refused) return send(res, REFUSED[refused], { error: refused });
        queued(session);
        return send(res, 200, { message });
      }
    }
    const deliveryPath = DELIVERY_PATH.exec(path);
    if (req.method === 'GET' && deliveryPath && sessionIdSchema.safeParse(deliveryPath[1]).success) return holdDelivery(deliveryPath[1], req, res);
    const confirmPath = CONFIRM_PATH.exec(path);
    if (req.method === 'POST' && confirmPath && sessionIdSchema.safeParse(confirmPath[1]).success) {
      if (!await rounds.confirm(confirmPath[1], confirmPath[2] as Kind, Number(confirmPath[3]))) return send(res, 404, { error: 'unknown' });
      return noContent(res);
    }
    if (req.method === 'GET' && path === '/api/page/poll') return holdPoll(req, res);
    if (await sideChats.handle(req, res, path)) return;
    return send(res, 404, { error: 'not-found' });
  }

  /** A message waits for the session: a poll already waiting takes it, and the page shows it as sent. */
  function queued(session: string) {
    for (const wake of [...deliveryPolls.get(session) ?? []]) wake();
    pageChanged();
  }

  /** Held open until it times out, the page goes away, or what the page shows changes (`changed`). */
  function holdPoll(req: IncomingMessage, res: ServerResponse) {
    openPolls++;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true; openPolls--; lastPollEnd = Date.now(); lastBusy = Date.now();
      clearTimeout(timer);
      pagePolls.delete(wake);
    };
    const wake = () => { if (ended) return; end(); send(res, 200, { changed: true }); };
    pagePolls.add(wake);
    const timer = setTimeout(() => { end(); send(res, 200, {}); }, pollHoldMs);
    req.on('close', end);
    res.on('close', end);
  }

  /**
   * The mod's long-poll for one session: the oldest message waiting for it, at once or as soon as the person sends
   * one, or nothing once the hold runs out. The message goes out with its id (`round-2`, `free-1`), which the mod confirms once
   * `$.prompt.submit` has taken it.
   */
  function holdDelivery(session: string, req: IncomingMessage, res: ServerResponse) {
    let ended = false;
    const waiting = deliveryPolls.get(session) ?? new Set<() => void>();
    deliveryPolls.set(session, waiting);
    const end = () => {
      if (ended) return false;
      ended = true;
      clearTimeout(timer);
      waiting.delete(offer);
      if (waiting.size === 0) deliveryPolls.delete(session);
      return true;
    };
    function offer() {
      if (res.destroyed || ended) return;
      // Leased before the reply goes out, so a second poll racing this one never takes the same message.
      const next = rounds.take(session, deliveryLeaseMs);
      if (!next) return;
      end();
      send(res, 200, next);
    }
    const timer = setTimeout(() => { if (end()) send(res, 200, {}); }, deliveryHoldMs);
    waiting.add(offer);
    req.on('close', end);
    res.on('close', end);
    offer();
  }

  function hasSecret(value: string | string[] | undefined) {
    if (typeof value !== 'string') return false;
    const given = Buffer.from(value), expected = Buffer.from(secret);
    // Compared in constant time, so the answer's timing does not reveal how much of a guess was right.
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  async function serveStatic(path: string, res: ServerResponse) {
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { return send(res, 404, { error: 'not-found' }); }
    const file = resolve(staticRoot, '.' + (decoded === '/' ? '/index.html' : decoded));
    if (!file.startsWith(staticRoot + sep)) return send(res, 404, { error: 'not-found' });
    let body: Buffer;
    try {
      // A link inside the page folder that points outside it is refused like a path that does.
      const real = await realpath(file);
      if (!real.startsWith(staticRoot + sep)) return send(res, 404, { error: 'not-found' });
      body = await readFile(real);
    } catch { return send(res, 404, { error: 'not-found' }); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(body);
  }

  return { port, secret, stopped, stop };
}

/** The request's JSON body, or undefined when it is too large or not JSON. */
async function readJson(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength;
    if (size > maxBytes) return undefined;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return undefined; }
}

/**
 * Owns the lock, replacing an orphaned one. Listening comes first, so a rival that finds this lock can already reach
 * this server and step aside. Returns false when another live server owns it.
 */
async function takeLock(dataDir: string, own: ServerLock): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (createLock(dataDir, own)) return true;
    const found = readLock(dataDir);
    if (found && await answers(found)) return false;
    removeLock(dataDir);
  }
  return false;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function noContent(res: ServerResponse) {
  res.writeHead(204, { 'cache-control': 'no-store' }).end();
}

function close(server: Server) {
  return new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); });
}
