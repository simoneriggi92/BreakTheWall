import MarkdownIt from 'markdown-it';

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

export function renderMarkdown(text: string): RenderedSource {
  const tokens = md.parse(text, {});
  const headings: Heading[] = [];
  tokens.forEach((token, i) => {
    if (token.type === 'heading_open' && token.map) headings.push({ level: Number(token.tag.slice(1)), text: (tokens[i + 1]?.children ?? []).map(c => c.content).join(''), from: token.map[0] + 1 });
  });
  const diagrams = tokens.filter(t => t.type === 'fence' && t.info.trim().split(/\s+/)[0] === 'mermaid').length;
  return { html: md.renderer.render(tokens, md.options, {}), headings, diagrams };
}

/** A source is prose, not code, when it has no language or a two-letter content language. */
export const isProse = (source: { language?: string }) => !source.language || /^[a-z]{2}$/.test(source.language);
