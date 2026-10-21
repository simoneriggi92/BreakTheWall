import { z } from 'zod';
import { assembleLesson, buildGenerationInput, draftJsonSchema, GENERATION_INSTRUCTIONS, generatedLessonId } from '../core/generation';
import { LessonError, type Lesson } from '../core/lesson';
import { failure, ProviderError, type GenerationResult } from '../core/provider';
import { goalSchema, SourceImportError, verifySelection } from '../core/source';
import type { ResponseBody } from './chatgpt/responses';

export interface Completer { complete(body: ResponseBody, signal: AbortSignal, onProgress: (received: number) => void): Promise<string> }
export interface AcceptedLessons { save(lesson: Lesson): Promise<Lesson> }

/**
 * One bounded request per lesson: re-check the selection, ask for a typed draft, validate the completed result,
 * then save. Nothing is written before validation, so a failure or cancellation leaves earlier lessons untouched.
 */
export class Generator {
  private active?: AbortController;
  constructor(private completer: Completer, private lessons: AcceptedLessons, private now = () => new Date()) {}

  async generate(input: unknown, onProgress: (received: number) => void): Promise<GenerationResult> {
    if (this.active) return { ok: false, failure: failure('busy') };
    const controller = new AbortController();
    this.active = controller;
    try {
      const request = z.strictObject({ sources: z.unknown(), goal: goalSchema, model: z.string().min(1).max(100) }).parse(input);
      const sources = await verifySelection(request.sources);
      const body: ResponseBody = {
        model: request.model, instructions: GENERATION_INSTRUCTIONS,
        input: [{ role: 'user', content: buildGenerationInput(sources, request.goal) }],
        text: { format: { type: 'json_schema', name: 'break_the_wall_lesson', strict: true, schema: draftJsonSchema } },
      };
      const raw = await this.completer.complete(body, controller.signal, onProgress);
      const created = this.now();
      const lesson = await assembleLesson(raw, sources, request.goal, { id: generatedLessonId(created), model: request.model, createdAt: created.toISOString() });
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled') };
      return { ok: true, lesson: await this.lessons.save(lesson) };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, failure: failure('cancelled') };
      if (error instanceof ProviderError) return { ok: false, failure: error.failure };
      if (error instanceof LessonError) return { ok: false, failure: failure('invalid-output', { issues: error.issues.slice(0, 8) }) };
      if (error instanceof SourceImportError) return { ok: false, failure: failure('unsupported', { message: error.message }) };
      if (error instanceof z.ZodError) return { ok: false, failure: failure('unsupported', { message: error.issues[0]?.message ?? 'Richiesta non valida.' }) };
      throw error;
    } finally {
      this.active = undefined;
    }
  }
  cancel() { this.active?.abort(); }
}
