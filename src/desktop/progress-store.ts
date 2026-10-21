import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { progressKeySchema, type ProgressKey, type ProgressResult } from '../core/bridge';
import type { Lesson } from '../core/lesson';
import { restoreState, stateSchema, type LearnerState } from '../core/state';

/** The host chooses all paths. Writes are serialized, bounded, and replaced atomically. */
export class ProgressStore {
  private queue: Promise<void> = Promise.resolve();
  constructor(private root: string, private lessons: Lesson[]) {}
  private resolve(key: ProgressKey) {
    const safe = progressKeySchema.parse(key);
    const lesson = this.lessons.find(x => x.id === safe.lessonId && x.revision === safe.revision);
    if (!lesson) throw new Error('Unknown prepared lesson revision');
    return { lesson, dir: join(this.root, lesson.id), file: join(this.root, lesson.id, lesson.revision + '.json') };
  }
  async load(key: ProgressKey): Promise<ProgressResult> {
    await this.queue;
    const { file, lesson } = this.resolve(key);
    let raw: string;
    try { raw = await readFile(file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: null }; throw error; }
    let parsed: unknown;
    try { if (Buffer.byteLength(raw) > 300_000) throw new Error('Oversized progress'); parsed = JSON.parse(raw); }
    catch { parsed = undefined; }
    const preserve = async (notice: string): Promise<ProgressResult> => {
      await copyFile(file, file + '.preserved-' + crypto.randomUUID());
      return { state: null, notice };
    };
    if (parsed === undefined) return preserve('Il file dei progressi non è leggibile. Una copia è stata conservata; questa sessione riparte dall’inizio.');
    if (parsed === null) return preserve('File vuoto conservato; sessione riavviata.');
    const restored = restoreState(lesson, parsed);
    if (restored.notice) return preserve(restored.notice);
    return { state: restored.state };
  }
  save(input: LearnerState): Promise<void> {
    const state = stateSchema.parse(input);
    const { lesson, dir, file } = this.resolve({ lessonId: state.lessonId, revision: state.revision });
    if (restoreState(lesson, state).notice) throw new Error('Invalid learner references');
    const payload = JSON.stringify(state);
    if (Buffer.byteLength(payload) > 300_000) throw new Error('Progress storage limit exceeded');
    const task = this.queue.catch(() => {}).then(async () => {
      await mkdir(dir, { recursive: true });
      const temp = file + '.pending';
      await writeFile(temp, payload, { encoding: 'utf8', mode: 0o600 });
      await rename(temp, file);
    });
    this.queue = task;
    return task;
  }
}
