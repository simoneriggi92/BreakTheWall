import type { Theme } from './preferences';
import { adoptCss, styleAttributesThroughCssom, svgStyles } from './svg-mount';

/**
 * Mermaid diagrams, loaded on first use as a separate chunk so the app opens without it. Strict security: labels are
 * sanitized and no script or click handler in a diagram runs.
 */
type Mermaid = typeof import('mermaid').default;
let library: Promise<Mermaid> | undefined;
let configured: Theme | undefined;
let counter = 0;

/**
 * Draws `code` and returns its SVG, laid out inside `box`, the element it will be shown in, under its own styles.
 *
 * Mermaid sizes every label from text it measures while drawing, and the production policy refuses the styles it
 * writes as markup then (#114): measured without them, a label takes the surrounding font (another size, no bold
 * title) and is clipped once `mountSvg` applies them. So the diagram is drawn twice with one id: the first drawing
 * yields its `<style>`, adopted through the CSS object model for the second, the one returned, while `style`
 * attributes go through `style.cssText` (svg-mount.ts). Every diagram costs two layouts; labels then measure exactly
 * as they would with the policy off. Inside `box`, the font the styles inherit is the font around the diagram shown.
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
  // Mermaid empties the element it draws in, and leaves its own elements there; a scratch child keeps `box`'s content,
  // inherits its font, and takes Mermaid's leftovers away with it. Its class keeps it laid out but unseen.
  const scratch = doc.createElement('div');
  scratch.className = 'md-diagram-scratch';
  scratch.setAttribute('aria-hidden', 'true');
  box.append(scratch);
  const stopStyleAttributes = styleAttributesThroughCssom(scratch);
  let releaseSheet = () => {};
  try {
    const first = await mermaid.render(id, code, scratch);
    releaseSheet = adoptCss(doc, svgStyles(doc, first.svg));
    return (await mermaid.render(id, code, scratch)).svg;
  } finally {
    releaseSheet();
    stopStyleAttributes();
    scratch.remove();
  }
}
