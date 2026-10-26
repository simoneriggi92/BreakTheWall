// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { billOfMaterials, DisassemblyError, type Disassembly, type Part } from '../src/core/disassembly';
import {
  acceptContent, acceptRuns, acceptStructure, answerLengthRatio, assembleDisassembly, buildContentInput, buildStructureInput, compose,
  contentJsonSchema, defaultContentLanguage, runsJsonSchema, structureJsonSchema, type GenerationMeta,
} from '../src/core/disassembly-generation';
import { failure, ProviderError, type GenerationProgress } from '../src/core/provider';
import type { UserSource } from '../src/core/source';
import type { CompletionRequest } from '../src/desktop/completion';
import { DisassemblyStore } from '../src/desktop/disassembly-store';
import { Generator } from '../src/desktop/generator';
import { atlas, fixture, mill, PUBLIC_FIXTURES, story } from './disassemblies';
import { draftsFrom, pastedSource, scriptedAnswer } from './disassembly-drafts';

const meta: GenerationMeta = { id: 'g-test', createdAt: '2026-10-26T10:00:00.000Z', provider: 'chatgpt', model: 'model-a' };
const goalOf = (d: Disassembly) => ({ outcome: d.question, priorKnowledge: '' });
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
    expect(findings(() => acceptRuns(JSON.stringify(drafts.runs), base))).toEqual([]);
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
      const fallback = scriptedAnswer(context.drafts, request.schemaName, request.messages[0].content);
      const own = answer ? await answer(request, seen.length) : undefined;
      return own ?? fallback;
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

  it('reports a provider failure from one part as itself, not as a cancellation, and stops the other parts', async () => {
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
});
