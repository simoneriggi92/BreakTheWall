import { z } from 'zod';
import { allParts, isExpansionOf, type Disassembly, type Part } from './disassembly';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const disassemblyStateSchema = z.strictObject({
  schemaVersion: z.literal(1), disassemblyId: key, revision: key,
  /**
   * Open sub-assemblies, from the whole down; empty at the top level. The bound only limits what a file can hold:
   * every level cites fewer lines than the one above, so real depth stays far below it.
   */
  path: z.array(key).max(32), selected: key.optional(),
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

/**
 * Progress moves to a revision that only took one part apart: every reference still holds. The learner lands inside
 * the part just taken apart. Any other change returns undefined, and the D3 rules apply.
 */
export function carryOver(previous: Disassembly, next: Disassembly, state: DisassemblyState): DisassemblyState | undefined {
  const part = isExpansionOf(next, previous);
  if (!part || restoreDisassemblyState(previous, state).notice) return undefined;
  const ancestors = (parts: Part[], trail: string[]): string[] | undefined => {
    for (const p of parts) {
      if (p.id === part) return [...trail, p.id];
      const inner = p.parts && ancestors(p.parts, [...trail, p.id]);
      if (inner) return inner;
    }
    return undefined;
  };
  const moved: DisassemblyState = { ...state, revision: next.revision, path: ancestors(next.parts, []) ?? state.path, selected: undefined };
  return restoreDisassemblyState(next, moved).notice ? undefined : moved;
}

// ---------- Transitions: pure, so the player only draws what they return ----------

type RunProgress = DisassemblyState['runs'][string];
const progressOf = (state: DisassemblyState, runId: string): RunProgress => state.runs[runId] ?? { step: -1, choices: {}, tried: [] };
const withRun = (state: DisassemblyState, runId: string, next: RunProgress): DisassemblyState => ({ ...state, runs: { ...state.runs, [runId]: next } });
type Scenario = Extract<Disassembly['runs'][number], { type: 'scenario' }>;

/** Opens a level: the path changes and the selection resets, since parts belong to one level. */
export function openPath(d: Disassembly, state: DisassemblyState, path: string[]): DisassemblyState {
  return openLevel(d, path) ? { ...state, path, selected: undefined } : state;
}
export function selectPart(d: Disassembly, state: DisassemblyState, id: string | undefined): DisassemblyState {
  if (id !== undefined && !openLevel(d, state.path)?.some(p => p.id === id)) return state;
  return { ...state, selected: id };
}
/** A prediction is recorded once per step: a second answer would hide the first one. */
export function predict(d: Disassembly, state: DisassemblyState, runId: string, step: number, option: number): DisassemblyState {
  const run = d.runs.find(r => r.id === runId);
  const progress = progressOf(state, runId);
  if (run?.type !== 'scenario' || step !== progress.step + 1 || !run.steps[step]?.predict || option >= run.steps[step].predict!.options.length || String(step) in progress.choices) return state;
  return withRun(state, runId, { ...progress, choices: { ...progress.choices, [step]: option } });
}
/** Executes the next step; a step with a prediction runs only after the learner has predicted. */
export function execute(d: Disassembly, state: DisassemblyState, runId: string): DisassemblyState {
  const run = d.runs.find(r => r.id === runId);
  const progress = progressOf(state, runId);
  const next = progress.step + 1;
  if (run?.type !== 'scenario' || next >= run.steps.length || (run.steps[next].predict && !(String(next) in progress.choices))) return state;
  return withRun(state, runId, { ...progress, step: next });
}
export function restartRun(state: DisassemblyState, runId: string): DisassemblyState {
  const runs = { ...state.runs }; delete runs[runId];
  return { ...state, runs };
}
/** What the drawing shows after the executed steps: states and instruments accumulate, flows belong to the last step. */
export function scenarioView(run: Scenario, progress: RunProgress | undefined) {
  const done = run.steps.slice(0, (progress?.step ?? -1) + 1);
  const states: Record<string, string> = {}; const vars: Record<string, string> = { ...run.vars };
  for (const step of done) { Object.assign(states, step.effect); Object.assign(vars, step.vars); }
  const last = done.at(-1);
  return { states, vars, flow: last?.flow ?? [], changed: new Set(Object.keys(last?.vars ?? {})), last };
}
/** Removing a brick tests it; every brick can be tried, in any order. */
export function removeBrick(d: Disassembly, state: DisassemblyState, runId: string, part: string): DisassemblyState {
  const run = d.runs.find(r => r.id === runId);
  const progress = progressOf(state, runId);
  if (run?.type !== 'load' || !run.bricks.some(b => b.part === part)) return state;
  return withRun(state, runId, { ...progress, step: 0, tried: [...progress.tried.filter(x => x !== part), part] });
}
export function answerCase(d: Disassembly, state: DisassemblyState, runId: string, option: number): DisassemblyState {
  const run = d.runs.find(r => r.id === runId);
  if (run?.type !== 'case' || option >= run.options.length) return state;
  return withRun(state, runId, { step: 0, choices: { 0: option }, tried: [] });
}

/** A part goes to one slot at a time; locked slots keep their part. */
export function place(d: Disassembly, state: DisassemblyState, slot: string, part: string | undefined): DisassemblyState {
  const { placements, locked } = state.reassembly;
  if (!d.reassemble.slots.some(s => s.id === slot) || locked.includes(slot)) return state;
  if (part !== undefined && (!d.parts.some(p => p.id === part) || Object.entries(placements).some(([s, p]) => p === part && locked.includes(s)))) return state;
  const next = Object.fromEntries(Object.entries(placements).filter(([s, p]) => s !== slot && p !== part));
  if (part !== undefined) next[slot] = part;
  return { ...state, reassembly: { placements: next, locked } };
}
export function clearReassembly(state: DisassemblyState): DisassemblyState {
  return { ...state, reassembly: { placements: {}, locked: [] } };
}
/**
 * Checks the placed parts in slot order: correct ones lock, and the first misplaced part is named with its hint.
 * An empty slot is not an error: the learner may check while still working.
 */
export function checkReassembly(d: Disassembly, state: DisassemblyState): { state: DisassemblyState; wrong?: { slot: string; part: string; hint: string }; complete: boolean } {
  const { placements } = state.reassembly;
  const locked = new Set(state.reassembly.locked);
  let wrong: { slot: string; part: string; hint: string } | undefined;
  for (const slot of d.reassemble.slots) {
    const part = placements[slot.id];
    if (!part) continue;
    if (accepts(slot).includes(part)) locked.add(slot.id);
    else wrong ??= { slot: slot.id, part, hint: d.reassemble.hints[part] ?? '' };
  }
  const next = { ...state, reassembly: { placements, locked: d.reassemble.slots.map(s => s.id).filter(id => locked.has(id)) } };
  return { state: next, wrong, complete: next.reassembly.locked.length === d.reassemble.slots.length };
}
/**
 * The tray order: deterministic, so tests and reloads agree, and never the solution order,
 * which would hand over the answer.
 */
export function trayOrder(d: Disassembly): string[] {
  const solution = d.reassemble.slots.flatMap(s => [s.accepts].flat()).filter((x, i, all) => all.indexOf(x) === i);
  const score = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
  const order = [...solution].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  return order.every((x, i) => x === solution[i]) ? [...order.slice(1), order[0]] : order;
}
