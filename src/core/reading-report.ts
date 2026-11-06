import { firstLine, type Exploration, type ExplorationLink, type ExplorationPart } from './exploration';
import type { Shape } from './exploration-shape';
import type { Section } from './source-index';

/**
 * "How it was read" (plan P-20261105-exploration X6): every counted line gets one verdict, and the readings are codes
 * and numbers; the renderer writes the words. There is no accuracy score: the uncertain is counted and shown.
 */
export const VERDICTS = ['main', 'other', 'prerequisite', 'annotation', 'aside', 'trace', 'none'] as const;
export type Verdict = typeof VERDICTS[number];
/** Lower wins when two verdicts claim a line: an annotation outranks its part, a part outranks a trace. */
const RANK: Record<Verdict, number> = { annotation: -1, main: 0, other: 1, prerequisite: 2, aside: 3, trace: 5, none: 6 };

export type ReportGroup = {
  /** A top section of the index, or the lines before it (`lead`), or the whole source when it has no index. */
  title: string; line: number; end: number; lead?: boolean;
  lines: { line: number; verdict: Verdict }[];
  /** Counted lines in a part or a link. */
  used: number;
  /** A trace walks it: it counts as read even where no part cites it. */
  walked: boolean;
};
export type ReadingReport = {
  total: number;
  counts: Record<Verdict, number>;
  /** Lines in a part or a link. */
  inMap: number;
  groups: ReportGroup[];
  /** Sections with counted lines that nothing cites, not even a trace. */
  leftOut: string[];
  shape: { nuclei: number[]; aspects: number; roles: number; members: number; prerequisites: number; annotations: number; aside: number; loose: number };
  basis: { declared: number; interpreted: number; interpretedLinks: ExplorationLink[] };
  entry: { code: Shape['entry']; trace?: number; covered?: number };
  /** Share of dependent pairs in the main nucleus whose dependency comes first in the document, and the sections it spans. */
  order: { agreement: number | null; sections: number };
};

const FENCE = /^\s*(```|~~~)/, HEADING = /^#{1,6}\s/;

/** Text the reader reads: blank lines, headings (the index holds them) and fence markers are not counted. */
export function countedLines(text: string): number[] {
  const out: number[] = []; let fence = false;
  text.split('\n').forEach((l, i) => {
    if (FENCE.test(l)) { fence = !fence; return; }
    if (!l.trim() || (!fence && HEADING.test(l))) return;
    out.push(i + 1);
  });
  return out;
}

export function readingReport(x: Pick<Exploration, 'source' | 'parts' | 'links' | 'traces' | 'aspects'>, shape: Shape, index: Section[]): ReadingReport {
  const main = shape.nuclei[0], loose = new Set(shape.loose.map(p => p.id));
  const verdictOf = (p: ExplorationPart): Verdict =>
    p.kind === 'annotation' ? 'annotation' : p.kind === 'prerequisite' ? 'prerequisite'
      : p.kind === 'reference' || p.kind === 'procedure' || loose.has(p.id) ? 'aside'
        : main?.ids.includes(p.id) ? 'main' : 'other';
  const v = new Map<number, Verdict>();
  const mark = (cs: { from: number; to: number }[], k: Verdict) => {
    for (const c of cs) for (let i = c.from; i <= c.to; i++) { const was = v.get(i); if (was === undefined || RANK[k] < RANK[was]) v.set(i, k); }
  };
  const byId = new Map(x.parts.map(p => [p.id, p]));
  for (const p of x.parts) { const k = verdictOf(p); mark(p.cites, k); for (const m of p.members) mark(m.cites, k); }
  for (const l of x.links) if (l.class !== 'group' && byId.has(l.from)) mark(l.cites, verdictOf(byId.get(l.from)!));
  for (const t of x.traces) for (const s of t.steps) mark(s.cites, 'trace');
  const verdict = (n: number) => v.get(n) ?? 'none';

  const counted = countedLines(x.source.text), total = counted.length;
  const counts = Object.fromEntries(VERDICTS.map(k => [k, 0])) as Record<Verdict, number>;
  for (const n of counted) counts[verdict(n)]++;

  const tops = index.filter(s => !s.sub), lines = x.source.text.split('\n').length;
  const frames: Pick<ReportGroup, 'title' | 'line' | 'end' | 'lead'>[] = tops.map(s => ({ title: s.title, line: s.line, end: s.end }));
  if (!frames.length) frames.push({ title: '', line: 1, end: lines, lead: true });
  else if (frames[0].line > 1) frames.unshift({ title: '', line: 1, end: frames[0].line - 1, lead: true });
  const walkedAt = x.traces.flatMap(t => t.steps.flatMap(s => s.cites));
  const groups: ReportGroup[] = frames.map(f => {
    const own = counted.filter(n => f.line <= n && n <= f.end).map(n => ({ line: n, verdict: verdict(n) }));
    return { ...f, lines: own, used: own.filter(l => l.verdict !== 'none' && l.verdict !== 'trace').length, walked: walkedAt.some(c => c.from <= f.end && c.to >= f.line) };
  }).filter(g => g.lines.length);

  const links = x.links.filter(l => l.class !== 'group'), interpreted = links.filter(l => l.basis !== 'declared');
  let pairs = 0, agree = 0;
  if (main) for (const a of main.ids) for (const b of main.ids) {
    if (main.layer.get(a)! < main.layer.get(b)!) { pairs++; if (firstLine(byId.get(a)!) < firstLine(byId.get(b)!)) agree++; }
  }
  const sections = main ? new Set(main.ids.map(id => frames.findIndex(f => f.line <= firstLine(byId.get(id)!) && firstLine(byId.get(id)!) <= f.end))).size : 0;
  const trace = shape.trace;

  return {
    total, counts, inMap: total - counts.trace - counts.none, groups,
    leftOut: groups.filter(g => g.lines.every(l => l.verdict === 'none')).map(g => g.title),
    shape: {
      nuclei: shape.nuclei.map(n => n.ids.length), aspects: x.aspects.length, roles: x.parts.filter(p => p.kind === 'part').length,
      members: x.parts.reduce((s, p) => s + p.members.length, 0), prerequisites: shape.prerequisites.length,
      annotations: shape.annotations.length, aside: shape.aside.length, loose: shape.loose.length,
    },
    basis: { declared: links.length - interpreted.length, interpreted: interpreted.length, interpretedLinks: interpreted },
    entry: trace === undefined ? { code: shape.entry } : { code: shape.entry, trace, covered: shape.coverage[trace] },
    order: { agreement: pairs ? agree / pairs : null, sections },
  };
}
