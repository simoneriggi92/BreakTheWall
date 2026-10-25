import { useEffect, useRef } from 'react';
import type { Cite, Disassembly } from '../../core/disassembly';
import { usePreferences } from '../preferences';

/**
 * The numbered source lines. The focused citation is highlighted and scrolled into view inside this pane only,
 * never the page. Documents show their page breaks; many files get a picker.
 */
export function SourcePane({ d, sourceId, onSource, focus, cited }: { d: Disassembly; sourceId: string; onSource: (id: string) => void; focus?: Cite; cited: Cite[] }) {
  const { t } = usePreferences();
  const source = d.sources.find(s => s.id === sourceId) ?? d.sources[0];
  const lines = source.text.split('\n');
  const pageStarts = new Map((source.pages ?? []).map(p => [p.from, p.page]));
  const list = useRef<HTMLOListElement>(null);
  const inFocus = (n: number) => !!focus && focus.source === source.id && n >= focus.from && n <= focus.to;
  const inCited = (n: number) => cited.some(c => c.source === source.id && n >= c.from && n <= c.to);
  useEffect(() => {
    const host = list.current; const first = focus && focus.source === source.id ? host?.querySelector<HTMLElement>(`[data-line="${focus.from}"]`) : undefined;
    if (host && first) host.scrollTop = first.offsetTop - host.offsetTop - 24;
  }, [focus, source.id]);
  return <section className="source-pane" aria-label={t.d.source}>
    <div className="source-head"><span className="box-label">{t.d.source}</span>
      {d.sources.length > 3
        ? <select aria-label={t.d.sourceFile} value={source.id} onChange={e => onSource(e.target.value)}>{d.sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        : d.sources.length > 1 ? <span className="source-tabs">{d.sources.map(s => <button key={s.id} className="cite" aria-pressed={s.id === source.id} onClick={() => onSource(s.id)}>{s.title}</button>)}</span>
        : <span className="micro plain">{source.title}</span>}
    </div>
    <ol ref={list} className={`source-text ${source.language && !/^[a-z]{2}$/.test(source.language) ? 'code' : ''}`} aria-label={t.d.sourceLines(source.title)} tabIndex={0}>
      {lines.map((text, i) => {
        const n = i + 1; const page = pageStarts.get(n);
        return <li key={n} data-line={n} className={inFocus(n) ? 'focus' : inCited(n) ? 'cited' : undefined}>
          {page !== undefined && <span className="page-break">{t.d.pageBreak(page)}</span>}
          <span className="line-no" aria-hidden="true">{n}</span><span className="line-text">{text || ' '}</span>
          {inFocus(n) && <span className="sr-only">{t.d.citedLine}</span>}
        </li>;
      })}
    </ol>
  </section>;
}
