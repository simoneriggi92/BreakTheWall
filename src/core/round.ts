import { z } from 'zod';

/**
 * A round as the agent writes it (#95): the grilling skill's own format, `❓ **Qn** - **title**: body`, then
 * `➡️ recommendation`. The body stays free Markdown; text outside the questions is the turn's text, never parsed into
 * questions. Shared by the server, which recognises rounds, and the page, which reads them.
 */
export const questionSchema = z.strictObject({
  number: z.number().int().min(1).max(999),
  title: z.string().min(1).max(500),
  body: z.string().max(200_000),
  /** Empty when the agent wrote none: the question still takes a note or no choice. */
  recommendation: z.string().max(50_000),
});
export const roundSchema = z.strictObject({
  turnText: z.string().max(500_000),
  questions: z.array(questionSchema).min(1).max(200),
});
export type Question = z.infer<typeof questionSchema>;
export type Round = z.infer<typeof roundSchema>;

// `❓ **Q1** - **Title**: body`. The dash may be any dash or a colon, and the title's colon may sit inside the bold.
const QUESTION = /^\s*❓\s*\*\*Q(\d{1,3})\*\*\s*[-–—:·]?\s*\*\*(.+?):?\*\*\s*:?\s*(.*)$/u;
const RECOMMENDATION = /^\s*➡️?\s*(.*)$/u;
const SEPARATOR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

interface Draft { number: number; title: string; body: string[]; recommendation: string[] | null; done: boolean }

/** The round in an agent's turn, or null when the turn asks no question in the skill's format. */
export function parseRound(text: string): Round | null {
  const outside: string[] = [];
  const questions: Draft[] = [];
  let current: Draft | undefined;
  let fence: string | undefined;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    // Inside a code fence nothing is a question, a recommendation or a separator: a Mermaid diagram or a quoted
    // example of the format stays part of what holds it.
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      append(line);
      continue;
    }
    if (marker) { fence = marker; append(line); continue; }

    const question = QUESTION.exec(line);
    if (question) {
      current = { number: Number(question[1]), title: question[2].trim(), body: [question[3]], recommendation: null, done: false };
      questions.push(current);
      continue;
    }
    if (current && !current.done) {
      if (SEPARATOR.test(line)) { current.done = true; continue; }
      const recommendation = RECOMMENDATION.exec(line);
      if (recommendation && current.recommendation === null) { current.recommendation = [recommendation[1]]; continue; }
      // The recommendation is one paragraph: the first blank line after it hands the rest back to the turn's text.
      if (current.recommendation !== null && line.trim() === '') { current.done = true; continue; }
    } else if (SEPARATOR.test(line) && questions.length > 0) continue;
    append(line);
  }
  if (questions.length === 0) return null;

  const numbers = questions.map(x => x.number);
  // Answers are keyed by number, so two questions sharing one are numbered again in the order they came.
  const renumber = new Set(numbers).size !== numbers.length || numbers.some(x => x < 1);
  return roundSchema.parse({
    turnText: tidy(outside),
    questions: questions.map((q, i) => ({ number: renumber ? i + 1 : q.number, title: q.title, body: tidy(q.body), recommendation: tidy(q.recommendation ?? []) })),
  });

  function append(line: string) {
    if (current && !current.done) (current.recommendation ?? current.body).push(line);
    else outside.push(line);
  }
}

/** Lines joined, trimmed, with no more than one blank line in a row. */
const tidy = (lines: string[]) => lines.join('\n').replace(/\n[ \t]*(?:\n[ \t]*)+\n/g, '\n\n').trim();
