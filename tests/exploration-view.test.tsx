import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { validateExploration, type Exploration, type ExplorationCite } from '../src/core/exploration';
import { shapeOf } from '../src/core/exploration-shape';
import { readingReport } from '../src/core/reading-report';
import { loadPreparedExplorations } from '../src/fixtures/explorations';
import { ExplorationView } from '../src/renderer/exploration/ExplorationView';
import { modelOf, standIn } from '../src/renderer/exploration/model';
import { PreferencesProvider } from '../src/renderer/preferences';
import { bakery } from './explorations';

const prepared = await loadPreparedExplorations();
const byId = (id: string) => structuredClone(prepared.find(x => x.id === id)!);
const bridge = (locale = 'it-IT'): DesktopBridge => ({ getRuntime: async () => ({ platform: 'test', mode: 'browser', locale }), loadProgress: async () => ({ state: null }), saveProgress: async () => {} });
async function view(x: Exploration, locale = 'it-IT') {
  const r = render(<PreferencesProvider bridge={bridge(locale)}><ExplorationView x={x} goHome={() => {}}/></PreferencesProvider>);
  await within(document.querySelector<HTMLElement>('.xp-bar')!).findByRole('heading', { level: 1, name: x.title });
  return r;
}
const user = () => userEvent.setup();
const top = () => [...document.querySelectorAll<HTMLElement>('.xp-structure-panel .xp-stage > .xp-graph > .xp-node')];
const topIds = () => top().map(n => n.dataset.id);
const node = (id: string, scope: ParentNode = document) => scope.querySelector<HTMLElement>(`.xp-node[data-id="${id}"]`)!;
const sub = () => document.querySelector<HTMLElement>('.xp-sub');
const card = () => within(screen.getByRole('region', { name: 'Scheda' }));
const cardTitle = () => document.querySelector('.xp-card h3')?.textContent;
const strip = () => document.querySelector<HTMLElement>('.xp-step-strip')!;
const count = () => strip().querySelector('.xp-count')?.textContent;
/** The source blocks marked as the selection's lines. */
const marked = () => [...document.querySelectorAll<HTMLElement>('.xp-source .focus, .xp-source .cited')];
/** The innermost source blocks that meet these lines: what "exactly its lines" means on a rendered document. */
function meeting(cites: ExplorationCite[]) {
  const blocks = [...document.querySelectorAll<HTMLElement>('.xp-source [data-from]')];
  const meets = (b: HTMLElement) => cites.some(c => c.from <= Number(b.dataset.to) && c.to >= Number(b.dataset.from));
  return blocks.filter(b => meets(b) && ![...b.querySelectorAll<HTMLElement>('[data-from]')].some(meets));
}
const exactly = (cites: ExplorationCite[]) => expect(marked().sort()).toEqual(meeting(cites).sort());
const positions = () => top().map(n => `${n.dataset.id}:${n.style.left},${n.style.top}`);

afterEach(() => { vi.restoreAllMocks(); delete (Element.prototype as { animate?: unknown }).animate; });

describe('the view and its shared state (X12)', () => {
  it('opens the importer on its aspects and Mill on its roles', async () => {
    await view(byId('importer-signals-map'));
    expect(topIds()).toEqual(expect.arrayContaining(['signals', 'reading']));
    expect(node('signals').querySelector('.xp-kind')).toHaveTextContent('aspetto');
    expect(topIds()).not.toContain('round');
  });

  it('never tells a role by colour alone: every block names its kind, and a prerequisite is drawn dashed (X11)', async () => {
    await view(byId('atlas-release-map'));
    await user().click(screen.getByRole('button', { name: 'Tutti i livelli' }));
    const nodes = [...document.querySelectorAll<HTMLElement>('.xp-node')];
    expect(nodes.length).toBeGreaterThan(2);
    expect(nodes.filter(n => !n.querySelector('.xp-kind')?.textContent?.trim()).map(n => n.dataset.id)).toEqual([]);
    expect(node('identity').querySelector('.xp-kind')).toHaveTextContent('prerequisito');
    expect(node('identity').dataset.role).toBe('prerequisite');
  });

  it('opens Mill on its roles, layer by layer', async () => {
    await view(byId('mill-harm-map'));
    expect(topIds()).toEqual(['utility']);
    expect(node('utility').querySelector('.xp-kind')).toHaveTextContent('ruolo');
    expect(count()).toBe('livello 1 di 4');
  });

  it('highlights exactly the lines of a chosen part, then of one of its points', async () => {
    const x = byId('mill-harm-map'); await view(x);
    await user().click(node('utility'));
    expect(cardTitle()).toBe('L’utilità come fondamento');
    exactly(x.parts.find(p => p.id === 'utility')!.cites);
    await user().click(card().getAllByRole('button', { name: /^Punto della scheda/ })[1]);
    exactly(x.parts.find(p => p.id === 'utility')!.points[1].cites);
  });

  it('answers a click on a cited line with its part', async () => {
    const x = byId('mill-harm-map'); await view(x);
    const block = document.querySelectorAll<HTMLElement>('.xp-source [data-from]');
    const at = [...block].find(b => Number(b.dataset.from) >= 95 && Number(b.dataset.from) <= 121)!;
    await user().click(at);
    expect(cardTitle()).toBe('La regione della libertà');
  });

  it('keeps the state when a panel folds and opens again', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await user().click(node('reading'));
    const before = cardTitle();
    await user().click(screen.getByRole('button', { name: 'Riduci: Fonte' }));
    expect(document.querySelector('.xp-source')).toBeNull();
    await user().click(screen.getByRole('button', { name: 'Riduci: Indice della fonte' }));
    await user().click(screen.getByRole('button', { name: 'Apri: Fonte' }));
    await user().click(screen.getByRole('button', { name: 'Apri: Indice della fonte' }));
    expect(cardTitle()).toBe(before);
    expect(marked().length).toBeGreaterThan(0);
  });

  it('gives an aspect’s roles its hue in the sub-level, and a prerequisite none', async () => {
    await view(byId('importer-signals-map'));
    expect(node('silence').dataset.tone).toBeUndefined();
    expect(node('signals').dataset.tone).toBe('a1');
    await user().click(within(node('signals')).getByRole('button', { name: /Sottolivello/ }));
    const roles = [...sub()!.querySelectorAll<HTMLElement>('.xp-node')];
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.every(r => r.dataset.tone === 'a1')).toBe(true);
  });
});

describe('a prerequisite with components at the aspect level (found in X20.3)', () => {
  it('shows its components in place and opens no sub-level', async () => {
    const x = await bakery();
    x.parts.find(p => p.id === 'staling')!.members = [{ id: 'water-loss', name: 'Water loss', does: 'dries the crumb', cites: [{ from: 4, to: 4 }] }];
    await view(await validateExploration(x));
    const toggle = within(node('staling')).getByRole('button', { name: 'Componenti · 1' });
    expect(toggle).toHaveTextContent('1 componente');
    await user().click(toggle);
    expect(sub()).toBeNull();
    expect(within(node('staling')).getByRole('button', { name: 'Water loss' })).toBeInTheDocument();
    await user().click(within(node('staling')).getByRole('button', { name: 'Water loss' }));
    expect(cardTitle()).toBe('Water loss');
  });
});

describe('the guides (X13)', () => {
  it('reaches every step of the whole source, the premise first and alone', async () => {
    const x = byId('importer-signals-map'), m = modelOf(x); await view(x);
    await user().click(screen.getByRole('button', { name: 'Tutta la fonte' }));
    expect(strip().querySelector('.xp-q')).toHaveTextContent('Il punto di partenza della fonte');
    expect(topIds()).toEqual(['silence']);
    let steps = 1;
    while (!screen.getByRole('button', { name: 'Passo successivo' }).hasAttribute('disabled')) { await user().click(screen.getByRole('button', { name: 'Passo successivo' })); steps++; }
    expect(steps).toBe(m.steps.length);
    expect(topIds()).toEqual(expect.arrayContaining(['silence', ...m.shape.nuclei.flatMap(n => n.ids)]));
  });

  it('shows all the layers at once and returns to the step', async () => {
    const x = byId('mill-harm-map'), m = modelOf(x); await view(x);
    await user().click(screen.getByRole('button', { name: 'Passo successivo' }));
    await user().click(screen.getByRole('button', { name: 'Tutti i livelli' }));
    expect(topIds().sort()).toEqual(m.shape.nuclei.flatMap(n => n.ids).sort());
    await user().click(screen.getByRole('button', { name: 'Torna al passo' }));
    expect(count()).toBe('livello 2 di 4');
    expect(topIds()).toEqual(['utility', 'principle']);
  });

  it('announces a change of nucleus in a banner', async () => {
    const x = byId('mill-harm-map'); x.links = x.links.filter(l => !(l.from === 'principle' && l.to === 'region'));
    const m = modelOf(await validateExploration(x)); await view(x);
    expect(m.shape.nuclei).toHaveLength(2);
    for (let i = 0; i < m.steps.length - 1; i++) await user().click(screen.getByRole('button', { name: /Passo successivo|Passa a un altro aspetto/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Cambi aspetto del documento/);
  });

  it('leaves the guide where it is while exploring, and "back to the step" restores it', async () => {
    const x = byId('mill-harm-map'); await view(x);
    await user().click(screen.getByRole('button', { name: 'Passo successivo' }));
    await user().click(node('principle'));
    expect(count()).toBe('livello 2 di 4');
    expect(strip()).toHaveClass('xp-paused');
    expect(cardTitle()).toBe('Il principio del danno');
    await user().click(screen.getByRole('button', { name: '↩ Torna al passo' }));
    expect(strip()).not.toHaveClass('xp-paused');
    expect(count()).toBe('livello 2 di 4');
  });

  it('lights, at the aspect level, the aspects that hold a question’s step', async () => {
    const x = byId('importer-signals-map'), m = modelOf(x); await view(x);
    const step = m.level.traces[m.shape.trace!].steps[0];
    const lit = top().filter(n => n.classList.contains('xp-lit')).map(n => n.dataset.id);
    expect(lit.sort()).toEqual([...new Set(step.parts.map(p => standIn(m, p)))].filter(id => m.parts.get(id)?.kind === 'part').sort());
  });

  it('has no guide when the source has no connected body', async () => {
    const x = byId('mill-harm-map'); x.links = [];
    await view(await validateExploration(x));
    expect(screen.queryByRole('group', { name: 'Guida' })).toBeNull();
    expect(screen.getByText(/Nessuna guida/)).toBeInTheDocument();
  });

  it('steps with the arrow keys and returns with Escape', async () => {
    await view(byId('mill-harm-map'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(count()).toBe('livello 2 di 4');
    await user().click(node('principle'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(strip()).not.toHaveClass('xp-paused');
  });
});

describe('the sub-level in place (X14)', () => {
  const openSignals = async () => user().click(within(node('signals')).getByRole('button', { name: /Sottolivello/ }));

  it('leaves every position of the whole identical, and the step as it was', async () => {
    await view(byId('importer-signals-map'));
    await user().click(screen.getByRole('button', { name: 'Tutta la fonte' }));
    while (!screen.getByRole('button', { name: 'Passo successivo' }).hasAttribute('disabled')) await user().click(screen.getByRole('button', { name: 'Passo successivo' }));
    await user().click(screen.getByRole('button', { name: 'Passo precedente' }));
    if (!document.querySelector('.xp-node[data-id="signals"]')) await user().click(screen.getByRole('button', { name: 'Passo successivo' }));
    const before = positions(), step = count();
    await openSignals();
    expect(sub()).not.toBeNull();
    expect(positions()).toEqual(before);
    expect(strip().querySelector('.xp-q')).toHaveTextContent('Dentro «Il giro e i segnali che lascia»');
    await user().click(screen.getByRole('button', { name: '✕ Chiudi e torna al passo' }));
    expect(sub()).toBeNull();
    expect(positions()).toEqual(before);
    expect(count()).toBe(step);
  });

  it('holds the aspect’s roles and no prerequisite', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await openSignals();
    const ids = [...sub()!.querySelectorAll<HTMLElement>('.xp-node')].map(n => n.dataset.id).sort();
    expect(ids).toEqual(x.parts.filter(p => p.kind === 'part' && p.aspect === 'signals').map(p => p.id).sort());
    expect(sub()!.querySelector('[data-role="prerequisite"]')).toBeNull();
  });

  it('moves to another aspect when it is touched, and to a role when its line is clicked', async () => {
    await view(byId('importer-signals-map'));
    await openSignals();
    await user().click(node('reading'));
    expect(sub()).toHaveAccessibleName('Dentro «Chi legge i segnali e agisce»');
    await user().click(screen.getByRole('button', { name: '✕ Chiudi e torna al passo' }));
    await openSignals();
    const line = [...document.querySelectorAll<HTMLElement>('.xp-source [data-from]')].find(b => Number(b.dataset.from) >= 156 && Number(b.dataset.from) <= 160)!;
    await user().click(line);
    expect(sub()).toHaveAccessibleName('Dentro «Chi legge i segnali e agisce»');
    expect(cardTitle()).toBe('La regola di riavvio');
  });

  it('lights exactly a component’s lines', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await openSignals();
    await user().click(node('outcomes', sub()!));
    await user().click(within(sub()!).getByRole('button', { name: 'Memorizzato' }));
    expect(cardTitle()).toBe('Memorizzato');
    exactly(x.parts.find(p => p.id === 'outcomes')!.members.find(m => m.id === 'stored')!.cites);
  });

  it('starts no animation under "reduce motion", and grows out of its block otherwise', async () => {
    const animate = vi.fn(() => ({ onfinish: null }));
    (Element.prototype as { animate?: unknown }).animate = animate;
    const media = (reduce: boolean) => { window.matchMedia = (q => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList); };
    media(true);
    const r = await view(byId('importer-signals-map'));
    await openSignals();
    expect(animate).not.toHaveBeenCalled();
    r.unmount();
    media(false);
    await view(byId('importer-signals-map'));
    await openSignals();
    expect(animate).toHaveBeenCalled();
    // a window in the background pauses its animations: the playback never finishes, and the sub-level still closes
    await user().click(screen.getByRole('button', { name: '✕ Chiudi e torna al passo' }));
    await vi.waitFor(() => expect(sub()).toBeNull(), { timeout: 1500 });
    delete (window as { matchMedia?: unknown }).matchMedia;
  });
});

describe('joints and their labels (X15)', () => {
  const label = (from: string, to: string) => document.querySelector<HTMLElement>(`.xp-stage > .xp-graph > .xp-label[data-joint="${from}>${to}"]`)!;
  const all = async (x: Exploration) => { await view(x); await user().click(screen.getByRole('button', { name: 'Tutti i livelli' })); };
  const offset = (el: HTMLElement) => el.dataset.offset!.split(',').map(Number);

  it('moves a label with the pointer, draws a leader to its joint, and puts it back with a double click', async () => {
    await all(byId('mill-harm-map'));
    const tag = label('utility', 'principle'), [ox, oy] = offset(tag), before = cardTitle();
    fireEvent.pointerDown(tag, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(tag, { clientX: 70, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(tag, { clientX: 70, clientY: 50, pointerId: 1 });
    expect(offset(label('utility', 'principle'))).toEqual([ox + 60, oy + 40]);
    const lead = document.querySelector<SVGLineElement>('.xp-stage > .xp-graph [data-for$="utility>principle|bond"] line')!;
    expect(Number(lead.getAttribute('x2')) - Number(lead.getAttribute('x1'))).toBe(ox + 60);
    expect(cardTitle()).toBe(before);
    fireEvent.doubleClick(label('utility', 'principle'));
    expect(offset(label('utility', 'principle'))).toEqual([ox, oy]);
  });

  it('draws the leader only while a label is away from its joint', async () => {
    await all(byId('mill-harm-map'));
    const near = [...document.querySelectorAll<HTMLElement>('.xp-stage > .xp-graph > .xp-label')].find(l => Math.hypot(...offset(l) as [number, number]) <= 12)!;
    const key = near.dataset.joint!;
    const leads = () => document.querySelectorAll(`.xp-stage > .xp-graph [data-for*="|${key}|"]`).length;
    expect(leads()).toBe(0);
    near.focus();
    for (let i = 0; i < 3; i++) fireEvent.keyDown(near, { key: 'ArrowDown' });
    expect(leads()).toBe(1);
  });

  it('keeps a moved label after a step; the arrow keys move a focused label and leave the guide alone', async () => {
    await view(byId('mill-harm-map'));
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(count()).toBe('livello 4 di 4');
    const tag = label('utility', 'principle'), [ox, oy] = offset(tag);
    tag.focus(); fireEvent.keyDown(tag, { key: 'ArrowRight' });
    expect(offset(label('utility', 'principle'))).toEqual([ox + 8, oy]);
    expect(count()).toBe('livello 4 di 4');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(count()).toBe('livello 3 di 4');
    expect(offset(label('utility', 'principle'))).toEqual([ox + 8, oy]);
    fireEvent.keyDown(label('utility', 'principle'), { key: 'Home' });
    expect(offset(label('utility', 'principle'))[0]).not.toBe(ox + 8);
  });

  it('lights exactly the chosen block’s joints, and none when it is chosen again', async () => {
    const x = byId('mill-harm-map'); await all(x);
    await user().click(node('principle'));
    const hot = [...document.querySelectorAll<SVGPathElement>('.xp-stage > .xp-graph .xp-edge.xp-hot')].map(e => e.dataset.joint).sort();
    expect(hot).toEqual(x.links.filter(l => l.from === 'principle' || l.to === 'principle').map(l => `${l.from}>${l.to}`).sort());
    await user().click(node('principle'));
    expect(document.querySelectorAll('.xp-edge.xp-hot')).toHaveLength(0);
  });

  it('marks "who" and "to whom" when a label is pointed at, and its arrow follows the joint', async () => {
    await all(byId('mill-harm-map'));
    const tag = label('utility', 'principle');
    expect(tag.querySelector('.xp-way')).toHaveTextContent('↓');
    fireEvent.pointerEnter(tag);
    expect(node('utility')).toHaveClass('xp-who');
    expect(node('utility').querySelector('[data-badge="who"]')).toHaveTextContent('chi');
    expect(node('principle')).toHaveClass('xp-whom');
    expect(node('principle').querySelector('[data-badge="whom"]')).toHaveTextContent('a chi');
    fireEvent.pointerLeave(tag);
    expect(node('utility')).not.toHaveClass('xp-who');
  });
});

describe('the card and the index (X16)', () => {
  it('lights a point’s and a component’s own lines', async () => {
    const x = byId('mill-harm-map'); await view(x);
    await user().click(screen.getByRole('button', { name: 'Tutti i livelli' }));
    await user().click(node('region'));
    await user().click(card().getAllByRole('button', { name: /Punto della scheda/ })[0]);
    exactly(x.parts.find(p => p.id === 'region')!.points[0].cites);
    await user().click(within(node('region')).getByRole('button', { name: 'Componenti · 4' }));
    await user().click(within(node('region')).getByRole('button', { name: 'libertà di associazione' }));
    expect(cardTitle()).toBe('libertà di associazione');
    exactly(x.parts.find(p => p.id === 'region')!.members.find(m => m.id === 'combination')!.cites);
  });

  it('shows "not extracted" for a section no part cites', async () => {
    const x = await bakery(); x.parts = x.parts.filter(p => p.id !== 'prices'); x.links = x.links.filter(l => l.from !== 'prices');
    await view(await validateExploration(x));
    await user().click(within(screen.getByRole('navigation', { name: 'Indice della fonte' })).getByRole('button', { name: /Price list/ }));
    expect(cardTitle()).toBe('Price list');
    expect(card().getByText('Nessuna parte la cita: l’estrazione l’ha lasciata fuori.')).toBeInTheDocument();
  });

  it('marks where a trace walks with its question', async () => {
    const x = byId('importer-signals-map'), m = modelOf(x); await view(x);
    const q = m.x.traces[m.shape.trace!].question;
    expect(document.querySelector('.xp-index .xp-asks')).toHaveTextContent(`? ${q}`);
  });

  it('fills a part’s dot once the guide shows it', async () => {
    const x = await bakery(); await view(x);
    await user().click(screen.getByRole('button', { name: 'Tutta la fonte' }));
    const dot = (title: string) => document.querySelector<HTMLElement>(`.xp-index .xp-dot[title="${title}"]`)!;
    // the premise comes first and alone
    expect(dot('Why bread goes stale')).toHaveClass('xp-in');
    expect(dot('The mix')).not.toHaveClass('xp-in');
    await user().click(screen.getByRole('button', { name: 'Passo successivo' }));
    expect(dot('The mix')).toHaveClass('xp-in');
    expect(dot('The counter')).not.toHaveClass('xp-in');
    while (!screen.getByRole('button', { name: /Passo successivo|Passa a un altro aspetto/ }).hasAttribute('disabled')) await user().click(screen.getByRole('button', { name: /Passo successivo|Passa a un altro aspetto/ }));
    expect(dot('The counter')).toHaveClass('xp-in');
  });
});

describe('the card explains the selection (X21)', () => {
  const label = (from: string, to: string, scope = '.xp-stage > .xp-graph') => document.querySelector<HTMLElement>(`${scope} > .xp-label[data-joint="${from}>${to}"]`)!;
  const offset = (el: HTMLElement) => el.dataset.offset!;
  const mill = async () => { const x = byId('mill-harm-map'); await view(x); await user().click(screen.getByRole('button', { name: 'Tutti i livelli' })); return x; };
  const release = (el: HTMLElement, dx: number) => {
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 10 + dx, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 10 + dx, clientY: 10, pointerId: 1 });
  };

  it('gives an aspect its name and the way into its roles, and no list of them', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await user().click(screen.getByRole('button', { name: 'Tutti i livelli' }));
    await user().click(node('signals'));
    expect(cardTitle()).toBe('Il giro e i segnali che lascia');
    const roles = x.parts.filter(p => p.kind === 'part' && p.aspect === 'signals');
    const text = document.querySelector('.xp-card')!.textContent!.replaceAll('Il giro e i segnali che lascia', '').replace(/Le righe citate[\s\S]*$/, '');
    for (const r of roles) expect(text).not.toContain(r.name);
    expect(document.querySelector('.xp-card .xp-lead')).toBeNull();
    expect(card().getByRole('button', { name: /Apri «Il giro e i segnali che lascia»: 5 ruoli/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.xp-card details')).toHaveLength(0);
  });

  it('gives a role what it does and every point, with no fold', async () => {
    const x = await mill();
    await user().click(node('region'));
    const region = x.parts.find(p => p.id === 'region')!;
    expect(document.querySelector('.xp-card .xp-lead')).toHaveTextContent(region.role);
    expect(card().getAllByRole('button', { name: /Punto della scheda/ })).toHaveLength(region.points.length);
    expect(document.querySelectorAll('.xp-card details')).toHaveLength(0);
    expect(card().queryByText(/Perché è collegata|Componenti ·/)).toBeNull();
  });

  it('opens a link’s own card from its label, by click or Enter, and Escape returns to the part', async () => {
    const x = await mill();
    const link = x.links.find(l => l.from === 'region' && l.to === 'free')!;
    await user().click(label('region', 'free'));
    expect(cardTitle()).toBe('La regione della libertà → Che cosa rende libera una società');
    expect(card().getByText('legame')).toBeInTheDocument();
    expect(card().getByText('dichiarato')).toBeInTheDocument();
    // one bond between the joint's own ends: the head names them, the lead says the relation
    expect(document.querySelector('.xp-card .xp-lead')).toHaveTextContent(link.label);
    expect(document.querySelector('.xp-card .xp-bonds')).toBeNull();
    expect(label('region', 'free')).toHaveAttribute('aria-pressed', 'true');
    exactly(link.cites);
    fireEvent.keyDown(label('region', 'free'), { key: 'Escape' });
    expect(cardTitle()).toBe('La regione della libertà');
    expect(label('region', 'free')).toHaveAttribute('aria-pressed', 'false');
    label('principle', 'region').focus();
    fireEvent.keyDown(label('principle', 'region'), { key: 'Enter' });
    expect(cardTitle()).toBe('Il principio del danno → La regione della libertà');
    await user().click(card().getByRole('button', { name: '← Il principio del danno' }));
    expect(cardTitle()).toBe('Il principio del danno');
  });

  it('tells a click from a drag by 4 px', async () => {
    await mill();
    const before = offset(label('region', 'free')), title = cardTitle();
    release(label('region', 'free'), 3);
    expect(cardTitle()).toBe('La regione della libertà → Che cosa rende libera una società');
    expect(offset(label('region', 'free'))).toBe(before);
    fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.keyDown(window, { key: 'Escape' });
    expect(cardTitle()).toBe(title);
    const other = offset(label('utility', 'principle'));
    release(label('utility', 'principle'), 5);
    expect(offset(label('utility', 'principle'))).not.toBe(other);
    expect(cardTitle()).toBe(title);
  });

  it('opens a link inside a sub-level on its card, at that level', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await user().click(within(node('signals')).getByRole('button', { name: /Sottolivello/ }));
    await user().click(label('round', 'outcomes', '.xp-sub .xp-graph'));
    expect(cardTitle()).toMatch(/→/);
    exactly(x.links.find(l => l.from === 'round' && l.to === 'outcomes')!.cites);
    expect(sub()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sub()).not.toBeNull();
    expect(cardTitle()).toBe(x.parts.find(p => p.id === 'round')!.name);
  });

  it('gives a component what it does and its role as the way back, and no other components', async () => {
    await mill();
    await user().click(within(node('region')).getByRole('button', { name: 'Componenti · 4' }));
    await user().click(within(node('region')).getByRole('button', { name: 'libertà di associazione' }));
    expect(card().queryByText(/altri componenti/)).toBeNull();
    await user().click(card().getByRole('button', { name: 'Torna al ruolo: La regione della libertà' }));
    expect(cardTitle()).toBe('La regione della libertà');
  });

  it('keeps the cited lines on the card for when the source is hidden', async () => {
    await mill();
    await user().click(node('region'));
    expect(document.querySelector('.xp-card .xp-card-lines')).toHaveTextContent('Le righe citate');
  });
});

describe('"how it was read" (X17)', () => {
  it('counts as the reading report does, and a cell opens its line', async () => {
    const x = byId('mill-harm-map'); await view(x);
    await user().click(screen.getByRole('button', { name: 'Come è stata letta' }));
    const report = readingReport(x, shapeOf(x), modelOf(x).index);
    for (const [k, n] of Object.entries(report.counts)) if (n) expect(document.querySelector(`[data-verdict-count="${k}"]`)).toHaveTextContent(String(n));
    expect(document.querySelector('[data-count="total"]')).toHaveTextContent(String(report.total));
    await user().click(screen.getByRole('button', { name: 'riga 100 · nel meccanismo principale' }));
    expect(screen.queryByRole('region', { name: 'Come è stata letta' })).toBeNull();
    expect(cardTitle()).toBe('La regione della libertà');
  });

  it('opens an interpreted link on its card', async () => {
    const x = byId('importer-signals-map'); await view(x);
    await user().click(screen.getByRole('button', { name: 'Come è stata letta' }));
    await user().click(screen.getByRole('button', { name: /Il silenzio, il guasto difficile → pone la domanda 3/ }));
    // at the aspect level the link to a role is the joint to the role's aspect, and it opens on its own card (X21)
    expect(cardTitle()).toBe('Il silenzio, il guasto difficile → Il giro e i segnali che lascia');
    // the joint is declared, since two of its three links are; the interpreted one is marked on its bond
    expect(card().getAllByText('dichiarato')).toHaveLength(1);
    expect(within(card().getByText(/pone la domanda 3/).closest('li')!).getByText('interpretato')).toBeInTheDocument();
    expect(document.querySelector('.xp-stage > .xp-graph > .xp-label[data-joint="silence>signals"]')).toHaveAttribute('aria-pressed', 'true');
  });

  it('speaks English too', async () => {
    await view(byId('mill-harm-map-en'), 'en-US');
    await user().click(screen.getByRole('button', { name: 'How it was read' }));
    expect(screen.getByRole('region', { name: 'How it was read' })).toHaveTextContent(/lines of text/);
    expect(screen.getByRole('region', { name: 'How it was read' })).toHaveTextContent(/Way in/);
    await act(async () => {});
  });
});
