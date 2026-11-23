import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { z } from 'zod';
import { SECRET_HEADER, type ServerStatus } from '../core/local-server';
import { answers, createLock, ownsLock, readLock, releaseLock, removeLock, type ServerLock } from './lock';

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

const registrationSchema = z.strictObject({ id: z.string().min(1).max(200), cwd: z.string().min(1).max(4096) });
const MAX_BODY_BYTES = 64 * 1024;

export async function startLocalServer(options: LocalServerOptions): Promise<LocalServer | null> {
  const { idleMs = 10 * 60_000, checkEveryMs = 15_000, sessionTtlMs = 2 * 60_000, pollHoldMs = 25_000, pageGraceMs = 10_000 } = options;
  const secret = randomBytes(32).toString('base64url');
  const server = createServer();
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => { server.off('error', fail); done(); }); });
  const port = (server.address() as { port: number }).port;
  const local = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const staticRoot = await realpath(options.staticDir);
  const own: ServerLock = { port, pid: process.pid, version: options.version, secret };
  if (!await takeLock(options.dataDir, own)) { await close(server); return null; }

  // Presence: who keeps the server alive. A session holds a lease it renews; a page holds a poll open.
  const sessions = new Map<string, { cwd: string; until: number }>();
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
      sessions.set(registration.data.id, { cwd: registration.data.cwd, until: Date.now() + sessionTtlMs });
      lastBusy = Date.now();
      res.writeHead(204, { 'cache-control': 'no-store' }).end();
      return;
    }
    if (req.method === 'GET' && path === '/api/page/poll') return holdPoll(req, res);
    return send(res, 404, { error: 'not-found' });
  }

  /** Held open until it times out or the page goes away; later tickets answer it with what the page must show. */
  function holdPoll(req: IncomingMessage, res: ServerResponse) {
    openPolls++;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true; openPolls--; lastPollEnd = Date.now(); lastBusy = Date.now();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => { end(); send(res, 200, {}); }, pollHoldMs);
    req.on('close', end);
    res.on('close', end);
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
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) return undefined;
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

function close(server: Server) {
  return new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); });
}
