import type { Lesson } from '../src/core/lesson';

/** Structure measured from an assembled lesson. None of these numbers says whether an explanation is true. */
export interface LessonMetrics {
  pages: number;
  blocks: Record<string, number>;
  activities: { choice: number; order: number };
  evidence: number;
  /** Share of source lines inside at least one citation: how much of the material the lesson actually uses. */
  coverage: number;
  /** For each choice, the correct option's length divided by the mean wrong option's length. Large values give the answer away. */
  answerLengthRatios: number[];
}

export function lessonMetrics(lesson: Lesson): LessonMetrics {
  const blocks: Record<string, number> = {};
  for (const block of lesson.pages.flatMap(p => p.blocks)) blocks[block.type] = (blocks[block.type] ?? 0) + 1;
  const total = lesson.sources.reduce((sum, s) => sum + s.text.split('\n').length, 0);
  const covered = lesson.sources.reduce((sum, s) => {
    const lines = new Set<number>();
    for (const e of lesson.evidence.filter(x => x.sourceId === s.id)) for (let l = e.startLine; l <= e.endLine; l++) lines.add(l);
    return sum + lines.size;
  }, 0);
  const answerLengthRatios = lesson.activities.flatMap(a => {
    if (a.type !== 'choice') return [];
    const correct = a.options.find(o => o.id === a.correctId)!.label.length;
    const wrong = a.options.filter(o => o.id !== a.correctId).map(o => o.label.length);
    return [Math.round(correct / (wrong.reduce((x, y) => x + y, 0) / wrong.length) * 100) / 100];
  });
  return {
    pages: lesson.pages.length, blocks,
    activities: { choice: lesson.activities.filter(a => a.type === 'choice').length, order: lesson.activities.filter(a => a.type === 'order').length },
    evidence: lesson.evidence.length, coverage: Math.round(covered / total * 100) / 100, answerLengthRatios,
  };
}

/** One attempt, as written to the JSON-lines report. */
export interface AttemptRecord {
  run: string; case: string; private: boolean; route: 'chatgpt' | 'local'; runtime?: string; model: string; attempt: number;
  ok: boolean; failure?: string; issues?: string[]; repaired: boolean; seconds: number; outputChars: number;
  metrics?: LessonMetrics; lessonFile?: string;
}

const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export interface CaseSummary { case: string; attempts: number; valid: number; repaired: number; medianSeconds?: number; slowestSeconds?: number; medianCoverage?: number; maxAnswerLengthRatio?: number; failures: string[] }
export function summarize(records: AttemptRecord[]): CaseSummary[] {
  const cases = [...new Set(records.map(r => r.case))];
  return cases.map(id => {
    const own = records.filter(r => r.case === id);
    const valid = own.filter(r => r.ok);
    const ratios = valid.flatMap(r => r.metrics?.answerLengthRatios ?? []);
    const coverage = median(valid.map(r => Math.round((r.metrics?.coverage ?? 0) * 100)));
    return {
      case: id, attempts: own.length, valid: valid.length, repaired: own.filter(r => r.repaired).length,
      medianSeconds: median(own.map(r => r.seconds)), slowestSeconds: own.length ? Math.max(...own.map(r => r.seconds)) : undefined,
      medianCoverage: coverage === undefined ? undefined : coverage / 100,
      maxAnswerLengthRatio: ratios.length ? Math.max(...ratios) : undefined,
      failures: own.filter(r => !r.ok).map(r => r.failure ?? 'unknown'),
    };
  });
}
