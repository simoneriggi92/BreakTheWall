import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { checkBacking, type BackingReference, type BackingReport, type CitedAnswer, type Resolution } from '../core/backing';
import { fileInside } from './files';
import { GH_TIMEOUT_MS, ghIssueSchema, type GhRunner } from './gh';
import type { RoundStore } from './rounds';

/**
 * The backing check on the server (#106): a version's references resolved against what the server can reach, with no
 * model. Answers against the rounds of the spec's sessions, links through the person's `gh`, lines against the files
 * of the session's folder, never outside it.
 */
/** At most this many `gh` runs at once: a spec citing many issues should not flood the person's machine or GitHub. */
const GH_AT_ONCE = 4;
/** A file larger than this is not read to count its lines: its lines are a broken backing. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ghCommentSchema = z.object({ issue_url: z.string().max(1_000) });

export interface BackingChecker {
  /**
   * The report on one version: `sessions` are the spec's sessions, the one that handed this version over first, where
   * `[R2·Q3]` is looked up in that order; `cwd` is that session's folder.
   */
  check(spec: { text: string; sessions: string[]; cwd: string }): Promise<BackingReport>;
}

export function backingChecker(options: { rounds: Pick<RoundStore, 'cited'>; gh: GhRunner }): BackingChecker {
  const { rounds, gh } = options;
  /** Links found through `gh`, kept for the server's life; a link not found is asked again next time. */
  const links = new Map<string, Promise<Resolution>>();
  const limit = limiter(GH_AT_ONCE);

  function answer(reference: Extract<BackingReference, { kind: 'answer' }>, sessions: string[]): Resolution {
    for (const session of sessions) {
      const cited = rounds.cited(session, reference.round, reference.question);
      if (!cited) continue;
      const { question, sent, answer } = cited;
      const choice = answer?.choice ?? null;
      const option = choice === 'recommendation' ? question.recommendation
        : choice === null || choice === 'none' ? null
        : question.options.find(x => x.letter === choice)?.label ?? null;
      const found: CitedAnswer = { session, round: reference.round, question: reference.question, title: question.title, sent, choice, option, note: answer?.note ?? '' };
      return { found: true, answer: found };
    }
    return { found: false };
  }

  function link(reference: Extract<BackingReference, { kind: 'link' }>, cwd: string): Promise<Resolution> {
    const { repo, number, pull, comment } = reference;
    const key = `${cwd}\n${repo ? `${repo.owner}/${repo.name}` : ''}#${number}${pull ? 'p' : ''}${comment ? `c${comment}` : ''}`;
    const known = links.get(key);
    if (known) return known;
    const asked = limit(async (): Promise<Resolution> => {
      const signal = AbortSignal.timeout(GH_TIMEOUT_MS);
      if (comment && repo) {
        const exit = await gh({ args: ['api', `repos/${repo.owner}/${repo.name}/issues/comments/${comment}`], cwd, signal });
        if (exit.code !== 0) return { found: false };
        // A comment of another issue does not back what this link says.
        const { issue_url } = ghCommentSchema.parse(JSON.parse(exit.stdout));
        return issue_url.toLowerCase().endsWith(`/repos/${repo.owner}/${repo.name}/issues/${number}`.toLowerCase()) ? { found: true } : { found: false };
      }
      const target = repo ? `https://github.com/${repo.owner}/${repo.name}/${pull ? 'pull' : 'issues'}/${number}` : String(number);
      const exit = await gh({ args: [pull ? 'pr' : 'issue', 'view', target, '--json', 'url,title'], cwd, signal });
      if (exit.code !== 0) return { found: false };
      return { found: true, title: ghIssueSchema.parse(JSON.parse(exit.stdout)).title };
    }).catch((): Resolution => ({ found: false }));
    links.set(key, asked);
    void asked.then(x => { if (!x.found) links.delete(key); });
    return asked;
  }

  async function lines(reference: Extract<BackingReference, { kind: 'lines' }>, cwd: string): Promise<Resolution> {
    if (reference.from < 1 || reference.to < reference.from) return { found: false };
    try {
      // Only a file inside the session's folder: the path comes from the spec, which the agent wrote.
      const found = await fileInside(cwd, reference.path, MAX_FILE_BYTES);
      return { found: 'file' in found && await lineCount(found.file) >= reference.to };
    } catch {
      return { found: false };
    }
  }

  return {
    check: ({ text, sessions, cwd }) => checkBacking(text, async reference => {
      if (reference.kind === 'answer') return answer(reference, sessions);
      if (reference.kind === 'link') return link(reference, cwd);
      return lines(reference, cwd);
    }),
  };
}

/** The file's lines, as an editor numbers them: a last line ending in a newline opens no line after it. */
async function lineCount(file: string): Promise<number> {
  const bytes = await readFile(file);
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) if (byte === 10) count++;
  return bytes[bytes.length - 1] === 10 ? count : count + 1;
}

/** Runs at most `n` tasks at a time, the others waiting their turn in order. */
function limiter(n: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>(go => waiting.push(go));
    running++;
    try { return await task(); } finally {
      running--;
      waiting.shift()?.();
    }
  };
}
