import { z } from 'zod';
import { assembleLesson, buildGenerationInput, buildRepairMessage, draftJsonSchema, GENERATION_INSTRUCTIONS, generatedLessonId } from '../core/generation';
import { LessonError, type Lesson } from '../core/lesson';
import { failure, ProviderError, routeSchema, type GenerationProgress, type GenerationResult, type LocalModel } from '../core/provider';
import { goalSchema, SourceImportError, verifySelection } from '../core/source';
import type { Completer, CompletionRequest } from './completion';

export type { Completer } from './completion';
export interface AcceptedLessons { save(lesson: Lesson): Promise<Lesson> }
export interface Routes { chatgpt: Completer; local: (target: LocalModel) => Completer }

/**
 * Re-check the selection, ask the chosen route for a typed draft, validate the completed result, then save.
 * Local results get one repair request with the validator's findings: the trial showed structural slips there,
 * and a local retry costs no plan usage. Nothing is written before validation, so a failure or cancellation
 * leaves earlier lessons untouched.
 */
export class Generator {
  private active?: AbortController;
  private routes: Routes;
  constructor(routes: Routes | Completer, private lessons: AcceptedLessons, private now = () => new Date()) {
    this.routes = 'chatgpt' in routes ? routes : { chatgpt: routes, local: () => { throw new ProviderError(failure('unsupported')); } };
  }

  async generate(input: unknown, onProgress: (progress: GenerationProgress) => void): Promise<GenerationResult> {
    if (this.active) return { ok: false, failure: failure('busy') };
    const controller = new AbortController();
    this.active = controller;
    try {
      const request = z.strictObject({ sources: z.unknown(), goal: goalSchema, route: routeSchema }).parse(input);
      const sources = await verifySelection(request.sources);
      const { route } = request;
      const completer = route.provider === 'local' ? this.routes.local({ runtime: route.runtime, baseUrl: route.baseUrl, model: route.model }) : this.routes.chatgpt;
      const first: CompletionRequest = {
        model: route.model, instructions: GENERATION_INSTRUCTIONS, schemaName: 'break_the_wall_lesson', schema: draftJsonSchema(sources),
        messages: [{ role: 'user', content: buildGenerationInput(sources, request.goal) }],
      };
      const created = this.now();
      const meta = { id: generatedLessonId(created), model: route.model, createdAt: created.toISOString(), provider: route.provider, ...(route.provider === 'local' ? { runtime: route.runtime } : {}) };
      const raw = await completer.complete(first, controller.signal, received => onProgress({ received, phase: 'generating' }));
      let lesson: Lesson;
      try { lesson = await assembleLesson(raw, sources, request.goal, meta); }
      catch (error) {
        if (!(error instanceof LessonError) || route.provider !== 'local' || controller.signal.aborted) throw error;
        onProgress({ received: 0, phase: 'repairing' });
        const repair: CompletionRequest = { ...first, messages: [...first.messages, { role: 'assistant', content: raw }, { role: 'user', content: buildRepairMessage(error.issues) }] };
        const repaired = await completer.complete(repair, controller.signal, received => onProgress({ received, phase: 'repairing' }));
        try { lesson = await assembleLesson(repaired, sources, request.goal, meta); }
        catch (again) { throw again instanceof LessonError ? new LessonError(['Anche dopo una correzione automatica:', ...again.issues]) : again; }
      }
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled') };
      return { ok: true, lesson: await this.lessons.save(lesson) };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled') };
      if (error instanceof ProviderError) return { ok: false, failure: error.failure };
      if (error instanceof LessonError) return { ok: false, failure: failure('invalid-output', { issues: error.issues.slice(0, 8) }) };
      if (error instanceof SourceImportError) return { ok: false, failure: failure('unsupported', { message: error.message }) };
      if (error instanceof z.ZodError) return { ok: false, failure: error.issues.some(x => x.message === 'Indirizzo non locale') ? failure('local-address') : failure('unsupported', { message: error.issues[0]?.message ?? 'Richiesta non valida.' }) };
      throw error;
    } finally {
      this.active = undefined;
    }
  }
  cancel() { this.active?.abort(); }
}
