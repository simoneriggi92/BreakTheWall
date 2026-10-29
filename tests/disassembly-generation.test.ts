// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { billOfMaterials, DisassemblyError, type Disassembly, type Part } from '../src/core/disassembly';
import { readFileSync } from 'node:fs';
import {
  acceptContent, acceptExpansion, acceptRuns, acceptStructure, acceptSuggestions, answerLengthRatio, applyShortened, givesAway, assembleDisassembly, buildContentInput, buildRunsInput,
  buildStructureInput, buildSuggestionInput, compose, contentJsonSchema, defaultContentLanguage, LEAD_LIMIT, longTexts, restates, runsJsonSchema, structureJsonSchema,
  type GenerationMeta,
} from '../src/core/disassembly-generation';
import { failure, ProviderError, type GenerationProgress } from '../src/core/provider';
import type { UserSource } from '../src/core/source';
import type { CompletionRequest } from '../src/desktop/completion';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { Generator } from '../src/desktop/generator';
import { atlas, fixture, mill, PUBLIC_FIXTURES, story } from './disassemblies';
import { buildExpansionInput, CONTENT_INSTRUCTIONS, EXPANSION_INSTRUCTIONS, expansionInstructions, instructionsFor, STRUCTURE_INSTRUCTIONS, structureInstructions } from '../src/core/disassembly-generation';
import { goalSchema } from '../src/core/source';
import { deepDisassembly, draftsFrom, generatedFrom, pastedSource, scriptedAnswer, splitAnswer } from './disassembly-drafts';

const meta: GenerationMeta = { id: 'g-test', createdAt: '2026-10-26T10:00:00.000Z', provider: 'chatgpt', model: 'model-a' };
const goalOf = (d: Disassembly) => ({ outcome: d.question ?? '', priorKnowledge: '' });
async function setupFor(d: Disassembly) {
  const source = await pastedSource(d);
  return { d, source, sources: [source], goal: goalOf(d), language: d.language, drafts: draftsFrom(d, source.id) };
}
const findings = (fn: () => unknown) => { try { fn(); } catch (error) { if (error instanceof DisassemblyError) return error.findings; throw error; } return []; };

describe('two-phase generation contract (D9)', () => {
  it.each(PUBLIC_FIXTURES)('rebuilds %s through the three phases with 0 forgotten lines', async path => {
    const { d, sources, goal, language, drafts } = await setupFor(fixture(path));
    const base = { sources, goal, language, meta };
    const structure = acceptStructure(JSON.stringify(drafts.structure), base);
    const contents = drafts.contents.map((c, i) => acceptContent(JSON.stringify(c), structure, i, language));
    const runs = acceptRuns(JSON.stringify(drafts.runs), { ...base, structure, contents });
    const rebuilt = await assembleDisassembly({ ...base, structure, contents, runs });
    expect(billOfMaterials(rebuilt).counts.missing).toBe(0);
    // Generation never writes defaults out: `relevant: true` and empty joint lists are left implicit.
    const resourced = (p: Part): Part => {
      const { relevant, joints, excluded, ...rest } = p;
      const moved = <T extends { source: string }>(list: T[]) => list.map(c => ({ ...c, source: sources[0].id }));
      return { ...rest, ...(relevant === false ? { relevant } : {}), ...(joints?.length ? { joints } : {}), ...(excluded?.length ? { excluded: moved(excluded) } : {}), cites: moved(p.cites), ...(p.parts ? { parts: p.parts.map(resourced) } : {}) };
    };
    expect(rebuilt.parts).toEqual(d.parts.map(resourced));
    // Slots follow the parts' order; the hand-made files sometimes list them differently.
    const slotSet = (x: Disassembly) => x.reassemble.slots.map(s => JSON.stringify([s.label, s.accepts])).sort();
    expect(slotSet(rebuilt)).toEqual(slotSet(d));
    expect(rebuilt).toMatchObject({ kind: 'generated', revision: 'v1', language: d.language, question: d.question, generation: { provider: 'chatgpt', model: 'model-a' } });
  });

  it('sends strict schemas: closed lists of sources, parts and sub-parts, and every field required', async () => {
    const { sources, drafts } = await setupFor(story());
    const structure = structureJsonSchema(sources) as any;
    expect(structure.properties.parts.items.properties.cites.items.properties.source.enum).toEqual([sources[0].id]);
    const strict = (node: any): boolean => node?.type === 'object'
      ? node.additionalProperties === false && Object.keys(node.properties).every(k => node.required.includes(k)) && Object.values(node.properties).every(strict)
      : node?.type === 'array' ? strict(node.items) : node?.anyOf ? node.anyOf.every(strict) : true;
    expect(strict(structure)).toBe(true);
    const runs = runsJsonSchema(sources, drafts.structure) as any;
    expect(strict(runs)).toBe(true);
    expect(runs.properties.reassemble.properties.hints.items.properties.part.enum).toEqual(drafts.structure.parts.map(p => p.id));
    const argument = (await setupFor(mill())).drafts.structure;
    const bounds = argument.parts.findIndex(p => p.id === 'bounds');
    expect((contentJsonSchema(argument, bounds) as any).properties.parts.items.properties.id.enum).toEqual(argument.parts[bounds].parts!.map(p => p.id));
    expect((contentJsonSchema(drafts.structure, 0) as any).properties.parts).toBeUndefined();
  });

  it('gives a content request only its own part’s lines, and the structure request every line', async () => {
    const { sources, goal, language, drafts } = await setupFor(story());
    const all = buildStructureInput(sources, goal, language);
    expect(all).toContain('CONTENT LANGUAGE: English (en)');
    expect(all.split('\n').filter(l => /^\s*\d+\| /.test(l))).toHaveLength(sources[0].text.split('\n').length);
    const index = drafts.structure.parts.findIndex(p => p.id === 'railway');
    const own = buildContentInput(sources, goal, language, drafts.structure, index);
    const lines = own.split('ITS LINES')[1].split('\n').filter(l => /^\s*\d+\| /.test(l)).map(l => Number(l.split('|')[0]));
    const cited = drafts.structure.parts[index].cites.flatMap(c => Array.from({ length: c.to - c.from + 1 }, (_, k) => c.from + k));
    expect(lines).toEqual(cited);
    expect(own).toContain('PART TO WRITE: railway');
  });

  it('lists parts in reading order, with the numbers the drawing shows, in content and runs requests (D15)', async () => {
    const { sources, goal, language, drafts } = await setupFor(mill());
    const listed = (input: string) => input.split('\n').filter(l => /^\d+\. /.test(l)).map(l => l.split(' ')[1]);
    const order = ['utility', 'sovereignty', 'claim', 'objection', 'bounds', 'region', 'abstract-right'];
    expect(listed(buildContentInput(sources, goal, language, drafts.structure, 0))).toEqual(order);
    expect(listed(buildRunsInput(sources, goal, language, drafts.structure, drafts.contents))).toEqual(order);
    expect(buildRunsInput(sources, goal, language, drafts.structure, drafts.contents)).toMatch(/^ {4}5\.1\. bounds-maturity /m);
  });

  it('finds forgotten lines, joints across levels, the wrong language and bad JSON in the structure, located by path', async () => {
    const { sources, goal, language, drafts } = await setupFor(story());
    const base = { sources, goal, language, meta };
    const forgetting = structuredClone(drafts.structure); forgetting.excluded = [];
    expect(findings(() => acceptStructure(JSON.stringify(forgetting), base))).toContainEqual({ path: 'sources[0]', message: expect.stringMatching(/^Lines 1–3 of .* are in no part and not excluded$/) });
    const crossing = structuredClone(drafts.structure); crossing.joints.push({ from: 'storm', to: 'vote-tally', type: 'leads-to', label: 'x', cites: [] });
    expect(findings(() => acceptStructure(JSON.stringify(crossing), base)).map(f => f.path)).toContain(`joints[${crossing.joints.length - 1}]`);
    const badExclusion = structuredClone(drafts.structure); badExclusion.excluded[0].to = 999;
    expect(findings(() => acceptStructure(JSON.stringify(badExclusion), base)).map(f => f.path)).toContain('excluded[0]');
    expect(findings(() => acceptStructure(JSON.stringify(drafts.structure), { ...base, language: 'it' }))).toContainEqual({ path: 'parts', message: expect.stringMatching(/Written in English, but the content language is Italian/) });
    expect(findings(() => acceptStructure('{"title": "x"', base))).toEqual([{ path: '', message: 'The answer is not complete JSON' }]);
    // Points, explanations and runs are later phases: their placeholders never produce structure findings.
    expect(findings(() => acceptStructure(JSON.stringify(drafts.structure), base))).toEqual([]);
  });

  it('checks a part’s content: point length, each sub-part once, the language', async () => {
    const { language, drafts } = await setupFor(fixture(PUBLIC_FIXTURES[4]));
    const vote = drafts.structure.parts.findIndex(p => p.id === 'bounds');
    const long = structuredClone(drafts.contents[vote]); long.points[0].text = 'x'.repeat(140);
    expect(findings(() => acceptContent(JSON.stringify(long), drafts.structure, vote, language))).toContainEqual({ path: 'points[0]', message: 'Point has 140 characters; at most 130' });
    const twice = structuredClone(drafts.contents[vote]); twice.parts![1].id = twice.parts![0].id;
    expect(findings(() => acceptContent(JSON.stringify(twice), drafts.structure, vote, language)).map(f => f.path)).toContain('parts[1].id');
    const unknown = structuredClone(drafts.contents[vote]); unknown.parts![0].id = 'nowhere';
    expect(findings(() => acceptContent(JSON.stringify(unknown), drafts.structure, vote, language)).map(f => f.path)).toContain('parts[0].id');
    const italian = structuredClone(drafts.contents[vote]); italian.points = [{ text: 'Il voto della città è la decisione che sposta il mercato sul molo.', mark: null }, { text: 'Non è una scelta del mercato, ma della riparazione.', mark: null }];
    expect(findings(() => acceptContent(JSON.stringify(italian), drafts.structure, vote, language))).toContainEqual({ path: 'points', message: expect.stringMatching(/Written in Italian/) });
  });

  it('flags a correct option much longer than the wrong ones as a giveaway, with the threshold from the Q1 baseline', async () => {
    const { sources, goal, language, drafts } = await setupFor(story());
    const base = { sources, goal, language, meta, structure: drafts.structure, contents: drafts.contents };
    const giveaway = structuredClone(drafts.runs);
    const c = giveaway.runs.findIndex(r => r.type === 'case');
    const run = giveaway.runs[c] as Extract<typeof giveaway.runs[number], { type: 'case' }>;
    run.options = [{ text: 'Because the vote spent the only repair on the sea wall, so the hall was never fixed', correct: true, why: 'Yes.' }, { text: 'The railway', correct: false, why: 'No.' }, { text: 'The storm', correct: false, why: 'No.' }];
    expect(answerLengthRatio(run.options)).toBeGreaterThan(1.6);
    expect(findings(() => acceptRuns(JSON.stringify(giveaway), base))).toContainEqual({ path: `runs[${c}].options`, message: expect.stringMatching(/gives it away/) });
    // M6a: the finding says how far to go, in characters (wrong ones: 11 and 9, so 10 on average and 16 at most).
    const correct = run.options[0].text.length;
    expect(findings(() => acceptRuns(JSON.stringify(giveaway), base)).find(f => f.path === `runs[${c}].options`)?.message)
      .toContain(`it has ${correct} characters and the wrong ones 10 on average, so it may have at most 16. Shorten the correct option, or make the wrong ones as specific and as long`);
    expect(findings(() => acceptRuns(JSON.stringify(drafts.runs), base))).toEqual([]);
  });

  it('refuses slot labels that repeat the part’s name, since the blank drawing would show the answer', async () => {
    expect(givesAway('Kettle and boiling water', 'Kettle and boiling water')).toBe(true);
    expect(givesAway('Upload per region', 'Upload to one or many regions')).toBe(true);
    expect(givesAway('Oven: one tray per batch', 'Oven and numbered trays')).toBe(false);
    expect(givesAway('Premise', 'Over themselves, individuals are sovereign')).toBe(false);
    for (const path of PUBLIC_FIXTURES) {
      const d = fixture(path) as Disassembly;
      for (const slot of d.reassemble.slots) for (const id of [slot.accepts].flat()) expect(givesAway(slot.label, d.parts.find(p => p.id === id)!.name), `${path} · ${slot.label}`).toBe(false);
    }
    const { sources, goal, language, drafts } = await setupFor(story());
    const named = structuredClone(drafts.runs);
    named.reassemble.slots[0].label = drafts.structure.parts.find(p => p.id === named.reassemble.slots[0].part)!.name;
    expect(findings(() => acceptRuns(JSON.stringify(named), { sources, goal, language, meta, structure: drafts.structure, contents: drafts.contents })))
      .toContainEqual({ path: 'reassemble.slots[0].label', message: expect.stringMatching(/gives the reassembly away/) });
  });

  it('derives interchangeable slots from shared labels and neighbours, never from the model’s ids', async () => {
    const { sources, goal, language, drafts } = await setupFor(story());
    const d = compose({ sources, goal, language, meta, ...drafts });
    expect(d.reassemble.slots.filter(s => Array.isArray(s.accepts))).toEqual([{ id: 's3', label: '3', accepts: ['wall', 'bell'] }, { id: 's4', label: '3', accepts: ['wall', 'bell'] }]);
    const apart = structuredClone(drafts.runs); apart.reassemble.slots.find(s => s.part === 'bell')!.label = '3b';
    expect(compose({ sources, goal, language, meta, ...drafts, runs: apart }).reassemble.slots.every(s => !Array.isArray(s.accepts))).toBe(true);
  });

  it('chooses the content language from the question when it can tell, else from the interface', () => {
    expect(defaultContentLanguage('How did the market end up on the quay?', 'it')).toBe('en');
    expect(defaultContentLanguage('Secondo Mill, quando la società può costringere un individuo?', 'en')).toBe('it');
    expect(defaultContentLanguage('TCP?', 'en')).toBe('en');
  });
});

describe('generation without a question (P-20261029-source-entry E4)', () => {
  const whole = { outcome: '', priorKnowledge: '' };
  /** Mill as a whole-source structure: no question, every sub-assembly open, a place to start. */
  const millWhole = () => { const x = mill(); delete x.question; x.parts.forEach((p: any) => { delete p.relevant; }); x.start = { part: 'claim', why: 'The rest of the essay supports or limits it.' }; return x; };

  it('accepts an empty goal, and keeps a given question at 10 to 400 characters', () => {
    expect(goalSchema.safeParse(whole).success).toBe(true);
    expect(goalSchema.safeParse({ outcome: '   ', priorKnowledge: '' }).data?.outcome).toBe('');
    expect(goalSchema.safeParse({ outcome: 'Why?', priorKnowledge: '' }).success).toBe(false);
    expect(goalSchema.safeParse({ outcome: 'Why does the release stop?', priorKnowledge: '' }).success).toBe(true);
  });
  it('asks for the whole source, with no question and nothing outside it', async () => {
    const { sources, language } = await setupFor(story());
    const input = buildStructureInput(sources, whole, language);
    expect(input).not.toContain('QUESTION:');
    expect(input.split('\n')[0]).toBe('FOCUS: none. The learner wants to understand the whole source.');
    const instructions = instructionsFor(whole);
    expect(instructions).not.toContain('outside-question');
    expect(instructions).toContain('relevant: always true');
    expect(instructions).toMatch(/start: the top-level part a learner new to the source should begin with.*Never null/);
    expect(expansionInstructions(false)).not.toContain('outside-question');
  });
  it('leaves the question-led request as it was, apart from the start line', async () => {
    const { sources, goal, language } = await setupFor(story());
    expect(buildStructureInput(sources, goal, language).split('\n')[0]).toBe(`QUESTION: ${goal.outcome}`);
    expect(instructionsFor(goal)).toBe(STRUCTURE_INSTRUCTIONS);
    expect(STRUCTURE_INSTRUCTIONS).toBe(structureInstructions(true));
    expect(STRUCTURE_INSTRUCTIONS).toContain('outside-question');
    expect(STRUCTURE_INSTRUCTIONS).toContain('or null when the question already says where to begin');
    expect(EXPANSION_INSTRUCTIONS).toBe(expansionInstructions(true));
  });
  it('rejects a whole-source structure without a start, with a closed sub-assembly or with lines outside a question', async () => {
    const atlasCase = await setupFor(atlas());
    const base = { sources: atlasCase.sources, goal: whole, language: atlasCase.language, meta };
    // The schema itself offers no "outside the question" reason without a question.
    expect(findings(() => acceptStructure(JSON.stringify(atlasCase.drafts.structure), base)).map(f => f.path)).toContain('excluded[3].reason');
    const excluded = atlasCase.drafts.structure.excluded.map(x => x.reason === 'outside-question' ? { ...x, reason: 'detail' as const } : x);
    const found = findings(() => acceptStructure(JSON.stringify({ ...atlasCase.drafts.structure, excluded, start: null }), base)).map(f => f.path);
    expect(found).toEqual(expect.arrayContaining(['start', 'parts[1].relevant']));
  });
  it('takes the whole source apart through the three phases', async () => {
    const { sources, language, drafts } = await setupFor(millWhole());
    const base = { sources, goal: whole, language, meta };
    const structure = acceptStructure(JSON.stringify(drafts.structure), base);
    const contents = drafts.contents.map((c, i) => acceptContent(JSON.stringify(c), structure, i, language));
    const runs = acceptRuns(JSON.stringify(drafts.runs), { ...base, structure, contents });
    const d = await assembleDisassembly({ ...base, structure, contents, runs });
    expect(d.question).toBeUndefined();
    expect(d.start).toEqual({ part: 'claim', why: 'The rest of the essay supports or limits it.' });
    expect(buildExpansionInput({ ...d, kind: 'generated' }, 'bounds').split('\n')[0]).toBe('FOCUS: none. The learner wants to understand the whole source.');
  });
  it('writes in the interface language when there is no question, whatever the sources (owner, 2026-10-29)', () => {
    expect(defaultContentLanguage('', 'it')).toBe('it');
    expect(defaultContentLanguage('', 'en')).toBe('en');
    expect(defaultContentLanguage('Secondo Mill, quando la società può costringere un individuo?', 'en')).toBe('it');
  });
});

describe('generation orchestration across phases and routes (D9)', () => {
  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
  type Answer = (request: CompletionRequest, n: number) => string | Promise<string>;
  async function setup(d: Disassembly, answer?: Answer) {
    const root = await mkdtemp(join(tmpdir(), 'btw-generation-')); dirs.push(root);
    const store = new DisassemblyStore(root);
    const context = await setupFor(d);
    const seen: { route: string; request: CompletionRequest }[] = [];
    const respond = (route: string) => async (request: CompletionRequest, signal: AbortSignal) => {
      seen.push({ route, request });
      if (signal.aborted) throw new ProviderError(failure('cancelled'));
      const own = answer ? await answer(request, seen.length) : undefined;
      return own ?? scriptedAnswer(context.drafts, request.schemaName, request.messages[0].content);
    };
    const chatgpt = { complete: vi.fn(respond('chatgpt')) };
    const local = vi.fn((target: { model: string }) => ({ complete: respond(`local:${target.model}`) }));
    const generator = new Generator({ chatgpt, local }, store, () => new Date('2026-10-26T10:00:00Z'));
    const request = (setup: object, extra: object = {}) => ({ sources: context.sources, goal: context.goal, language: context.d.language, setup, ...extra });
    return { root, store, seen, chatgpt, local, generator, request, ...context };
  }
  const gpt = (model: string) => ({ provider: 'chatgpt', model });
  const llama = { provider: 'local', runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf' };

  it('asks for the structure, then each part, then the runs, and saves the validated disassembly with its stats', async () => {
    const { generator, request, seen, store, drafts } = await setup(mill());
    const progress: GenerationProgress[] = [];
    const result = await generator.generate(request({ structure: gpt('strong'), content: gpt('cheap') }), p => progress.push(p));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const n = drafts.structure.parts.length;
    expect(seen.map(x => x.request.schemaName)).toEqual(['break_the_wall_structure', ...Array(n).fill('break_the_wall_part'), 'break_the_wall_runs']);
    expect(seen.map(x => x.request.model)).toEqual(['strong', ...Array(n).fill('cheap'), 'cheap']);
    expect(result.disassembly.generation).toMatchObject({ provider: 'chatgpt', model: 'strong + cheap' });
    expect(result.stats).toMatchObject({ structure: { requests: 1, repairs: 0 }, content: { requests: n, repairs: 0 }, runs: { requests: 1, repairs: 0 } });
    expect(result.stats.structure.sentChars).toBeGreaterThan(mill().sources[0].text.length);
    expect(result.stats.content.receivedChars).toBe(0);
    expect(progress.map(p => p.phase).filter((x, i, all) => x !== all[i - 1])).toEqual(['structure', 'content', 'runs']);
    expect(progress.filter(p => p.phase === 'content').at(-1)).toMatchObject({ part: n, parts: n });
    expect((await store.list()).disassemblies.map(x => x.id)).toEqual([result.disassembly.id]);
  });

  it('repairs a structure with a forgotten range once, sending the located finding back to the same route', async () => {
    const forgetting = structuredClone((await setupFor(story())).drafts.structure); forgetting.excluded = [];
    const { generator, request, seen } = await setup(story(), (_r, n) => n === 1 ? JSON.stringify(forgetting) : undefined as unknown as string);
    const result = await generator.generate(request({ structure: gpt('strong'), content: gpt('strong') }), () => {});
    expect(result).toMatchObject({ ok: true, stats: { structure: { requests: 2, repairs: 1 } } });
    expect(seen[1].request.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(seen[1].request.messages[2].content).toMatch(/- sources\[0\]: Lines 1–3 of .* are in no part and not excluded/);
  });

  it('repairs one failing part without asking again for the others', async () => {
    const { generator, request, seen, drafts } = await setup(story(), request => {
      if (request.schemaName !== 'break_the_wall_part' || !request.messages[0].content.includes('PART TO WRITE: bell') || request.messages.length > 1) return undefined as unknown as string;
      return JSON.stringify({ ...drafts.contents[3], points: [{ text: 'x'.repeat(150), mark: null }, drafts.contents[3].points[1]] });
    });
    const result = await generator.generate(request({ structure: llama, content: llama }), () => {});
    expect(result).toMatchObject({ ok: true, stats: { content: { requests: drafts.structure.parts.length + 1, repairs: 1 } } });
    const repairs = seen.filter(x => x.request.messages.length > 1);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].request.messages[2].content).toContain('- points[0]: Point has 150 characters; at most 130');
    expect(repairs[0].route).toBe('local:qwen.gguf');
  });

  it('gives up after one repair, names the phase in the findings, and saves nothing', async () => {
    const { generator, request, root } = await setup(story(), request => request.schemaName === 'break_the_wall_runs' ? '{"runs": []}' : undefined as unknown as string);
    const result = await generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: [expect.stringMatching(/^runs · runs: /), expect.anything()] }, stats: { runs: { requests: 2, repairs: 1 } } });
    expect(await readdir(root)).toEqual([]);
  });

  it('refuses a question in another language than the content before sending anything', async () => {
    const { generator, request, seen } = await setup(story());
    const result = await generator.generate(request({ structure: gpt('m'), content: gpt('m') }, { language: 'it' }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'unsupported', reason: 'question-language' } });
    expect(seen).toHaveLength(0);
  });

  it('reports a provider failure from one part as itself, not as a cancellation, and sends no runs request (D21: the other parts finish)', async () => {
    const { generator, request, seen, root } = await setup(atlas(), request => {
      if (request.schemaName === 'break_the_wall_part' && request.messages[0].content.includes('PART TO WRITE: check')) throw new ProviderError(failure('usage-limit'));
      return undefined as unknown as string;
    });
    const result = await generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'usage-limit' } });
    expect(seen.some(x => x.request.schemaName === 'break_the_wall_runs')).toBe(false);
    expect(await readdir(root)).toEqual([]);
  });

  it('cancels between phases, refuses a second generation while one runs, and saves nothing', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { generator, request, root } = await setup(story(), async request => {
      if (request.schemaName === 'break_the_wall_part') await gate;
      return undefined as unknown as string;
    });
    const pending = generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {});
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(await generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {})).toMatchObject({ ok: false, failure: { code: 'busy' } });
    generator.cancel(); release();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect(await readdir(root)).toEqual([]);
  });

  it('routes local phases to the chosen local server, and refuses one off this machine before sending anything', async () => {
    const { generator, request, local, seen, chatgpt } = await setup(story());
    const ok = await generator.generate(request({ structure: gpt('strong'), content: llama }), () => {});
    expect(ok).toMatchObject({ ok: true, disassembly: { generation: { provider: 'chatgpt', model: 'strong + qwen.gguf' } } });
    expect(chatgpt.complete).toHaveBeenCalledTimes(1);
    expect(local).toHaveBeenCalledWith({ runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf' });
    seen.length = 0;
    const refused = await generator.generate(request({ structure: { ...llama, baseUrl: 'http://192.168.1.20:8080' }, content: llama }), () => {});
    expect(refused).toMatchObject({ ok: false, failure: { code: 'local-address' } });
    expect(seen).toHaveLength(0);
    const allLocal = await generator.generate(request({ structure: llama, content: llama }), () => {});
    expect(allLocal).toMatchObject({ ok: true, disassembly: { generation: { provider: 'local', runtime: 'llamacpp', model: 'qwen.gguf' } } });
  });

  it('refuses tampered sources from the renderer before any request is sent', async () => {
    const { generator, request, seen, sources } = await setup(story());
    const tampered: UserSource = { ...sources[0], text: 'altro' };
    const result = await generator.generate({ ...request({ structure: gpt('m'), content: gpt('m') }), sources: [tampered] }, () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'unsupported' } });
    expect(seen).toHaveLength(0);
  });

  // ---------- D19: a second repair, for lengths only ----------
  const bellWith = (drafts: ReturnType<typeof draftsFrom>, points: { text: string; mark: null }[]) => JSON.stringify({ ...drafts.contents[3], points });
  const isBell = (request: CompletionRequest) => request.schemaName === 'break_the_wall_part' && request.messages[0].content.includes('PART TO WRITE: bell');

  it('shortens a point still 3 characters over its limit after the repair with one more request, and accepts it (D19)', async () => {
    const { generator, request, seen, drafts } = await setup(story(), request => {
      if (request.schemaName === 'break_the_wall_shorten') return JSON.stringify({ texts: [{ path: 'points[0].text', text: 'The bell rings once the water passes the quay.' }] });
      return isBell(request) ? bellWith(drafts, [{ text: 'x'.repeat(133), mark: null }, { text: drafts.contents[3].points[1].text, mark: null }]) : undefined as unknown as string;
    });
    const progress: GenerationProgress[] = [];
    const result = await generator.generate(request({ structure: gpt('strong'), content: gpt('cheap') }), p => progress.push(p));
    expect(result).toMatchObject({ ok: true, stats: { content: { requests: drafts.structure.parts.length + 2, repairs: 2 } } });
    if (!result.ok) return;
    const shorten = seen.filter(x => x.request.schemaName === 'break_the_wall_shorten');
    expect(shorten).toHaveLength(1);
    expect(shorten[0].request).toMatchObject({ model: 'cheap', messages: [{ role: 'user' }] });
    expect(shorten[0].request.messages[0].content).toContain('- points[0].text (133 characters; at most 130): "xxx');
    expect(shorten[0].request.messages[0].content).toContain('CONTENT LANGUAGE: English (en)');
    expect(result.disassembly.parts.find(p => p.id === 'bell')!.points![0].text).toBe('The bell rings once the water passes the quay.');
    expect(progress.some(p => p.shortening && p.repairing && p.phase === 'content')).toBe(true);
  });

  it('refuses a shortened answer that leaves out a path, adds one, or is still over the limit (D19)', () => {
    const raw = JSON.stringify({ name: 'n'.repeat(50), points: [{ text: 'x'.repeat(133), mark: null }] });
    const texts = longTexts(raw, [{ path: 'points[0]', message: 'Point has 133 characters; at most 130' }, { path: 'name', message: 'Part name has 50 characters; at most 48' }])!;
    expect(texts.map(x => [x.path, x.length, x.limit])).toEqual([['points[0].text', 133, 130], ['name', 50, 48]]);
    const answer = (list: { path: string; text: string }[]) => JSON.stringify({ texts: list });
    expect(JSON.parse(applyShortened(raw, texts, answer([{ path: 'points[0].text', text: 'Short.' }, { path: 'name', text: 'Name' }])))).toEqual({ name: 'Name', points: [{ text: 'Short.', mark: null }] });
    expect(findings(() => applyShortened(raw, texts, answer([{ path: 'name', text: 'Name' }])))).not.toEqual([]);
    expect(findings(() => applyShortened(raw, texts, answer([{ path: 'name', text: 'Name' }, { path: 'name', text: 'Nom' }])))).toEqual([{ path: 'points[0].text', message: 'Not shortened' }, { path: 'name', message: 'Shortened more than once' }]);
    expect(findings(() => applyShortened(raw, texts, answer([{ path: 'points[0].text', text: 'Short.' }, { path: 'name', text: 'Name' }, { path: 'title', text: 'T' }])))).not.toEqual([]);
    expect(findings(() => applyShortened(raw, texts, answer([{ path: 'points[0].text', text: 'y'.repeat(131) }, { path: 'name', text: 'Name' }])))).toEqual([{ path: 'points[0].text', message: 'Text has 131 characters; at most 130' }]);
    // A finding that is not about a length, or a path that leads to no text, means the draft is wrong, not long.
    expect(longTexts(raw, [{ path: 'name', message: 'Part name has 50 characters; at most 48' }, { path: 'points', message: 'A top-level part needs 2–4 points; it has 1' }])).toBeUndefined();
    expect(longTexts(raw, [{ path: 'missing', message: 'Text has 50 characters; at most 48' }])).toBeUndefined();
  });

  it('fails the phase when the shortened answer is still too long, and sends no shorten request for a mix of findings (D19)', async () => {
    const still = await setup(story(), request => request.schemaName === 'break_the_wall_shorten'
      ? JSON.stringify({ texts: [{ path: 'points[0].text', text: 'y'.repeat(131) }] })
      : isBell(request) ? bellWith(still.drafts, [{ text: 'x'.repeat(133), mark: null }, { text: 'The bell rings.', mark: null }]) : undefined as unknown as string);
    expect(await still.generator.generate(still.request({ structure: gpt('m'), content: gpt('m') }), () => {})).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: ['part bell · points[0].text: Text has 131 characters; at most 130'] } });
    const mixed = await setup(story(), request => isBell(request) ? bellWith(mixed.drafts, [{ text: 'x'.repeat(2001), mark: null }, ...Array(4).fill({ text: 'The bell rings.', mark: null })]) : undefined as unknown as string);
    const result = await mixed.generator.generate(mixed.request({ structure: gpt('m'), content: gpt('m') }), () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'invalid-output' } });
    expect(mixed.seen.some(x => x.request.schemaName === 'break_the_wall_shorten')).toBe(false);
  });

  it('cancels during the shorten request without saving anything (D19)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let shortening = false;
    const { generator, request, root, drafts } = await setup(story(), async request => {
      if (request.schemaName === 'break_the_wall_shorten') { shortening = true; await gate; return JSON.stringify({ texts: [{ path: 'points[0].text', text: 'Short.' }] }); }
      return isBell(request) ? bellWith(drafts, [{ text: 'x'.repeat(133), mark: null }, { text: 'The bell rings.', mark: null }]) : undefined as unknown as string;
    });
    const pending = generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {});
    await vi.waitFor(() => expect(shortening).toBe(true));
    generator.cancel(); release();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect(await readdir(root)).toEqual([]);
  });

  // ---------- D20: a short lead, the details in the points ----------
  it('treats a lead over 100 characters as a length, which the shorten request fixes (D20)', async () => {
    const context = await setupFor(story());
    const long = structuredClone(context.drafts.structure); long.parts[1].role = `${long.parts[1].role} ${'and so on '.repeat(5)}`.slice(0, 105);
    expect(findings(() => acceptStructure(JSON.stringify(long), { sources: context.sources, goal: context.goal, language: 'en', meta }))).toEqual([{ path: 'parts[1].role', message: `Lead has 105 characters; at most ${LEAD_LIMIT}` }]);
    const { generator, request, seen } = await setup(story(), request => request.schemaName === 'break_the_wall_shorten'
      ? JSON.stringify({ texts: [{ path: 'parts[1].role', text: 'The town votes on the wall.' }] })
      : request.schemaName === 'break_the_wall_structure' ? JSON.stringify(long) : undefined as unknown as string);
    const result = await generator.generate(request({ structure: gpt('m'), content: gpt('m') }), () => {});
    expect(result).toMatchObject({ ok: true, stats: { structure: { requests: 3, repairs: 2 } } });
    if (result.ok) expect(result.disassembly.parts[1].role).toBe('The town votes on the wall.');
    expect(seen.map(x => x.request.schemaName).slice(0, 3)).toEqual(['break_the_wall_structure', 'break_the_wall_structure', 'break_the_wall_shorten']);
  });

  it('asks for leads of at most 100 characters and for points and explanations that add to them (D20)', () => {
    expect(STRUCTURE_INSTRUCTIONS).toContain("role: the part's lead, at most 100 characters");
    expect(CONTENT_INSTRUCTIONS).toContain('Never say the lead again');
    expect(EXPANSION_INSTRUCTIONS).toContain('role: its lead, at most 100 characters');
  });
});

describe('the restate check (D20)', () => {
  const millA = JSON.parse(readFileSync('tests/fixtures/d9-mill-setup-a.json', 'utf8')) as { parts: { role: string; points: string[] }[] };
  it('flags the points of the D9 Mill output of setup A that say their lead again', () => {
    const flagged = millA.parts.flatMap(p => p.points.filter(x => restates(x, p.role)));
    expect(flagged).toContain('La società può costringere un individuo contro la sua volontà solo per prevenire un danno agli altri.');
    expect(flagged).toContain('Mill fonda il limite alla coercizione sull\'utilità, non su un diritto astratto indipendente da essa.');
    expect(flagged.length).toBeGreaterThanOrEqual(6);
    // A point that adds a step or a limit is not a restatement, even when it shares a word or two.
    expect(restates('Chi necessita ancora di tutela deve essere protetto anche dalle proprie azioni.', millA.parts[2].role)).toBe(false);
  });

  it.each(PUBLIC_FIXTURES)('flags no point or explanation of the hand-made %s', path => {
    const d: Disassembly = fixture(path);
    const walk = (parts: Part[]): string[] => parts.flatMap(p => [...(p.points ?? []).filter(x => restates(x.text, p.role)).map(x => x.text), ...(p.explain && restates(p.explain, p.role) ? [p.explain] : []), ...walk(p.parts ?? [])]);
    expect(walk(d.parts)).toEqual([]);
  });

  it('locates a restated point in a content answer and a restated explanation in a split', async () => {
    const { sources, goal, drafts } = await setupFor(story());
    const lead = 'The council votes to raise a stone wall against the winter storms.';
    const structure = acceptStructure(JSON.stringify({ ...drafts.structure, parts: drafts.structure.parts.map((p, i) => i === 1 ? { ...p, role: lead } : p) }), { sources, goal, language: 'en', meta });
    const content = { ...drafts.contents[1], points: [{ text: 'The council votes for a stone wall against the storms of winter.', mark: null }, drafts.contents[1].points[1]] };
    expect(findings(() => acceptContent(JSON.stringify(content), structure, 1, 'en'))).toEqual([{ path: 'points[0]', message: expect.stringMatching(/^Says the lead again \("The council votes/) }]);
    const d = generatedFrom(await deepDisassembly(2));
    const split = splitAnswer(d, 'p2');
    split.parts[0] = { ...split.parts[0], role: lead, explain: 'The council votes to raise the stone wall against storms in winter.' };
    expect(findings(() => acceptExpansion(JSON.stringify(split), d, 'p2', { provider: 'chatgpt', model: 'm', createdAt: meta.createdAt }))).toContainEqual({ path: 'parts[0].explain', message: expect.stringMatching(/^Says the lead again/) });
  });
});

describe('suggested break-downs (D23)', () => {
  const suggestion = (question: string, parts = ['Storm', 'Vote', 'Wall'], cites = [{ source: '', from: 1, to: 4 }]) => ({ question, kind: 'story', parts, cites });
  it('accepts 3–5 distinct questions in the content language with ranges inside the sources', async () => {
    const { sources } = await setupFor(story());
    const cites = [{ source: sources[0].id, from: 1, to: 4 }];
    const ok = { suggestions: [suggestion('Why did the town vote to build the wall?', undefined, cites), suggestion('How did the storm reach the quay and the hall?', ['Storm', 'Quay', 'Hall'], cites), suggestion('What did the railway change for the quay?', ['Railway', 'Quay', 'Bell'], cites)] };
    expect(acceptSuggestions(JSON.stringify(ok), sources, 'en')).toHaveLength(3);
    expect(findings(() => acceptSuggestions(JSON.stringify({ suggestions: ok.suggestions.slice(0, 2) }), sources, 'en'))).not.toEqual([]);
    const bad = { suggestions: [ok.suggestions[0], { ...ok.suggestions[0], parts: ['Bell', 'Hall', 'Quay'] }, { ...ok.suggestions[1], question: 'Perché la città ha votato per costruire il muro?' }, { ...ok.suggestions[2], cites: [{ source: sources[0].id, from: 20, to: 40 }] }] };
    expect(findings(() => acceptSuggestions(JSON.stringify(bad), sources, 'en')).map(f => f.path)).toEqual(['suggestions[1].question', 'suggestions[2].question', 'suggestions[3].cites[0]']);
    expect(findings(() => acceptSuggestions(JSON.stringify({ suggestions: [...ok.suggestions, { ...ok.suggestions[0], question: 'Who rang the bell, and why then?' }] }), sources, 'en'))).toEqual([{ path: 'suggestions[3].parts', message: expect.stringMatching(/same parts/) }]);
    expect(findings(() => acceptSuggestions(JSON.stringify(ok), sources, 'en', ['Why did the town vote to build the wall?']))).toEqual([{ path: 'suggestions[0].question', message: expect.stringMatching(/Repeats another question/) }]);
    const long = { suggestions: [{ ...ok.suggestions[0], question: 'w'.repeat(161) }, ...ok.suggestions.slice(1)] };
    expect(findings(() => acceptSuggestions(JSON.stringify(long), sources, 'en'))).toEqual([{ path: 'suggestions[0].question', message: 'Text has 161 characters; at most 160' }]);
    expect(buildSuggestionInput(sources, 'en', '', ['An earlier question?'])).toMatch(/CONTENT LANGUAGE: English \(en\)\nPRIOR KNOWLEDGE: not given\nALREADY SHOWN \(propose different ones\):\n- An earlier question\?/);
  });
});
