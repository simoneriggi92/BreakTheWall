import { readFileSync } from 'node:fs';
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
import { deepDisassembly } from './disassembly-drafts';
import { readingRoles, readingSteps, sourceReadingRoute } from '../src/core/source-reading';
import { isProse, readingBlocks } from '../src/renderer/markdown';

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
    const height = await screen.findByRole('separator', { name: 'Divisione tra disegno e fonte' });
    height.focus(); await user.keyboard('{ArrowUp}');
    expect(height).toHaveAttribute('aria-valuenow', '65');
    const width = screen.getByRole('separator', { name: 'Divisione tra disegno e pannello' });
    width.focus(); await user.keyboard('{ArrowLeft}');
    expect(width).toHaveAttribute('aria-valuenow', '30');
    await user.click(screen.getByRole('button', { name: 'Allarga la fonte a tutta l’area' }));
    expect(document.querySelector('.guided-stage')).not.toBeVisible();
    expect(document.querySelector('.guided-context')).not.toBeVisible();
    expect(screen.queryByRole('separator')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ripristina disegno e fonte' }));
    expect(document.querySelector('.guided-stage')).toBeVisible();
    await waitFor(() => expect(saved.state().reading?.view).toBe('guided'));
    view.unmount(); mount(d, saved.bridge);
    expect(await screen.findByRole('separator', { name: 'Divisione tra disegno e fonte' })).toHaveAttribute('aria-valuenow', '65');
    expect(screen.getByRole('separator', { name: 'Divisione tra disegno e pannello' })).toHaveAttribute('aria-valuenow', '30');
    localStorage.removeItem('btw:panes:v1');
  });
  it('opens a new source in reading order; jumps and back/forward keep the highlighted original source', async () => {
    const d = await validateDisassembly(atlas()), saved = store(), user = userEvent.setup();
    mount(d, saved.bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contenuti' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2);
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/^Passo 1 di \d+/)).toBeVisible();
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
    expect(document.querySelector('.guided-title')).toHaveAttribute('lang', 'en');
  });
  it('keeps material outside the question readable, labelled, and reachable across sources', async () => {
    const input = atlas(), text = '# Appendix\n\nThis material is outside the chosen question.';
    input.sources.push({ id: 'appendix', revision: 'v1', title: 'appendix.md', text, sha256: await hashText(text), origin: 'user-pasted', language: 'en' });
    input.bom.excluded.push({ source: 'appendix', from: 1, to: 3, reason: 'outside-question' });
    const d = await validateDisassembly(input), user = userEvent.setup();
    mount(d, store().bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contenuti' });
    await user.click(within(nav).getAllByRole('button').at(-1)!);
    expect(document.querySelector('.guided-proof')).toHaveTextContent('This material is outside the chosen question.');
    expect(screen.getByText('Questo passaggio non è collegato a un pezzo nello smontaggio. La fonte resta leggibile.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Margine: \d+ (nota|note) per questo passo$/ }));
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
  const drawing = () => document.querySelector('.guided-detail-drawing .guided-level.focus')!;
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
    const does = screen.getByRole('region', { name: 'What this step does' });
    expect(within(does).getByText('Adds a part')).toBeInTheDocument();
    expect(within(does).getByRole('heading', { name: 'The round' })).toBeInTheDocument();
    expect(within(does).getByText('Relates two parts')).toBeInTheDocument();
    expect(within(does).getAllByText(/you read it at step \d+/).length).toBeGreaterThan(0);

    // The passages that only return to parts join the step before (G13): "9. The night board" adds the board and,
    // through "11. One night" and "12. Things this design does not catch", returns to the restart rule.
    await open(user, /9\. The night board/);
    expect(drawing().querySelector('.plate.read-added[data-id="board"]')).not.toBeNull();
    expect(drawing().querySelector('.plate.read-deepened[data-id="restart"]')).not.toBeNull();
    expect(within(screen.getByRole('region', { name: 'What this step does' })).getAllByText('Returns to a part')).toHaveLength(3);

    // ← and → move between passages from the passage; the run and the overview are untouched.
    const current = () => within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    const before = current();
    (document.querySelector('.guided-stage') as HTMLElement).focus();
    await user.keyboard('{ArrowLeft}');
    expect(current()).toBe(before - 1);
    await user.keyboard('{ArrowRight}');
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
    expect(screen.getByText('This step cites 5 of its 5 parts.')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Margin: 1 note for this step' }));
    expect(document.querySelector('.guided-margin')).toHaveTextContent('context');
    expect(document.querySelector('.guided-margin')).toHaveTextContent(d.bom.excluded[0].note!);
    expect(drawing().querySelectorAll('.plate, .joint')).toHaveLength(plates);
    await user.keyboard('z');
    expect(document.querySelector('.guided-margin')).toBeNull();
    await user.keyboard('z');
    await open(user, /What the importer does/);
    expect(document.querySelector('.guided-margin')).toHaveTextContent('Nothing in the margin for this step.');
    // The glossary only goes to the margin, so it joins the last step (G13).
    const nav = screen.getByRole('navigation', { name: 'Contents' });
    await user.click(within(nav).getAllByRole('button').at(-1)!);
    expect(document.querySelector('.guided-margin')).toHaveTextContent('repetition');
  });
});

// P-20261102-guided-reading G9: the prototype's structure, with the passage shown once.
describe('the guided view takes the prototype\'s structure', () => {
  it('draws at the centre, says what the passage does beside it, and shows the passage once, in the source band', async () => {
    const d = await validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json')), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav).getAllByRole('button', { name: /One round, step by step/ })[0]);
    // Route | drawing | panel above, the source below; no rendered copy of the passage.
    const regions = ['.guided-navigation', '.guided-stage', '.guided-context', '.guided-proof'].map(s => document.querySelector(s));
    expect(regions.every(Boolean)).toBe(true);
    expect(document.querySelector('.guided-passage, article')).toBeNull();
    const once = 'before it does anything that could fail or wait';
    expect(document.body.textContent!.split(once)).toHaveLength(2);
    expect(document.querySelector('.guided-proof')).toHaveTextContent(once);
    expect(within(screen.getByRole('complementary', { name: 'What this step does' })).getByRole('heading', { name: /One round, step by step/ })).toBeInTheDocument();
    // The route marks what each passage does, from readingRoles.
    const current = within(nav).getAllByRole('button').find(b => b.getAttribute('aria-current') === 'step')!;
    expect([...current.querySelectorAll('.does-mark')].map(m => m.className)).toEqual(['does-mark d-add', 'does-mark d-relate', 'does-mark d-margin']);
    expect(current).toHaveAccessibleName(/Adds a part, Relates two parts, Margin$/);
  });
});

// P-20261102-guided-reading G10: the object follows the same reading, draws only joints between parts, and can step back to plates.
describe('the object in the guided view', () => {
  const examples = ['src/fixtures/disassemblies/atlas-release-en.json', 'src/fixtures/disassemblies/mill-harm-en.json', 'src/fixtures/disassemblies/importer-signals-en.json'];
  it.each(examples)('draws every line between parts as a joint of the level, with outlines and marks from the reading (%s)', async path => {
    localStorage.removeItem('btw:guided-drawing:v1');
    const d = await validateDisassembly(fixture(path)), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    const passages = sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text, isProse(s))])));
    const route = readingSteps(passages, readingRoles(d, passages)), roles = route.map(s => s.role);
    const known = new Set(d.joints.map(j => `${j.from}>${j.to}`));
    for (const i of [0, Math.floor(route.length / 2), route.length - 1]) {
      await user.click(within(nav).getAllByRole('button')[i]);
      const sheet = document.querySelector('.guided-detail-drawing .object-sheet')!;
      expect(sheet).not.toBeNull();
      const drawn = [...sheet.querySelectorAll('[data-joint]')].map(g => (g as HTMLElement).dataset.joint!);
      expect(drawn.every(j => known.has(j))).toBe(true);
      const related = new Set(roles.slice(0, i + 1).flatMap(r => r.relate.map(j => `${j.from}>${j.to}`)));
      expect(new Set(drawn)).toEqual(related);
      const added = new Set(roles.slice(0, i + 1).flatMap(r => r.add));
      expect([...sheet.querySelectorAll('.plate.unread')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual(d.parts.map(p => p.id).filter(id => !added.has(id)).sort());
      expect([...sheet.querySelectorAll('.plate.read-added')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual([...roles[i].add].sort());
      expect([...sheet.querySelectorAll('.plate.read-deepened')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual([...roles[i].deepen].sort());
    }
  });

  it('switches to today\'s plates and remembers it', async () => {
    localStorage.removeItem('btw:guided-drawing:v1');
    const d = await validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json')), saved = store(null, 'en-GB'), user = userEvent.setup();
    const view = mount(d, saved.bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    expect(document.querySelector('.guided-detail-drawing .object-sheet')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Plates' }));
    expect(document.querySelector('.guided-detail-drawing .object-sheet')).toBeNull();
    expect(document.querySelector('.guided-detail-drawing .sheet')).not.toBeNull();
    view.unmount(); mount(d, saved.bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    expect(screen.getByRole('button', { name: 'Plates' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Object' }));
    expect(document.querySelector('.guided-detail-drawing .object-sheet')).not.toBeNull();
    localStorage.removeItem('btw:guided-drawing:v1');
  });
});

// P-20261102-guided-reading G11–G14: where you are, the axes as controls, and motion that stops when asked.
describe('orientation in the guided view', () => {
  const importer = () => validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json'));
  const level = () => document.querySelector('.guided-detail-drawing .guided-level.focus')!;
  const toStep = async (user: ReturnType<typeof userEvent.setup>, title: RegExp) =>
    user.click(within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button', { name: title })[0]);

  it('offers x, y and z as controls, each disabled where it does not apply (G12)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    const bar = screen.getByRole('toolbar', { name: 'Reading controls' });
    expect(within(bar).getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Open a part' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Back to the whole' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Margin: 1 note for this step' })).toHaveAttribute('title', 'Key: Z');
    await toStep(user, /One round, step by step/);
    await user.click(within(bar).getByRole('button', { name: 'Open The round' }));
    expect(level().querySelectorAll('.plate')).toHaveLength(5);
    await user.click(within(bar).getByRole('button', { name: 'Back to the whole' }));
    expect(level().querySelectorAll('.plate')).toHaveLength(7);
    // ↓ opens what the control would open.
    (document.querySelector('.guided-stage') as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');
    expect(level().querySelectorAll('.plate')).toHaveLength(5);
    await user.keyboard('{Escape}');
    await toStep(user, /4\. The heartbeat stamp/);
    expect(within(bar).getByRole('button', { name: 'Open a part' })).toBeDisabled();
  });

  it('shows the whole in a minimap that says "you are here" inside a part, returns from it, and can be hidden (G11)', async () => {
    localStorage.removeItem('btw:guided-minimap:v1');
    const d = await importer(), saved = store(null, 'en-GB'), user = userEvent.setup();
    const view = mount(d, saved.bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    const map = () => document.querySelector('.guided-minimap') as HTMLButtonElement;
    // The minimap is in the deck, never over the drawing.
    expect(map().closest('.guided-detail-drawing')).toBeNull();
    expect(map()).toBeDisabled();
    expect(map().querySelectorAll('.plate.unread')).toHaveLength(7);
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    expect(map()).toHaveAccessibleName('You are here: Night importer › The round. Back to the whole');
    expect(map().querySelector('.plate.here[data-id="round"]')).not.toBeNull();
    const here = within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    await user.click(map());
    expect(level().querySelectorAll('.plate')).toHaveLength(7);
    expect(within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button')[here]).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByRole('button', { name: 'Hide map' }));
    expect(map()).toBeNull();
    view.unmount(); mount(d, saved.bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    expect(map()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show map' }));
    expect(map()).not.toBeNull();
    localStorage.removeItem('btw:guided-minimap:v1');
  });

  it('marks the opening and the return as movements, the new level descending below the whole (G14, G17)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    expect(document.querySelector('.guided-detail-drawing')).toHaveClass('opening');
    expect(document.querySelector('.guided-level.focus')).toHaveClass('entering');
    expect(document.querySelector('.guided-level.upper [data-id="round"]')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(document.querySelector('.guided-detail-drawing')).toHaveClass('returning');
    expect(document.querySelector('.guided-level.upper')).toBeNull();
  });

  it('defines every animation it uses and stops all of them under "reduce motion" (G14)', () => {
    const css = readFileSync('src/renderer/guided-reading.css', 'utf8');
    const used = new Set([...css.matchAll(/animation:\s*([a-z-]+)/g)].map(m => m[1]).filter(n => n !== 'none'));
    const defined = new Set([...css.matchAll(/@keyframes\s+([a-z-]+)/g)].map(m => m[1]));
    expect([...used].filter(n => !defined.has(n))).toEqual([]);
    const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toMatch(/\.guided-reading \*[^{]*\{ animation: none !important; transition: none !important; \}/);
  });
});

// P-20261102-guided-reading G15–G17: ↑ goes back, the route says what it is, and the levels stack down the sheet.
describe('levels stacked down the sheet', () => {
  const importer = () => validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json'));
  const levels = () => [...document.querySelectorAll('.guided-detail-drawing .guided-level')];
  const toStep = async (user: ReturnType<typeof userEvent.setup>, title: RegExp) =>
    user.click(within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button', { name: title })[0]);

  it('goes back up with ↑, as ↓ goes down (G15)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    const current = () => within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    const here = current();
    (document.querySelector('.guided-stage') as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');
    expect(levels()).toHaveLength(2);
    await user.keyboard('{ArrowUp}');
    expect(levels()).toHaveLength(1);
    expect(current()).toBe(here);
    await user.keyboard('{ArrowUp}');
    expect(levels()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Back to the whole' })).toHaveAttribute('title', 'Key: ↑ · Esc');
  });

  it('titles the route and explains its marks, and names steps that would repeat a heading by their first words (G16)', async () => {
    const d = await validateDisassembly(fixture('src/fixtures/disassemblies/mill-harm-en.json'));
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    expect(within(nav).getByRole('heading', { name: 'Reading steps' })).toBeInTheDocument();
    expect(within(within(nav).getByRole('list', { name: 'What the marks mean' })).getAllByRole('listitem').map(li => li.textContent))
      .toEqual(['Frames the whole', 'Adds a part', 'Returns to a part', 'Relates two parts', 'Margin']);
    const names = within(nav).getAllByRole('button').map(b => b.querySelector('span:not(.guided-number)')!.firstChild!.textContent);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
  });

  it('stacks the open path below the whole, with the upper levels pressable (G17)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    const [whole, round] = levels();
    expect(whole).toHaveClass('upper');
    expect(whole.querySelectorAll('.plate')).toHaveLength(7);
    expect(whole.querySelector('[data-id="round"] .object-here')).not.toBeNull();
    expect(round).toHaveClass('focus');
    expect(round.querySelectorAll('.plate')).toHaveLength(5);
    // Pressing the whole, away from its parts, gives it the focus back.
    await user.click(whole);
    expect(levels()).toHaveLength(1);
    expect(levels()[0]).toHaveClass('focus');
  });

  it('stacks any depth in order, and pressing an upper level closes what is below it', async () => {
    const d = await validateDisassembly(await deepDisassembly(5)), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(screen.getByRole('button', { name: 'Open Piece p1' }));
    for (const id of ['p1-1', 'p1-1-1']) {
      await user.click(within(levels().at(-1) as HTMLElement).getByRole('button', { name: new RegExp(`Piece ${id} ·`) }));
      await user.click(screen.getByRole('button', { name: `Open Piece ${id}` }));
    }
    expect(levels().map(l => (l as HTMLElement).dataset.depth)).toEqual(['0', '1', '2', '3']);
    expect(levels().map(l => l.classList.contains('focus'))).toEqual([false, false, false, true]);
    expect(levels()[3].querySelectorAll('.plate')).toHaveLength(3);
    // The second level's opened part: the two levels below it close, and it opens again in place.
    await user.click(within(levels()[1] as HTMLElement).getByRole('button', { name: /Piece p1-1 ·/ }));
    expect(levels()).toHaveLength(3);
    // One of its parts without a sub-assembly: what was below closes, and that level takes the focus with the part selected.
    await user.click(within(levels()[1] as HTMLElement).getByRole('button', { name: /Piece p1-2 ·/ }));
    expect(levels()).toHaveLength(2);
    expect(levels()[1]).toHaveClass('focus');
    expect(levels()[1].querySelector('[data-id="p1-2"]')).toHaveClass('selected');
  });
});
