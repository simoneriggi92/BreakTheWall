import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopBridge } from '../src/core/bridge';
import type { Disassembly } from '../src/core/disassembly';
import { faceOf } from '../src/core/faces';
import { chooseRepresentation } from '../src/core/representation';
import { PreferencesProvider } from '../src/renderer/preferences';
import { AtlasDrawing } from '../src/renderer/lab/Atlas';
import { BenchDrawing } from '../src/renderer/lab/Bench';
import { OpenedBench, OpenedRegion, type FacePick } from '../src/renderer/lab/Opened';
import { atlas, fixture, mill } from './disassemblies';

const bridge: DesktopBridge = {
  getRuntime: async () => ({ platform: 'test', mode: 'browser', locale: 'it-IT' }),
  loadProgress: async () => ({ state: null }),
  saveProgress: async () => {},
};
const wrap = (ui: React.ReactNode) => render(<PreferencesProvider bridge={bridge}>{ui}</PreferencesProvider>);
const importer = (): Disassembly => fixture('src/fixtures/disassemblies/importer-signals.json');
const towards = () => ({ side: 'right' as const, angle: 0 });

describe('the bench (L5)', () => {
  it('draws the importer’s seven parts as named components, its eight joints as labelled cables, five stations and three lights', () => {
    const d = importer(), { container } = wrap(<BenchDrawing d={d} choice={chooseRepresentation(d)}/>);
    const bench = screen.getByRole('group', { name: /Il banco di/ });
    for (const p of d.parts) expect(within(bench).getByRole('button', { name: new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toBeTruthy();
    expect(container.querySelectorAll('.lab-cable')).toHaveLength(8);
    for (const j of d.joints) expect(within(bench).getAllByText(j.label).length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-component="round-track"] [data-station]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-component="control-panel"] [data-light]')).toHaveLength(3);
    // the panel's lights are named by the joints that reach it
    expect(within(container.querySelector('[data-component="control-panel"]') as HTMLElement).getByText('luce Gira')).toBeTruthy();
  });
  it('names each part’s component in its label, pins its clarifications, and tells the press', async () => {
    const d = importer(), onSelect = vi.fn();
    wrap(<BenchDrawing d={d} choice={chooseRepresentation(d)} onSelect={onSelect}/>);
    const round = screen.getByRole('button', { name: /^Il giro · passo · giostra a stazioni/ });
    await userEvent.click(round);
    expect(onSelect).toHaveBeenCalledWith('round');
    // every clarification the source gives a part is an annotation on it, counted in its label
    const caveated = d.parts.filter(p => p.points?.some(x => x.mark === 'caveat'));
    expect(caveated.length).toBeGreaterThan(0);
    for (const p of caveated) {
      const n = p.points!.filter(x => x.mark === 'caveat').length;
      expect(screen.getByRole('button', { name: new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} .*${n === 1 ? '1 precisazione' : `${n} precisazioni`}$`) })).toBeTruthy();
    }
  });
  it('outlines a part not yet built, draws a joint only once shown, and outlines the place of an opened part', () => {
    const d = importer(), toBoard = (i: number) => [d.joints[i].from, d.joints[i].to].includes('board'), boards = d.joints.filter((_, i) => toBoard(i)).length;
    const { container } = wrap(<BenchDrawing d={d} choice={chooseRepresentation(d)} built={id => id !== 'board'} jointShown={i => !toBoard(i)} open="round"/>);
    expect(container.querySelector('.lab-ghost[data-id="board"][data-unread]')).toBeTruthy();
    expect(container.querySelector('.lab-socket[data-id="round"]')).toBeTruthy();
    expect(boards).toBeGreaterThan(0);
    expect(container.querySelectorAll('.lab-cable[data-joint*="board"]')).toHaveLength(0);
    expect(container.querySelectorAll('.lab-cable[data-joint^="round>"]')).toHaveLength(0);
    // a joint the reading has related reaches a part still outlined: it lands on its footprint
    const shown = wrap(<BenchDrawing d={d} choice={chooseRepresentation(d)} built={id => id !== 'board'}/>);
    expect(shown.container.querySelectorAll('.lab-cable[data-joint*="board"]')).toHaveLength(boards);
  });
});

describe('the atlas (L6)', () => {
  it('draws Mill’s seven regions, six sub-regions inside two of them, and five labelled arrows', () => {
    const d = mill(), { container } = wrap(<AtlasDrawing d={d}/>);
    const map = screen.getByRole('group', { name: /L’atlante di/ });
    expect(container.querySelectorAll('.lab-region[data-id]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-kid]')).toHaveLength(6);
    expect(container.querySelectorAll('.lab-arrow')).toHaveLength(5);
    for (const j of d.joints) expect(within(map).getAllByText(j.label).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Il diritto astratto · scartato · nessun legame esplicito/ })).toBeTruthy();
  });
});

describe('opened levels (L7)', () => {
  it('opens the release chain’s parts into components with faces from their lines, and plain modules where there are none', () => {
    const d = atlas() as Disassembly;
    for (const p of d.parts.filter(x => x.parts)) {
      const { container, unmount } = wrap(<OpenedBench d={d} part={p} towards={towards}/>);
      for (const q of p.parts!) expect(container.querySelector(`[data-id="${q.id}"]`)!.getAttribute('data-face-kind')).toBe(faceOf(d, q)?.face ?? 'none');
      unmount();
    }
  });
  it('opens Mill’s two regions into three sub-regions each', () => {
    const d = mill() as Disassembly;
    for (const id of ['bounds', 'region']) {
      const p = d.parts.find(x => x.id === id)!, { container, unmount } = wrap(<OpenedRegion d={d} part={p} towards={towards}/>);
      expect(container.querySelectorAll('.lab-region[data-id]')).toHaveLength(3);
      unmount();
    }
  });
  it('hands over the lines of a face element when it is pressed', async () => {
    const text = ['### Registers', '| Name | Value |', '|---|---|', '| `Switch` | bool |', '| Cursor | UpdatedAt |', '', '### Gauges', '| Gauge | Source |', '|---|---|', '| a.b | x |', '| c.d | y |'].join('\n');
    const d = {
      ...importer(), sources: [{ ...importer().sources[0], id: 's', text }],
      parts: [{ id: 'core', name: 'Core', kind: 'component', icon: 'database', role: 'r', cites: [{ source: 's', from: 1, to: 11 }],
        parts: [{ id: 'reg', name: 'Registers', kind: 'component', icon: 'database', role: 'r', cites: [{ source: 's', from: 1, to: 5 }] },
          { id: 'gau', name: 'Gauges', kind: 'component', icon: 'gauge', role: 'r', cites: [{ source: 's', from: 7, to: 11 }] }] }],
      joints: [],
    } as unknown as Disassembly;
    const onFace = vi.fn<(p: FacePick) => void>();
    wrap(<OpenedBench d={d} part={d.parts[0]} towards={towards} onFace={onFace}/>);
    await userEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(onFace).toHaveBeenCalledTimes(1);
    expect(onFace.mock.calls[0][0]).toMatchObject({ part: 'reg', index: 1, item: { source: 's', from: 5, to: 5, label: 'Cursor' } });
    expect(screen.getByRole('button', { name: 'a.b' })).toBeTruthy();
  });
});
