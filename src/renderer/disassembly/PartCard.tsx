import { useEffect, useRef } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { pagesOf, type Cite, type Disassembly, type Joint, type Part } from '../../core/disassembly';
import type { Messages } from '../i18n/it';
import { usePreferences } from '../preferences';
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
  focus?: Cite; onFocus: (c: Cite) => void; onEnter: (id: string) => void;
  note: string; onNote: (value: string) => void;
}
/** The open part: role, marked points, lens, metaphor with its limit, critique, joints in words, citations and notes. */
export function PartCard({ d, part, owner, joints, level, number, focus, onFocus, onEnter, note, onNote }: Props) {
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
      <p className="micro plain hint">{t.d.selectHint}</p>
    </section>;
  }
  const name = (id: string) => level.find(p => p.id === id)?.name ?? id;
  const related = joints.filter(j => j.from === part.id || j.to === part.id);
  return <section className="part-card" aria-live="polite">
    <span className="eyebrow">{t.d.partOf(number ?? 0, t.d.kinds[part.kind])}</span>
    <div lang={d.language}>
      <h2 ref={heading} tabIndex={-1}><PartIcon name={part.icon} size={20}/>{part.name}</h2>
      <p className="role">{part.role}</p>
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
    <label className="part-note">{t.d.notes}<textarea rows={3} maxLength={4000} value={note} placeholder={t.d.notesPlaceholder} onChange={e => onNote(e.target.value)}/></label>
  </section>;
}
