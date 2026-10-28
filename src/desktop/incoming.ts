import { createHash } from 'node:crypto';
import { chmodSync, rmSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { SourceImportError } from '../core/source';

/**
 * The local entry point through which an AI assistant's MCP server reaches the app (P-20261028-mcp-integration).
 * One JSON object per line in each direction; every request gets exactly one answer line. The app and the server
 * share this module, so they always agree on the address and the protocol.
 */
export const INCOMING_PROTOCOL = 1;
/** Large enough for the largest source the app accepts, or a saved disassembly; anything longer closes the connection. */
export const MAX_LINE_BYTES = 4 * 1024 * 1024;
/** macOS allows 104 bytes for a socket path (Linux 108); keep a margin. */
const MAX_SOCKET_PATH = 100;

/**
 * The app's data folder as Electron resolves it for the name "Break the Wall", for a process that is not Electron
 * (the MCP server). `BTW_USER_DATA_DIR` wins, as in the app.
 */
export function defaultUserData(platform: string, env: Record<string, string | undefined>, home: string): string {
  if (env.BTW_USER_DATA_DIR) return env.BTW_USER_DATA_DIR;
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'Break the Wall');
  if (platform === 'win32') return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Break the Wall');
  return join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'Break the Wall');
}

/**
 * Where the app listens: a socket file in its data folder (mode 0600), or a named pipe on Windows. Both are tied to the
 * data folder, so a development copy with its own folder never answers for the installed app. A data folder whose
 * path would be too long for a socket uses the user's private temporary folder instead.
 */
export function incomingAddress(platform: string, userData: string, temp = tmpdir()): string {
  const tag = createHash('sha256').update(userData).digest('hex').slice(0, 12);
  if (platform === 'win32') return `\\\\.\\pipe\\break-the-wall-${tag}`;
  const path = join(userData, 'incoming.sock');
  return Buffer.byteLength(path) <= MAX_SOCKET_PATH ? path : join(temp, `break-the-wall-${tag}.sock`);
}

/**
 * Splits a byte stream into lines. Returns false, and stops accepting, once a line grows past the limit before its
 * newline arrives.
 */
export function lineReader(onLine: (line: string) => void, maxBytes = MAX_LINE_BYTES) {
  let pending: Buffer[] = []; let size = 0; let overflowed = false;
  return (chunk: Buffer): boolean => {
    if (overflowed) return false;
    let start = 0;
    for (let at = chunk.indexOf(10); at >= 0; at = chunk.indexOf(10, start)) {
      const line = Buffer.concat([...pending, chunk.subarray(start, at)]);
      pending = []; size = 0; start = at + 1;
      if (line.byteLength > maxBytes) { overflowed = true; return false; }
      onLine(line.toString('utf8').replace(/\r$/, ''));
    }
    const rest = chunk.subarray(start);
    size += rest.byteLength;
    if (size > maxBytes) { overflowed = true; pending = []; return false; }
    if (rest.byteLength) pending.push(rest);
    return true;
  };
}

const openSchema = z.strictObject({
  v: z.literal(INCOMING_PROTOCOL), type: z.literal('open'),
  title: z.string().max(1000).optional(), text: z.string(), question: z.string().max(4000).optional(),
});
const helloSchema = z.strictObject({ v: z.literal(INCOMING_PROTOCOL), type: z.literal('hello') });

export type IncomingReply =
  | { ok: true; app: 'break-the-wall'; version: string; protocol: number }
  | { ok: true; title: string; lines: number }
  | { ok: false; code: string; message: string; params?: Record<string, unknown> };
export interface IncomingHandlers {
  version: string;
  /** Imports the text like a paste and shows it in Studio; throws SourceImportError when the text breaks a limit. */
  open(input: { title?: string; text: string; question?: string }): Promise<{ title: string; lines: number }>;
}

/** One request line → one answer. Never throws: anything unexpected becomes an error answer. */
export async function answer(line: string, handlers: IncomingHandlers): Promise<IncomingReply> {
  let message: unknown;
  try { message = JSON.parse(line); } catch { return { ok: false, code: 'bad-json', message: 'The line is not JSON.' }; }
  const v = (message as { v?: unknown } | null)?.v;
  const type = (message as { type?: unknown } | null)?.type;
  if (v !== INCOMING_PROTOCOL) return { ok: false, code: 'protocol', message: `This app speaks protocol ${INCOMING_PROTOCOL}; update Break the Wall or its assistant extension.` };
  if (type === 'hello' && helloSchema.safeParse(message).success) return { ok: true, app: 'break-the-wall', version: handlers.version, protocol: INCOMING_PROTOCOL };
  if (type === 'open') {
    const open = openSchema.safeParse(message);
    if (!open.success) return { ok: false, code: 'bad-request', message: 'An open request needs a text, and an optional title and question.' };
    try { return { ok: true, ...await handlers.open(open.data) }; }
    catch (error) {
      if (error instanceof SourceImportError) return { ok: false, code: error.code, message: error.message, params: { ...error.params } };
      return { ok: false, code: 'unavailable', message: 'The app could not open the text.' };
    }
  }
  return { ok: false, code: 'unknown-type', message: `Unknown request type ${JSON.stringify(type)}.` };
}

/**
 * The listener, on only while the learner allows assistants to connect. `setEnabled` is idempotent; turning it off
 * closes the listener and removes the socket file.
 */
export class IncomingServer {
  private server?: Server;
  private sockets = new Set<Socket>();
  constructor(private address: string, private handlers: IncomingHandlers, private platform = process.platform, private log: (message: string) => void = () => {}) {}

  get listening() { return !!this.server?.listening; }

  async setEnabled(on: boolean): Promise<void> {
    if (on && !this.server) await this.start();
    else if (!on && this.server) await this.stop();
  }

  private async start() {
    const server = createServer(socket => this.serve(socket));
    this.server = server;
    // A file left by an app that did not close cleanly would refuse the new listener.
    if (this.platform !== 'win32') rmSync(this.address, { force: true });
    try {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(this.address, () => { server.off('error', reject); resolve(); }); });
      if (this.platform !== 'win32') chmodSync(this.address, 0o600);
      server.on('error', error => this.log(`listener: ${error.message}`));
    } catch (error) {
      this.server = undefined;
      throw error;
    }
  }

  private async stop() {
    const server = this.server!;
    this.server = undefined;
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (this.platform !== 'win32') rmSync(this.address, { force: true });
  }

  private serve(socket: Socket) {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    // Requests on one connection are answered in order.
    let queue = Promise.resolve();
    const read = lineReader(line => {
      if (!line.trim()) return;
      queue = queue.then(async () => { const reply = await answer(line, this.handlers); if (!socket.destroyed) socket.write(JSON.stringify(reply) + '\n'); });
    });
    socket.on('data', chunk => {
      if (read(chunk)) return;
      socket.end(JSON.stringify({ ok: false, code: 'too-large', message: `A request may be at most ${MAX_LINE_BYTES} bytes.` }) + '\n');
    });
  }
}
