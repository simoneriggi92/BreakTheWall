import { buildRepairRequest, sourcePages, type ContentLanguage, type SourcePage } from '../core/disassembly-generation';
import type { Finding } from '../core/disassembly';
import { EXPLORATION_SOURCE_LIMIT, explorationInstructions, explorationJsonSchema, sourceFindings } from '../core/exploration-generation';
import { detectLanguage } from '../core/generation';
import { importSource, SourceImportError, type UserSource } from '../core/source';
import { PAGE_CHARS, REPLY_CHARS, type StepReply } from './assistant';

/**
 * The assistant writes an exploration (plan P-20261105-exploration X9): one request, the same the app sends on the
 * ChatGPT route (X7), and one answer that the app checks with `acceptExploration` through the local entry point. The
 * app's findings come back for one repair; a second refusal ends the session and nothing is saved. This writer holds
 * only what the assistant needs to answer: the source, its pages and the attempts. It lives in memory only.
 */
export const EXPLORATION_ATTEMPTS = 2;
const FIRST_PAGE_MARGIN = 400;

interface Session { source: UserSource; language: ContentLanguage; client: string; pages: SourcePage[]; read: Set<number>; attempts: number; done: boolean }
/** What the app needs to check and save an answer: the source as the assistant read it, the language and who wrote it. */
export interface ExplorationSubmission { source: { title: string; text: string }; language: ContentLanguage; client: string; answer: string }

const json = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

export class ExplorationWriter {
  private session?: Session;

  /** The client's name and version stand for the model, as for disassemblies. */
  async start(input: { text: string; title?: string; language?: string }, client: string): Promise<StepReply> {
    let source: UserSource;
    try { source = await importSource({ kind: 'paste', title: input.title?.trim() || 'From your assistant', text: input.text }); }
    catch (error) { if (error instanceof SourceImportError) return { text: `Break the Wall refused the text (${error.code}): ${error.message}`, isError: true }; throw error; }
    const over = sourceFindings(source);
    if (over.length) return { text: `Break the Wall refused the text: it has ${source.text.length.toLocaleString('en-US')} characters, and an exploration reads at most ${EXPLORATION_SOURCE_LIMIT.toLocaleString('en-US')} in one request. Send only the part the user wants to explore.`, isError: true };
    const language: ContentLanguage = input.language === 'it' || input.language === 'en' ? input.language : detectLanguage(source.text) ?? 'en';
    const s: Session = this.session = { source, language, client: (client || 'assistant').slice(0, 200), pages: sourcePages([source], PAGE_CHARS), read: new Set([1]), attempts: 0, done: false };
    // Page 1 shares the first reply with the instructions and the schema: it gets what they leave.
    const frame = this.startReply({ ...s, pages: s.pages.map((p, i) => i ? p : { ...p, text: '' }) }).length;
    s.pages = sourcePages([source], PAGE_CHARS, REPLY_CHARS - frame - FIRST_PAGE_MARGIN);
    return { text: this.startReply(s) };
  }

  private startReply(s: Session) {
    return [
      `Break the Wall exploration started: "${s.source.title}", ${s.source.text.split('\n').length} lines, written in ${s.language === 'it' ? 'Italian' : 'English'}.`,
      'Read the whole source, then write its structure as ONE JSON answer and call submit_exploration with it. Break the Wall checks it; if it reports findings, fix exactly those and submit once more.',
      ...(s.pages.length > 1 ? [`The numbered source is in ${s.pages.length} pages; page 1 is at the end of this reply. Call read_source with page ${list([...Array(s.pages.length - 1).keys()].map(i => i + 2))} before submit_exploration.`] : []),
      `INSTRUCTIONS\n${explorationInstructions(s.language)}\n\nJSON SCHEMA (the JSON must match it exactly)\n${JSON.stringify(explorationJsonSchema())}\n\nRead this source and return its structure.\n\n${this.page(s, 1)}`,
    ].join('\n\n');
  }

  get active(): boolean { return !!this.session && !this.session.done; }

  readSource(page: unknown): StepReply {
    const s = this.session;
    if (!s) return { text: 'No exploration is in progress: call start_exploration first.', isError: true };
    const n = s.pages.length;
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > n) return { text: `There ${n === 1 ? 'is 1 page' : `are ${n} pages`}: call read_source with a page from 1 to ${n}.`, isError: true };
    s.read.add(page);
    const left = this.unread(s);
    return { text: [this.page(s, page), left.length ? `Still to read: page ${list(left)}.` : 'Every page is read: write the structure and call submit_exploration.'].join('\n\n') };
  }

  /** The submission to hand to the app, or the reply that says why not yet. Waiting for pages is not an attempt. */
  submission(raw: unknown): { submit: ExplorationSubmission } | { reply: StepReply } {
    const s = this.session;
    if (!s) return { reply: { text: 'No exploration is in progress: call start_exploration first.', isError: true } };
    if (s.done) return { reply: { text: 'This exploration is finished: start_exploration begins a new one.', isError: true } };
    const left = this.unread(s);
    if (left.length) return { reply: { text: `Read page ${list(left)} of the numbered source first, with read_source, then submit the exploration again. This does not count as an attempt.`, isError: true } };
    return { submit: { source: { title: s.source.title, text: s.source.text }, language: s.language, client: s.client, answer: json(raw) } };
  }

  /** The app refused the answer with these findings: one repair, then the session ends with nothing saved. */
  refused(findings: Finding[]): StepReply {
    const s = this.session!;
    s.attempts++;
    if (s.attempts >= EXPLORATION_ATTEMPTS) {
      s.done = true;
      return { text: `Break the Wall did not accept the exploration after one repair, and nothing was saved. Stop here: tell the user what Break the Wall reports below. They can open the text in Break the Wall with open_in_break_the_wall and explore it there, or ask you to start again.\n\n${buildRepairRequest(findings)}`, isError: true };
    }
    return { text: `Not accepted (attempt ${s.attempts} of ${EXPLORATION_ATTEMPTS}). ${buildRepairRequest(findings)} Then call submit_exploration with it.`, isError: true };
  }

  saved(): void { if (this.session) this.session.done = true; }

  private unread(s: Session) { return [...s.pages.keys()].map(i => i + 1).filter(k => !s.read.has(k)); }
  private page(s: Session, k: number) {
    const p = s.pages[k - 1];
    return `PAGE ${k} of ${s.pages.length} (${p.ranges.map(r => `${r.source} lines ${r.from}–${r.to}`).join('; ')})\n${p.text}`;
  }
}

const list = (pages: number[]) => pages.length === 1 ? String(pages[0]) : `${pages.slice(0, -1).join(', ')} and ${pages.at(-1)}`;
