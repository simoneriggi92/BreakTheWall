import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { Disassembly } from '../../core/disassembly';
import { trayOrder, type DisassemblyState } from '../../core/disassembly-state';
import type { LevelLayout, Rect } from '../../core/layout';
import { usePreferences } from '../preferences';
import { JointPath, PartIcon, wrap } from './Sheet';

/** Where each slot is drawn: the plate of the part it stands for, so the drawing keeps its shape but loses its names. */
function slotRects(d: Disassembly, layout: LevelLayout): Map<string, Rect> {
  const plates = new Map(layout.plates.map(p => [p.id, p.rect]));
  const used = new Map<string, number>();
  return new Map(d.reassemble.slots.map(slot => {
    const accepts = [slot.accepts].flat();
    const key = accepts.join(',');
    const index = used.get(key) ?? 0; used.set(key, index + 1);
    return [slot.id, plates.get(accepts[index] ?? accepts[0])!];
  }));
}

interface Props {
  d: Disassembly; layout: LevelLayout; state: DisassemblyState;
  place: (slot: string, part: string | undefined) => void; check: () => void; clear: () => void;
  feedback?: { wrong?: { part: string; hint: string }; complete: boolean }; workbench?: boolean;
}
/** Optional proof: put the parts back on the blank drawing. Item numbers are hidden and the tray never starts solved. */
export function Reassemble({ d, layout, state, place, check, clear, feedback, workbench = false }: Props) {
  const { t } = usePreferences();
  const [held, setHeld] = useState<string>();
  const rects = slotRects(d, layout);
  const { placements, locked } = state.reassembly;
  const placed = new Set(Object.values(placements));
  const tray = trayOrder(d).filter(id => !placed.has(id));
  const name = (id: string) => d.parts.find(p => p.id === id)?.name ?? id;
  const width = Math.max(layout.width, 560);
  const drop = (slot: string, part: string | undefined) => { place(slot, part); setHeld(undefined); };
  const activate = (slot: string) => {
    if (locked.includes(slot)) return;
    if (held) drop(slot, held);
    else if (placements[slot]) drop(slot, undefined);
  };
  const heading = <div className="reassemble-head"><span className="pill">{t.d.reassemble.optional}</span><h2 lang={d.language}>{d.reassemble.title}</h2><p lang={d.language}>{d.reassemble.instruction}</p></div>;
  const diagram = <div className="sheet-scroll"><svg className="sheet reassembly-sheet" viewBox={`0 0 ${width} ${layout.height}`} role="group" aria-label={d.reassemble.title} style={{ minWidth: `${Math.round(width * 0.7)}px`, maxWidth: `${Math.round(width * 1.15)}px` }}>
      <rect className="frame" x={8} y={8} width={width - 16} height={layout.height - 16}/>
      {layout.joints.map((j, i) => <JointPath key={i} joint={{ type: d.joints[i].type, label: '' }} points={j.points} muted/>)}
      {d.reassemble.slots.map(slot => {
        const rect = rects.get(slot.id)!; const part = placements[slot.id]; const isLocked = locked.includes(slot.id);
        const lines = part ? wrap(name(part), 17) : [];
        return <g key={slot.id} className={`slot${part ? ' filled' : ''}${isLocked ? ' state-ok' : ''}${feedback?.wrong && placements[slot.id] === feedback.wrong.part ? ' state-failed' : ''}`}
          transform={`translate(${rect.x} ${rect.y})`} role="button" tabIndex={isLocked ? -1 : 0} aria-disabled={isLocked}
          aria-label={part ? t.d.reassemble.filledSlot(slot.label, name(part)) : t.d.reassemble.emptySlot(slot.label)}
          onClick={() => activate(slot.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(slot.id); } }}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && !isLocked) drop(slot.id, id); }}>
          <rect className="body" width={rect.w} height={rect.h} rx={3}/>
          <text className="kind-tag" x={10} y={15}>{slot.label}</text>
          {part && <g className="plate-icon"><PartIcon name={d.parts.find(p => p.id === part)!.icon} size={20} x={10} y={22 + (rect.h - 22 - 20) / 2}/></g>}
          <text className="name" lang={d.language}>{lines.map((line, i) => <tspan key={i} x={40} y={22 + (rect.h - 22 - lines.length * 15) / 2 + 11 + i * 15}>{line}</tspan>)}</text>
          {isLocked && <g className="state-mark s-ok" aria-hidden="true"><circle cx={rect.w} cy={0} r={10}/><text x={rect.w} y={4} textAnchor="middle">✓</text></g>}
        </g>;
      })}
    </svg></div>;
  const trayView = <div className="tray" role="group" aria-label={t.d.reassemble.tray}>
      <span className="box-label">{t.d.reassemble.tray}</span>
      {tray.length ? tray.map(id => <button key={id} className="subtle tray-part" draggable aria-pressed={held === id} lang={d.language}
        onClick={() => setHeld(held === id ? undefined : id)} onDragStart={e => e.dataTransfer.setData('text/plain', id)}><PartIcon name={d.parts.find(p => p.id === id)!.icon} size={19}/><span>{name(id)}</span></button>)
        : <p className="micro plain">{t.d.reassemble.allPlaced}</p>}
      <p className="micro plain">{held ? t.d.reassemble.selected(name(held)) : t.d.reassemble.hint}</p>
    </div>;
  const actionsView = <div className="reassemble-actions">
      <button className="primary" disabled={!Object.keys(placements).length} onClick={check}><Check size={15}/>{t.d.reassemble.check}</button>
      <button className="text-button" onClick={() => { clear(); setHeld(undefined); }}><RotateCcw size={14}/>{t.d.reassemble.clear}</button>
      <span className="micro plain">{t.d.reassemble.lockedCount(locked.length, d.reassemble.slots.length)}</span>
    </div>;
  const feedbackView = feedback && <div className={`run-feedback ${feedback.complete ? 'verdict-holds' : feedback.wrong ? 'verdict-falls' : ''}`} role="status">
      {feedback.complete ? <p><strong>{t.d.reassemble.complete}</strong></p>
        : feedback.wrong ? <p lang={d.language}>{t.d.reassemble.wrong(name(feedback.wrong.part), feedback.wrong.hint)}</p> : null}
    </div>;
  if (!workbench) return <div className="reassemble">{heading}{diagram}{trayView}{actionsView}{feedbackView}</div>;
  return <div className="reassemble workbench-reassembly">
    <section className="reassembly-canvas" aria-label={d.reassemble.title}>
      <div className="canvas-toolbar"><strong lang={d.language}>{d.whole.name}</strong></div>
      <div className="reassembly-drawing">{diagram}</div>
    </section>
    <section className="reassembly-controls" aria-label={t.d.reassemble.tray}>
      {heading}<div className="reassembly-reading">{trayView}{feedbackView}</div>{actionsView}
    </section>
  </div>;
}
