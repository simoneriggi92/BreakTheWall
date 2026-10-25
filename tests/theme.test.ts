import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Reads the token blocks from the stylesheet itself, so the test checks what ships. */
function tokens(selector: string): Record<string, string> {
  const css = readFileSync('src/renderer/styles.css', 'utf8');
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]));
}
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// Text drawn on each background, including joint labels in their kind's color.
const PAIRS: [string, string][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'sunk'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'sunk'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accent-soft'], ['accent-ink', 'accent'],
  ['good', 'surface'], ['good', 'good-soft'], ['bad', 'surface'], ['bad', 'bad-soft'], ['amber', 'surface'], ['amber', 'amber-soft'], ['purple', 'surface'],
  ['code-ink', 'code-bg'], ['code-dim', 'code-bg'],
  ...['mechanism', 'argument', 'story', 'ok', 'fail', 'active'].flatMap(x => [[x, 'bg'], [x, 'surface']] as [string, string][]),
];

describe('paper and blueprint themes', () => {
  it.each([[':root, :root[data-theme="paper"]'], [':root[data-theme="blueprint"]']])('%s reaches WCAG AA for every text pair', selector => {
    const t = tokens(selector);
    const failing = PAIRS.filter(([fg, bg]) => !t[fg] || !t[bg] || contrast(t[fg], t[bg]) < 4.5).map(([fg, bg]) => `${fg}/${bg}`);
    expect(failing).toEqual([]);
  });
  it('defines the same tokens in both themes', () => {
    const paper = tokens(':root, :root[data-theme="paper"]'); const blueprint = tokens(':root[data-theme="blueprint"]');
    expect(Object.keys(blueprint).sort()).toEqual(Object.keys(paper).sort());
  });
});
