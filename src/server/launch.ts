import { spawn } from 'node:child_process';
import { SECRET_HEADER, type ServerStatus } from '../core/local-server';
import { answers, readLock, releaseLock, serverStatus, type ServerLock } from './lock';

/**
 * What the mod asks of the launcher (#94): find the one server through its lock file, or start it detached; and open
 * the page only when none is connected. The mod runs this through `node launcher.cjs`, so the logic lives here,
 * where it can be tested, and the mod stays a thin adapter.
 */
export interface LaunchOptions {
  dataDir: string;
  /** The bundled server, started with the same Node that runs the launcher. */
  serverScript: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** This launcher's own version: an older server it finds is replaced when no other session uses it (#102). */
  version?: string;
  /** The session the launcher runs for, which does not count as another. */
  session?: string;
}

/** The fragment never travels to the server, so the secret stays out of request lines and logs. */
export const pageUrl = (lock: Pick<ServerLock, 'port' | 'secret'>) => `http://127.0.0.1:${lock.port}/#t=${lock.secret}`;

export async function ensureServer({ dataDir, serverScript, env = process.env, timeoutMs = 10_000, version, session }: LaunchOptions): Promise<ServerLock> {
  const found = readLock(dataDir);
  const status = found && await serverStatus(found);
  if (found && status && !await replaces(dataDir, found, status, version, session)) return found;
  await spawnDetached(process.execPath, [serverScript], { env });
  // The server replaces an orphaned lock itself; the launcher waits for a lock whose server answers.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(done => setTimeout(done, 100));
    const lock = readLock(dataDir);
    if (lock && await answers(lock)) return lock;
  }
  throw new Error('The local server did not start.');
}

/**
 * Whether this launcher's newer server takes the place of the one it found (#102): only when no session but the
 * launching one is registered with it, so no other session loses its server mid-round. Otherwise the found server is
 * told the update waits, and its page says so. The found server's lock is removed only while it still names that
 * server; the server sees its lock gone at its next check and stops.
 */
async function replaces(dataDir: string, found: ServerLock, status: ServerStatus, version: string | undefined, session: string | undefined): Promise<boolean> {
  if (version === undefined || compareVersions(status.version, version) >= 0) return false;
  // A server older than #102 does not list its sessions: it is left to stop when they end.
  const others = status.sessions?.filter(x => x !== session) ?? [undefined];
  if (others.length > 0) {
    await fetch(`http://127.0.0.1:${found.port}/api/update`, {
      method: 'POST', headers: { [SECRET_HEADER]: found.secret, 'content-type': 'application/json' }, body: JSON.stringify({ version }), signal: AbortSignal.timeout(1500),
    }).catch(() => undefined);
    return false;
  }
  releaseLock(dataDir, found);
  return true;
}

/**
 * Orders two versions as `major.minor.patch[-pre]`: a pre-release comes before its release, and pre-releases compare
 * part by part, numbers as numbers. Negative when `a` is older.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (x: string) => { const [core, ...pre] = x.trim().replace(/^v/, '').split('-'); return { core: core.split('.'), pre: pre.join('-') }; };
  const part = (x: string | undefined, y: string | undefined) => {
    if (x === y) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const [m, n] = [Number(x), Number(y)];
    return Number.isInteger(m) && Number.isInteger(n) ? m - n : x < y ? -1 : 1;
  };
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.core.length, y.core.length); i++) {
    const order = part(x.core[i] ?? '0', y.core[i] ?? '0');
    if (order !== 0) return order;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === '') return 1;
  if (y.pre === '') return -1;
  const [p, q] = [x.pre.split('.'), y.pre.split('.')];
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    const order = part(p[i], q[i]);
    if (order !== 0) return order;
  }
  return 0;
}

/**
 * A process group of its own (`detached`) and no pipes back to the launcher: ending the session, or the group the
 * session runs in, leaves the child running, and the mod's call returns as soon as the launcher exits.
 */
function spawnDetached(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; windowsVerbatimArguments?: boolean } = {}) {
  return new Promise<void>((done, fail) => {
    const child = spawn(command, args, { ...options, detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', fail);
    child.once('spawn', () => { child.unref(); done(); });
  });
}

export async function openPage(options: LaunchOptions & { open?: (url: string) => Promise<void> }): Promise<ServerLock & { opened: boolean; url: string }> {
  const lock = await ensureServer(options);
  const status = await serverStatus(lock, 3000);
  if (!status) throw new Error('The local server stopped answering.');
  // The mod prints the address either way (#147): a tab closed within the grace below opens no new one.
  const url = pageUrl(lock);
  // A connected page will show what comes next by itself; a second tab would only multiply tabs.
  if (status.pageConnected) return { ...lock, opened: false, url };
  await (options.open ?? openInBrowser)(url);
  return { ...lock, opened: true, url };
}

/**
 * The plugin asked a skill of this session for rounds (#99): the server opens the session's round phase, and names
 * the session after the skill and its arguments (#102). Only a running server is told; starting one here would hold
 * the skill's start, and without one the phase still opens at the first round.
 */
export async function markPhase({ dataDir, session, cwd, skill, args, timeoutMs = 3000 }: { dataDir: string; session: string; cwd: string; skill?: string; args?: string; timeoutMs?: number }): Promise<{ marked: boolean }> {
  const lock = readLock(dataDir);
  if (!lock) return { marked: false };
  try {
    const reply = await fetch(`http://127.0.0.1:${lock.port}/api/sessions/${encodeURIComponent(session)}/phase`, {
      method: 'POST', headers: { [SECRET_HEADER]: lock.secret, 'content-type': 'application/json' }, body: JSON.stringify({ cwd, ...skill ? { skill, args: args?.slice(0, 4000) ?? '' } : {} }), signal: AbortSignal.timeout(timeoutMs),
    });
    return { marked: reply.ok };
  } catch { return { marked: false }; }
}

/**
 * How each system opens a URL in the default browser. The URL holds only digits, letters, `-` and `_` after `#t=`,
 * so no shell quoting is at stake. On Windows the arguments go verbatim, so `start` receives `""` as the window
 * title rather than an escaped quote pair.
 */
export function browserCommand(url: string, platform: string): { command: string; args: string[]; verbatim: boolean } {
  if (platform === 'darwin') return { command: 'open', args: [url], verbatim: false };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '""', url], verbatim: true };
  return { command: 'xdg-open', args: [url], verbatim: false };
}

function openInBrowser(url: string): Promise<void> {
  const { command, args, verbatim } = browserCommand(url, process.platform);
  return spawnDetached(command, args, { windowsVerbatimArguments: verbatim });
}
