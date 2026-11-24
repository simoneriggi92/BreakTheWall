/**
 * Passages of a question's rendered text (#98): where a selection sits, as offsets into the text, and the marks that
 * show remarked passages again. Offsets count the characters of the host's text nodes, so the same Markdown gives the
 * same offsets on every render. A diagram's figure is left out: its text changes once it is drawn.
 */
import type { Remark } from '../../core/round-answers';

/**
 * Where a remark's words stand in one part of the question, as the remark keeps it; `ask` marks a passage asked about
 * in the side chat (#101), drawn in the side chat's colour apart from remarks.
 */
export type Passage = Pick<Remark, 'start' | 'end' | 'passage'> & { kind?: 'remark' | 'ask' };

const MARKS = { remark: 'round-remark-mark', ask: 'round-ask-mark' } as const;
const skipped = (node: Node) => node.parentElement?.closest('.md-diagram') != null;

function textNodes(host: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = host.ownerDocument.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (!skipped(node)) nodes.push(node as Text);
  return nodes;
}

/** The characters before a boundary point of a range, counted over the host's text nodes. */
function offsetOf(host: HTMLElement, nodes: readonly Text[], container: Node, offset: number): number {
  const point = host.ownerDocument.createRange();
  point.setStart(container, offset);
  let count = 0;
  for (const node of nodes) {
    if (node === container) return count + offset;
    // A text node other than the container lies wholly before the point or wholly after it.
    if (point.comparePoint(node, node.length) > 0) break;
    count += node.length;
  }
  return count;
}

/** The passage a range selects inside `host`, without its surrounding blanks; null when it is empty or leaves the host. */
export function passageIn(host: HTMLElement, range: Range): Passage | null {
  if (range.collapsed || !host.contains(range.startContainer) || !host.contains(range.endContainer)) return null;
  if (skipped(range.startContainer) || skipped(range.endContainer)) return null;
  const nodes = textNodes(host);
  const text = nodes.map(x => x.data).join('');
  let start = offsetOf(host, nodes, range.startContainer, range.startOffset);
  let end = offsetOf(host, nodes, range.endContainer, range.endOffset);
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return end > start ? { start, end, passage: text.slice(start, end) } : null;
}

/**
 * Marks each passage in `host`, replacing the marks drawn before. A passage whose offsets no longer hold its words
 * (the text renders differently since it was kept) is looked for by its words, and marked only where they stand
 * once: between two places it is left unmarked rather than guessed.
 */
export function markPassages(host: HTMLElement, passages: readonly Passage[]) {
  host.querySelectorAll(`mark.${MARKS.remark}, mark.${MARKS.ask}`).forEach(mark => mark.replaceWith(...mark.childNodes));
  host.normalize();
  for (const passage of passages) {
    const text = textNodes(host).map(x => x.data).join('');
    let start = passage.start;
    if (text.slice(start, passage.end) !== passage.passage) {
      start = text.indexOf(passage.passage);
      if (start !== text.lastIndexOf(passage.passage)) continue;
    }
    if (start < 0) continue;
    wrap(host, start, start + passage.passage.length, MARKS[passage.kind ?? 'remark']);
  }
}

/** Wraps the characters from `start` to `end` in marks, one per text node they cross, blanks between blocks left out. */
function wrap(host: HTMLElement, start: number, end: number, className: string) {
  let at = 0;
  for (const node of textNodes(host)) {
    const from = Math.max(start, at), to = Math.min(end, at + node.length);
    at += node.length;
    if (from >= to) continue;
    let target = node;
    if (from > at - node.length) target = target.splitText(from - (at - node.length));
    if (to < at) target.splitText(to - from);
    if (target.data.trim() === '') continue;
    const mark = host.ownerDocument.createElement('mark');
    mark.className = className;
    target.replaceWith(mark);
    mark.append(target);
    if (at >= end) break;
  }
}
