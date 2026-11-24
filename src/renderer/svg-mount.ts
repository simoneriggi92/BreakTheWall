/**
 * Styles for a diagram's SVG without loosening the content policy. The production policy allows styles only from the
 * app's own files, so the `<style>` element and `style` attributes Mermaid writes are refused as markup. Styles set
 * through the CSS object model are allowed: `<style>` text becomes a constructed style sheet, and a `style` attribute
 * is applied through `style.cssText`. That holds both once a diagram is shown (`mountSvg`) and while Mermaid draws
 * it, when it measures its labels (`adoptCss`, `styleAttributesThroughCssom`, #114).
 */

/** Puts a diagram's SVG into `box`. Returns a function that removes its style sheet again. */
export function mountSvg(box: HTMLElement, svg: string): () => void {
  const doc = box.ownerDocument;
  const { content, css } = parseSvg(doc, svg);
  const styled = [...content.querySelectorAll<HTMLElement | SVGElement>('[style]')].map(el => ({ el, value: el.getAttribute('style') ?? '' }));
  styled.forEach(({ el }) => el.removeAttribute('style'));
  box.replaceChildren(content);
  styled.forEach(({ el, value }) => { el.style.cssText = value; });
  return adoptCss(doc, css);
}

/** The text of an SVG's `<style>` elements, which the policy would refuse in the page. */
export const svgStyles = (doc: Document, svg: string): string => parseSvg(doc, svg).css;

function parseSvg(doc: Document, svg: string): { content: DocumentFragment; css: string } {
  const template = doc.createElement('template');
  template.innerHTML = svg;
  const css = [...template.content.querySelectorAll('style')].map(s => { const text = s.textContent ?? ''; s.remove(); return text; }).join('\n');
  return { content: template.content, css };
}

/** Applies `css` to the page as a constructed style sheet. Returns a function that removes it; without the CSS object model it does nothing. */
export function adoptCss(doc: Document, css: string): () => void {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!css || !view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in doc)) return () => {};
  const sheet = new view.CSSStyleSheet();
  try { sheet.replaceSync(css); } catch { return () => {}; }
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  return () => { doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(s => s !== sheet); };
}

/** The elements Mermaid is drawing in right now. */
const drawingIn = new Set<Element>();
/** Prototypes whose `setAttribute` already knows about `drawingIn`, one per window. */
const wrapped = new WeakSet<object>();

/**
 * Until the returned function is called, a `style` attribute written on an element inside `scratch` is applied
 * through `style.cssText` instead of as markup: Mermaid writes some styles as attributes (a class title's bold, a
 * label's `max-width`) and measures text right after. The value ends up equivalent, as the CSS object model
 * normalises it. `setAttribute` is wrapped once per window; any other call goes to the original.
 */
export function styleAttributesThroughCssom(scratch: Element): () => void {
  const prototype = scratch.ownerDocument.defaultView?.Element.prototype;
  if (prototype && !wrapped.has(prototype)) {
    wrapped.add(prototype);
    const original = prototype.setAttribute;
    prototype.setAttribute = function setAttribute(this: Element, name: string, value: string) {
      if (drawingIn.size && name.toLowerCase() === 'style' && 'style' in this && [...drawingIn].some(el => el.contains(this))) {
        (this as HTMLElement | SVGElement).style.cssText = value;
        return;
      }
      original.call(this, name, value);
    };
  }
  drawingIn.add(scratch);
  return () => { drawingIn.delete(scratch); };
}
