import { z } from 'zod';
import type { Lesson } from './lesson';
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
  | 'sign-in-invalid-client' | 'sign-in-refused' | 'identity-unverified';
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
export const settingsSchema = z.strictObject({
  version: z.literal(1), provider: z.enum(['chatgpt', 'local']),
  chatgptModel: z.string().max(100).optional(),
  local: localModelSchema.extend({ check: z.strictObject({ enforced: z.boolean(), detail: z.string().max(300), checkedAt: z.string().max(40), reason: z.enum(['timeout', 'respected', 'ignored']).optional(), sample: z.string().max(100).optional() }).optional() }).optional(),
  /** Optional, so settings files written before themes and languages stay valid. `system` follows the operating system. */
  theme: z.enum(['system', 'paper', 'blueprint']).optional(),
  language: z.enum(['system', 'it', 'en']).optional(),
});
export type StudioSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: StudioSettings = { version: 1, provider: 'chatgpt' };
export interface GenerationProgress { received: number; phase: 'generating' | 'repairing' }

/** How a generated lesson names its origin in the library and the player. */
export function generatedBy(lesson: Lesson): string {
  const g = lesson.generation;
  if (!g) return 'Esempio preparato';
  return g.provider === 'local' ? `Modello locale · ${g.model}` : `ChatGPT · ${g.model}`;
}

export interface GenerationRequest { sources: UserSource[]; goal: LearningGoal; route: GenerationRoute }
export type GenerationResult = { ok: true; lesson: Lesson } | { ok: false; failure: ProviderFailure };
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
  onGenerationProgress(listener: (progress: GenerationProgress) => void): () => void;
  listLessons(): Promise<{ lessons: unknown[]; skipped: number }>;
  /** Saved generated disassemblies; the renderer validates them again before showing them. */
  listDisassemblies?(): Promise<{ disassemblies: unknown[]; skipped: number }>;
  findDisassembly?(key: { id: string; revision: string }): Promise<unknown | null>;
  openUsageSettings(): Promise<void>;
  getSettings(): Promise<StudioSettings>;
  saveSettings(settings: StudioSettings): Promise<StudioSettings>;
  /** Probes the default local ports; returns only servers that answered like a known runtime. */
  discoverLocal(): Promise<LocalServer[]>;
  connectLocal(address: string): Promise<{ ok: true; server: LocalServer } | { ok: false; failure: ProviderFailure }>;
  checkLocalFormat(model: LocalModel): Promise<{ ok: true; check: FormatCheck } | { ok: false; failure: ProviderFailure }>;
}
