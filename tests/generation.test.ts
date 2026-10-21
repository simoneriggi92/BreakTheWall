import { describe, expect, it } from 'vitest';
import { assembleLesson, draftJsonSchema, type LessonDraft } from '../src/core/generation';
import { LessonError, type Lesson } from '../src/core/lesson';
import { draftFor, SOURCE_TEXT, userSource } from './draft';

const goal = { outcome: 'Spiegare il ciclo dell’acqua', priorKnowledge: '' };
const meta = { id: 'g-test', model: 'test-model', createdAt: '2026-10-21T17:00:00.000Z' };
async function assemble(edit: (d: LessonDraft) => unknown = d => d): Promise<Lesson> {
  const source = await userSource();
  return assembleLesson(JSON.stringify(edit(draftFor(source.id))), [source], goal, meta);
}
async function issues(raw: string | ((d: LessonDraft) => unknown)): Promise<string[]> {
  const source = await userSource();
  try {
    await assembleLesson(typeof raw === 'string' ? raw : JSON.stringify(raw(draftFor(source.id))), [source], goal, meta);
    return [];
  } catch (error) { expect(error).toBeInstanceOf(LessonError); return (error as LessonError).issues; }
}

describe('generated lesson assembly (T6)', () => {
  it('turns a valid draft into a generated lesson whose quotes are copied from the source lines', async () => {
    const lesson = await assemble();
    expect(lesson).toMatchObject({ kind: 'generated', revision: 'v1', generation: { provider: 'chatgpt', model: 'test-model' }, goal: { priorKnowledge: 'Non indicate' } });
    expect(lesson.sources[0].text).toBe(SOURCE_TEXT);
    expect(lesson.evidence.find(x => x.id === 'rain')!.quote).toBe(SOURCE_TEXT.split('\n').slice(3, 6).join('\n'));
    expect(lesson.pages[0].checkpoint).toBe('predict');
    expect('checkpoint' in lesson.pages[1]).toBe(false);
  });

  it('fails visibly on incomplete, malformed or unsupported output', async () => {
    const full = JSON.stringify(draftFor('x'));
    expect(await issues(full.slice(0, full.length / 2))).toEqual(['La risposta non è JSON completo.']);
    expect(await issues(d => ({ ...d, pages: d.pages.map(p => ({ ...p, blocks: [{ type: 'video', id: 'v', url: 'https://example.com' }] })) }))).not.toEqual([]);
    expect(await issues(d => ({ ...d, extra: '<script>alert(1)</script>' }))).not.toEqual([]);
  });

  it('rejects citations that do not resolve to the source', async () => {
    expect(await issues(d => ({ ...d, evidence: d.evidence.map(e => e.id === 'rain' ? { ...e, endLine: 99 } : e) }))).toContain('Out-of-range span: rain');
    expect(await issues(d => ({ ...d, evidence: d.evidence.map(e => e.id === 'heat' ? { ...e, sourceId: 'src-unknown' } : e) }))).toContain('Missing source: heat');
    expect(await issues(d => ({ ...d, evidence: d.evidence.map(e => e.id === 'limit' ? { ...e, highlights: [2] } : e) }))).toContain('Out-of-range highlight: limit');
  });

  it('rejects broken relationships and unusable activities', async () => {
    expect(await issues(d => { d.pages[1].blocks[0] = { ...d.pages[1].blocks[0], mapId: 'nope' } as never; return d; })).toEqual(expect.arrayContaining([expect.stringMatching(/Dangling frame node\/map/)]));
    expect(await issues(d => ({ ...d, activities: d.activities.map(a => a.type === 'choice' ? { ...a, correctId: 'missing' } : a) }))).toContain('Invalid choice solution: predict');
    expect(await issues(d => ({ ...d, pages: d.pages.map(p => ({ ...p, checkpoint: p.id === 'flow-page' ? 'predict' : p.checkpoint })) }))).toContain('Unreachable checkpoint: flow-page');
  });

  it('requires a route with a map and varied representations, not just valid JSON', async () => {
    const noMap = await issues(d => ({ ...d, pages: d.pages.map(p => ({ ...p, blocks: p.blocks.filter(b => b.type !== 'map' && b.type !== 'sequence') })) }));
    expect(noMap).toContain('Manca una mappa del concetto.');
  });

  it('sends a JSON Schema in the strict structured-output subset', () => {
    const allowed = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'anyOf', 'pattern', 'minItems', 'maxItems', 'minimum', 'description']);
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      const object = node as Record<string, unknown>;
      for (const key of Object.keys(object)) expect(allowed).toContain(key);
      if (object.type === 'object') {
        expect(object.additionalProperties).toBe(false);
        expect([...(object.required as string[])].sort()).toEqual(Object.keys(object.properties as object).sort());
      }
      for (const [key, value] of Object.entries(object)) if (key === 'properties') Object.values(value as object).forEach(visit); else visit(value);
    };
    visit(draftJsonSchema);
    expect(JSON.stringify(draftJsonSchema)).toContain('"anyOf"');
  });
});
