import { useId, useRef, type ReactNode } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { usePreferences } from '../preferences';

export type InspectorTab = 'detail' | 'source';

/** The active task and its source share a pane; their components stay mounted so notes and reading state survive tabs. */
export function WorkbenchInspector({ tab, onTab, activity, sourceOnly = false, detail, source }: {
  tab: InspectorTab; onTab: (tab: InspectorTab) => void; activity: boolean; sourceOnly?: boolean; detail?: ReactNode; source: ReactNode;
}) {
  const { t } = usePreferences();
  const id = useId();
  const detailButton = useRef<HTMLButtonElement>(null);
  const sourceButton = useRef<HTMLButtonElement>(null);
  const labels = { detail: activity ? t.d.workbench.activity : t.d.workbench.part, source: t.d.source };
  const choose = (next: InspectorTab) => { onTab(next); (next === 'detail' ? detailButton : sourceButton).current?.focus({ preventScroll: true }); };
  return <aside className="d-side workbench-inspector" aria-label={t.d.workbench.inspector}>
    {sourceOnly ? <div className="inspector-heading"><BookOpen size={17} aria-hidden="true"/>{t.d.source}</div>
      : <div className="inspector-tabs" role="tablist" aria-label={t.d.workbench.inspector} onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault(); choose(e.key === 'Home' ? 'detail' : e.key === 'End' ? 'source' : tab === 'detail' ? 'source' : 'detail');
        }}>
        {(['detail', 'source'] as const).map(value => <button key={value} ref={value === 'detail' ? detailButton : sourceButton}
          type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
          aria-controls={`${id}-${value}`} onClick={() => onTab(value)}>
          {value === 'detail' ? <FileText size={16} aria-hidden="true"/> : <BookOpen size={16} aria-hidden="true"/>}{labels[value]}
        </button>)}
      </div>}
    {!sourceOnly && <div className="inspector-detail" role="tabpanel" id={`${id}-detail`} aria-labelledby={`${id}-detail-tab`} hidden={tab !== 'detail'}>{detail}</div>}
    <div className="inspector-source" role={sourceOnly ? undefined : 'tabpanel'} id={`${id}-source`}
      aria-labelledby={sourceOnly ? undefined : `${id}-source-tab`} hidden={!sourceOnly && tab !== 'source'}>{source}</div>
  </aside>;
}
