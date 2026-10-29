import { useEffect, useRef, useState } from 'react';
import { BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import type { Cite, Disassembly } from '../../core/disassembly';
import { isProse } from '../markdown';
import { usePreferences } from '../preferences';
import { SourceDocument, SourceReader } from './SourceDocument';

export type SourceView = 'lines' | 'document';

/**
 * The numbered source lines. The focused citation is highlighted and scrolled into view inside this pane only,
 * never the page. Documents show their page breaks; many files get a picker. A prose source can also be read
 * rendered, beside the card or in a full-window reader (D18); code keeps its lines.
 */
export function SourcePane({ d, sourceId, onSource, focus, cited, wide, onWide, view = 'lines', onView, active = true }: {
  d: Disassembly; sourceId: string; onSource: (id: string) => void; focus?: Cite; cited: Cite[]; wide?: boolean; onWide?: () => void;
  view?: SourceView; onView?: (view: SourceView) => void; active?: boolean;
}) {
  const { t } = usePreferences();
  const source = d.sources.find(s => s.id === sourceId) ?? d.sources[0];
  const lines = source.text.split('\n');
  const pageStarts = new Map((source.pages ?? []).map(p => [p.from, p.page]));
  const list = useRef<HTMLOListElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [reading, setReading] = useState(false);
  const prose = isProse(source);
  const shown: SourceView = prose ? view : 'lines';
  const inFocus = (n: number) => !!focus && focus.source === source.id && n >= focus.from && n <= focus.to;
  const inCited = (n: number) => cited.some(c => c.source === source.id && n >= c.from && n <= c.to);
  useEffect(() => {
    if (!active) return;
    const host = list.current; const first = focus && focus.source === source.id ? host?.querySelector<HTMLElement>(`[data-line="${focus.from}"]`) : undefined;
    // Measured on screen, so the result does not depend on which element positions the lines.
    if (host && first) host.scrollTop += first.getBoundingClientRect().top - host.getBoundingClientRect().top - 24;
  }, [focus, source.id, shown, active]);
  return <section className="source-pane" aria-label={t.d.source}>
    <div className="source-head"><span className="box-label">{t.d.source}</span>
      {d.sources.length > 3
        ? <select aria-label={t.d.sourceFile} value={source.id} onChange={e => onSource(e.target.value)}>{d.sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        : d.sources.length > 1 ? <span className="source-tabs">{d.sources.map(s => <button key={s.id} className="cite" aria-pressed={s.id === source.id} onClick={() => onSource(s.id)}>{s.title}</button>)}</span>
        : <span className="micro plain">{source.title}</span>}
      <span className="source-tools">
      {prose && onView && <span className="source-views" role="group" aria-label={t.d.viewLabel}>{(['lines', 'document'] as const).map(v =>
        <button key={v} className="cite" aria-pressed={shown === v} onClick={() => onView(v)}>{t.d.views[v]}</button>)}</span>}
      {prose && <button ref={opener} className="icon-button source-read" aria-label={t.d.openReader} title={t.d.openReader} onClick={() => setReading(true)}><BookOpen size={15}/></button>}
      {onWide && <button className="icon-button source-widen" aria-pressed={!!wide} aria-label={wide ? t.d.narrowSource : t.d.widenSource} title={wide ? t.d.narrowSource : t.d.widenSource} onClick={onWide}>{wide ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button>}</span>
    </div>
    {reading && <SourceReader source={source} focus={focus} cited={cited} onClose={() => { setReading(false); opener.current?.focus(); }}/>}
    {shown === 'document' ? <SourceDocument source={source} focus={focus} cited={cited} active={active}/> : <ol ref={list} className={`source-text ${source.language && !/^[a-z]{2}$/.test(source.language) ? 'code' : ''}`} aria-label={t.d.sourceLines(source.title)} tabIndex={0}>
      {lines.map((text, i) => {
        const n = i + 1; const page = pageStarts.get(n);
        return <li key={n} data-line={n} className={inFocus(n) ? 'focus' : inCited(n) ? 'cited' : undefined}>
          {page !== undefined && <span className="page-break">{t.d.pageBreak(page)}</span>}
          <span className="line-no" aria-hidden="true">{n}</span><span className="line-text">{text || ' '}</span>
          {inFocus(n) && <span className="sr-only">{t.d.citedLine}</span>}
        </li>;
      })}
    </ol>}
  </section>;
}
