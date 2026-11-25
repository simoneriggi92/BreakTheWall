import { z } from 'zod';
import { cwdSchema, sessionIdSchema } from './local-server';
import { optionLetterSchema, questionSchema, type Question } from './round';

/**
 * What the person gives a round and what returns to the agent (#95). The page builds the message live from the same
 * function the server sends with, so "what the agent receives" is exactly what it receives.
 */

/**
 * A passage of a question the person points at, with their words on it (#98). `part` and the offsets anchor it in the
 * question's text as the page renders it, so the page can mark it again; the message quotes only `passage`.
 */
export const remarkPartSchema = z.enum(['body', 'recommendation']);
export type RemarkPart = z.infer<typeof remarkPartSchema>;
export const remarkSchema = z.strictObject({
  part: remarkPartSchema,
  start: z.number().int().min(0).max(1_000_000),
  end: z.number().int().min(1).max(1_000_000),
  passage: z.string().max(5_000).refine(x => x.trim() !== ''),
  text: z.string().max(50_000),
}).refine(x => x.end > x.start);
export type Remark = z.infer<typeof remarkSchema>;

/** The longest reply a side chat keeps (#100), and so the longest one an answer takes attached whole (#101). */
export const SIDE_CHAT_REPLY_MAX = 1_000_000;

/**
 * One exchange of a question's side chat the person attached to their answer (#101): what they asked, the passage
 * they asked about if any, and the reply, copied whole from the side chat when attached. Kept in the draft, so the page's
 * preview and the message the server sends come from the same text through the same function. `turn` names the
 * exchange in its side chat: one turn is attached once.
 */
export const attachedSchema = z.strictObject({
  turn: z.number().int().min(1),
  ask: z.string().max(20_000),
  passage: z.string().max(5_000).optional(),
  reply: z.string().max(SIDE_CHAT_REPLY_MAX),
});
export type Attached = z.infer<typeof attachedSchema>;

/**
 * A question takes the recommendation, one of its options by letter (#96), no choice, or only a note. Remarks ride
 * with the answer but are not one: a question with remarks alone is still unanswered.
 */
export const answerSchema = z.strictObject({
  choice: z.union([z.enum(['recommendation', 'none']), optionLetterSchema]).optional(),
  note: z.string().max(50_000),
  /** Absent rather than empty, so a draft kept before remarks existed reads the same. */
  remarks: z.array(remarkSchema).max(200).optional(),
  /** Side-chat exchanges attached with 📎 (#101); absent rather than empty, like remarks. */
  attached: z.array(attachedSchema).max(100).refine(x => new Set(x.map(a => a.turn)).size === x.length).optional(),
});
export const draftSchema = z.strictObject({
  /** One per round; it returns at the top of the message. */
  generalNote: z.string().max(50_000),
  /** Keyed by question number, as JSON keys are strings: a question the person never touched has no entry. */
  answers: z.record(z.string().regex(/^\d{1,3}$/), answerSchema),
});
export type Answer = z.infer<typeof answerSchema>;
export type Draft = z.infer<typeof draftSchema>;
export const emptyDraft = (): Draft => ({ generalNote: '', answers: {} });

export const messageLanguageSchema = z.enum(['it', 'en']);
export type MessageLanguage = z.infer<typeof messageLanguageSchema>;

/** What the head of a round or a free block shows besides the agent's text (#126), the same on both views. */
export const turnHeadFields = {
  /**
   * The project the session ran in, for the chip: its working directory's last folder, never the whole path, which the
   * page has no use for. Bounded as the directory it is cut from.
   */
  project: cwdSchema,
  /** The person folded the agent's text to one line: kept with the entry, so it holds for that round alone. */
  turnFolded: z.boolean(),
};

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
  ...turnHeadFields,
});
export type RoundView = z.infer<typeof roundViewSchema>;

export const answerOf = (draft: Draft, question: Pick<Question, 'number'>): Answer | undefined => draft.answers[String(question.number)];

/** What an answer amounts to: the outline's state and the message's title line both follow it. */
export type AnswerKind = 'unanswered' | 'recommendation' | 'none' | 'option' | 'note';
export function answerKind(answer: Answer | undefined): AnswerKind {
  if (answer?.choice === 'recommendation' || answer?.choice === 'none') return answer.choice;
  if (answer?.choice) return 'option';
  return answer && answer.note.trim() !== '' ? 'note' : 'unanswered';
}

/**
 * Every option letter in the draft is one its question offers, and every remark and attached exchange sits on a
 * question the round has: the
 * page offers no other, so another is a bad request.
 */
export function fitsQuestions(questions: readonly Question[], draft: Draft): boolean {
  return Object.entries(draft.answers).every(([number, answer]) => {
    const question = questions.find(q => String(q.number) === number);
    if ((answer.remarks?.length || answer.attached?.length) && !question) return false;
    if (answerKind(answer) !== 'option') return true;
    return question?.options.some(x => x.letter === answer.choice) ?? false;
  });
}

/** A passage as the message and the page quote it: on one line, as it reads, however many lines it crossed. */
export const quoted = (passage: string) => `«${passage.replace(/\s+/g, ' ').trim()}»`;

/** The parts of a question a remark can sit in, in the order they stand. */
export const REMARK_PARTS: readonly RemarkPart[] = remarkPartSchema.options;
/** Remarks in the order their passages stand: the body's first, then the recommendation's. */
export const sortRemarks = (remarks: readonly Remark[]): Remark[] =>
  [...remarks].sort((a, b) => REMARK_PARTS.indexOf(a.part) - REMARK_PARTS.indexOf(b.part) || a.start - b.start || a.end - b.end);
export const remarksOf = (answer: Answer | undefined): Remark[] => sortRemarks(answer?.remarks ?? []);
/** A remark is known by where it stands: one passage takes one remark. */
export const remarkKey = (x: Pick<Remark, 'part' | 'start' | 'end'>) => `${x.part}:${x.start}:${x.end}`;
/** Attached exchanges in the order they were asked in their side chat. */
export const attachedOf = (answer: Answer | undefined): Attached[] => [...answer?.attached ?? []].sort((a, b) => a.turn - b.turn);
export const isAnswered = (answer: Answer | undefined) => answerKind(answer) !== 'unanswered';

/** The words on a question's title line, in the page's interface language; a note alone puts none there. */
const TITLE_WORDS: Record<MessageLanguage, Record<Exclude<AnswerKind, 'option'>, string>> = {
  it: { recommendation: 'raccomandazione', none: 'nessuna scelta', unanswered: 'nessuna risposta', note: '' },
  en: { recommendation: 'recommendation', none: 'no choice', unanswered: 'no answer', note: '' },
};

/** How an attached exchange is introduced, in the page's interface language. */
const SIDE_CHAT_WORDS: Record<MessageLanguage, { question: string; reply: string }> = {
  it: { question: 'Chat laterale — domanda:', reply: 'risposta:' },
  en: { question: 'Side chat — question:', reply: 'reply:' },
};

/**
 * Plain Markdown that reads as the person's own words: the general note first, then every question by number and
 * title, so it still reads after compaction, the choice on the title line ("recommendation", the option's letter, "no
 * choice" or "no answer"), the note indented below, then its remarks that have words, as `- «passage» — text`, then
 * the side-chat exchanges attached to it, the reply whole and verbatim, only indented to stay under its question.
 */
export function returnMessage(questions: readonly Question[], draft: Draft, language: MessageLanguage): string {
  const lines: string[] = [];
  const general = draft.generalNote.trim();
  if (general) lines.push(general, '');
  for (const question of questions) {
    const answer = answerOf(draft, question);
    const kind = answerKind(answer);
    // An option is named by its letter alone, as the agent wrote it in the round.
    const word = kind === 'option' ? `(${answer?.choice})` : TITLE_WORDS[language][kind];
    const title = `**Q${question.number} · ${question.title}**`;
    lines.push(word ? `${title} ${word}` : title);
    const note = answer?.note.trim();
    if (note) append(lines, indented(note, '  '));
    // A remark with no words yet is only a mark on the page: a bare quote would ask the agent to guess why.
    for (const remark of remarksOf(answer).filter(x => x.text.trim() !== '')) {
      const [first, ...rest] = remark.text.trim().split(/\r?\n/);
      lines.push(`  - ${quoted(remark.passage)} — ${first}`);
      append(lines, rest.flatMap(line => indented(line, '    ')));
    }
    const words = SIDE_CHAT_WORDS[language];
    for (const x of attachedOf(answer)) {
      const [ask, ...askRest] = x.ask.trim().split(/\r?\n/);
      const about = x.passage ? `${quoted(x.passage)} — ` : '';
      const [reply, ...replyRest] = x.reply.trim().split(/\r?\n/);
      lines.push(`  - ${words.question} ${about}${ask}`);
      append(lines, askRest.flatMap(line => indented(line, '    ')));
      lines.push(`    ${words.reply} ${reply}`);
      append(lines, replyRest.flatMap(line => indented(line, '    ')));
    }
  }
  return asText(lines.join('\n'));
}

/**
 * A message the session receives as the person's own words, never as a command (#99): typed into Claude Code, a
 * leading `/` runs a command or a skill and a leading `!` runs a shell command. The mark is escaped as Markdown
 * escapes it, so the agent reads the words as written.
 */
export const asText = (message: string) => startsAsCommand(message) ? `\\${message.trimStart()}` : message;
/** Whether Claude Code would take the text for a command: the page warns of the escape with the same rule. */
export const startsAsCommand = (text: string) => /^[/!]/.test(text.trimStart());

/**
 * Adds every line, one at a time: a reply attached whole can run to hundreds of thousands of lines, more arguments
 * than a spread into `push` can pass.
 */
export function append(lines: string[], more: readonly string[]) {
  for (const line of more) lines.push(line);
}

const indented = (text: string, by: string) => text.split(/\r?\n/).map(line => line.trim() ? `${by}${line}` : '');
