/**
 * The source's own index (plan P-20261105-exploration X4): its Markdown headings, read by the app, no model. Two depths
 * at most; a lone first-level heading on top is the title; lines before the first section become an opening section
 * when they say something. Headings inside code fences are code, not sections.
 */
export type Section = {
  title: string;
  /** The heading's line, 1-based. */
  line: number;
  /** The section's last line, its subsections included. */
  end: number;
  /** The last line of the section's own text, before its first subsection. */
  own: number;
  /** A subsection of the section above it. */
  sub: boolean;
  /** Lines before the first heading, kept as a section of their own. */
  opening?: boolean;
};

const FENCE = /^\s*(```|~~~)/, HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function sourceIndex(text: string): Section[] {
  const lines = text.split('\n'), all: { depth: number; title: string; line: number; end: number }[] = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (FENCE.test(l)) { fence = !fence; return; }
    const m = !fence && l.match(HEADING);
    if (m) all.push({ depth: m[1].length, title: m[2].replace(/[`*_]/g, ''), line: i + 1, end: 0 });
  });
  all.forEach((s, j) => { const next = all.slice(j + 1).find(t => t.depth <= s.depth); s.end = (next?.line ?? lines.length + 1) - 1; });
  // a lone first-level heading on top names the whole source: it is the title, not a section
  const body = all.filter(s => s.depth === 1).length === 1 && all[0]?.depth === 1 ? all.slice(1) : all;
  if (!body.length) return [];
  const top = Math.min(...body.map(s => s.depth));
  const out: Section[] = body.filter(s => s.depth <= top + 1).map(s => ({ title: s.title, line: s.line, end: s.end, own: s.end, sub: s.depth > top }));
  const head = all[0] && all[0] !== body[0] ? all[0].line + 1 : 1;
  if (body[0].line > head && lines.slice(head - 1, body[0].line - 1).some(l => l.trim()))
    out.unshift({ title: '', line: head, end: body[0].line - 1, own: body[0].line - 1, sub: false, opening: true });
  // a parent's own lines stop where its first subsection starts
  out.forEach((s, j) => { if (!s.sub && out[j + 1]?.sub) s.own = out[j + 1].line - 1; });
  return out;
}

/** The narrowest section that holds a line. */
export function sectionAt(index: Section[], line: number): Section | undefined {
  return index.filter(s => s.line <= line && line <= s.end).pop();
}
