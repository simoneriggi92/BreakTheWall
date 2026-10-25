import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { story } from './disassemblies';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
async function store() {
  const root = await mkdtemp(join(tmpdir(), 'btw-disassemblies-')); dirs.push(root);
  return { root, store: new DisassemblyStore(root) };
}
/** The story fixture, turned into what generation will save. */
function generated(id = 'g-kessmouth', createdAt = '2026-10-25T10:00:00.000Z') {
  const d = story();
  d.id = id; d.kind = 'generated'; d.generation = { provider: 'chatgpt', model: 'model-a', createdAt };
  return d;
}

describe('disassembly store', () => {
  it('validates, saves, lists newest first, and finds a generated disassembly', async () => {
    const { root, store: s } = await store();
    await s.save(generated('g-older', '2026-10-24T10:00:00.000Z'));
    await s.save(generated());
    const listed = await s.list();
    expect(listed.disassemblies.map(x => x.id)).toEqual(['g-kessmouth', 'g-older']);
    expect(listed.skipped).toBe(0);
    await expect(s.find('g-kessmouth', 'v1')).resolves.toEqual(listed.disassemblies[0]);
    expect(await readdir(join(root, 'g-kessmouth'))).toEqual(['v1.json']);
  });
  it('refuses prepared or invalid disassemblies instead of writing them', async () => {
    const { root, store: s } = await store();
    await expect(s.save(story())).rejects.toThrow(/Only generated/);
    const broken = generated(); broken.parts[0].cites[0].to = 999;
    await expect(s.save(broken)).rejects.toThrow(/outside the source/);
    expect(await readdir(root)).toEqual([]);
  });
  it('skips unreadable or misplaced files without deleting them', async () => {
    const { root, store: s } = await store();
    await s.save(generated());
    await mkdir(join(root, 'g-broken')); await writeFile(join(root, 'g-broken', 'v1.json'), '{ broken');
    await mkdir(join(root, 'g-elsewhere')); await writeFile(join(root, 'g-elsewhere', 'v1.json'), JSON.stringify(generated()));
    await writeFile(join(root, 'ignored.txt'), 'x');
    const listed = await s.list();
    expect(listed.disassemblies.map(x => x.id)).toEqual(['g-kessmouth']);
    expect(listed.skipped).toBe(2);
    expect(await readdir(join(root, 'g-broken'))).toEqual(['v1.json']);
  });
  it('returns nothing for an unknown or unsafe key', async () => {
    const { store: s } = await store();
    await expect(s.find('g-missing', 'v1')).resolves.toBeUndefined();
    await expect(s.find('../etc', 'v1')).resolves.toBeUndefined();
  });
  it('lists nothing before the folder exists', async () => {
    await expect(new DisassemblyStore(join(tmpdir(), 'btw-none-' + crypto.randomUUID())).list()).resolves.toEqual({ disassemblies: [], skipped: 0 });
  });
});
