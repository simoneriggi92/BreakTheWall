import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Pane sizes the learner can change: the drawing's height, as a share of the window height, and the source's width,
 * as a share of the row below the drawing. The drawing has no size until the learner sets one: it then fits the whole
 * sheet's width. Sizes are a convenience for this device, kept in local storage; anything unreadable falls back to
 * the defaults.
 */
export const PANES = {
  drawing: { initial: 0.5, min: 0.25, max: 0.85 },
  source: { initial: 0.34, min: 0.2, max: 0.7 },
} as const;
export type PaneKey = keyof typeof PANES;
/** `drawing: null` means fit the sheet's width. */
export type PaneSizes = { drawing: number | null; source: number };
/** At or under this width the panes stack, as the stylesheet does, and no splitter is shown. */
export const STACK_BELOW = 960;
const STORAGE_KEY = 'btw:panes:v1';
const STEP = 0.05;

const clamp = (key: PaneKey, value: number) => Math.min(PANES[key].max, Math.max(PANES[key].min, value));
const defaults = (): PaneSizes => ({ drawing: null, source: PANES.source.initial });

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
    const next = { ...s, [key]: key === 'drawing' ? null : PANES[key].initial };
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
  /** The arrow key that makes the sized pane bigger. */
  grows: 'ArrowDown' | 'ArrowLeft';
  onChange: (value: number) => void; onReset: () => void;
  /** The pane's share for a pointer position, measured by the owner of the panes. */
  fromPointer: (x: number, y: number) => number | undefined;
}) {
  const dragging = useRef(false);
  const shrinks = grows === 'ArrowDown' ? 'ArrowUp' : 'ArrowRight';
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
