import type { Cite, Part } from './disassembly';

/** Faces read only the sources' ids and text. */
type Sources = { sources: { id: string; text: string }[] };

/**
 * Faces from a part's own lines (P-20261103-lab-mode L2). An opened part's components show the structure of the
 * lines it cites: its sections, table rows, list items, the numbered steps of a code block, or the code itself.
 * A part whose lines are prose has no face and stays a plain module: nothing is invented to look better.
 */
export interface FaceItem extends Cite {
  label: string;
  /** Table rows: the header and the row's cells. */
  head?: string[]; cells?: string[];
  /** List items and steps: the whole text, continuation lines joined. */
  text?: string;
  /** A row, item or heading the source marks with ⚠. */
  warn?: boolean;
  /** Sections: how many rows or items they hold. */
  count?: number;
  /** Sections: the table rows inside them. */
  rows?: FaceItem[];
}
export interface Outline { heads: FaceItem[]; rows: FaceItem[]; list: FaceItem[]; steps: FaceItem[]; code: FaceItem[] }

const bare = (s: string) => s.replace(/`|\*\*/g, '');
/** A label as the source writes it, without markup, parenthetical asides, numbering or what follows a colon. */
export const cleanLabel = (s: string) => bare(s).replace(/\s*\([^)]*\)/g, '').replace(/^\d+(\.\d+)*\s+/, '').replace(/:.*$/, '').trim();
const LIST = /^\s*(?:[-*]|\d+\.)\s+(.*)/;

export function outlineOf(d: Sources, part: Pick<Part, 'cites'>): Outline {
  const o: Outline = { heads: [], rows: [], list: [], steps: [], code: [] };
  for (const c of part.cites) {
    const lines = d.sources.find(s => s.id === c.source)?.text.split('\n') ?? [];
    let fence = false, head: string[] | undefined, section: FaceItem | undefined, item: FaceItem | undefined;
    for (let n = c.from; n <= c.to; n++) {
      const l = lines[n - 1] ?? '';
      if (section) section.to = n;
      if (/^\s*```/.test(l)) { fence = !fence; head = undefined; item = undefined; continue; }
      if (fence) {
        if (l.trim()) o.code.push({ source: c.source, from: n, to: n, label: l, text: l });
        const m = l.match(/^\s*(\d+)\s+(\S.*)$/);
        if (m) o.steps.push({ source: c.source, from: n, to: n, label: `${m[1]}. ${bare(m[2].replace(/\s*←.*$/, '')).trim()}`, text: bare(l.trim()) });
        continue;
      }
      // Sections start at third-level headings and below: higher ones name the page, not a part of the part.
      if (/^#{3,} /.test(l)) {
        const t = l.replace(/^#+\s*/, '');
        section = { source: c.source, from: n, to: n, label: cleanLabel(t.replace(/^⚠\s*/, '')), warn: /⚠/.test(t), count: 0, rows: [] };
        o.heads.push(section); head = undefined; item = undefined; continue;
      }
      if (/^\|/.test(l)) {
        const cells = l.split('|').slice(1, -1).map(x => x.trim());
        if (cells.every(x => /^:?-+:?$/.test(x))) continue;
        if (!head) { head = cells; continue; }      // a table's first row is its header
        const row: FaceItem = { source: c.source, from: n, to: n, label: cleanLabel(cells[0]), head, cells, warn: /⚠/.test(l) };
        o.rows.push(row); if (section) { section.count!++; section.rows!.push(row); }
        continue;
      }
      head = undefined;
      const li = l.match(LIST);
      if (li) {
        // a bold phrase names the item when it is a phrase; otherwise its first words do
        const t = li[1], b = t.match(/\*\*([^*]+)\*\*/), named = b && b[1].length >= 10 ? b[1] : t.split(/\s+/).slice(0, 5).join(' ');
        item = { source: c.source, from: n, to: n, label: cleanLabel(named) || bare(named), text: bare(t), warn: /⚠/.test(t) };
        o.list.push(item); if (section) section.count!++;
      } else if (item && item.to === n - 1 && /^\s{2,}\S/.test(l)) { item.text += ` ${bare(l.trim())}`; item.to = n; }
      else item = undefined;
    }
  }
  return o;
}

/** What an opened component shows on its face, chosen by the part's icon, as in prototypes/lab-representation. */
export const FACES = ['drawers', 'dials', 'holders', 'cards', 'sheets', 'notes', 'warnings', 'legend', 'sockets', 'lenses', 'knobs', 'checks', 'wheel', 'screen'] as const;
export type FaceKind = typeof FACES[number];
type Source = keyof Outline;
const RULES: Partial<Record<Part['icon'], { face: FaceKind; from: Source[]; min?: number }[]>> = {
  database: [{ face: 'drawers', from: ['heads'] }],
  gauge: [{ face: 'dials', from: ['rows'] }, { face: 'dials', from: ['heads'] }],
  ruler: [{ face: 'holders', from: ['heads'] }],
  'list-checks': [{ face: 'cards', from: ['rows'], min: 4 }, { face: 'checks', from: ['list'], min: 3 }],
  code: [{ face: 'cards', from: ['rows'], min: 4 }],
  'book-open': [{ face: 'sheets', from: ['heads', 'list'] }],
  'file-text': [{ face: 'sheets', from: ['heads', 'list'] }],
  'key-round': [{ face: 'notes', from: ['list', 'heads'] }],
  'triangle-alert': [{ face: 'warnings', from: ['heads', 'list'] }],
  map: [{ face: 'legend', from: ['rows', 'heads'] }],
  plug: [{ face: 'sockets', from: ['heads', 'rows'] }],
  search: [{ face: 'lenses', from: ['heads', 'list'] }],
  settings: [{ face: 'knobs', from: ['rows', 'heads', 'list'] }],
  send: [{ face: 'knobs', from: ['rows', 'list'], min: 3 }],
  'clipboard-check': [{ face: 'checks', from: ['heads', 'list'] }],
  filter: [{ face: 'checks', from: ['list', 'heads'], min: 3 }],
  repeat: [{ face: 'wheel', from: ['steps'], min: 3 }],
  download: [{ face: 'screen', from: ['code'], min: 3 }], play: [{ face: 'screen', from: ['code'], min: 3 }],
  timer: [{ face: 'screen', from: ['code'], min: 3 }], 'git-branch': [{ face: 'screen', from: ['code'], min: 3 }],
};

export interface Face { face: FaceKind; from: Source; items: FaceItem[] }
export function faceOf(d: Sources, part: Pick<Part, 'icon' | 'cites'>): Face | undefined {
  const rules = RULES[part.icon]; if (!rules) return undefined;
  const o = outlineOf(d, part);
  for (const r of rules) for (const from of r.from) {
    let items = o[from];
    // drawers: a section with a table is one drawer per row; holders: only sections that hold rows
    if (r.face === 'drawers') items = o.heads.flatMap(h => h.rows!.length ? h.rows! : [h]);
    if (r.face === 'holders') items = o.heads.filter(h => h.rows!.length);
    if (items.length >= (r.min ?? 2)) return { face: r.face, from, items };
  }
  return undefined;
}
