import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { validateDisassembly } from '../src/core/disassembly';
import { renderMarkdown } from '../src/renderer/markdown';
import { DisassemblyPlayer } from '../src/renderer/disassembly/DisassemblyPlayer';
import { SourceDocument } from '../src/renderer/disassembly/SourceDocument';
import { PreferencesProvider } from '../src/renderer/preferences';
import { atlas } from './disassemblies';

// jsdom cannot lay out a Mermaid diagram: the renderer is replaced, and a diagram whose code says "broken" fails.
const renderDiagram = vi.hoisted(() => vi.fn(async (code: string) => {
  if (code.includes('broken')) throw new Error('Parse error');
  return '<svg class="drawn-diagram"><text>diagram</text></svg>';
}));
vi.mock('../src/renderer/diagrams', () => ({ renderDiagram }));

const bridge: DesktopBridge = {
  getRuntime: async () => ({ platform: 'test', mode: 'browser', locale: 'it-IT' }),
  loadProgress: async () => ({ state: null }),
  saveProgress: async () => {},
};
const SAMPLE = [
  '# Title',                 // 1
  '',                        // 2
  'First paragraph',         // 3
  'still the first.',        // 4
  '',                        // 5
  '- one',                   // 6
  '- two',                   // 7
  '',                        // 8
  '| a | b |',               // 9
  '| --- | --- |',           // 10
  '| 1 | 2 |',               // 11
  '',                        // 12
  '```mermaid',              // 13
  'flowchart LR',            // 14
  '  A --> B',               // 15
  '```',                     // 16
  '',                        // 17
  '<script>alert(1)</script> and <img src=x onerror="alert(2)">', // 18
  '',                        // 19
  'See [the docs](https://example.com) and ![a chart](chart.png).', // 20
  '',                        // 21
  '```mermaid',              // 22
  'broken diagram',          // 23
  '```',                     // 24
].join('\n');
const source = { id: 's', title: 'notes.md', text: SAMPLE, origin: 'user-paste', sha256: 'x'.repeat(64) } as any;
const doc = (props: Partial<Parameters<typeof SourceDocument>[0]> = {}) => render(<PreferencesProvider bridge={bridge}><SourceDocument source={source} cited={[]} {...props}/></PreferencesProvider>);

describe('rendered view of a markdown source (D18)', () => {
  it('renders headings, lists, tables and code, and maps every block to its source lines', () => {
    const { html, headings, diagrams } = renderMarkdown(SAMPLE);
    const host = document.createElement('div'); host.innerHTML = html;
    expect(host.querySelector('h1')!.textContent).toBe('Title');
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(host.querySelector('table td')!.textContent).toBe('1');
    expect(headings).toEqual([{ level: 1, text: 'Title', from: 1 }]);
    expect(diagrams).toBe(2);
    const p = host.querySelector('p')!;
    expect([p.dataset.from, p.dataset.to]).toEqual(['3', '4']);
    expect(host.querySelectorAll('li')[1].dataset.from).toBe('7');
    expect(host.querySelector<HTMLElement>('.md-diagram')!.dataset.from).toBe('13');
  });
  it('shows raw HTML as text, does not follow links and does not fetch images', () => {
    const host = document.createElement('div'); host.innerHTML = renderMarkdown(SAMPLE).html;
    expect(host.querySelector('script, img, a, iframe')).toBeNull();
    expect(host.textContent).toContain('<script>alert(1)</script>');
    expect(host.querySelector('.md-link')!.getAttribute('title')).toBe('https://example.com');
    expect(host.querySelector('.md-image')!.textContent).toBe('[a chart]');
  });
  it('highlights the innermost blocks a citation meets, and shades the cited ones', async () => {
    doc({ focus: { source: 's', from: 7, to: 7 }, cited: [{ source: 's', from: 3, to: 4 }] });
    const focused = [...document.querySelectorAll<HTMLElement>('.source-document .focus')];
    expect(focused.map(x => x.tagName)).toEqual(['LI']);
    expect(focused[0].textContent).toBe('two');
    expect(document.querySelector('.source-document .cited')!.tagName).toBe('P');
  });
  it('draws diagrams, and keeps the code of one that does not parse, with a note', async () => {
    doc();
    await waitFor(() => expect(document.querySelectorAll('.md-diagram.drawn')).toHaveLength(1));
    expect(document.querySelector('.md-diagram.drawn .drawn-diagram')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.md-diagram.failed')).not.toBeNull());
    expect(document.querySelector('.md-diagram.failed .md-diagram-source')!.textContent).toBe('broken diagram\n');
    expect(screen.getByText('Questo diagramma non si disegna: resta il suo codice.')).toBeInTheDocument();
    expect(renderDiagram).toHaveBeenCalledWith('flowchart LR\n  A --> B\n', 'paper');
  });
});

describe('the source pane with its document view and reader (D18)', () => {
  const play = async (d: any) => {
    render(<PreferencesProvider bridge={bridge}><DisassemblyPlayer d={d} bridge={bridge} goHome={() => {}}/></PreferencesProvider>);
    await screen.findByRole('group', { name: /Cosa fare con lo smontaggio/ });
  };
  it('switches a prose source between lines and document, and a citation highlights its blocks', async () => {
    await play(await validateDisassembly(atlas()));
    await userEvent.click(screen.getByRole('button', { name: /^4\. deploy-staging/ }));
    const views = within(screen.getByRole('group', { name: 'Come mostrare la fonte' }));
    await userEvent.click(views.getByRole('button', { name: 'Documento' }));
    const focused = [...document.querySelectorAll<HTMLElement>('.source-document .focus')];
    expect(focused.length).toBeGreaterThan(0);
    expect(focused.every(x => Number(x.dataset.from) <= 33 && Number(x.dataset.to) >= 30)).toBe(true);
    expect(document.querySelector('.source-text')).toBeNull();
    await userEvent.click(views.getByRole('button', { name: 'Righe' }));
    expect(document.querySelector('.source-text')).not.toBeNull();
  });
  it('opens the full-window reader with an outline; Escape closes it, returns focus and keeps the level', async () => {
    await play(await validateDisassembly(atlas()));
    await userEvent.click(screen.getByRole('button', { name: /^2\. check/ }));
    await userEvent.click(screen.getByRole('button', { name: /Apri comunque il sottoassieme/ }));
    const open = screen.getByRole('button', { name: 'Leggi a tutta finestra' });
    await userEvent.click(open);
    const reader = screen.getByRole('dialog', { name: 'Lettura: release-runbook.md' });
    expect(within(reader).getByRole('navigation', { name: 'Indice' })).toBeInTheDocument();
    expect(within(reader).getByRole('button', { name: '2. Pipelines' })).toBeInTheDocument();
    expect(within(reader).getByRole('button', { name: '5. What check verifies' })).toBeInTheDocument();
    within(reader).getByRole('button', { name: 'Chiudi la lettura' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(open).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Livello superiore: Catena di rilascio' })).toBeInTheDocument();
  });
  it('offers neither view switch nor reader for code', async () => {
    const d = atlas(); d.sources[0].language = 'TypeScript';
    await play(await validateDisassembly(d));
    expect(screen.queryByRole('group', { name: 'Come mostrare la fonte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leggi a tutta finestra' })).toBeNull();
  });
});

describe('diagrams under the content policy (D18)', async () => {
  const { mountSvg } = await import('../src/renderer/svg-mount');
  it('moves inline styles out of the markup, where the policy would ignore them', () => {
    const box = document.createElement('div');
    mountSvg(box, '<svg id="d1"><style>#d1 .node{fill:red}</style><g class="node" style="stroke: blue"><rect/></g></svg>');
    expect(box.querySelector('style')).toBeNull();
    const node = box.querySelector<SVGGElement>('.node')!;
    expect(node.style.stroke).toBe('blue');
  });
});


it('keeps the full-window outline reachable in a narrow window and returns focus on close', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 720, configurable: true });
  try {
    const d = await validateDisassembly(atlas());
    render(<PreferencesProvider bridge={bridge}><DisassemblyPlayer d={d} bridge={bridge} goHome={() => {}}/></PreferencesProvider>);
    await screen.findByRole('group', { name: /Cosa fare con lo smontaggio/ });
    const open = screen.getByRole('button', { name: 'Leggi a tutta finestra' });
    await userEvent.click(open);
    const reader = screen.getByRole('dialog');
    expect(within(reader).queryByRole('navigation', { name: 'Indice' })).toBeNull();
    await userEvent.click(within(reader).getByRole('button', { name: 'Indice' }));
    expect(within(reader).getByRole('navigation', { name: 'Indice' })).toBeVisible();
    await userEvent.click(within(reader).getByRole('button', { name: '2. Pipelines' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(open).toHaveFocus();
  } finally { Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true }); }
});
