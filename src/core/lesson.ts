import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const id = idSchema;
const text = z.string().min(1).max(2000);
const short = z.string().min(1).max(200);
export const iconSchema = z.enum(['route', 'inbox', 'shield', 'database', 'send', 'thermometer', 'target', 'gauge', 'flame', 'loop', 'eye', 'lightbulb', 'warning', 'check', 'layers', 'code', 'book', 'compare', 'puzzle']);
const tone = z.enum(['green', 'blue', 'amber', 'purple']);
const point = z.strictObject({ icon: iconSchema, text });
const points = z.array(point).min(1).max(6);
const refs = z.array(id).min(1).max(12);
export const sourceOriginSchema = z.enum(['original-prepared', 'user-pasted', 'user-file']);
export const sourceSchema = z.strictObject({
  id, title: short, origin: sourceOriginSchema, revision: id,
  text: z.string().min(1).max(100_000), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  language: z.string().max(30).optional(),
});
export const evidenceSchema = z.strictObject({ id, sourceId: id, startLine: z.number().int().positive(), endLine: z.number().int().positive(), quote: z.string().min(1).max(20_000), highlights: z.array(z.number().int().positive()).max(100) });
const node = z.strictObject({ id, title: short, icon: iconSchema, tone, summary: short, points, evidenceIds: refs });
const map = z.strictObject({ type: z.literal('map'), id, title: short, nodes: z.array(node).min(2).max(6), edges: z.array(z.strictObject({ from: id, to: id, label: short })).min(1).max(10) });
const sequence = z.strictObject({ type: z.literal('sequence'), id, title: short, mapId: id, caveat: text,
  frames: z.array(z.strictObject({ id, title: short, icon: iconSchema, activeNodeId: id, before: short, action: short, after: short, points, evidenceIds: refs })).min(2).max(12),
});
const comparison = z.strictObject({ type: z.literal('comparison'), id, title: short, leftTitle: short, rightTitle: short,
  rows: z.array(z.strictObject({ label: short, left: text, right: text })).min(2).max(5), evidenceIds: refs,
});
const lens = z.strictObject({ type: z.literal('lens'), id, title: short, what: text, why: text, how: text, risk: text, evidenceIds: refs });
const excerpt = z.strictObject({ type: z.literal('source'), id, title: short, evidenceIds: refs });
const activityBlock = z.strictObject({ type: z.literal('activity'), id, activityId: id });
const reflection = z.strictObject({ type: z.literal('reflection'), id, prompt: text, reference: points, evidenceIds: refs });
export const blockSchema = z.discriminatedUnion('type', [map, sequence, comparison, lens, excerpt, activityBlock, reflection]);
const choice = z.strictObject({ type: z.literal('choice'), id, title: short, prompt: text,
  options: z.array(z.strictObject({ id, label: text, feedback: text })).min(2).max(5), correctId: id, evidenceIds: refs,
});
const order = z.strictObject({ type: z.literal('order'), id, title: short, prompt: text,
  items: z.array(z.strictObject({ id, label: short })).min(3).max(6), solution: z.array(id).min(3).max(6),
  success: text, retry: text, evidenceIds: refs,
});
export const activitySchema = z.discriminatedUnion('type', [choice, order]);
export const conceptSchema = z.strictObject({ id, title: short, icon: iconSchema, definition: text, pageId: id, evidenceIds: refs });
export const pageSchema = z.strictObject({ id, title: short, eyebrow: short, icon: iconSchema, intro: text, blocks: z.array(blockSchema).min(1).max(5), checkpoint: id.optional() });
export const lessonSchema = z.strictObject({
  schemaVersion: z.literal(1), id, revision: id, kind: z.enum(['prepared', 'generated']),
  generation: z.strictObject({ provider: z.literal('chatgpt'), model: short, createdAt: z.iso.datetime() }).optional(),
  title: short, subtitle: text, category: short, icon: iconSchema,
  goal: z.strictObject({ outcome: text, priorKnowledge: short }),
  sources: z.array(sourceSchema).min(1).max(12), evidence: z.array(evidenceSchema).min(1).max(200),
  concepts: z.array(conceptSchema).min(1).max(40),
  pages: z.array(pageSchema).min(2).max(30),
  activities: z.array(activitySchema).max(30),
});
export type Lesson = z.infer<typeof lessonSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type IconName = z.infer<typeof iconSchema>;
export type Point = z.infer<typeof point>;

export class LessonError extends Error {
  constructor(public readonly issues: string[]) { super(issues.join('\n')); this.name = 'LessonError'; }
}
export async function hashText(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export function sourceExcerpt(lesson: Lesson, refId: string) {
  const ref = lesson.evidence.find(x => x.id === refId);
  if (!ref) throw new LessonError([`Unknown evidence: ${refId}`]);
  const source = lesson.sources.find(x => x.id === ref.sourceId)!;
  return { source, ref, lines: source.text.split('\n').slice(ref.startLine - 1, ref.endLine) };
}

/** Only this boundary accepts unknown packages. Structure is necessary, not proof of truth. */
export async function validateLesson(input: unknown): Promise<Lesson> {
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) throw new LessonError(parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`));
  const lesson = parsed.data;
  const issues: string[] = [];
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) issues.push(`Duplicate ${label}`); };
  unique(lesson.sources.map(x => x.id), 'source'); unique(lesson.evidence.map(x => x.id), 'evidence');
  unique(lesson.pages.map(x => x.id), 'page'); unique(lesson.activities.map(x => x.id), 'activity');
  unique(lesson.concepts.map(x => x.id), 'concept');
  const blocks = lesson.pages.flatMap(p => p.blocks);
  unique(blocks.map(x => x.id), 'block');
  if ((lesson.kind === 'generated') !== !!lesson.generation) issues.push('Generation metadata must match the lesson kind');
  for (const source of lesson.sources) {
    if ((source.origin === 'original-prepared') !== (lesson.kind === 'prepared')) issues.push(`Source origin does not match the lesson kind: ${source.id}`);
    if (source.text.includes('\r') || source.sha256 !== await hashText(source.text)) issues.push(`Source revision/hash mismatch: ${source.id}`);
  }
  for (const ref of lesson.evidence) {
    const source = lesson.sources.find(x => x.id === ref.sourceId);
    if (!source) { issues.push(`Missing source: ${ref.id}`); continue; }
    const lines = source.text.split('\n');
    if (ref.startLine > ref.endLine || ref.endLine > lines.length) issues.push(`Out-of-range span: ${ref.id}`);
    else if (lines.slice(ref.startLine - 1, ref.endLine).join('\n') !== ref.quote) issues.push(`Inexact excerpt: ${ref.id}`);
    if (ref.highlights.some(x => x < ref.startLine || x > ref.endLine)) issues.push(`Out-of-range highlight: ${ref.id}`);
  }
  const checkRefs = (values: string[], owner: string) => {
    for (const value of values) if (!lesson.evidence.some(x => x.id === value)) issues.push(`Missing evidence ${value}: ${owner}`);
  };
  const renderedActivities = new Set<string>();
  for (const block of blocks) {
    if ('evidenceIds' in block) checkRefs(block.evidenceIds, block.id);
    if (block.type === 'map') {
      unique(block.nodes.map(x => x.id), `nodes in ${block.id}`);
      block.nodes.forEach(x => checkRefs(x.evidenceIds, x.id));
      for (const edge of block.edges) if (![edge.from, edge.to].every(id => block.nodes.some(n => n.id === id))) issues.push(`Dangling map edge: ${block.id}`);
    }
    if (block.type === 'sequence') {
      const map = blocks.find(x => x.id === block.mapId && x.type === 'map');
      unique(block.frames.map(x => x.id), `frames in ${block.id}`);
      for (const frame of block.frames) {
        checkRefs(frame.evidenceIds, frame.id);
        if (!map || map.type !== 'map' || !map.nodes.some(x => x.id === frame.activeNodeId)) issues.push(`Dangling frame node/map: ${frame.id}`);
      }
    }
    if (block.type === 'activity') {
      if (!lesson.activities.some(x => x.id === block.activityId)) issues.push(`Missing activity: ${block.id}`);
      renderedActivities.add(block.activityId);
    }
  }
  for (const page of lesson.pages) if (page.checkpoint && !page.blocks.some(b => b.type === 'activity' && b.activityId === page.checkpoint)) issues.push(`Unreachable checkpoint: ${page.id}`);
  for (const concept of lesson.concepts) {
    checkRefs(concept.evidenceIds, concept.id);
    if (!lesson.pages.some(x => x.id === concept.pageId)) issues.push(`Missing concept page: ${concept.id}`);
  }
  for (const activity of lesson.activities) {
    checkRefs(activity.evidenceIds, activity.id);
    if (!renderedActivities.has(activity.id)) issues.push(`Unreachable activity: ${activity.id}`);
    if (activity.type === 'choice') {
      unique(activity.options.map(x => x.id), `options in ${activity.id}`);
      if (!activity.options.some(x => x.id === activity.correctId)) issues.push(`Invalid choice solution: ${activity.id}`);
    } else {
      const ids = activity.items.map(x => x.id);
      unique(ids, `items in ${activity.id}`);
      if (activity.solution.length !== ids.length || new Set(activity.solution).size !== ids.length || activity.solution.some(x => !ids.includes(x))) issues.push(`Invalid order solution: ${activity.id}`);
      // The player starts from the listed order, so a list already in solution order would hand over the answer.
      else if (ids.every((x, i) => x === activity.solution[i])) issues.push(`Order activity starts solved: ${activity.id}`);
    }
  }
  if (issues.length) throw new LessonError(issues);
  return lesson;
}
