import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, ArrowUp, Hammer, Link2 } from 'lucide-react';
import { DISASSEMBLY_LIMITS, divisible, linesOf, pagesOf, type Cite, type Disassembly, type Joint, type Part } from '../../core/disassembly';
import type { GenerationProgress, GenerationRoute, ProviderFailure } from '../../core/provider';
import type { Messages } from '../i18n/it';
import { failureText, usePreferences } from '../preferences';
import { PartIcon } from './Sheet';

/** "release-runbook.md · p. 12 · l. 40–52": the file only when there are several, the page only when the source has pages. */
export function citeLabel(t: Messages, d: Pick<Disassembly, 'sources'>, c: Cite): string {
  const source = d.sources.find(s => s.id === c.source);
  const pages = source && pagesOf(source, c);
  return [d.sources.length > 1 && source?.title, pages && t.d.pages(pages.first, pages.last), t.d.lines(c.from, c.to)].filter(Boolean).join(' · ');
}
export function Cites({ d, cites, focus, onFocus }: { d: Disassembly; cites: Cite[]; focus?: Cite; onFocus: (c: Cite) => void }) {
  const { t } = usePreferences();
  if (!cites.length) return null;
  return <div className="cites" aria-label={t.d.citations}>{cites.map((c, i) => <button key={i} className="cite" aria-pressed={focus === c} onClick={() => onFocus(c)}><Link2 size={12}/>{citeLabel(t, d, c)}</button>)}</div>;
}
/** Points carry a meaning mark (→ then, = stays the same, ⚠ caution) that screen readers hear in words. */
export function Points({ points }: { points: NonNullable<Part['points']> }) {
  const { t } = usePreferences();
  return <ul className="marked-points">{points.map((p, i) => <li key={i} className={p.mark ? `m-${p.mark}` : undefined}>
    <span className="mark" aria-hidden="true">{p.mark ? { step: '→', keeps: '=', caveat: '⚠' }[p.mark] : '•'}</span>
    {p.mark && <span className="sr-only">{t.d.marks[p.mark]}: </span>}<span>{p.text}</span></li>)}</ul>;
}

interface Props {
  d: Disassembly; part?: Part; owner?: Part; joints: Joint[]; level: Part[]; number?: number;
  /** The name of the level above, when a sub-assembly is open, and the way back to it. */
  above?: string; onUp?: () => void;
  focus?: Cite; onFocus: (c: Cite) => void; onEnter: (id: string) => void;
  note: string; onNote: (value: string) => void;
  /** Taking this part apart, when the disassembly allows it. */
  takeApart?: ReactNode;
}
/** The open part: role, marked points, lens, metaphor with its limit, critique, joints in words, citations and notes. */
export function PartCard({ d, part, owner, above, onUp, joints, level, number, focus, onFocus, onEnter, note, onNote, takeApart }: Props) {
  const { t } = usePreferences();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (part) heading.current?.focus({ preventScroll: true }); }, [part]);
  if (!part) {
    const whole = owner ?? d.whole;
    return <section className="part-card" aria-live="polite">
      <span className="eyebrow">{owner ? t.d.subassembly(t.d.kinds[owner.kind]) : t.d.whole}</span>
      <div lang={d.language}><h2>{owner ? owner.name : d.whole.name}</h2>
        <p className="role">{owner ? owner.role : d.whole.does}</p>
        {owner ? owner.points ? <Points points={owner.points}/> : <p>{owner.explain}</p> : <p>{d.whole.why}</p>}</div>
      <Cites d={d} cites={'cites' in whole ? whole.cites : []} focus={focus} onFocus={onFocus}/>
      <p className="micro plain hint">{t.d.selectHint}{above && ` ${t.d.upHint}`}</p>
      {above && onUp && <button className="subtle level-up" onClick={onUp}><ArrowUp size={15}/>{t.d.up(above)}</button>}
    </section>;
  }
  const name = (id: string) => level.find(p => p.id === id)?.name ?? id;
  const related = joints.filter(j => j.from === part.id || j.to === part.id);
  return <section className="part-card" aria-live="polite">
    <span className="eyebrow">{t.d.partOf(number ?? 0, t.d.kinds[part.kind])}</span>
    <div lang={d.language}>
      <h2 ref={heading} tabIndex={-1}><PartIcon name={part.icon} size={20}/>{part.name}</h2>
      {/* The lead opens the card; the points and the explanation add what it does not say (D20). */}
      <p className="role lead">{part.role}</p>
      {part.points ? <Points points={part.points}/> : <p>{part.explain}</p>}
      {part.lens && <div className="card-box"><span className="box-label">{t.d.lens}</span><dl className="lens-list">
        <dt>{t.d.lensWhat}</dt><dd>{part.lens.what}</dd><dt>{t.d.lensWhy}</dt><dd>{part.lens.why}</dd>
        <dt>{t.d.lensHow}</dt><dd>{part.lens.how}</dd><dt>⚠ {t.d.lensCritical}</dt><dd>{part.lens.critical}</dd></dl></div>}
      {part.metaphor && <div className="card-box"><span className="box-label">{t.d.metaphor}</span><p>{part.metaphor.text}</p>
        <span className="box-label">⚠ {t.d.metaphorLimit}</span><p>{part.metaphor.limit}</p></div>}
      {part.critique && <div className="card-box inference"><span className="box-label">{t.d.critique}</span><p>{part.critique}</p></div>}
      {related.length > 0 && <div className="card-box"><span className="box-label">{t.d.joints}</span><ul className="joint-words">{related.map((j, i) => <li key={i}>
        {j.from === part.id ? t.d.jointOut(t.d.verbs[j.type], name(j.to)) : t.d.jointIn(name(j.from), t.d.verbs[j.type])}<span className="micro plain"> · {j.label}</span></li>)}</ul></div>}
    </div>
    <Cites d={d} cites={part.cites} focus={focus} onFocus={onFocus}/>
    {part.parts && <button className="primary open-sub" onClick={() => onEnter(part.id)}>{part.relevant === false ? t.d.openClosed(part.parts.length) : t.d.openSub(part.parts.length)}<ArrowRight size={15}/></button>}
    {part.parts && part.relevant === false && <p className="micro plain">{t.d.closedNote}</p>}
    {!part.parts && takeApart}
    <label className="part-note">{t.d.notes}<textarea rows={3} maxLength={4000} value={note} placeholder={t.d.notesPlaceholder} onChange={e => onNote(e.target.value)}/></label>
  </section>;
}

/**
 * "Take this part apart": one request with only the part's lines. A part with too few lines says why it stops here,
 * so the learner sees that the source, not the app, sets the depth.
 */
export function TakeApart({ d, part, route, progress, problem, onRun, onCancel }: {
  d: Disassembly; part: Part; route?: GenerationRoute; progress?: GenerationProgress; problem?: ProviderFailure; onRun: () => void; onCancel: () => void;
}) {
  const { t } = usePreferences();
  const x = t.d.expand;
  if (!divisible(d, part)) return <p className="micro plain take-apart">{x.leaf(linesOf(d, part.cites).size, DISASSEMBLY_LIMITS.minLinesToSplit)}</p>;
  if (progress) return <div className="generating take-apart">
    <div className="generating-head"><span className="spinner" aria-hidden="true"/><span role="status">{x.running}{progress.shortening ? ` · ${x.shortening}` : progress.repairing ? ` · ${x.repairing}` : ''}</span><button className="subtle" onClick={onCancel}>{x.cancel}</button></div>
    <p className="micro plain">{x.requests(progress.requests)}</p>
  </div>;
  const where = route && (route.provider === 'local' ? x.local(route.model) : `ChatGPT · ${route.model}`);
  return <div className="take-apart">
    <button className="subtle" disabled={!route} onClick={onRun}><Hammer size={15}/>{x.action}</button>
    <p className="micro plain">{where ? x.cost(where) : x.noRoute}</p>
    {problem && <div className={problem.code === 'cancelled' ? 'notice' : 'error-banner'} role="alert"><div><p>{failureText(t, problem)}</p>
      {problem.issues && <details className="issue-details"><summary>{t.generate.technical}</summary><ul className="issue-list">{problem.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}</div></div>}
  </div>;
}
