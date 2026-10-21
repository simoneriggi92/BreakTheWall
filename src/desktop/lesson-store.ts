import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { idSchema, validateLesson, type Lesson } from '../core/lesson';

const MAX_BYTES = 2_000_000;

/** Accepted generated lessons, one directory per lesson. Only validated packages are written or returned. */
export class LessonStore {
  constructor(private root: string) {}
  private file(id: string, revision: string) {
    return join(this.root, idSchema.parse(id), `${idSchema.parse(revision)}.json`);
  }
  async save(input: Lesson): Promise<Lesson> {
    const lesson = await validateLesson(input);
    if (lesson.kind !== 'generated') throw new Error('Only generated lessons are stored');
    const payload = JSON.stringify(lesson);
    if (Buffer.byteLength(payload) > MAX_BYTES) throw new Error('Lesson storage limit exceeded');
    const file = this.file(lesson.id, lesson.revision);
    await mkdir(join(this.root, lesson.id), { recursive: true, mode: 0o700 });
    await writeFile(file + '.pending', payload, { encoding: 'utf8', mode: 0o600 });
    await rename(file + '.pending', file);
    return lesson;
  }
  /** Unreadable or invalid files are left on disk untouched and counted, never shown. */
  async list(): Promise<{ lessons: Lesson[]; skipped: number }> {
    let dirs: string[];
    try { dirs = await readdir(this.root); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { lessons: [], skipped: 0 }; throw error; }
    const lessons: Lesson[] = []; let skipped = 0;
    for (const dir of dirs.filter(x => idSchema.safeParse(x).success)) {
      for (const name of (await readdir(join(this.root, dir)).catch(() => [])).filter(x => /^[a-z][a-z0-9-]{0,63}\.json$/.test(x))) {
        try {
          const raw = await readFile(join(this.root, dir, name), 'utf8');
          if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('oversized');
          const lesson = await validateLesson(JSON.parse(raw));
          if (lesson.kind !== 'generated' || lesson.id !== dir || `${lesson.revision}.json` !== name) throw new Error('misplaced');
          lessons.push(lesson);
        } catch { skipped++; }
      }
    }
    lessons.sort((a, b) => (b.generation?.createdAt ?? '').localeCompare(a.generation?.createdAt ?? ''));
    return { lessons, skipped };
  }
  async find(id: string, revision: string): Promise<Lesson | undefined> {
    try {
      const lesson = await validateLesson(JSON.parse(await readFile(this.file(id, revision), 'utf8')));
      return lesson.id === id && lesson.revision === revision ? lesson : undefined;
    } catch { return undefined; }
  }
}
