import { z } from 'zod';
import { allParts, divisible, DisassemblyError, isExpansionOf, validateDisassembly, type Disassembly, type Finding } from '../core/disassembly';
import {
  acceptContent, acceptExpansion, acceptRuns, acceptStructure, assembleDisassembly, buildContentInput, buildExpansionInput, buildRepairRequest, buildRunsInput,
  buildStructureInput, CONTENT_INSTRUCTIONS, contentJsonSchema, EXPANSION_INSTRUCTIONS, expansionJsonSchema, generatedDisassemblyId, RUNS_INSTRUCTIONS,
  runsJsonSchema, STRUCTURE_INSTRUCTIONS, structureJsonSchema, type ContentDraft, type GenerationMeta,
} from '../core/disassembly-generation';
import { idSchema } from '../core/lesson';
import { detectLanguage } from '../core/generation';
import {
  failure, ProviderError, routeSchema, setupSchema, type ExpansionResult, type GenerationPhase, type GenerationProgress, type GenerationResult, type GenerationRoute,
  type GenerationStats, type LocalModel, type PhaseStats, type ProviderFailure,
} from '../core/provider';
import { goalSchema, SourceImportError, verifySelection } from '../core/source';
import type { Completer, CompletionRequest } from './completion';

export type { Completer } from './completion';
export interface AcceptedDisassemblies { save(disassembly: Disassembly): Promise<Disassembly>; find?(id: string, revision: string): Promise<Disassembly | undefined> }
/** Moves the learner's progress to the revision that took a part apart; true when there was progress to move. */
export type CarryProgress = (previous: Disassembly, next: Disassembly) => Promise<boolean>;
export interface Routes { chatgpt: Completer; local: (target: LocalModel) => Completer }

/** Parts written at the same time: a hosted model serves several requests at once; a local server queues them anyway. */
const PARALLEL = { chatgpt: 3, local: 1 } as const;
const requestSchema = z.strictObject({ sources: z.unknown(), goal: goalSchema, language: z.enum(['it', 'en']), setup: setupSchema });
const expansionSchema = z.strictObject({ disassemblyId: idSchema, revision: idSchema, part: idSchema, route: routeSchema });
const emptyStats = (): GenerationStats => ({ structure: blank(), content: blank(), runs: blank() });
const blank = () => ({ requests: 0, repairs: 0, sentChars: 0, receivedChars: 0, ms: 0 });
const located = (where: string) => (f: Finding) => `${where} · ${f.path || '(answer)'}: ${f.message}`;

/** One request with at most one repair: the findings go back to the same route with the previous answer. */
async function withRepair<T>(send: (body: CompletionRequest, repairing: boolean) => Promise<string>, first: CompletionRequest, accept: (raw: string) => T, signal: AbortSignal, where: string): Promise<T> {
  const raw = await send(first, false);
  try { return accept(raw); }
  catch (error) {
    if (!(error instanceof DisassemblyError) || signal.aborted) throw error;
    const repaired = await send({ ...first, messages: [...first.messages, { role: 'assistant', content: raw }, { role: 'user', content: buildRepairRequest(error.findings) }] }, true);
    try { return accept(repaired); }
    catch (again) { throw again instanceof DisassemblyError ? new PhaseError(again.findings.map(located(where))) : again; }
  }
}
/** Counts a request in the phase's stats and reports its progress. */
async function counted(completer: Completer, body: CompletionRequest, signal: AbortSignal, stats: PhaseStats, repairing: boolean, onReceived: (n: number) => void): Promise<string> {
  const started = Date.now();
  stats.requests++; if (repairing) stats.repairs++;
  stats.sentChars += body.instructions.length + body.messages.reduce((sum, m) => sum + m.content.length, 0);
  let received = 0;
  try { return await completer.complete(body, signal, n => { received = n; onReceived(n); }); }
  finally { stats.receivedChars += received; stats.ms += Date.now() - started; }
}
/** Errors that end a request, as the failure the learner sees. */
function failureOf(error: unknown, aborted: boolean): ProviderFailure {
  if (aborted) return failure('cancelled');
  if (error instanceof ProviderError) return error.failure;
  if (error instanceof PhaseError) return failure('invalid-output', { issues: error.issues.slice(0, 8) });
  if (error instanceof DisassemblyError) return failure('invalid-output', { issues: error.findings.slice(0, 8).map(located('disassembly')) });
  if (error instanceof SourceImportError) return failure('unsupported', { message: error.message });
  if (error instanceof z.ZodError) return error.issues.some(x => x.message === 'Indirizzo non locale') ? failure('local-address') : failure('unsupported', { message: error.issues[0]?.message ?? 'Richiesta non valida.' });
  throw error;
}

/** Runs `work` over `count` items with at most `limit` at a time, in item order. The first failure rejects the whole. */
async function pool<T>(count: number, limit: number, work: (index: number) => Promise<T>): Promise<T[]> {
  const results: T[] = new Array(count);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, count) }, async () => { while (next < count) { const i = next++; results[i] = await work(i); } }));
  return results;
}

/**
 * Re-checks the selection, then asks for the structure, each part's content, and the runs, validating each phase
 * before the next one starts. Every phase may be repaired once, on both routes: a forgotten range or a giveaway option
 * is cheap to fix and costly to ship. Nothing is written before the final validation, so a failure or cancellation
 * leaves earlier disassemblies untouched.
 */
export class Generator {
  private active?: AbortController;
  constructor(private routes: Routes, private store: AcceptedDisassemblies, private now = () => new Date(), private carry?: CarryProgress) {}
  private completer(route: GenerationRoute): Completer {
    return route.provider === 'local' ? this.routes.local({ runtime: route.runtime, baseUrl: route.baseUrl, model: route.model }) : this.routes.chatgpt;
  }

  async generate(input: unknown, onProgress: (progress: GenerationProgress) => void): Promise<GenerationResult> {
    if (this.active) return { ok: false, failure: failure('busy') };
    const controller = new AbortController();
    this.active = controller;
    const stats = emptyStats();
    try {
      const request = requestSchema.parse(input);
      const sources = await verifySelection(request.sources);
      const { goal, language, setup } = request;
      // The question is stored with the disassembly, whose language it must match; asking first costs no request.
      const asked = detectLanguage(goal.outcome, 1);
      if (asked && asked !== language) return { ok: false, failure: failure('unsupported', { reason: 'question-language', message: 'La domanda è in un’altra lingua rispetto al contenuto scelto.' }) };
      const created = this.now();
      const meta = describe(setup.structure, setup.content, generatedDisassemblyId(created), created.toISOString());
      let requests = 0; let partsDone = 0;
      let structure: ReturnType<typeof acceptStructure> | undefined;
      const report = (phase: GenerationPhase, repairing: boolean, received: number) => onProgress({ phase, repairing, received, requests, ...(phase === 'content' ? { part: partsDone, parts: structure?.parts.length } : {}) });

      const ask = <T>(phase: GenerationPhase, route: GenerationRoute, first: CompletionRequest, accept: (raw: string) => T, signal: AbortSignal, where: string): Promise<T> =>
        withRepair((body, repairing) => { requests++; report(phase, repairing, 0); return counted(this.completer(route), body, signal, stats[phase], repairing, n => report(phase, repairing, n)); }, first, accept, signal, where);

      const base = { sources, goal, language, meta };
      structure = await ask('structure', setup.structure, {
        model: setup.structure.model, instructions: STRUCTURE_INSTRUCTIONS, schemaName: 'break_the_wall_structure', schema: structureJsonSchema(sources),
        messages: [{ role: 'user', content: buildStructureInput(sources, goal, language) }],
      }, raw => acceptStructure(raw, base), controller.signal, 'structure');
      const fixed = structure;

      // A failing part stops the others at once; its own error, not the cancellation, is what the learner sees.
      const parts = new AbortController();
      const stop = () => parts.abort();
      controller.signal.addEventListener('abort', stop);
      let contents: ContentDraft[];
      try {
        contents = await pool(fixed.parts.length, PARALLEL[setup.content.provider], async index => {
          const content = await ask('content', setup.content, {
            model: setup.content.model, instructions: CONTENT_INSTRUCTIONS, schemaName: 'break_the_wall_part', schema: contentJsonSchema(fixed, index),
            messages: [{ role: 'user', content: buildContentInput(sources, goal, language, fixed, index) }],
          }, raw => acceptContent(raw, fixed, index, language), parts.signal, `part ${fixed.parts[index].id}`);
          partsDone++; report('content', false, 0);
          return content;
        });
      } catch (error) { parts.abort(); throw error; }
      finally { controller.signal.removeEventListener('abort', stop); }
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled'), stats };

      const runs = await ask('runs', setup.content, {
        model: setup.content.model, instructions: RUNS_INSTRUCTIONS, schemaName: 'break_the_wall_runs', schema: runsJsonSchema(sources, fixed),
        messages: [{ role: 'user', content: buildRunsInput(sources, goal, language, fixed, contents) }],
      }, raw => acceptRuns(raw, { ...base, structure: fixed, contents }), controller.signal, 'runs');

      const disassembly = await assembleDisassembly({ ...base, structure: fixed, contents, runs });
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled'), stats };
      return { ok: true, disassembly: await this.store.save(disassembly), stats };
    } catch (error) {
      return { ok: false, failure: failureOf(error, controller.signal.aborted), stats };
    } finally {
      this.active = undefined;
    }
  }

  /**
   * Takes one part of a saved generated disassembly apart: one request carrying only the part's lines, one repair.
   * The result must be an expansion of the saved revision, so the learner's progress can follow it. On failure or
   * cancellation nothing changes.
   */
  async expand(input: unknown, onProgress: (progress: GenerationProgress) => void): Promise<ExpansionResult> {
    if (this.active) return { ok: false, failure: failure('busy') };
    const controller = new AbortController();
    this.active = controller;
    const stats = blank();
    try {
      const request = expansionSchema.parse(input);
      const previous = await this.store.find?.(request.disassemblyId, request.revision);
      const part = previous && allParts(previous).find(x => x.part.id === request.part)?.part;
      if (!previous || previous.kind !== 'generated' || !part || part.parts) return { ok: false, failure: failure('unsupported', { message: 'Questo pezzo non può essere smontato da qui.' }) };
      if (!divisible(previous, part)) return { ok: false, failure: failure('unsupported', { reason: 'part-not-divisible', message: 'Il pezzo cita troppe poche righe per essere smontato.' }) };
      const { route } = request;
      const meta = { provider: route.provider, ...(route.provider === 'local' ? { runtime: route.runtime } : {}), model: route.model, createdAt: this.now().toISOString() };
      const report = (repairing: boolean, received: number) => onProgress({ phase: 'structure', repairing, received, requests: stats.requests });
      const next = await withRepair((body, repairing) => { const sent = counted(this.completer(route), body, controller.signal, stats, repairing, n => report(repairing, n)); report(repairing, 0); return sent; }, {
        model: route.model, instructions: EXPANSION_INSTRUCTIONS, schemaName: 'break_the_wall_expansion', schema: expansionJsonSchema(previous, part.id),
        messages: [{ role: 'user', content: buildExpansionInput(previous, part.id) }],
      }, raw => acceptExpansion(raw, previous, part.id, meta), controller.signal, `part ${part.id}`);
      const checked = await validateDisassembly(next);
      if (isExpansionOf(checked, previous) !== part.id) throw new DisassemblyError([{ path: '', message: 'The new revision changes more than the part taken apart' }]);
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled'), stats };
      const saved = await this.store.save(checked);
      return { ok: true, disassembly: saved, moved: await this.carry?.(previous, saved) ?? false, stats };
    } catch (error) {
      return { ok: false, failure: failureOf(error, controller.signal.aborted), stats };
    } finally {
      this.active = undefined;
    }
  }
  cancel() { this.active?.abort(); }
}

/** Findings that survived a repair, already located by phase for the learner and the logs. */
class PhaseError extends Error {
  constructor(public readonly issues: string[]) { super(issues.join('\n')); this.name = 'PhaseError'; }
}

/** The stored origin names one provider: ChatGPT whenever any phase sent the sources to OpenAI. */
function describe(structure: GenerationRoute, content: GenerationRoute, id: string, createdAt: string): GenerationMeta {
  const provider = structure.provider === 'chatgpt' || content.provider === 'chatgpt' ? 'chatgpt' : 'local';
  const runtime = structure.provider === 'local' && content.provider === 'local' && structure.runtime === content.runtime ? structure.runtime : undefined;
  const model = structure.model === content.model ? structure.model : `${structure.model} + ${content.model}`;
  return { id, createdAt, provider, ...(runtime ? { runtime } : {}), model: model.slice(0, 200) };
}
