import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANES, readPaneSizes, Splitter } from '../src/renderer/disassembly/SplitPane';

const KEY = 'btw:panes:v1';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

function Harness() {
  const [value, setValue] = useState<number>(PANES.source.initial);
  return <Splitter pane="source" orientation="vertical" grows="ArrowLeft" value={value} label="Larghezza della fonte"
    onChange={v => setValue(Math.min(PANES.source.max, Math.max(PANES.source.min, v)))} onReset={() => setValue(PANES.source.initial)} fromPointer={() => undefined}/>;
}

describe('resizable panes (D17)', () => {
  it('reads saved sizes, and falls back to the defaults for bad values or failing storage', () => {
    expect(readPaneSizes()).toEqual({ source: 0.34 });
    // A drawing height saved by an earlier version is ignored: the drawing now fits its area (P-20261029-ui-workbench).
    localStorage.setItem(KEY, JSON.stringify({ drawing: 0.7, source: 0.55 }));
    expect(readPaneSizes()).toEqual({ source: 0.55 });
    localStorage.setItem(KEY, JSON.stringify({ source: 'wide' }));
    expect(readPaneSizes()).toEqual({ source: 0.34 });
    localStorage.setItem(KEY, '{not json');
    expect(readPaneSizes()).toEqual({ source: 0.34 });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPaneSizes()).toEqual({ source: 0.34 });
  });
  it('is a separator the keyboard moves within its limits, and Enter or a double click resets', async () => {
    render(<Harness/>);
    const bar = screen.getByRole('separator', { name: 'Larghezza della fonte' });
    expect(bar).toHaveAttribute('aria-orientation', 'vertical');
    expect(bar).toHaveAttribute('aria-valuenow', '34');
    bar.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(bar).toHaveAttribute('aria-valuenow', '44');
    await userEvent.keyboard('{End}{ArrowLeft}');
    expect(bar).toHaveAttribute('aria-valuenow', '70');
    await userEvent.keyboard('{Home}{ArrowRight}');
    expect(bar).toHaveAttribute('aria-valuenow', '20');
    await userEvent.keyboard('{Enter}');
    expect(bar).toHaveAttribute('aria-valuenow', '34');
    await userEvent.keyboard('{End}');
    await userEvent.dblClick(bar);
    expect(bar).toHaveAttribute('aria-valuenow', '34');
  });
});
