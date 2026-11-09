import { useMemo } from 'react';
import { pointsInside, type Exploration, type ExplorationLink } from '../../core/exploration';
import { shapeOf } from '../../core/exploration-shape';
import { readingReport, VERDICTS } from '../../core/reading-report';
import { originText, usePreferences } from '../preferences';
import type { Model } from './model';

/**
 * "How it was read" (X17), the drawing's title block: who extracted, how many lines and how much of them the map uses,
 * a grid with one cell per line, the legend with counts, and five readings in words. The numbers are X6's; this only
 * words them.
 */
export function Report({ m, onLine, onLink }: { m: Model; onLine: (line: number) => void; onLink: (l: ExplorationLink) => void }) {
  const { t, n } = usePreferences(), r = t.x.report;
  const x: Exploration = m.x;
  const report = useMemo(() => readingReport(x, shapeOf(x), m.index), [x, m.index]);
  const pct = (a: number, b = report.total) => b ? Math.round(a / b * 100) : 0;
  const name = (id: string) => m.all.get(id)?.name ?? id;
  const shape = report.shape, main = shape.nuclei[0], points = pointsInside(x);
  const empty = report.groups.filter(g => g.lines.every(l => l.verdict === 'none')).map(g => `«${g.title || r.title_}»`).join(', ');
  const trace = report.entry.trace !== undefined ? x.traces[report.entry.trace] : undefined;
  const order = report.order.agreement;
  const readings: [string, string, string][] = [
    [r.coverage, r.coverageHead(pct(report.inMap)), r.coverageBody(report.inMap, report.total, report.counts.trace) + (report.counts.none ? r.leftOut(report.counts.none, empty) : r.nothingLeft)],
    [r.shape, main === undefined ? r.shapeNone : shape.nuclei.length === 1 ? r.shapeOne(main) : r.shapeMany(shape.nuclei.length, main),
      r.shapeBody(shape.prerequisites, shape.annotations, shape.aside + shape.loose) + (shape.aspects ? r.shapeAspects(shape.aspects, shape.roles, shape.members) : '')],
    [r.basis, r.basisHead(report.basis.declared, report.basis.interpreted), report.basis.interpreted ? r.basisSome : r.basisAll],
    [r.entry, report.entry.code === 'trace' ? r.entryTrace : report.entry.code === 'source' ? r.entrySource : r.entryLayers,
      report.entry.code === 'trace' && trace ? r.entryTraceBody(trace.question, pct(report.entry.covered ?? 0, 1)) : report.entry.code === 'source' ? r.entrySourceBody : r.entryLayersBody],
    [r.order, order === null ? r.orderNone : order >= 0.75 ? r.orderFollows : order >= 0.5 ? r.orderPartly : r.orderJumps,
      (order === null ? '' : r.orderBody(Math.round(order * 100), report.order.sections)) + (points.points ? r.points(pct(points.inside, points.points)) : '')],
  ];
  return <section className="xp-report xp-panel" aria-label={r.title}>
    <div className="xp-rep-main">
      <h2>{r.title}</h2>
      <p className="xp-hint">{x.generation ? r.by(originText(t, x.generation)) : r.prepared}</p>
      <div className="xp-big"><b data-count="total">{n(report.total)}</b><span>{r.lines}</span><i aria-hidden="true">→</i><b data-count="share">{pct(report.inMap)}%</b><span>{r.inMap}</span></div>
      <p className="xp-hint">{r.gridHint}</p>
      <div className="xp-grid">{report.groups.map((g, i) => <div key={i} className="xp-grow">
        <span className="xp-gname" title={g.title || r.title_}>{g.title || r.title_}</span><span className="xp-gcount">{g.used}/{g.lines.length}</span>
        <span className="xp-cells">{g.lines.map(l => <button key={l.line} className="xp-cell" data-verdict={l.verdict} aria-label={r.cell(l.line, r.verdicts[l.verdict])} title={r.cell(l.line, r.verdicts[l.verdict])} onClick={() => onLine(l.line)}/>)}</span>
      </div>)}</div>
    </div>
    <div className="xp-rep-side">
      <p className="xp-hint">{r.legend}</p>
      <ul className="xp-legend">{VERDICTS.filter(k => report.counts[k] || k === 'none').map(k => <li key={k}><i className="xp-cell" data-verdict={k}/><span>{r.verdicts[k]}</span><b data-verdict-count={k}>{n(report.counts[k])}</b></li>)}</ul>
      {readings.map(([k, head, body]) => <div key={k} className="xp-reading"><span className="xp-rk">{k}</span><div><b>{head}</b><p>{body}</p>
        {k === r.basis && report.basis.interpretedLinks.length > 0 && <span className="xp-interp">{report.basis.interpretedLinks.map(l =>
          <button key={`${l.from}>${l.to}>${l.class}`} onClick={() => onLink(l)}>{name(l.from)} → {l.label} → {name(l.to)}</button>)}</span>}</div></div>)}
    </div>
  </section>;
}
