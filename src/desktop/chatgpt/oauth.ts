import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { failure, ProviderError } from '../../core/provider';

/** Endpoints from https://auth.openai.com/.well-known/openid-configuration and the Sign in with ChatGPT guide. */
export const AUTH = {
  issuer: 'https://auth.openai.com',
  authorize: 'https://auth.openai.com/api/accounts/authorize',
  token: 'https://auth.openai.com/api/accounts/oauth/token',
  revoke: 'https://auth.openai.com/api/accounts/oauth/revoke',
  jwks: 'https://auth.openai.com/.well-known/jwks.json',
  resource: 'https://api.openai.com/v1',
  scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
  planScope: 'chatgpt.tokens.use.direct',
  dynamicClient: 'dynamic_agent_client',
  agentName: 'Break the Wall',
  callbackPath: '/auth/callback',
  preferredPort: 1455,
} as const;
export type Fetch = typeof fetch;

export const base64url = (value: Buffer) => value.toString('base64url');
export function pkce() {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

export interface AuthorizeParams { clientId?: string; hostId: string; redirectUri: string; state: string; nonce: string; challenge: string; loginHint?: string; consent?: boolean }
export function authorizeUrl(p: AuthorizeParams): string {
  const url = new URL(AUTH.authorize);
  const q = url.searchParams;
  q.set('client_id', p.clientId ?? AUTH.dynamicClient);
  // The app name is sent only for the first, dynamic registration.
  if (!p.clientId) q.set('agent_name_hint', AUTH.agentName);
  q.set('ext_agent_host_id', p.hostId);
  if (p.clientId && p.loginHint) q.set('login_hint', p.loginHint);
  q.set('response_type', 'code');
  q.set('redirect_uri', p.redirectUri);
  q.set('scope', AUTH.scope);
  q.set('resource', AUTH.resource);
  q.set('state', p.state);
  q.set('nonce', p.nonce);
  q.set('code_challenge', p.challenge);
  q.set('code_challenge_method', 'S256');
  if (p.consent) q.set('prompt', 'consent');
  return url.toString();
}

const page = (title: string, body: string) => `<!doctype html><html lang="it"><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;margin:15vh auto;max-width:28rem;text-align:center;color:#1d2a26"><h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></body></html>`;

/** A one-shot listener on 127.0.0.1 that resolves with the callback query whose state matches. */
export async function listenForCallback(state: string, signal: AbortSignal, ports: number[] = [AUTH.preferredPort, 0]) {
  let server: Server | undefined;
  for (const port of ports) {
    const candidate = createServer();
    const ok = await new Promise<boolean>(resolve => {
      candidate.once('error', () => resolve(false));
      candidate.listen(port, '127.0.0.1', () => resolve(true));
    });
    if (ok) { server = candidate; break; }
  }
  if (!server) throw new ProviderError(failure('network', { message: 'Non è stato possibile aprire la porta locale per completare l’accesso.' }));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : AUTH.preferredPort;
  const redirectUri = `http://127.0.0.1:${port}${AUTH.callbackPath}`;
  const close = () => { server!.closeAllConnections(); server!.close(); };
  const result = new Promise<URLSearchParams>((resolve, reject) => {
    const timeout = setTimeout(() => { close(); reject(new ProviderError(failure('cancelled', { message: 'Accesso non completato entro 10 minuti.' }))); }, 10 * 60_000);
    const stop = () => { clearTimeout(timeout); close(); };
    const abort = () => { stop(); reject(new ProviderError(failure('cancelled', { message: 'Accesso annullato.' }))); };
    // A cancel that arrived while the port was opening has already fired its event.
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    server!.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', redirectUri);
      if (req.method !== 'GET' || url.pathname !== AUTH.callbackPath) { res.writeHead(404).end(); return; }
      // A callback for another attempt is ignored; only the matching state ends this one.
      if (url.searchParams.get('state') !== state) { res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }).end(page('Richiesta non riconosciuta', 'Questa pagina non appartiene all’accesso in corso.')); return; }
      const denied = url.searchParams.has('error');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(denied ? page('Accesso non autorizzato', 'Puoi chiudere questa scheda e tornare a Break the Wall.') : page('Accesso completato', 'Puoi chiudere questa scheda e tornare a Break the Wall.'));
      stop();
      resolve(url.searchParams);
    });
  });
  return { redirectUri, result };
}

export interface TokenResponse { access_token: string; refresh_token?: string; id_token?: string; token_type: string; expires_in: number; scope?: string; earliest_refresh_at?: number | string }
const TERMINAL_REFRESH = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);

async function tokenRequest(fetchImpl: Fetch, form: Record<string, string>, signal?: AbortSignal): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetchImpl(AUTH.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(form).toString(), signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new ProviderError(failure('cancelled'));
    throw new ProviderError(failure('network'));
  }
  const body = await res.json().catch(() => ({})) as Partial<TokenResponse> & { error?: string | { code?: string } };
  if (res.ok && typeof body.access_token === 'string' && typeof body.expires_in === 'number') return body as TokenResponse;
  const code = typeof body.error === 'string' ? body.error : body.error?.code;
  if (code && TERMINAL_REFRESH.has(code)) throw new ProviderError(failure('session-expired'));
  if (code === 'invalid_client') throw new ProviderError(failure('forbidden', { message: 'La registrazione dell’app non è valida. Accedi di nuovo.', action: 'sign-in' }));
  if (res.status >= 500 || res.status === 429) throw new ProviderError(failure('unavailable'));
  // Unknown refusals keep the stored credentials: only the documented terminal codes end a session.
  throw new ProviderError(failure('forbidden', { message: 'Il server di accesso ha rifiutato la richiesta. Riprova o accedi di nuovo.', action: 'sign-in' }));
}

export function exchangeCode(fetchImpl: Fetch, p: { clientId: string; code: string; verifier: string; redirectUri: string }, signal?: AbortSignal) {
  return tokenRequest(fetchImpl, { grant_type: 'authorization_code', client_id: p.clientId, code: p.code, code_verifier: p.verifier, redirect_uri: p.redirectUri, resource: AUTH.resource }, signal);
}
export function refreshTokens(fetchImpl: Fetch, p: { clientId: string; refreshToken: string }) {
  // scope is omitted on purpose: the refresh keeps the scopes already granted.
  return tokenRequest(fetchImpl, { grant_type: 'refresh_token', client_id: p.clientId, refresh_token: p.refreshToken, resource: AUTH.resource });
}
export async function revokeRefreshToken(fetchImpl: Fetch, p: { clientId: string; refreshToken: string }): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchImpl(AUTH.revoke, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: p.refreshToken, token_type_hint: 'refresh_token', client_id: p.clientId }).toString() });
      if (res.ok) return true;
      if (res.status < 500) return false;
    } catch { /* retried below */ }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return false;
}

export interface IdClaims { sub: string; email?: string; exp: number; nonce?: string }
let jwksCache: { keys: (JsonWebKey & { kid?: string })[] } | undefined;
/** Verifies the RS256 signature against OpenAI's published keys, then issuer, audience, expiry and nonce. */
export async function verifyIdToken(fetchImpl: Fetch, idToken: string, expected: { clientId: string; nonce?: string; now?: number }): Promise<IdClaims> {
  const bad = () => new ProviderError(failure('forbidden', { message: 'Il token di identità non ha superato la verifica. Accedi di nuovo.', action: 'sign-in' }));
  const parts = idToken.split('.');
  if (parts.length !== 3) throw bad();
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256') throw bad();
  const keys = async (reload: boolean) => {
    if (!jwksCache || reload) {
      const res = await fetchImpl(AUTH.jwks).catch(() => { throw new ProviderError(failure('network')); });
      if (!res.ok) throw new ProviderError(failure('unavailable'));
      jwksCache = await res.json() as { keys: (JsonWebKey & { kid?: string })[] };
    }
    return jwksCache.keys;
  };
  let jwk = (await keys(false)).find(k => k.kid === header.kid);
  // Keys rotate: one reload before giving up.
  jwk ??= (await keys(true)).find(k => k.kid === header.kid);
  if (!jwk) throw bad();
  const valid = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!valid) throw bad();
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as IdClaims & { iss?: string; aud?: string | string[] };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = (expected.now ?? Date.now()) / 1000;
  if (claims.iss !== AUTH.issuer || !audiences.includes(expected.clientId) || typeof claims.sub !== 'string' || !(claims.exp > now - 60)) throw bad();
  if (expected.nonce !== undefined && claims.nonce !== expected.nonce) throw bad();
  return { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined, exp: claims.exp, nonce: claims.nonce };
}
export function resetJwksCache() { jwksCache = undefined; }
