import { failure, ProviderError, type FailureCode, type ModelOption, type ProviderFailure } from '../../core/provider';
import type { Fetch } from './oauth';

export const API = 'https://api.openai.com/v1';

/** Maps documented admission and Responses errors to recoverable states. Unknown codes keep the HTTP class. */
export function mapError(status: number, code: string | undefined, param?: string, requestId?: string): ProviderFailure {
  const extra = requestId ? { requestId } : {};
  const known: Record<string, FailureCode> = {
    subscription_sharing_user_not_eligible: 'not-eligible',
    subscription_sharing_usage_limit_exceeded: 'usage-limit',
    subscription_sharing_usage_unavailable: 'unavailable',
    subscription_sharing_user_unavailable: 'unavailable',
    subscription_sharing_route_not_supported: 'forbidden',
    subscription_sharing_invalid_user: 'session-expired',
    chatpass_v2_scope_not_authorized: 'plan-disabled',
    chatpass_v2_invalid_authorization_context: 'forbidden',
    model_not_found: 'model-unavailable',
  };
  if (code === 'subscription_sharing_unsupported_capability') return failure(param === 'model' ? 'model-unavailable' : 'unsupported', { ...extra, issues: param ? [`Parametro non supportato: ${param}`] : undefined });
  if (code && known[code]) return failure(known[code], extra);
  if (status === 401) return failure('session-expired', extra);
  if (status === 403) return failure('forbidden', extra);
  if (status === 404) return failure('model-unavailable', extra);
  if (status === 429) return failure('usage-limit', extra);
  if (status >= 500) return failure('unavailable', extra);
  return failure('unsupported', { ...extra, issues: code ? [code] : undefined });
}

async function errorFrom(res: Response): Promise<ProviderError> {
  const body = await res.json().catch(() => ({})) as { error?: { code?: string; param?: string } };
  return new ProviderError(mapError(res.status, body.error?.code ?? undefined, body.error?.param ?? undefined, res.headers.get('x-request-id') ?? undefined));
}
function transportError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  return new ProviderError(failure((error as Error)?.name === 'AbortError' ? 'cancelled' : 'network'));
}

export async function listModels(fetchImpl: Fetch, token: string): Promise<ModelOption[]> {
  let res: Response;
  try { res = await fetchImpl(`${API}/models`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }); }
  catch (error) { throw transportError(error); }
  if (!res.ok) throw await errorFrom(res);
  const body = await res.json() as { models?: { slug?: unknown; display_name?: unknown; visibility?: unknown }[] };
  if (!Array.isArray(body.models)) throw new ProviderError(failure('unsupported', { message: 'L’elenco dei modelli non ha il formato documentato.' }));
  // Server order is kept: it is the account's own ranking.
  return body.models.filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ slug: m.slug as string, name: typeof m.display_name === 'string' ? m.display_name : m.slug as string }));
}

export interface ResponseBody { model: string; instructions: string; input: { role: 'user'; content: string }[]; text: { format: { type: 'json_schema'; name: string; strict: true; schema: Record<string, unknown> } } }

/** Server-sent events, one block per blank line. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let split: number;
    while ((split = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split).replace(/^\r?\n\r?\n/, '');
      const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { yield JSON.parse(data) as Record<string, unknown>; }
      catch { throw new ProviderError(failure('incomplete', { message: 'Il flusso della risposta contiene dati illeggibili. Nessun percorso è stato salvato.' })); }
    }
    if (done) return;
  }
}

/** Sends one Responses request (store false, stream true) and returns the completed output text. */
export async function streamResponse(fetchImpl: Fetch, token: string, body: ResponseBody, signal: AbortSignal, onProgress: (received: number) => void): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(`${API}/responses`, { method: 'POST', signal, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ ...body, store: false, stream: true }) });
  } catch (error) { throw transportError(error); }
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ProviderError(failure('incomplete'));
  const requestId = res.headers.get('x-request-id') ?? undefined;
  let text = '';
  try {
    for await (const event of events(res.body)) {
      const type = event.type as string;
      if (type === 'response.output_text.delta' && typeof event.delta === 'string') { text += event.delta; onProgress(text.length); }
      else if (type === 'response.output_text.done' && typeof event.text === 'string') text = event.text;
      else if (type === 'response.refusal.done' || type === 'response.refusal.delta') throw new ProviderError(failure('refused', { requestId }));
      else if (type === 'response.failed') {
        const error = (event.response as { error?: { code?: string; param?: string } } | undefined)?.error;
        throw new ProviderError(mapError(error?.code?.includes('usage_limit') ? 429 : 500, error?.code ?? undefined, error?.param ?? undefined, requestId));
      } else if (type === 'response.incomplete') {
        const reason = (event.response as { incomplete_details?: { reason?: string } } | undefined)?.incomplete_details?.reason;
        throw new ProviderError(failure('incomplete', { requestId, issues: reason ? [`Motivo: ${reason}`] : undefined }));
      } else if (type === 'error') {
        const error = (event.error ?? event) as { code?: string; param?: string };
        throw new ProviderError(mapError(500, error.code ?? undefined, error.param ?? undefined, requestId));
      } else if (type === 'response.completed') return text;
    }
  } catch (error) { throw transportError(error); }
  // A stream that ends without response.completed is never treated as a result.
  throw new ProviderError(failure('incomplete', { requestId }));
}
