import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { idSchema } from '../core/lesson';
import { setupSchema, type DraftState, type DraftSummary, type GenerationStats } from '../core/provider';
import { SOURCE_LIMITS } from '../core/source';

const phaseStats = z.strictObject({ requests: z.number().int().min(0), repairs: z.number().int().min(0), shortens: z.number().int().min(0).optional(), sentChars: z.number().min(0), receivedChars: z.number().min(0), ms: z.number().min(0) });
/**
 * What a failed or cancelled generation kept (D21): the request it answers, and each accepted step. The steps stay
 * `unknown` here: resuming accepts them again against the current sources, as if the model had just sent them.
 */
const keptSchema = z.strictObject({
  version: z.literal(1),
  sources: z.array(z.strictObject({ id: idSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(SOURCE_LIMITS.maxSources),
  question: z.string().max(400), language: z.enum(['it', 'en']), setup: setupSchema,
  meta: z.strictObject({ id: idSchema, createdAt: z.string().max(40) }),
  structure: z.unknown(), contents: z.array(z.unknown()).max(7), runs: z.unknown(),
  stats: z.strictObject({ structure: phaseStats, content: phaseStats, runs: phaseStats }),
});
export type KeptDraft = Omit<z.infer<typeof keptSchema>, 'stats'> & { stats: GenerationStats };
const MAX_BYTES = 2_000_000;

/** What the renderer may see of a draft: its request and how much was kept, never its text beyond the title. */
export function summarize(draft: KeptDraft): DraftSummary {
  const structure = draft.structure as { title?: unknown; parts?: unknown } | null;
  const title = typeof structure?.title === 'string' ? structure.title.slice(0, 200) : undefined;
  return {
    sources: draft.sources, question: draft.question, language: draft.language, ...(title ? { title } : {}),
    parts: Array.isArray(structure?.parts) ? structure.parts.length : 0, kept: draft.contents.filter(x => x !== null).length, runs: draft.runs !== null,
  };
}

/**
 * At most one draft, `generation-draft.json` in the app's data folder, written atomically. It is deleted on success, on
 * "Start over" and when a new generation starts. A file that cannot be read is moved aside, never shown or resumed.
 */
export class DraftStore {
  constructor(private file: string) {}
  async read(): Promise<{ draft?: KeptDraft; setAside: boolean }> {
    let raw: string;
    try { raw = await readFile(this.file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { setAside: false }; return this.setAside(); }
    try {
      if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('oversized');
      return { draft: keptSchema.parse(JSON.parse(raw)) as KeptDraft, setAside: false };
    } catch { return this.setAside(); }
  }
  async state(): Promise<DraftState> {
    const { draft, setAside } = await this.read();
    return { draft: draft ? summarize(draft) : null, ...(setAside ? { setAside } : {}) };
  }
  async write(draft: KeptDraft): Promise<void> {
    const payload = JSON.stringify(keptSchema.parse(draft));
    await writeFile(this.file + '.pending', payload, { encoding: 'utf8', mode: 0o600 });
    await rename(this.file + '.pending', this.file);
  }
  async clear(): Promise<void> { await rm(this.file, { force: true }); }
  /** One file set aside at most: a later unreadable draft replaces it. */
  private async setAside(): Promise<{ setAside: true }> {
    await rename(this.file, this.file.replace(/\.json$/, '.unreadable.json')).catch(() => rm(this.file, { force: true }));
    return { setAside: true };
  }
}
