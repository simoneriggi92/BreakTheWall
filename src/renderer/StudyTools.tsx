import { ArrowRight, BookOpen, Map, MessageSquareText, Search } from 'lucide-react';
import type { Block, Lesson } from '../core/lesson';
import { canVisit, type LearnerState } from '../core/state';
import type { ChangeState } from './blocks';
import { Icon } from './icons';
import { usePreferences } from './preferences';
import { useState } from 'react';

export type ToolTab = 'map' | 'atlas' | 'notes';
const tabs = [{ id: 'map', icon: Map }, { id: 'atlas', icon: BookOpen }, { id: 'notes', icon: MessageSquareText }] as const;

export function StudyTools({ lesson, state, tab, setTab, change, go }: {
  lesson: Lesson; state: LearnerState; tab: ToolTab; setTab: (tab: ToolTab) => void; change: ChangeState; go: (id: string) => void;
}) {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const page = lesson.pages.find(x => x.id === state.pageId)!;
  const available = lesson.concepts.filter(x => showAll || state.mode === 'explore' || state.visited.includes(x.pageId));
  const filtered = available.filter(x => `${x.title} ${x.definition}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const maps = lesson.pages.flatMap(p => p.blocks).filter((b): b is Extract<Block, { type: 'map' }> => b.type === 'map');
  const sequence = page.blocks.find(b => b.type === 'sequence');
  const map = sequence?.type === 'sequence' ? maps.find(m => m.id === sequence.mapId)
    : page.blocks.find((b): b is Extract<Block, { type: 'map' }> => b.type === 'map') ?? lesson.pages.slice(0, lesson.pages.indexOf(page) + 1).flatMap(p => p.blocks).filter((b): b is Extract<Block, { type: 'map' }> => b.type === 'map').at(-1) ?? maps[0];
  const activeNode = sequence?.type === 'sequence' ? (sequence.frames.find(f => f.id === state.frames[sequence.id]) ?? sequence.frames[0]).activeNodeId : map ? state.nodes[map.id] ?? map.nodes[0].id : undefined;
  const mapPage = map && lesson.pages.find(p => p.blocks.some(b => b.id === map.id));

  return <div className="study-tools"><div className="context-tabs" role="tablist" aria-label={t.tools.tabsLabel}>{tabs.map((item, i) => <button key={item.id} id={`tool-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="tool-content" tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
    const next = event.key === 'ArrowRight' ? (i + 1) % tabs.length : event.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); setTab(tabs[next].id);
    (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next])?.focus();
  }}><item.icon size={16}/>{t.tools.tabs[item.id]}</button>)}</div>
    <div id="tool-content" role="tabpanel" aria-labelledby={`tool-${tab}`}>
      {tab === 'map' && <><p className="tools-hint">{t.tools.mapHint}</p>{map && mapPage ? <><h3 className="tools-map-title">{map.title}</h3><ol className="concept-minimap" aria-label={t.tools.relations}>{map.nodes.map(node => <li key={node.id}><button className={`tone-${node.tone}`} aria-current={node.id === activeNode ? 'location' : undefined} disabled={!canVisit(lesson, state, mapPage.id)} onClick={() => {
        change(s => ({ ...s, nodes: { ...s.nodes, [map.id]: node.id } })); go(mapPage.id);
      }}><Icon name={node.icon} size={19}/><span><strong>{node.title}</strong><small>{node.summary}</small></span></button>{map.edges.filter(e => e.from === node.id).map((e, i) => <p className="concept-edge" key={i}><ArrowRight size={13}/><span>{e.label} <strong>{map.nodes.find(n => n.id === e.to)?.title.toLocaleLowerCase()}</strong></span></p>)}</li>)}</ol><p className="micro plain">{t.tools.selectConcept}</p></> : <p className="tools-hint">{t.tools.noMap}</p>}
      <details className="tool-goal"><summary><Icon name="target" size={17}/>{t.tools.goal}</summary><p>{lesson.goal.outcome}</p></details></>}
      {tab === 'atlas' && <><label className="atlas-search"><Search size={15}/><input aria-label={t.tools.searchAtlas} placeholder={t.tools.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)}/></label><label className="atlas-all"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}/>{t.tools.includeNext}</label><div className="atlas-results">{filtered.map(c => <details className="atlas-concept" key={c.id}><summary><Icon name={c.icon} size={18}/>{c.title}</summary><p>{c.definition}</p><button className="text-button" disabled={!canVisit(lesson, state, c.pageId)} onClick={() => go(c.pageId)}>{t.tools.goToExplanation}<ArrowRight size={13}/></button>{!canVisit(lesson, state, c.pageId) && <span className="micro plain">{t.tools.afterActivity}</span>}</details>)}</div>{!filtered.length && <p className="tools-hint">{t.tools.noMatch}</p>}</>}
      {tab === 'notes' && <div className="tools-notes"><span className="eyebrow">{t.tools.linksEyebrow}</span><h3>{page.title}</h3><label htmlFor="page-note">{t.tools.remember}</label><textarea id="page-note" rows={8} maxLength={4000} value={state.notes[page.id] ?? ''} placeholder={t.tools.notePlaceholder} onChange={e => { const value = e.target.value; change(s => ({ ...s, notes: { ...s.notes, [page.id]: value } })); }}/><p className="micro plain">{t.tools.noteCount((state.notes[page.id] ?? '').length)}</p></div>}
    </div><p className="context-origin">{lesson.generation ? t.tools.originGenerated(t.tools.generatedBy(lesson.generation.provider === 'local', lesson.generation.model)) : t.tools.originPrepared}</p>
  </div>;
}
