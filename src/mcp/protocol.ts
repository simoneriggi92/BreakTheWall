import type { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';

/**
 * The Model Context Protocol over stdio, written by hand (P-20261028-mcp-integration M3): newline-delimited
 * JSON-RPC 2.0, with only what a tools-only server needs. Nothing but protocol goes to stdout.
 */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;

export interface ToolDefinition { name: string; title?: string; description: string; inputSchema: Record<string, unknown> }
export interface ToolResult { content: { type: 'text'; text: string }[]; isError?: boolean }
export interface ClientInfo { name: string; version: string }
/** A prompt as listed, and its text with `${arguments.<name>}` placeholders (the same form as the MCPB manifest). */
export interface PromptDefinition { name: string; title?: string; description: string; arguments: { name: string; description: string; required: boolean }[]; text: string }
export interface McpServerOptions {
  info: { name: string; title?: string; version: string };
  instructions?: string;
  tools: ToolDefinition[];
  prompts?: PromptDefinition[];
  /** Runs a listed tool. A thrown error becomes a tool error the model can read, not a protocol error. */
  call(name: string, args: Record<string, unknown>, client: ClientInfo | undefined): Promise<ToolResult>;
}

type Id = string | number;
type Response = { jsonrpc: '2.0'; id: Id | null; result: unknown } | { jsonrpc: '2.0'; id: Id | null; error: { code: number; message: string } };
const ERRORS = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602 } as const;
const failure = (id: Id | null, code: number, message: string): Response => ({ jsonrpc: '2.0', id, error: { code, message } });
const isId = (x: unknown): x is Id => typeof x === 'string' || typeof x === 'number';

/** The server's state across one client session. `handle` takes one line and returns the line to send back, if any. */
export function createMcpServer(options: McpServerOptions) {
  let client: ClientInfo | undefined;
  const names = new Set(options.tools.map(t => t.name));
  const prompts = options.prompts ?? [];

  async function handle(line: string): Promise<Response | undefined> {
    let message: unknown;
    try { message = JSON.parse(line); } catch { return failure(null, ERRORS.parse, 'Parse error'); }
    if (typeof message !== 'object' || message === null || Array.isArray(message) || (message as { jsonrpc?: unknown }).jsonrpc !== '2.0') return failure(null, ERRORS.invalidRequest, 'Invalid request');
    const { id, method, params } = message as { id?: unknown; method?: unknown; params?: unknown };
    // Notifications (no id) and responses to requests this server never sends need no answer.
    if (id === undefined) return undefined;
    if (!isId(id) || typeof method !== 'string') return failure(isId(id) ? id : null, ERRORS.invalidRequest, 'Invalid request');
    const p = (typeof params === 'object' && params !== null ? params : {}) as Record<string, unknown>;
    const ok = (result: unknown): Response => ({ jsonrpc: '2.0', id, result });

    if (method === 'initialize') {
      const asked = typeof p.protocolVersion === 'string' ? p.protocolVersion : '';
      const info = p.clientInfo as { name?: unknown; version?: unknown } | undefined;
      if (typeof info?.name === 'string') client = { name: info.name.slice(0, 100), version: typeof info.version === 'string' ? info.version.slice(0, 50) : '' };
      return ok({
        protocolVersion: (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, ...(prompts.length ? { prompts: { listChanged: false } } : {}) },
        serverInfo: options.info,
        ...(options.instructions ? { instructions: options.instructions } : {}),
      });
    }
    if (method === 'ping') return ok({});
    if (method === 'tools/list') return ok({ tools: options.tools });
    if (method === 'prompts/list') return ok({ prompts: prompts.map(({ text: _text, ...listed }) => listed) });
    if (method === 'prompts/get') {
      const prompt = prompts.find(x => x.name === p.name);
      if (!prompt) return failure(id, ERRORS.invalidParams, `Unknown prompt: ${String(p.name)}`);
      const given = (typeof p.arguments === 'object' && p.arguments !== null ? p.arguments : {}) as Record<string, unknown>;
      return ok({ description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: renderPrompt(prompt, given) } }] });
    }
    if (method === 'tools/call') {
      const name = p.name;
      if (typeof name !== 'string' || !names.has(name)) return failure(id, ERRORS.invalidParams, `Unknown tool: ${String(name)}`);
      const args = typeof p.arguments === 'object' && p.arguments !== null && !Array.isArray(p.arguments) ? p.arguments as Record<string, unknown> : {};
      try { return ok(await options.call(name, args, client)); }
      catch (error) { return ok({ content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true }); }
    }
    return failure(id, ERRORS.methodNotFound, `Method not found: ${method}`);
  }

  return { handle, client: () => client };
}

/** Fills `${arguments.<name>}` with the client's values; a missing or non-string value becomes empty. */
export function renderPrompt(prompt: PromptDefinition, given: Record<string, unknown>): string {
  return prompt.text.replace(/\$\{arguments\.([A-Za-z0-9_]+)\}/g, (_match, name: string) => typeof given[name] === 'string' ? (given[name] as string).trim() : '');
}

/** Serves one client on a pair of streams until the input ends. Requests are answered as they finish. */
export function serveStdio(server: ReturnType<typeof createMcpServer>, input: Readable, output: Writable): Promise<void> {
  const pending = new Set<Promise<void>>();
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', line => {
    if (!line.trim()) return;
    const work = server.handle(line).then(response => { if (response) output.write(JSON.stringify(response) + '\n'); });
    pending.add(work);
    void work.finally(() => pending.delete(work));
  });
  return new Promise(resolve => lines.on('close', () => { void Promise.all(pending).then(() => resolve()); }));
}
