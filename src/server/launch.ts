import { spawn } from 'node:child_process';
import { SECRET_HEADER } from '../core/local-server';
import { answers, readLock, serverStatus, type ServerLock } from './lock';

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
}

/** The fragment never travels to the server, so the secret stays out of request lines and logs. */
export const pageUrl = (lock: Pick<ServerLock, 'port' | 'secret'>) => `http://127.0.0.1:${lock.port}/#t=${lock.secret}`;

export async function ensureServer({ dataDir, serverScript, env = process.env, timeoutMs = 10_000 }: LaunchOptions): Promise<ServerLock> {
  const found = readLock(dataDir);
  if (found && await answers(found)) return found;
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

export async function openPage(options: LaunchOptions & { open?: (url: string) => Promise<void> }): Promise<ServerLock & { opened: boolean }> {
  const lock = await ensureServer(options);
  const status = await serverStatus(lock, 3000);
  if (!status) throw new Error('The local server stopped answering.');
  // A connected page will show what comes next by itself; a second tab would only multiply tabs.
  if (status.pageConnected) return { ...lock, opened: false };
  await (options.open ?? openInBrowser)(pageUrl(lock));
  return { ...lock, opened: true };
}

/**
 * The plugin asked a skill of this session for rounds (#99): the server opens the session's round phase. Only a
 * running server is told; starting one here would hold the skill's start, and without one the phase still opens at
 * the first round.
 */
export async function markPhase({ dataDir, session, cwd, timeoutMs = 3000 }: { dataDir: string; session: string; cwd: string; timeoutMs?: number }): Promise<{ marked: boolean }> {
  const lock = readLock(dataDir);
  if (!lock) return { marked: false };
  try {
    const reply = await fetch(`http://127.0.0.1:${lock.port}/api/sessions/${encodeURIComponent(session)}/phase`, {
      method: 'POST', headers: { [SECRET_HEADER]: lock.secret, 'content-type': 'application/json' }, body: JSON.stringify({ cwd }), signal: AbortSignal.timeout(timeoutMs),
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
