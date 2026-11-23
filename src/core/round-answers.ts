import { z } from 'zod';
import { questionSchema, type Question } from './round';

/**
 * What the person gives a round and what returns to the agent (#95). The page builds the message live from the same
 * function the server sends with, so "what the agent receives" is exactly what it receives.
 */

/** A Claude Code session id; it names a folder on disk, so nothing but letters, digits, `-` and `_`. */
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);

/** No options list yet (#96): a question takes the recommendation, no choice, or only a note. */
export const answerSchema = z.strictObject({
  choice: z.enum(['recommendation', 'none']).optional(),
  note: z.string().max(50_000),
});
export const draftSchema = z.strictObject({
  /** One per round; it returns at the top of the message. */
  generalNote: z.string().max(50_000),
  /** Keyed by question number. */
  answers: z.record(z.string().regex(/^\d{1,3}$/), answerSchema),
});
export type Answer = z.infer<typeof answerSchema>;
export type Draft = z.infer<typeof draftSchema>;
export const emptyDraft = (): Draft => ({ generalNote: '', answers: {} });

export const messageLanguageSchema = z.enum(['it', 'en']);
export type MessageLanguage = z.infer<typeof messageLanguageSchema>;

/** The round as the page reads it from the server. */
export const roundViewSchema = z.strictObject({
  session: sessionIdSchema,
  number: z.number().int().min(1),
  receivedAt: z.iso.datetime(),
  turnText: z.string(),
  questions: z.array(questionSchema).min(1),
  draft: draftSchema,
  /** The message exactly as delivered, once sent; the round is then read-only. */
  sent: z.strictObject({ message: z.string(), at: z.iso.datetime() }).nullable(),
  /** A later round of the same session arrived: this one no longer takes answers. */
  superseded: z.boolean(),
});
export type RoundView = z.infer<typeof roundViewSchema>;

export const isAnswered = (answer: Answer | undefined) => !!answer && (answer.choice !== undefined || answer.note.trim() !== '');

/** The message's fixed words follow the page's interface language. */
const WORDS: Record<MessageLanguage, { recommendation: string; none: string; noAnswer: string }> = {
  it: { recommendation: 'raccomandazione', none: 'nessuna scelta', noAnswer: 'nessuna risposta' },
  en: { recommendation: 'recommendation', none: 'no choice', noAnswer: 'no answer' },
};

/**
 * Plain Markdown that reads as the person's own words: the general note first, then every question by number and
 * title, so it still reads after compaction, the choice on the title line and the note indented below.
 */
export function returnMessage(questions: readonly Question[], draft: Draft, language: MessageLanguage): string {
  const words = WORDS[language];
  const lines: string[] = [];
  const general = draft.generalNote.trim();
  if (general) lines.push(general, '');
  for (const question of questions) {
    const answer = draft.answers[String(question.number)];
    const title = `**Q${question.number} · ${question.title}**`;
    if (!isAnswered(answer)) { lines.push(`${title} ${words.noAnswer}`); continue; }
    const choice = answer!.choice === 'recommendation' ? words.recommendation : answer!.choice === 'none' ? words.none : '';
    lines.push(choice ? `${title} ${choice}` : title);
    const note = answer!.note.trim();
    if (note) lines.push(...note.split(/\r?\n/).map(line => line.trim() ? `  ${line}` : ''));
  }
  return lines.join('\n');
}
