import type { Theme } from './preferences';
import { adoptCss, svgStyles } from './svg-mount';

/**
 * Mermaid diagrams, loaded on first use as a separate chunk so the app opens without it. Strict security: labels are
 * sanitized and no script or click handler in a diagram runs.
 */
type Mermaid = typeof import('mermaid').default;
let library: Promise<Mermaid> | undefined;
let configured: Theme | undefined;
let counter = 0;

/**
 * The scratch elements Mermaid is drawing in right now. Inside them, a `style` attribute is applied through the CSS
 * object model (`style.cssText`), which the policy allows, instead of as markup, which it refuses: Mermaid writes some
 * of a diagram's styles as attributes (a class title's bold, a label's `max-width`) and measures text right after.
 * The attribute's value ends up the same, so the drawing Mermaid returns is unchanged. Everywhere else
 * `setAttribute` is untouched.
 */
const drawing = new Set<Element>();
let styleAttributesThroughCssom = false;
function applyStyleAttributesInScratch(view: Window & typeof globalThis) {
  if (styleAttributesThroughCssom) return;
  styleAttributesThroughCssom = true;
  const original = view.Element.prototype.setAttribute;
  view.Element.prototype.setAttribute = function setAttribute(this: Element, name: string, value: string) {
    if (drawing.size && name.toLowerCase() === 'style' && 'style' in this && [...drawing].some(scratch => scratch.contains(this))) {
      (this as HTMLElement | SVGElement).style.cssText = value;
      return;
    }
    original.call(this, name, value);
  };
}

/**
 * Draws `code` and returns its SVG, laid out inside `box`, the element it will be shown in, under its own styles.
 *
 * Mermaid sizes every label from text it measures while drawing, and the production policy refuses the `<style>` it
 * writes for that (#114): measured without it, a label takes the surrounding font (another size, no bold title) and is
 * clipped once `mountSvg` applies the diagram's styles. So the diagram is drawn twice with one id: the first drawing
 * yields its styles, which are adopted through the CSS object model for the second, the one returned. Inside `box`,
 * the font the styles inherit is the font around the diagram once shown.
 */
export async function renderDiagram(code: string, theme: Theme, box: HTMLElement): Promise<string> {
  library ??= import('mermaid').then(m => m.default);
  const mermaid = await library;
  if (configured !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'blueprint' ? 'dark' : 'neutral', fontFamily: 'inherit' });
    configured = theme;
  }
  const id = `btw-diagram-${++counter}`;
  const doc = box.ownerDocument;
  // Mermaid empties the element it draws in; a scratch child keeps `box`'s own content and inherits its font. Its
  // class keeps it laid out but unseen (disassembly.css), so the half-drawn diagram never shows.
  const scratch = doc.createElement('div');
  scratch.className = 'md-diagram-scratch';
  scratch.setAttribute('aria-hidden', 'true');
  box.append(scratch);
  if (doc.defaultView) applyStyleAttributesInScratch(doc.defaultView as Window & typeof globalThis);
  drawing.add(scratch);
  let release = () => {};
  try {
    const first = await mermaid.render(id, code, scratch);
    release = adoptCss(doc, svgStyles(doc, first.svg));
    return (await mermaid.render(id, code, scratch)).svg;
  } finally {
    release();
    drawing.delete(scratch);
    scratch.remove();
    // After a parse error Mermaid leaves its own element behind, outside the scratch when it moved it.
    doc.getElementById(`d${id}`)?.remove();
  }
}
