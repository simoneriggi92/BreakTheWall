import { DEFAULT_LOCAL_ADDRESSES, failure, parseLocalAddress, ProviderError, type FormatCheck, type LocalModel, type LocalServer } from '../../core/provider';
import type { Completer, CompletionRequest } from '../completion';

type Fetch = typeof fetch;
const DETECT_MS = 1_500;
const IDLE_MS = 180_000;

async function getJson(fetchImpl: Fetch, url: string): Promise<unknown> {
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(DETECT_MS) });
    return res.ok ? await res.json() : undefined;
  } catch { return undefined; }
}
const strings = (values: unknown[]) => values.filter((x): x is string => typeof x === 'string');

/**
 * Identifies a runtime by the endpoints it documents, so an unrelated app on the same port is never listed.
 * Order matters: llama.cpp and LM Studio also answer the generic /v1/models.
 */
export async function detectServer(fetchImpl: Fetch, address: string): Promise<LocalServer | null> {
  const baseUrl = parseLocalAddress(address);
  const get = (path: string) => getJson(fetchImpl, baseUrl + path);
  const version = await get('/api/version') as { version?: unknown } | undefined;
  if (typeof version?.version === 'string') {
    const tags = await get('/api/tags') as { models?: { name?: unknown }[] } | undefined;
    // Embedding models cannot write a lesson.
    return { runtime: 'ollama', baseUrl, version: version.version, models: strings((tags?.models ?? []).map(m => m.name)).filter(n => !/embed/i.test(n)) };
  }
  const openAiModels = async () => strings(((await get('/v1/models') as { data?: { id?: unknown }[] } | undefined)?.data ?? []).map(m => m.id));
  const props = await get('/props') as Record<string, unknown> | undefined;
  if (props && typeof props === 'object' && ('default_generation_settings' in props || 'model_path' in props)) {
    return { runtime: 'llamacpp', baseUrl, models: await openAiModels() };
  }
  const lms = await get('/api/v0/models') as { data?: { id?: unknown; type?: unknown }[] } | undefined;
  if (Array.isArray(lms?.data)) return { runtime: 'lmstudio', baseUrl, models: strings(lms.data.filter(m => m.type === 'llm' || m.type === 'vlm').map(m => m.id)) };
  const generic = await get('/v1/models') as { data?: unknown } | undefined;
  if (Array.isArray(generic?.data)) return { runtime: 'openai', baseUrl, models: await openAiModels() };
  return null;
}

export async function discoverServers(fetchImpl: Fetch): Promise<LocalServer[]> {
  const found = await Promise.all(DEFAULT_LOCAL_ADDRESSES.map(([, url]) => detectServer(fetchImpl, url).catch(() => null)));
  return found.filter((x): x is LocalServer => !!x);
}

function transport(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const name = (error as Error)?.name;
  return new ProviderError(name === 'AbortError' ? failure('cancelled') : name === 'TimeoutError' ? failure('local-unreachable', { message: 'Il modello locale non ha risposto in tempo. Controlla che il server sia avviato e il modello caricato.' }) : failure('local-unreachable'));
}
async function httpFailure(res: Response): Promise<ProviderError> {
  const text = await res.text().catch(() => '');
  let message = text;
  try { const body = JSON.parse(text) as { error?: string | { message?: string } }; message = typeof body.error === 'string' ? body.error : body.error?.message ?? text; } catch { /* plain text body */ }
  const issues = message ? [message.slice(0, 200)] : undefined;
  if (/think/i.test(message)) return new ProviderError(failure('unsupported', { issues }));
  if (/context|exceed|too long|n_ctx/i.test(message)) return new ProviderError(failure('local-context', { issues }));
  if (res.status === 404 || /not found|no such model/i.test(message)) return new ProviderError(failure('local-model-missing', { issues }));
  return new ProviderError(failure('local-unreachable', { message: `Il server locale ha risposto con un errore${message ? `: ${message.slice(0, 200)}` : '.'}`, issues }));
}

/** Lines of a streamed body. A server that sends nothing for three minutes is treated as stopped. */
async function* lines(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new ProviderError(failure('incomplete'));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new ProviderError(failure('local-unreachable', { message: 'Il server locale ha smesso di rispondere. Nessun percorso è stato salvato.' }))); }, IDLE_MS); });
    const { value, done } = await Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer));
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let index: number;
    while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (line) yield line; }
    if (done) { if (buffer.trim()) yield buffer.trim(); return; }
  }
}
const sseData = (line: string) => line.startsWith('data:') ? line.slice(5).trim() : undefined;

/** Some chat templates open a reasoning block; closing it asks for the answer directly, which the schema then constrains. */
export function closeReasoning(prompt: string): string {
  return prompt.trimEnd().endsWith('<think>') ? `${prompt.trimEnd()}\n</think>\n\n` : prompt;
}

async function post(fetchImpl: Fetch, url: string, body: unknown, signal: AbortSignal): Promise<Response> {
  let res: Response;
  try { res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }); }
  catch (error) { throw transport(error); }
  if (!res.ok) throw await httpFailure(res);
  return res;
}

/** Sends one schema-constrained request using the mechanism each runtime implements, and returns the completed text. */
export async function completeLocal(fetchImpl: Fetch, target: LocalModel, request: CompletionRequest, signal: AbortSignal, onProgress: (received: number) => void): Promise<string> {
  const baseUrl = parseLocalAddress(target.baseUrl);
  const messages = [{ role: 'system', content: request.instructions }, ...request.messages];
  let text = '';
  const add = (piece: unknown) => { if (typeof piece === 'string' && piece) { text += piece; onProgress(text.length); } };
  try {
    if (target.runtime === 'ollama') {
      // Ollama truncates prompts silently beyond num_ctx, so the window is sized from the request.
      const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
      const numCtx = Math.min(65_536, Math.max(16_384, Math.ceil((chars / 3 + 12_000) / 4_096) * 4_096));
      const body = { model: target.model, messages, format: request.schema, stream: true, think: false, keep_alive: '15m', options: { num_ctx: numCtx, ...(request.maxTokens ? { num_predict: request.maxTokens } : {}) } };
      let res: Response;
      try { res = await post(fetchImpl, `${baseUrl}/api/chat`, body, signal); }
      catch (error) {
        // Models without a reasoning switch reject `think`; the request is repeated without it.
        if (!(error instanceof ProviderError) || !error.failure.issues?.some(x => /think/i.test(x))) throw error;
        res = await post(fetchImpl, `${baseUrl}/api/chat`, { ...body, think: undefined }, signal);
      }
      for await (const line of lines(res)) {
        const event = JSON.parse(line) as { message?: { content?: string }; done?: boolean; done_reason?: string; error?: string };
        if (event.error) throw new ProviderError(failure('local-unreachable', { message: `Il server locale ha segnalato un errore: ${event.error.slice(0, 200)}` }));
        add(event.message?.content);
        if (event.done) {
          if (event.done_reason === 'length') throw new ProviderError(failure('incomplete'));
          return text;
        }
      }
    } else if (target.runtime === 'llamacpp') {
      // The OpenAI-compatible route of llama-server did not enforce schemas in the trial; /completion with json_schema does.
      const template = await (await post(fetchImpl, `${baseUrl}/apply-template`, { messages }, signal)).json() as { prompt?: string };
      if (typeof template.prompt !== 'string') throw new ProviderError(failure('unsupported', { message: 'Il server llama.cpp non espone il template della chat.' }));
      const res = await post(fetchImpl, `${baseUrl}/completion`, { prompt: closeReasoning(template.prompt), json_schema: request.schema, n_predict: request.maxTokens ?? 24_000, stream: true, cache_prompt: true }, signal);
      for await (const line of lines(res)) {
        const data = sseData(line);
        if (!data) continue;
        const event = JSON.parse(data) as { content?: string; stop?: boolean; stop_type?: string; error?: { message?: string } };
        if (event.error) throw /context/i.test(event.error.message ?? '') ? new ProviderError(failure('local-context')) : new ProviderError(failure('local-unreachable', { message: event.error.message?.slice(0, 200) }));
        add(event.content);
        if (event.stop) {
          if (event.stop_type === 'limit') throw new ProviderError(failure('incomplete'));
          return text;
        }
      }
    } else {
      const body = { model: target.model, messages, stream: true, response_format: { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } }, ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}) };
      const res = await post(fetchImpl, `${baseUrl}/v1/chat/completions`, body, signal);
      let finished = false;
      for await (const line of lines(res)) {
        const data = sseData(line);
        if (!data) continue;
        if (data === '[DONE]') return text;
        const event = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[]; error?: { message?: string } | string };
        if (event.error) throw new ProviderError(failure('local-unreachable', { message: (typeof event.error === 'string' ? event.error : event.error.message ?? '').slice(0, 200) || undefined }));
        const choice = event.choices?.[0];
        add(choice?.delta?.content);
        if (choice?.finish_reason === 'length') throw new ProviderError(failure('incomplete'));
        if (choice?.finish_reason === 'stop') finished = true;
      }
      if (finished) return text;
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new ProviderError(failure('incomplete', { message: 'Il server locale ha inviato dati illeggibili. Nessun percorso è stato salvato.' }));
    throw transport(error);
  }
  // A stream that ends without its completion marker is never treated as a result.
  throw new ProviderError(failure('incomplete'));
}

const PROBE_SCHEMA = { type: 'object', properties: { risposta: { type: 'string', enum: ['pronto'] }, numero: { type: 'integer' } }, required: ['risposta', 'numero'], additionalProperties: false };

/**
 * Asks for something the schema forbids. A server that enforces the schema still returns the required fields;
 * one that ignores it follows the prompt. The trial found Ollama 0.30.8 doing the latter without any error.
 */
export async function checkFormat(fetchImpl: Fetch, target: LocalModel, now = () => new Date()): Promise<FormatCheck> {
  const request: CompletionRequest = { model: target.model, instructions: 'Rispondi in JSON.', messages: [{ role: 'user', content: 'Descrivi un gatto in JSON con i campi nome e colore.' }], schemaName: 'controllo_formato', schema: PROBE_SCHEMA, maxTokens: 120 };
  // The first request may load the model into memory, which can take a minute or more.
  let raw: string;
  try { raw = await completeLocal(fetchImpl, target, request, AbortSignal.timeout(180_000), () => {}); }
  catch (error) {
    // An enforced schema closes this tiny object within a few tokens. Running out of budget means the model wrote freely.
    if (!(error instanceof ProviderError) || error.failure.code !== 'incomplete') throw error;
    return { enforced: false, checkedAt: now().toISOString(), detail: 'Il server non ha chiuso la risposta di prova entro il limite: ha ignorato lo schema. Il formato del percorso non è garantito.' };
  }
  let enforced = false;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    enforced = Object.keys(value).sort().join(',') === 'numero,risposta' && value.risposta === 'pronto' && Number.isInteger(value.numero);
  } catch { enforced = false; }
  return {
    enforced, checkedAt: now().toISOString(),
    detail: enforced ? 'Il server ha rispettato lo schema di prova: il formato del percorso viene imposto.' : `Il server ha ignorato lo schema di prova (ha risposto: ${raw.replace(/\s+/g, ' ').trim().slice(0, 80) || 'niente'}). Il formato del percorso non è garantito.`,
  };
}

export function localCompleter(fetchImpl: Fetch, target: LocalModel): Completer {
  return { complete: (request, signal, onProgress) => completeLocal(fetchImpl, target, request, signal, onProgress) };
}
