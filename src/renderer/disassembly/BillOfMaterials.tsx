import { Check, TriangleAlert } from 'lucide-react';
import { allParts, billOfMaterials, type Cite, type Disassembly, type LineStatus } from '../../core/disassembly';
import { usePreferences } from '../preferences';
import { citeLabel } from './PartCard';

/** Consecutive lines with the same status, so a long source draws as a few segments. */
function runs(status: LineStatus[]) {
  const out: { status: LineStatus; from: number; count: number }[] = [];
  status.forEach((s, i) => { const last = out.at(-1); if (last?.status === s) last.count++; else out.push({ status: s, from: i + 1, count: 1 }); });
  return out;
}

/** "Nothing disappears": the scope, every item with its lines, every exclusion with its reason, and the app's own check. */
export function BillOfMaterials({ d, onFocus }: { d: Disassembly; onFocus: (c: Cite) => void }) {
  const { t, n } = usePreferences();
  const bom = billOfMaterials(d);
  const forgotten = bom.sources.flatMap(s => s.forgotten.map(f => ({ ...f, title: s.title })));
  const numbered = allParts(d).map(({ part, path }) => ({ part, number: path.match(/\d+/g)!.map(x => Number(x) + 1).join('.') }));
  const joints = [...d.joints, ...allParts(d).flatMap(x => x.part.joints ?? [])].filter(j => j.cites?.length);
  const ranges = (cites: Cite[]) => <span className="cites-inline">{cites.map((c, i) => <button key={i} className="cite" onClick={() => onFocus(c)}>{citeLabel(t, d, c)}</button>)}</span>;
  return <div className="bom">
    {d.scope && <div className="card-box bom-scope"><span className="box-label">{t.d.bom.scope} · {d.scope.kind === 'repository' ? t.d.bom.repository : t.d.bom.document}</span>
      {d.scope.kind === 'repository'
        ? <><p className="mono">{d.scope.root} · {t.d.bom.commit} {d.scope.commit}</p>{d.scope.modified.length > 0 && <p className="micro plain">{t.d.bom.modified}: {d.scope.modified.join(', ')}</p>}</>
        : <p>{d.scope.title} · {t.d.bom.pages(d.scope.pages.from, d.scope.pages.to)}</p>}
      {d.scope.note && <p className="micro plain" lang={d.language}>{d.scope.note}</p>}</div>}
    <div className={`bom-check ${forgotten.length ? 'bad' : 'good'}`} role="status">{forgotten.length ? <TriangleAlert size={16}/> : <Check size={16}/>}
      <div>{forgotten.length ? forgotten.map((f, i) => <p key={i}>{t.d.bom.forgotten(f.from, f.to, f.title)}</p>) : <p>{t.d.bom.ok}</p>}
        <p className="micro plain">{t.d.bom.counts(n(bom.counts.assigned), n(bom.counts.excluded), n(bom.counts.blank))}</p></div></div>
    <div className="bom-strips">{bom.sources.map(s => <figure key={s.id} className="bom-strip"><figcaption className="micro plain">{t.d.bom.strip(s.title)}</figcaption>
      <svg viewBox={`0 0 ${s.status.length} 10`} preserveAspectRatio="none" role="img" aria-label={t.d.bom.strip(s.title)}>{runs(s.status).map(r => <rect key={r.from} className={`line-${r.status}`} x={r.from - 1} width={r.count} height={10}/>)}</svg></figure>)}
      <p className="bom-legend micro plain">{(['assigned', 'excluded', 'blank', 'missing'] as const).map(x => <span key={x}><i className={`line-${x}`}/>{t.d.bom.legend[x]}</span>)}</p></div>
    <table className="bom-table"><caption className="box-label">{t.d.bom.parts}</caption>
      <thead><tr><th scope="col">{t.d.bom.item}</th><th scope="col">{t.d.bom.name}</th><th scope="col">{t.d.bom.lines}</th></tr></thead>
      <tbody>
        <tr><td className="mono">—</td><td lang={d.language}>{t.d.bom.whole} · {d.whole.name}</td><td>{ranges(d.whole.cites)}</td></tr>
        {numbered.map(({ part, number }) => <tr key={part.id}><td className="mono">{number}</td><td lang={d.language}>{part.name} <span className="micro plain">· {t.d.kinds[part.kind]}</span></td><td>{ranges(part.cites)}</td></tr>)}
        {joints.map((j, i) => <tr key={`j${i}`}><td className="mono">—</td><td lang={d.language}>{t.d.bom.joint(j.label)}</td><td>{ranges(j.cites!)}</td></tr>)}
      </tbody></table>
    <table className="bom-table excluded"><caption className="box-label">{t.d.bom.excluded}</caption>
      <thead><tr><th scope="col">{t.d.bom.lines}</th><th scope="col">{t.d.bom.reason}</th><th scope="col">{t.d.bom.note}</th></tr></thead>
      <tbody>{d.bom.excluded.map((x, i) => <tr key={i}><td>{ranges([x])}</td><td>{t.d.reasons[x.reason]}</td><td lang={d.language}>{x.note ?? ''}</td></tr>)}</tbody></table>
    {d.bom.excludedFiles?.length ? <table className="bom-table excluded"><caption className="box-label">{t.d.bom.files}</caption>
      <thead><tr><th scope="col">{t.d.bom.file}</th><th scope="col">{t.d.bom.reason}</th><th scope="col">{t.d.bom.note}</th></tr></thead>
      <tbody>{d.bom.excludedFiles.map((x, i) => <tr key={i}><td className="mono">{x.path}</td><td>{t.d.reasons[x.reason]}</td><td lang={d.language}>{x.note ?? ''}</td></tr>)}</tbody></table> : null}
  </div>;
}
