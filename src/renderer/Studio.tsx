import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, FileText, KeyRound, LogOut, Sparkles, Trash2, X } from 'lucide-react';
import { buildGenerationInput } from '../core/generation';
import type { Lesson } from '../core/lesson';
import type { AccountStatus, ModelOption, ProviderFailure, StudioBridge } from '../core/provider';
import { checkSelection, CODE_LANGUAGES, goalSchema, importSource, SOURCE_LIMITS, SourceImportError, type UserSource } from '../core/source';
import { Icon } from './icons';

export interface StudioDraft { sources: UserSource[]; outcome: string; prior: string }
export const emptyDraft: StudioDraft = { sources: [], outcome: '', prior: '' };
const fmt = (n: number) => n.toLocaleString('it-IT');

/** Source workspace → goal → account and generation. Nothing leaves the device before "Genera il percorso". */
export function Studio({ studio, draft, setDraft, onCreated, onBusyChange }: { studio?: StudioBridge; draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; onCreated: (lesson: Lesson) => void; onBusyChange?: (busy: boolean) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '', language: '' });
  const total = draft.sources.reduce((sum, x) => sum + x.text.length, 0);
  const goal = goalSchema.safeParse({ outcome: draft.outcome, priorKnowledge: draft.prior });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [step]);

  const add = (incoming: UserSource[], extra: string[] = []) => {
    const problems = [...extra];
    let next = draft.sources;
    for (const source of incoming) {
      try { checkSelection([...next, source]); next = [...next, source]; }
      catch (error) { problems.push(`${source.title}: ${(error as Error).message}`); }
    }
    setDraft(d => ({ ...d, sources: next }));
    setErrors(problems);
    return problems.length === extra.length;
  };
  const addPaste = async () => {
    try {
      const source = await importSource({ kind: 'paste', ...paste });
      if (add([source])) { setPaste({ title: '', text: '', language: '' }); setPasting(false); }
    } catch (error) { setErrors([error instanceof SourceImportError ? error.message : 'Il testo non può essere importato.']); }
  };
  const pickFiles = async () => {
    if (!studio) return;
    const picked = await studio.pickSources();
    add(picked.sources, picked.errors.map(x => x.message));
  };

  return <section className="studio" aria-labelledby="studio-title">
    <div className="library-section-head"><div><span className="eyebrow">CREA UN PERCORSO</span><h1 id="studio-title" ref={titleRef} tabIndex={-1}>Rompi il muro su una tua fonte.</h1></div></div>
    <nav className="creation-steps" aria-label="Passaggi di creazione"><ol>{['Materiale', 'Obiettivo', 'Generazione'].map((label, i) => <li key={label}><button aria-current={step === i ? 'step' : undefined} disabled={busy || (i > 0 && !draft.sources.length) || (i > 1 && !goal.success)} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button></li>)}</ol></nav>
    <div className="studio-steps">
      <div className="studio-step" hidden={step !== 0}>
        <span className="step-label"><Icon name="book" size={18}/>Scegli cosa studiare</span>
        <p className="step-hint">Testo incollato o file .txt e .md. Fino a {SOURCE_LIMITS.maxSources} fonti e {fmt(SOURCE_LIMITS.maxTotalChars)} caratteri.</p>
        <div className="studio-actions">
          <button className="subtle" aria-expanded={pasting} onClick={() => setPasting(x => !x)}><ClipboardPaste size={16}/>Incolla testo</button>
          <button className="subtle" disabled={!studio} onClick={() => void pickFiles()}><FileText size={16}/>Scegli file</button>
        </div>
        {!studio && <p className="micro plain">La scelta dei file è disponibile nell’app desktop.</p>}
        {pasting && <div className="paste-form">
          <label>Nome della fonte<input value={paste.title} maxLength={SOURCE_LIMITS.maxTitleChars} placeholder="es. Appunti sul TCP handshake" onChange={e => setPaste(p => ({ ...p, title: e.target.value }))}/></label>
          <label>Tipo<select value={paste.language} onChange={e => setPaste(p => ({ ...p, language: e.target.value }))}><option value="">Testo</option>{CODE_LANGUAGES.map(x => <option key={x} value={x}>{x === 'Codice' ? 'Altro codice' : `Codice ${x}`}</option>)}</select></label>
          <label>Testo<textarea rows={7} value={paste.text} onChange={e => setPaste(p => ({ ...p, text: e.target.value }))} placeholder="Incolla qui il materiale da studiare…"/></label>
          <p className="micro plain">{fmt(paste.text.length)} / {fmt(SOURCE_LIMITS.maxCharsPerSource)} caratteri</p>
          <button className="primary" onClick={() => void addPaste()}>Aggiungi fonte</button>
        </div>}
        {errors.length > 0 && <div className="error-banner" role="alert"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul><button aria-label="Chiudi errori" onClick={() => setErrors([])}><X size={14}/></button></div>}
        {draft.sources.length > 0 && <ul className="source-list">{draft.sources.map(source => <li key={source.id}><details>
          <summary><Icon name={source.language ? 'code' : 'book'} size={17}/><span><strong>{source.title}</strong><small>{fmt(source.text.split('\n').length)} righe · {fmt(source.text.length)} caratteri · {source.origin === 'user-file' ? 'file' : 'incollato'}</small></span></summary>
          <SourcePreview source={source}/>
        </details><button className="icon-button" aria-label={`Rimuovi ${source.title}`} onClick={() => setDraft(d => ({ ...d, sources: d.sources.filter(x => x.id !== source.id) }))}><Trash2 size={15}/></button></li>)}</ul>}
        <progress className="source-capacity" aria-label="Spazio usato dalle fonti" value={total} max={SOURCE_LIMITS.maxTotalChars}/>
        <p className="micro plain">{draft.sources.length}/{SOURCE_LIMITS.maxSources} fonti · {fmt(total)} / {fmt(SOURCE_LIMITS.maxTotalChars)} caratteri</p>
        <div className="creation-controls"><span>Il materiale resta sul dispositivo fino alla generazione.</span><button className="primary" disabled={!draft.sources.length} onClick={() => setStep(1)}>Continua con l’obiettivo<ArrowRight size={16}/></button></div>
      </div>
      <div className="studio-step" hidden={step !== 1}>
        <span className="step-label"><Icon name="target" size={18}/>Dai una direzione al percorso</span>
        <p className="step-hint">Hai scelto {draft.sources.length} {draft.sources.length === 1 ? 'fonte' : 'fonti'}. Ora definisci il collegamento che vuoi costruire.</p>
        <label>Alla fine, cosa vuoi saper spiegare o fare?<textarea rows={4} maxLength={400} value={draft.outcome} placeholder="es. Spiegare perché il client invia ACK dopo SYN-ACK e cosa succede se si perde" onChange={e => setDraft(d => ({ ...d, outcome: e.target.value }))}/></label>
        <label><span>Cosa sai già? <span className="optional">facoltativo</span></span><input maxLength={200} value={draft.prior} placeholder="es. Conosco IP, non TCP" onChange={e => setDraft(d => ({ ...d, prior: e.target.value }))}/></label>
        {draft.outcome && !goal.success && <p className="field-error">{goal.error.issues[0]?.message}</p>}
        <div className="creation-controls"><button className="subtle" onClick={() => setStep(0)}><ArrowLeft size={16}/>Materiale</button><button className="primary" disabled={!goal.success} onClick={() => setStep(2)}>Continua alla generazione<ArrowRight size={16}/></button></div>
      </div>
      {step === 2 && <><div className="generation-summary"><span><Icon name="book" size={16}/>{draft.sources.length} {draft.sources.length === 1 ? 'fonte' : 'fonti'}</span><p>{draft.outcome}</p><button className="text-button" disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={14}/>Modifica l’obiettivo</button></div><Generate studio={studio} sources={draft.sources} goal={goal.success ? goal.data : undefined} onCreated={onCreated} onBusyChange={value => { setBusy(value); onBusyChange?.(value); }}/></>}
    </div>
  </section>;
}

/** The numbered lines shown here are the same text and numbering sent to the model. */
export function SourcePreview({ source }: { source: UserSource }) {
  const lines = source.text.split('\n');
  return <div className={`source-lines preview-lines ${source.language ? 'code-lines' : ''}`} tabIndex={0} aria-label={`Anteprima di ${source.title}`}>
    {lines.slice(0, 400).map((line, i) => <div key={i} className="source-line"><span className="line-number" aria-hidden="true">{i + 1}</span><span>{line || ' '}</span></div>)}
    {lines.length > 400 && <p className="preview-more">Anteprima delle prime 400 righe su {fmt(lines.length)}. Tutte le righe saranno inviate.</p>}
  </div>;
}

function Generate({ studio, sources, goal, onCreated, onBusyChange }: { studio?: StudioBridge; sources: UserSource[]; goal?: { outcome: string; priorKnowledge: string }; onCreated: (lesson: Lesson) => void; onBusyChange: (value: boolean) => void }) {
  const [status, setStatus] = useState<AccountStatus>();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState('');
  const [problem, setProblem] = useState<ProviderFailure>();
  const [running, setRunning] = useState(false);
  const [received, setReceived] = useState(0);
  const planReady = status?.state === 'signed-in' && status.planUsage;

  useEffect(() => { if (studio) void studio.accountStatus().then(setStatus); }, [studio]);
  useEffect(() => {
    if (!studio || !planReady) return;
    let active = true;
    void studio.listModels().then(result => {
      if (!active) return;
      if (!result.ok) { setProblem(result.failure); return; }
      setModels(result.models); setModel(m => result.models.some(x => x.slug === m) ? m : result.models[0]?.slug ?? '');
    });
    return () => { active = false; };
  }, [studio, planReady]);
  useEffect(() => studio?.onGenerationProgress(p => setReceived(p.received)), [studio]);

  const sent = useMemo(() => goal && sources.length ? buildGenerationInput(sources, goal) : '', [sources, goal]);
  if (!studio) return <div className="studio-step"><span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>Genera</span><p className="step-hint">Accesso e generazione sono disponibili nell’app desktop. In questa anteprima puoi preparare fonti e obiettivo.</p></div>;

  const signIn = async (consent = false) => {
    setProblem(undefined); setStatus(s => ({ state: 'signing-in', storage: s?.storage ?? true }));
    const result = await studio.signIn({ consent });
    if (!result.ok) setProblem(result.failure);
    setStatus(await studio.accountStatus());
  };
  const generate = async () => {
    if (!goal) return;
    setProblem(undefined); setRunning(true); setReceived(0); onBusyChange(true);
    try {
      const result = await studio.generate({ sources, goal, model });
      if (result.ok) onCreated(result.lesson);
      else { setProblem(result.failure); if (result.failure.action === 'sign-in') setStatus(await studio.accountStatus()); }
    } finally { setRunning(false); onBusyChange(false); }
  };
  const missing = [!sources.length && 'almeno una fonte', !goal && 'un obiettivo', !planReady && 'l’accesso a ChatGPT', planReady && !model && 'un modello'].filter(Boolean);
  const action = (f: ProviderFailure) => f.action === 'sign-in' ? <button onClick={() => void signIn()}>Accedi di nuovo</button>
    : f.action === 'enable-plan' ? <button onClick={() => void signIn(true)}>Abilita l’uso del piano</button>
    : f.action === 'usage-settings' ? <button onClick={() => void studio.openUsageSettings()}>Apri le impostazioni di ChatGPT</button>
    : f.action === 'retry' && f.code !== 'cancelled' ? <button disabled={!!missing.length} onClick={() => void generate()}>Riprova</button> : null;

  return <div className="studio-step">
    <span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>Genera</span>
    <div className="account-card" aria-live="polite">
      {!status ? <p className="micro plain">Controllo dell’account…</p>
        : !status.storage ? <p className="field-error">Il portachiavi di sistema non è disponibile: l’accesso è disattivato per non salvare credenziali in chiaro.</p>
        : status.state === 'signing-in' ? <><p><KeyRound size={16}/> Completa l’accesso nella finestra del browser.</p><button className="subtle" onClick={() => void studio.cancelSignIn()}>Annulla l’accesso</button></>
        : status.state === 'signed-out' ? <><p>Usa il tuo account ChatGPT. Si apre il browser; le credenziali restano nel portachiavi di questo Mac.</p><button className="primary" onClick={() => void signIn()}><KeyRound size={16}/>Accedi con ChatGPT</button></>
        : <><p className="account-line"><span className="status-dot"/><span>{status.email ?? 'Account ChatGPT'}</span><button className="text-button" onClick={() => void studio.signOut().then(setStatus)}><LogOut size={14}/>Esci</button></p>
          {!status.planUsage ? <button className="subtle" onClick={() => void signIn(true)}>Abilita l’uso del piano ChatGPT</button>
            : <label>Modello<select value={model} onChange={e => setModel(e.target.value)}>{models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>}</>}
      {status && 'notice' in status && status.notice && <p className="micro plain">{status.notice}</p>}
    </div>
    <details className="sent-preview"><summary>Cosa verrà inviato</summary>
      {sent ? <><p className="micro plain">Solo quando premi «Genera»: questo testo, le istruzioni fisse dell’app e lo schema del percorso. Nient’altro dal tuo computer.</p><pre tabIndex={0}>{sent}</pre></> : <p className="micro plain">Aggiungi fonti e obiettivo per vedere la richiesta.</p>}
    </details>
    {running ? <div className="generating" role="status"><span className="spinner" aria-hidden="true"/><span>Il percorso prende forma… {received ? `${fmt(received)} caratteri ricevuti` : 'in attesa della risposta'}</span><button className="subtle" onClick={() => void studio.cancelGeneration()}>Annulla</button></div>
      : <button className="primary generate-button" disabled={!!missing.length} onClick={() => void generate()}><Sparkles size={17}/>Genera il percorso</button>}
    {!running && missing.length > 0 && <p className="micro plain">Serve ancora {missing.join(', ')}.</p>}
    {problem && <div className={problem.code === 'cancelled' ? 'notice' : 'error-banner'} role="alert"><div><p>{problem.message}</p>{problem.issues && <ul className="issue-list">{problem.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>}{problem.requestId && <p className="micro plain">Richiesta {problem.requestId}</p>}</div>{action(problem)}</div>}
  </div>;
}
