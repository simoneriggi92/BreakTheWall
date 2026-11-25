import { randomBytes } from 'node:crypto';
import { mkdir, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/** How the server keeps its files: whole, replaced atomically, one write at a time per file, read back with Zod. */

/** The names in a folder; none when it does not exist or cannot be read. */
export async function entries(dir: string): Promise<string[]> {
  try { return await readdir(dir); } catch { return []; }
}

/** Every session's folder, `<projects>/<project>/<session>`, where each store reads back what it kept. */
export async function sessionFolders(projectsDir: string): Promise<string[]> {
  const found: string[] = [];
  for (const project of await entries(projectsDir)) {
    for (const session of await entries(join(projectsDir, project))) found.push(join(projectsDir, project, session));
  }
  return found;
}

/** Written beside the file, then renamed over it: a reader sees the old file or the new one, never half of one. */
export async function atomicWrite(file: string, data: string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(6).toString('hex')}.pending`;
  try {
    await writeFile(temp, data, { mode: 0o600 });
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/**
 * The writes of one store, in order per key: a write waits for the one before it under the same key, failed or not, so
 * a slower earlier write never lands over a later one. Memory is the store's own business; this only orders the files.
 */
export class WriteQueue {
  private writes = new Map<string, Promise<void>>();

  /** Writes `data` as indented JSON to `file` once the earlier writes under `key` have landed. */
  write(key: string, file: string, data: unknown): Promise<void> {
    const write = (this.writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => atomicWrite(file, JSON.stringify(data, null, 2)));
    this.writes.set(key, write);
    return write;
  }

  /**
   * Waits for every write under a key `matching` picks, failed or not, and forgets them: what is deleted next is not
   * put back by a write still on its way.
   */
  async settle(matching: (key: string) => boolean): Promise<void> {
    const pending = [...this.writes].filter(([key]) => matching(key));
    await Promise.all(pending.map(([, write]) => write.catch(() => {})));
    // A write queued meanwhile under the same key keeps its place in the chain.
    for (const [key, write] of pending) if (this.writes.get(key) === write) this.writes.delete(key);
  }
}

/** Why a path names no file the server reads. */
export type FileRefusal = 'missing' | 'outside' | 'not-a-file' | 'too-large';

/**
 * The real path of the file `path` names inside `folder`, or why it names none. A path from an agent's turn or spec is
 * never trusted: `..` and links that lead out of the folder are refused like a path that does.
 */
export async function fileInside(folder: string, path: string, maxBytes: number): Promise<{ file: string } | { refused: FileRefusal }> {
  let root: string, file: string;
  try {
    root = await realpath(folder);
    file = await realpath(resolve(root, path));
  } catch { return { refused: 'missing' }; }
  if (!file.startsWith(root + sep)) return { refused: 'outside' };
  const info = await stat(file).catch(() => null);
  if (!info) return { refused: 'missing' };
  if (!info.isFile()) return { refused: 'not-a-file' };
  if (info.size > maxBytes) return { refused: 'too-large' };
  return { file };
}
