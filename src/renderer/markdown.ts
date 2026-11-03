import MarkdownIt from 'markdown-it';
import type { ReadingBlock } from '../core/source-reading';

/**
 * Markdown sources rendered as a document (D18). Raw HTML is off, so markup inside a source shows as text and never
 * runs. Every block carries the source lines it came from (`data-from`, `data-to`, 1-based and inclusive), so a
 * citation can highlight its blocks. Links are not followed and images are not fetched: nothing leaves the Mac.
 * Fences tagged `mermaid` become placeholders that the diagram renderer fills.
 */
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const escape = md.utils.escapeHtml;

md.core.ruler.push('source_lines', state => {
  for (const token of state.tokens) {
    if (!token.map || token.nesting === -1) continue;
    token.attrSet('data-from', String(token.map[0] + 1));
    token.attrSet('data-to', String(Math.max(token.map[0] + 1, token.map[1])));
  }
});
md.renderer.rules.fence = (tokens, i) => {
  const token = tokens[i];
  const lines = `data-from="${token.attrGet('data-from')}" data-to="${token.attrGet('data-to')}"`;
  const lang = token.info.trim().split(/\s+/)[0];
  if (lang === 'mermaid') return `<figure class="md-diagram" ${lines}><pre class="md-diagram-source">${escape(token.content)}</pre></figure>\n`;
  return `<pre class="md-code" ${lines}><code>${escape(token.content)}</code></pre>\n`;
};
md.renderer.rules.code_block = md.renderer.rules.fence;
md.renderer.rules.link_open = (tokens, i) => `<span class="md-link" title="${escape(String(tokens[i].attrGet('href') ?? ''))}">`;
md.renderer.rules.link_close = () => '</span>';
md.renderer.rules.image = (tokens, i) => `<span class="md-image">[${escape(String(tokens[i].content || tokens[i].attrGet('src') || ''))}]</span>`;

export interface Heading { level: number; text: string; from: number }
export interface RenderedSource { html: string; headings: Heading[]; diagrams: number }

export function renderMarkdown(text: string, firstLine = 1): RenderedSource {
  const tokens = md.parse(text, {});
  if (firstLine !== 1) for (const token of tokens) {
    if (!token.map) continue;
    token.attrSet('data-from', String(token.map[0] + firstLine));
    token.attrSet('data-to', String(Math.max(token.map[0] + firstLine, token.map[1] + firstLine - 1)));
  }
  const headings: Heading[] = [];
  tokens.forEach((token, i) => {
    if (token.type === 'heading_open' && token.map) headings.push({ level: Number(token.tag.slice(1)), text: (tokens[i + 1]?.children ?? []).map(c => c.content).join(''), from: token.map[0] + firstLine });
  });
  const diagrams = tokens.filter(t => t.type === 'fence' && t.info.trim().split(/\s+/)[0] === 'mermaid').length;
  return { html: md.renderer.render(tokens, md.options, {}), headings, diagrams };
}

/** A source is prose, not code, when it has no language or a two-letter content language. */
export const isProse = (source: { language?: string }) => !source.language || /^[a-z]{2}$/.test(source.language);

/** Root blocks only: a heading inside a fence or list cannot split that block. */
export function readingBlocks(text: string, prose = true): ReadingBlock[] {
  if (!prose) return [{ from: 1, to: text.split('\n').length }];
  const tokens = md.parse(text, {});
  return tokens.flatMap((token, i) => token.level === 0 && token.map && token.nesting !== -1
    ? [{ from: token.map[0] + 1, to: Math.max(token.map[0] + 1, token.map[1]),
      ...(token.type === 'heading_open' ? { heading: (tokens[i + 1]?.children ?? []).map(c => c.content).join('') } : {}) }]
    : []);
}
