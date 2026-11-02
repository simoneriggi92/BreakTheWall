import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, type DisassemblyState } from '../src/core/disassembly-state';
import { hashText } from '../src/core/lesson';
import { DisassemblyPlayer } from '../src/renderer/disassembly/DisassemblyPlayer';
import { PreferencesProvider } from '../src/renderer/preferences';
import { atlas, fixture } from './disassemblies';

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
    await user.click(screen.getByRole('button', { name: 'Margine: 1 nota per questo passaggio' }));
    expect(document.querySelector('.guided-margin')).toHaveTextContent('fuori dalla domanda');
    // By the last passage every part has been read, and none is marked: this passage takes no part apart.
    expect(document.querySelectorAll('.guided-detail-drawing .plate')).toHaveLength(d.parts.length);
    expect(document.querySelectorAll('.guided-detail-drawing .plate.unread, .guided-detail-drawing .reading-mark')).toHaveLength(0);
    expect(document.querySelectorAll('.guided-proof .source-text .focus')).toHaveLength(3);
  });
});

// P-20261102-guided-reading G3–G5, on the public importer: the drawing follows the text, depth opens in place, the margin stays apart.
describe('the drawing follows the reading', () => {
  const importer = () => validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json'));
  const drawing = () => document.querySelector('.guided-detail-drawing')!;
  const open = async (user: ReturnType<typeof userEvent.setup>, title: RegExp) => {
    const nav = screen.getByRole('navigation', { name: 'Contents' });
    await user.click(within(nav).getAllByRole('button', { name: title })[0]);
  };

  it('draws only what has been read, marks what this passage adds or returns to, and draws joints from their passage', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    expect(drawing().querySelectorAll('.plate.unread')).toHaveLength(7);
    expect(drawing().querySelectorAll('.plate[role="button"], .joint')).toHaveLength(0);

    await open(user, /One round, step by step/);
    expect(drawing().querySelector('.plate.read-added[data-id="round"]')).not.toBeNull();
    expect(drawing().querySelectorAll('.plate.unread')).toHaveLength(6);
    expect(drawing().querySelectorAll('.joint')).toHaveLength(2);
    expect(drawing().querySelectorAll('.reading-current .joint')).toHaveLength(2);
    const does = screen.getByRole('region', { name: 'What this passage does' });
    expect(within(does).getByText('Adds a part')).toBeInTheDocument();
    expect(within(does).getByRole('heading', { name: 'The round' })).toBeInTheDocument();
    expect(within(does).getByText('Relates two parts')).toBeInTheDocument();
    expect(within(does).getAllByText(/you read it at passage \d+/).length).toBeGreaterThan(0);

    await open(user, /Why "the job succeeded" is not enough/);
    expect(drawing().querySelector('.plate.read-deepened[data-id="outcomes"]')).not.toBeNull();
    expect(within(screen.getByRole('region', { name: 'What this passage does' })).getByText('Returns to a part')).toBeInTheDocument();

    // ← and → move between passages from the passage; the run and the overview are untouched.
    const current = () => within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    const before = current();
    screen.getByRole('article').focus();
    await user.keyboard('{ArrowRight}');
    expect(current()).toBe(before + 1);
    await user.keyboard('{ArrowLeft}');
    expect(current()).toBe(before);
  });

  it('opens a part where it is, marks the sub-parts the passage cites, and returns to the same passage', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await open(user, /One round, step by step/);
    const nav = screen.getByRole('navigation', { name: 'Contents' });
    const here = within(nav).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    await user.click(screen.getByRole('button', { name: 'Open its 5 parts' }));
    expect(drawing().querySelectorAll('.plate')).toHaveLength(5);
    expect(drawing().querySelectorAll('.plate.read-cited')).toHaveLength(5);
    expect(screen.getByText('This passage cites 5 of its 5 parts.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(drawing().querySelectorAll('.plate')).toHaveLength(7);
    expect(within(nav).getAllByRole('button')[here]).toHaveAttribute('aria-current', 'step');

    // A part with no sub-assembly says so; a prepared disassembly never offers a request.
    await open(user, /The heartbeat stamp/);
    await user.click(within(drawing() as HTMLElement).getByRole('button', { name: /Heartbeat stamp/ }));
    expect(screen.getByText('This part has no sub-assembly.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take this part apart' })).toBeNull();
  });

  it('keeps the margin beside the drawing, with reasons and notes, and never draws it', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    const plates = drawing().querySelectorAll('.plate, .joint').length;
    await user.click(screen.getByRole('button', { name: 'Margin: 1 note for this passage' }));
    expect(document.querySelector('.guided-margin')).toHaveTextContent('context');
    expect(document.querySelector('.guided-margin')).toHaveTextContent(d.bom.excluded[0].note!);
    expect(drawing().querySelectorAll('.plate, .joint')).toHaveLength(plates);
    await user.keyboard('z');
    expect(document.querySelector('.guided-margin')).toBeNull();
    await user.keyboard('z');
    await open(user, /What the importer does/);
    expect(document.querySelector('.guided-margin')).toHaveTextContent('Nothing in the margin for this passage.');
    await open(user, /Glossary/);
    expect(document.querySelector('.guided-margin')).toHaveTextContent('repetition');
  });
});
