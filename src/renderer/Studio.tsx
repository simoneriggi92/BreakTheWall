import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Cpu, FileText, KeyRound, LogOut, RefreshCw, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import type { Disassembly } from '../core/disassembly';
import { buildStructureInput, defaultContentLanguage, type ContentLanguage } from '../core/disassembly-generation';
import { detectLanguage } from '../core/generation';
import { resumable, RUNTIME_NAMES, type AccountStatus, type DraftState, type FormatCheck, type GenerationProgress, type GenerationRoute, type GenerationSetup, type IncomingSource, type LocalModel, type LocalRuntime, type LocalServer, type ModelOption, type PickError, type ProviderFailure, type StudioBridge, type StudioSettings, type Suggestion } from '../core/provider';
import { checkSelection, CODE_LANGUAGES, goalSchema, importSource, SOURCE_LIMITS, SourceImportError, type UserSource } from '../core/source';
import { GenerationPreview } from './disassembly/GenerationPreview';
import { Icon } from './icons';
import type { Messages } from './i18n/it';
import { failureText, usePreferences } from './preferences';

/**
 * `language` is set only when the learner chose one; until then it follows the question. Suggested break-downs are
 * kept for the selection they were asked for, keyed by its sources' hashes, and never stored with a disassembly.
 */
export interface StudioDraft { sources: UserSource[]; outcome: string; prior: string; language?: ContentLanguage; suggestions?: KeptSuggestions }
interface KeptSuggestions { key: string; language: ContentLanguage; items: Suggestion[]; shown: string[] }
const selectionKey = (sources: Pick<UserSource, 'id' | 'sha256'>[]) => sources.map(s => `${s.id}:${s.sha256}`).sort().join(',');
export const emptyDraft: StudioDraft = { sources: [], outcome: '', prior: '' };
const runtimeName = (t: Messages, runtime: LocalRuntime) => runtime === 'openai' ? t.local.openaiServer : RUNTIME_NAMES[runtime];
/** Import errors are worded from their code, so they follow the interface language. */
function importText(t: Messages, n: (x: number) => string, error: Pick<PickError, 'code' | 'params' | 'message'>): string {
  const word = error.code && t.importErrors[error.code];
  return word ? word(error.params ?? {}, n) : error.message;
}

/** Source workspace → question → account and generation. Nothing leaves the device before "Genera lo smontaggio". */
export function Studio({ studio, draft, setDraft, onCreated, onBusyChange, incoming = [], onIncomingTaken }: { studio?: StudioBridge; draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; onCreated: (disassembly: Disassembly) => void; onBusyChange?: (busy: boolean) => void; incoming?: IncomingSource[]; onIncomingTaken?: (count: number) => void }) {
  const { t, n: fmt, language: interfaceLanguage } = usePreferences();
  const language = draft.language ?? defaultContentLanguage(draft.outcome, interfaceLanguage);
  // A question the app reads as another language would be stored next to content it does not match.
  const asked = detectLanguage(draft.outcome, 1);
  const languageClash = !!asked && asked !== language;
  const [errors, setErrors] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '', language: '' });
  const total = draft.sources.reduce((sum, x) => sum + x.text.length, 0);
  const goal = goalSchema.safeParse({ outcome: draft.outcome, priorKnowledge: draft.prior });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [step]);
  const routes = useRoutes(studio);

  const add = (incoming: UserSource[], extra: string[] = []) => {
    const problems = [...extra];
    let next = draft.sources;
    for (const source of incoming) {
      try { checkSelection([...next, source]); next = [...next, source]; }
      catch (error) { problems.push(`${source.title}: ${error instanceof SourceImportError ? importText(t, fmt, error) : (error as Error).message}`); }
    }
    setDraft(d => ({ ...d, sources: next }));
    setErrors(problems);
    return problems.length === extra.length;
  };
  const addPaste = async () => {
    try {
      const source = await importSource({ kind: 'paste', ...paste });
      if (add([source])) { setPaste({ title: '', text: '', language: '' }); setPasting(false); }
    } catch (error) { setErrors([error instanceof SourceImportError ? importText(t, fmt, error) : t.studio.pasteFailed]); }
  };
  // A text from an AI assistant joins the sources already chosen, never during a generation (it waits until the end).
  const [received, setReceived] = useState<string[]>([]);
  useEffect(() => {
    if (!incoming.length || busy) return;
    const fresh = incoming.map(x => x.source).filter((s, i, list) => !draft.sources.some(x => x.sha256 === s.sha256) && list.findIndex(x => x.sha256 === s.sha256) === i);
    add(fresh);
    const question = incoming.map(x => x.question.trim()).find(x => x.length > 0);
    if (question) setDraft(d => d.outcome.trim() ? d : { ...d, outcome: question });
    setReceived(incoming.map(x => x.source.title));
    setStep(0);
    onIncomingTaken?.(incoming.length);
    // `add` and the draft are read as they are when the text arrives; rerunning on their changes would add it twice.
  }, [incoming, busy]);
  const pickFiles = async () => {
    if (!studio) return;
    const picked = await studio.pickSources();
    add(picked.sources, picked.errors.map(x => importText(t, fmt, x)));
  };

  return <section className="studio" aria-labelledby="studio-title">
    <div className="library-section-head"><div><span className="eyebrow">{t.studio.eyebrow}</span><h1 id="studio-title" ref={titleRef} tabIndex={-1}>{t.studio.title}</h1></div></div>
    {incoming.length > 0 && busy && <p className="notice" role="status">{t.studio.incomingWaiting(incoming.length)}</p>}
    <nav className="creation-steps" aria-label={t.studio.steps}><ol>{t.studio.stepNames.map((label, i) => <li key={label}><button aria-current={step === i ? 'step' : undefined} disabled={busy || (i > 0 && !draft.sources.length) || (i > 1 && !goal.success)} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button></li>)}</ol></nav>
    <div className="studio-steps">
      <div className="studio-step" hidden={step !== 0}>
        <span className="step-label"><Icon name="book" size={18}/>{t.studio.chooseLabel}</span>
        <p className="step-hint">{t.studio.chooseHint(SOURCE_LIMITS.maxSources, fmt(SOURCE_LIMITS.maxTotalChars))}</p>
        <div className="studio-actions">
          <button className="subtle" aria-expanded={pasting} onClick={() => setPasting(x => !x)}><ClipboardPaste size={16}/>{t.studio.paste}</button>
          <button className="subtle" disabled={!studio} onClick={() => void pickFiles()}><FileText size={16}/>{t.studio.pickFiles}</button>
        </div>
        {!studio && <p className="micro plain">{t.studio.desktopFiles}</p>}
        {pasting && <div className="paste-form">
          <label>{t.studio.sourceName}<input value={paste.title} maxLength={SOURCE_LIMITS.maxTitleChars} placeholder={t.studio.sourceNamePlaceholder} onChange={e => setPaste(p => ({ ...p, title: e.target.value }))}/></label>
          <label>{t.studio.type}<select value={paste.language} onChange={e => setPaste(p => ({ ...p, language: e.target.value }))}><option value="">{t.studio.text}</option>{CODE_LANGUAGES.map(x => <option key={x} value={x}>{x === 'Codice' ? t.studio.otherCode : t.studio.code(x)}</option>)}</select></label>
          <label>{t.studio.text}<textarea rows={7} value={paste.text} onChange={e => setPaste(p => ({ ...p, text: e.target.value }))} placeholder={t.studio.pastePlaceholder}/></label>
          <p className="micro plain">{t.studio.charCount(fmt(paste.text.length), fmt(SOURCE_LIMITS.maxCharsPerSource))}</p>
          <button className="primary" onClick={() => void addPaste()}>{t.studio.addSource}</button>
        </div>}
        {received.length > 0 && <p className="notice" role="status">{t.studio.incomingAdded(received.join(', '))}<button aria-label={t.studio.closeNotice} onClick={() => setReceived([])}><X size={14}/></button></p>}
        {errors.length > 0 && <div className="error-banner" role="alert"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul><button aria-label={t.studio.closeErrors} onClick={() => setErrors([])}><X size={14}/></button></div>}
        {draft.sources.length > 0 && <ul className="source-list">{draft.sources.map(source => <li key={source.id}><details>
          <summary><Icon name={source.language ? 'code' : 'book'} size={17}/><span><strong>{source.title}</strong><small>{t.studio.sourceMeta(fmt(source.text.split('\n').length), fmt(source.text.length), source.origin === 'user-file')}</small></span></summary>
          <SourcePreview source={source}/>
        </details><button className="icon-button" aria-label={t.studio.remove(source.title)} onClick={() => setDraft(d => ({ ...d, sources: d.sources.filter(x => x.id !== source.id) }))}><Trash2 size={15}/></button></li>)}</ul>}
        <progress className="source-capacity" aria-label={t.studio.capacity} value={total} max={SOURCE_LIMITS.maxTotalChars}/>
        <p className="micro plain">{t.studio.capacityText(draft.sources.length, SOURCE_LIMITS.maxSources, fmt(total), fmt(SOURCE_LIMITS.maxTotalChars))}</p>
        <div className="creation-controls"><span>{t.studio.staysLocal}</span><button className="primary" disabled={!draft.sources.length} onClick={() => setStep(1)}>{t.studio.toGoal}<ArrowRight size={16}/></button></div>
      </div>
      <div className="studio-step" hidden={step !== 1}>
        <span className="step-label"><Icon name="target" size={18}/>{t.studio.goalLabel}</span>
        <p className="step-hint">{t.studio.goalHint(draft.sources.length)}</p>
        {studio?.suggest && <Suggestions studio={studio} draft={draft} setDraft={setDraft} language={language} route={routes.setup?.content}/>}
        <label>{t.studio.outcome}<textarea rows={4} maxLength={400} value={draft.outcome} placeholder={t.studio.outcomePlaceholder} onChange={e => setDraft(d => ({ ...d, outcome: e.target.value }))}/></label>
        <label><span>{t.studio.prior} <span className="optional">{t.common.optional}</span></span><input maxLength={200} value={draft.prior} placeholder={t.studio.priorPlaceholder} onChange={e => setDraft(d => ({ ...d, prior: e.target.value }))}/></label>
        {draft.outcome && !goal.success && <p className="field-error">{goalText(t, goal.error.issues[0])}</p>}
        <label>{t.studio.contentLanguage}<select value={language} onChange={e => setDraft(d => ({ ...d, language: e.target.value as ContentLanguage }))}>{(['it', 'en'] as const).map(x => <option key={x} value={x}>{t.languageNames[x]}</option>)}</select></label>
        <p className="micro plain">{t.studio.contentLanguageHint}</p>
        {languageClash && <p className="field-error">{t.studio.questionLanguage(t.languageNames[asked])}</p>}
        <div className="creation-controls"><button className="subtle" onClick={() => setStep(0)}><ArrowLeft size={16}/>{t.studio.material}</button><button className="primary" disabled={!goal.success} onClick={() => setStep(2)}>{t.studio.toGeneration}<ArrowRight size={16}/></button></div>
      </div>
      {step === 2 && <><div className="generation-summary"><span><Icon name="book" size={16}/>{t.studio.sourcesCount(draft.sources.length)}</span><p>{draft.outcome}</p><button className="text-button" disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={14}/>{t.studio.editGoal}</button></div><Generate studio={studio} routes={routes} sources={draft.sources} goal={goal.success ? goal.data : undefined} language={language} languageClash={languageClash} onCreated={onCreated} onBusyChange={value => { setBusy(value); onBusyChange?.(value); }}/></>}
    </div>
  </section>;
}

/** The numbered lines shown here are the same text and numbering sent to the model. */
export function SourcePreview({ source }: { source: UserSource }) {
  const { t, n: fmt } = usePreferences();
  const lines = source.text.split('\n');
  return <div className={`source-lines preview-lines ${source.language ? 'code-lines' : ''}`} tabIndex={0} aria-label={t.studio.previewOf(source.title)}>
    {lines.slice(0, 400).map((line, i) => <div key={i} className="source-line"><span className="line-number" aria-hidden="true">{i + 1}</span><span>{line || ' '}</span></div>)}
    {lines.length > 400 && <p className="preview-more">{t.studio.previewMore(fmt(lines.length))}</p>}
  </div>;
}

/** How far the three phases have come: the structure, then each part, then the runs. Requests, not characters, set the pace. */
function phasePercent(progress: GenerationProgress): number {
  if (progress.phase === 'structure') return Math.min(30, 4 + Math.round(progress.received / 400));
  if (progress.phase === 'content') return 30 + Math.round(55 * (progress.part ?? 0) / Math.max(1, progress.parts ?? 1));
  return Math.min(97, 85 + Math.round(progress.received / 800));
}

/**
 * The account, the models and the setup they allow. Studio needs them before the generation step: suggested
 * break-downs go to the setup's content route.
 */
function useRoutes(studio?: StudioBridge) {
  const { settings } = usePreferences();
  const [status, setStatus] = useState<AccountStatus>();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsProblem, setModelsProblem] = useState<ProviderFailure>();
  const provider = settings?.provider ?? 'chatgpt';
  const planReady = status?.state === 'signed-in' && status.planUsage;
  useEffect(() => { if (studio) void studio.accountStatus().then(setStatus); }, [studio]);
  useEffect(() => {
    if (!studio || !planReady || provider !== 'chatgpt') return;
    let active = true;
    void studio.listModels().then(result => {
      if (!active) return;
      if (!result.ok) { setModelsProblem(result.failure); return; }
      setModels(result.models);
    });
    return () => { active = false; };
  }, [studio, planReady, provider]);
  const chatgptModel = models.some(m => m.slug === settings?.chatgptModel) ? settings!.chatgptModel! : models[0]?.slug ?? '';
  // Parts and runs use the structure model unless the learner picked another one that the account still lists.
  const contentModel = models.some(m => m.slug === settings?.chatgptContentModel) ? settings!.chatgptContentModel! : '';
  const local = settings?.local;
  const localRoute: GenerationRoute | undefined = local && { provider: 'local', runtime: local.runtime, baseUrl: local.baseUrl, model: local.model };
  const setup: GenerationSetup | undefined = provider === 'local'
    ? localRoute && { structure: localRoute, content: localRoute }
    : planReady && chatgptModel ? { structure: { provider: 'chatgpt', model: chatgptModel }, content: { provider: 'chatgpt', model: contentModel || chatgptModel } } : undefined;
  return { status, setStatus, models, modelsProblem, provider, planReady, chatgptModel, contentModel, local, setup };
}
type Routes = ReturnType<typeof useRoutes>;

/**
 * Suggested break-downs (D23), only when the learner presses the button: one request to the content route, with the
 * cost said beside it. A card fills the question field, which stays editable; the content language follows it.
 */
function Suggestions({ studio, draft, setDraft, language, route }: { studio: StudioBridge; draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; language: ContentLanguage; route?: GenerationRoute }) {
  const { t } = usePreferences();
  const s = t.suggest;
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<ProviderFailure>();
  const key = selectionKey(draft.sources);
  const kept = draft.suggestions?.key === key ? draft.suggestions : undefined;
  const ask = async () => {
    if (!route || !studio.suggest) return;
    setRunning(true); setProblem(undefined);
    const shown = kept?.shown ?? [];
    try {
      const result = await studio.suggest({ sources: draft.sources, language, priorKnowledge: draft.prior.slice(0, 200), route, avoid: shown });
      if (result.ok) setDraft(d => ({ ...d, suggestions: { key, language, items: result.suggestions, shown: [...shown, ...result.suggestions.map(x => x.question)].slice(-20) } }));
      else setProblem(result.failure);
    } finally { setRunning(false); }
  };
  const where = route && (route.provider === 'local' ? s.local(route.model) : `ChatGPT · ${route.model}`);
  return <div className="suggestions">
    {running
      ? <div className="generating-head"><span className="spinner" aria-hidden="true"/><span role="status">{s.running}</span><button className="subtle" onClick={() => void studio.cancelSuggestions?.()}>{s.cancel}</button></div>
      : <div className="studio-actions"><button className="subtle" disabled={!route} onClick={() => void ask()}><Sparkles size={15}/>{kept ? s.more : s.action}</button></div>}
    <p className="micro plain">{where ? s.cost(where) : s.noRoute}</p>
    {problem && <p className="notice" role="alert">{problem.code === 'cancelled' ? s.cancelled : s.failed(failureText(t, problem))}</p>}
    {kept && <ul className="suggestion-cards" aria-label={s.label}>{kept.items.map((x, i) => <li key={i}><article className="suggestion-card" lang={kept.language}>
      <span className="eyebrow">{s.kinds[x.kind]}</span><p className="suggestion-question">{x.question}</p>
      <p className="micro plain"><span className="sr-only">{s.parts}: </span>{x.parts.join(' · ')}</p>
      <button className="text-button" aria-pressed={draft.outcome === x.question} onClick={() => setDraft(d => ({ ...d, outcome: x.question, language: kept.language }))}>{s.use}</button>
    </article></li>)}</ul>}
  </div>;
}

function Generate({ studio, routes, sources, goal, language, languageClash, onCreated, onBusyChange }: { studio?: StudioBridge; routes: Routes; sources: UserSource[]; goal?: { outcome: string; priorKnowledge: string }; language: ContentLanguage; languageClash: boolean; onCreated: (disassembly: Disassembly) => void; onBusyChange: (value: boolean) => void }) {
  const { t, n: fmt, settings, update: updateSettings } = usePreferences();
  const { status, setStatus, models, provider, planReady, chatgptModel, contentModel, local, setup } = routes;
  const [problem, setProblem] = useState<ProviderFailure>();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ phase: 'structure', repairing: false, received: 0, requests: 0 });
  // A failed or cancelled generation keeps what was accepted; Studio offers to finish it (D21).
  const [kept, setKept] = useState<DraftState>();
  const readDraft = async () => { if (studio?.generationDraft) setKept(await studio.generationDraft()); };
  useEffect(() => { void readDraft(); }, [studio]);
  useEffect(() => studio?.onGenerationProgress(setProgress), [studio]);
  const shown = problem ?? routes.modelsProblem;

  const sent = useMemo(() => goal && sources.length ? buildStructureInput(sources, goal, language) : '', [sources, goal, language]);
  if (!studio) return <div className="studio-step"><span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>{t.generate.title}</span><p className="step-hint">{t.generate.desktopOnly}</p></div>;

  const update = (next: StudioSettings) => { updateSettings(next); setProblem(undefined); };
  const signIn = async (consent = false) => {
    setProblem(undefined); setStatus(s => ({ state: 'signing-in', storage: s?.storage ?? true }));
    const result = await studio.signIn({ consent });
    if (!result.ok) setProblem(result.failure);
    setStatus(await studio.accountStatus());
  };
  const generate = async (resume = false) => {
    if (!goal || !setup || languageClash) return;
    setProblem(undefined); setRunning(true); setProgress({ phase: 'structure', repairing: false, received: 0, requests: 0 }); onBusyChange(true);
    try {
      const result = await studio.generate({ sources, goal, language, setup, ...(resume ? { resume: true } : {}) });
      if (result.ok) { setKept({ draft: null }); onCreated(result.disassembly); }
      else { setProblem(result.failure); await readDraft(); if (result.failure.action === 'sign-in') setStatus(await studio.accountStatus()); }
    } finally { setRunning(false); onBusyChange(false); }
  };
  const m = t.generate.missing;
  const missing = [!sources.length && m.source, !goal && m.goal, languageClash && m.language,
    provider === 'chatgpt' ? (!planReady ? m.chatgpt : !chatgptModel && m.model) : !local && m.local].filter(Boolean);
  const draft = kept?.draft;
  const canResume = !!draft && !!goal && resumable(draft, { sources, question: goal.outcome, language });
  const action = (f: ProviderFailure) => f.action === 'sign-in' ? <button onClick={() => void signIn()}>{t.generate.signInAgain}</button>
    : f.action === 'enable-plan' ? <button onClick={() => void signIn(true)}>{t.generate.enablePlan}</button>
    : f.action === 'usage-settings' ? <button onClick={() => void studio.openUsageSettings()}>{t.generate.usageSettings}</button>
    : (f.action === 'retry' || f.action === 'local-setup') && f.code !== 'cancelled' && !canResume ? <button disabled={!!missing.length} onClick={() => void generate()}>{t.generate.retry}</button> : null;
  const phase = progress.phase === 'runs' && progress.preview ? t.generate.runsPreparing
    : progress.phase === 'content' ? t.generate.phases.content(Math.min((progress.part ?? 0) + 1, progress.parts ?? 1), progress.parts ?? 1) : t.generate.phases[progress.phase];
  const pass = progress.shortening ? t.generate.shortening : progress.repairing ? t.generate.repairing : '';

  return <div className="studio-step">
    <span className="step-label"><span className="step-number">3</span><Icon name="lightbulb" size={18}/>{t.generate.title}</span>
    <div className="mode-switch route-switch" role="group" aria-label={t.generate.route}>
      <button aria-pressed={provider === 'chatgpt'} disabled={running || !settings} onClick={() => settings && update({ ...settings, provider: 'chatgpt' })}><KeyRound size={15}/>ChatGPT</button>
      <button aria-pressed={provider === 'local'} disabled={running || !settings} onClick={() => settings && update({ ...settings, provider: 'local' })}><Cpu size={15}/>{t.generate.local}</button>
    </div>
    {provider === 'chatgpt' ? <div className="account-card" aria-live="polite">
      {!status ? <p className="micro plain">{t.generate.checkingAccount}</p>
        : !status.storage ? <p className="field-error">{t.generate.noKeychain}</p>
        : status.state === 'signing-in' ? <><p><KeyRound size={16}/> {t.generate.completeInBrowser}</p><button className="subtle" onClick={() => void studio.cancelSignIn()}>{t.generate.cancelSignIn}</button></>
        : status.state === 'signed-out' ? <><p>{t.generate.useAccount}</p><button className="primary" onClick={() => void signIn()}><KeyRound size={16}/>{t.generate.signIn}</button></>
        : <><p className="account-line"><span className="status-dot"/><span>{status.email ?? t.generate.account}</span><button className="text-button" onClick={() => void studio.signOut().then(setStatus)}><LogOut size={14}/>{t.generate.signOut}</button></p>
          {!status.planUsage ? <button className="subtle" onClick={() => void signIn(true)}>{t.generate.enablePlanLong}</button>
            : <><label>{t.generate.model}<select value={chatgptModel} disabled={running} onChange={e => settings && update({ ...settings, chatgptModel: e.target.value })}>{models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
              <details className="phase-models" open={!!contentModel}><summary>{t.generate.perPhase}</summary><p className="micro plain">{t.generate.perPhaseHint}</p>
                <label>{t.generate.contentModel}<select value={contentModel} disabled={running} onChange={e => settings && update({ ...settings, chatgptContentModel: e.target.value || undefined })}><option value="">{t.generate.sameModel}</option>{models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
              </details></>}</>}
      {status && 'notice' in status && status.notice && <p className="micro plain">{status.noticeCode ? t.accountNotices[status.noticeCode] : status.notice}</p>}
    </div> : settings && <LocalModelPanel studio={studio} current={local} disabled={running} onChange={next => update({ ...settings, provider: 'local', local: next })}/>}
    <p className="micro plain">{t.generate.requestsPlanned}</p>
    <details className="sent-preview"><summary>{t.generate.whatIsSent}</summary>
      {sent ? <><p className="micro plain">{provider === 'local' && local
        ? t.generate.sentLocal(runtimeName(t, local.runtime), local.baseUrl)
        : t.generate.sentChatgpt}</p><pre tabIndex={0}>{sent}</pre></> : <p className="micro plain">{t.generate.sentEmpty}</p>}
    </details>
    {running ? <div className="generating">
        <div className="generating-head"><span className="spinner" aria-hidden="true"/><span role="status">{phase}{pass ? ` · ${pass}` : ''}</span><button className="subtle" onClick={() => void studio.cancelGeneration()}>{t.generate.cancel}</button></div>
        <progress max={100} value={phasePercent(progress)} aria-label={t.generate.progress}/>
        <p className="micro plain">{t.generate.progressText(progress.requests, progress.received ? fmt(progress.received) : '')}</p>
        {progress.preview && <GenerationPreview preview={progress.preview} language={language}/>}
      </div>
      : canResume ? <div className="kept-draft" role="group" aria-label={t.generate.kept(draft.parts, draft.kept, draft.runs)}>
          <p>{t.generate.kept(draft.parts, draft.kept, draft.runs)}</p>
          <div className="studio-actions"><button className="primary" disabled={!!missing.length} onClick={() => void generate(true)}><RefreshCw size={16}/>{t.generate.resume}</button>
            <button className="subtle" disabled={!!missing.length} onClick={() => void generate()}>{t.generate.startOver}</button></div>
          <p className="micro plain">{t.generate.resumeHint}</p>
        </div>
      : <>{draft && <p className="micro plain">{t.generate.draftElsewhere(draft.title ?? '')}</p>}
        <button className="primary generate-button" disabled={!!missing.length} onClick={() => void generate()}><Sparkles size={17}/>{t.generate.generate}</button></>}
    {!running && kept?.setAside && <p className="notice" role="status">{t.generate.draftSetAside}</p>}
    {!running && missing.length > 0 && <p className="micro plain">{t.generate.stillNeeded(missing.join(', '))}</p>}
    {shown && <div className={shown.code === 'cancelled' ? 'notice' : 'error-banner'} role="alert"><div><p>{failureText(t, shown)}</p>{shown.issues && <details className="issue-details"><summary>{t.generate.technical}</summary><ul className="issue-list">{shown.issues.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}{shown.requestId && <p className="micro plain">{t.generate.request(shown.requestId)}</p>}</div>{action(shown)}</div>}
  </div>;
}

type LocalChoice = NonNullable<StudioSettings['local']>;

/** Finds model servers on this Mac, lets the learner pick a model, and records whether the server enforces the lesson format. */
function LocalModelPanel({ studio, current, disabled, onChange }: { studio: StudioBridge; current?: LocalChoice; disabled: boolean; onChange: (next: LocalChoice) => void }) {
  const { t } = usePreferences();
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
  const badge = (choice: LocalChoice) => choice.check && <p className={`format-check ${choice.check.enforced ? 'ok' : 'warn'}`}>{choice.check.enforced ? <Check size={15}/> : <TriangleAlert size={15}/>}<span><strong>{choice.check.enforced ? t.local.enforced : t.local.notEnforced}</strong>{checkText(t, choice.check)}</span></p>;

  if (!editing && current) return <div className="account-card local-card" aria-live="polite">
    <p className="account-line"><Cpu size={16}/><span>{current.model}</span></p>
    <p className="micro plain">{runtimeName(t, current.runtime)} · {current.baseUrl} · {t.local.staysHere}</p>
    {checking ? <p className="micro plain" role="status">{t.local.rechecking}</p> : badge(current)}
    {problem && <p className="field-error" role="alert">{failureText(t, problem)}</p>}
    <div className="studio-actions"><button className="subtle" disabled={disabled} onClick={() => setEditing(true)}>{t.local.change}</button><button className="text-button" disabled={disabled || !!checking} onClick={() => void choose({ runtime: current.runtime, baseUrl: current.baseUrl, model: current.model })}>{t.local.recheck}</button></div>
  </div>;

  return <div className="account-card local-card" aria-live="polite">
    <p className="account-line"><Cpu size={16}/><span>{t.local.models}</span><button className="text-button" disabled={searching || !!checking} onClick={() => void search()}><RefreshCw size={14}/>{t.local.searchAgain}</button></p>
    {searching ? <p className="micro plain" role="status">{t.local.searching}</p>
      : servers?.length ? <ul className="local-servers">{servers.map(server => <li key={server.baseUrl}>
          <span className="server-name">{runtimeName(t, server.runtime)}<small>{server.baseUrl}{server.version ? ` · v${server.version}` : ''}</small></span>
          {server.models.length ? <ul>{server.models.map(model => <li key={model}><span>{model}</span><button className="subtle" disabled={!!checking || disabled} onClick={() => void choose({ runtime: server.runtime, baseUrl: server.baseUrl, model })}>{checking === model ? t.local.checkingModel : t.local.use}</button></li>)}</ul>
            : <p className="micro plain">{t.local.noModels}</p>}
        </li>)}</ul>
      : servers && <div className="local-guide"><p>{t.local.noServers}</p><ul>
          <li><strong>LM Studio</strong>: {t.local.lmstudio}</li>
          <li><strong>Ollama</strong>: {t.local.ollama} <code>ollama serve</code> {t.local.ollamaPort}</li>
          <li><strong>llama.cpp</strong>: <code>llama-server -m {t.local.llamacppModel} -c 32768</code> {t.local.llamacppPort}</li>
        </ul><p className="micro plain">{t.local.requirements}</p></div>}
    {checking && <p className="micro plain" role="status">{t.local.checkingFormat}</p>}
    <div className="local-address"><label>{t.local.otherAddress}<input value={address} placeholder={t.local.addressPlaceholder} onChange={e => setAddress(e.target.value)}/></label><button className="subtle" disabled={!address.trim() || !!checking} onClick={() => void connect()}>{t.local.connect}</button></div>
    {problem && <p className="field-error" role="alert">{failureText(t, problem)}</p>}
    {current && <button className="text-button" onClick={() => setEditing(false)}>{t.local.keep(current.model)}</button>}
  </div>;
}

/** The format check is worded from its outcome; older settings files carry only the Italian detail. */
function checkText(t: Messages, check: FormatCheck): string {
  if (check.reason === 'timeout' || check.reason === 'respected') return t.local.check[check.reason];
  if (check.reason === 'ignored') return t.local.check.ignored(check.sample ?? '');
  return check.detail;
}
/** Goal limits come from the shared schema; the wording comes from the catalog. */
function goalText(t: Messages, issue?: { path: PropertyKey[]; code: string }): string {
  if (issue?.path[0] === 'priorKnowledge') return t.studio.priorLong;
  return issue?.code === 'too_big' ? t.studio.outcomeLong : t.studio.outcomeShort;
}
