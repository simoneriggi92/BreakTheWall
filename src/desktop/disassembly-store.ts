import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateDisassembly, type Disassembly } from '../core/disassembly';
import { idSchema } from '../core/lesson';

// A repository disassembly carries its files' text, so the bound is larger than for lessons.
const MAX_BYTES = 4_000_000;

/** The revision with more parts taken apart is the later one; `v10` sorts after `v9`. */
function laterRevision(a: Disassembly, b: Disassembly): boolean {
  const deeper = (a.expansions?.length ?? 0) - (b.expansions?.length ?? 0);
  return deeper ? deeper > 0 : a.revision.localeCompare(b.revision, 'en', { numeric: true }) > 0;
}

/** Accepted generated disassemblies, one directory per disassembly, as the lesson store does for lessons. */
export class DisassemblyStore {
  constructor(private root: string) {}
  private file(id: string, revision: string) {
    return join(this.root, idSchema.parse(id), `${idSchema.parse(revision)}.json`);
  }
  async save(input: Disassembly): Promise<Disassembly> {
    const disassembly = await validateDisassembly(input);
    if (disassembly.kind !== 'generated') throw new Error('Only generated disassemblies are stored');
    const payload = JSON.stringify(disassembly);
    if (Buffer.byteLength(payload) > MAX_BYTES) throw new Error('Disassembly storage limit exceeded');
    const file = this.file(disassembly.id, disassembly.revision);
    await mkdir(join(this.root, disassembly.id), { recursive: true, mode: 0o700 });
    await writeFile(file + '.pending', payload, { encoding: 'utf8', mode: 0o600 });
    await rename(file + '.pending', file);
    return disassembly;
  }
  /**
   * Unreadable or invalid files are left on disk untouched and counted, never shown. Taking a part apart keeps the
   * earlier revision on disk; only the latest revision of each disassembly is listed.
   */
  async list(): Promise<{ disassemblies: Disassembly[]; skipped: number }> {
    let dirs: string[];
    try { dirs = await readdir(this.root); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { disassemblies: [], skipped: 0 }; throw error; }
    const disassemblies: Disassembly[] = []; let skipped = 0;
    for (const dir of dirs.filter(x => idSchema.safeParse(x).success)) {
      for (const name of (await readdir(join(this.root, dir)).catch(() => [])).filter(x => /^[a-z][a-z0-9-]{0,63}\.json$/.test(x))) {
        try {
          const raw = await readFile(join(this.root, dir, name), 'utf8');
          if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('oversized');
          const disassembly = await validateDisassembly(JSON.parse(raw));
          if (disassembly.kind !== 'generated' || disassembly.id !== dir || `${disassembly.revision}.json` !== name) throw new Error('misplaced');
          const earlier = disassemblies.findIndex(x => x.id === disassembly.id);
          if (earlier < 0) disassemblies.push(disassembly);
          else if (laterRevision(disassembly, disassemblies[earlier])) disassemblies[earlier] = disassembly;
        } catch { skipped++; }
      }
    }
    disassemblies.sort((a, b) => (b.generation?.createdAt ?? '').localeCompare(a.generation?.createdAt ?? ''));
    return { disassemblies, skipped };
  }
  async find(id: string, revision: string): Promise<Disassembly | undefined> {
    try {
      const disassembly = await validateDisassembly(JSON.parse(await readFile(this.file(id, revision), 'utf8')));
      return disassembly.id === id && disassembly.revision === revision ? disassembly : undefined;
    } catch { return undefined; }
  }
}
