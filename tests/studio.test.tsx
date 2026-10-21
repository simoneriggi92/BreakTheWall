import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge, ProgressKey } from '../src/core/bridge';
import { assembleLesson, buildGenerationInput } from '../src/core/generation';
import { failure, type AccountStatus, type GenerationRequest, type StudioBridge } from '../src/core/provider';
import type { LearnerState } from '../src/core/state';
import { loadPreparedLessons } from '../src/fixtures/lessons';
import { App } from '../src/renderer/App';
import { draftFor, SOURCE_TEXT } from './draft';

const prepared = await loadPreparedLessons();
const goal = 'Spiegare il ciclo dell’acqua';

/** The desktop contract with a scripted account and provider; no tokens ever appear on this side. */
function desktop(options: { generate?: (request: GenerationRequest) => ReturnType<StudioBridge['generate']>; plan?: boolean } = {}) {
  const saved = new Map<string, LearnerState>();
  const key = (k: ProgressKey) => `${k.lessonId}:${k.revision}`;
  let status: AccountStatus = { state: 'signed-out', storage: true };
  const studio: StudioBridge = {
    pickSources: vi.fn(async () => ({ sources: [], errors: [{ name: 'a.pdf', message: '«a.pdf» non è supportato. Per ora puoi importare file .txt e .md.' }] })),
    accountStatus: async () => status,
    signIn: vi.fn(async () => { status = { state: 'signed-in', email: 'learner@example.com', planUsage: options.plan ?? true, storage: true }; return { ok: true as const, status }; }),
    cancelSignIn: async () => {},
    signOut: async () => (status = { state: 'signed-out', storage: true }),
    listModels: async () => ({ ok: true as const, models: [{ slug: 'model-a', name: 'Model A' }] }),
    generate: vi.fn(options.generate ?? (async request => ({ ok: true as const, lesson: await assembleLesson(JSON.stringify(draftFor(request.sources[0].id)), request.sources, request.goal, { id: 'g-new', model: request.model, createdAt: '2026-10-21T17:00:00.000Z' }) }))),
    cancelGeneration: async () => {},
    onGenerationProgress: () => () => {},
    listLessons: async () => ({ lessons: [], skipped: 0 }),
    openUsageSettings: vi.fn(async () => {}),
  };
  const bridge: DesktopBridge = {
    getRuntime: async () => ({ platform: 'test', mode: 'desktop' }),
    loadProgress: async k => ({ state: saved.get(key(k)) ?? null }),
    saveProgress: async s => { saved.set(key(s), structuredClone(s)); },
    studio,
  };
  return { bridge, studio };
}
const studioRegion = () => within(screen.getByRole('region', { name: /Rompi il muro su una tua fonte/ }));

async function prepare(bridge: DesktopBridge) {
  const user = userEvent.setup();
  render(<App bridge={bridge} prepared={prepared}/>);
  const studio = studioRegion();
  await user.click(studio.getByRole('button', { name: /Incolla testo/ }));
  await user.type(studio.getByLabelText('Nome della fonte'), 'Appunti sul ciclo');
  await user.click(studio.getByLabelText('Testo'));
  await user.paste(SOURCE_TEXT + '\r\n\r\n');
  await user.click(studio.getByRole('button', { name: 'Aggiungi fonte' }));
  await user.type(studio.getByLabelText(/cosa vuoi saper spiegare/i), goal);
  return { user, studio };
}

describe('source workspace and generation in the renderer (T4–T6)', () => {
  it('adds a pasted source, previews its numbered lines and shows exactly the request that will be sent', async () => {
    const { bridge, studio: fake } = desktop();
    const { user, studio } = await prepare(bridge);
    const item = studio.getByText('Appunti sul ciclo').closest('details')!;
    expect(within(item).getByText(`7 righe · ${SOURCE_TEXT.length.toLocaleString('it-IT')} caratteri · incollato`)).toBeInTheDocument();
    await user.click(within(item).getByText('Appunti sul ciclo'));
    const preview = within(item).getByLabelText('Anteprima di Appunti sul ciclo');
    expect(preview.querySelectorAll('.source-line')).toHaveLength(7);
    expect(preview.textContent).toContain('4In quota il vapore si raffredda e condensa in nuvole.');
    const sent = studio.getByText(/OBIETTIVO DI APPRENDIMENTO/);
    const source = { ...(await import('../src/core/source').then(m => m.importSource({ kind: 'paste', title: 'Appunti sul ciclo', text: SOURCE_TEXT }))) };
    expect(sent.textContent).toBe(buildGenerationInput([source], { outcome: goal, priorKnowledge: '' }));
    expect(fake.generate).not.toHaveBeenCalled();
  });

  it('shows import errors and keeps invalid input out of the selection', async () => {
    const { bridge } = desktop();
    const user = userEvent.setup();
    render(<App bridge={bridge} prepared={prepared}/>);
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
    expect(studio.getByRole('button', { name: /Genera il percorso/ })).toBeDisabled();
    expect(studio.getByText(/Serve ancora l’accesso a ChatGPT/)).toBeInTheDocument();
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await waitFor(() => expect(studio.getByLabelText('Modello')).toHaveValue('model-a'));
    await user.click(studio.getByRole('button', { name: /Genera il percorso/ }));
    expect(fake.generate).toHaveBeenCalledWith(expect.objectContaining({ model: 'model-a', goal: { outcome: goal, priorKnowledge: '' } }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Gli attori del ciclo' })).toBeInTheDocument();
    expect(screen.getByText('Generato con AI')).toBeInTheDocument();
    expect(screen.getAllByText(/Citazioni verificate sulle tue fonti/)[0]).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Torna ai percorsi' }));
    expect(await screen.findByRole('button', { name: /Il ciclo dell’acqua/ })).toHaveTextContent('model-a');
  });

  it('turns provider failures into a message with the matching recovery, keeping the draft', async () => {
    const { bridge, studio: fake } = desktop({ generate: async () => ({ ok: false, failure: failure('usage-limit') }) });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await waitFor(() => expect(studio.getByRole('button', { name: /Genera il percorso/ })).toBeEnabled());
    await user.click(studio.getByRole('button', { name: /Genera il percorso/ }));
    const alert = await studio.findByRole('alert');
    expect(alert).toHaveTextContent('limite di utilizzo');
    await user.click(within(alert).getByRole('button', { name: /Apri le impostazioni di ChatGPT/ }));
    expect(fake.openUsageSettings).toHaveBeenCalled();
    expect(studio.getByText('Appunti sul ciclo')).toBeInTheDocument();
  });

  it('offers to enable plan usage when sign-in did not grant it', async () => {
    const { bridge, studio: fake } = desktop({ plan: false });
    const { user, studio } = await prepare(bridge);
    await user.click(studio.getByRole('button', { name: /Accedi con ChatGPT/ }));
    await user.click(await studio.findByRole('button', { name: /Abilita l’uso del piano ChatGPT/ }));
    expect(fake.signIn).toHaveBeenLastCalledWith({ consent: true });
  });

  it('keeps generation desktop-only in the browser preview', async () => {
    const { bridge } = desktop();
    const { studio: _ignored, ...browser } = bridge;
    render(<App bridge={browser} prepared={prepared}/>);
    expect(studioRegion().getByText(/Accesso e generazione sono disponibili nell’app desktop/)).toBeInTheDocument();
    expect(studioRegion().getByRole('button', { name: /Scegli file/ })).toBeDisabled();
  });
});
