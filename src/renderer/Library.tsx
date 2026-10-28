import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import type { DesktopBridge } from '../core/bridge';
import type { Disassembly } from '../core/disassembly';
import type { IncomingSource } from '../core/provider';
import { restoreDisassemblyState, type DisassemblyState } from '../core/disassembly-state';
import type { Lesson } from '../core/lesson';
import { restoreState, type LearnerState } from '../core/state';
import { PartIcon } from './disassembly/Sheet';
import { Icon } from './icons';
import { originText, usePreferences } from './preferences';
import { Studio, type StudioDraft } from './Studio';

const recentKey = 'btw:last-opened-lesson';
export function rememberLesson(id: string) {
  try { localStorage.setItem(recentKey, id); } catch { /* A UI hint must not block a lesson. */ }
}

interface Props {
  lessons: Lesson[]; generated: Lesson[]; disassemblies: Disassembly[]; bridge: DesktopBridge; error: string; skipped: number;
  draft: StudioDraft; setDraft: (update: (draft: StudioDraft) => StudioDraft) => void;
  onOpen: (id: string) => void; onOpenDisassembly: (id: string) => void; onCreated: (disassembly: Disassembly) => void;
  incoming?: IncomingSource[]; onIncomingTaken?: (count: number) => void;
}
type Resume = { kind: 'lesson'; lesson: Lesson; state: LearnerState } | { kind: 'disassembly'; disassembly: Disassembly; state: DisassemblyState };
const touched = (state: DisassemblyState) => state.path.length > 0 || !!state.selected || Object.keys(state.runs).length > 0 || Object.keys(state.notes).length > 0 || Object.keys(state.reassembly.placements).length > 0;

export function Library({ lessons, generated, disassemblies, bridge, error, skipped, draft, setDraft, onOpen, onOpenDisassembly, onCreated, incoming = [], onIncomingTaken }: Props) {
  const { t, language } = usePreferences();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otherLanguage, setOtherLanguage] = useState(false);
  const [resume, setResume] = useState<Resume>();
  // A text from an AI assistant opens Studio, which adds it to the draft.
  const arrived = incoming.length > 0;
  useEffect(() => { if (arrived) setCreating(true); }, [arrived]);
  useEffect(() => {
    let active = true;
    // Opening an item shows the full recoverable load error, so a failure here only drops the resume card.
    const lessonItems = [...generated, ...lessons].map(async (lesson): Promise<Resume | undefined> => {
      try {
        const result = await bridge.loadProgress({ lessonId: lesson.id, revision: lesson.revision });
        if (result.state == null || result.notice) return undefined;
        const restored = restoreState(lesson, result.state);
        return restored.notice ? undefined : { kind: 'lesson', lesson, state: restored.state };
      } catch { return undefined; }
    });
    const disassemblyItems = disassemblies.map(async (disassembly): Promise<Resume | undefined> => {
      try {
        const result = await bridge.loadProgress({ disassemblyId: disassembly.id, revision: disassembly.revision });
        if (result.state == null || result.noticeCode) return undefined;
        const restored = restoreDisassemblyState(disassembly, result.state);
        return restored.notice || !touched(restored.state) ? undefined : { kind: 'disassembly', disassembly, state: restored.state };
      } catch { return undefined; }
    });
    void Promise.all([...disassemblyItems, ...lessonItems]).then(items => {
      if (!active) return;
      let recent: string | null = null;
      try { recent = localStorage.getItem(recentKey); } catch { /* Optional ordering hint. */ }
      const id = (x: Resume) => x.kind === 'lesson' ? x.lesson.id : x.disassembly.id;
      setResume(items.find(x => x && id(x) === recent) ?? items.find(x => x !== undefined));
    });
    return () => { active = false; };
  }, [lessons, generated, disassemblies, bridge]);
  // Examples in the interface language come first; the other language is one click away.
  const shown = disassemblies.filter(x => otherLanguage || x.language === language || x.kind === 'generated');
  const hidden = disassemblies.length - shown.length;
  const other = language === 'it' ? 'en' : 'it';
  const legacy = [...generated, ...lessons];

  if (creating) return <main id="main" className="library creation-page">
    <button className="text-button" disabled={busy} onClick={() => setCreating(false)}><ArrowLeft size={16}/>{t.library.back}</button>
    <Studio studio={bridge.studio} draft={draft} setDraft={setDraft} onCreated={onCreated} onBusyChange={setBusy} incoming={incoming} onIncomingTaken={onIncomingTaken}/>
    <p className="draft-note">{t.library.draftNote}</p>
  </main>;

  return <main id="main" className="library library-home">
    <div className="home-heading"><div><span className="eyebrow">{t.library.eyebrow}</span><h1>{resume ? t.library.resumeTitle : t.library.emptyTitle}</h1><p>{t.library.subtitle}</p></div><button className="primary" onClick={() => setCreating(true)}><Plus size={18}/>{draft.sources.length || draft.outcome ? t.library.continueDraft : t.library.create}</button></div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {resume && <section className="resume-section" aria-labelledby="resume-heading"><span className="eyebrow" id="resume-heading">{t.library.resumeEyebrow}</span>{resume.kind === 'lesson'
      ? <button className="resume-card" onClick={() => onOpen(resume.lesson.id)}><span className="card-symbol"><Icon name={resume.lesson.icon} size={27}/></span><span className="resume-copy"><strong>{resume.lesson.title}</strong><small>{t.library.resumeStep(resume.lesson.pages.findIndex(x => x.id === resume.state.pageId) + 1, resume.lesson.pages.length, resume.lesson.pages.find(x => x.id === resume.state.pageId)?.title ?? '')}</small></span><span className="resume-action">{t.library.resume}<ArrowRight size={18}/></span></button>
      : <button className="resume-card" onClick={() => onOpenDisassembly(resume.disassembly.id)}><span className="card-symbol"><PartIcon name={resume.disassembly.parts[0].icon} size={27}/></span><span className="resume-copy"><strong lang={resume.disassembly.language}>{resume.disassembly.title}</strong><small>{t.library.resumeDisassembly(resume.disassembly.whole.name)}</small></span><span className="resume-action">{t.library.resume}<ArrowRight size={18}/></span></button>}</section>}
    <section className="library-section" aria-labelledby="disassemblies-heading"><div className="library-section-head"><h2 id="disassemblies-heading">{t.library.disassemblies}</h2><span className="pill">{t.library.disassembliesPill}</span></div>
      <p className="library-disclosure">{t.library.disassembliesNote}</p>
      <div className="lesson-cards">{shown.map(item => <DisassemblyCard key={item.id} d={item} onOpen={onOpenDisassembly}/>)}</div>
      {!disassemblies.length && !error && <p role="status">{t.library.checking}</p>}
      {(hidden > 0 || otherLanguage) && <label className="atlas-all"><input type="checkbox" checked={otherLanguage} onChange={e => setOtherLanguage(e.target.checked)}/>{t.library.otherLanguage(t.languageNames[other])}</label>}
    </section>
    {(legacy.length > 0 || skipped > 0) && <section className="library-section" aria-labelledby="earlier-heading"><div className="library-section-head"><h2 id="earlier-heading">{t.library.earlier}</h2><span className="micro">{t.library.fromSources}</span></div>
      <p className="library-disclosure">{t.library.earlierNote}</p>
      {skipped > 0 && <p className="notice" role="status">{t.library.skipped(skipped)}</p>}
      <div className="lesson-cards">{legacy.map(item => <CourseCard key={item.id} lesson={item} onOpen={onOpen}/>)}</div>
    </section>}
    <footer className="library-footer"><Icon name="shield" size={16}/><span>{t.library.footer}</span></footer>
  </main>;
}

function CourseCard({ lesson, onOpen }: { lesson: Lesson; onOpen: (id: string) => void }) {
  const { t } = usePreferences();
  return <button className={`lesson-card ${lesson.kind === 'generated' ? 'generated-card' : ''}`} onClick={() => onOpen(lesson.id)}><span className="card-head"><span className="card-symbol"><Icon name={lesson.icon} size={25}/></span><span className="micro">{lesson.kind !== 'generated' ? lesson.category : lesson.generation?.provider === 'local' ? t.library.generatedLocal : t.library.generatedAi}</span></span><h3>{lesson.title}</h3><p>{lesson.subtitle}</p><span className="card-bottom"><span>{t.library.cardCounts(lesson.pages.length, lesson.activities.length)}</span><ArrowRight size={18}/></span></button>;
}

function DisassemblyCard({ d, onOpen }: { d: Disassembly; onOpen: (id: string) => void }) {
  const { t, language } = usePreferences();
  return <button className="lesson-card disassembly-card" onClick={() => onOpen(d.id)}><span className="card-head"><span className="card-symbol"><PartIcon name={d.parts[0].icon} size={25}/></span>
    <span className="micro" title={d.generation ? originText(t, d.generation) : undefined}>{d.generation?.provider === 'assistant' ? t.d.tagAssistant : d.kind === 'generated' ? t.d.tagGenerated : t.d.tag}{d.language !== language ? ` · ${t.library.contentLanguage(t.languageNames[d.language])}` : ''}</span></span>
    <h3 lang={d.language}>{d.title}</h3><p lang={d.language}>{d.question}</p>
    <span className="card-bottom"><span>{t.library.disassemblyCounts(d.parts.length, d.runs.length)}</span><ArrowRight size={18}/></span></button>;
}
