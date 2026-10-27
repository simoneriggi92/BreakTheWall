import { z } from 'zod';
import { jointTypeSchema, partIconSchema, partKindSchema, type Disassembly } from './disassembly';
import { idSchema, type Lesson } from './lesson';
import type { ImportErrorCode, ImportErrorParams, LearningGoal, UserSource } from './source';

/** What the renderer may know about the account: never tokens, only state and capabilities. */
/** Notices travel as codes; `notice` keeps the Italian text for logs. */
export type AccountNotice = 'plan-not-authorized' | 'revoke-unconfirmed' | 'session-expired';
export type AccountStatus =
  | { state: 'signed-out'; notice?: string; noticeCode?: AccountNotice; storage: boolean }
  | { state: 'signing-in'; storage: boolean }
  | { state: 'signed-in'; email?: string; planUsage: boolean; notice?: string; noticeCode?: AccountNotice; storage: boolean };
export interface ModelOption { slug: string; name: string }

export type FailureCode = 'cancelled' | 'signed-out' | 'session-expired' | 'plan-disabled' | 'not-eligible' | 'usage-limit' | 'unavailable' | 'model-unavailable' | 'unsupported' | 'forbidden' | 'incomplete' | 'refused' | 'invalid-output' | 'network' | 'storage' | 'busy' | 'desktop-only' | 'local-address' | 'local-unreachable' | 'local-model-missing' | 'local-context';
export type RecoveryAction = 'sign-in' | 'enable-plan' | 'retry' | 'usage-settings' | 'choose-model' | 'local-setup';
/** A more specific cause than the code, where the host knows one. The interface words `reason ?? code`. */
export type FailureReason = 'local-not-a-server' | 'local-timeout' | 'local-stopped' | 'local-no-template' | 'local-unreadable'
  | 'sign-in-busy' | 'sign-in-denied' | 'sign-in-other-app' | 'sign-in-no-code' | 'sign-in-no-identity' | 'sign-in-other-account'
  | 'session-rejected' | 'models-format' | 'stream-unreadable' | 'sign-in-port' | 'sign-in-timeout' | 'sign-in-cancelled'
  | 'sign-in-invalid-client' | 'sign-in-refused' | 'identity-unverified' | 'question-language' | 'part-not-divisible' | 'draft-changed';
/** `message` stays Italian for logs and tests; the interface words the failure from `reason` or `code`. */
export interface ProviderFailure { code: FailureCode; reason?: FailureReason; message: string; action?: RecoveryAction; issues?: string[]; requestId?: string }

const MESSAGES: Record<FailureCode, [string, RecoveryAction?]> = {
  cancelled: ['Generazione annullata. Percorsi e appunti già salvati non sono stati toccati.', 'retry'],
  'signed-out': ['Accedi con ChatGPT per generare un percorso.', 'sign-in'],
  'session-expired': ['La sessione ChatGPT è scaduta o è stata scollegata. Accedi di nuovo.', 'sign-in'],
  'plan-disabled': ['L’uso del piano ChatGPT non è stato autorizzato per questa app. Puoi abilitarlo con un nuovo accesso.', 'enable-plan'],
  'not-eligible': ['Questo account ChatGPT non è idoneo all’uso del piano da app esterne. Riprovare non cambia il risultato.'],
  'usage-limit': ['Hai raggiunto il limite di utilizzo del piano per le app collegate. Controlla in ChatGPT → Impostazioni → Utilizzo.', 'usage-settings'],
  unavailable: ['Il servizio non è disponibile in questo momento. Le credenziali restano salvate: riprova fra qualche minuto.', 'retry'],
  'model-unavailable': ['Il modello scelto non è disponibile per questo account. Scegline un altro.', 'choose-model'],
  unsupported: ['La richiesta usa una funzione non supportata da questo accesso.'],
  forbidden: ['La richiesta è stata rifiutata per una restrizione dell’account o della regione.'],
  incomplete: ['La risposta si è interrotta prima della fine. Nessun percorso è stato salvato.', 'retry'],
  refused: ['Il modello ha rifiutato di generare questo percorso. Nessun percorso è stato salvato.'],
  'invalid-output': ['La risposta non ha superato i controlli del percorso. Nessun percorso è stato salvato.', 'retry'],
  network: ['Connessione non riuscita. Controlla la rete e riprova.', 'retry'],
  storage: ['Il portachiavi del sistema non è disponibile: le credenziali non possono essere salvate in modo protetto.'],
  busy: ['C’è già una generazione in corso.'],
  'desktop-only': ['Accesso e generazione sono disponibili nell’app desktop.'],
  'local-address': ['Per proteggere le tue fonti, il modello locale deve rispondere su questo Mac: usa un indirizzo come localhost:1234 o 127.0.0.1:11434.'],
  'local-unreachable': ['Il server del modello locale non risponde. Controlla che sia avviato, poi riprova.', 'local-setup'],
  'local-model-missing': ['Il server locale non trova il modello scelto. Caricalo nel server o scegline un altro.', 'local-setup'],
  'local-context': ['La richiesta supera il contesto configurato nel server locale. Aumenta la lunghezza del contesto (almeno 32k token) o riduci le fonti.', 'local-setup'],
};
export function failure(code: FailureCode, extra: Partial<ProviderFailure> = {}): ProviderFailure {
  const [message, action] = MESSAGES[code];
  return { code, message, ...(action ? { action } : {}), ...extra };
}
export class ProviderError extends Error {
  constructor(public readonly failure: ProviderFailure) { super(failure.message); this.name = 'ProviderError'; }
}

export const LOCAL_RUNTIMES = ['ollama', 'lmstudio', 'llamacpp', 'openai'] as const;
export type LocalRuntime = typeof LOCAL_RUNTIMES[number];
export const RUNTIME_NAMES: Record<LocalRuntime, string> = { ollama: 'Ollama', lmstudio: 'LM Studio', llamacpp: 'llama.cpp server', openai: 'Server compatibile OpenAI' };
/** Ports the runtimes use by default; "Cerca sul Mac" probes only these. */
export const DEFAULT_LOCAL_ADDRESSES: [LocalRuntime, string][] = [['ollama', 'http://127.0.0.1:11434'], ['lmstudio', 'http://127.0.0.1:1234'], ['llamacpp', 'http://127.0.0.1:8080']];

/**
 * Normalizes a local server address to an origin on this machine. Anything that could reach another host,
 * including credentials in the URL, is refused: sources must not leave the device through this route.
 */
export function parseLocalAddress(input: string): string {
  const raw = input.trim();
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`); }
  catch { throw new ProviderError(failure('local-address')); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'http:' || !loopback || url.username || url.password || !url.port) throw new ProviderError(failure('local-address'));
  return `http://${url.hostname === 'localhost' ? '127.0.0.1' : url.hostname}:${url.port}`;
}

export const localModelSchema = z.strictObject({ runtime: z.enum(LOCAL_RUNTIMES), baseUrl: z.string().max(60).refine(x => { try { return parseLocalAddress(x) === x; } catch { return false; } }, 'Indirizzo non locale'), model: z.string().min(1).max(200) });
export type LocalModel = z.infer<typeof localModelSchema>;
export interface LocalServer { runtime: LocalRuntime; baseUrl: string; models: string[]; version?: string }
/** Whether the server constrained a tiny request to the given JSON Schema. Observed, not assumed per runtime. */
export interface FormatCheck { enforced: boolean; detail: string; checkedAt: string; reason?: 'timeout' | 'respected' | 'ignored'; sample?: string }

export const routeSchema = z.discriminatedUnion('provider', [
  z.strictObject({ provider: z.literal('chatgpt'), model: z.string().min(1).max(100) }),
  localModelSchema.extend({ provider: z.literal('local') }),
]);
export type GenerationRoute = z.infer<typeof routeSchema>;
/** One route writes the structure, another the parts and runs; they may be the same. */
export const setupSchema = z.strictObject({ structure: routeSchema, content: routeSchema });
export type GenerationSetup = z.infer<typeof setupSchema>;
export const settingsSchema = z.strictObject({
  version: z.literal(1), provider: z.enum(['chatgpt', 'local']),
  chatgptModel: z.string().max(100).optional(),
  /** The model for parts and runs, when it differs from the structure model. */
  chatgptContentModel: z.string().max(100).optional(),
  local: localModelSchema.extend({ check: z.strictObject({ enforced: z.boolean(), detail: z.string().max(300), checkedAt: z.string().max(40), reason: z.enum(['timeout', 'respected', 'ignored']).optional(), sample: z.string().max(100).optional() }).optional() }).optional(),
  /** Optional, so settings files written before themes and languages stay valid. `system` follows the operating system. */
  theme: z.enum(['system', 'paper', 'blueprint']).optional(),
  language: z.enum(['system', 'it', 'en']).optional(),
});
export type StudioSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: StudioSettings = { version: 1, provider: 'chatgpt' };
export type GenerationPhase = 'structure' | 'content' | 'runs';
export const PART_STATUSES = ['waiting', 'writing', 'done', 'failed'] as const;
/**
 * The top level while it is written (D22): parts and joints once the structure is accepted, each part's status, and the
 * lead and points of the parts that are done. Bounded, so the preload can refuse anything larger.
 */
export const previewSchema = z.strictObject({
  parts: z.array(z.strictObject({
    id: idSchema, name: z.string().min(1).max(200), kind: partKindSchema, icon: partIconSchema, subParts: z.number().int().min(0).max(7),
    status: z.enum(PART_STATUSES), lead: z.string().min(1).max(2000).optional(), points: z.array(z.string().min(1).max(2000)).max(4).optional(),
  })).min(3).max(7),
  joints: z.array(z.strictObject({ from: idSchema, to: idSchema, type: jointTypeSchema, label: z.string().min(1).max(200) })).max(20),
});
export type GenerationPreview = z.infer<typeof previewSchema>;
/**
 * `part` counts finished parts during the content phase; `requests` counts every request sent so far. `shortening` is
 * the one shorten request after a repair left only lengths (D19).
 */
export interface GenerationProgress { phase: GenerationPhase; repairing: boolean; shortening?: boolean; received: number; requests: number; part?: number; parts?: number; preview?: GenerationPreview }
/** `shortens` counts the shorten requests among the repairs (D19); absent when there were none. */
export interface PhaseStats { requests: number; repairs: number; shortens?: number; sentChars: number; receivedChars: number; ms: number }
export type GenerationStats = Record<GenerationPhase, PhaseStats>;

/** How a generated lesson names its origin in the library and the player. */
export function generatedBy(lesson: Lesson): string {
  const g = lesson.generation;
  if (!g) return 'Esempio preparato';
  return g.provider === 'local' ? `Modello locale · ${g.model}` : `ChatGPT · ${g.model}`;
}

/** `resume` finishes the kept draft instead of starting over (D21). */
export interface GenerationRequest { sources: UserSource[]; goal: LearningGoal; language: 'it' | 'en'; setup: GenerationSetup; resume?: boolean }
/** What a failed or cancelled generation kept, as Studio describes it; the draft's text stays in the host. */
export interface DraftSummary { sources: { id: string; sha256: string }[]; question: string; language: 'it' | 'en'; title?: string; parts: number; kept: number; runs: boolean }
/** `setAside` when a draft file could not be read and was moved out of the way. */
export interface DraftState { draft: DraftSummary | null; setAside?: boolean }
/** A draft can be resumed only with the same sources, content, question and language. */
export function resumable(draft: DraftSummary, request: { sources: Pick<UserSource, 'id' | 'sha256'>[]; question: string; language: 'it' | 'en' }): boolean {
  const key = (list: { id: string; sha256: string }[]) => list.map(s => `${s.id}:${s.sha256}`).sort().join(',');
  return key(draft.sources) === key(request.sources) && draft.question.trim() === request.question.trim() && draft.language === request.language;
}
export const BREAKDOWN_KINDS = ['mechanism', 'argument', 'story'] as const;
/** A way to take the selection apart, proposed on request before the learner writes a question (D23). */
export interface Suggestion { question: string; kind: typeof BREAKDOWN_KINDS[number]; parts: string[]; cites: { source: string; from: number; to: number }[] }
/** `avoid` carries the questions already shown, so "other suggestions" differ from them. */
export interface SuggestionRequest { sources: UserSource[]; language: 'it' | 'en'; priorKnowledge: string; route: GenerationRoute; avoid: string[] }
export type SuggestionResult = { ok: true; suggestions: Suggestion[] } | { ok: false; failure: ProviderFailure };
export type GenerationResult = { ok: true; disassembly: Disassembly; stats: GenerationStats } | { ok: false; failure: ProviderFailure; stats?: GenerationStats };
/** Take one part of a saved generated disassembly apart, through one route. */
export interface ExpansionRequest { disassemblyId: string; revision: string; part: string; route: GenerationRoute }
/** `disassembly` is the new revision; `moved` says whether the learner's progress followed it. */
export type ExpansionResult = { ok: true; disassembly: Disassembly; moved: boolean; stats: PhaseStats } | { ok: false; failure: ProviderFailure; stats?: PhaseStats };
export type PickError = { name: string; message: string; code?: ImportErrorCode | 'not-a-file' | 'unreadable' | 'truncated'; params?: ImportErrorParams };
export interface PickedSources { sources: UserSource[]; errors: PickError[] }

/** Desktop-only operations. Absent in the browser preview. */
export interface StudioBridge {
  pickSources(): Promise<PickedSources>;
  accountStatus(): Promise<AccountStatus>;
  signIn(options: { consent: boolean }): Promise<{ ok: true; status: AccountStatus } | { ok: false; failure: ProviderFailure }>;
  cancelSignIn(): Promise<void>;
  signOut(): Promise<AccountStatus>;
  listModels(): Promise<{ ok: true; models: ModelOption[] } | { ok: false; failure: ProviderFailure }>;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  cancelGeneration(): Promise<void>;
  /** The kept draft of a failed or cancelled generation, if any (D21). */
  generationDraft?(): Promise<DraftState>;
  /** Suggested break-downs: one request, sent only when the learner asks (D23). */
  suggest?(request: SuggestionRequest): Promise<SuggestionResult>;
  cancelSuggestions?(): Promise<void>;
  onGenerationProgress(listener: (progress: GenerationProgress) => void): () => void;
  listLessons(): Promise<{ lessons: unknown[]; skipped: number }>;
  /** Saved generated disassemblies; the renderer validates them again before showing them. */
  listDisassemblies?(): Promise<{ disassemblies: unknown[]; skipped: number }>;
  findDisassembly?(key: { id: string; revision: string }): Promise<unknown | null>;
  /** Takes one part apart and saves the new revision; absent in the browser preview. */
  expandPart?(request: ExpansionRequest): Promise<ExpansionResult>;
  openUsageSettings(): Promise<void>;
  getSettings(): Promise<StudioSettings>;
  saveSettings(settings: StudioSettings): Promise<StudioSettings>;
  /** Probes the default local ports; returns only servers that answered like a known runtime. */
  discoverLocal(): Promise<LocalServer[]>;
  connectLocal(address: string): Promise<{ ok: true; server: LocalServer } | { ok: false; failure: ProviderFailure }>;
  checkLocalFormat(model: LocalModel): Promise<{ ok: true; check: FormatCheck } | { ok: false; failure: ProviderFailure }>;
}
