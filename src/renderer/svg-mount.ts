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
  const css = [...template.content.querySelectorAll('style')].map(s => { const text = s.textContent ?? ''; s.remove(); return text; }).join('\n');
  const styled = [...template.content.querySelectorAll<HTMLElement | SVGElement>('[style]')].map(el => ({ el, value: el.getAttribute('style') ?? '' }));
  styled.forEach(({ el }) => el.removeAttribute('style'));
  box.replaceChildren(template.content);
  styled.forEach(({ el, value }) => { el.style.cssText = value; });

  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!css || !view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in doc)) return () => {};
  const sheet = new view.CSSStyleSheet();
  try { sheet.replaceSync(css); } catch { return () => {}; }
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  return () => { doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(s => s !== sheet); };
}
