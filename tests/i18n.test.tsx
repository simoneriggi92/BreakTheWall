import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { detectLanguage } from '../src/core/generation';
import { resolveLanguage } from '../src/core/language';
import { settingsSchema, type StudioSettings } from '../src/core/provider';
import { App } from '../src/renderer/App';
import { en } from '../src/renderer/i18n/en';
import { it as italian } from '../src/renderer/i18n/it';
import { sample } from './sample';

/** Every leaf of a catalog, with its path; functions are called with neutral arguments. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') return [[path, String(value({}, (x: number) => String(x), true) ?? '')]];
  if (Array.isArray(value)) return value.flatMap((x, i) => leaves(x, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}
function bridge(locale: string, settings: Partial<StudioSettings> = {}): DesktopBridge & { saved: StudioSettings[] } {
  let current: StudioSettings = { version: 1, provider: 'chatgpt', ...settings };
  const saved: StudioSettings[] = [];
  return {
    saved,
    getRuntime: async () => ({ platform: 'test', mode: 'desktop', locale }),
    loadProgress: async () => ({ state: null }),
    saveProgress: async () => {},
    studio: {
      pickSources: async () => ({ sources: [], errors: [] }), accountStatus: async () => ({ state: 'signed-out', storage: true }),
      signIn: async () => ({ ok: true, status: { state: 'signed-out', storage: true } }), cancelSignIn: async () => {}, signOut: async () => ({ state: 'signed-out', storage: true }),
      listModels: async () => ({ ok: true, models: [] }), generate: async () => { throw new Error('not used'); }, cancelGeneration: async () => {},
      onGenerationProgress: () => () => {}, listLessons: async () => ({ lessons: [], skipped: 0 }), openUsageSettings: async () => {},
      getSettings: async () => current, saveSettings: vi.fn(async (next: StudioSettings) => { saved.push(next); current = next; return next; }),
      discoverLocal: async () => [], connectLocal: async () => ({ ok: true, server: { runtime: 'ollama', baseUrl: 'http://127.0.0.1:11434', models: [] } }), checkLocalFormat: async () => ({ ok: false, failure: { code: 'unsupported', message: 'x' } }),
    } as unknown as DesktopBridge['studio'],
  };
}
const pageLanguage = () => detectLanguage(document.body.textContent ?? '');

describe('interface catalogs', () => {
  it('have the same keys in English and Italian, and no empty text', () => {
    const it = leaves(italian); const enLeaves = leaves(en);
    expect(enLeaves.map(x => x[0])).toEqual(it.map(x => x[0]));
    expect([...it, ...enLeaves].filter(([, text]) => !text.trim()).map(([path]) => path)).toEqual([]);
  });
  it('resolves the system language from the locale', () => {
    expect(resolveLanguage('system', 'it-IT')).toBe('it');
    expect(resolveLanguage(undefined, 'en-GB')).toBe('en');
    expect(resolveLanguage(undefined, 'de-DE')).toBe('en');
    expect(resolveLanguage('it', 'en-US')).toBe('it');
  });
  it('loads settings files written before themes and languages', () => {
    expect(settingsSchema.parse({ version: 1, provider: 'chatgpt' })).toEqual({ version: 1, provider: 'chatgpt' });
    expect(settingsSchema.parse({ version: 1, provider: 'local', theme: 'blueprint', language: 'en' }).theme).toBe('blueprint');
    expect(settingsSchema.safeParse({ version: 1, provider: 'chatgpt', theme: 'neon' }).success).toBe(false);
  });
});

describe('rendered language', () => {
  it.each([['en-US', 'en'], ['it-IT', 'it']])('library, studio and lesson player read as the interface language (%s)', async (locale, expected) => {
    const prepared = [await sample()];
    render(<App bridge={bridge(locale)} prepared={prepared}/>);
    await waitFor(() => expect(document.documentElement.lang).toBe(expected));
    expect(pageLanguage()).toBe(expected);
    await userEvent.click(screen.getByRole('button', { name: expected === 'en' ? /Create a path/ : /Crea un percorso/ }));
    expect(pageLanguage()).toBe(expected);
    await userEvent.click(screen.getByRole('button', { name: expected === 'en' ? /Back to your library/ : /Torna ai percorsi/ }));
    await userEvent.click(screen.getByRole('button', { name: /Sample/ }));
    await screen.findByRole('heading', { level: 1, name: 'One' });
    expect(pageLanguage()).toBe(expected);
  });
  it('switches language and theme from the header and saves them with the other settings', async () => {
    const host = bridge('it-IT', { provider: 'local' });
    render(<App bridge={host} prepared={[await sample()]}/>);
    await screen.findByText('Cosa vuoi capire oggi?');
    await userEvent.click(screen.getByLabelText('Preferenze'));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Lingua' }), 'en');
    expect(await screen.findByText('What do you want to understand today?')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'blueprint');
    expect(document.documentElement.dataset.theme).toBe('blueprint');
    expect(host.saved.at(-1)).toEqual({ version: 1, provider: 'local', language: 'en', theme: 'blueprint' });
  });
});
