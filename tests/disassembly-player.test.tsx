import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge, ProgressKey } from '../src/core/bridge';
import { divisible, linesOf, validateDisassembly, type Disassembly } from '../src/core/disassembly';
import { expandPart as expandPart2 } from '../src/core/disassembly-generation';
import { carryOver, trayOrder, type DisassemblyState } from '../src/core/disassembly-state';
import { failure, type ExpansionRequest, type ExpansionResult, type GenerationProgress, type StudioSettings } from '../src/core/provider';
import { App } from '../src/renderer/App';
import { DisassemblyPlayer } from '../src/renderer/disassembly/DisassemblyPlayer';
import { Sheet } from '../src/renderer/disassembly/Sheet';
import { labelBeside, layoutDisassembly } from '../src/core/layout';
import { PreferencesProvider } from '../src/renderer/preferences';
import { atlas, fixture, mill, PUBLIC_FIXTURES, story } from './disassemblies';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { generatedFrom, splitAnswer } from './disassembly-drafts';

/** An in-memory bridge with the same contract as the preload; `locale` sets the interface language. */
function memoryBridge(locale = 'it-IT') {
  const saved = new Map<string, unknown>();
  const key = (k: ProgressKey) => `${'lessonId' in k ? k.lessonId : k.disassemblyId}:${k.revision}`;
  const bridge: DesktopBridge = {
    getRuntime: async () => ({ platform: 'test', mode: 'browser', locale }),
    loadProgress: async k => ({ state: structuredClone(saved.get(key(k))) ?? null }),
    saveProgress: async s => { saved.set(key('lessonId' in s ? s : { disassemblyId: s.disassemblyId, revision: s.revision }), structuredClone(s)); },
  };
  return { bridge, saved };
}
async function play(d: Disassembly, bridge = memoryBridge().bridge) {
  const view = render(<PreferencesProvider bridge={bridge}><DisassemblyPlayer d={d} bridge={bridge} goHome={() => {}}/></PreferencesProvider>);
  await screen.findByRole('group', { name: /Cosa fare con lo smontaggio|What to do/ });
  return view;
}
const user = () => userEvent.setup();
const plate = (name: RegExp) => screen.getByRole('button', { name });
const side = () => within(document.querySelector<HTMLElement>('.d-side')!);
const focusedLines = () => [...document.querySelectorAll('.source-text li.focus')].map(x => Number((x as HTMLElement).dataset.line));

describe('exploded view, part card and source', () => {
  it('shows a selected part with its marked points and highlights its first citation in the source', async () => {
    const d = await validateDisassembly(atlas()); await play(d);
    await user().click(plate(/^4\. deploy-staging/));
    const card = side();
    expect(card.getByRole('heading', { name: /deploy-staging/ })).toBeInTheDocument();
    expect(card.getByText(/Legge release.json/)).toBeInTheDocument();
    expect(card.getAllByText('resta uguale:', { exact: false }).length).toBeGreaterThan(0);
    const [cite] = d.parts[3].cites;
    expect(focusedLines()).toEqual(Array.from({ length: cite.to - cite.from + 1 }, (_, i) => cite.from + i));
    await user().click(card.getByRole('button', { name: 'r. 100–115' }));
    expect(focusedLines()[0]).toBe(100);
  });
  it('enters and leaves a sub-assembly, and keeps a closed one reachable', async () => {
    await play(await validateDisassembly(atlas()));
    await user().click(plate(/^2\. check/));
    expect(side().getByText('Chiuso: non serve alla tua domanda, ma resta qui.')).toBeInTheDocument();
    await user().click(side().getByRole('button', { name: /Apri comunque il sottoassieme · 4 pezzi/ }));
    const crumbs = within(screen.getByRole('navigation', { name: 'Livelli dello smontaggio' }));
    expect(crumbs.getByText('check')).toHaveAttribute('aria-current', 'location');
    expect(plate(/^1\. Lockfile esatto/)).toBeInTheDocument();
    await user().click(crumbs.getByRole('button', { name: 'Catena di rilascio' }));
    expect(plate(/^3\. image → release.json/)).toBeInTheDocument();
  });
  it('opens a part from the keyboard and leaves no stray text when optional blocks are absent', async () => {
    await play(await validateDisassembly(atlas()));
    plate(/^5\. Smoke test/).focus();
    await user().keyboard('{Enter}');
    const card = document.querySelector('.part-card')!;
    expect(card.textContent).not.toMatch(/undefined|null|\[object/);
    expect(card.querySelector('.card-box.inference')).toBeNull();
    expect(card.querySelector('.lens-list')).toBeNull();
  });
});

describe('run', () => {
  it('plays a full scenario: prediction before each predicted step, then execution, states and instruments', async () => {
    const d = await validateDisassembly(atlas()); await play(d);
    await user().click(screen.getByRole('button', { name: 'Fai girare' }));
    const run = d.runs[0]; if (run.type !== 'scenario') throw new Error('fixture');
    for (const [i, step] of run.steps.entries()) {
      const panel = side();
      if (step.predict) {
        expect(panel.getByRole('button', { name: /Esegui il passo/ })).toBeDisabled();
        await user().click(panel.getByRole('radio', { name: step.predict.options.find(o => o.correct)!.text }));
        await user().click(panel.getByRole('button', { name: /Esegui il passo/ }));
        expect(panel.getByText('Previsione giusta.')).toBeInTheDocument();
      } else await user().click(panel.getByRole('button', { name: i === 0 ? /Inizia lo scenario/ : /Esegui il passo/ }));
      expect(panel.getByText(step.explain)).toBeInTheDocument();
    }
    expect(side().getByText('Scenario completato.')).toBeInTheDocument();
    expect(within(side().getByRole('table')).getByText('digest A')).toBeInTheDocument();
    expect(plate(/^6\. Rollback · passo · fatto/)).toBeInTheDocument();
  });
  it('removes every brick of the Mill load test and names each verdict, with the inference labelled', async () => {
    const d = await validateDisassembly(mill()); await play(d);
    await user().click(screen.getByRole('button', { name: 'Fai girare' }));
    const run = d.runs[0]; if (run.type !== 'load') throw new Error('fixture');
    for (const brick of run.bricks) {
      await user().click(side().getByRole('button', { name: new RegExp(`Togli «${d.parts.find(p => p.id === brick.part)!.name}»`) }));
      const feedback = document.querySelector('.run-feedback')!;
      expect(feedback).toHaveClass(`verdict-${brick.verdict}`);
      expect(feedback.textContent).toContain(brick.explain);
      expect(!!feedback.querySelector('.inference-note')).toBe(!!brick.inference);
    }
    expect(side().getByText('Portanti')).toBeInTheDocument();
    expect(side().getByText('Non portanti')).toBeInTheDocument();
  });
  it('answers a new case, labelled as constructed, with feedback for the chosen option', async () => {
    const d = await validateDisassembly(mill()); await play(d);
    await user().click(screen.getByRole('button', { name: 'Fai girare' }));
    await user().click(side().getByRole('button', { name: /Caso nuovo/ }));
    expect(side().getByText('Caso costruito: non viene dalla fonte.')).toBeInTheDocument();
    await user().click(side().getByRole('radio', { name: /Sì: protegge la salute/ }));
    expect(side().getByText('Non proprio.')).toBeInTheDocument();
  });
  it('resumes a half-finished scenario after closing the player', async () => {
    const d = await validateDisassembly(atlas()); const { bridge, saved } = memoryBridge();
    const first = await play(d, bridge);
    await user().click(screen.getByRole('button', { name: 'Fai girare' }));
    await user().click(side().getAllByRole('radio')[1]);
    await user().click(side().getByRole('button', { name: /Esegui il passo/ }));
    await waitFor(() => expect((saved.get('atlas-release:v1') as { runs: Record<string, { step: number }> })?.runs['failed-smoke']?.step).toBe(0));
    first.unmount();
    await play(d, bridge);
    await user().click(screen.getByRole('button', { name: 'Fai girare' }));
    expect(side().getByText('Passo 1 di 5')).toBeInTheDocument();
    expect(side().getByText('Passo 2 di 5')).toBeInTheDocument();
  });
  it('runs a step in two beats: its parts show as running, then the effects and explanation land', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const d = await validateDisassembly(atlas()); await play(d);
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await u.click(screen.getByRole('button', { name: 'Fai girare' }));
      await u.click(side().getAllByRole('radio')[1]);
      await u.click(side().getByRole('button', { name: /Esegui il passo/ }));
      expect(side().getByText('In esecuzione…')).toBeInTheDocument();
      expect(plate(/^2\. check · passo · in corso/)).toBeInTheDocument();
      const run = d.runs[0]; if (run.type !== 'scenario') throw new Error('fixture');
      expect(side().queryByText(run.steps[0].explain)).not.toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(950); });
      expect(side().getByText(run.steps[0].explain)).toBeInTheDocument();
      expect(plate(/^2\. check · passo · fatto/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
  it('words load-test verdicts in English too', async () => {
    const d = await validateDisassembly(story()); await play(d, memoryBridge('en-GB').bridge);
    await user().click(screen.getByRole('button', { name: 'Run' }));
    await user().click(side().getByRole('button', { name: /Remove "The bell proves itself"/ }));
    expect(document.querySelector('.run-feedback')!.textContent).toMatch(/WEAKENS"The market moves to the quay" weakens\./);
  });
});

describe('reassembly and bill of materials', () => {
  it('never starts the tray in solution order', async () => {
    for (const path of PUBLIC_FIXTURES) {
      const d = await validateDisassembly(fixture(path));
      const solution = d.reassemble.slots.flatMap(s => [s.accepts].flat()).filter((x, i, all) => all.indexOf(x) === i);
      expect(trayOrder(d)).not.toEqual(solution);
      expect([...trayOrder(d)].sort()).toEqual([...solution].sort());
    }
  });
  it('names the first misplaced part with its hint, then locks every slot when the parts are in place', async () => {
    const d = await validateDisassembly(atlas()); await play(d);
    await user().click(screen.getByRole('button', { name: 'Rimonta' }));
    expect(screen.getByText('FACOLTATIVA')).toBeInTheDocument();
    expect(document.querySelector('.reassembly-sheet .balloon')).toBeNull();
    const put = async (part: string, slot: string) => {
      await user().click(screen.getByRole('button', { name: part }));
      await user().click(screen.getByRole('button', { name: new RegExp(`^Spazio ${slot}`) }));
    };
    await put('Smoke test', '1');
    await user().click(screen.getByRole('button', { name: 'Verifica' }));
    const feedback = () => document.querySelector('.reassemble .run-feedback');
    expect(feedback()).toHaveTextContent('«Smoke test» non va lì. Il controllo umano ha senso solo quando il nuovo digest gira.');
    await user().click(screen.getByRole('button', { name: 'Svuota' }));
    const order: [string, string][] = [['Preparazione e avvio', '1'], ['check', '2'], ['image → release.json', '3'], ['deploy-staging', '4'], ['Smoke test', '5'], ['Rollback', '↺']];
    for (const [part, slot] of order) await put(part, slot);
    await user().click(screen.getByRole('button', { name: 'Verifica' }));
    expect(feedback()).toHaveTextContent('Rimontato: ogni pezzo è al suo posto.');
    expect(screen.getByText('6 di 6 al loro posto.')).toBeInTheDocument();
  });
  it.each(PUBLIC_FIXTURES)('shows 0 forgotten lines in the bill of materials of %s', async path => {
    const d = await validateDisassembly(fixture(path)); await play(d);
    await user().click(screen.getByRole('button', { name: 'Distinta base' }));
    expect(document.querySelector('.bom-check')).toHaveClass('good');
    expect(screen.getByText('Controllo dell’app: ogni riga è in un pezzo o esclusa con un motivo.')).toBeInTheDocument();
    expect(document.querySelectorAll('.bom-strip rect.line-missing')).toHaveLength(0);
  });
  it('lists file-level exclusions and the scope of a repository snapshot', async () => {
    const input = story();
    input.scope = { kind: 'repository', root: 'kessmouth', commit: 'a1b2c3d', modified: ['harbour.md'] };
    input.bom.excludedFiles = [{ path: 'config/settings.json', reason: 'secrets', note: 'Keys found by content.' }];
    await play(await validateDisassembly(input));
    await user().click(screen.getByRole('button', { name: 'Distinta base' }));
    expect(screen.getByText(/kessmouth · commit a1b2c3d/)).toBeInTheDocument();
    expect(screen.getByText('config/settings.json').closest('tr')).toHaveTextContent('contiene segreti');
  });
});

describe('content language and interface language', () => {
  it('keeps Italian content marked as Italian under an English interface, and the reverse', async () => {
    const it = await validateDisassembly(atlas()); const en = await validateDisassembly(story());
    const { bridge } = memoryBridge('en-US');
    render(<App bridge={bridge} prepared={[]} disassemblies={[it, en]}/>);
    expect(await screen.findByRole('button', { name: /How the Kessmouth market/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rilascio di Atlas Reader/ })).not.toBeInTheDocument();
    await user().click(screen.getByRole('checkbox', { name: /Also show the examples in Italian/ }));
    await user().click(screen.getByRole('button', { name: /Rilascio di Atlas Reader/ }));
    await screen.findByRole('button', { name: 'Exploded view' });
    expect(screen.getByText(it.question)).toHaveAttribute('lang', 'it');
    expect(document.documentElement.lang).toBe('en');
    await user().click(plate(/^4\. deploy-staging · step/));
    expect(side().getByText('Part 4 · step')).toBeInTheDocument();
    expect(side().getByRole('heading', { name: /deploy-staging/ }).closest('[lang]')).toHaveAttribute('lang', 'it');
  });
  it('offers the version in the interface language, keeping progress separate', async () => {
    const { bridge } = memoryBridge('en-US');
    render(<App bridge={bridge} prepared={[]} disassemblies={await loadPreparedDisassemblies()}/>);
    await user().click(await screen.findByRole('checkbox', { name: /Also show the examples in Italian/ }));
    await user().click(screen.getByRole('button', { name: /Rilascio di Atlas Reader/ }));
    expect(await screen.findByText(/This disassembly also exists in English/)).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Open that version' }));
    expect(await screen.findByText('How do you release a new version of the web client to staging, and how do you go back if something goes wrong?')).toBeInTheDocument();
    expect(screen.queryByText(/also exists in/)).not.toBeInTheDocument();
  });
  it('shows English content under an Italian interface', async () => {
    const { bridge } = memoryBridge('it-IT');
    await play(await validateDisassembly(story()), bridge);
    expect(screen.getByRole('button', { name: 'Esploso' })).toBeInTheDocument();
    expect(screen.getByText(/How did the Kessmouth market/)).toHaveAttribute('lang', 'en');
    await act(async () => {});
  });
});

describe('labels on a running line', () => {
  it('moves the running joint’s label beside its line, and leaves the others where they are', async () => {
    const d = await validateDisassembly(atlas());
    const level = layoutDisassembly(d).get('root')!;
    const index = level.joints.findIndex((_, i) => labelBeside(level, i));
    const joint = d.joints[index];
    render(<PreferencesProvider bridge={memoryBridge().bridge}><Sheet layout={level} parts={d.parts} joints={d.joints} title="t" subtitle="s" language="it" flow={[[joint.from, joint.to]]}/></PreferencesProvider>);
    const labels = [...document.querySelectorAll<SVGGElement>('.joint-label')];
    const [dx, dy] = labelBeside(level, index)!;
    expect(labels[index].style.transform).toBe(`translate(${dx}px, ${dy}px)`);
    expect(labels.filter((_, i) => i !== index).every(x => !x.style.transform)).toBe(true);
  });
});

describe('taking a part apart on demand (D14)', () => {
  /** A desktop bridge whose host takes a part apart with a scripted answer, saves v2 and moves the progress, as the real host does. */
  async function desktopWith(d: Disassembly) {
    const { bridge, saved } = memoryBridge('it-IT');
    const listeners: ((p: GenerationProgress) => void)[] = [];
    const expandPart = vi.fn(async (request: ExpansionRequest): Promise<ExpansionResult> => {
      listeners.forEach(l => l({ phase: 'structure', repairing: false, received: 0, requests: 1 }));
      const next = await validateDisassembly(expandPart_(d, request.part));
      const before = saved.get(`${d.id}:${d.revision}`) as DisassemblyState | undefined;
      const moved = before && carryOver(d, next, before);
      if (moved) saved.set(`${d.id}:${next.revision}`, moved);
      return { ok: true, disassembly: next, moved: !!moved, stats: { requests: 1, repairs: 0, sentChars: 1, receivedChars: 1, ms: 1 } };
    });
    const expandPart_ = (x: Disassembly, part: string) => expandPart2(x, part, splitAnswer(x, part), { provider: 'chatgpt', model: 'strong', createdAt: '2026-10-26T12:00:00.000Z' });
    const settings: StudioSettings = { version: 1, provider: 'chatgpt', chatgptModel: 'strong' };
    bridge.studio = {
      pickSources: async () => ({ sources: [], errors: [] }), accountStatus: async () => ({ state: 'signed-out', storage: true }), signIn: async () => ({ ok: false, failure: failure('unsupported') }),
      cancelSignIn: async () => {}, signOut: async () => ({ state: 'signed-out', storage: true }), listModels: async () => ({ ok: true, models: [] }),
      generate: async () => ({ ok: false, failure: failure('unsupported') }), cancelGeneration: async () => {},
      onGenerationProgress: listener => { listeners.push(listener); return () => { listeners.splice(listeners.indexOf(listener), 1); }; },
      listLessons: async () => ({ lessons: [], skipped: 0 }), listDisassemblies: async () => ({ disassemblies: [d], skipped: 0 }), expandPart,
      openUsageSettings: async () => {}, getSettings: async () => settings, saveSettings: async next => next,
      discoverLocal: async () => [], connectLocal: async () => ({ ok: false, failure: failure('local-address') }), checkLocalFormat: async () => ({ ok: false, failure: failure('local-address') }),
    };
    return { bridge, expandPart };
  }

  it('offers the action on a part with enough lines, says why a small part stops, and opens the new level with the progress kept', async () => {
    const d = await validateDisassembly(generatedFrom(fixture(PUBLIC_FIXTURES[4])));
    const leaf = d.parts.find(p => !p.parts && divisible(d, p))!;
    const small = d.parts.find(p => !p.parts && !divisible(d, p))!;
    const { bridge, expandPart } = await desktopWith(d);
    render(<App bridge={bridge} prepared={[]} disassemblies={[]}/>);
    await user().click(await screen.findByRole('button', { name: (name: string) => name.includes(d.title) }));
    await screen.findByRole('group', { name: /Cosa fare con lo smontaggio/ });
    await user().click(plate(new RegExp(`^${d.parts.indexOf(small) + 1}\\. `)));
    expect(side().getByText(new RegExp(`Questo pezzo non si smonta oltre: cita ${linesOf(d, small.cites).size} righe, ne servono almeno 6`))).toBeInTheDocument();
    await user().click(plate(new RegExp(`^${d.parts.indexOf(leaf) + 1}\\. `)));
    await user().type(side().getByLabelText(/I tuoi appunti/), 'resta');
    expect(side().getByText('Una richiesta a ChatGPT · strong, con le sole righe di questo pezzo.')).toBeInTheDocument();
    await user().click(side().getByRole('button', { name: 'Smonta questo pezzo' }));
    expect(expandPart).toHaveBeenCalledWith({ disassemblyId: d.id, revision: 'v1', part: leaf.id, route: { provider: 'chatgpt', model: 'strong' } });
    const crumbs = await screen.findByRole('navigation', { name: 'Livelli dello smontaggio' });
    expect(await within(crumbs).findByText(leaf.name)).toHaveAttribute('aria-current', 'location');
    expect(plate(/^1\. .* 1 · /)).toBeInTheDocument();
    await user().click(within(crumbs).getByRole('button', { name: d.whole.name }));
    await user().click(plate(new RegExp(`^${d.parts.indexOf(leaf) + 1}\\. `)));
    expect(side().getByLabelText(/I tuoi appunti/)).toHaveValue('resta');
    expect(side().getByRole('button', { name: /Apri il sottoassieme · 3 pezzi/ })).toBeInTheDocument();
  });

  it('does not offer the action on a prepared disassembly', async () => {
    const d = await validateDisassembly(fixture(PUBLIC_FIXTURES[4]));
    const leaf = d.parts.find(p => !p.parts && divisible(d, p))!;
    const { bridge } = await desktopWith(d);
    await play(d, bridge);
    await user().click(plate(new RegExp(`^${d.parts.indexOf(leaf) + 1}\\. `)));
    expect(side().queryByRole('button', { name: 'Smonta questo pezzo' })).not.toBeInTheDocument();
    expect(side().queryByText(/non si smonta oltre/)).not.toBeInTheDocument();
  });
});
