import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge, ProgressKey } from '../src/core/bridge';
import { assembleLesson, buildGenerationInput } from '../src/core/generation';
import { defaultSettings, failure, type AccountStatus, type GenerationProgress, type GenerationRequest, type LocalServer, type StudioBridge, type StudioSettings } from '../src/core/provider';
import type { LearnerState } from '../src/core/state';
import { loadPreparedLessons } from '../src/fixtures/lessons';
import { App } from '../src/renderer/App';
import { draftFor, SOURCE_TEXT } from './draft';

const prepared = await loadPreparedLessons();
const goal = 'Spiegare il ciclo dell’acqua';

/** The desktop contract with a scripted account and provider; no tokens ever appear on this side. */
function desktop(options: { generate?: (request: GenerationRequest) => ReturnType<StudioBridge['generate']>; plan?: boolean; servers?: LocalServer[]; settings?: StudioSettings } = {}) {
  const saved = new Map<string, LearnerState>();
  const key = (k: ProgressKey) => `${'lessonId' in k ? k.lessonId : k.disassemblyId}:${k.revision}`;
  let status: AccountStatus = { state: 'signed-out', storage: true };
  let settings: StudioSettings = options.settings ?? defaultSettings;
  const listeners: ((progress: GenerationProgress) => void)[] = [];
  const studio: StudioBridge = {
    pickSources: vi.fn(async () => ({ sources: [], errors: [{ name: 'a.pdf', message: '«a.pdf» non è supportato. Per ora puoi importare file .txt e .md.' }] })),
    accountStatus: async () => status,
    signIn: vi.fn(async () => { status = { state: 'signed-in', email: 'learner@example.com', planUsage: options.plan ?? true, storage: true }; return { ok: true as const, status }; }),
    cancelSignIn: async () => {},
    signOut: async () => (status = { state: 'signed-out', storage: true }),
    listModels: async () => ({ ok: true as const, models: [{ slug: 'model-a', name: 'Model A' }] }),
    generate: vi.fn(options.generate ?? (async request => ({ ok: true as const, lesson: await assembleLesson(JSON.stringify(draftFor(request.sources[0].id)), request.sources, request.goal, { id: 'g-new', model: request.route.model, createdAt: '2026-10-21T17:00:00.000Z', provider: request.route.provider, ...(request.route.provider === 'local' ? { runtime: request.route.runtime } : {}) }) }))),
    cancelGeneration: async () => {},
    onGenerationProgress: listener => { listeners.push(listener); return () => {}; },
    listLessons: async () => ({ lessons: [], skipped: 0 }),
    openUsageSettings: vi.fn(async () => {}),
    getSettings: async () => settings,
    saveSettings: vi.fn(async next => (settings = next)),
    discoverLocal: vi.fn(async () => options.servers ?? []),
    connectLocal: vi.fn(async address => address.includes('8092') ? { ok: true as const, server: { runtime: 'llamacpp' as const, baseUrl: 'http://127.0.0.1:8092', models: ['qwen3.6-35b-a3b.gguf'] } } : { ok: false as const, failure: failure('local-address') }),
    checkLocalFormat: vi.fn(async model => ({ ok: true as const, check: { enforced: model.runtime !== 'ollama', detail: model.runtime === 'ollama' ? 'Il server ha ignorato lo schema di prova.' : 'Il server ha rispettato lo schema di prova.', checkedAt: '2026-10-22T10:00:00.000Z' } })),
  };
  const bridge: DesktopBridge = {
    getRuntime: async () => ({ platform: 'test', mode: 'desktop' }),
    loadProgress: async k => ({ state: saved.get(key(k)) ?? null }),
    saveProgress: async s => { saved.set(key(s), structuredClone(s) as LearnerState); },
    studio,
  };
  return { bridge, studio, emit: (progress: GenerationProgress) => listeners.forEach(l => l(progress)) };
}
const studioRegion = () => within(screen.getByRole('region', { name: /Rompi il muro su una tua fonte/ }));

async function prepare(bridge: DesktopBridge) {
  const user = userEvent.setup();
  render(<App bridge={bridge} prepared={prepared}/>);
  await user.click(screen.getByRole('button', { name: 'Crea un percorso' }));
  const studio = studioRegion();
  await user.click(studio.getByRole('button', { name: /Incolla testo/ }));
  await user.type(studio.getByLabelText('Nome della fonte'), 'Appunti sul ciclo');
  await user.click(studio.getByLabelText('Testo'));
  await user.paste(SOURCE_TEXT + '\r\n\r\n');
  await user.click(studio.getByRole('button', { name: 'Aggiungi fonte' }));
  await user.click(studio.getByRole('button', { name: 'Continua con l’obiettivo' }));
  await user.type(studio.getByLabelText(/cosa vuoi saper spiegare/i), goal);
  return { user, studio };
}

describe('source workspace and generation in the renderer (T4–T6)', () => {
  it('adds a pasted source, previews its numbered lines and shows exactly the request that will be sent', async () => {
    const { bridge, studio: fake } = desktop();
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Materiale' }));
    const item = studio.getByText('Appunti sul ciclo').closest('details')!;
    expect(within(item).getByText(`7 righe · ${SOURCE_TEXT.length.toLocaleString('it-IT')} caratteri · incollato`)).toBeInTheDocument();
    await user.click(within(item).getByText('Appunti sul ciclo'));
    const preview = within(item).getByLabelText('Anteprima di Appunti sul ciclo');
    expect(preview.querySelectorAll('.source-line')).toHaveLength(7);
    expect(preview.textContent).toContain('4In quota il vapore si raffredda e condensa in nuvole.');
    await user.click(studio.getByRole('button', { name: 'Continua con l’obiettivo' }));
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(studio.getByText('Cosa verrà inviato'));
    const sent = studio.getByText(/OBIETTIVO DI APPRENDIMENTO/);
    const source = { ...(await import('../src/core/source').then(m => m.importSource({ kind: 'paste', title: 'Appunti sul ciclo', text: SOURCE_TEXT }))) };
    expect(sent.textContent).toBe(buildGenerationInput([source], { outcome: goal, priorKnowledge: '' }));
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('shows import errors and keeps invalid input out of the selection', async () => {
    const { bridge } = desktop();
    const user = userEvent.setup();
    render(<App bridge={bridge} prepared={prepared}/>);
    await user.click(screen.getByRole('button', { name: 'Crea un percorso' }));
    const studio = studioRegion();
    await user.click(studio.getByRole('button', { name: /Incolla testo/ }));
    await user.type(studio.getByLabelText('Nome della fonte'), 'Vuota');
    await user.type(studio.getByLabelText('Testo'), '   ');
    await user.click(studio.getByRole('button', { name: 'Aggiungi fonte' }));
    expect(studio.getByRole('alert')).toHaveTextContent('La fonte è vuota.');
    await user.click(studio.getByRole('button', { name: /Scegli file/ }));
    expect(await studio.findByText(/a\.pdf.*non è supportato/)).toBeInTheDocument();
    expect(studio.getByText('0/4 fonti · 0 / 60.000 caratteri')).toBeInTheDocument();
  });

  it('needs sign-in before generating, then opens the validated lesson labelled as AI-generated', async () => {
    const { bridge, studio: fake } = desktop();
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    expect(studio.getByRole('button', { name: /Genera il percorso/ })).toBeDisabled();
    expect(studio.getByText(/Serve ancora l’accesso a ChatGPT/)).toBeInTheDocument();
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await waitFor(() => expect(studio.getByLabelText('Modello')).toHaveValue('model-a'));
    await user.click(studio.getByRole('button', { name: /Genera il percorso/ }));
    expect(fake.generate).toHaveBeenCalledWith(expect.objectContaining({ route: { provider: 'chatgpt', model: 'model-a' }, goal: { outcome: goal, priorKnowledge: '' } }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Gli attori del ciclo' })).toBeInTheDocument();
    expect(screen.getByText('Generato con AI')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Strumenti' }));
    expect(screen.getByText(/Citazioni verificate sulle tue fonti/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chiudi strumenti' }));
    await user.click(screen.getByRole('button', { name: 'Torna ai percorsi' }));
    expect(await screen.findByRole('region', { name: 'Percorsi precedenti' })).toHaveTextContent('Il ciclo dell’acqua');
  });

  it('turns provider failures into a message with the matching recovery, keeping the draft', async () => {
    const { bridge, studio: fake } = desktop({ generate: async () => ({ ok: false, failure: failure('usage-limit') }) });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await waitFor(() => expect(studio.getByRole('button', { name: /Genera il percorso/ })).toBeEnabled());
    await user.click(studio.getByRole('button', { name: /Genera il percorso/ }));
    const alert = await studio.findByRole('alert');
    expect(alert).toHaveTextContent('limite di utilizzo');
    await user.click(within(alert).getByRole('button', { name: /Apri le impostazioni di ChatGPT/ }));
    expect(fake.openUsageSettings).toHaveBeenCalled();
    await user.click(studio.getByRole('button', { name: 'Modifica l’obiettivo' }));
    expect(studio.getByLabelText(/cosa vuoi saper spiegare/i)).toHaveValue(goal);
    await user.click(studio.getByRole('button', { name: 'Materiale' }));
    expect(studio.getByText('Appunti sul ciclo')).toBeInTheDocument();
  });

  it('offers to enable plan usage when sign-in did not grant it', async () => {
    const { bridge, studio: fake } = desktop({ plan: false });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await user.click(await studio.findByRole('button', { name: /Abilita l’uso del piano ChatGPT/ }));
    expect(fake.signIn).toHaveBeenLastCalledWith({ consent: true });
  });

  it('keeps generation desktop-only in the browser preview', async () => {
    const { bridge } = desktop();
    const { studio: _ignored, ...browser } = bridge;
    const { user, studio } = await prepare(browser);
    await user.click(studio.getByRole('button', { name: 'Materiale' }));
    expect(studioRegion().getByRole('button', { name: /Scegli file/ })).toBeDisabled();
    await user.click(studio.getByRole('button', { name: 'Continua con l’obiettivo' }));
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    expect(studioRegion().getByText(/Accesso e generazione sono disponibili nell’app desktop/)).toBeInTheDocument();
  });

  it('keeps creation out of the home, blocks empty steps, and retains an added source and goal in the session draft', async () => {
    const { bridge, studio: fake } = desktop();
    const { user, studio } = await prepare(bridge);
    expect(studio.queryByRole('button', { name: 'Genera il percorso' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Torna ai percorsi' }));
    expect(screen.queryByRole('region', { name: /Rompi il muro/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continua la bozza' }));
    expect(studioRegion().getByText('Appunti sul ciclo')).toBeInTheDocument();
    await user.click(studioRegion().getByRole('button', { name: 'Continua con l’obiettivo' }));
    expect(studioRegion().getByLabelText(/cosa vuoi saper spiegare/i)).toHaveValue(goal);
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('finds model servers on this Mac, checks the format and generates locally without an account', async () => {
    const servers: LocalServer[] = [
      { runtime: 'ollama', baseUrl: 'http://127.0.0.1:11434', version: '0.30.8', models: ['qwen3.6:35b'] },
      { runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', models: ['qwen3.6-35b-a3b.gguf'] },
    ];
    const { bridge, studio: fake } = desktop({ servers });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(await studio.findByRole('button', { name: /Modello locale/ }));
    expect(fake.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'local' }));
    const llama = (await studio.findByText('llama.cpp server')).closest('li')!;
    expect(studio.getByText('Ollama')).toBeInTheDocument();
    expect(studio.getByText(/Serve ancora un modello locale/)).toBeInTheDocument();
    await user.click(within(llama).getByRole('button', { name: 'Usa questo' }));
    expect(fake.checkLocalFormat).toHaveBeenCalledWith({ runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen3.6-35b-a3b.gguf' });
    expect(await studio.findByText('Formato garantito')).toBeInTheDocument();
    await user.click(studio.getByText('Cosa verrà inviato'));
    expect(studio.getByText(/llama\.cpp server su questo Mac \(http:\/\/127\.0\.0\.1:8080\)\. La fonte non lascia il computer/)).toBeInTheDocument();
    await user.click(studio.getByRole('button', { name: /Genera il percorso/ }));
    expect(fake.generate).toHaveBeenCalledWith(expect.objectContaining({ route: { provider: 'local', runtime: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'qwen3.6-35b-a3b.gguf' } }));
    expect(fake.signIn).not.toHaveBeenCalled();
    expect(await screen.findByText('Generato in locale')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Strumenti' }));
    expect(screen.getByText(/Modello locale · qwen3\.6-35b-a3b\.gguf/)).toBeInTheDocument();
  });

  it('warns when a local server ignores the lesson format', async () => {
    const { bridge } = desktop({ servers: [{ runtime: 'ollama', baseUrl: 'http://127.0.0.1:11434', models: ['qwen3.6:35b'] }] });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(await studio.findByRole('button', { name: /Modello locale/ }));
    await user.click(await studio.findByRole('button', { name: 'Usa questo' }));
    expect(await studio.findByText('Formato non garantito')).toBeInTheDocument();
    expect(studio.getByText(/ignorato lo schema di prova/)).toBeInTheDocument();
  });

  it('guides setup when nothing is running and accepts only addresses on this Mac', async () => {
    const { bridge, studio: fake } = desktop();
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(await studio.findByRole('button', { name: /Modello locale/ }));
    expect(await studio.findByText(/Non ho trovato server di modelli avviati/)).toBeInTheDocument();
    await user.type(studio.getByLabelText('Altro indirizzo su questo Mac'), '192.168.1.20:8080');
    await user.click(studio.getByRole('button', { name: 'Collega' }));
    expect(await studio.findByRole('alert')).toHaveTextContent('deve rispondere su questo Mac');
    await user.clear(studio.getByLabelText('Altro indirizzo su questo Mac'));
    await user.type(studio.getByLabelText('Altro indirizzo su questo Mac'), 'localhost:8092');
    await user.click(studio.getByRole('button', { name: 'Collega' }));
    expect(fake.connectLocal).toHaveBeenLastCalledWith('localhost:8092');
    expect(await studio.findByText('qwen3.6-35b-a3b.gguf')).toBeInTheDocument();
  });

  it('remembers the local choice for the next lesson', async () => {
    const settings = { version: 1 as const, provider: 'local' as const, local: { runtime: 'llamacpp' as const, baseUrl: 'http://127.0.0.1:8080', model: 'qwen3.6-35b-a3b.gguf', check: { enforced: true, detail: 'Il server ha rispettato lo schema di prova.', checkedAt: '2026-10-22T10:00:00.000Z' } } };
    const { bridge, studio: fake } = desktop({ settings });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    expect(await studio.findByText('qwen3.6-35b-a3b.gguf')).toBeInTheDocument();
    expect(studio.getByText('Formato garantito')).toBeInTheDocument();
    expect(studio.getByRole('button', { name: /Genera il percorso/ })).toBeEnabled();
    expect(fake.discoverLocal).not.toHaveBeenCalled();
  });

  it('shows an estimated percentage and phase while the model writes, for any route', async () => {
    let finish!: () => void;
    const settings = { version: 1 as const, provider: 'local' as const, local: { runtime: 'llamacpp' as const, baseUrl: 'http://127.0.0.1:8080', model: 'qwen.gguf', check: { enforced: true, detail: 'ok', checkedAt: '2026-10-22T10:00:00.000Z' } } };
    const { bridge, emit } = desktop({ settings, generate: () => new Promise(resolve => { finish = () => resolve({ ok: false, failure: failure('cancelled') }); }) });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: 'Continua alla generazione' }));
    await user.click(await studio.findByRole('button', { name: /Genera il percorso/ }));
    expect(studio.getByText(/il modello sta leggendo le fonti/)).toBeInTheDocument();
    act(() => emit({ received: 15_000, phase: 'generating' }));
    const bar = studio.getByRole('progressbar', { name: 'Avanzamento stimato della generazione' });
    expect(Number(bar.getAttribute('value'))).toBeGreaterThan(8);
    expect(studio.getByText(/15\.000 caratteri ricevuti/)).toBeInTheDocument();
    act(() => emit({ received: 0, phase: 'repairing' }));
    expect(studio.getByText(/Seconda passata/)).toBeInTheDocument();
    act(() => finish());
    expect(await studio.findByText(/Generazione annullata/)).toBeInTheDocument();
  });
});
