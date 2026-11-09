import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Pane sizes the learner can change, kept per device in local storage; anything unreadable falls back to the defaults:
 * - `source`: the reading column's width in the exploded view and the bill of materials, as a share of the row;
 * - `activity`: the same column in a run, wider by default, because there the learner answers rather than reads;
 * - `reading`: the explanation's share of the column's height, with the source below it;
 * - `xCard`, `xIndex`, `xSource`: in the exploration (P-20261105-exploration X23), the card's share of the structure
 *   column's height, and the index's and the source's share of the row's width.
 * The drawing keeps no size: it fits its area, and zoom is a scale over that fit for the session
 * (P-20261029-ui-workbench). A drawing height saved by an earlier version is ignored.
 */
export const PANES = {
  source: { initial: 0.34, min: 0.2, max: 0.7 },
  activity: { initial: 0.5, min: 0.3, max: 0.7 },
  reading: { initial: 0.55, min: 0.25, max: 0.8 },
  xCard: { initial: 0.3, min: 0.15, max: 0.7 },
  xIndex: { initial: 0.2, min: 0.14, max: 0.34 },
  xSource: { initial: 0.34, min: 0.24, max: 0.55 },
} as const;
export type PaneKey = keyof typeof PANES;
export type PaneSizes = Record<PaneKey, number>;
/** At or under this width the panes stack, as the stylesheet does, and no splitter is shown. */
export const STACK_BELOW = 960;
const STORAGE_KEY = 'btw:panes:v1';
const STEP = 0.05;

const clamp = (key: PaneKey, value: number) => Math.min(PANES[key].max, Math.max(PANES[key].min, value));
const defaults = (): PaneSizes => Object.fromEntries((Object.keys(PANES) as PaneKey[]).map(k => [k, PANES[k].initial])) as PaneSizes;

export function readPaneSizes(): PaneSizes {
  const out = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Record<PaneKey, unknown>>;
    for (const key of Object.keys(PANES) as PaneKey[]) {
      const value = saved[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= PANES[key].min && value <= PANES[key].max) out[key] = value;
    }
  } catch { /* storage unavailable or unreadable: the defaults apply */ }
  return out;
}
function writePaneSizes(sizes: PaneSizes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes)); } catch { /* not saved; the session keeps working */ }
}

const isWide = () => typeof window === 'undefined' || window.innerWidth > STACK_BELOW;
export function usePaneSizes() {
  const [sizes, setSizes] = useState(readPaneSizes);
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    const onResize = () => setWide(isWide());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const set = useCallback((key: PaneKey, value: number) => setSizes(s => {
    const next = { ...s, [key]: clamp(key, value) };
    writePaneSizes(next);
    return next;
  }), []);
  const reset = useCallback((key: PaneKey) => setSizes(s => {
    const next = { ...s, [key]: PANES[key].initial };
    writePaneSizes(next);
    return next;
  }), []);
  return { sizes, wide, set, reset };
}

/**
 * A splitter between two panes, for the mouse and the keyboard. `horizontal` lies between a pane above and one below
 * (the arrow keys ↑ ↓ move it); `vertical` lies between two panes side by side (← →). Its value is the share of the
 * pane it sizes; `grows` names the arrow that makes that pane bigger.
 */
export function Splitter({ pane, orientation, value, label, grows, onChange, onReset, fromPointer }: {
  pane: PaneKey; orientation: 'horizontal' | 'vertical'; value: number; label: string;
  /** The arrow key that makes the sized pane bigger; the opposite arrow makes it smaller. */
  grows: 'ArrowDown' | 'ArrowLeft' | 'ArrowUp' | 'ArrowRight';
  onChange: (value: number) => void; onReset: () => void;
  /** The pane's share for a pointer position, measured by the owner of the panes. */
  fromPointer: (x: number, y: number) => number | undefined;
}) {
  const dragging = useRef(false);
  const shrinks = ({ ArrowDown: 'ArrowUp', ArrowUp: 'ArrowDown', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' } as const)[grows];
  const { min, max } = PANES[pane];
  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = e.key === grows ? value + STEP : e.key === shrinks ? value - STEP : e.key === 'Home' ? min : e.key === 'End' ? max : undefined;
    if (e.key === 'Enter') { e.preventDefault(); onReset(); return; }
    if (next === undefined) return;
    e.preventDefault(); onChange(next);
  };
  const move = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const next = fromPointer(e.clientX, e.clientY);
    if (next !== undefined) onChange(next);
  };
  return <div className={`splitter splitter-${orientation}`} role="separator" tabIndex={0} aria-orientation={orientation} aria-label={label}
    aria-valuemin={Math.round(min * 100)} aria-valuemax={Math.round(max * 100)} aria-valuenow={Math.round(value * 100)}
    onKeyDown={onKeyDown} onDoubleClick={onReset}
    onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); e.preventDefault(); }}
    onPointerMove={move}
    onPointerUp={e => { dragging.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
    onPointerCancel={() => { dragging.current = false; }}>
    <span aria-hidden="true"/>
  </div>;
}
