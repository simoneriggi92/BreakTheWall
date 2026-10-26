import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { defaultContentLanguage, type ContentLanguage } from '../src/core/disassembly-generation';
import { goalSchema, importSource, type LearningGoal, type UserSource } from '../src/core/source';

/**
 * A case is a question plus sources, stored as JSON next to its source files. Public cases live in the repository and
 * use only original, public-domain or repository-owned text. Private cases live in the ignored .local/eval/cases and
 * are never written anywhere else. `language` is the content language; without it, the question's.
 */
export const caseSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),
  title: z.string().min(1).max(120),
  goal: goalSchema,
  language: z.enum(['it', 'en']).optional(),
  sources: z.array(z.strictObject({ path: z.string().min(1), title: z.string().min(1).max(120), language: z.string().max(30).optional() })).min(1).max(4),
});
export interface EvalCase { id: string; title: string; goal: LearningGoal; language: ContentLanguage; sources: UserSource[]; private: boolean }

export const PUBLIC_CASES = 'eval/cases';
export const PRIVATE_CASES = '.local/eval/cases';

async function loadFolder(root: string, folder: string, isPrivate: boolean): Promise<EvalCase[]> {
  let names: string[];
  try { names = (await readdir(join(root, folder))).filter(x => x.endsWith('.json')).sort(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  return Promise.all(names.map(async name => {
    const file = join(root, folder, name);
    const spec = caseSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    // Sources are snapshots next to the case, so a case keeps measuring the same text as the code evolves.
    const sources = await Promise.all(spec.sources.map(async s => importSource({ kind: 'paste', title: s.title, text: await readFile(resolve(dirname(file), s.path), 'utf8'), language: s.language })));
    return { id: spec.id, title: spec.title, goal: spec.goal, language: spec.language ?? defaultContentLanguage(spec.goal.outcome, 'it'), sources, private: isPrivate };
  }));
}

export async function loadCases(root: string, { includePrivate }: { includePrivate: boolean }): Promise<EvalCase[]> {
  const cases = [...await loadFolder(root, PUBLIC_CASES, false), ...(includePrivate ? await loadFolder(root, PRIVATE_CASES, true) : [])];
  const ids = cases.map(c => c.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new Error(`Duplicate evaluation case id: ${duplicate}`);
  return cases;
}
