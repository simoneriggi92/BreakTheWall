import type { CSSProperties, ReactNode } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { usePreferences } from '../preferences';

/**
 * The reading column (P-20261029-ui-workbench U4): what the learner reads or does on top, and below it the source
 * that text cites, both on screen, so a claim can be checked against its lines without switching anything.
 * In a run the source starts folded to its header and opens when the learner asks or follows a citation.
 */
export function ReadingColumn({ detail, source, sourceTitle, share, splitter, folded, onFold, sourceOnly = false, sourceWide = false }: {
  detail?: ReactNode; source: ReactNode; sourceTitle: string;
  /** The explanation's share of the column's height while the source is open. */
  share: number; splitter?: ReactNode;
  /** Set only where the source can fold (runs): whether it is folded, and the way to open or fold it. */
  folded?: boolean; onFold?: () => void;
  sourceOnly?: boolean; sourceWide?: boolean;
}) {
  const { t } = usePreferences();
  const showDetail = !sourceOnly && !sourceWide;
  const open = !folded;
  const style = { '--reading-share': `${Math.round(share * 1000) / 10}%` } as CSSProperties;
  return <aside className={`d-side reading-column${showDetail && open ? ' split' : ''}`} aria-label={t.d.workbench.inspector} style={style}>
    {showDetail && <div className="reading-detail">{detail}</div>}
    {showDetail && open && splitter}
    {onFold && showDetail && <button className="source-fold" aria-expanded={open} onClick={onFold}>
      <BookOpen size={15} aria-hidden="true"/><span>{t.d.source}</span><span className="micro plain">{sourceTitle}</span>
      {open ? <ChevronDown size={15} aria-hidden="true"/> : <ChevronUp size={15} aria-hidden="true"/>}</button>}
    {(open || !showDetail) && <div className="reading-source">{source}</div>}
  </aside>;
}
