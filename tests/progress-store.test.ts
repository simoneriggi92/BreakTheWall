import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressStore } from '../src/desktop/progress-store';
import { initialDisassemblyState } from '../src/core/disassembly-state';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { loadPreparedLessons } from '../src/fixtures/lessons';
import { initialState, navigate, submit } from '../src/core/state';

const lessons = await loadPreparedLessons();
const disassemblies = await loadPreparedDisassemblies();
const dirs: string[] = [];
async function store() {
  const root = await mkdtemp(join(tmpdir(), 'btw-progress-'));
  dirs.push(root);
  return { root, store: new ProgressStore(root, lessons, disassemblies) };
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

describe('desktop progress store', () => {
  it('round-trips page, attempts and notes through an atomically replaced file', async () => {
    const { root, store: s } = await store();
    const lesson = lessons[0];
    let state = initialState(lesson);
    state = navigate(lesson, state, lesson.pages[1].id);
    state = submit(lesson, state, lesson.pages[1].checkpoint!, [lesson.activities[0].type === 'choice' ? lesson.activities[0].options[0].id : 'x']);
    state = { ...state, notes: { [lesson.pages[1].id]: 'Rifare su carta' } };
    await s.save(state);
    const files = await readdir(join(root, lesson.id));
    expect(files).toEqual([`${lesson.revision}.json`]);
    const loaded = await new ProgressStore(root, lessons).load({ lessonId: lesson.id, revision: lesson.revision });
    expect(loaded.notice).toBeUndefined();
    expect(loaded.state).toEqual(state);
  });

  it('preserves an unreadable file and starts a fresh session with a notice', async () => {
    const { root, store: s } = await store();
    const lesson = lessons[1];
    await s.save(initialState(lesson));
    const file = join(root, lesson.id, `${lesson.revision}.json`);
    await writeFile(file, '{ not json');
    const loaded = await s.load({ lessonId: lesson.id, revision: lesson.revision });
    expect(loaded.state).toBeNull();
    expect(loaded.notice).toMatch(/conservata/);
    const kept = (await readdir(join(root, lesson.id))).find(f => f.includes('.preserved-'))!;
    expect(await readFile(join(root, lesson.id, kept), 'utf8')).toBe('{ not json');
  });

  it('rejects state for an unknown lesson revision instead of writing it', async () => {
    const { store: s } = await store();
    const state = { ...initialState(lessons[0]), revision: 'v9' };
    await expect(s.save(state)).rejects.toThrow(/Unknown lesson revision/);
  });

  it('still loads lesson progress saved before disassemblies existed', async () => {
    const { root, store: s } = await store();
    const lesson = lessons[0];
    await mkdir(join(root, lesson.id), { recursive: true });
    // The exact shape the previous version wrote: no kind field, lesson keys only.
    const saved = { schemaVersion: 1, lessonId: lesson.id, revision: lesson.revision, pageId: lesson.pages[0].id, mode: 'explore', visited: [lesson.pages[0].id], frames: {}, nodes: {}, notes: { [lesson.pages[0].id]: 'Nota scritta prima' }, reflections: {}, attempts: [] };
    await writeFile(join(root, lesson.id, `${lesson.revision}.json`), JSON.stringify(saved));
    expect(await s.load({ lessonId: lesson.id, revision: lesson.revision })).toEqual({ state: saved });
  });

  it('keeps disassembly progress apart and round-trips it', async () => {
    const { root, store: s } = await store();
    const d = disassemblies[0];
    const state = { ...initialDisassemblyState(d), path: ['image'], runs: { 'failed-smoke': { step: 1, choices: { 0: 1 }, tried: [] } }, notes: { deploy: 'Solo il digest cambia' },
      reading: { source: d.sources[0].id, from: 20, view: 'guided' as const } };
    await s.save(state);
    expect(await readdir(root)).toEqual(['_disassemblies']);
    expect(await readdir(join(root, '_disassemblies', d.id))).toEqual([`${d.revision}.json`]);
    expect(await new ProgressStore(root, lessons, disassemblies).load({ disassemblyId: d.id, revision: d.revision })).toEqual({ state });
  });

  it('preserves disassembly progress whose references no longer hold, and says why with a code', async () => {
    const { root, store: s } = await store();
    const d = disassemblies[1];
    const dir = join(root, '_disassemblies', d.id);
    await mkdir(dir, { recursive: true });
    const stale = JSON.stringify({ ...initialDisassemblyState(d), notes: { removed: 'old note' } });
    await writeFile(join(dir, `${d.revision}.json`), stale);
    expect(await s.load({ disassemblyId: d.id, revision: d.revision })).toEqual({ state: null, noticeCode: 'references-changed' });
    await writeFile(join(dir, `${d.revision}.json`), '{ broken');
    expect(await s.load({ disassemblyId: d.id, revision: d.revision })).toEqual({ state: null, noticeCode: 'unreadable' });
    const kept = (await readdir(dir)).filter(f => f.includes('.preserved-'));
    expect(await Promise.all(kept.map(f => readFile(join(dir, f), 'utf8')))).toEqual(expect.arrayContaining([stale, '{ broken']));
  });

  it('refuses disassembly progress for an unknown revision or with dangling references', async () => {
    const { store: s } = await store();
    const d = disassemblies[0];
    await expect(s.save({ ...initialDisassemblyState(d), revision: 'v9' })).rejects.toThrow(/Unknown disassembly revision/);
    await expect(s.save({ ...initialDisassemblyState(d), selected: 'missing' })).rejects.toThrow(/Invalid learner references/);
  });
});
