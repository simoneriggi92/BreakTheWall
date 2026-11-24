import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mermaid stands in at the library boundary. Each drawing records, as Mermaid lays it out, whether the diagram's own
// styles are in the page then, the one thing that decides whether a label is measured in the font it is shown in.
const mermaid = vi.hoisted(() => {
  const state = {
    drawnIn: [] as (HTMLElement | null)[],
    styledWhileDrawing: [] as boolean[],
    initialize: vi.fn(),
    /** For each render, the `style` attribute Mermaid wrote on an element of its drawing, as the element holds it. */
    styleAttribute: [] as (string | null)[],
    /** The same, written during the drawing on an element of the page outside it. */
    styleAttributeOutside: [] as (string | null)[],
    render: vi.fn(async (id: string, _code: string, container: HTMLElement) => {
      // Mermaid writes some styles as attributes, then measures: the policy refuses attribute styles as markup.
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      container.append(title);
      title.setAttribute('style', 'font-weight:bolder');
      state.styleAttribute.push(title.getAttribute('style'));
      const elsewhere = document.createElement('div');
      document.body.append(elsewhere);
      elsewhere.setAttribute('style', 'font-weight:bolder');
      state.styleAttributeOutside.push(elsewhere.getAttribute('style'));
      await new Promise(done => setTimeout(done, 1));
      state.drawnIn.push(container.parentElement);
      state.styledWhileDrawing.push(document.adoptedStyleSheets.some(sheet => (sheet as unknown as { text: string }).text.includes(`#${id}`)));
      return { svg: `<svg id="${id}"><style>#${id} .classTitle { font-weight: bolder; }</style><g class="classTitle"/></svg>` };
    }),
  };
  return state;
});
vi.mock('mermaid', () => ({ default: mermaid }));

// jsdom has no constructed style sheets; this stand-in keeps the text a sheet was given, which is all the test reads.
class StyleSheet { text = ''; replaceSync(css: string) { this.text = css; } }
beforeEach(() => {
  Object.defineProperty(window, 'CSSStyleSheet', { value: StyleSheet, configurable: true, writable: true });
  Object.defineProperty(document, 'adoptedStyleSheets', { value: [], configurable: true, writable: true });
});
afterEach(() => { document.body.replaceChildren(); mermaid.drawnIn.length = 0; mermaid.styledWhileDrawing.length = 0; mermaid.styleAttribute.length = 0; mermaid.styleAttributeOutside.length = 0; mermaid.render.mockClear(); });

const box = () => { const el = document.createElement('div'); el.className = 'md-diagram-svg'; document.body.append(el); return el; };

describe('drawing a diagram where it is shown, under its own styles (#114)', () => {
  it('lays the returned drawing out with the diagram\'s styles in the page, then takes them away', async () => {
    const { renderDiagram } = await import('../src/renderer/diagrams');
    const svg = await renderDiagram('classDiagram\n class Round', 'paper', box());
    // The first drawing only yields the styles; the one returned was laid out with them in place.
    expect(mermaid.styledWhileDrawing).toEqual([false, true]);
    expect(svg).toContain('<style>');
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('applies the style attributes Mermaid writes while drawing through the CSS object model, and no others', async () => {
    const { renderDiagram } = await import('../src/renderer/diagrams');
    await renderDiagram('classDiagram\n class Round', 'paper', box());
    // Through style.cssText, which the policy allows, the value comes back normalised; as markup it stays as written.
    expect(mermaid.styleAttribute).toEqual(['font-weight: bolder;', 'font-weight: bolder;']);
    // Elsewhere in the page, even while the diagram draws, and after it, setAttribute is untouched.
    expect(mermaid.styleAttributeOutside).toEqual(['font-weight:bolder', 'font-weight:bolder']);
    const other = document.createElement('div');
    other.setAttribute('style', 'font-weight:bolder');
    expect(other.getAttribute('style')).toBe('font-weight:bolder');
  });

  it('draws inside the box it will be shown in, and leaves nothing there afterwards, even when the code does not parse', async () => {
    const { renderDiagram } = await import('../src/renderer/diagrams');
    const target = box();
    mermaid.render.mockRejectedValueOnce(new Error('Parse error'));
    await expect(renderDiagram('broken', 'paper', target)).rejects.toThrow('Parse error');
    expect(target.childElementCount).toBe(0);
    expect(document.adoptedStyleSheets).toHaveLength(0);

    await renderDiagram('flowchart LR\n A --> B', 'paper', target);
    expect(mermaid.drawnIn).toEqual([target, target]);
    expect(target.childElementCount).toBe(0);
  });
});
