import { beforeAll, describe, expect, it } from 'vitest';
import type { Finding } from '../src/core/disassembly';
import { longTexts, type GenerationMeta } from '../src/core/disassembly-generation';
import { ExplorationError, validateExploration } from '../src/core/exploration';
import {
  acceptExploration, EXPLORATION_SOURCE_LIMIT, explorationInstructions, explorationJsonSchema, explorationRequest, sourceFindings, type ExplorationInput,
} from '../src/core/exploration-generation';
import { importSource } from '../src/core/source';
import { BAKERY, bakery, toAnswer } from './explorations';

const meta: GenerationMeta = { id: 'g-test', createdAt: '2026-11-06T10:00:00.000Z', provider: 'chatgpt', model: 'model-a' };
async function input(): Promise<ExplorationInput> {
  return { source: await importSource({ kind: 'paste', title: 'The night bakery', text: BAKERY }), language: 'en', meta };
}
const refused = (fn: () => unknown): Finding[] => {
  try { fn(); } catch (error) { if (error instanceof ExplorationError) return error.findings; throw error; }
  return [];
};

describe('the structure request (X7)', () => {
  let ready: ExplorationInput;
  beforeAll(async () => { ready = await input(); });

  it('turns a valid answer into a valid exploration, with its members and aspects', async () => {
    const answer = toAnswer(await bakery()), x = acceptExploration(JSON.stringify(answer), ready);
    expect(await validateExploration(x)).toEqual(x);
    expect(x.kind).toBe('generated');
    expect(x.generation).toEqual({ provider: 'chatgpt', model: 'model-a', createdAt: meta.createdAt });
    expect(x.aspects.map(a => a.id)).toEqual(['make', 'sell']);
    expect(x.parts.find(p => p.id === 'mix')!.members.map(m => m.id)).toEqual(['flour', 'water']);
    expect(x.parts.find(p => p.id === 'staling')!.kind).toBe('prerequisite');
    expect(x.parts.find(p => p.id === 'drift')).toMatchObject({ on: 'bake' });
    expect(x.parts.find(p => p.id === 'drift')).not.toHaveProperty('aspect');
    expect(x.links[0]).toMatchObject({ class: 'bond', cites: [{ from: 7, to: 8 }] });
  });

  it('locates a bad member cite and a bond to a prerequisite at their paths in the answer', async () => {
    const answer = toAnswer(await bakery());
    answer.parts[1].members[0].cites = [[40, 41]];
    answer.links[0].to = 'staling';
    const fs = refused(() => acceptExploration(JSON.stringify(answer), ready));
    expect(fs.map(f => f.path)).toEqual(['parts[1].members[0].cites[0]', 'links[0].cls']);
    expect(fs[0].message).toMatch(/past the end of the source/);
  });

  it('words a text over its contract limit as a length, so the shorten request can fix it', async () => {
    const answer = toAnswer(await bakery());
    answer.parts[1].name = 'x'.repeat(60);
    const raw = JSON.stringify(answer), fs = refused(() => acceptExploration(raw, ready));
    expect(fs).toEqual([{ path: 'parts[1].name', message: 'Text has 60 characters; at most 48' }]);
    expect(longTexts(raw, fs)).toEqual([{ path: 'parts[1].name', text: 'x'.repeat(60), length: 60, limit: 48 }]);
  });

  it('names a text over its limit and a structural finding in one refusal, so one repair can fix both (X40)', async () => {
    const answer = toAnswer(await bakery());
    answer.parts[1].name = 'x'.repeat(60);
    answer.start = 'staling';
    const raw = JSON.stringify(answer), fs = refused(() => acceptExploration(raw, ready));
    expect(fs).toEqual([
      { path: 'parts[1].name', message: 'Text has 60 characters; at most 48' },
      { path: 'start', message: 'The start is a part of kind "part"; staling is a prerequisite' },
    ]);
    // A mix means the draft is wrong, not only long: the ChatGPT route sends a full repair, not a shorten request.
    expect(longTexts(raw, fs)).toBeUndefined();
  });

  it('refuses an answer that is not JSON or not in the answer shape', () => {
    expect(refused(() => acceptExploration('{"start":', ready))).toEqual([{ path: '', message: 'The answer is not complete JSON' }]);
    expect(refused(() => acceptExploration('{}', ready)).length).toBeGreaterThan(0);
  });

  it('refuses a source over the limit before the request, naming the limit', async () => {
    const long = { ...ready.source, text: 'a'.repeat(EXPLORATION_SOURCE_LIMIT + 1) };
    const fs = refused(() => explorationRequest(long, 'en'));
    expect(fs).toEqual([{ path: 'source', message: `The source has ${EXPLORATION_SOURCE_LIMIT + 1} characters; an exploration reads at most ${EXPLORATION_SOURCE_LIMIT} in one request` }]);
    expect(sourceFindings(ready.source)).toEqual([]);
    const body = explorationRequest(ready.source, 'en');
    expect(body.input).toMatch(/^Read this source and return its structure\.\n\n<<<SOURCE id="src-/);
    expect(body.input).toContain(' 7| Flour and water are mixed into a dough.');
  });

  it('keeps the instructions and the schema stable', () => {
    expect(explorationInstructions('it')).toMatchSnapshot('instructions-it');
    expect(explorationInstructions('en')).toContain('Write in English.');
    expect(explorationJsonSchema()).toMatchSnapshot('schema');
  });
});
