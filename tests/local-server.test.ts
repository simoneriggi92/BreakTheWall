// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { lockPath } from '../src/server/lock';
import { startLocalServer, type LocalServer, type LocalServerOptions } from '../src/server/server';

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
async function start(options: Partial<LocalServerOptions> = {}) {
  const server = await startLocalServer({ dataDir: folder(), staticDir: pageFolder(), version: '0.6.0-test', ...options });
  if (!server) throw new Error('the server did not start');
  servers.push(server);
  return server;
}

interface Reply { status: number; headers: Record<string, string | string[] | undefined>; body: string }
/** A raw HTTP call, so a test can send any Host or Origin, as a browser on another site or a rebinding DNS would. */
function call(port: number, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: init.method ?? 'GET', headers: { host: `127.0.0.1:${port}`, ...init.headers } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end(init.body);
  });
}
const withSecret = (server: LocalServer, headers: Record<string, string> = {}) => ({ 'x-btw-secret': server.secret, ...headers });

describe('the local server refuses every caller but a page opened from Claude Code (#94)', () => {
  it('answers an API call that carries the secret, on 127.0.0.1 only', async () => {
    const server = await start();
    const reply = await call(server.port, '/api/status', { headers: withSecret(server) });
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toMatchObject({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: false });
  });

  it('refuses a missing or wrong secret', async () => {
    const server = await start();
    expect((await call(server.port, '/api/status')).status).toBe(401);
    expect((await call(server.port, '/api/status', { headers: { 'x-btw-secret': 'x'.repeat(server.secret.length) } })).status).toBe(401);
    expect((await call(server.port, '/api/status', { headers: { 'x-btw-secret': server.secret.slice(0, -1) } })).status).toBe(401);
  });

  it('refuses a Host other than its own address, as a rebinding DNS name would send', async () => {
    const server = await start();
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { host: `evil.example:${server.port}` }) })).status).toBe(403);
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { host: '127.0.0.1:1' }) })).status).toBe(403);
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { host: `localhost:${server.port}` }) })).status).toBe(200);
  });

  it('refuses a foreign Origin, and accepts its own', async () => {
    const server = await start();
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { origin: 'https://evil.example' }) })).status).toBe(403);
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { origin: 'null' }) })).status).toBe(403);
    expect((await call(server.port, '/api/status', { headers: withSecret(server, { origin: `http://127.0.0.1:${server.port}` }) })).status).toBe(200);
  });

  it('sends no CORS headers, not even to a preflight', async () => {
    const server = await start();
    const preflight = await call(server.port, '/api/status', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-btw-secret' } });
    const answered = await call(server.port, '/api/status', { headers: withSecret(server) });
    for (const reply of [preflight, answered]) expect(Object.keys(reply.headers).filter(x => x.startsWith('access-control-'))).toEqual([]);
    expect(preflight.status).toBeGreaterThanOrEqual(400);
  });

  it('serves the page and its files without the secret, and nothing outside them', async () => {
    const server = await start();
    const page = await call(server.port, '/');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.body).toContain('<title>page</title>');
    expect((await call(server.port, '/assets/app.js')).headers['content-type']).toMatch(/javascript/);
    expect((await call(server.port, '/assets/missing.js')).status).toBe(404);
    expect((await call(server.port, '/../../etc/passwd')).status).toBe(404);
    expect((await call(server.port, '/%2e%2e/%2e%2e/etc/passwd')).status).toBe(404);
  });
});

describe('one server per person, found through a lock file (#94)', () => {
  const readLock = (dataDir: string) => JSON.parse(readFileSync(lockPath(dataDir), 'utf8'));

  it('writes port, pid, version and secret to a lock file only the person can read', async () => {
    const dataDir = folder();
    const server = await start({ dataDir });
    expect(readLock(dataDir)).toEqual({ port: server.port, pid: process.pid, version: '0.6.0-test', secret: server.secret });
    if (process.platform !== 'win32') expect(statSync(lockPath(dataDir)).mode & 0o777).toBe(0o600);
  });

  it('does not start a second server while the first one answers', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    expect(await startLocalServer({ dataDir, staticDir: pageFolder(), version: '0.6.0-test' })).toBeNull();
    expect(readLock(dataDir).port).toBe(first.port);
    expect((await call(first.port, '/api/status', { headers: withSecret(first) })).status).toBe(200);
  });

  it('replaces an orphaned lock file, left by a server that no longer answers', async () => {
    const dataDir = folder();
    // A port that was free a moment ago: nothing answers there now.
    const port = await new Promise<number>(done => { const probe = createServer().listen(0, '127.0.0.1', () => { const { port } = probe.address() as { port: number }; probe.close(() => done(port)); }); });
    writeFileSync(lockPath(dataDir), JSON.stringify({ port, pid: 999999, version: '0.5.0', secret: 'old' }), { mode: 0o600 });
    const server = await start({ dataDir });
    expect(readLock(dataDir)).toMatchObject({ port: server.port, secret: server.secret });
  });

  it('replaces a lock file that is not a lock file', async () => {
    const dataDir = folder();
    writeFileSync(lockPath(dataDir), 'not json');
    const server = await start({ dataDir });
    expect(readLock(dataDir).port).toBe(server.port);
  });

  it('removes its lock file when it stops, and leaves one that names another server', async () => {
    const dataDir = folder();
    await (await start({ dataDir })).stop();
    expect(existsSync(lockPath(dataDir))).toBe(false);
    const server = await start({ dataDir });
    const other = { port: 1, pid: 1, version: '0.6.0-test', secret: 'other' };
    writeFileSync(lockPath(dataDir), JSON.stringify(other));
    await server.stop();
    expect(readLock(dataDir)).toEqual(other);
  });

  it('leaves exactly one server when several start at once on the same folder', async () => {
    const dataDir = folder();
    const options = { dataDir, staticDir: pageFolder(), version: '0.6.0-test', checkEveryMs: 20 };
    const started = (await Promise.all(Array.from({ length: 6 }, () => startLocalServer(options)))).filter(x => x !== null);
    servers.push(...started);
    await new Promise(done => setTimeout(done, 200));
    const running = await Promise.all(started.map(x => Promise.race([x.stopped.then(() => false), Promise.resolve(true)])));
    const alive = started.filter((_, i) => running[i]);
    expect(alive).toHaveLength(1);
    expect(JSON.parse(readFileSync(lockPath(dataDir), 'utf8')).port).toBe(alive[0].port);
  });

  it('stops when its lock file names another server, so a lost race never leaves two', async () => {
    const dataDir = folder();
    const server = await start({ dataDir, checkEveryMs: 20 });
    writeFileSync(lockPath(dataDir), JSON.stringify({ port: 1, pid: 1, version: '0.6.0-test', secret: 'other' }));
    await Promise.race([server.stopped, new Promise((_, fail) => setTimeout(() => fail(new Error('still running')), 2000))]);
  });

  it('creates the data folder when it is missing', async () => {
    const dataDir = join(folder(), 'Break the Wall', 'rounds');
    const server = await start({ dataDir });
    expect(readLock(dataDir).port).toBe(server.port);
  });
});

describe('the server stops by itself once nobody uses it (#94)', () => {
  // Short times stand in for the 10 minutes; the rule is the same.
  const quick = { idleMs: 150, checkEveryMs: 20, sessionTtlMs: 400, pageGraceMs: 50, pollHoldMs: 2000 };
  const pause = (ms: number) => new Promise(done => setTimeout(done, ms));
  const within = <T,>(promise: Promise<T>, ms: number) => Promise.race([promise, pause(ms).then(() => { throw new Error(`still running after ${ms} ms`); })]);
  const register = (server: LocalServer, body: unknown) => call(server.port, '/api/sessions', { method: 'POST', headers: withSecret(server, { 'content-type': 'application/json' }), body: JSON.stringify(body) });

  it('stops with no session registered and no page connected, and removes its lock file', async () => {
    const dataDir = folder();
    const server = await start({ dataDir, ...quick });
    await within(server.stopped, 2000);
    expect(existsSync(lockPath(dataDir))).toBe(false);
    await expect(call(server.port, '/api/status', { headers: withSecret(server) })).rejects.toThrow();
  });

  it('keeps running while a session is registered, and stops once its registration lapses', async () => {
    const server = await start(quick);
    expect((await register(server, { id: 'c0ffee00-0000-4000-8000-000000000001', cwd: '/work/project' })).status).toBe(204);
    await pause(quick.idleMs + 100);
    expect((await call(server.port, '/api/status', { headers: withSecret(server) })).status).toBe(200);
    await within(server.stopped, 2000);
  });

  it('starts its idle clock over when a launcher asks its status, so a server just found does not stop under it', async () => {
    const server = await start(quick);
    await pause(quick.idleMs - 50);
    expect((await call(server.port, '/api/status', { headers: withSecret(server) })).status).toBe(200);
    await pause(quick.idleMs - 50);
    expect((await call(server.port, '/api/status', { headers: withSecret(server) })).status).toBe(200);
  });

  it('refuses a registration that is not a session id and a folder', async () => {
    const server = await start();
    expect((await register(server, { id: '', cwd: '/work' })).status).toBe(400);
    expect((await register(server, { id: 'abc' })).status).toBe(400);
    expect((await call(server.port, '/api/sessions', { method: 'POST', headers: withSecret(server), body: 'not json' })).status).toBe(400);
  });

  it('counts a page as connected while it polls, and stops once the page is gone', async () => {
    const server = await start(quick);
    const poll = request({ host: '127.0.0.1', port: server.port, path: '/api/page/poll', headers: { host: `127.0.0.1:${server.port}`, ...withSecret(server) } });
    poll.on('error', () => {});
    poll.end();
    await pause(50);
    expect(JSON.parse((await call(server.port, '/api/status', { headers: withSecret(server) })).body).pageConnected).toBe(true);
    await pause(quick.idleMs + 100);
    expect((await call(server.port, '/api/status', { headers: withSecret(server) })).status).toBe(200);
    poll.destroy();
    await pause(quick.pageGraceMs + 30);
    await within(server.stopped, 2000);
  });

  it('does not count a page whose poll was refused', async () => {
    const server = await start(quick);
    const refused = await call(server.port, '/api/page/poll', { headers: { 'x-btw-secret': 'wrong' } });
    expect(refused.status).toBe(401);
    await within(server.stopped, 2000);
  });
});
