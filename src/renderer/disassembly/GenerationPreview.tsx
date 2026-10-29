import { useMemo, useState } from 'react';
import type { Part } from '../../core/disassembly';
import { layoutLevel, readingNumbers } from '../../core/layout';
import type { GenerationPreview as Preview } from '../../core/provider';
import { usePreferences } from '../preferences';
import { PartIcon, Sheet } from './Sheet';
import { workbenchLayout } from './workbench-layout';

const STATE = { waiting: undefined, writing: 'active', done: 'ok', failed: 'failed' } as const;

/**
 * The top level while it is written (D22), with the player's layout and sheet. Plates carry their status with the
 * player's state marks; a part that is done opens its lead and points below the drawing.
 */
export function GenerationPreview({ preview, language }: { preview: Preview; language: string }) {
  const { t } = usePreferences();
  const [selected, setSelected] = useState<string>();
  // The sheet draws sub-assemblies from their sub-parts; the preview knows only how many there are.
  const parts = useMemo<Part[]>(() => preview.parts.map(p => ({
    id: p.id, name: p.name, kind: p.kind, icon: p.icon, role: p.lead ?? '', cites: [],
    ...(p.subParts ? { parts: Array.from({ length: p.subParts }, (_, i): Part => ({ id: `${p.id}-${i + 1}`, name: '', kind: p.kind, icon: p.icon, role: '', cites: [] })) } : {}),
  })), [preview]);
  // The drawing changes only with the structure, not with each status, so plates keep their place.
  const shape = JSON.stringify([preview.parts.map(p => p.id), preview.joints]);
  const layout = useMemo(() => workbenchLayout(layoutLevel(parts, preview.joints), preview.joints), [shape]);
  const numbers = useMemo(() => readingNumbers(layout), [layout]);
  const states = Object.fromEntries(preview.parts.flatMap(p => STATE[p.status] ? [[p.id, STATE[p.status]!]] : []));
  const done = preview.parts.filter(p => p.status === 'done').length;
  const open = preview.parts.find(p => p.id === selected);

  return <div className="generation-preview">
    <Sheet layout={layout} parts={parts} joints={preview.joints} title={t.generate.previewTitle} subtitle={t.generate.previewSubtitle(done, preview.parts.length)}
      language={language} selected={selected} onSelect={id => setSelected(x => x === id ? undefined : id)} states={states} fit="contain"/>
    <ul className="sr-only">{preview.parts.map(p => <li key={p.id}>{numbers.get(p.id)}. {p.name}: {t.generate.partStatus[p.status]}</li>)}</ul>
    {open?.status === 'done' && open.lead
      ? <section className="part-card preview-card" aria-live="polite" lang={language}>
          <h3><PartIcon name={open.icon} size={18}/>{numbers.get(open.id)}. {open.name}</h3>
          <p className="role lead">{open.lead}</p>
          {open.points && <ul className="marked-points">{open.points.map((x, i) => <li key={i}><span className="mark" aria-hidden="true">•</span><span>{x}</span></li>)}</ul>}
        </section>
      : <p className="micro plain">{open ? t.generate.previewWaiting(open.name) : t.generate.previewHint}</p>}
  </div>;
}
