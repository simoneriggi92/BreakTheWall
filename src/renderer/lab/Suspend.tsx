import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Cite, Disassembly, Run } from '../../core/disassembly';
import { usePreferences } from '../preferences';
import { Cites } from '../disassembly/PartCard';

type Load = Extract<Run, { type: 'load' }>;
export type SupportTag = 'lost' | 'none' | 'intact';

/**
 * A load run for a source drawn as an atlas (P-20261103-lab-mode L12). It speaks of supports, not of weight:
 * suspending a part asks which justifications of the target stay explicit in the excerpt, and the answer comes from
 * the `supports` joints and their lines, not from the run's verdict. What the disassembly adds comes after, apart,
 * without its opening verdict sentence, which belongs to the weight metaphor. Whether the target is true is another
 * question, and the run says so.
 */
export function suspension(d: Disassembly, run: Load, part: string) {
  const all = d.joints.filter(j => j.type === 'supports' && j.to === run.target), lost = all.find(j => j.from === part), rest = all.filter(j => j.from !== part);
  const tag: SupportTag = lost ? (rest.length ? 'lost' : 'none') : 'intact';
  return { all, lost, rest, tag };
}
/**
 * The run speaks of supports only where the source documents them: an atlas whose target has `supports` joints.
 * A story's load run (leads-to, because) has no supports to suspend, and keeps today's run.
 */
export const runsOnSupports = (d: Pick<Disassembly, 'joints'>, view: 'object' | 'atlas', run: Load) =>
  view === 'atlas' && d.joints.some(j => j.type === 'supports' && j.to === run.target);
/** "Crolla." / "It holds." and the like, at the start of an explanation. */
const VERDICT_LEAD = /^(Crolla|Regge|Si indebolisce|It falls|It holds|It weakens)\b[^.]*\.\s*/;
export const withoutVerdict = (text: string) => text.replace(VERDICT_LEAD, '');

export function SuspendRun({ d, run, current, tried = [], onSuspend, focus, onFocus }: {
  d: Disassembly; run: Load; current?: string; tried?: string[]; onSuspend: (part?: string) => void; focus?: Cite; onFocus: (c: Cite) => void;
}) {
  const { t } = usePreferences(), S = t.d.lab.suspend, name = (id: string) => d.parts.find(p => p.id === id)?.name ?? id, target = name(run.target);
  const supporters = new Set(d.joints.filter(j => j.type === 'supports' && j.to === run.target).map(j => j.from));
  return <div className="run-reading lab-suspend">
    <h3>{S.title}</h3>
    <p className="micro plain">{S.question(target)}</p>
    <div className="bricks" role="group" aria-label={t.d.run.bricks}>{run.bricks.map(b => <button key={b.part} className="subtle" aria-pressed={current === b.part} onClick={() => onSuspend(current === b.part ? undefined : b.part)}>
      <span lang={d.language}>{S.action(name(b.part))}</span>{tried.includes(b.part) && <span className="verdict-chip">{S.tags[suspension(d, run, b.part).tag]}</span>}</button>)}</div>
    {current && <Outcome key={current} d={d} run={run} part={current} focus={focus} onFocus={onFocus} onUndo={() => onSuspend(undefined)}/>}
    {tried.length === run.bricks.length && <dl className="brick-summary">{(['support', 'other'] as const).map(k => {
      const names = run.bricks.filter(b => supporters.has(b.part) === (k === 'support')).map(b => name(b.part));
      return names.length ? <div key={k}><dt>{S.summary[k]}</dt><dd lang={d.language}>{names.join(', ')}</dd></div> : null;
    })}</dl>}
  </div>;
}

function Outcome({ d, run, part, focus, onFocus, onUndo }: { d: Disassembly; run: Load; part: string; focus?: Cite; onFocus: (c: Cite) => void; onUndo: () => void }) {
  const { t } = usePreferences(), S = t.d.lab.suspend, name = (id: string) => d.parts.find(p => p.id === id)?.name ?? id, target = name(run.target);
  const { all, lost, rest, tag } = suspension(d, run, part), brick = run.bricks.find(b => b.part === part)!;
  // The learner answers first: which supporters stay explicit, or none.
  const [keep, setKeep] = useState<Set<string>>(new Set()), [checked, setChecked] = useState(false);
  const toggle = (id: string) => setKeep(k => { const n = new Set(k); if (id === '') return new Set(k.has('') ? [] : ['']); n.delete(''); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (!checked) return <fieldset className="predict lab-keep">
    <legend><b lang={d.language}>{S.suspended(name(part))}</b> {S.question(target)}</legend>
    {all.map(j => j.from === part
      ? <p key={j.from} className="muted" lang={d.language}>– {name(j.from)} · {S.off}</p>
      : <label key={j.from}><input type="checkbox" checked={keep.has(j.from)} onChange={() => toggle(j.from)}/><span lang={d.language}>{name(j.from)} <span className="muted">· «{j.label}»</span></span></label>)}
    <label><input type="checkbox" checked={keep.has('')} onChange={() => toggle('')}/><span>{S.none}</span></label>
    <button className="primary" disabled={!keep.size} onClick={() => setChecked(true)}>{S.check}</button>
  </fieldset>;
  const want = rest.map(j => j.from), right = want.length ? want.length === keep.size && want.every(x => keep.has(x)) : keep.has('');
  const extra = withoutVerdict(brick.explain), list = rest.map(j => `«${name(j.from)}» («${j.label}»)`).join(', ');
  return <div className={`run-feedback support-${tag}`} aria-live="polite">
    <p lang={d.language}><strong>{S.tags[tag]}.</strong> {lost ? S.loses(target, name(part)) : S.notSupport(name(part), target)} {rest.length ? S.remain(list) : S.noneRemain}</p>
    <Cites d={d} cites={rest.flatMap(j => j.cites ?? [])} focus={focus} onFocus={onFocus}/>
    <p className="micro plain">{right ? S.match : S.expected(want.length ? want.map(name).join(', ') : S.none.toLowerCase())}</p>
    {extra && <div className="lab-adds"><span className="box-label">{S.adds}</span><p lang={d.language}>{extra}</p>
      {brick.inference && <p className="inference-note"><TriangleAlert size={14}/>{S.inference}</p>}
      <Cites d={d} cites={brick.cites ?? []} focus={focus} onFocus={onFocus}/></div>}
    <p className="micro plain">{S.about(target)}</p>
    <button className="text-button" onClick={onUndo}>{S.undo}</button>
  </div>;
}
