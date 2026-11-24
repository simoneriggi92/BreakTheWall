// @vitest-environment node
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { browserCommand, openPage, pageUrl } from '../src/server/launch';
import { readLock } from '../src/server/lock';
import { startLocalServer, type LocalServer } from '../src/server/server';
import { CWD, serverClient, SESSION } from './local-server-harness';

const run = promisify(execFile);
let root: string;
const started: number[] = [];
const servers: LocalServer[] = [];

/** The plugin's layout: `server/server.cjs`, `server/launcher.cjs` and `page/`, built as the plugin build does. */
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'btw-launcher-'));
  await build({
    entryPoints: { server: 'src/server/main.ts', launcher: 'src/server/launcher.ts' },
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', outdir: join(root, 'plugin', 'server'), outExtension: { '.js': '.cjs' },
    define: { BTW_VERSION: JSON.stringify('0.6.0-test') }, logLevel: 'silent',
  });
  mkdirSync(join(root, 'plugin', 'page'));
  writeFileSync(join(root, 'plugin', 'page', 'index.html'), '<!doctype html><title>page</title>');
}, 30_000);
afterEach(async () => {
  for (const pid of started.splice(0)) try { process.kill(pid); } catch { /* already gone */ }
  await Promise.all(servers.splice(0).map(x => x.stop()));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const dataFolder = () => mkdtempSync(join(root, 'data-'));
async function launch(command: string, dataDir: string) {
  const { stdout } = await run(process.execPath, [join(root, 'plugin', 'server', 'launcher.cjs'), command], { env: { ...process.env, BTW_USER_DATA_DIR: dataDir }, timeout: 20_000 });
  const reply = JSON.parse(stdout) as { port: number; secret: string; pid: number };
  started.push(reply.pid);
  return reply;
}
const status = (port: number, secret: string) => fetch(`http://127.0.0.1:${port}/api/status`, { headers: { 'x-btw-secret': secret } });

describe('the launcher starts one server, detached from the session (#94)', () => {
  it('starts a server that keeps running after the launcher has exited', async () => {
    const reply = await launch('start', dataFolder());
    expect((await status(reply.port, reply.secret)).status).toBe(200);
    expect(await (await fetch(`http://127.0.0.1:${reply.port}/`)).text()).toContain('<title>page</title>');
  });

  it.skipIf(process.platform === 'win32')('runs the server in a process group of its own, so ending the session\'s group leaves it running', async () => {
    const reply = await launch('start', dataFolder());
    const group = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(reply.pid)], { encoding: 'utf8' }).trim());
    expect(group).toBe(reply.pid);
    expect(group).not.toBe(Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' }).trim()));
  });

  it('keeps the data in the folder BTW_USER_DATA_DIR names, under rounds/', async () => {
    const dataDir = dataFolder();
    const reply = await launch('start', dataDir);
    expect(readLock(join(dataDir, 'rounds'))).toMatchObject({ port: reply.port, secret: reply.secret, version: '0.6.0-test' });
  });

  it('answers an unknown command with an error line and a failing exit code', async () => {
    const failed = await run(process.execPath, [join(root, 'plugin', 'server', 'launcher.cjs'), 'stop'], { env: { ...process.env, BTW_USER_DATA_DIR: dataFolder() } }).catch((error: { code: number; stdout: string }) => error);
    expect('code' in failed && failed.code).toBe(1);
    expect(JSON.parse(failed.stdout)).toEqual({ error: expect.stringContaining('"stop"') });
  });

  it('finds the running server instead of starting another', async () => {
    const dataDir = dataFolder();
    const first = await launch('start', dataDir);
    const second = await launch('start', dataDir);
    expect(second).toEqual(first);
  });

  it('starts a new server when the lock file names one that has stopped', async () => {
    const dataDir = dataFolder();
    const first = await launch('start', dataDir);
    process.kill(first.pid);
    await new Promise(done => setTimeout(done, 200));
    const second = await launch('start', dataDir);
    expect(second.port === first.port && second.secret === first.secret).toBe(false);
    expect((await status(second.port, second.secret)).status).toBe(200);
  });
});

describe('/break-the-wall opens a tab only when no page is connected (#94)', () => {
  async function running() {
    const dataDir = mkdtempSync(join(root, 'data-'));
    const server = await startLocalServer({ dataDir, staticDir: join(root, 'plugin', 'page'), version: '0.6.0-test' });
    servers.push(server!);
    return { dataDir, server: server! };
  }

  it('opens the page with the secret in the fragment, which never reaches the server', async () => {
    const { dataDir, server } = await running();
    const opened: string[] = [];
    const result = await openPage({ dataDir, serverScript: 'unused', open: async url => { opened.push(url); } });
    expect(result.opened).toBe(true);
    expect(opened).toEqual([`http://127.0.0.1:${server.port}/#t=${server.secret}`]);
    expect(pageUrl({ port: server.port, secret: server.secret })).toBe(opened[0]);
  });

  it('opens nothing while a page is polling', async () => {
    const { dataDir, server } = await running();
    const poll = request({ host: '127.0.0.1', port: server.port, path: '/api/page/poll', headers: { 'x-btw-secret': server.secret } });
    poll.on('error', () => {});
    poll.end();
    await new Promise(done => setTimeout(done, 50));
    const opened: string[] = [];
    const result = await openPage({ dataDir, serverScript: 'unused', open: async url => { opened.push(url); } });
    poll.destroy();
    expect(result.opened).toBe(false);
    expect(opened).toEqual([]);
  });
});

describe('the injection marker reaches the server through the launcher (#99)', () => {
  const phase = async (userData: string, ...args: string[]) =>
    JSON.parse((await run(process.execPath, [join(root, 'plugin', 'server', 'launcher.cjs'), 'phase', ...args], { env: { ...process.env, BTW_USER_DATA_DIR: userData }, timeout: 20_000 })).stdout);

  it('opens the round phase of the session on the running server', async () => {
    const userData = dataFolder();
    const server = (await startLocalServer({ dataDir: join(userData, 'rounds'), staticDir: join(root, 'plugin', 'page'), version: '0.6.0-test' }))!;
    servers.push(server);
    expect(await phase(userData, SESSION, CWD, 'mattpocock-skills:grilling', 'the history column, #102')).toEqual({ marked: true });
    expect(await (await serverClient(server).turn('Which page do you mean?')).json()).toEqual({ round: null, free: 1 });
    // The skill and its arguments name the session in the history column.
    expect((await serverClient(server).history()).projects[0].sessions[0]).toMatchObject({ session: SESSION, skill: 'grilling', ticket: 102 });
  });

  it('starts no server when none runs: the phase then opens at the first round', async () => {
    const userData = dataFolder();
    expect(await phase(userData, SESSION, CWD)).toEqual({ marked: false });
    expect(readLock(join(userData, 'rounds'))).toBeNull();
  });
});

describe('the browser each system opens the page with (#94)', () => {
  const url = 'http://127.0.0.1:4321/#t=abc-_9';
  it('uses open on macOS, xdg-open on Linux, and start with an empty title on Windows', () => {
    expect(browserCommand(url, 'darwin')).toEqual({ command: 'open', args: [url], verbatim: false });
    expect(browserCommand(url, 'linux')).toEqual({ command: 'xdg-open', args: [url], verbatim: false });
    expect(browserCommand(url, 'win32')).toEqual({ command: 'cmd', args: ['/c', 'start', '""', url], verbatim: true });
  });
});
