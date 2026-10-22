// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type ProviderFailure } from '../src/core/provider';
import { ChatGPTAccount, type AccountRecord, type Vault } from '../src/desktop/chatgpt/account';
import { AUTH, authorizeUrl, resetJwksCache, verifyIdToken } from '../src/desktop/chatgpt/oauth';
import { listModels, streamResponse, type ResponseBody } from '../src/desktop/chatgpt/responses';
import { Generator } from '../src/desktop/generator';
import { LessonStore } from '../src/desktop/lesson-store';
import { draftFor, userSource } from './draft';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function idToken(claims: Record<string, unknown>, kid = 'k1') {
  const head = `${b64({ alg: 'RS256', kid })}.${b64({ iss: AUTH.issuer, aud: 'oaiapp_1', sub: 'user-1', email: 'learner@example.com', exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
  return `${head}.${sign('sha256', Buffer.from(head), privateKey).toString('base64url')}`;
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
function sse(events: object[]) {
  const text = events.map(e => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_1' } });
}
class MemoryVault implements Vault {
  record: AccountRecord | null = null;
  available() { return true; }
  async read() { return this.record ? structuredClone(this.record) : null; }
  async write(record: AccountRecord) { this.record = structuredClone(record); }
  async clear() { this.record = null; }
}
const body: ResponseBody = { model: 'm', instructions: 'i', input: [{ role: 'user', content: 'c' }], text: { format: { type: 'json_schema', name: 'n', strict: true, schema: {} } } };
const completion = { model: 'm', instructions: 'i', messages: [{ role: 'user' as const, content: 'c' }], schemaName: 'n', schema: {} };
const fail = async (promise: Promise<unknown>): Promise<ProviderFailure> => {
  try { await promise; } catch (error) { expect(error).toBeInstanceOf(ProviderError); return (error as ProviderError).failure; }
  throw new Error('expected a provider failure');
};

beforeEach(() => resetJwksCache());

describe('sign-in request and identity (T5)', () => {
  it('builds the documented authorize URL for a first registration and for reauthorization', () => {
    const first = new URL(authorizeUrl({ hostId: 'urn:uuid:h', redirectUri: 'http://127.0.0.1:1455/auth/callback', state: 's', nonce: 'n', challenge: 'c' }));
    expect(first.origin + first.pathname).toBe('https://auth.openai.com/api/accounts/authorize');
    expect(Object.fromEntries(first.searchParams)).toEqual({ client_id: 'dynamic_agent_client', agent_name_hint: 'Break the Wall', ext_agent_host_id: 'urn:uuid:h', response_type: 'code', redirect_uri: 'http://127.0.0.1:1455/auth/callback', scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', resource: 'https://api.openai.com/v1', state: 's', nonce: 'n', code_challenge: 'c', code_challenge_method: 'S256' });
    const again = new URL(authorizeUrl({ clientId: 'oaiapp_1', hostId: 'urn:uuid:h', redirectUri: 'r', state: 's', nonce: 'n', challenge: 'c', loginHint: 'a@b.c', consent: true }));
    expect(again.searchParams.get('client_id')).toBe('oaiapp_1');
    expect(again.searchParams.has('agent_name_hint')).toBe(false);
    expect(again.searchParams.get('login_hint')).toBe('a@b.c');
    expect(again.searchParams.get('prompt')).toBe('consent');
  });

  it('verifies the ID token signature, issuer, audience, expiry and nonce', async () => {
    const fetchJwks = vi.fn(async () => json(200, { keys: [jwk] })) as unknown as typeof fetch;
    await expect(verifyIdToken(fetchJwks, idToken({ nonce: 'n1' }), { clientId: 'oaiapp_1', nonce: 'n1' })).resolves.toMatchObject({ sub: 'user-1', email: 'learner@example.com' });
    for (const token of [idToken({ nonce: 'other' }), idToken({ nonce: 'n1', aud: 'oaiapp_2' }), idToken({ nonce: 'n1', iss: 'https://evil.example' }), idToken({ nonce: 'n1', exp: 1 }), idToken({ nonce: 'n1' }).slice(0, -4) + 'AAAA', idToken({ nonce: 'n1' }, 'unknown')]) {
      expect((await fail(verifyIdToken(fetchJwks, token, { clientId: 'oaiapp_1', nonce: 'n1' }))).code).toBe('forbidden');
    }
  });
});

describe('account lifecycle (T5)', () => {
  function setup(options: { scope?: string; refresh?: () => Response } = {}) {
    const vault = new MemoryVault();
    const calls: { url: string; form?: URLSearchParams }[] = [];
    let now = Date.now();
    const fake = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const form = typeof init?.body === 'string' && init.body.includes('=') && !init.body.startsWith('{') ? new URLSearchParams(init.body) : undefined;
      calls.push({ url, form });
      if (url === AUTH.jwks) return json(200, { keys: [jwk] });
      if (url === AUTH.token && form?.get('grant_type') === 'authorization_code') return json(200, { access_token: 'access-1', refresh_token: 'refresh-1', id_token: idToken({ nonce: pending.nonce }), token_type: 'Bearer', expires_in: 3600, scope: options.scope ?? 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' });
      if (url === AUTH.token && form?.get('grant_type') === 'refresh_token') return options.refresh?.() ?? json(200, { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'Bearer', expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct' });
      if (url === AUTH.revoke) return new Response('', { status: 200 });
      if (url === 'https://api.openai.com/v1/models') return json(200, { models: [{ slug: 'a', display_name: 'Model A', visibility: 'list' }, { slug: 'h', display_name: 'Hidden', visibility: 'hide' }] });
      return json(404, {});
    }) as unknown as typeof fetch;
    const pending = { nonce: '' };
    const callback = { query: (url: URL) => `code=abc&state=${url.searchParams.get('state')}&client_id=oaiapp_1&scope=x` };
    const account = new ChatGPTAccount({
      vault, fetch: fake, hostId: async () => 'urn:uuid:00000000-0000-4000-8000-000000000000', now: () => now,
      // Plays the browser: follows the authorize URL straight to the loopback callback.
      openExternal: async raw => {
        const url = new URL(raw); pending.nonce = url.searchParams.get('nonce')!;
        void fetch(`${url.searchParams.get('redirect_uri')}?${callback.query(url)}`);
      },
    });
    return { account, vault, calls, callback, advance: (ms: number) => { now += ms; } };
  }

  it('signs in through the loopback callback, keeps tokens in the vault and reports plan capability without tokens', async () => {
    const { account, vault, calls } = setup();
    const status = await account.signIn({ consent: false });
    expect(status).toEqual({ state: 'signed-in', email: 'learner@example.com', planUsage: true, storage: true });
    expect(JSON.stringify(status)).not.toContain('access-1');
    expect(vault.record).toMatchObject({ clientId: 'oaiapp_1', sub: 'user-1', accessToken: 'access-1', refreshToken: 'refresh-1' });
    const exchange = calls.find(c => c.form?.get('grant_type') === 'authorization_code')!.form!;
    expect(exchange.get('client_id')).toBe('oaiapp_1');
    expect(exchange.get('resource')).toBe('https://api.openai.com/v1');
    expect(exchange.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(account.models()).resolves.toEqual([{ slug: 'a', name: 'Model A' }]);
  });

  it('keeps the sign-in but blocks inference when ChatGPT plan usage was not granted', async () => {
    const { account } = setup({ scope: 'openid profile email offline_access' });
    expect(await account.signIn({ consent: false })).toMatchObject({ state: 'signed-in', planUsage: false });
    expect((await fail(account.complete(completion, new AbortController().signal, () => {}))).code).toBe('plan-disabled');
  });

  it('treats a browser denial and a cancelled sign-in as recoverable, storing nothing', async () => {
    const denied = setup();
    denied.callback.query = url => `error=access_denied&state=${url.searchParams.get('state')}`;
    expect((await fail(denied.account.signIn({ consent: false }))).code).toBe('cancelled');
    expect(denied.vault.record).toBeNull();
    const cancelled = setup();
    cancelled.callback.query = () => 'state=wrong';
    const attempt = cancelled.account.signIn({ consent: false });
    await vi.waitFor(async () => expect((await cancelled.account.status()).state).toBe('signing-in'));
    cancelled.account.cancelSignIn();
    expect((await fail(attempt)).code).toBe('cancelled');
    expect(await cancelled.account.status()).toEqual({ state: 'signed-out', storage: true });
  });

  it('rotates tokens on refresh and ends the session only on a terminal refresh error', async () => {
    const ok = setup();
    await ok.account.signIn({ consent: false });
    ok.advance(3600_000);
    await ok.account.models();
    expect(ok.vault.record).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2', clientId: 'oaiapp_1' });

    const transient = setup({ refresh: () => json(503, {}) });
    await transient.account.signIn({ consent: false });
    transient.advance(3600_000);
    expect((await fail(transient.account.models())).code).toBe('unavailable');
    expect(transient.vault.record?.refreshToken).toBe('refresh-1');

    const revoked = setup({ refresh: () => json(400, { error: 'refresh_token_reused' }) });
    await revoked.account.signIn({ consent: false });
    revoked.advance(3600_000);
    expect((await fail(revoked.account.models())).code).toBe('session-expired');
    expect(revoked.vault.record).toEqual({ version: 1, clientId: 'oaiapp_1', sub: 'user-1', email: 'learner@example.com' });
    expect(await revoked.account.status()).toMatchObject({ state: 'signed-out', notice: expect.stringMatching(/scaduta/) });
  });

  it('signs out by revoking the refresh token and keeping the registration for the next sign-in', async () => {
    const { account, vault, calls } = setup();
    await account.signIn({ consent: false });
    expect(await account.signOut()).toEqual({ state: 'signed-out', storage: true });
    expect(calls.find(c => c.url === AUTH.revoke)!.form!.get('token')).toBe('refresh-1');
    expect(vault.record).toEqual({ version: 1, clientId: 'oaiapp_1', sub: 'user-1', email: 'learner@example.com' });
  });
});

describe('Responses streaming and failures (T5)', () => {
  const run = (response: Response | Error, signal = new AbortController().signal) => {
    const fake = vi.fn(async () => { if (response instanceof Error) throw response; return response; }) as unknown as typeof fetch;
    return { fake, result: streamResponse(fake, 'token', body, signal, () => {}) };
  };

  it('accumulates deltas and returns only after response.completed, with store false and stream true', async () => {
    const progress: number[] = [];
    const fake = vi.fn(async () => sse([{ type: 'response.created' }, { type: 'response.output_text.delta', delta: '{"a":' }, { type: 'response.output_text.delta', delta: '1}' }, { type: 'response.completed', response: {} }])) as unknown as typeof fetch;
    await expect(streamResponse(fake, 'token', body, new AbortController().signal, n => progress.push(n))).resolves.toBe('{"a":1}');
    expect(progress).toEqual([5, 7]);
    const [url, init] = (fake as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(JSON.parse(init.body as string)).toMatchObject({ store: false, stream: true, model: 'm' });
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token');
  });

  it('maps documented errors to recoverable states', async () => {
    const cases: [Response | Error, string][] = [
      [json(429, { error: { code: 'subscription_sharing_usage_limit_exceeded' } }), 'usage-limit'],
      [json(403, { error: { code: 'subscription_sharing_user_not_eligible' } }), 'not-eligible'],
      [json(400, { error: { code: 'subscription_sharing_unsupported_capability', param: 'model' } }), 'model-unavailable'],
      [json(400, { error: { code: 'subscription_sharing_unsupported_capability', param: 'text.format' } }), 'unsupported'],
      [json(503, { detail: 'Direct routing unavailable' }), 'unavailable'],
      [json(401, { error: { code: 'subscription_sharing_invalid_user' } }), 'session-expired'],
      [sse([{ type: 'response.output_text.delta', delta: '{' }, { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }]), 'usage-limit'],
      [sse([{ type: 'response.output_text.delta', delta: '{' }, { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }]), 'incomplete'],
      [sse([{ type: 'response.output_text.delta', delta: '{"a":' }]), 'incomplete'],
      [sse([{ type: 'response.refusal.delta', delta: 'No' }]), 'refused'],
      [new TypeError('fetch failed'), 'network'],
      [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'cancelled'],
    ];
    for (const [response, code] of cases) expect((await fail(run(response).result)).code, code).toBe(code);
  });

  it('lists only visible models, in server order', async () => {
    const fake = vi.fn(async () => json(200, { models: [{ slug: 'z', display_name: 'Z', visibility: 'list' }, { slug: 'x', visibility: 'hide' }, { slug: 'a', display_name: 'A', visibility: 'list' }] })) as unknown as typeof fetch;
    await expect(listModels(fake, 't')).resolves.toEqual([{ slug: 'z', name: 'Z' }, { slug: 'a', name: 'A' }]);
  });
});

describe('generation orchestration and saved lessons (T6)', () => {
  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
  async function setup(complete: (signal: AbortSignal) => Promise<string>) {
    const root = await mkdtemp(join(tmpdir(), 'btw-lessons-')); dirs.push(root);
    const store = new LessonStore(root);
    const generator = new Generator({ complete: (_body, signal) => complete(signal) }, store, () => new Date('2026-10-21T17:00:00Z'));
    const source = await userSource();
    return { root, store, generator, source, request: { sources: [source], goal: { outcome: 'Spiegare il ciclo dell’acqua', priorKnowledge: '' }, route: { provider: 'chatgpt', model: 'model-a' } } };
  }

  it('validates, saves and lists a generated lesson that reopens without another request', async () => {
    const { store, generator, source, request } = await setup(async () => JSON.stringify(draftFor(source.id)));
    const result = await generator.generate(request, () => {});
    expect(result.ok).toBe(true);
    const listed = await store.list();
    expect(listed.lessons.map(x => x.id)).toEqual([result.ok && result.lesson.id]);
    expect(listed.lessons[0]).toMatchObject({ kind: 'generated', generation: { model: 'model-a' } });
    await expect(store.find(listed.lessons[0].id, 'v1')).resolves.toEqual(listed.lessons[0]);
  });

  it('saves nothing when the provider result is invalid or the request is cancelled, and keeps earlier lessons', async () => {
    const first = await setup(async () => JSON.stringify(draftFor('src-x')));
    const invalid = await first.generator.generate(first.request, () => {});
    expect(invalid).toMatchObject({ ok: false, failure: { code: 'invalid-output', issues: expect.arrayContaining(['Missing source: all']) } });
    expect(await readdir(first.root)).toEqual([]);

    const ok = await setup(async () => JSON.stringify(draftFor(ok.source.id)));
    await ok.generator.generate(ok.request, () => {});
    let release!: () => void;
    const slow = new Generator({ complete: (_b, signal) => new Promise((_, reject) => { release = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); signal.addEventListener('abort', () => release()); }) }, ok.store);
    const pending = slow.generate(ok.request, () => {});
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(await slow.generate(ok.request, () => {})).toMatchObject({ ok: false, failure: { code: 'busy' } });
    slow.cancel();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
    expect((await ok.store.list()).lessons).toHaveLength(1);
  });

  it('refuses tampered sources from the renderer before any request is sent', async () => {
    const complete = vi.fn(async () => '{}');
    const { generator, request } = await setup(complete);
    const result = await generator.generate({ ...request, sources: [{ ...request.sources[0], text: 'altro' }] }, () => {});
    expect(result).toMatchObject({ ok: false, failure: { code: 'unsupported' } });
    expect(complete).not.toHaveBeenCalled();
  });

  it('skips unreadable saved lessons without deleting them', async () => {
    const { root, store, generator, request, source } = await setup(async () => JSON.stringify(draftFor(source.id)));
    await generator.generate(request, () => {});
    const bad = join(root, 'g-broken'); await writeFile(join(root, 'ignored.txt'), 'x');
    await import('node:fs/promises').then(fs => fs.mkdir(bad)).then(() => writeFile(join(bad, 'v1.json'), '{ broken'));
    const listed = await store.list();
    expect(listed.lessons).toHaveLength(1);
    expect(listed.skipped).toBe(1);
    expect(await readdir(bad)).toEqual(['v1.json']);
  });
});
