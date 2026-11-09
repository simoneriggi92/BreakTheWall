import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { loadPreparedExplorations } from '../src/fixtures/explorations';
import { App } from '../src/renderer/App';

const bridge: DesktopBridge = { getRuntime: async () => ({ platform: 'test', mode: 'browser', locale: 'it-IT' }), loadProgress: async () => ({ state: null }), saveProgress: async () => {} };

describe('a source opens as an exploration (X18)', () => {
  it('lists the prepared explorations first and opens one from the library', async () => {
    const explorations = await loadPreparedExplorations(), disassemblies = await loadPreparedDisassemblies();
    render(<App bridge={bridge} prepared={[]} disassemblies={disassemblies} explorations={explorations}/>);
    const section = within(await screen.findByRole('region', { name: 'Esplorazioni' }));
    expect(section.getAllByText('Esplorazione preparata')).toHaveLength(3);
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(headings.indexOf('Esplorazioni')).toBeLessThan(headings.indexOf('Smontaggi'));
    await userEvent.click(section.getByRole('button', { name: /Importer di Larkspur/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Importer di Larkspur: riconoscere una notte silenziosa' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Scheda' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Torna alla libreria' }));
    expect(await screen.findByRole('region', { name: 'Esplorazioni' })).toBeInTheDocument();
  });

  it('still opens an old disassembly in its player', async () => {
    const disassemblies = await loadPreparedDisassemblies();
    render(<App bridge={bridge} prepared={[]} disassemblies={disassemblies} explorations={await loadPreparedExplorations()}/>);
    const section = within(await screen.findByRole('region', { name: 'Smontaggi' }));
    await userEvent.click(section.getAllByRole('button')[0]);
    expect(await screen.findByRole('group', { name: /Cosa fare con lo smontaggio/ })).toBeInTheDocument();
  });
});

describe('no "take apart" channel remains (X19)', () => {
  it('names no disassembly:expand channel, no expandPart and no expansion request anywhere in the app', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const files = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
    const hits = files('src').filter(f => /disassembly:expand|expandPart|acceptExpansion|buildExpansionInput/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
