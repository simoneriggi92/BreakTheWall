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
  // Exploration (X11): a role's ink on its ground and on the panels, the text on it; the aspect hues on their wash;
  // the layer strip's labels; the lit label. The faded whole is not a pair: it is not meant to be read until it is back.
  ...['x-main', 'x-other', 'x-prereq', 'x-note', 'x-aside', 'x-step'].flatMap(x => [[x, `${x}-soft`], [x, 'surface'], [x, 'bg'], ['ink', `${x}-soft`]] as [string, string][]),
  ...['a1', 'a2', 'a3', 'a4'].flatMap(x => [[x, `${x}-wash`], [x, 'surface'], ['ink', `${x}-wash`]] as [string, string][]),
  ['x-strip-ink', 'x-strip-seen'], ['x-strip-ink', 'x-strip-next'], ['x-strip-active-ink', 'x-strip-active'], ['x-prereq', 'x-prereq-soft'],
  ['x-lit-ink', 'x-lit'], ['muted', 'surface'],
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
  it.each([[':root, :root[data-theme="paper"]'], [':root[data-theme="blueprint"]']])('%s draws the exploration\'s strokes at 3:1 or more (X11)', selector => {
    // Graphics: the leader, a joint's stroke and the lit joint, against the panels; each aspect's tone against the panels.
    const t = tokens(selector);
    const failing = ['x-leader', 'x-aside', 'x-lit', 'x-prereq', 'a1', 'a2', 'a3', 'a4'].flatMap(fg => ['bg', 'surface'].filter(bg => contrast(t[fg], t[bg]) < 3).map(bg => `${fg}/${bg}`));
    expect(failing).toEqual([]);
  });
  it.each([[':root, :root[data-theme="paper"]'], [':root[data-theme="blueprint"]']])('%s draws the mark at 3:1 or more against the backgrounds (D25)', selector => {
    // Graphics, not text: WCAG's non-text contrast, for the bars that carry the mark's shape. The terracotta piece keeps the
    // owner's #D96B4B (3.0:1 on paper): logos are exempt, and it is never text or the only cue. The link is decorative.
    const t = tokens(selector);
    const failing = ['brand-bars'].flatMap(fg => ['bg', 'surface'].filter(bg => contrast(t[fg], t[bg]) < 3).map(bg => `${fg}/${bg}`));
    expect(failing).toEqual([]);
  });
});


describe('the exploration stylesheet (X11)', () => {
  const css = readFileSync('src/renderer/exploration.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('uses tokens only: no literal colour, and no duration or easing of its own', () => {
    const own = css.replace(/var\(--[a-z0-9-]+/g, 'var(');
    expect(own.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull();
    expect(own.match(/\b\d*\.?\d+m?s\b|cubic-bezier|\bease(-in|-out)?\b/g)).toBeNull();
  });
  it('reads every token it uses from styles.css', () => {
    const defined = new Set([...readFileSync('src/renderer/styles.css', 'utf8').matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
    // --role, --role-soft, --tone and --wash are set inside exploration.css itself, from tokens
    const local = new Set([...css.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
    const used = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]))];
    expect(used.filter(x => !defined.has(x) && !local.has(x))).toEqual([]);
  });
  it('shows the card’s lines only while the source column is hidden (X21)', () => {
    expect(css).toMatch(/\.xp-card-lines \{ display: none;/);
    expect(css).toMatch(/\.xp-src-closed \.xp-card-lines \{ display: block; \}/);
    const narrow = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(narrow).toMatch(/\.xp-tab-structure \.xp-card-lines \{ display: block; \}/);
  });
  it('never lets a block’s peek hold the pointer over a joint label (X21)', () => {
    expect(css).toMatch(/\.xp-peek \{ pointer-events: none; \}/);
  });
  it('gives the pieces aside the aside colour, in a band set off from the drawing (X25)', () => {
    expect(css).toMatch(/\.xp-aside-band \.xp-chip \{[^}]*var\(--x-aside\)[^}]*var\(--x-aside-soft\)/);
    expect(css).toMatch(/\.xp-aside-band \{[^}]*border-top: 1px dashed var\(--x-aside\)/);
  });
  it('shows no separator on a narrow window (X23)', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(narrow).toMatch(/\.xp-split, \.xp-structure-panel > \.splitter-horizontal \{ display: none; \}/);
  });
  it('gives the bar a readable description: full colour, two lines, never a single cut line (X27)', () => {
    const meta = css.match(/\.xp-meta \{[^}]*\}/)![0];
    expect(meta).toMatch(/color: var\(--ink\)/);
    expect(meta).toMatch(/-webkit-line-clamp: 2/);
    expect(meta).not.toMatch(/white-space: nowrap/);
  });
  it('stops the motion under "reduce motion"', () => {
    const styles = readFileSync('src/renderer/styles.css', 'utf8');
    const reduce = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce.slice(0, reduce.indexOf('}'))).toMatch(/--x-dur: 0ms; --x-flow: 0ms;/);
  });
});
