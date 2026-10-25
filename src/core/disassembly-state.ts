import { z } from 'zod';
import { allParts, type Disassembly, type Part } from './disassembly';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const disassemblyStateSchema = z.strictObject({
  schemaVersion: z.literal(1), disassemblyId: key, revision: key,
  /** Open sub-assemblies, from the whole down; empty at the top level. */
  path: z.array(key).max(2), selected: key.optional(),
  /** Per run: the scenario step reached (-1 before the first), the option chosen per step, the bricks already removed. */
  runs: z.record(key, z.strictObject({
    step: z.number().int().min(-1).max(11),
    choices: z.record(z.string().regex(/^(0|[1-9][0-9]?)$/), z.number().int().min(0).max(4)),
    tried: z.array(key).max(7),
  })),
  reassembly: z.strictObject({ placements: z.record(key, key), locked: z.array(key).max(12) }),
  notes: z.record(key, z.string().max(4000)),
});
export type DisassemblyState = z.infer<typeof disassemblyStateSchema>;
/** Codes, not sentences: the interface words them in the learner's language. */
export type StateNotice = 'invalid' | 'revision-changed' | 'references-changed';

export function initialDisassemblyState(d: Pick<Disassembly, 'id' | 'revision'>): DisassemblyState {
  return { schemaVersion: 1, disassemblyId: d.id, revision: d.revision, path: [], runs: {}, reassembly: { placements: {}, locked: [] }, notes: {} };
}
/** The parts shown at the open level: the whole's parts, or those of the last open sub-assembly. */
export function openLevel(d: Pick<Disassembly, 'parts'>, path: string[]): Part[] | undefined {
  let level: Part[] = d.parts;
  for (const id of path) {
    const next = level.find(p => p.id === id)?.parts;
    if (!next) return undefined;
    level = next;
  }
  return level;
}
const accepts = (slot: Disassembly['reassemble']['slots'][number]) => [slot.accepts].flat();

/** Every stored reference must still exist in this revision; otherwise nothing old is applied. */
function referencesHold(d: Disassembly, state: DisassemblyState): boolean {
  const level = openLevel(d, state.path);
  if (!level || (state.selected && !level.some(p => p.id === state.selected))) return false;
  const runs = Object.entries(state.runs).every(([id, progress]) => {
    const run = d.runs.find(r => r.id === id);
    if (!run) return false;
    const choices = Object.entries(progress.choices).map(([k, v]) => [Number(k), v] as const);
    if (run.type === 'scenario') {
      return progress.step < run.steps.length && !progress.tried.length
        && choices.every(([k, v]) => k < run.steps.length && v < (run.steps[k].predict?.options.length ?? 0));
    }
    if (progress.step > 0) return false;
    if (run.type === 'load') return !choices.length && progress.tried.every(x => run.bricks.some(b => b.part === x));
    return !progress.tried.length && choices.every(([k, v]) => k === 0 && v < run.options.length);
  });
  const slots = new Map(d.reassemble.slots.map(s => [s.id, s]));
  const placed = Object.values(state.reassembly.placements);
  const reassembly = new Set(placed).size === placed.length
    && Object.entries(state.reassembly.placements).every(([slot, part]) => slots.has(slot) && d.reassemble.slots.some(s => accepts(s).includes(part)))
    && state.reassembly.locked.every(slot => slots.has(slot) && accepts(slots.get(slot)!).includes(state.reassembly.placements[slot]));
  const parts = new Set(allParts(d).map(x => x.part.id));
  return runs && reassembly && Object.keys(state.notes).every(id => parts.has(id));
}

export type RestoredDisassemblyState = { state: DisassemblyState; notice?: StateNotice };
/** As for lessons: a revision change or a dangling reference restarts, and the store keeps the old file. */
export function restoreDisassemblyState(d: Disassembly, input: unknown): RestoredDisassemblyState {
  if (input == null) return { state: initialDisassemblyState(d) };
  const reset = (notice: StateNotice) => ({ state: initialDisassemblyState(d), notice });
  const parsed = disassemblyStateSchema.safeParse(input);
  if (!parsed.success) return reset('invalid');
  if (parsed.data.disassemblyId !== d.id || parsed.data.revision !== d.revision) return reset('revision-changed');
  if (!referencesHold(d, parsed.data)) return reset('references-changed');
  return { state: parsed.data };
}
