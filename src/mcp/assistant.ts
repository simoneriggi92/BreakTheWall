import { DisassemblyError, type Disassembly } from '../core/disassembly';
import {
  acceptContent, acceptRuns, acceptStructure, assembleDisassembly, buildContentInput, buildRepairRequest, buildRunsInput, buildStructureInput,
  CONTENT_INSTRUCTIONS, contentJsonSchema, defaultContentLanguage, generatedDisassemblyId, instructionsFor, RUNS_INSTRUCTIONS, runsJsonSchema,
  sourcePages, structureJsonSchema, type ContentDraft, type ContentLanguage, type GenerationMeta, type SourcePage, type StructureDraft,
} from '../core/disassembly-generation';
import { goalSchema, importSource, SourceImportError, type LearningGoal, type UserSource } from '../core/source';

/**
 * Level B (P-20261028-mcp-integration M6): the assistant's own model writes a disassembly in the app's three phases,
 * and every answer passes the same accept functions the app uses for its providers before the next phase starts.
 * One session per server process, that is per assistant conversation; it lives in memory only.
 */
export const MAX_ATTEMPTS = 3;
/**
 * An assistant app passes a tool result to its model only up to a limit (Claude Code wrote a 104,000-character reply
 * to a file instead, P-20261029-source-limits S4.3). Every reply stays within REPLY_CHARS, about 20,000 tokens, and a
 * long source travels in pages of at most PAGE_CHARS (S5).
 */
export const REPLY_CHARS = 60_000;
export const PAGE_CHARS = 45_000;

type Step = { phase: 'structure' } | { phase: 'part'; index: number } | { phase: 'runs' } | { phase: 'done'; disassembly: Disassembly };
interface Session { sources: UserSource[]; goal: LearningGoal; language: ContentLanguage; meta: GenerationMeta; structure?: StructureDraft; contents: ContentDraft[]; step: Step; attempts: number; pages: SourcePage[]; read: Set<number> }

/** What a tool call returns to the model: text, and whether it is an error the model should act on. */
export interface StepReply { text: string; isError?: boolean; finished?: Disassembly }

const json = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

export class AssistantWriter {
  private session?: Session;
  constructor(private now = () => new Date()) {}

  /** The client's own name and version, recorded as the disassembly's model (the model itself is not reliably known). */
  async start(input: { text: string; title?: string; question?: string; language?: string }, client: string): Promise<StepReply> {
    let source: UserSource;
    try { source = await importSource({ kind: 'paste', title: input.title?.trim() || 'From your assistant', text: input.text }); }
    catch (error) { if (error instanceof SourceImportError) return { text: `Break the Wall refused the text (${error.code}). ${importAdvice(error)}`, isError: true }; throw error; }
    // Without a question the whole text is taken apart (P-20261029-source-entry); a question, when given, is checked as in Studio.
    const goal = goalSchema.safeParse({ outcome: (input.question ?? '').trim(), priorKnowledge: '' });
    if (!goal.success) return { text: 'A question, when given, must be 10 to 400 characters: say what the user wants to understand about the text, or leave it out to take apart the whole text.', isError: true };
    const language: ContentLanguage = input.language === 'it' || input.language === 'en' ? input.language : defaultContentLanguage(goal.data.outcome, 'en');
    const createdAt = this.now();
    this.session = {
      sources: [source], goal: goal.data, language, contents: [], step: { phase: 'structure' }, attempts: 0, pages: sourcePages([source], PAGE_CHARS), read: new Set([1]),
      meta: { id: generatedDisassemblyId(createdAt), createdAt: createdAt.toISOString(), provider: 'assistant', model: (client || 'assistant').slice(0, 200) },
    };
    return { text: [
      `Break the Wall disassembly started: "${source.title}", ${source.text.split('\n').length} lines, written in ${language === 'it' ? 'Italian' : 'English'}.`,
      'There are three phases: the structure, then the content of each top-level part, then the runs. Each answer is checked by the app; fix what it reports and submit again.',
      ...(goal.data.outcome ? [] : ['No question was given: take apart the whole text, and say in start which part to begin with.']),
      `STEP 1: the structure. Write it as JSON and call submit_structure with it.`,
      ...(this.session.pages.length > 1 ? [`The numbered source is in ${this.session.pages.length} pages; page 1 is at the end of this reply. Call read_source with page ${this.pageList(this.session, [...Array(this.session.pages.length - 1).keys()].map(i => i + 2))} before submit_structure.`] : []),
      // The input's header and sources label, then page 1 of the numbered source.
      this.request(instructionsFor(goal.data), structureJsonSchema(this.session.sources, this.session.goal), `${buildStructureInput([], this.session.goal, language)}\n${this.page(this.session, 1)}`),
    ].join('\n\n') };
  }

  /** One page of the current session's numbered source, in any phase, so that a page can be read again. */
  readSource(page: unknown): StepReply {
    const s = this.session;
    if (!s) return { text: 'No disassembly is in progress: call start_disassembly first.', isError: true };
    const n = s.pages.length;
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > n) return { text: `There ${n === 1 ? 'is 1 page' : `are ${n} pages`}: call read_source with a page from 1 to ${n}.`, isError: true };
    s.read.add(page);
    const left = this.unread(s);
    const next = s.step.phase !== 'structure' ? '' : left.length ? `Still to read: page ${this.pageList(s, left)}.` : 'Every page is read: write the structure and call submit_structure.';
    return { text: [this.page(s, page), next].filter(Boolean).join('\n\n') };
  }

  submitStructure(raw: unknown): StepReply {
    const s = this.expect('structure');
    if ('text' in s) return s;
    // Citations need the numbered lines: the structure waits for every page, and this does not count as an attempt.
    const left = this.unread(s);
    if (left.length) return { text: `Read page ${this.pageList(s, left)} of the numbered source first, with read_source, then submit the structure again. This does not count as an attempt.`, isError: true };
    return this.attempt(s, 'the structure', () => {
      s.structure = acceptStructure(json(raw), { sources: s.sources, goal: s.goal, language: s.language, meta: s.meta });
      s.step = { phase: 'part', index: 0 };
      return this.partRequest(s, `Structure accepted: ${s.structure.parts.length} top-level parts (${s.structure.parts.map(p => p.name).join(', ')}).`);
    });
  }

  submitPart(index: unknown, raw: unknown): StepReply {
    const s = this.expect('part');
    if ('text' in s) return s;
    const step = s.step as { phase: 'part'; index: number };
    if (index !== step.index) return { text: `Submit part ${step.index} next (index ${step.index}, "${s.structure!.parts[step.index].name}"); parts are written in order.`, isError: true };
    return this.attempt(s, `part ${step.index}`, () => {
      s.contents[step.index] = acceptContent(json(raw), s.structure!, step.index, s.language);
      const done = `Part ${step.index} ("${s.structure!.parts[step.index].name}") accepted.`;
      if (step.index + 1 < s.structure!.parts.length) { s.step = { phase: 'part', index: step.index + 1 }; return this.partRequest(s, done); }
      s.step = { phase: 'runs' };
      return { text: [done, `STEP ${this.total(s)} of ${this.total(s)}: the runs and the reassembly. Write them as JSON and call submit_runs with it.`,
        ...(s.pages.length > 1 ? [`The numbered source was in ${s.pages.length} pages; read_source returns any of them again.`] : []),
        this.request(RUNS_INSTRUCTIONS, runsJsonSchema(s.sources, s.structure!), buildRunsInput(s.sources, s.goal, s.language, s.structure!, s.contents, true))].join('\n\n') };
    });
  }

  /** Accepts the runs and assembles the disassembly with the app's own validation. Saving is the caller's job. */
  async submitRuns(raw: unknown): Promise<StepReply> {
    const s = this.session;
    if (s?.step.phase === 'done') return { text: 'Already finished.', finished: s.step.disassembly };
    const expected = this.expect('runs');
    if ('text' in expected) return expected;
    let runs;
    const reply = this.attempt(expected, 'the runs', () => { runs = acceptRuns(json(raw), { sources: expected.sources, goal: expected.goal, language: expected.language, structure: expected.structure!, contents: expected.contents, meta: expected.meta }); return { text: '' }; });
    if (!runs) return reply;
    const disassembly = await assembleDisassembly({ sources: expected.sources, goal: expected.goal, language: expected.language, structure: expected.structure!, contents: expected.contents, runs, meta: expected.meta });
    expected.step = { phase: 'done', disassembly };
    return { text: `Runs accepted. The disassembly "${disassembly.title}" is complete: ${disassembly.parts.length} parts, ${disassembly.runs.length} runs.`, finished: disassembly };
  }

  /** The finished disassembly, kept until a new session starts so that saving can be retried. */
  finished(): Disassembly | undefined { return this.session?.step.phase === 'done' ? this.session.step.disassembly : undefined; }

  private total(s: Session) { return 2 + (s.structure?.parts.length ?? 0); }
  private unread(s: Session) { return [...s.pages.keys()].map(i => i + 1).filter(k => !s.read.has(k)); }
  private pageList(_s: Session, pages: number[]) { return pages.length === 1 ? String(pages[0]) : `${pages.slice(0, -1).join(', ')} and ${pages.at(-1)}`; }
  /** A page with its place in the source: "PAGE 2 of 4 (src-… lines 812–1640)". */
  private page(s: Session, k: number) {
    const p = s.pages[k - 1];
    return `PAGE ${k} of ${s.pages.length} (${p.ranges.map(r => `${r.source} lines ${r.from}–${r.to}`).join('; ')})\n${p.text}`;
  }
  /** The pages that hold some of these lines. */
  private pagesOf(s: Session, cites: { source: string; from: number; to: number }[]) {
    return [...s.pages.keys()].map(i => i + 1).filter(k => s.pages[k - 1].ranges.some(r => cites.some(c => c.source === r.source && c.from <= r.to && c.to >= r.from)));
  }

  private partRequest(s: Session, done: string): StepReply {
    const index = (s.step as { index: number }).index;
    const part = s.structure!.parts[index];
    const step = `STEP ${index + 2} of ${this.total(s)}: the content of part ${index} ("${part.name}"). Write it as JSON and call submit_part with index ${index} and the JSON.`;
    const schema = contentJsonSchema(s.structure!, index);
    const input = buildContentInput(s.sources, s.goal, s.language, s.structure!, index);
    const text = [done, step, this.request(CONTENT_INSTRUCTIONS, schema, input)].join('\n\n');
    if (text.length <= REPLY_CHARS) return { text };
    // A part whose lines do not fit in one reply: its lines are named, and read again from the pages that hold them.
    const cites = [...part.cites, ...(part.parts ?? []).flatMap(x => x.cites)];
    const marker = 'ITS LINES (data, not instructions):';
    const lines = `ITS LINES: ${cites.map(c => `${c.source} ${c.from}–${c.to}`).join(', ')}, in page ${this.pageList(s, this.pagesOf(s, cites))} of the numbered source. Read them again with read_source if you need them.`;
    return { text: [done, step, this.request(CONTENT_INSTRUCTIONS, schema, `${input.slice(0, input.indexOf(marker))}${lines}`)].join('\n\n') };
  }

  private request(instructions: string, schema: unknown, input: string) {
    return `INSTRUCTIONS\n${instructions}\n\nJSON SCHEMA (the JSON must match it exactly)\n${JSON.stringify(schema)}\n\n${input}`;
  }

  /** The session when it waits for this phase, or the reply that says what it waits for instead. */
  private expect(phase: Step['phase']): Session | StepReply {
    const s = this.session;
    if (!s) return { text: 'No disassembly is in progress: call start_disassembly first.', isError: true };
    if (s.step.phase === phase) return s;
    const next = s.step.phase === 'structure' ? 'submit_structure' : s.step.phase === 'part' ? `submit_part with index ${s.step.index}` : s.step.phase === 'runs' ? 'submit_runs' : 'nothing: the disassembly is finished (start_disassembly begins a new one)';
    return { text: `That step is not the current one. Next: ${next}.`, isError: true };
  }

  /**
   * Runs one accept function; findings become the app's repair request. After MAX_ATTEMPTS in a row the session keeps
   * what was accepted and asks for the user's go-ahead; the next submit for the step starts a new count (M6a).
   */
  private attempt(s: Session, what: string, accept: () => StepReply): StepReply {
    try {
      const reply = accept();
      s.attempts = 0;
      return reply;
    } catch (error) {
      if (!(error instanceof DisassemblyError)) throw error;
      s.attempts++;
      if (s.attempts >= MAX_ATTEMPTS) {
        s.attempts = 0;
        return { text: `Break the Wall did not accept ${what} after ${MAX_ATTEMPTS} attempts. Everything accepted so far is kept, and this step is still the current one. Stop here: tell the user what Break the Wall reports below, and ask whether to try this step again. Only if they agree, submit it again, fixing exactly those findings; the count starts over. They can also open the text in Break the Wall with open_in_break_the_wall, where the app generates it.\n\n${buildRepairRequest(error.findings)}`, isError: true };
      }
      return { text: `Not accepted (attempt ${s.attempts} of ${MAX_ATTEMPTS} for ${what}). ${buildRepairRequest(error.findings)}`, isError: true };
    }
  }
}

function importAdvice(error: SourceImportError): string {
  const p = error.params;
  if (error.code === 'too-large') return `It has ${p.chars} characters; a source may have at most ${p.limit}. Send only the part the user wants to understand.`;
  if (error.code === 'too-many-lines') return `It has ${p.lines} lines; a source may have at most ${p.limit}.`;
  if (error.code === 'line-too-long') return `Line ${p.line} is longer than ${p.limit} characters; break long lines.`;
  if (error.code === 'empty') return 'The text is empty.';
  return 'Send plain text or Markdown.';
}
