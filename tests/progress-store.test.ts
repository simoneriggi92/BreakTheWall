import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressStore } from '../src/desktop/progress-store';
import { loadPreparedLessons } from '../src/fixtures/lessons';
import { initialState, navigate, submit } from '../src/core/state';

const lessons = await loadPreparedLessons();
const dirs: string[] = [];
async function store() {
  const root = await mkdtemp(join(tmpdir(), 'btw-progress-'));
  dirs.push(root);
  return { root, store: new ProgressStore(root, lessons) };
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
    expect(() => s.save(state)).toThrow(/Unknown prepared lesson revision/);
  });
});
