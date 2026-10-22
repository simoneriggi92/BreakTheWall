import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import type { DesktopBridge } from '../core/bridge';
import type { Lesson } from '../core/lesson';
import { restoreState, type LearnerState } from '../core/state';
import { Icon } from './icons';
import { Studio, type StudioDraft } from './Studio';

const recentKey = 'btw:last-opened-lesson';
export function rememberLesson(id: string) {
  try { localStorage.setItem(recentKey, id); } catch { /* A UI hint must not block a lesson. */ }
}

interface Props {
  lessons: Lesson[]; generated: Lesson[]; bridge: DesktopBridge; error: string; skipped: number;
  draft: StudioDraft; setDraft: (update: (draft: StudioDraft) => StudioDraft) => void;
  onOpen: (id: string) => void; onCreated: (lesson: Lesson) => void;
}
export function Library({ lessons, generated, bridge, error, skipped, draft, setDraft, onOpen, onCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<{ lesson: Lesson; state: LearnerState }>();
  useEffect(() => {
    let active = true;
    void Promise.all([...generated, ...lessons].map(async lesson => {
      try {
        const result = await bridge.loadProgress({ lessonId: lesson.id, revision: lesson.revision });
        if (result.state == null || result.notice) return undefined;
        const restored = restoreState(lesson, result.state);
        return restored.notice ? undefined : { lesson, state: restored.state };
      } catch { return undefined; } // Opening a course shows the full recoverable load error.
    })).then(items => {
      if (!active) return;
      let recent: string | null = null;
      try { recent = localStorage.getItem(recentKey); } catch { /* Optional ordering hint. */ }
      setResume(items.find(x => x?.lesson.id === recent) ?? items.find(x => x !== undefined));
    });
    return () => { active = false; };
  }, [lessons, generated, bridge]);

  if (creating) return <main id="main" className="library creation-page">
    <button className="text-button" disabled={busy} onClick={() => setCreating(false)}><ArrowLeft size={16}/>Torna ai percorsi</button>
    <Studio studio={bridge.studio} draft={draft} setDraft={setDraft} onCreated={onCreated} onBusyChange={setBusy}/>
    <p className="draft-note">Le fonti aggiunte e l’obiettivo restano in bozza se torni ai percorsi durante questa sessione.</p>
  </main>;

  return <main id="main" className="library library-home">
    <div className="home-heading"><div><span className="eyebrow">IL TUO SPAZIO DI STUDIO</span><h1>{resume ? 'Riparti dai tuoi collegamenti.' : 'Cosa vuoi capire oggi?'}</h1><p>Una fonte, un obiettivo, un concetto alla volta.</p></div><button className="primary" onClick={() => setCreating(true)}><Plus size={18}/>{draft.sources.length || draft.outcome ? 'Continua la bozza' : 'Crea un percorso'}</button></div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {resume && <section className="resume-section" aria-labelledby="resume-heading"><span className="eyebrow" id="resume-heading">RIPRENDI DA DOVE ERI</span><button className="resume-card" onClick={() => onOpen(resume.lesson.id)}><span className="card-symbol"><Icon name={resume.lesson.icon} size={27}/></span><span className="resume-copy"><strong>{resume.lesson.title}</strong><small>Tappa {resume.lesson.pages.findIndex(x => x.id === resume.state.pageId) + 1} di {resume.lesson.pages.length} · {resume.lesson.pages.find(x => x.id === resume.state.pageId)?.title}</small></span><span className="resume-action">Riprendi<ArrowRight size={18}/></span></button></section>}
    {(generated.length > 0 || skipped > 0) && <section className="library-section" aria-labelledby="saved-heading"><div className="library-section-head"><h2 id="saved-heading">I tuoi percorsi</h2><span className="micro">DALLE TUE FONTI</span></div>
      {skipped > 0 && <p className="notice" role="status">{skipped} percorsi non hanno superato il controllo. I file restano sul disco.</p>}
      <div className="lesson-cards">{generated.map(item => <CourseCard key={item.id} lesson={item} onOpen={onOpen}/>)}</div>
    </section>}
    <section className="library-section" aria-labelledby="examples-heading"><div className="library-section-head"><h2 id="examples-heading">Esplora un esempio</h2><span className="pill">ESEMPI PREPARATI</span></div><p className="library-disclosure">Contenuti originali pronti da esplorare. Non sono lezioni generate dall’AI.</p><div className="lesson-cards">{lessons.map(item => <CourseCard key={item.id} lesson={item} onOpen={onOpen}/>)}</div>{!lessons.length && !error && <p role="status">Controllo delle fonti e dei percorsi…</p>}</section>
    <footer className="library-footer"><Icon name="shield" size={16}/><span>Gli esempi funzionano senza account. Progressi e appunti restano su questo dispositivo.</span></footer>
  </main>;
}

function CourseCard({ lesson, onOpen }: { lesson: Lesson; onOpen: (id: string) => void }) {
  return <button className={`lesson-card ${lesson.kind === 'generated' ? 'generated-card' : ''}`} onClick={() => onOpen(lesson.id)}><span className="card-head"><span className="card-symbol"><Icon name={lesson.icon} size={25}/></span><span className="micro">{lesson.kind === 'generated' ? 'GENERATO CON AI' : lesson.category}</span></span><h3>{lesson.title}</h3><p>{lesson.subtitle}</p><span className="card-bottom"><span>{lesson.pages.length} tappe · {lesson.activities.length} attività</span><ArrowRight size={18}/></span></button>;
}
