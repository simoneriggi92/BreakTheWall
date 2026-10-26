import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { progressKeySchema, type ProgressKey, type ProgressResult, type ProgressState } from '../core/bridge';
import type { Disassembly } from '../core/disassembly';
import { carryOver, disassemblyStateSchema, restoreDisassemblyState } from '../core/disassembly-state';
import type { Lesson } from '../core/lesson';
import { restoreState, stateSchema } from '../core/state';

type LessonKey = Extract<ProgressKey, { lessonId: string }>;
type DisassemblyKey = Extract<ProgressKey, { disassemblyId: string }>;
type Lookup<K, T> = T[] | ((key: K) => Promise<T | undefined>);
const lookup = <K extends { revision: string }, T extends { id: string; revision: string }>(source: Lookup<K, T>, id: (key: K) => string) =>
  Array.isArray(source) ? async (key: K) => source.find(x => x.id === id(key) && x.revision === key.revision) : source;
/** Disassembly progress lives apart from lesson folders; ids start with a letter, so the folder cannot clash. */
const DISASSEMBLIES = '_disassemblies';

/** The host chooses all paths. Writes are serialized, bounded, and replaced atomically. */
export class ProgressStore {
  private queue: Promise<void> = Promise.resolve();
  private lessons: (key: LessonKey) => Promise<Lesson | undefined>;
  private disassemblies: (key: DisassemblyKey) => Promise<Disassembly | undefined>;
  /** Lessons and disassemblies come from a fixed list (prepared examples) or a lookup that also covers saved ones. */
  constructor(private root: string, lessons: Lookup<LessonKey, Lesson>, disassemblies: Lookup<DisassemblyKey, Disassembly> = []) {
    this.lessons = lookup(lessons, key => key.lessonId);
    this.disassemblies = lookup(disassemblies, key => key.disassemblyId);
  }
  private async resolve(key: ProgressKey) {
    const safe = progressKeySchema.parse(key);
    if ('lessonId' in safe) {
      const lesson = await this.lessons(safe);
      if (!lesson) throw new Error('Unknown lesson revision');
      const dir = join(this.root, lesson.id);
      return { kind: 'lesson' as const, lesson, dir, file: join(dir, lesson.revision + '.json') };
    }
    const disassembly = await this.disassemblies(safe);
    if (!disassembly) throw new Error('Unknown disassembly revision');
    const dir = join(this.root, DISASSEMBLIES, disassembly.id);
    return { kind: 'disassembly' as const, disassembly, dir, file: join(dir, disassembly.revision + '.json') };
  }
  async load(key: ProgressKey): Promise<ProgressResult> {
    await this.queue;
    const target = await this.resolve(key);
    const { file } = target;
    let raw: string;
    try { raw = await readFile(file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: null }; throw error; }
    let parsed: unknown;
    try { if (Buffer.byteLength(raw) > 300_000) throw new Error('Oversized progress'); parsed = JSON.parse(raw); }
    catch { parsed = undefined; }
    const preserve = async (result: Omit<ProgressResult, 'state'>): Promise<ProgressResult> => {
      await copyFile(file, file + '.preserved-' + crypto.randomUUID());
      return { state: null, ...result };
    };
    if (target.kind === 'disassembly') {
      if (parsed == null) return preserve({ noticeCode: 'unreadable' });
      const restored = restoreDisassemblyState(target.disassembly, parsed);
      return restored.notice ? preserve({ noticeCode: restored.notice }) : { state: restored.state };
    }
    if (parsed === undefined) return preserve({ notice: 'Il file dei progressi non è leggibile. Una copia è stata conservata; questa sessione riparte dall’inizio.', noticeCode: 'unreadable' });
    if (parsed === null) return preserve({ notice: 'File vuoto conservato; sessione riavviata.', noticeCode: 'empty' });
    const restored = restoreState(target.lesson, parsed);
    if (restored.notice) return preserve({ notice: restored.notice, noticeCode: restored.noticeCode });
    return { state: restored.state };
  }
  /**
   * After a part is taken apart, the learner state follows to the new revision. The old file stays, as on any revision
   * change. Without saved progress, or when the change is not an expansion, nothing is written.
   */
  carry(previous: Disassembly, next: Disassembly): Promise<boolean> {
    const task = this.queue.catch(() => {}).then(async () => {
      const dir = join(this.root, DISASSEMBLIES, previous.id);
      let saved: unknown;
      try { saved = JSON.parse(await readFile(join(dir, previous.revision + '.json'), 'utf8')); }
      catch { return false; }
      const parsed = disassemblyStateSchema.safeParse(saved);
      const moved = parsed.success ? carryOver(previous, next, parsed.data) : undefined;
      if (!moved) return false;
      const file = join(dir, next.revision + '.json');
      await writeFile(file + '.pending', JSON.stringify(moved), { encoding: 'utf8', mode: 0o600 });
      await rename(file + '.pending', file);
      return true;
    });
    this.queue = task.then(() => {});
    return task;
  }
  /** Resolution, checks and the write all run inside the queue, so saves land in call order. */
  save(input: ProgressState): Promise<void> {
    const state = 'disassemblyId' in input ? disassemblyStateSchema.parse(input) : stateSchema.parse(input);
    const task = this.queue.catch(() => {}).then(async () => {
      const target = await this.resolve('disassemblyId' in state ? { disassemblyId: state.disassemblyId, revision: state.revision } : { lessonId: state.lessonId, revision: state.revision });
      const notice = target.kind === 'lesson' ? restoreState(target.lesson, state).notice : restoreDisassemblyState(target.disassembly, state).notice;
      if (notice) throw new Error('Invalid learner references');
      const payload = JSON.stringify(state);
      if (Buffer.byteLength(payload) > 300_000) throw new Error('Progress storage limit exceeded');
      await mkdir(target.dir, { recursive: true });
      const temp = target.file + '.pending';
      await writeFile(temp, payload, { encoding: 'utf8', mode: 0o600 });
      await rename(temp, target.file);
    });
    this.queue = task;
    return task;
  }
}
