import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANES, readPaneSizes, Splitter } from '../src/renderer/disassembly/SplitPane';

const KEY = 'btw:panes:v1';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

function Harness() {
  const [value, setValue] = useState<number>(PANES.drawing.initial);
  return <Splitter pane="drawing" orientation="horizontal" grows="ArrowDown" value={value} label="Altezza del disegno"
    onChange={v => setValue(Math.min(PANES.drawing.max, Math.max(PANES.drawing.min, v)))} onReset={() => setValue(PANES.drawing.initial)} fromPointer={() => undefined}/>;
}

describe('resizable panes (D17)', () => {
  it('reads saved sizes, and falls back to the defaults for bad values or failing storage', () => {
    expect(readPaneSizes()).toEqual({ drawing: null, source: 0.34 });
    localStorage.setItem(KEY, JSON.stringify({ drawing: 0.7, source: 0.55 }));
    expect(readPaneSizes()).toEqual({ drawing: 0.7, source: 0.55 });
    localStorage.setItem(KEY, JSON.stringify({ drawing: 3, source: 'wide' }));
    expect(readPaneSizes()).toEqual({ drawing: null, source: 0.34 });
    localStorage.setItem(KEY, '{not json');
    expect(readPaneSizes()).toEqual({ drawing: null, source: 0.34 });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPaneSizes()).toEqual({ drawing: null, source: 0.34 });
  });
  it('is a separator the keyboard moves within its limits, and Enter or a double click resets', async () => {
    render(<Harness/>);
    const bar = screen.getByRole('separator', { name: 'Altezza del disegno' });
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    bar.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    await userEvent.keyboard('{End}{ArrowDown}');
    expect(bar).toHaveAttribute('aria-valuenow', '85');
    await userEvent.keyboard('{Home}{ArrowUp}');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    await userEvent.keyboard('{Enter}');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    await userEvent.keyboard('{End}');
    await userEvent.dblClick(bar);
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });
});
