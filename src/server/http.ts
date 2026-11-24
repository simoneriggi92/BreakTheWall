import type { IncomingMessage, ServerResponse } from 'node:http';

/** What every route module answers with, imported the same way by each. */

const MAX_BODY_BYTES = 64 * 1024;

/** Claude Code no longer keeps the session's transcript (#103): its rounds and side chats take nothing more. */
export const TRANSCRIPT_GONE = { error: 'transcript-gone' } as const;

/** The request's JSON body, or undefined when it is too large or not JSON. */
export async function readJson(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength;
    if (size > maxBytes) return undefined;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return undefined; }
}

export function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

export function noContent(res: ServerResponse) {
  res.writeHead(204, { 'cache-control': 'no-store' }).end();
}
