import { describe, expect, it } from 'vitest';
import { assembleLesson, detectLanguage, draftJsonSchema, estimateProgress, expectedDraftChars, type LessonDraft } from '../src/core/generation';
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
  it('turns a valid draft into a generated lesson: host ids, quotes copied from the cited lines, shared citations stored once', async () => {
    const lesson = await assemble();
    expect(lesson).toMatchObject({ kind: 'generated', revision: 'v1', generation: { provider: 'chatgpt', model: 'test-model' }, goal: { priorKnowledge: 'Non indicate' } });
    expect(lesson.sources[0].text).toBe(SOURCE_TEXT);
    expect(lesson.pages.map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(lesson.pages[0].title).toBe('Gli attori del ciclo');
    const rain = lesson.evidence.find(e => e.startLine === 4 && e.endLine === 6)!;
    expect(rain.quote).toBe(SOURCE_TEXT.split('\n').slice(3, 6).join('\n'));
    // Lines 4–6 are cited by a node, the choice, a frame and a concept: one evidence record.
    expect(lesson.evidence.filter(e => e.startLine === 4 && e.endLine === 6)).toHaveLength(1);
    expect(lesson.pages[0].checkpoint).toBe('a1');
    expect('checkpoint' in lesson.pages[1]).toBe(false);
    expect(lesson.concepts.map(c => c.pageId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('derives activity answers from the draft: one marked option, steps written in the correct order and shown rotated', async () => {
    const lesson = await assemble();
    const [choice, order] = lesson.activities;
    if (choice.type !== 'choice' || order.type !== 'order') throw new Error('expected a choice and an order');
    expect(choice.correctId).toBe('a1-o1');
    expect(choice.options.every(o => !('correct' in o))).toBe(true);
    expect(order.solution).toEqual(['a2-s1', 'a2-s2', 'a2-s3']);
    expect(order.items.map(i => i.label)).toEqual(['Condensazione', 'Pioggia', 'Evaporazione']);
  });

  it('locates every finding by page and block, all at once, so one repair can fix them', async () => {
    const found = await issues(d => {
      d.opening.prediction.options.forEach(o => { o.correct = true; });
      const lens = d.pages[1].main; if (lens.type === 'lens') lens.cites = [{ ...lens.cites[0], from: 7, to: 99 }];
      const seq = d.pages[0].main; if (seq.type === 'sequence') seq.frames[1].node = 'clouds';
      return d;
    });
    expect(found).toEqual(expect.arrayContaining([
      'Tappa 1, prediction: serve esattamente un’opzione con correct=true (ne ha 2).',
      'Tappa 3, main (lens): le righe 7-99 non esistono in «Appunti sul ciclo dell’acqua» (7 righe).',
      'Tappa 2, main (sequence), frame 2: node «clouds» non è una key della mappa «Il ciclo» (sea, vapor, cloud).',
    ]));
  });

  it('fails visibly on incomplete, malformed or unsupported output, and refuses unknown sources', async () => {
    const full = JSON.stringify(draftFor('x'));
    expect(await issues(full.slice(0, full.length / 2))).toEqual(['La risposta non è JSON completo.']);
    expect(await issues(d => ({ ...d, pages: d.pages.map(p => ({ ...p, main: { type: 'video', url: 'https://example.com' } })) }))).not.toEqual([]);
    expect(await issues(d => ({ ...d, extra: '<script>alert(1)</script>' }))).not.toEqual([]);
    expect((await issues(d => { const lens = d.pages[1].main; if (lens.type === 'lens') lens.cites[0].source = 'src-unknown'; return d; })).join()).toMatch(/source/);
  });

  it('drops only what a learner could never reach or see: stray edges, highlights outside the excerpt, concepts past the last page', async () => {
    const lesson = await assemble(d => {
      d.opening.map.edges.push({ from: 'sea', to: 'nowhere', label: 'perso' });
      const lens = d.pages[1].main; if (lens.type === 'lens') lens.cites[0].highlights = [2, 7];
      d.concepts.push({ ...d.concepts[0], title: 'Fantasma', page: 9 });
      return d;
    });
    const map = lesson.pages[0].blocks[0];
    expect(map.type === 'map' && map.edges.map(e => e.to)).toEqual(['vapor', 'cloud', 'sea']);
    expect(lesson.evidence.find(e => e.startLine === 7 && e.endLine === 7)!.highlights).toEqual([7]);
    expect(lesson.concepts.map(c => c.title)).not.toContain('Fantasma');
  });

  it('leaves out unusable optional additions and shows empty comparison cells as a dash, but keeps required parts strict', async () => {
    const lesson = await assemble(d => {
      d.pages[1].excerpt = { title: 'Troppo lunga', cites: [{ source: d.opening.map.nodes[0].cites[0].source, from: 1, to: 99, highlights: [] }] };
      d.pages[0].activity = { type: 'choice', gate: true, title: 'Senza risposta', prompt: 'p', options: [{ label: 'a', feedback: 'f', correct: false }, { label: 'b', feedback: 'f', correct: false }], cites: d.opening.prediction.cites };
      d.pages[1].main = { type: 'comparison', title: 'Confronto', leftTitle: 'Sole', rightTitle: 'Notte', rows: [{ label: 'Calore', left: 'alto', right: '' }, { label: 'Vapore', left: 'sale', right: 'poco' }], cites: d.pages[1].main.type === 'lens' ? d.pages[1].main.cites : [] };
      return d;
    });
    expect(lesson.pages[1].blocks.map(b => b.type)).toEqual(['sequence']);
    expect(lesson.pages[2].blocks.map(b => b.type)).toEqual(['comparison', 'activity']);
    const table = lesson.pages[2].blocks[0];
    expect(table.type === 'comparison' && table.rows[0].right).toBe('—');
    expect(await issues(d => { d.opening.prediction.options.forEach(o => { o.correct = false; }); return d; })).toContain('Tappa 1, prediction: serve esattamente un’opzione con correct=true (ne ha 0).');
  });

  it('makes the route shape part of the schema: opening map and prediction, a main explanation per page, a final reconstruction', async () => {
    const lesson = await assemble();
    expect(lesson.pages.map(p => p.blocks.map(b => b.type))).toEqual([['map', 'activity'], ['sequence'], ['lens', 'source', 'activity']]);
    expect(await issues(d => ({ ...d, pages: d.pages.map(p => ({ ...p, main: null })) }))).not.toEqual([]);
    expect(await issues(d => { const { reconstruction: _r, ...rest } = d; return rest; })).not.toEqual([]);
    const flat = await issues(d => { d.pages = d.pages.map(p => ({ ...p, main: { type: 'lens', title: 'L', what: 'w', why: 'y', how: 'h', risk: 'r', cites: [{ source: lesson.sources[0].id, from: 7, to: 7, highlights: [7] }] }, excerpt: null })); return d; });
    expect(flat).toContain('Il percorso usa meno di 3 rappresentazioni diverse.');
  });

  it('asks for the language of the goal', async () => {
    const english = await issues(d => ({ ...d, title: 'The water cycle', subtitle: 'From the sea to the rain and back to the sea', pages: d.pages.map(p => ({ ...p, title: `The stage of ${p.title}`, intro: 'This is how the water moves from the sea to the sky and back.' })) }));
    expect(english).toContain('Il percorso è scritto in inglese, ma l’obiettivo è in italiano: riscrivilo nella lingua dell’obiettivo.');
    expect(detectLanguage('Capire come funziona il deploy del frontend da TeamCity')).toBe('it');
    expect(detectLanguage('Understand how the frontend is deployed from TeamCity and why it is safe')).toBe('en');
    expect(detectLanguage('TeamCity ECS ECR')).toBeUndefined();
    expect(detectLanguage('Spiegare il ciclo dell’acqua', 1)).toBe('it');
  });

  it('sends a JSON Schema in the strict structured-output subset, with sources as a closed list', async () => {
    const schema = draftJsonSchema([await userSource()]);
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
    visit(schema);
    const text = JSON.stringify(schema);
    expect(text).toContain('"anyOf"');
    expect(text).toContain(`"enum":["${(await userSource()).id}"]`);
    expect(text).not.toContain('evidenceIds');
  });

  it('estimates progress honestly: slow while the model reads, capped below 100% until complete, with a measured remaining time', () => {
    expect(expectedDraftChars(3_000)).toBe(10_000);
    expect(expectedDraftChars(60_000)).toBe(18_000);
    expect(estimateProgress({ received: 0, expected: 12_000, elapsedMs: 0, streamingMs: 0 })).toEqual({ percent: 0 });
    expect(estimateProgress({ received: 0, expected: 12_000, elapsedMs: 120_000, streamingMs: 0 })).toEqual({ percent: 8 });
    // 6,000 of 12,000 characters in 60 s: halfway, about 60 s left at the same rate.
    expect(estimateProgress({ received: 6_000, expected: 12_000, elapsedMs: 70_000, streamingMs: 60_000 })).toEqual({ percent: 52, remainingSeconds: 60 });
    expect(estimateProgress({ received: 30_000, expected: 12_000, elapsedMs: 200_000, streamingMs: 190_000 })).toEqual({ percent: 95 });
  });
});
