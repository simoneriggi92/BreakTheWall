import { z } from 'zod';
import { allParts, divisible, DisassemblyError, isExpansionOf, validateDisassembly, type Disassembly, type Finding } from '../core/disassembly';
import {
  acceptContent, acceptExpansion, acceptRuns, acceptStructure, acceptSuggestions, applyShortened, assembleDisassembly, buildContentInput, buildExpansionInput,
  buildRepairRequest, buildRunsInput, buildShortenInput, buildStructureInput, buildSuggestionInput, CONTENT_INSTRUCTIONS, contentJsonSchema, expansionInstructions,
  expansionJsonSchema, generatedDisassemblyId, longTexts, RUNS_INSTRUCTIONS, runsJsonSchema, SHORTEN_INSTRUCTIONS, shortenJsonSchema, instructionsFor,
  structureJsonSchema, SUGGEST_INSTRUCTIONS, suggestionsJsonSchema, type ContentDraft, type ContentLanguage, type GenerationMeta, type RunsDraft, type StructureDraft,
} from '../core/disassembly-generation';
import { idSchema } from '../core/lesson';
import { detectLanguage } from '../core/generation';
import {
  failure, ProviderError, routeSchema, setupSchema, type DraftState, type ExpansionResult, type GenerationPhase, type GenerationPreview, type GenerationProgress,
  type GenerationResult, type GenerationRoute, type GenerationStats, type LocalModel, type PART_STATUSES, type PhaseStats, type ProviderFailure, type SuggestionResult,
} from '../core/provider';
import { goalSchema, SourceImportError, verifySelection } from '../core/source';
import type { Completer, CompletionRequest } from './completion';
import type { DraftStore, KeptDraft } from './generation-draft';

export type { Completer } from './completion';
export interface AcceptedDisassemblies { save(disassembly: Disassembly): Promise<Disassembly>; find?(id: string, revision: string): Promise<Disassembly | undefined> }
/** Moves the learner's progress to the revision that took a part apart; true when there was progress to move. */
export type CarryProgress = (previous: Disassembly, next: Disassembly) => Promise<boolean>;
export interface Routes { chatgpt: Completer; local: (target: LocalModel) => Completer }
/** Where a failed or cancelled generation keeps what was accepted (D21). */
export type Drafts = Pick<DraftStore, 'read' | 'state' | 'write' | 'clear'>;

/** Parts written at the same time: a hosted model serves several requests at once; a local server queues them anyway. */
const PARALLEL = { chatgpt: 3, local: 1 } as const;
const requestSchema = z.strictObject({ sources: z.unknown(), goal: goalSchema, language: z.enum(['it', 'en']), setup: setupSchema, resume: z.boolean().optional() });
const expansionSchema = z.strictObject({ disassemblyId: idSchema, revision: idSchema, part: idSchema, route: routeSchema });
const suggestionSchema = z.strictObject({ sources: z.unknown(), language: z.enum(['it', 'en']), priorKnowledge: goalSchema.shape.priorKnowledge, route: routeSchema, avoid: z.array(z.string().max(400)).max(20) });
const emptyStats = (): GenerationStats => ({ structure: blank(), content: blank(), runs: blank() });
const blank = () => ({ requests: 0, repairs: 0, sentChars: 0, receivedChars: 0, ms: 0 });
const located = (where: string) => (f: Finding) => `${where} · ${f.path || '(answer)'}: ${f.message}`;
type Mode = 'first' | 'repair' | 'shorten';
type Status = typeof PART_STATUSES[number];

/**
 * One request with at most one repair: the findings go back to the same route with the previous answer. When the
 * repair leaves only texts over their limits, one shorten request carries just those texts (D19); anything left after
 * it fails the phase.
 */
async function withRepair<T>(send: (body: CompletionRequest, mode: Mode) => Promise<string>, first: CompletionRequest, accept: (raw: string) => T, signal: AbortSignal, where: string, language: ContentLanguage): Promise<T> {
  const raw = await send(first, 'first');
  try { return accept(raw); }
  catch (error) {
    if (!(error instanceof DisassemblyError) || signal.aborted) throw error;
    const repaired = await send({ ...first, messages: [...first.messages, { role: 'assistant', content: raw }, { role: 'user', content: buildRepairRequest(error.findings) }] }, 'repair');
    try { return accept(repaired); }
    catch (again) {
      if (!(again instanceof DisassemblyError) || signal.aborted) throw again;
      const long = longTexts(repaired, again.findings);
      if (!long) throw new PhaseError(again.findings.map(located(where)));
      const answer = await send({ model: first.model, instructions: SHORTEN_INSTRUCTIONS, schemaName: 'break_the_wall_shorten', schema: shortenJsonSchema(long), messages: [{ role: 'user', content: buildShortenInput(long, language) }] }, 'shorten');
      try { return accept(applyShortened(repaired, long, answer)); }
      catch (last) { throw last instanceof DisassemblyError ? new PhaseError(last.findings.map(located(where))) : last; }
    }
  }
}
/** Counts a request in the phase's stats and reports its progress. Shorten requests count as repairs, and also on their own. */
async function counted(completer: Completer, body: CompletionRequest, signal: AbortSignal, stats: PhaseStats, mode: Mode, onReceived: (n: number) => void): Promise<string> {
  const started = Date.now();
  stats.requests++; if (mode !== 'first') stats.repairs++; if (mode === 'shorten') stats.shortens = (stats.shortens ?? 0) + 1;
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

/**
 * Runs `work` over the given items with at most `limit` at a time. A failing item does not stop the others: they
 * finish and are kept. Returns the first failure, if any.
 */
async function pool(items: number[], limit: number, work: (index: number) => Promise<void>): Promise<unknown> {
  let next = 0; let first: { error: unknown } | undefined;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = items[next++];
      try { await work(i); } catch (error) { first ??= { error }; }
    }
  }));
  return first?.error;
}
const parsed = <T>(accept: (raw: string) => T, value: unknown): T | undefined => {
  if (value === null || value === undefined) return undefined;
  try { return accept(JSON.stringify(value)); } catch { return undefined; }
};

/**
 * Re-checks the selection, then asks for the structure, each part's content, and the runs, validating each phase
 * before the next one starts. Every phase may be repaired once, on both routes: a forgotten range or a giveaway option
 * is cheap to fix and costly to ship. Each accepted step is kept in a draft, so a failure late in a generation costs
 * only what is missing (D21). Nothing is saved as a disassembly before the final validation.
 */
export class Generator {
  private active?: AbortController;
  private suggesting?: AbortController;
  constructor(private routes: Routes, private store: AcceptedDisassemblies, private now = () => new Date(), private carry?: CarryProgress, private drafts?: Drafts) {}
  private completer(route: GenerationRoute): Completer {
    return route.provider === 'local' ? this.routes.local({ runtime: route.runtime, baseUrl: route.baseUrl, model: route.model }) : this.routes.chatgpt;
  }

  async draft(): Promise<DraftState> { return this.drafts ? this.drafts.state() : { draft: null }; }

  async generate(input: unknown, onProgress: (progress: GenerationProgress) => void): Promise<GenerationResult> {
    if (this.active) return { ok: false, failure: failure('busy') };
    // Starting a generation stops a suggestion request still running (D23).
    this.suggesting?.abort();
    const controller = new AbortController();
    this.active = controller;
    let stats = emptyStats();
    let saving = Promise.resolve();
    try {
      const request = requestSchema.parse(input);
      const sources = await verifySelection(request.sources);
      const { goal, language, setup } = request;
      // The question is stored with the disassembly, whose language it must match; asking first costs no request.
      const asked = detectLanguage(goal.outcome, 1);
      if (asked && asked !== language) return { ok: false, failure: failure('unsupported', { reason: 'question-language', message: 'La domanda è in un’altra lingua rispetto al contenuto scelto.' }) };

      // A resumed generation keeps the request it answers; a new one deletes any earlier draft.
      const key = { sources: sources.map(s => ({ id: s.id, sha256: s.sha256 })), question: goal.outcome, language };
      let kept: KeptDraft | undefined;
      if (request.resume) {
        kept = (await this.drafts?.read())?.draft;
        const same = kept && JSON.stringify([...kept.sources].sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify([...key.sources].sort((a, b) => a.id.localeCompare(b.id)))
          && kept.question.trim() === goal.outcome.trim() && kept.language === language;
        if (!same) return { ok: false, failure: failure('unsupported', { reason: 'draft-changed', message: 'Le fonti, la domanda o la lingua non sono più quelle della generazione interrotta.' }) };
      } else await this.drafts?.clear();

      const created = kept ? new Date(kept.meta.createdAt) : this.now();
      // A different model may finish a kept draft; the stored origin names both phases' models.
      const meta = describe(kept?.setup.structure ?? setup.structure, setup.content, kept?.meta.id ?? generatedDisassemblyId(created), created.toISOString());
      if (kept) stats = structuredClone(kept.stats);
      const base = { sources, goal, language, meta };
      let structure = kept && parsed(raw => acceptStructure(raw, base), kept.structure);
      const contents: (ContentDraft | undefined)[] = structure ? (kept?.contents ?? []).map((c, i) => parsed(raw => acceptContent(raw, structure!, i, language), c)) : [];
      let runs: RunsDraft | undefined = structure && contents.length === structure.parts.length && contents.every(Boolean)
        ? parsed(raw => acceptRuns(raw, { ...base, structure: structure!, contents: contents as ContentDraft[] }), kept?.runs) : undefined;
      const status: Status[] = structure ? structure.parts.map((_, i) => contents[i] ? 'done' : 'waiting') : [];

      let requests = 0;
      const preview = (): GenerationPreview | undefined => structure && {
        parts: structure.parts.map((p, i) => ({
          id: p.id, name: p.name, kind: p.kind, icon: p.icon, subParts: p.parts?.length ?? 0, status: status[i],
          ...(contents[i] ? { lead: p.role, points: contents[i]!.points.map(x => x.text) } : {}),
        })),
        joints: structure.joints.map(({ from, to, type, label }) => ({ from, to, type, label })),
      };
      const report = (phase: GenerationPhase, mode: Mode, received: number) => onProgress({
        phase, repairing: mode !== 'first', ...(mode === 'shorten' ? { shortening: true } : {}), received, requests,
        ...(phase === 'content' ? { part: status.filter(x => x === 'done').length, parts: structure?.parts.length } : {}),
        ...(structure ? { preview: preview() } : {}),
      });
      // Writes are queued, so the file always holds the latest accepted state; a failed write never stops generation.
      const keep = () => {
        if (!this.drafts || !structure) return;
        const snapshot: KeptDraft = { version: 1, ...key, setup: kept?.setup ?? setup, meta: { id: meta.id, createdAt: meta.createdAt }, structure, contents: structure.parts.map((_, i) => contents[i] ?? null), runs: runs ?? null, stats: structuredClone(stats) };
        const drafts = this.drafts;
        saving = saving.then(() => drafts.write(snapshot)).catch(error => console.error('[draft]', (error as Error)?.message));
      };

      const ask = <T>(phase: GenerationPhase, route: GenerationRoute, first: CompletionRequest, accept: (raw: string) => T, signal: AbortSignal, where: string): Promise<T> =>
        withRepair((body, mode) => { requests++; report(phase, mode, 0); return counted(this.completer(route), body, signal, stats[phase], mode, n => report(phase, mode, n)); }, first, accept, signal, where, language);

      if (!structure) {
        structure = await ask('structure', setup.structure, {
          model: setup.structure.model, instructions: instructionsFor(goal), schemaName: 'break_the_wall_structure', schema: structureJsonSchema(sources, goal),
          messages: [{ role: 'user', content: buildStructureInput(sources, goal, language) }],
        }, raw => acceptStructure(raw, base), controller.signal, 'structure');
        status.push(...structure.parts.map((): Status => 'waiting'));
        keep();
      }
      const fixed: StructureDraft = structure;

      // Parts no longer stop each other: the ones still running finish and are kept. Cancelling stops them all.
      const missing = fixed.parts.map((_, i) => i).filter(i => !contents[i]);
      report('content', 'first', 0);
      const failed = await pool(missing, PARALLEL[setup.content.provider], async index => {
        status[index] = 'writing';
        try {
          contents[index] = await ask('content', setup.content, {
            model: setup.content.model, instructions: CONTENT_INSTRUCTIONS, schemaName: 'break_the_wall_part', schema: contentJsonSchema(fixed, index),
            messages: [{ role: 'user', content: buildContentInput(sources, goal, language, fixed, index) }],
          }, raw => acceptContent(raw, fixed, index, language), controller.signal, `part ${fixed.parts[index].id}`);
          status[index] = 'done'; keep();
        } catch (error) { status[index] = controller.signal.aborted ? 'waiting' : 'failed'; throw error; }
        finally { report('content', 'first', 0); }
      });
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled'), stats };
      if (failed) throw failed;
      const written = contents as ContentDraft[];

      if (!runs) {
        runs = await ask('runs', setup.content, {
          model: setup.content.model, instructions: RUNS_INSTRUCTIONS, schemaName: 'break_the_wall_runs', schema: runsJsonSchema(sources, fixed),
          messages: [{ role: 'user', content: buildRunsInput(sources, goal, language, fixed, written) }],
        }, raw => acceptRuns(raw, { ...base, structure: fixed, contents: written }), controller.signal, 'runs');
        keep();
      }

      const disassembly = await assembleDisassembly({ ...base, structure: fixed, contents: written, runs });
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled'), stats };
      const saved = await this.store.save(disassembly);
      await saving; await this.drafts?.clear();
      return { ok: true, disassembly: saved, stats };
    } catch (error) {
      return { ok: false, failure: failureOf(error, controller.signal.aborted), stats };
    } finally {
      await saving;
      this.active = undefined;
    }
  }

  /**
   * Suggested break-downs (D23): one request to the content route, one repair, sent only when the learner asks.
   * Starting a generation cancels it; nothing is stored.
   */
  async suggest(input: unknown): Promise<SuggestionResult> {
    if (this.active || this.suggesting) return { ok: false, failure: failure('busy') };
    const controller = new AbortController();
    this.suggesting = controller;
    try {
      const request = suggestionSchema.parse(input);
      const sources = await verifySelection(request.sources);
      const { route, language, avoid } = request;
      const suggestions = await withRepair((body, mode) => counted(this.completer(route), body, controller.signal, blank(), mode, () => {}), {
        model: route.model, instructions: SUGGEST_INSTRUCTIONS, schemaName: 'break_the_wall_suggestions', schema: suggestionsJsonSchema(sources),
        messages: [{ role: 'user', content: buildSuggestionInput(sources, language, request.priorKnowledge, avoid) }],
      }, raw => acceptSuggestions(raw, sources, language, avoid), controller.signal, 'suggestions', language);
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled') };
      return { ok: true, suggestions };
    } catch (error) {
      return { ok: false, failure: failureOf(error, controller.signal.aborted) };
    } finally {
      if (this.suggesting === controller) this.suggesting = undefined;
    }
  }
  cancelSuggestions() { this.suggesting?.abort(); }

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
      const report = (mode: Mode, received: number) => onProgress({ phase: 'structure', repairing: mode !== 'first', ...(mode === 'shorten' ? { shortening: true } : {}), received, requests: stats.requests });
      const next = await withRepair((body, mode) => { const sent = counted(this.completer(route), body, controller.signal, stats, mode, n => report(mode, n)); report(mode, 0); return sent; }, {
        model: route.model, instructions: expansionInstructions(!!previous.question), schemaName: 'break_the_wall_expansion', schema: expansionJsonSchema(previous, part.id),
        messages: [{ role: 'user', content: buildExpansionInput(previous, part.id) }],
      }, raw => acceptExpansion(raw, previous, part.id, meta), controller.signal, `part ${part.id}`, previous.language);
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
