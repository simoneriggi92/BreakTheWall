import { z } from 'zod';
import type { Activity, Lesson } from './lesson';
import type { StateNotice } from './disassembly-state';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const stateSchema = z.strictObject({
  schemaVersion: z.literal(1), lessonId: key, revision: key, pageId: key,
  mode: z.enum(['guided', 'explore']), visited: z.array(key).max(30),
  frames: z.record(key, key), nodes: z.record(key, key), notes: z.record(key, z.string().max(4000)),
  reflections: z.record(key, z.string().max(4000)),
  attempts: z.array(z.strictObject({ activityId: key, answer: z.array(key).min(1).max(6) })).max(200),
});
export type LearnerState = z.infer<typeof stateSchema>;
export function initialState(lesson: Lesson): LearnerState {
  return { schemaVersion: 1, lessonId: lesson.id, revision: lesson.revision, pageId: lesson.pages[0].id, mode: 'guided', visited: [lesson.pages[0].id], frames: {}, nodes: {}, notes: {}, reflections: {}, attempts: [] };
}
export function evaluate(activity: Activity, answer: string[]): { correct: boolean; feedback: string } {
  if (activity.type === 'choice') {
    const selected = answer.length === 1 ? activity.options.find(x => x.id === answer[0]) : undefined;
    return { correct: !!selected && selected.id === activity.correctId, feedback: selected?.feedback ?? 'Scegli una delle risposte proposte.' };
  }
  if (answer.length !== activity.items.length || new Set(answer).size !== answer.length || answer.some(x => !activity.items.some(i => i.id === x))) return { correct: false, feedback: 'Inserisci ogni passaggio una sola volta.' };
  const correct = answer.every((x, i) => x === activity.solution[i]);
  const first = answer.findIndex((x, i) => x !== activity.solution[i]);
  return { correct, feedback: correct ? activity.success : `${activity.retry} Rivedi il passaggio ${first + 1}: «${activity.items.find(x => x.id === answer[first])!.label}».` };
}
export function solved(lesson: Lesson, state: LearnerState, activityId: string): boolean {
  const activity = lesson.activities.find(x => x.id === activityId);
  return !!activity && state.attempts.some(x => x.activityId === activityId && evaluate(activity, x.answer).correct);
}
export function canVisit(lesson: Lesson, state: LearnerState, pageId: string): boolean {
  const index = lesson.pages.findIndex(x => x.id === pageId);
  return index >= 0 && (state.mode === 'explore' || lesson.pages.slice(0, index).every(x => !x.checkpoint || solved(lesson, state, x.checkpoint)));
}
export function navigate(lesson: Lesson, state: LearnerState, pageId: string): LearnerState {
  if (!canVisit(lesson, state, pageId)) return state;
  return { ...state, pageId, visited: Array.from(new Set([...state.visited, pageId])) };
}
export function submit(lesson: Lesson, state: LearnerState, activityId: string, answer: string[]): LearnerState {
  const activity = lesson.activities.find(x => x.id === activityId);
  if (!activity) return state;
  const ids = activity.type === 'choice' ? activity.options.map(x => x.id) : activity.items.map(x => x.id);
  if (!answer.length || answer.some(x => !ids.includes(x))) return state;
  // Keep successful evidence when bounded history rolls over.
  const attempts = [...state.attempts, { activityId, answer }];
  if (attempts.length > 200) {
    const removable = attempts.findIndex((x, i) => !evaluate(lesson.activities.find(a => a.id === x.activityId)!, x.answer).correct || attempts.slice(i + 1).some(a => a.activityId === x.activityId && evaluate(lesson.activities.find(b => b.id === a.activityId)!, a.answer).correct));
    attempts.splice(Math.max(0, removable), 1);
  }
  return { ...state, attempts };
}
/** `notice` keeps the Italian sentence; `noticeCode` lets the interface word it in either language. */
export type RestoredState = { state: LearnerState; notice?: string; noticeCode?: StateNotice };
/** A revision change preserves notes in the stored old file; never silently applies old answers. */
export function restoreState(lesson: Lesson, input: unknown): RestoredState {
  if (input == null) return { state: initialState(lesson) };
  const parsed = stateSchema.safeParse(input);
  const reset = (notice: string, noticeCode: StateNotice) => ({ state: initialState(lesson), notice, noticeCode });
  if (!parsed.success) return reset('I progressi salvati non sono validi. La copia su disco è stata conservata; questa sessione riparte dall’inizio.', 'invalid');
  const state = parsed.data;
  if (state.lessonId !== lesson.id || state.revision !== lesson.revision) return reset('La lezione è cambiata. I progressi della revisione precedente sono conservati separatamente; questa revisione riparte dall’inizio.', 'revision-changed');
  const blocks = lesson.pages.flatMap(x => x.blocks);
  const pageExists = (id: string) => lesson.pages.some(p => p.id === id);
  const valid = pageExists(state.pageId) && state.visited.every(pageExists)
    && Object.keys(state.notes).every(pageExists)
    && Object.entries(state.frames).every(([id, frame]) => blocks.some(x => x.type === 'sequence' && x.id === id && x.frames.some(f => f.id === frame)))
    && Object.entries(state.nodes).every(([id, node]) => blocks.some(x => x.type === 'map' && x.id === id && x.nodes.some(n => n.id === node)))
    && Object.keys(state.reflections).every(id => blocks.some(x => x.id === id && x.type === 'reflection'))
    && state.attempts.every(x => { const a = lesson.activities.find(a => a.id === x.activityId); const ids = a?.type === 'choice' ? a.options.map(x => x.id) : a?.items.map(x => x.id); return ids && x.answer.every(id => ids.includes(id)) && (a?.type === 'choice' ? x.answer.length === 1 : x.answer.length === ids.length && new Set(x.answer).size === ids.length); });
  if (!valid || !canVisit(lesson, state, state.pageId)) return reset('I riferimenti dei progressi non corrispondono alla lezione. Copia conservata; sessione riavviata.', 'references-changed');
  return { state };
}
