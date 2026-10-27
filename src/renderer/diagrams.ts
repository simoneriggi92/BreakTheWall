import type { Theme } from './preferences';

/**
 * Mermaid diagrams, loaded on first use as a separate chunk so the app opens without it. Strict security: labels are
 * sanitized and no script or click handler in a diagram runs.
 */
type Mermaid = typeof import('mermaid').default;
let library: Promise<Mermaid> | undefined;
let configured: Theme | undefined;
let counter = 0;

export async function renderDiagram(code: string, theme: Theme): Promise<string> {
  library ??= import('mermaid').then(m => m.default);
  const mermaid = await library;
  if (configured !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'blueprint' ? 'dark' : 'neutral', fontFamily: 'inherit' });
    configured = theme;
  }
  const id = `btw-diagram-${++counter}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } finally {
    // After a parse error Mermaid leaves its scratch element in the page.
    document.getElementById(`d${id}`)?.remove();
  }
}
