// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { loadCases, PUBLIC_CASES } from '../eval/cases';
import { disassemblyMetrics, summarize, type AttemptRecord, type DisassemblyMetrics } from '../eval/metrics';
import { chatgptRunRefusal, type LedgerEntry } from '../eval/policy';
import { reviewTemplate } from '../eval/review';
import { fixture, mill, PUBLIC_FIXTURES, story } from './disassemblies';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

describe('evaluation cases (Q1, D9)', () => {
  it('loads the public set of D9: one case per kind of material, each with its content language, within the import limits', async () => {
    const cases = await loadCases(process.cwd(), { includePrivate: false });
    expect(cases.map(c => [c.id, c.language]).sort()).toEqual([['core-pipeline', 'it'], ['kessmouth', 'en'], ['mill-harm', 'it'], ['night-importer', 'en'], ['release-runbook', 'it']]);
    expect(cases.every(c => !c.private)).toBe(true);
    expect(cases.find(c => c.id === 'core-pipeline')!.sources).toHaveLength(4);
    // The story and the argument are the prepared disassemblies' own sources, so a generated one can be compared with them.
    expect(cases.find(c => c.id === 'kessmouth')!.sources[0].text).toBe(story().sources[0].text);
    expect(cases.find(c => c.id === 'mill-harm')!.sources[0].text).toBe(mill().sources[0].text);
  });
  it('loads a case without a question: the whole source, compared with the prepared example (P-20261029-source-entry E9)', async () => {
    const cases = await loadCases(process.cwd(), { includePrivate: false });
    const whole = cases.find(c => c.id === 'night-importer')!;
    expect(whole.goal.outcome).toBe('');
    expect(whole.sources[0].text).toBe(fixture(PUBLIC_FIXTURES[6]).sources[0].text);
    expect(cases.filter(c => c.id !== 'night-importer').every(c => c.goal.outcome.length >= 10)).toBe(true);
  });

  it('keeps public case sources inside the public folder, so nothing private can be committed through them', async () => {
    const folder = resolve(PUBLIC_CASES);
    for (const name of (await readdir(folder)).filter(x => x.endsWith('.json'))) {
      const spec = JSON.parse(await readFile(join(folder, name), 'utf8')) as { sources: { path: string }[] };
      for (const s of spec.sources) {
        const inside = relative(folder, resolve(folder, s.path));
        expect(inside !== '' && !inside.startsWith('..') && !isAbsolute(inside), `${name}: ${s.path}`).toBe(true);
      }
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
    expect((await loadCases(root, { includePrivate: true })).map(c => [c.id, c.private, c.language])).toEqual([['public-one', false, 'it'], ['private-one', true, 'it']]);
    await write('.local/eval/cases', 'public-one');
    await expect(loadCases(root, { includePrivate: true })).rejects.toThrow(/Duplicate evaluation case id: public-one/);
  });
});

describe('evaluation metrics and records (D9)', () => {
  it('measures a disassembly: levels, depth, joint families, bill of materials, layout, language, runs and answer-length cues', async () => {
    const metrics = disassemblyMetrics(await validateDisassembly(story()));
    expect(metrics).toMatchObject({ partsPerLevel: [7], depth: 1, families: ['story'], forgottenLines: 0, layoutFindings: 0, writtenLanguage: 'en', runs: { load: 1, case: 1 } });
    expect(metrics.inferences).toBeGreaterThan(0);
    expect(metrics.answerLengthRatios).toHaveLength(1);
  });

  it('summarizes attempts per case and setup: validity, repairs by phase, requests, characters, checks, failures, leads and shorten requests (D20)', () => {
    const phase = (requests: number, repairs = 0) => ({ requests, repairs, sentChars: 1000 * requests, receivedChars: 500 * requests, ms: 1000 });
    const metrics: DisassemblyMetrics = { partsPerLevel: [5], depth: 1, families: ['mechanism'], forgottenLines: 0, layoutFindings: 0, writtenLanguage: 'en', runs: { scenario: 1 }, inferences: 0, answerLengthRatios: [1.2], maxLead: 80, restated: 0 };
    const base = { run: 'r', private: false, language: 'it' as const };
    const records: AttemptRecord[] = [
      { ...base, case: 'a', setup: 'A', attempt: 1, ok: true, seconds: 100, stats: { structure: phase(1), content: phase(5), runs: phase(1) }, metrics },
      { ...base, case: 'a', setup: 'A', attempt: 2, ok: false, failure: 'invalid-output', seconds: 300, stats: { structure: phase(2, 1), content: phase(0), runs: phase(0) } },
      { ...base, case: 'a', setup: 'C', attempt: 1, ok: true, seconds: 80, stats: { structure: phase(1), content: { ...phase(6, 1), shortens: 1 }, runs: phase(1) }, metrics: { ...metrics, answerLengthRatios: [2.1], maxLead: 120, restated: 2 } },
    ];
    expect(summarize(records)).toEqual([
      { case: 'a', setup: 'A', attempts: 2, valid: 1, repairs: { structure: 1, content: 0, runs: 0 }, medianSeconds: 200, medianRequests: 5, medianSentChars: 4500, medianReceivedChars: 2250, maxForgottenLines: 0, maxLayoutFindings: 0, languageMismatches: 1, maxAnswerLengthRatio: 1.2, failures: ['invalid-output'], maxLead: 80, restated: 0, savedByShorten: 0 },
      { case: 'a', setup: 'C', attempts: 1, valid: 1, repairs: { structure: 0, content: 1, runs: 0 }, medianSeconds: 80, medianRequests: 8, medianSentChars: 8000, medianReceivedChars: 4000, maxForgottenLines: 0, maxLayoutFindings: 0, languageMismatches: 1, maxAnswerLengthRatio: 2.1, failures: [], maxLead: 120, restated: 2, savedByShorten: 1 },
    ]);
  });

  it('keeps ChatGPT evaluation within the approved budget: opt-in, 2 attempts, 28 public and 2 private generations, private only on confirmation', () => {
    const plan = { allowed: true, privateAllowed: false, attempts: 2, publicPlanned: 24, privatePlanned: 0, used: [] as LedgerEntry[] };
    const used = (n: number, isPrivate = false) => Array.from({ length: n }, (_, i): LedgerEntry => ({ run: 'r', case: `c${i}`, private: isPrivate, setup: 'A', at: '2026-10-26T10:00:00Z' }));
    expect(chatgptRunRefusal({ ...plan, allowed: false })).toMatch(/--allow-chatgpt/);
    expect(chatgptRunRefusal({ ...plan, attempts: 3 })).toMatch(/2 attempts per case and setup/);
    expect(chatgptRunRefusal(plan)).toBeUndefined();
    expect(chatgptRunRefusal({ ...plan, publicPlanned: 4, used: used(24) })).toBeUndefined();
    expect(chatgptRunRefusal({ ...plan, publicPlanned: 6, used: used(24) })).toMatch(/28 ChatGPT generations on public cases; 24 used, 6 planned/);
    expect(chatgptRunRefusal({ ...plan, privatePlanned: 2, publicPlanned: 0 })).toMatch(/--private-to-chatgpt/);
    expect(chatgptRunRefusal({ ...plan, privateAllowed: true, privatePlanned: 2, publicPlanned: 0, used: used(28) })).toBeUndefined();
    expect(chatgptRunRefusal({ ...plan, privateAllowed: true, privatePlanned: 2, publicPlanned: 0, used: used(1, true) })).toMatch(/2 ChatGPT generations on private cases/);
    // Parts taken apart on demand have their own allowance and do not count against generations (v5).
    const expansions = Array.from({ length: 3 }, (): LedgerEntry => ({ run: 'r', case: 'c', private: false, setup: 'A', at: '2026-10-26T10:00:00Z', kind: 'expansion' }));
    expect(chatgptRunRefusal({ ...plan, publicPlanned: 4, expansionsPlanned: 1, used: [...used(24), ...expansions] })).toBeUndefined();
    expect(chatgptRunRefusal({ ...plan, publicPlanned: 0, expansionsPlanned: 2, used: expansions })).toMatch(/4 parts taken apart on ChatGPT; 3 used, 2 planned/);
  });
});

describe('blind claim review sheet (D9)', () => {
  it('lists every point, sub-part, joint and run explanation next to its cited lines, names the setup by letter only, and asks for ratings', async () => {
    const d = await validateDisassembly(fixture(PUBLIC_FIXTURES[4]));
    d.generation = { provider: 'chatgpt', model: 'secret-model', createdAt: '2026-10-26T10:00:00.000Z' }; d.kind = 'generated';
    const sheet = reviewTemplate(d, { case: 'mill-harm', setup: 'B', run: 'r' });
    expect(sheet).toContain('configurazione **B**');
    expect(sheet).not.toContain('secret-model');
    const vote = d.parts.findIndex(p => p.id === 'bounds');
    expect(sheet).toContain(`| ${vote + 1}. ${d.parts[vote].name} · punto | ${d.parts[vote].points![0].text} |`);
    expect(sheet).toContain(`· ${d.parts[vote].parts![0].name} | ${d.parts[vote].parts![0].explain} |`);
    expect(sheet).toMatch(/\| prova 1 · .* · togli .* \| falls: /);
    expect(sheet).toMatch(/L\d+–\d+/);
    expect(sheet).toContain('- Esploso (pezzi e giunti): ___ / 5');
    expect(sheet).toMatch(/Totale: \d+ affermazioni/);
  });
});
