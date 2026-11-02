import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, type DisassemblyState } from '../src/core/disassembly-state';
import { hashText } from '../src/core/lesson';
import { DisassemblyPlayer } from '../src/renderer/disassembly/DisassemblyPlayer';
import { PreferencesProvider } from '../src/renderer/preferences';
import { atlas } from './disassemblies';

function store(initial: unknown = null, locale = 'it-IT') {
  let saved = initial;
  const bridge: DesktopBridge = {
    getRuntime: async () => ({ platform: 'test', mode: 'browser', locale }),
    loadProgress: async () => ({ state: structuredClone(saved) }),
    saveProgress: async state => { saved = structuredClone(state); },
  };
  return { bridge, state: () => saved as DisassemblyState };
}
const mount = (d: Awaited<ReturnType<typeof validateDisassembly>>, bridge: DesktopBridge) =>
  render(<PreferencesProvider bridge={bridge}><DisassemblyPlayer d={d} bridge={bridge} goHome={() => {}}/></PreferencesProvider>);

describe('guided source reading in the player', () => {
  it('resizes both splits, remembers their sizes, and expands and restores the original source', async () => {
    localStorage.removeItem('btw:panes:v1');
    const d = await validateDisassembly(atlas()), saved = store(), user = userEvent.setup();
    const view = mount(d, saved.bridge);
    const height = await screen.findByRole('separator', { name: 'Divisione tra passaggio e fonte' });
    height.focus(); await user.keyboard('{ArrowUp}');
    expect(height).toHaveAttribute('aria-valuenow', '50');
    const width = screen.getByRole('separator', { name: 'Divisione tra fonte e disegno' });
    width.focus(); await user.keyboard('{ArrowLeft}');
    expect(width).toHaveAttribute('aria-valuenow', '39');
    await user.click(screen.getByRole('button', { name: 'Allarga la fonte a tutta l’area' }));
    expect(document.querySelector('.guided-passage')).not.toBeVisible();
    expect(document.querySelector('.guided-context')).not.toBeVisible();
    expect(screen.queryByRole('separator')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ripristina disegno e fonte' }));
    expect(document.querySelector('.guided-passage')).toBeVisible();
    await waitFor(() => expect(saved.state().reading?.view).toBe('guided'));
    view.unmount(); mount(d, saved.bridge);
    expect(await screen.findByRole('separator', { name: 'Divisione tra passaggio e fonte' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('separator', { name: 'Divisione tra fonte e disegno' })).toHaveAttribute('aria-valuenow', '39');
    localStorage.removeItem('btw:panes:v1');
  });
  it('opens a new source in reading order; jumps and back/forward keep the highlighted original source', async () => {
    const d = await validateDisassembly(atlas()), saved = store(), user = userEvent.setup();
    mount(d, saved.bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contenuti' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2);
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('article', { name: 'Passaggio 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continua' }));
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
    const proof = document.querySelector('.guided-proof')!;
    expect(proof.querySelectorAll('.source-text .focus').length).toBeGreaterThan(0);
    await user.click(buttons.at(-1)!);
    expect(screen.getByRole('button', { name: 'Guarda l’insieme' })).toBeInTheDocument();
    expect(within(nav).getAllByRole('button')).toHaveLength(buttons.length);
    await user.click(screen.getByRole('button', { name: 'Indietro' }));
    expect(buttons.at(-2)).toHaveAttribute('aria-current', 'step');
    await waitFor(() => expect(saved.state().reading?.view).toBe('guided'));
  });
  it('preserves reading location across overview, Run, bill of materials and a remount', async () => {
    const d = await validateDisassembly(atlas()), saved = store(), user = userEvent.setup();
    const view = mount(d, saved.bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contenuti' });
    await user.click(within(nav).getAllByRole('button')[2]);
    const location = document.querySelector('[aria-current="step"]')!.textContent;
    await user.click(within(screen.getByRole('group', { name: 'Come esplorare la fonte' })).getByRole('button', { name: 'Insieme' }));
    expect(document.querySelector('.d-drawing .sheet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lettura' }));
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(location!);
    await user.click(screen.getByRole('button', { name: 'Fai girare' }));
    expect(document.querySelector('.run-panel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Distinta base' }));
    expect(document.querySelector('.bom-table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Esploso' }));
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(location!);
    await waitFor(() => expect(saved.state().reading?.view).toBe('guided'));
    view.unmount();
    mount(d, saved.bridge);
    await screen.findByRole('navigation', { name: 'Contenuti' });
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(location!);
  });
  it('keeps the document reader and outline, highlights the same passage, and returns keyboard focus', async () => {
    const d = await validateDisassembly(atlas()), user = userEvent.setup();
    mount(d, store().bridge);
    await screen.findByRole('navigation', { name: 'Contenuti' });
    const open = screen.getByRole('button', { name: 'Leggi a tutta finestra' });
    await user.click(open);
    const reader = screen.getByRole('dialog');
    expect(within(reader).getByRole('navigation', { name: 'Indice' })).toBeInTheDocument();
    await waitFor(() => expect(reader.querySelector('.source-document .focus')).not.toBeNull());
    within(reader).getByRole('button', { name: 'Chiudi la lettura' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(open).toHaveFocus();
  });
  it('restores legacy progress to the overview without discarding notes, and localizes the guide', async () => {
    const d = await validateDisassembly(atlas()), initial = initialDisassemblyState(d);
    initial.selected = d.parts[0].id;
    initial.notes[d.parts[0].id] = 'Preserve this note';
    const saved = store(initial, 'en-GB'), user = userEvent.setup();
    mount(d, saved.bridge);
    await screen.findByRole('button', { name: 'Reading' });
    expect(screen.queryByRole('navigation', { name: 'Contents' })).toBeNull();
    expect(screen.getByDisplayValue('Preserve this note')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reading' }));
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(document.querySelector('.guided-passage')).toHaveAttribute('lang', 'en');
  });
  it('keeps material outside the question readable, labelled, and reachable across sources', async () => {
    const input = atlas(), text = '# Appendix\n\nThis material is outside the chosen question.';
    input.sources.push({ id: 'appendix', revision: 'v1', title: 'appendix.md', text, sha256: await hashText(text), origin: 'user-pasted', language: 'en' });
    input.bom.excluded.push({ source: 'appendix', from: 1, to: 3, reason: 'outside-question' });
    const d = await validateDisassembly(input), user = userEvent.setup();
    mount(d, store().bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contenuti' });
    await user.click(within(nav).getAllByRole('button').at(-1)!);
    expect(within(screen.getByRole('article')).getByText('This material is outside the chosen question.')).toBeInTheDocument();
    expect(screen.getByText('Questo passaggio non è collegato a un pezzo nello smontaggio. La fonte resta leggibile.')).toBeInTheDocument();
    await user.click(screen.getByText('Fuori dallo smontaggio'));
    expect(document.querySelector('.guided-exclusions')).toHaveTextContent('fuori dalla domanda');
    expect(document.querySelectorAll('.guided-detail-drawing .plate')).toHaveLength(0);
    expect(document.querySelectorAll('.guided-proof .source-text .focus')).toHaveLength(3);
  });
});
