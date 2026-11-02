import type { Cite, Disassembly, Part } from './disassembly';

/** Root source blocks, supplied by the format parser. Lists, tables and fences stay indivisible. */
export interface ReadingBlock { from: number; to: number; heading?: string }
export interface ReadingPassage extends Cite { title?: string }
export interface ReadingPosition { source: string; from: number; view: 'guided' | 'overview' }

/** A soft reading size, never a reason to cut an original block. Advancing never generates more steps. */
const TARGET_CHARS = 1800;
export function sourceReadingRoute(sources: Pick<Disassembly['sources'][number], 'id' | 'text'>[], blocks: Record<string, ReadingBlock[]>): ReadingPassage[] {
  return sources.flatMap(source => {
    const lines = source.text.split('\n');
    const structural = (blocks[source.id] ?? []).filter(b => b.from >= 1 && b.to >= b.from && b.to <= lines.length).sort((a, b) => a.from - b.from);
    const route: ReadingPassage[] = [];
    let from = 1, content = false, title: string | undefined;
    const flush = (to: number) => { if (to >= from) route.push({ source: source.id, from, to, title }); from = to + 1; content = false; };
    for (const block of structural) {
      if (block.from < from) continue;
      const large = content && lines.slice(from - 1, block.to).join('\n').length > TARGET_CHARS;
      if (content && (block.heading !== undefined || large)) flush(block.from - 1);
      if (block.heading !== undefined) title = block.heading;
      else content = true;
    }
    // A trailing title without a body stays with the preceding passage rather than becoming an empty step.
    if (!content && route.length) route.at(-1)!.to = lines.length;
    else flush(lines.length);
    return route;
  });
}

export function readingIndex(route: ReadingPassage[], position?: Pick<ReadingPosition, 'source' | 'from'>): number {
  const i = position && route.findIndex(p => p.source === position.source && p.from <= position.from && p.to >= position.from);
  return i === undefined || i < 0 ? 0 : i;
}
const overlap = (a: Cite, b: Cite) => a.source === b.source ? Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from) + 1) : 0;

/** Existing citations alone supply context. Unassigned text never gets an invented part. */
export function readingContext(d: Disassembly, passage: Cite): { root?: Part; part?: Part } {
  let chosen: { root: Part; part: Part; score: number; depth: number } | undefined;
  const visit = (part: Part, root: Part, depth: number) => {
    const score = part.cites.reduce((n, c) => n + overlap(c, passage), 0);
    if (score > 0 && (!chosen || score > chosen.score || score === chosen.score && depth > chosen.depth)) chosen = { root, part, score, depth };
    part.parts?.forEach(p => visit(p, root, depth + 1));
  };
  d.parts.forEach(p => visit(p, p, 0));
  return chosen ? { root: chosen.root, part: chosen.part } : {};
}
