import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Cpu, FileText, KeyRound, LogOut, RefreshCw, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import { buildGenerationInput, estimateProgress, expectedDraftChars } from '../core/generation';
import type { Lesson } from '../core/lesson';
import { RUNTIME_NAMES, type AccountStatus, type GenerationProgress, type GenerationRoute, type LocalModel, type LocalServer, type ModelOption, type ProviderFailure, type StudioBridge, type StudioSettings } from '../core/provider';
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
  const [settings, setSettings] = useState<StudioSettings>();
  const [status, setStatus] = useState<AccountStatus>();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [problem, setProblem] = useState<ProviderFailure>();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ received: 0, phase: 'generating' });
  const provider = settings?.provider ?? 'chatgpt';
  const planReady = status?.state === 'signed-in' && status.planUsage;
  const chatgptModel = models.some(m => m.slug === settings?.chatgptModel) ? settings!.chatgptModel! : models[0]?.slug ?? '';

  useEffect(() => { if (studio) { void studio.getSettings().then(setSettings); void studio.accountStatus().then(setStatus); } }, [studio]);
  useEffect(() => {
    if (!studio || !planReady || provider !== 'chatgpt') return;
    let active = true;
    void studio.listModels().then(result => {
      if (!active) return;
      if (!result.ok) { setProblem(result.failure); return; }
      setModels(result.models);
    });
    return () => { active = false; };
  }, [studio, planReady, provider]);
  // Each phase keeps its own clock: when it started and when its first characters arrived.
  const clock = useRef({ phase: 'generating', startedAt: 0, firstAt: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => studio?.onGenerationProgress(next => {
    const t = Date.now();
    if (next.phase !== clock.current.phase) clock.current = { phase: next.phase, startedAt: t, firstAt: 0 };
    if (next.received && !clock.current.firstAt) clock.current.firstAt = t;
    setProgress(next);
  }), [studio]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [running]);
  const estimate = estimateProgress({ received: progress.received, expected: expectedDraftChars(sources.reduce((sum, x) => sum + x.text.length, 0)), elapsedMs: Math.max(0, now - clock.current.startedAt), streamingMs: clock.current.firstAt ? Math.max(0, now - clock.current.firstAt) : 0 });
  const remaining = estimate.remainingSeconds === undefined ? (!progress.received ? 'il modello sta leggendo le fonti' : estimate.percent >= 90 ? 'quasi finito' : 'calcolo il tempo rimanente…')
    : estimate.remainingSeconds < 60 ? `circa ${estimate.remainingSeconds} s rimanenti` : `circa ${Math.round(estimate.remainingSeconds / 60)} min rimanenti`;

  const sent = useMemo(() => goal && sources.length ? buildGenerationInput(sources, goal) : '', [sources, goal]);
  if (!studio) return <div className="studio-step"><span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>Genera</span><p className="step-hint">Accesso e generazione sono disponibili nell’app desktop. In questa anteprima puoi preparare fonti e obiettivo.</p></div>;

  const update = (next: StudioSettings) => { setSettings(next); setProblem(undefined); void studio.saveSettings(next); };
  const signIn = async (consent = false) => {
    setProblem(undefined); setStatus(s => ({ state: 'signing-in', storage: s?.storage ?? true }));
    const result = await studio.signIn({ consent });
    if (!result.ok) setProblem(result.failure);
    setStatus(await studio.accountStatus());
  };
  const local = settings?.local;
  const route: GenerationRoute | undefined = provider === 'local'
    ? local && { provider: 'local', runtime: local.runtime, baseUrl: local.baseUrl, model: local.model }
    : planReady && chatgptModel ? { provider: 'chatgpt', model: chatgptModel } : undefined;
  const generate = async () => {
    if (!goal || !route) return;
    setProblem(undefined); setRunning(true); setProgress({ received: 0, phase: 'generating' }); onBusyChange(true);
    clock.current = { phase: 'generating', startedAt: Date.now(), firstAt: 0 }; setNow(Date.now());
    try {
      const result = await studio.generate({ sources, goal, route });
      if (result.ok) onCreated(result.lesson);
      else { setProblem(result.failure); if (result.failure.action === 'sign-in') setStatus(await studio.accountStatus()); }
    } finally { setRunning(false); onBusyChange(false); }
  };
  const missing = [!sources.length && 'almeno una fonte', !goal && 'un obiettivo',
    provider === 'chatgpt' ? (!planReady ? 'l’accesso a ChatGPT' : !chatgptModel && 'un modello') : !local && 'un modello locale'].filter(Boolean);
  const action = (f: ProviderFailure) => f.action === 'sign-in' ? <button onClick={() => void signIn()}>Accedi di nuovo</button>
    : f.action === 'enable-plan' ? <button onClick={() => void signIn(true)}>Abilita l’uso del piano</button>
    : f.action === 'usage-settings' ? <button onClick={() => void studio.openUsageSettings()}>Apri le impostazioni di ChatGPT</button>
    : (f.action === 'retry' || f.action === 'local-setup') && f.code !== 'cancelled' ? <button disabled={!!missing.length} onClick={() => void generate()}>Riprova</button> : null;

  return <div className="studio-step">
    <span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>Genera</span>
    <div className="mode-switch route-switch" role="group" aria-label="Con cosa generare">
      <button aria-pressed={provider === 'chatgpt'} disabled={running || !settings} onClick={() => settings && update({ ...settings, provider: 'chatgpt' })}><KeyRound size={15}/>ChatGPT</button>
      <button aria-pressed={provider === 'local'} disabled={running || !settings} onClick={() => settings && update({ ...settings, provider: 'local' })}><Cpu size={15}/>Modello locale</button>
    </div>
    {provider === 'chatgpt' ? <div className="account-card" aria-live="polite">
      {!status ? <p className="micro plain">Controllo dell’account…</p>
        : !status.storage ? <p className="field-error">Il portachiavi di sistema non è disponibile: l’accesso è disattivato per non salvare credenziali in chiaro.</p>
        : status.state === 'signing-in' ? <><p><KeyRound size={16}/> Completa l’accesso nella finestra del browser.</p><button className="subtle" onClick={() => void studio.cancelSignIn()}>Annulla l’accesso</button></>
        : status.state === 'signed-out' ? <><p>Usa il tuo account ChatGPT. Si apre il browser; le credenziali restano nel portachiavi di questo Mac.</p><button className="primary" onClick={() => void signIn()}><KeyRound size={16}/>Accedi con ChatGPT</button></>
        : <><p className="account-line"><span className="status-dot"/><span>{status.email ?? 'Account ChatGPT'}</span><button className="text-button" onClick={() => void studio.signOut().then(setStatus)}><LogOut size={14}/>Esci</button></p>
          {!status.planUsage ? <button className="subtle" onClick={() => void signIn(true)}>Abilita l’uso del piano ChatGPT</button>
            : <label>Modello<select value={chatgptModel} onChange={e => settings && update({ ...settings, chatgptModel: e.target.value })}>{models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>}</>}
      {status && 'notice' in status && status.notice && <p className="micro plain">{status.notice}</p>}
    </div> : settings && <LocalModelPanel studio={studio} current={local} disabled={running} onChange={next => update({ ...settings, provider: 'local', local: next })}/>}
    <details className="sent-preview"><summary>Cosa verrà inviato</summary>
      {sent ? <><p className="micro plain">{provider === 'local' && local
        ? `Solo quando premi «Genera»: questo testo, le istruzioni fisse dell’app e lo schema del percorso vanno a ${RUNTIME_NAMES[local.runtime]} su questo Mac (${local.baseUrl}). La fonte non lascia il computer.`
        : 'Solo quando premi «Genera»: questo testo, le istruzioni fisse dell’app e lo schema del percorso. Nient’altro dal tuo computer.'}</p><pre tabIndex={0}>{sent}</pre></> : <p className="micro plain">Aggiungi fonti e obiettivo per vedere la richiesta.</p>}
    </details>
    {running ? <div className="generating">
        <div className="generating-head"><span className="spinner" aria-hidden="true"/><span role="status">{progress.phase === 'repairing' ? 'Seconda passata: correggo i riferimenti della bozza…' : 'Il percorso prende forma…'}</span><button className="subtle" onClick={() => void studio.cancelGeneration()}>Annulla</button></div>
        <progress max={100} value={estimate.percent} aria-label="Avanzamento stimato della generazione"/>
        <p className="micro plain">{estimate.percent}% · {remaining}{progress.received ? ` · ${fmt(progress.received)} caratteri ricevuti` : ''} · stima basata sulla lunghezza tipica di un percorso</p>
      </div>
      : <button className="primary generate-button" disabled={!!missing.length} onClick={() => void generate()}><Sparkles size={17}/>Genera il percorso</button>}
    {!running && missing.length > 0 && <p className="micro plain">Serve ancora {missing.join(', ')}.</p>}
    {problem && <div className={problem.code === 'cancelled' ? 'notice' : 'error-banner'} role="alert"><div><p>{problem.message}</p>{problem.issues && <ul className="issue-list">{problem.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>}{problem.requestId && <p className="micro plain">Richiesta {problem.requestId}</p>}</div>{action(problem)}</div>}
  </div>;
}

type LocalChoice = NonNullable<StudioSettings['local']>;

/** Finds model servers on this Mac, lets the learner pick a model, and records whether the server enforces the lesson format. */
function LocalModelPanel({ studio, current, disabled, onChange }: { studio: StudioBridge; current?: LocalChoice; disabled: boolean; onChange: (next: LocalChoice) => void }) {
  const [editing, setEditing] = useState(!current);
  const [servers, setServers] = useState<LocalServer[]>();
  const [searching, setSearching] = useState(false);
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState('');
  const [problem, setProblem] = useState<ProviderFailure>();
  const search = async () => {
    setSearching(true); setProblem(undefined);
    try { setServers(await studio.discoverLocal()); } finally { setSearching(false); }
  };
  // Opening the chooser searches once; later searches are explicit.
  useEffect(() => { if (editing && servers === undefined) void search(); }, [editing]);
  const connect = async () => {
    setProblem(undefined);
    const result = await studio.connectLocal(address);
    if (result.ok) { setServers(list => [result.server, ...(list ?? []).filter(x => x.baseUrl !== result.server.baseUrl)]); setAddress(''); }
    else setProblem(result.failure);
  };
  const choose = async (target: LocalModel) => {
    setChecking(target.model); setProblem(undefined);
    const result = await studio.checkLocalFormat(target);
    setChecking('');
    if (!result.ok) { setProblem(result.failure); return; }
    onChange({ ...target, check: result.check }); setEditing(false);
  };
  const badge = (choice: LocalChoice) => choice.check && <p className={`format-check ${choice.check.enforced ? 'ok' : 'warn'}`}>{choice.check.enforced ? <Check size={15}/> : <TriangleAlert size={15}/>}<span><strong>{choice.check.enforced ? 'Formato garantito' : 'Formato non garantito'}</strong>{choice.check.detail}</span></p>;

  if (!editing && current) return <div className="account-card local-card" aria-live="polite">
    <p className="account-line"><Cpu size={16}/><span>{current.model}</span></p>
    <p className="micro plain">{RUNTIME_NAMES[current.runtime]} · {current.baseUrl} · la fonte resta su questo Mac</p>
    {checking ? <p className="micro plain" role="status">Ricontrollo il formato…</p> : badge(current)}
    {problem && <p className="field-error" role="alert">{problem.message}</p>}
    <div className="studio-actions"><button className="subtle" disabled={disabled} onClick={() => setEditing(true)}>Cambia modello</button><button className="text-button" disabled={disabled || !!checking} onClick={() => void choose({ runtime: current.runtime, baseUrl: current.baseUrl, model: current.model })}>Ricontrolla il formato</button></div>
  </div>;

  return <div className="account-card local-card" aria-live="polite">
    <p className="account-line"><Cpu size={16}/><span>Modelli su questo Mac</span><button className="text-button" disabled={searching || !!checking} onClick={() => void search()}><RefreshCw size={14}/>Cerca di nuovo</button></p>
    {searching ? <p className="micro plain" role="status">Cerco Ollama, LM Studio e llama.cpp sulle porte standard…</p>
      : servers?.length ? <ul className="local-servers">{servers.map(server => <li key={server.baseUrl}>
          <span className="server-name">{RUNTIME_NAMES[server.runtime]}<small>{server.baseUrl}{server.version ? ` · v${server.version}` : ''}</small></span>
          {server.models.length ? <ul>{server.models.map(model => <li key={model}><span>{model}</span><button className="subtle" disabled={!!checking || disabled} onClick={() => void choose({ runtime: server.runtime, baseUrl: server.baseUrl, model })}>{checking === model ? 'Controllo…' : 'Usa questo'}</button></li>)}</ul>
            : <p className="micro plain">Nessun modello disponibile in questo server.</p>}
        </li>)}</ul>
      : servers && <div className="local-guide"><p>Non ho trovato server di modelli avviati. Avviane uno, poi premi «Cerca di nuovo»:</p><ul>
          <li><strong>LM Studio</strong>: scarica un modello, poi Developer → Start Server (porta 1234).</li>
          <li><strong>Ollama</strong>: apri l’app o esegui <code>ollama serve</code> (porta 11434).</li>
          <li><strong>llama.cpp</strong>: <code>llama-server -m modello.gguf -c 32768</code> (porta 8080).</li>
        </ul><p className="micro plain">Serve un modello capace e almeno 32 GB di memoria: nella prova, Qwen3.6-35B-A3B ha superato i controlli in 2 casi su 3; i modelli più piccoli spesso falliscono.</p></div>}
    {checking && <p className="micro plain" role="status">Controllo se il server impone il formato del percorso. Se il modello non è ancora in memoria può servire un minuto.</p>}
    <div className="local-address"><label>Altro indirizzo su questo Mac<input value={address} placeholder="es. localhost:8092" onChange={e => setAddress(e.target.value)}/></label><button className="subtle" disabled={!address.trim() || !!checking} onClick={() => void connect()}>Collega</button></div>
    {problem && <p className="field-error" role="alert">{problem.message}</p>}
    {current && <button className="text-button" onClick={() => setEditing(false)}>Mantieni {current.model}</button>}
  </div>;
}
