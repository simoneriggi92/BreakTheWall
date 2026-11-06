import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateExploration, type Exploration } from '../core/exploration';
import { idSchema } from '../core/lesson';

// One source of at most 52,000 characters plus its structure; the bound leaves room without admitting anything huge.
const MAX_BYTES = 2_000_000;

/**
 * Accepted generated explorations (plan P-20261105-exploration X8), one directory per exploration, as the disassembly
 * store does. Prepared examples live in the app's fixtures, never here.
 */
export class ExplorationStore {
  constructor(private root: string) {}
  private file(id: string, revision: string) {
    return join(this.root, idSchema.parse(id), `${idSchema.parse(revision)}.json`);
  }
  async save(input: Exploration): Promise<Exploration> {
    const exploration = await validateExploration(input);
    if (exploration.kind !== 'generated') throw new Error('Only generated explorations are stored');
    const payload = JSON.stringify(exploration);
    if (Buffer.byteLength(payload) > MAX_BYTES) throw new Error('Exploration storage limit exceeded');
    const file = this.file(exploration.id, exploration.revision);
    await mkdir(join(this.root, exploration.id), { recursive: true, mode: 0o700 });
    await writeFile(file + '.pending', payload, { encoding: 'utf8', mode: 0o600 });
    await rename(file + '.pending', file);
    return exploration;
  }
  /** Unreadable, invalid or misplaced files are left on disk untouched and counted, never shown. The latest revision of each is listed. */
  async list(): Promise<{ explorations: Exploration[]; skipped: number }> {
    let dirs: string[];
    try { dirs = await readdir(this.root); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { explorations: [], skipped: 0 }; throw error; }
    const explorations: Exploration[] = []; let skipped = 0;
    for (const dir of dirs.filter(x => idSchema.safeParse(x).success)) {
      for (const name of (await readdir(join(this.root, dir)).catch(() => [])).filter(x => /^[a-z][a-z0-9-]{0,63}\.json$/.test(x))) {
        try {
          const raw = await readFile(join(this.root, dir, name), 'utf8');
          if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('oversized');
          const x = await validateExploration(JSON.parse(raw));
          if (x.kind !== 'generated' || x.id !== dir || `${x.revision}.json` !== name) throw new Error('misplaced');
          const earlier = explorations.findIndex(y => y.id === x.id);
          if (earlier < 0) explorations.push(x);
          else if (x.revision.localeCompare(explorations[earlier].revision, 'en', { numeric: true }) > 0) explorations[earlier] = x;
        } catch { skipped++; }
      }
    }
    explorations.sort((a, b) => (b.generation?.createdAt ?? '').localeCompare(a.generation?.createdAt ?? ''));
    return { explorations, skipped };
  }
  async find(id: string, revision: string): Promise<Exploration | undefined> {
    try {
      const x = await validateExploration(JSON.parse(await readFile(this.file(id, revision), 'utf8')));
      return x.id === id && x.revision === revision ? x : undefined;
    } catch { return undefined; }
  }
}
