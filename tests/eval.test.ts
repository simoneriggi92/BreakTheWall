// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assembleLesson } from '../src/core/generation';
import { loadCases, PUBLIC_CASES } from '../eval/cases';
import { lessonMetrics, summarize, type AttemptRecord } from '../eval/metrics';
import { chatgptRunRefusal } from '../eval/policy';
import { reviewTemplate } from '../eval/review';
import { draftFor, userSource } from './draft';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
const sampleLesson = async () => { const source = await userSource(); return assembleLesson(JSON.stringify(draftFor(source.id)), [source], { outcome: 'Spiegare il ciclo dell’acqua', priorKnowledge: '' }, { id: 'g-eval', model: 'm', createdAt: '2026-10-22T10:00:00.000Z' }); };

describe('evaluation cases (Q1)', () => {
  it('loads the public set: code and non-code, every source within the import limits', async () => {
    const cases = await loadCases(process.cwd(), { includePrivate: false });
    expect(cases.map(c => c.id).sort()).toEqual(['account-session', 'core-pipeline', 'glucose', 'release-runbook']);
    expect(cases.every(c => !c.private)).toBe(true);
    expect(cases.find(c => c.id === 'core-pipeline')!.sources).toHaveLength(4);
    expect(cases.some(c => c.sources.some(s => s.language)) && cases.some(c => c.sources.every(s => !s.language))).toBe(true);
  });

  it('keeps public case sources inside the public folder, so nothing private can be committed through them', async () => {
    const folder = resolve(PUBLIC_CASES);
    for (const name of (await readdir(folder)).filter(x => x.endsWith('.json'))) {
      const spec = JSON.parse(await readFile(join(folder, name), 'utf8')) as { sources: { path: string }[] };
      for (const s of spec.sources) expect(resolve(folder, s.path).startsWith(folder + '/'), `${name}: ${s.path}`).toBe(true);
    }
  });

  it('adds private cases only on request, from the ignored .local folder, and rejects duplicate ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'btw-eval-')); dirs.push(root);
    const write = async (folder: string, id: string) => {
      await mkdir(join(root, folder, 'sources'), { recursive: true });
      await writeFile(join(root, folder, 'sources', `${id}.md`), 'Riga uno\nRiga due');
      await writeFile(join(root, folder, `${id}.json`), JSON.stringify({ id, title: id, goal: { outcome: 'Capire il documento di prova', priorKnowledge: '' }, sources: [{ path: `sources/${id}.md`, title: `${id}.md` }] }));
    };
    await write('eval/cases', 'public-one');
    await write('.local/eval/cases', 'private-one');
    expect((await loadCases(root, { includePrivate: false })).map(c => c.id)).toEqual(['public-one']);
    expect((await loadCases(root, { includePrivate: true })).map(c => [c.id, c.private])).toEqual([['public-one', false], ['private-one', true]]);
    await write('.local/eval/cases', 'public-one');
    await expect(loadCases(root, { includePrivate: true })).rejects.toThrow(/Duplicate evaluation case id: public-one/);
  });
});

describe('evaluation metrics and records (Q1)', () => {
  it('measures structure, source coverage and answer-length cues from an assembled lesson', async () => {
    const metrics = lessonMetrics(await sampleLesson());
    expect(metrics).toMatchObject({ pages: 3, blocks: { map: 1, activity: 2, sequence: 1, lens: 1, source: 1 }, activities: { choice: 1, order: 1 }, coverage: 1 });
    // "Condensa in nuvole" (18) against "Si scalda ancora" (16).
    expect(metrics.answerLengthRatios).toEqual([1.13]);
  });

  it('summarizes attempts per case: valid and repaired counts, median and slowest time, failures', () => {
    const base = { run: 'r', private: false, route: 'local' as const, model: 'm', outputChars: 0 };
    const records: AttemptRecord[] = [
      { ...base, case: 'a', attempt: 1, ok: true, repaired: false, seconds: 100, metrics: { pages: 3, blocks: {}, activities: { choice: 1, order: 1 }, evidence: 4, coverage: 0.5, answerLengthRatios: [1.2] } },
      { ...base, case: 'a', attempt: 2, ok: false, failure: 'invalid-output', repaired: true, seconds: 300 },
      { ...base, case: 'a', attempt: 3, ok: true, repaired: true, seconds: 200, metrics: { pages: 4, blocks: {}, activities: { choice: 2, order: 1 }, evidence: 6, coverage: 0.7, answerLengthRatios: [2.4, 0.9] } },
    ];
    expect(summarize(records)).toEqual([{ case: 'a', attempts: 3, valid: 2, repaired: 2, medianSeconds: 200, slowestSeconds: 300, medianCoverage: 0.6, maxAnswerLengthRatio: 2.4, failures: ['invalid-output'] }]);
  });

  it('caps ChatGPT evaluation as the plan approved: explicit opt-in, at most 2 attempts per case', () => {
    expect(chatgptRunRefusal({ allowed: false, runs: 1 })).toMatch(/--allow-chatgpt/);
    expect(chatgptRunRefusal({ allowed: true, runs: 3 })).toMatch(/2 attempts/);
    expect(chatgptRunRefusal({ allowed: true, runs: 2 })).toBeUndefined();
  });
});

describe('claim review sheet (Q1)', () => {
  it('lists every statement a learner reads next to its cited lines, with an empty verdict and totals', async () => {
    const sheet = reviewTemplate(await sampleLesson(), { case: 'glucose', model: 'm', run: 'r' });
    expect(sheet).toContain('| T1 mappa · Mare | Riserva d’acqua / Segui il passaggio sulla fonte. | Appunti sul ciclo dell’acqua L2–3 |  |');
    expect(sheet).toContain('| T1 scelta · giusta | Condensa in nuvole — feedback: Sì: si raffredda e condensa (riga 4). | Appunti sul ciclo dell’acqua L4–6 |  |');
    expect(sheet).toContain('| T3 ordine | Evaporazione → Condensazione → Pioggia |');
    expect(sheet).toMatch(/Totale: \d+ affermazioni/);
    expect(sheet).toContain('Revisore: ___');
  });
});
