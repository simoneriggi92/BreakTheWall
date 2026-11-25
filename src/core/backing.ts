import { z } from 'zod';
import { sessionIdSchema } from './local-server';
import { optionLetterSchema } from './round';
import { sectionAt, sourceIndex } from './source-index';

/**
 * The backing check of a spec (#106): what each statement declares it rests on, read without a model. A statement is
 * every list item, table row and paragraph, never a heading or a code block, in every section. The references at its
 * end cover it whole: an answer `[R2·Q3]` (round 2 of the session, question 3, numbered as the page shows them), a
 * decision recorded elsewhere (a GitHub issue, pull request or comment: its URL, `owner/repo#n` or `#n`), or lines of a
 * file `path:a-b`. No reference makes a statement unbacked; one that does not resolve makes its backing broken. A spec
 * with no reference at all declares no backing and gets no flags.
 *
 * The check is pure: the server resolves each reference (rounds, `gh`, the repository) through the function it passes.
 */

export type BackingReference =
  | { kind: 'answer'; written: string; round: number; question: number }
  /** `repo` is absent for `#n`, which names an issue of the session's own repository. */
  | { kind: 'link'; written: string; repo?: { owner: string; name: string }; number: number; pull: boolean; comment?: string }
  | { kind: 'lines'; written: string; path: string; from: number; to: number };

export interface Statement {
  /** The statement's first and last line, 1-based. */
  from: number;
  to: number;
  /** Its words on one line, without list marker, table pipes or the references at its end. */
  quote: string;
  references: BackingReference[];
}

/** The answer a reference cites, as the person gave it in the page. */
export const citedAnswerSchema = z.strictObject({
  session: sessionIdSchema,
  round: z.number().int().min(1),
  question: z.number().int().min(1),
  title: z.string(),
  /** The round's answers were sent from the page; false while it awaits them, or when the person answered elsewhere. */
  sent: z.boolean(),
  /** What was chosen; null when nothing was (a note alone, or nothing sent). */
  choice: z.union([z.enum(['recommendation', 'none']), optionLetterSchema]).nullable(),
  /** The chosen option's label, or the recommendation's words; null for no choice. */
  option: z.string().nullable(),
  note: z.string(),
});
export type CitedAnswer = z.infer<typeof citedAnswerSchema>;

const written = z.string().min(1).max(2_000);
export const checkedReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('answer'), written, found: z.boolean(), answer: citedAnswerSchema.optional() }),
  /** `title`: the issue's or pull request's title, when `gh` gave one. */
  z.strictObject({ kind: z.literal('link'), written, found: z.boolean(), title: z.string().max(1_000).optional() }),
  z.strictObject({ kind: z.literal('lines'), written, found: z.boolean() }),
]);
export type CheckedReference = z.infer<typeof checkedReferenceSchema>;

export const backingStateSchema = z.enum(['backed', 'unbacked', 'broken']);
export type BackingState = z.infer<typeof backingStateSchema>;
const line = z.number().int().min(1);
export const checkedStatementSchema = z.strictObject({
  from: line,
  to: line,
  /** The section it stands in, named by its line, as `sections` lists it: 1 before the first section. */
  section: line,
  quote: z.string().max(5_000),
  state: backingStateSchema,
  references: z.array(checkedReferenceSchema),
});
export type CheckedStatement = z.infer<typeof checkedStatementSchema>;

export const backingSectionSchema = z.strictObject({
  title: z.string(),
  line,
  statements: z.number().int().min(0),
  unbacked: z.number().int().min(0),
  broken: z.number().int().min(0),
});
export type BackingSection = z.infer<typeof backingSectionSchema>;

export const backingReportSchema = z.strictObject({
  /** The spec has at least one reference. Without one it declares no backing: no statement, no flag. */
  declared: z.boolean(),
  statements: z.array(checkedStatementSchema),
  /** Counts per section, in the spec's order, for the sections that hold a statement. */
  sections: z.array(backingSectionSchema),
});
export type BackingReport = z.infer<typeof backingReportSchema>;

/** What the server found a reference to; an answer carries what the person gave, a link the issue's title. */
export type Resolution = { found: false } | { found: true; answer?: CitedAnswer; title?: string };
export type Resolve = (reference: BackingReference) => Promise<Resolution>;

/** The statements of a spec and their references, then each reference resolved: the report the page reads. */
export async function checkBacking(text: string, resolve: Resolve): Promise<BackingReport> {
  const statements = specStatements(text);
  if (!statements.some(x => x.references.length > 0)) return { declared: false, statements: [], sections: [] };
  const index = sourceIndex(text);
  const checked = await Promise.all(statements.map(async (statement): Promise<CheckedStatement> => {
    const references = await Promise.all(statement.references.map(async (reference): Promise<CheckedReference> => {
      const found = await resolve(reference).catch((): Resolution => ({ found: false }));
      if (reference.kind === 'answer') return { kind: 'answer', written: reference.written, found: found.found, ...(found.found && found.answer ? { answer: found.answer } : {}) };
      if (reference.kind === 'link') return { kind: 'link', written: reference.written, found: found.found, ...(found.found && found.title ? { title: found.title.slice(0, 1_000) } : {}) };
      return { kind: 'lines', written: reference.written, found: found.found };
    }));
    const state: BackingState = references.length === 0 ? 'unbacked' : references.every(x => x.found) ? 'backed' : 'broken';
    return { from: statement.from, to: statement.to, section: sectionAt(index, statement.from)?.line ?? 1, quote: statement.quote, state, references };
  }));
  const sections: BackingSection[] = [];
  for (const statement of checked) {
    let section = sections.find(x => x.line === statement.section);
    if (!section) sections.push(section = { title: index.find(x => x.line === statement.section)?.title ?? '', line: statement.section, statements: 0, unbacked: 0, broken: 0 });
    section.statements++;
    if (statement.state === 'unbacked') section.unbacked++;
    if (statement.state === 'broken') section.broken++;
  }
  return { declared: true, statements: checked, sections };
}

const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,}|={3,})\s*$/;
const ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])(?:\s+(?:\[[ xX]\]\s+)?(.*))?$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const COMMENT = /^\s*<!--.*-->\s*$/;

/**
 * Every statement of a spec, in its order: list items (with their continuation lines), table rows (not the header or
 * its delimiter), and paragraphs. Headings, rules, code blocks and comments are not statements.
 */
export function specStatements(text: string): Statement[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const found: { from: number; to: number; words: string[] }[] = [];
  let current: (typeof found)[number] | undefined;
  let fence: string | undefined;
  const end = () => { current = undefined; };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const marker = FENCE.exec(raw)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return;
    }
    if (marker) { fence = marker; end(); return; }
    // A quote's lines are read as the lines they quote.
    const line = raw.replace(/^(\s*>)+\s?/, '');
    if (line.trim() === '' || HEADING.test(line) || COMMENT.test(line)) { end(); return; }
    if (RULE.test(line)) {
      // `---` or `===` under a paragraph makes that paragraph a heading.
      if (current && /^\s*[-=]+\s*$/.test(line) && found.at(-1) === current && current.to === n - 1 && !ITEM.test(lines[current.from - 1])) found.pop();
      end();
      return;
    }
    if (TABLE_ROW.test(line)) {
      end();
      if (TABLE_DELIMITER.test(line) || TABLE_DELIMITER.test(lines[i + 1] ?? '') && /\|/.test(lines[i + 1] ?? '')) return;
      const cells = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(x => x.trim());
      found.push({ from: n, to: n, words: [cells.join(' | ')] });
      return;
    }
    const item = ITEM.exec(line);
    if (item && !RULE.test(line)) {
      current = { from: n, to: n, words: [item[1] ?? ''] };
      found.push(current);
      return;
    }
    if (current) { current.to = n; current.words.push(line.trim()); return; }
    current = { from: n, to: n, words: [line.trim()] };
    found.push(current);
  });
  return found.flatMap(x => {
    const words = x.words.join(' ').replace(/\s+/g, ' ').trim();
    if (words === '') return [];
    const { quote, references } = trailingReferences(words);
    return [{ from: x.from, to: x.to, quote: quote.slice(0, 5_000), references }];
  });
}

/** The references at a statement's end, in their order, and the statement's words before them. */
export function trailingReferences(words: string): { quote: string; references: BackingReference[] } {
  const references: BackingReference[] = [];
  let rest = words, cut = words.length;
  for (;;) {
    const trimmed = rest.replace(/[\s,;.]+$/, '');
    let reference: BackingReference | null = null, start = 0;
    // `[#82](https://github.com/…)`: a Markdown link names its target.
    const link = /\[[^\]\n]*\]\((\S+?)\)$/.exec(trimmed);
    if (link) { reference = referenceOf(link[1], link[0]); start = link.index; }
    else {
      // `(#80, #82)`: the parentheses around references are part of them.
      const bare = trimmed.replace(/\)+$/, '');
      const token = /\S+$/.exec(bare);
      if (token) { reference = referenceOf(token[0].replace(/^\(+/, '')); start = token.index; }
    }
    if (!reference) break;
    references.unshift(reference);
    cut = start;
    rest = trimmed.slice(0, start);
  }
  // What led up to the references: a separating dash, an opening parenthesis, a table's cell border.
  const quote = words.slice(0, cut).replace(/[\s,;(|—–-]+$/, '').trim();
  return { quote, references };
}

const ANSWER = /^\[R(\d{1,6})\s*[·.]\s*Q(\d{1,3})\]$/u;
const GITHUB = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(issues|pull)\/(\d{1,9})\/?(?:#issuecomment-(\d{1,15})|[#?]\S*)?$/;
const REPO_ISSUE = /^([\w.-]+)\/([\w.-]+)#(\d{1,9})$/;
const LOCAL_ISSUE = /^#(\d{1,9})$/;
const LINES = /^(.+?):L?(\d{1,7})(?:[-–]L?(\d{1,7}))?$/;

/** One reference as written, or null for any other word. `written` defaults to the token itself. */
function referenceOf(token: string, as?: string): BackingReference | null {
  // `src/a.ts:3-5`, <https://…>: written as code or a link.
  const t = token.replace(/^`(.+)`$/, '$1').replace(/^<(.+)>$/, '$1');
  const shown = as ?? token;
  const answer = ANSWER.exec(t);
  if (answer) return { kind: 'answer', written: shown, round: Number(answer[1]), question: Number(answer[2]) };
  const url = GITHUB.exec(t);
  if (url) return { kind: 'link', written: shown, repo: { owner: url[1], name: url[2] }, number: Number(url[4]), pull: url[3] === 'pull', ...(url[5] ? { comment: url[5] } : {}) };
  const repo = REPO_ISSUE.exec(t);
  if (repo) return { kind: 'link', written: shown, repo: { owner: repo[1], name: repo[2] }, number: Number(repo[3]), pull: false };
  const local = LOCAL_ISSUE.exec(t);
  if (local) return { kind: 'link', written: shown, number: Number(local[1]), pull: false };
  if (as === undefined && !t.includes('://')) {
    const lines = LINES.exec(t);
    // A path names a file: it has a folder or an extension, so "10:30" or "ratio 3:4" is no reference.
    if (lines && /[./]/.test(lines[1]) && !/[\s`]/.test(lines[1])) {
      const from = Number(lines[2]), to = lines[3] === undefined ? from : Number(lines[3]);
      return { kind: 'lines', written: shown, path: lines[1], from, to };
    }
  }
  return null;
}
