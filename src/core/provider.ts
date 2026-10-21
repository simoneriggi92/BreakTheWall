import type { Lesson } from './lesson';
import type { LearningGoal, UserSource } from './source';

/** What the renderer may know about the account: never tokens, only state and capabilities. */
export type AccountStatus =
  | { state: 'signed-out'; notice?: string; storage: boolean }
  | { state: 'signing-in'; storage: boolean }
  | { state: 'signed-in'; email?: string; planUsage: boolean; notice?: string; storage: boolean };
export interface ModelOption { slug: string; name: string }

export type FailureCode = 'cancelled' | 'signed-out' | 'session-expired' | 'plan-disabled' | 'not-eligible' | 'usage-limit' | 'unavailable' | 'model-unavailable' | 'unsupported' | 'forbidden' | 'incomplete' | 'refused' | 'invalid-output' | 'network' | 'storage' | 'busy' | 'desktop-only';
export type RecoveryAction = 'sign-in' | 'enable-plan' | 'retry' | 'usage-settings' | 'choose-model';
export interface ProviderFailure { code: FailureCode; message: string; action?: RecoveryAction; issues?: string[]; requestId?: string }

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
};
export function failure(code: FailureCode, extra: Partial<ProviderFailure> = {}): ProviderFailure {
  const [message, action] = MESSAGES[code];
  return { code, message, ...(action ? { action } : {}), ...extra };
}
export class ProviderError extends Error {
  constructor(public readonly failure: ProviderFailure) { super(failure.message); this.name = 'ProviderError'; }
}

export interface GenerationRequest { sources: UserSource[]; goal: LearningGoal; model: string }
export type GenerationResult = { ok: true; lesson: Lesson } | { ok: false; failure: ProviderFailure };
export interface PickedSources { sources: UserSource[]; errors: { name: string; message: string }[] }

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
  onGenerationProgress(listener: (progress: { received: number }) => void): () => void;
  listLessons(): Promise<{ lessons: unknown[]; skipped: number }>;
  openUsageSettings(): Promise<void>;
}
