import { z } from 'zod';

/**
 * A round as the agent writes it (#95): the grilling skill's own format, `❓ **Qn** - **title**: body`, then
 * `➡️ recommendation`. The body stays free Markdown; text outside the questions is the turn's text, never parsed into
 * questions. Shared by the server, which recognises rounds, and the page, which reads them.
 */
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'] as const;
export const optionLetterSchema = z.enum(LETTERS);
export type OptionLetter = z.infer<typeof optionLetterSchema>;
/** One line of the list the plugin asks round skills for (#96): `- **(a)** label: consequence`. */
export const optionSchema = z.strictObject({
  letter: optionLetterSchema,
  label: z.string().min(1).max(2_000),
  consequence: z.string().max(50_000),
});
export type Option = z.infer<typeof optionSchema>;
export const questionSchema = z.strictObject({
  number: z.number().int().min(1).max(999),
  title: z.string().min(1).max(500),
  /** Without the options list, when the agent wrote one: the page shows the options beside it, not twice. */
  body: z.string().max(200_000),
  /** Empty when the agent wrote no list, as every round before #96 did: the question then takes "yes" or a note. */
  options: z.array(optionSchema).max(26).default([]),
  /** The option the recommendation names, when it names one of the question's options. */
  recommended: optionLetterSchema.nullable().default(null),
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
/** A fence closes on the same character, at least as long as the one that opened it. */
const closes = (marker: string, fence: string) => marker[0] === fence[0] && marker.length >= fence.length;

/** A question while its lines are read: `done` once a separator or the end of its recommendation closes it. */
interface PendingQuestion { number: number; title: string; body: string[]; recommendation: string[] | null; done: boolean }

/** The round in an agent's turn, or null when the turn asks no question in the skill's format. */
export function parseRound(text: string): Round | null {
  const outside: string[] = [];
  const questions: PendingQuestion[] = [];
  let current: PendingQuestion | undefined;
  let fence: string | undefined;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    // Inside a code fence nothing is a question, a recommendation or a separator: a Mermaid diagram or a quoted
    // example of the format stays part of what holds it.
    if (fence) {
      if (marker && closes(marker, fence)) fence = undefined;
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
    questions: questions.map((q, i) => {
      const { body, options } = splitOptions(q.body);
      const recommendation = tidy(q.recommendation ?? []);
      return { number: renumber ? i + 1 : q.number, title: q.title, body: tidy(body), options, recommended: recommendedLetter(recommendation, options), recommendation };
    }),
  });

  function append(line: string) {
    if (current && !current.done) (current.recommendation ?? current.body).push(line);
    else outside.push(line);
  }
}

// `- **(a)** label: consequence`; the bold around the letter is optional, the parentheses are not.
const OPTION = /^\s*[-*+]\s+(\*\*)?\(([a-z])\)(\*\*)?\s+(.+)$/u;
const CONTINUATION = /^(?: {2,}|\t)\S/;

/**
 * The options list in a question's body, and the body without it. A list needs two options at least, each with its
 * own letter: anything less is left in the body as the agent wrote it, so a stray lettered line never loses text.
 */
function splitOptions(lines: string[]): { body: string[]; options: Option[] } {
  const kept: string[] = [];
  const found: { letter: OptionLetter; label: string; consequence: string[] }[] = [];
  let last: (typeof found)[number] | undefined;
  let fence: string | undefined;
  for (const line of lines) {
    const marker = FENCE.exec(line)?.[1];
    if (fence || marker) {
      if (fence && marker && closes(marker, fence)) fence = undefined;
      else if (!fence) fence = marker;
      last = undefined;
      kept.push(line);
      continue;
    }
    const option = OPTION.exec(line);
    if (option) {
      // `**(a) label**: …` opens the bold before the letter and closes it after the label: the label is the bold part.
      const [label, consequence] = labelled(option[1] && !option[3] ? `**${option[4]}` : option[4]);
      last = { letter: option[2] as OptionLetter, label, consequence: consequence ? [consequence] : [] };
      found.push(last);
      continue;
    }
    // A consequence too long for one line goes on indented, as a Markdown list item does.
    if (last && CONTINUATION.test(line)) { last.consequence.push(line.trim()); continue; }
    last = undefined;
    kept.push(line);
  }
  const letters = new Set(found.map(x => x.letter));
  if (found.length < 2 || letters.size !== found.length) return { body: lines, options: [] };
  return { body: kept, options: found.map(x => ({ letter: x.letter, label: x.label, consequence: x.consequence.join('\n') })) };
}

/** `**label**: consequence`, `label: consequence` or `label — consequence`; a label alone has no consequence. */
function labelled(rest: string): [string, string] {
  const bold = /^\*\*(.+?)\*\*\s*(?:[:—–-]\s*)?(.*)$/u.exec(rest);
  if (bold) return [bold[1].replace(/:$/, '').trim(), bold[2].trim()];
  const plain = /^(.+?)(?::\s|:$|\s[—–-]\s)(.*)$/u.exec(rest);
  return plain ? [plain[1].trim(), plain[2].trim()] : [rest.trim(), ''];
}

/** The first `(x)` in the recommendation that names one of the question's options. */
function recommendedLetter(recommendation: string, options: Option[]): OptionLetter | null {
  for (const [, letter] of recommendation.matchAll(/\(([a-z])\)/g)) {
    const found = options.find(x => x.letter === letter);
    if (found) return found.letter;
  }
  return null;
}

/** Lines joined and trimmed; the blank lines left where a question was cut out collapse to one. */
const tidy = (lines: string[]) => lines.join('\n').replace(/\n[ \t]*(?:\n[ \t]*)+\n/g, '\n\n').trim();
