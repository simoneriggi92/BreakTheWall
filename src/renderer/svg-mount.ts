/**
 * Puts a diagram's SVG into the page without loosening the content policy. The production policy allows styles only
 * from the app's own files, so the `<style>` element and `style` attributes Mermaid writes would be ignored. Styles set
 * through the CSS object model are allowed: the `<style>` text becomes a constructed style sheet, and each `style`
 * attribute is applied through `style.cssText`. Returns a function that removes the sheet again.
 */
export function mountSvg(box: HTMLElement, svg: string): () => void {
  const doc = box.ownerDocument;
  const template = doc.createElement('template');
  template.innerHTML = svg;
  const css = takeStyles(template.content);
  const styled = [...template.content.querySelectorAll<HTMLElement | SVGElement>('[style]')].map(el => ({ el, value: el.getAttribute('style') ?? '' }));
  styled.forEach(({ el }) => el.removeAttribute('style'));
  box.replaceChildren(template.content);
  styled.forEach(({ el, value }) => { el.style.cssText = value; });
  return adoptCss(doc, css);
}

/** The text of an SVG's `<style>` elements, which the policy would refuse in the page. */
export function svgStyles(doc: Document, svg: string): string {
  const template = doc.createElement('template');
  template.innerHTML = svg;
  return takeStyles(template.content);
}

function takeStyles(content: DocumentFragment): string {
  return [...content.querySelectorAll('style')].map(s => { const text = s.textContent ?? ''; s.remove(); return text; }).join('\n');
}

/**
 * Applies `css` to the page as a constructed style sheet, the one way the policy lets a style in that is not one of
 * the app's files. Returns a function that removes it again; without the CSS object model it does nothing.
 */
export function adoptCss(doc: Document, css: string): () => void {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!css || !view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in doc)) return () => {};
  const sheet = new view.CSSStyleSheet();
  try { sheet.replaceSync(css); } catch { return () => {}; }
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  return () => { doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(s => s !== sheet); };
}
