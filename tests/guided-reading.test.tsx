import { readFileSync } from 'node:fs';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, type DisassemblyState } from '../src/core/disassembly-state';
import { hashText } from '../src/core/lesson';
import { DisassemblyPlayer } from '../src/renderer/disassembly/DisassemblyPlayer';
import { PreferencesProvider } from '../src/renderer/preferences';
import { atlas, fixture } from './disassemblies';
import { deepDisassembly } from './disassembly-drafts';
import { readingRoles, readingSteps, sourceReadingRoute } from '../src/core/source-reading';
import { chooseRepresentation } from '../src/core/representation';
import { faceOf } from '../src/core/faces';
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
    expect(document.querySelectorAll('.guided-detail-drawing .lab-part')).toHaveLength(d.parts.length);
    expect(document.querySelectorAll('.guided-detail-drawing :is([data-unread], .read-added, .read-deepened)')).toHaveLength(0);
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
    expect(drawing().querySelectorAll('[data-unread]')).toHaveLength(7);
    expect(drawing().querySelectorAll('.lab-part[role="button"], .lab-cable')).toHaveLength(0);

    await open(user, /One round, step by step/);
    expect(drawing().querySelector('.lab-part.read-added[data-id="round"]')).not.toBeNull();
    expect(drawing().querySelectorAll('[data-unread]')).toHaveLength(6);
    expect(drawing().querySelectorAll('.lab-cable')).toHaveLength(2);
    expect(drawing().querySelectorAll('.lab-cable.reading-current')).toHaveLength(2);
    const does = screen.getByRole('region', { name: 'What this step does' });
    expect(within(does).getByText('Adds a part')).toBeInTheDocument();
    expect(within(does).getByRole('heading', { name: 'The round' })).toBeInTheDocument();
    expect(within(does).getByText('Relates two parts')).toBeInTheDocument();
    expect(within(does).getAllByText(/you read it at step \d+/).length).toBeGreaterThan(0);

    // The passages that only return to parts join the step before (G13): "9. The night board" adds the board and,
    // through "11. One night" and "12. Things this design does not catch", returns to the restart rule.
    await open(user, /9\. The night board/);
    expect(drawing().querySelector('.lab-part.read-added[data-id="board"]')).not.toBeNull();
    expect(drawing().querySelector('.lab-part.read-deepened[data-id="restart"]')).not.toBeNull();
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
    expect(drawing().querySelectorAll('.lab-part')).toHaveLength(5);
    expect(drawing().querySelectorAll('.lab-part.read-cited')).toHaveLength(5);
    expect(screen.getByText('This step cites 5 of its 5 parts.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(drawing().querySelectorAll('.lab-part, [data-unread]')).toHaveLength(7);
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
    const plates = drawing().querySelectorAll('.lab-part, [data-unread], .lab-cable').length;
    await user.click(screen.getByRole('button', { name: 'Margin: 1 note for this step' }));
    expect(document.querySelector('.guided-margin')).toHaveTextContent('context');
    expect(document.querySelector('.guided-margin')).toHaveTextContent(d.bom.excluded[0].note!);
    expect(drawing().querySelectorAll('.lab-part, [data-unread], .lab-cable')).toHaveLength(plates);
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

// P-20261103-lab-mode L8: the guided view draws the representation the metaphor test chose, built along the reading.
describe('the chosen representation in the guided view', () => {
  const examples = [['src/fixtures/disassemblies/atlas-release-en.json', 'lab-bench'], ['src/fixtures/disassemblies/mill-harm-en.json', 'lab-atlas'], ['src/fixtures/disassemblies/importer-signals-en.json', 'lab-bench']];
  it.each(examples)('draws %s as its representation, with outlines, marks and joints from the reading', async (path, drawn) => {
    const d = await validateDisassembly(fixture(path)), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    const passages = sourceReadingRoute(d.sources, Object.fromEntries(d.sources.map(s => [s.id, readingBlocks(s.text, isProse(s))])));
    const route = readingSteps(passages, readingRoles(d, passages)), roles = route.map(s => s.role);
    const known = new Set(d.joints.map(j => `${j.from}>${j.to}`));
    for (const i of [0, Math.floor(route.length / 2), route.length - 1]) {
      await user.click(within(nav).getAllByRole('button')[i]);
      const sheet = document.querySelector('.guided-detail-drawing .guided-level.focus .lab-sheet')!;
      expect(sheet).toHaveClass(drawn);
      const joints = [...sheet.querySelectorAll(':is(.lab-cable, .lab-arrow)[data-joint]')].map(g => (g as HTMLElement).dataset.joint!);
      expect(joints.every(j => known.has(j))).toBe(true);
      expect(new Set(joints)).toEqual(new Set(roles.slice(0, i + 1).flatMap(r => r.relate.map(j => `${j.from}>${j.to}`))));
      const added = new Set(roles.slice(0, i + 1).flatMap(r => r.add));
      expect([...sheet.querySelectorAll('[data-unread]')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual(d.parts.map(p => p.id).filter(id => !added.has(id)).sort());
      expect([...sheet.querySelectorAll('.read-added')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual([...roles[i].add].sort());
      expect([...sheet.querySelectorAll('.read-deepened')].map(p => (p as HTMLElement).dataset.id).sort()).toEqual([...roles[i].deepen].sort());
    }
  });

  it('retires the object/plates switch and ignores its stored value', async () => {
    localStorage.setItem('btw:guided-drawing:v1', 'plates');
    const d = await validateDisassembly(fixture('src/fixtures/disassemblies/importer-signals-en.json'));
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    expect(document.querySelector('.guided-detail-drawing .lab-bench')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Plates' })).toBeNull();
    expect(document.querySelector('.guided-detail-drawing .sheet, .guided-detail-drawing .object-sheet')).toBeNull();
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
    expect(level().querySelectorAll('.lab-part')).toHaveLength(5);
    await user.click(within(bar).getByRole('button', { name: 'Back to the whole' }));
    expect(level().querySelectorAll('.lab-part, [data-unread]')).toHaveLength(7);
    // ↓ opens what the control would open.
    (document.querySelector('.guided-stage') as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');
    expect(level().querySelectorAll('.lab-part')).toHaveLength(5);
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
    expect(map().querySelectorAll('[data-unread]')).toHaveLength(7);
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    expect(map()).toHaveAccessibleName('You are here: Night importer › The round. Back to the whole');
    expect(map().querySelector('.lab-part.read-here[data-id="round"]')).not.toBeNull();
    const here = within(screen.getByRole('navigation', { name: 'Contents' })).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    await user.click(map());
    expect(level().querySelectorAll('.lab-part, [data-unread]')).toHaveLength(7);
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

  it('lifts the part out of the whole: the whole sinks to a strip with its place outlined, and returns (L9)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    expect(document.querySelector('.guided-detail-drawing')).toHaveClass('opening');
    const [lifted, strip] = [...document.querySelectorAll('.guided-detail-drawing .guided-level')];
    expect(lifted).toHaveClass('focus');
    expect(lifted.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip).toHaveClass('upper', 'lab-strip');
    expect(strip.querySelector('.lab-bench .lab-socket[data-id="round"]')).not.toBeNull();
    expect(document.querySelector('.lab-stage .lab-beam')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(document.querySelector('.guided-detail-drawing')).toHaveClass('returning');
    expect(document.querySelector('.guided-level.upper')).toBeNull();
  });

  it('lifts a region out of the atlas too, its place outlined in the strip (L9)', async () => {
    const d = await validateDisassembly(fixture('src/fixtures/disassemblies/mill-harm-en.json')), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav).getAllByRole('button').at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Open The region of liberty' }));
    const strip = document.querySelector('.guided-level.upper.lab-strip')!;
    expect(strip.querySelector('.lab-atlas [data-id="region"] .lab-socket')).not.toBeNull();
    expect(level().querySelectorAll('.lab-part')).toHaveLength(3);
  });

  it('returns to the step, the selection and the source position it was opened from (L9)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    const nav = await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    const here = within(nav).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
    const focused = () => [...document.querySelectorAll<HTMLElement>('.guided-proof .source-text .focus')].map(l => Number(l.dataset.line));
    const before = focused();
    await user.click(within(level() as HTMLElement).getByRole('button', { name: /^The round ·/ }));
    await user.click(within(screen.getByRole('complementary', { name: 'What this step does' })).getAllByRole('button', { name: 'Open its 5 parts' })[0]);
    // inside, the source moves to another note of the margin
    await user.keyboard('z');
    await user.click(document.querySelector<HTMLElement>('.guided-margin .cite')!);
    expect(focused()).not.toEqual(before);
    await user.keyboard('{Escape}');
    expect(focused()).toEqual(before);
    expect(within(nav).getAllByRole('button')[here]).toHaveAttribute('aria-current', 'step');
    expect(level().querySelector('.lab-part.sel[data-id="round"]')).not.toBeNull();
  });

  it('plays the lift, and nothing moves under "reduce motion" (L9)', async () => {
    const animate = vi.fn(), media = window.matchMedia, original = Element.prototype.animate;
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    try {
      for (const reduce of [false, true]) {
        animate.mockClear();
        window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
        const d = await importer(), user = userEvent.setup(), view = mount(d, store(null, 'en-GB').bridge);
        await screen.findByRole('navigation', { name: 'Contents' });
        await toStep(user, /One round, step by step/);
        await user.click(screen.getByRole('button', { name: 'Open The round' }));
        await user.keyboard('{Escape}');
        expect(animate).toHaveBeenCalledTimes(reduce ? 0 : 2);
        view.unmount();
      }
    } finally { Element.prototype.animate = original; window.matchMedia = media; }
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

  it('keeps the strip pressable: away from its parts it gives the whole the focus back (L9)', async () => {
    const d = await importer(), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /One round, step by step/);
    await user.click(screen.getByRole('button', { name: 'Open The round' }));
    const [round, whole] = levels();
    expect(whole).toHaveClass('upper');
    expect(whole).toHaveAttribute('data-depth', '0');
    expect(whole.querySelectorAll('.lab-part, [data-unread], .lab-socket')).toHaveLength(7);
    expect(round).toHaveClass('focus');
    expect(round.querySelectorAll('.lab-part')).toHaveLength(5);
    await user.click(whole);
    expect(levels()).toHaveLength(1);
    expect(levels()[0]).toHaveClass('focus');
  });

  it('opens at any depth: the strip shows the level the part belongs to, and the path leads back up', async () => {
    const d = await validateDisassembly(await deepDisassembly(5)), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(screen.getByRole('button', { name: 'Open Piece p1' }));
    for (const id of ['p1-1', 'p1-1-1']) {
      await user.click(within(levels()[0] as HTMLElement).getByRole('button', { name: new RegExp(`^Piece ${id} ·`) }));
      await user.click(screen.getByRole('button', { name: `Open Piece ${id}` }));
    }
    expect(levels().map(l => (l as HTMLElement).dataset.depth)).toEqual(['3', '2']);
    expect(levels()[0].querySelectorAll('.lab-part')).toHaveLength(3);
    expect(levels()[1].querySelector('.lab-socket[data-id="p1-1-1"]')).not.toBeNull();
    expect(document.querySelector('.guided-path')).toHaveTextContent('The mechanism › Piece p1 › Piece p1-1 › Piece p1-1-1');
    // A part of the strip without a sub-assembly: what was open closes, and its level takes the focus with the part selected.
    await user.click(within(levels()[1] as HTMLElement).getByRole('button', { name: /^Piece p1-1-2 ·/ }));
    expect(levels().map(l => (l as HTMLElement).dataset.depth)).toEqual(['2', '1']);
    expect(levels()[0].querySelector('[data-id="p1-1-2"]')).toHaveClass('sel');
    // The path goes up: to the first level, with the part it came from selected, then to the whole.
    await user.click(within(document.querySelector('.guided-path') as HTMLElement).getByRole('button', { name: 'Piece p1' }));
    expect(levels().map(l => (l as HTMLElement).dataset.depth)).toEqual(['1', '0']);
    expect(levels()[0].querySelector('[data-id="p1-1"]')).toHaveClass('sel');
    await user.click(within(document.querySelector('.guided-path') as HTMLElement).getByRole('button', { name: 'The mechanism' }));
    expect(levels()).toHaveLength(1);
  });
});

// P-20261103-lab-mode L10–L12: what is explored ≠ the step being read; why this representation; the atlas's run.
describe('the lab in the guided view', () => {
  const load = (path: string) => validateDisassembly(fixture(path));
  const level = () => document.querySelector('.guided-detail-drawing .guided-level.focus') as HTMLElement;
  const nav = () => screen.getByRole('navigation', { name: 'Contents' });
  const current = () => within(nav()).getAllByRole('button').findIndex(b => b.getAttribute('aria-current') === 'step');
  const focused = () => [...document.querySelectorAll<HTMLElement>('.guided-proof .source-text .focus')].map(l => Number(l.dataset.line));
  const toStep = async (user: ReturnType<typeof userEvent.setup>, title: RegExp) => user.click(within(nav()).getAllByRole('button', { name: title })[0]);

  it('says what is explored outside the step, goes back to the step, or reads from the explored part (L10)', async () => {
    const d = await load('src/fixtures/disassemblies/importer-signals-en.json'), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await toStep(user, /9\. The night board/);
    const here = current(), step = focused(), round = d.parts.find(p => p.id === 'round')!;
    expect(document.querySelector('.lab-explore')).toBeNull();
    // the round was read earlier: selecting it here explores it, and the source shows its lines
    await user.click(within(level()).getByRole('button', { name: /^The round ·/ }));
    const bar = document.querySelector('.lab-explore')!;
    expect(bar).toHaveTextContent(`Exploring “The round” · ll. ${round.cites[0].from}–${round.cites[0].to} · you are reading step ${here + 1}`);
    expect(focused()[0]).toBe(round.cites[0].from);
    const citing = within(nav()).getAllByRole('button').flatMap((b, i) => b.dataset.explored ? [i] : []);
    expect(citing.length).toBeGreaterThan(0);
    expect(citing).not.toContain(here);
    // back to the step: the exploration closes and the source returns to the step's lines
    await user.click(within(bar as HTMLElement).getByRole('button', { name: `Back to step ${here + 1}` }));
    expect(document.querySelector('.lab-explore')).toBeNull();
    expect(focused()).toEqual(step);
    expect(current()).toBe(here);
    // read from here: the reading moves to the first step citing it, and the part stays selected
    await user.click(within(level()).getByRole('button', { name: /^The round ·/ }));
    await user.click(screen.getByRole('button', { name: `Read from here (step ${citing[0] + 1})` }));
    expect(current()).toBe(citing[0]);
    expect(document.querySelector('.lab-explore')).toBeNull();
    expect(level().querySelector('.lab-part.sel[data-id="round"]')).not.toBeNull();
  });

  it('counts a part opened outside the step as explored, and going back to the step closes it (L10)', async () => {
    const d = await load('src/fixtures/disassemblies/importer-signals-en.json'), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav()).getAllByRole('button').at(-1)!);
    const here = current(), step = focused();
    await user.click(within(level()).getByRole('button', { name: /^The round ·/ }));
    await user.click(within(screen.getByRole('complementary', { name: 'What this step does' })).getAllByRole('button', { name: 'Open its 5 parts' })[0]);
    expect(document.querySelector('.lab-explore')).toHaveTextContent('Exploring “The round”');
    await user.click(screen.getByRole('button', { name: `Back to step ${here + 1}` }));
    expect(document.querySelector('.guided-level.upper')).toBeNull();
    expect(document.querySelector('.lab-explore')).toBeNull();
    expect(focused()).toEqual(step);
  });

  it('explores a joint and a face element too, each with its own lines (L10)', async () => {
    const d = await load('src/fixtures/disassemblies/importer-signals-en.json'), user = userEvent.setup();
    const view = mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav()).getAllByRole('button').at(-1)!);
    const pill = level().querySelector<SVGGElement>('.lab-pill')!;
    await user.click(pill);
    expect(document.querySelector('.lab-joint-card')).toHaveTextContent(d.joints.find(j => `${j.from}>${j.to}` === pill.dataset.joint)!.label);
    view.unmount();
    // the release chain: a part whose sub-parts have faces, opened from the last step, where every part is read
    const r = await load('src/fixtures/disassemblies/atlas-release-en.json');
    const part = r.parts.find(p => p.parts?.some(q => faceOf(r, q)))!;
    mount(r, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav()).getAllByRole('button').at(-1)!);
    await user.click(within(level()).getByRole('button', { name: new RegExp(`^${part.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ·`) }));
    await user.click(within(screen.getByRole('complementary', { name: 'What this step does' })).getAllByRole('button', { name: `Open its ${part.parts!.length} parts` })[0]);
    const element = level().querySelector<SVGElement>('[data-face]')!;
    await user.click(element);
    const card = document.querySelector('.lab-face-card')!;
    expect(card).toHaveTextContent(element.getAttribute('aria-label')!);
    expect(within(card as HTMLElement).getAllByRole('button').length).toBeGreaterThan(0);
    expect(element).toHaveAttribute('aria-pressed', 'true');
  });

  it('says why the importer is a bench, with every correspondence and where each analogy ends (L11)', async () => {
    const d = await load('src/fixtures/disassemblies/importer-signals-en.json'), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    const why = document.querySelector('.lab-why')!;
    expect(why).toHaveTextContent('The bench holds: every part has a component');
    expect(why.querySelectorAll('tr[data-row="part"]')).toHaveLength(7);
    expect(why.querySelectorAll('tr[data-row="joint"]')).toHaveLength(8);
    expect(why.querySelector('.lab-failures')).toBeNull();
    // the annotations hold the parts' clarifications and the context lines of the margin
    const notes = document.querySelector('.lab-annotations')!;
    expect(notes).toHaveTextContent('clarification');
    expect(notes).toHaveTextContent(d.bom.excluded.find(e => e.reason === 'context')!.note!);
    // a part's card says what it is in the object, and where that stops being true
    await toStep(user, /One round, step by step/);
    await user.click(within(level()).getByRole('button', { name: /^The round ·/ }));
    const inObject = document.querySelector('.lab-in')!;
    expect(inObject).toHaveTextContent('In the object');
    expect(inObject).toHaveTextContent('Round track with stations: repeats a round, one station per step.');
    expect(inObject).toHaveTextContent('⚠ A round track never stops');
  });

  it('says why Mill is an atlas, speaking of the metaphors available, with its failures (L11)', async () => {
    for (const [path, locale, verdict] of [['src/fixtures/disassemblies/mill-harm-en.json', 'en-GB', 'Among the available metaphors, none represents this source without forcing.'],
      ['src/fixtures/disassemblies/mill-harm.json', 'it-IT', 'Tra le metafore disponibili, nessuna rappresenta questa fonte senza forzature.']]) {
      const d = await load(path), view = mount(d, store(null, locale).bridge);
      await screen.findByRole('navigation');
      const why = document.querySelector('.lab-why')!;
      expect(why).toHaveTextContent(verdict);
      expect(why.textContent).not.toMatch(/no object holds|nessun oggetto regge/i);
      expect(why.querySelectorAll('.lab-failures li')).toHaveLength(chooseRepresentation(d).failures);
      view.unmount();
    }
  });

  it('suspends a support in Mill’s atlas: the region is outlined and the claim loses a support (L12)', async () => {
    const d = await load('src/fixtures/disassemblies/mill-harm-en.json'), user = userEvent.setup();
    mount(d, store(null, 'en-GB').bridge);
    await screen.findByRole('navigation', { name: 'Contents' });
    await user.click(within(nav()).getAllByRole('button').at(-1)!);
    const run = document.querySelector('.lab-run') as HTMLElement;
    await user.click(within(run).getByRole('button', { name: 'Suspend “Utility, in the widest sense”' }));
    expect(level().querySelector('.lab-region.suspended[data-id="utility"]')).not.toBeNull();
    expect(level().querySelector('.lab-tag')).toHaveTextContent('Loses a support');
    expect(run.textContent).not.toMatch(/FALLS|HOLDS|WEAKENS|It falls|It holds|Load-bearing/);
  });
});
