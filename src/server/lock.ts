import { randomBytes } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { SECRET_HEADER, serverStatusSchema, type ServerStatus } from '../core/local-server';
import { defaultUserData } from '../desktop/incoming';

/**
 * How the launcher and every session find the one local server (#94): a lock file in the per-user data folder,
 * readable only by the person, naming the server's port, pid, version and per-launch secret.
 */
export const lockSchema = z.strictObject({
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().positive(),
  version: z.string().min(1).max(100),
  secret: z.string().min(1).max(200),
});
export type ServerLock = z.infer<typeof lockSchema>;

/** The server's folder inside the app's per-user data folder: outside the repository and the plugin folder. */
export const serverDataDir = (platform: string, env: Record<string, string | undefined>, home: string) => join(defaultUserData(platform, env, home), 'rounds');
export const lockPath = (dataDir: string) => join(dataDir, 'server.lock');

/** The lock as written, or null when there is none or it is not a lock file. */
export function readLock(dataDir: string): ServerLock | null {
  let raw: string;
  try { raw = readFileSync(lockPath(dataDir), 'utf8'); } catch { return null; }
  try { return lockSchema.parse(JSON.parse(raw)); } catch { return null; }
}

/**
 * Creates the lock only if none exists, so two servers starting at once never both own it. Returns false when a
 * lock file is already there. The lock is written whole to a private file first and then linked into place: a
 * rival never reads a half-written lock and takes it for an orphan.
 */
export function createLock(dataDir: string, lock: ServerLock): boolean {
  mkdirSync(dataDir, { recursive: true });
  const draft = `${lockPath(dataDir)}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(draft, JSON.stringify(lock), { flag: 'wx', mode: 0o600 });
  try {
    linkSync(draft, lockPath(dataDir));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    rmSync(draft, { force: true });
  }
}

/** Whether the lock file names this server. */
export function ownsLock(dataDir: string, own: Pick<ServerLock, 'port' | 'secret'>): boolean {
  const current = readLock(dataDir);
  return !!current && current.port === own.port && current.secret === own.secret;
}

export const removeLock = (dataDir: string) => rmSync(lockPath(dataDir), { force: true });

/** Removes the lock only while it still names this server, so a stopping server never deletes a newer one's. */
export function releaseLock(dataDir: string, own: Pick<ServerLock, 'port' | 'secret'>) {
  if (ownsLock(dataDir, own)) removeLock(dataDir);
}

/** The status of the server a lock names, or null when nothing answers there as Break the Wall with that secret. */
export async function serverStatus(lock: Pick<ServerLock, 'port' | 'secret'>, timeoutMs = 1500): Promise<ServerStatus | null> {
  try {
    const reply = await fetch(`http://127.0.0.1:${lock.port}/api/status`, { headers: { [SECRET_HEADER]: lock.secret }, signal: AbortSignal.timeout(timeoutMs) });
    if (!reply.ok) return null;
    return serverStatusSchema.parse(await reply.json());
  } catch { return null; }
}

/** Whether the server a lock names answers. Anything else is an orphan. */
export const answers = async (lock: ServerLock) => await serverStatus(lock) !== null;
