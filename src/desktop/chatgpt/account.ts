import { randomBytes, randomUUID } from 'node:crypto';
import { failure, ProviderError, type AccountNotice, type AccountStatus, type ModelOption } from '../../core/provider';
import { AUTH, authorizeUrl, base64url, exchangeCode, listenForCallback, pkce, refreshTokens, revokeRefreshToken, verifyIdToken, type Fetch, type TokenResponse } from './oauth';
import type { CompletionRequest } from '../completion';
import type { Language } from '../../core/language';
import { listModels, streamResponse } from './responses';

/** Secret record: kept only through the vault (OS-protected encryption), never sent to the renderer or logged. */
export interface AccountRecord {
  version: 1; clientId: string; sub?: string; email?: string; idToken?: string;
  accessToken?: string; refreshToken?: string; expiresAt?: number; earliestRefreshAt?: number; scope?: string;
}
export interface Vault { available(): boolean; read(): Promise<AccountRecord | null>; write(record: AccountRecord): Promise<void>; clear(): Promise<void> }
export interface AccountDeps { vault: Vault; hostId: () => Promise<string>; fetch: Fetch; openExternal: (url: string) => Promise<void>; now?: () => number; log?: (message: string) => void }

const hasPlan = (scope?: string) => !!scope?.split(/\s+/).includes(AUTH.planScope);

/**
 * One ChatGPT account on this host. Sign-in runs in the system browser; tokens stay in the main process.
 * Refreshes are serialized because each one rotates the refresh token.
 */
export class ChatGPTAccount {
  private signing?: AbortController;
  private refreshing?: Promise<AccountRecord>;
  private notice?: { code: AccountNotice; text: string };
  constructor(private deps: AccountDeps) {}
  private now() { return this.deps.now?.() ?? Date.now(); }

  async status(): Promise<AccountStatus> {
    const storage = this.deps.vault.available();
    if (this.signing) return { state: 'signing-in', storage };
    const record = storage ? await this.deps.vault.read() : null;
    const notice = this.notice ? { notice: this.notice.text, noticeCode: this.notice.code } : {};
    if (!record?.refreshToken && !record?.accessToken) return { state: 'signed-out', storage, ...notice };
    return { state: 'signed-in', email: record.email, planUsage: hasPlan(record.scope), storage, ...notice };
  }

  /** `language` words the page the browser shows after the callback. */
  async signIn({ consent, language }: { consent: boolean; language?: Language }): Promise<AccountStatus> {
    if (!this.deps.vault.available()) throw new ProviderError(failure('storage'));
    if (this.signing) throw new ProviderError(failure('busy', { reason: 'sign-in-busy', message: 'C’è già un accesso in corso nel browser.' }));
    const controller = new AbortController();
    this.signing = controller;
    try {
      const saved = await this.deps.vault.read();
      const state = base64url(randomBytes(24)); const nonce = base64url(randomBytes(24)); const { verifier, challenge } = pkce();
      const { redirectUri, result } = await listenForCallback(state, controller.signal, undefined, language);
      if (controller.signal.aborted) await result;
      const hostId = await this.deps.hostId();
      await this.deps.openExternal(authorizeUrl({ clientId: saved?.clientId, hostId, redirectUri, state, nonce, challenge, loginHint: saved?.email, consent }));
      const query = await result;
      if (query.get('error')) throw new ProviderError(failure('cancelled', { reason: 'sign-in-denied', message: 'Accesso non autorizzato nel browser. Nessuna credenziale è stata salvata.' }));
      const code = query.get('code');
      const returned = query.get('client_id');
      // A reauthorization keeps its client; a callback naming another one is rejected.
      if (saved?.clientId && returned && returned !== saved.clientId) throw new ProviderError(failure('forbidden', { reason: 'sign-in-other-app', message: 'Il browser ha restituito un’altra registrazione dell’app. Accesso interrotto.' }));
      const clientId = saved?.clientId ?? returned;
      if (!code || !clientId) throw new ProviderError(failure('forbidden', { reason: 'sign-in-no-code', message: 'Il browser non ha restituito un codice di accesso valido.' }));
      const tokens = await exchangeCode(this.deps.fetch, { clientId, code, verifier, redirectUri }, controller.signal);
      if (!tokens.id_token) throw new ProviderError(failure('forbidden', { reason: 'sign-in-no-identity', message: 'Manca il token di identità. Accedi di nuovo.' }));
      const claims = await verifyIdToken(this.deps.fetch, tokens.id_token, { clientId, nonce, now: this.now() });
      if (saved?.sub && saved.sub !== claims.sub) {
        // A different person on the same registration: the old tokens must not be mixed with the new identity.
        throw new ProviderError(failure('forbidden', { reason: 'sign-in-other-account', message: 'Hai scelto un account diverso da quello registrato. Esci prima di cambiare account.' }));
      }
      await this.deps.vault.write(this.record(clientId, tokens, { sub: claims.sub, email: claims.email }));
      this.notice = hasPlan(tokens.scope) ? undefined : { code: 'plan-not-authorized', text: 'Accesso riuscito, ma l’uso del piano ChatGPT non è stato autorizzato.' };
      this.deps.log?.(`sign-in completed; plan usage ${hasPlan(tokens.scope) ? 'granted' : 'not granted'}`);
    } finally {
      this.signing = undefined;
    }
    return this.status();
  }
  cancelSignIn() { this.signing?.abort(); }

  private record(clientId: string, tokens: TokenResponse, base: Partial<AccountRecord>): AccountRecord {
    const earliest = tokens.earliest_refresh_at === undefined ? undefined : typeof tokens.earliest_refresh_at === 'number' ? tokens.earliest_refresh_at * 1000 : Date.parse(tokens.earliest_refresh_at);
    return { version: 1, clientId, ...base, idToken: tokens.id_token ?? base.idToken, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? base.refreshToken,
      expiresAt: this.now() + tokens.expires_in * 1000, ...(earliest && Number.isFinite(earliest) ? { earliestRefreshAt: earliest } : {}), scope: tokens.scope ?? base.scope };
  }

  async signOut(): Promise<AccountStatus> {
    this.signing?.abort();
    const record = await this.deps.vault.read();
    if (record?.refreshToken) {
      const revoked = await revokeRefreshToken(this.deps.fetch, { clientId: record.clientId, refreshToken: record.refreshToken });
      this.notice = revoked ? undefined : { code: 'revoke-unconfirmed', text: 'Disconnessione locale completata, ma la revoca non è stata confermata. Puoi scollegare l’app da ChatGPT → Impostazioni.' };
    }
    // The registration and host id stay, so a later sign-in reuses the same client.
    if (record) await this.deps.vault.write({ version: 1, clientId: record.clientId, sub: record.sub, email: record.email });
    return this.status();
  }

  /** A valid access token, refreshed near expiry. Only documented terminal refresh errors end the session. */
  private async token(): Promise<string> {
    const record = this.deps.vault.available() ? await this.deps.vault.read() : null;
    if (!record?.accessToken && !record?.refreshToken) throw new ProviderError(failure('signed-out'));
    if (!hasPlan(record.scope)) throw new ProviderError(failure('plan-disabled'));
    const fresh = record.accessToken && record.expiresAt && record.expiresAt - 120_000 > this.now();
    if (fresh) return record.accessToken!;
    if (!record.refreshToken) throw await this.expire(record);
    this.refreshing ??= (async () => {
      try {
        const tokens = await refreshTokens(this.deps.fetch, { clientId: record.clientId, refreshToken: record.refreshToken! });
        const next = this.record(record.clientId, tokens, record);
        await this.deps.vault.write(next);
        return next;
      } catch (error) {
        if (error instanceof ProviderError && error.failure.code === 'session-expired') throw await this.expire(record);
        throw error;
      } finally { this.refreshing = undefined; }
    })();
    return (await this.refreshing).accessToken!;
  }
  private async expire(record: AccountRecord) {
    await this.deps.vault.write({ version: 1, clientId: record.clientId, sub: record.sub, email: record.email });
    this.notice = { code: 'session-expired', text: 'La sessione ChatGPT è scaduta o è stata scollegata. Accedi di nuovo.' };
    return new ProviderError(failure('session-expired'));
  }

  async models(): Promise<ModelOption[]> {
    return listModels(this.deps.fetch, await this.token());
  }

  async complete(request: CompletionRequest, signal: AbortSignal, onProgress: (received: number) => void): Promise<string> {
    const token = await this.token();
    const body = { model: request.model, instructions: request.instructions, input: request.messages, text: { format: { type: 'json_schema' as const, name: request.schemaName, strict: true as const, schema: request.schema } } };
    try { return await streamResponse(this.deps.fetch, token, body, signal, onProgress); }
    catch (error) {
      // A 401 is diagnosed, not treated as a revocation: credentials are kept until a refresh confirms it.
      if (error instanceof ProviderError && error.failure.code === 'session-expired') {
        this.deps.log?.(`inference rejected the session${error.failure.requestId ? `; request ${error.failure.requestId}` : ''}`);
        throw new ProviderError({ ...error.failure, reason: 'session-rejected', message: 'Il servizio non ha accettato la sessione. Riprova; se succede ancora, esci e accedi di nuovo.', action: 'retry' });
      }
      throw error;
    }
  }
}

export function newHostId() { return `urn:uuid:${randomUUID()}`; }
