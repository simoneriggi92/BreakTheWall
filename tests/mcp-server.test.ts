// @vitest-environment node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { build } from 'esbuild';
import { afterEach, describe, expect, it } from 'vitest';
import { importSource } from '../src/core/source';
import { IncomingServer, incomingAddress, type IncomingHandlers } from '../src/desktop/incoming';
import { createMcpServer, PROTOCOL_VERSIONS, renderPrompt, serveStdio } from '../src/mcp/protocol';
import { createBreakTheWallServer, PROMPTS, refusalText, TOOLS } from '../src/mcp/server';

const request = (id: number, method: string, params?: object) => JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const initialize = (version = '2025-06-18') => request(1, 'initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.303' } });

describe('the MCP protocol, by hand (M3)', () => {
  const echo = () => createMcpServer({
    info: { name: 'test', version: '1' }, tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }],
    call: async (_name, args, client) => {
      if (args.fail) throw new Error('it failed');
      return { content: [{ type: 'text', text: `${JSON.stringify(args)} from ${client?.name}` }] };
    },
  });

  it('negotiates the protocol version and keeps the client name', async () => {
    const server = echo();
    expect(await server.handle(initialize())).toMatchObject({ id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'test' } } });
    expect(server.client()).toEqual({ name: 'claude-code', version: '2.1.303' });
    expect(await echo().handle(initialize('2099-01-01'))).toMatchObject({ result: { protocolVersion: PROTOCOL_VERSIONS[0] } });
  });

  it('answers ping, lists and calls tools, and turns a thrown error into a tool error', async () => {
    const server = echo();
    await server.handle(initialize());
    expect(await server.handle(request(2, 'ping'))).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
    expect(await server.handle(request(3, 'tools/list'))).toMatchObject({ result: { tools: [{ name: 'echo' }] } });
    expect(await server.handle(request(4, 'tools/call', { name: 'echo', arguments: { a: 1 } }))).toEqual({ jsonrpc: '2.0', id: 4, result: { content: [{ type: 'text', text: '{"a":1} from claude-code' }] } });
    expect(await server.handle(request(5, 'tools/call', { name: 'echo', arguments: { fail: true } }))).toMatchObject({ result: { content: [{ text: 'it failed' }], isError: true } });
  });

  it('gives JSON-RPC errors for bad input, and nothing for notifications', async () => {
    const server = echo();
    expect(await server.handle('{not json')).toMatchObject({ id: null, error: { code: -32700 } });
    expect(await server.handle('[1,2]')).toMatchObject({ error: { code: -32600 } });
    expect(await server.handle('{"id":1,"method":"ping"}')).toMatchObject({ error: { code: -32600 } });
    expect(await server.handle(request(6, 'resources/list'))).toMatchObject({ id: 6, error: { code: -32601 } });
    expect(await server.handle(request(7, 'tools/call', { name: 'delete_everything' }))).toMatchObject({ id: 7, error: { code: -32602 } });
    expect(await server.handle('{"jsonrpc":"2.0","method":"notifications/initialized"}')).toBeUndefined();
    expect(await server.handle('{"jsonrpc":"2.0","id":9,"result":{}}')).toMatchObject({ error: { code: -32600 } });
  });

  it('serves newline-delimited messages on streams until the input ends', async () => {
    const input = new PassThrough(); const output = new PassThrough();
    let written = '';
    output.on('data', chunk => { written += chunk; });
    const done = serveStdio(echo(), input, output);
    input.write(initialize() + '\n\n');
    input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n' + request(2, 'tools/list') + '\n');
    input.end();
    await done;
    const lines = written.trim().split('\n').map(x => JSON.parse(x));
    expect(lines.map(x => x.id)).toEqual([1, 2]);
  });
});

describe('the open_in_break_the_wall tool against the app\'s entry point (M3)', () => {
  const folders: string[] = []; const servers: IncomingServer[] = [];
  afterEach(async () => {
    for (const server of servers.splice(0)) await server.setEnabled(false);
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });
  const address = () => { const f = mkdtempSync(join(tmpdir(), 'btw-')); folders.push(f); return incomingAddress(process.platform, f); };
  const opened: { title?: string; text: string; question?: string }[] = [];
  const handlers: IncomingHandlers = {
    version: 'test',
    open: async input => {
      const source = await importSource({ kind: 'paste', title: input.title || 'From your assistant', text: input.text });
      opened.push(input);
      return { title: source.title, lines: source.text.split('\n').length };
    },
  };
  const app = async (at: string) => { const s = new IncomingServer(at, handlers); servers.push(s); await s.setEnabled(true); return s; };
  const call = (server: ReturnType<typeof createBreakTheWallServer>, args: object) => server.handle(request(2, 'tools/call', { name: 'open_in_break_the_wall', arguments: args }));

  it('lists one tool whose schema needs only the text', async () => {
    expect(TOOLS.map(t => t.name)).toEqual(['open_in_break_the_wall']);
    expect(TOOLS[0].inputSchema).toMatchObject({ required: ['text'] });
  });

  it('opens a text in the running app and says that nothing was generated yet', async () => {
    const at = address(); await app(at);
    const server = createBreakTheWallServer({ address: at, launch: async () => false }, '0.3.0');
    const reply = await call(server, { text: 'one\ntwo', title: 'HTTPS', question: 'How is a certificate checked?' }) as { result: { content: { text: string }[]; isError?: boolean } };
    expect(reply.result.isError).toBeUndefined();
    expect(reply.result.content[0].text).toBe('Opened "HTTPS" (2 lines) in Break the Wall. Studio shows it with the question; the user chooses how to generate and presses Generate there. Nothing has been generated or sent anywhere yet.');
    expect(opened.at(-1)).toEqual({ v: 1, type: 'open', text: 'one\ntwo', title: 'HTTPS', question: 'How is a certificate checked?' } as never);
  });

  it('words the app\'s refusals and a malformed call for the model', async () => {
    const at = address(); await app(at);
    const server = createBreakTheWallServer({ address: at, launch: async () => false }, '0.3.0');
    expect(await call(server, { text: 'x'.repeat(40_001) })).toMatchObject({ result: { isError: true, content: [{ text: 'Break the Wall refused the text: it has 40,001 characters, and a source may have at most 40,000. Send only the part the user wants to understand.' }] } });
    expect(await call(server, { title: 'no text' })).toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('needs "text"') }] } });
    expect(refusalText({ ok: false, code: 'line-too-long', message: '', params: { line: 12, limit: 4000 } })).toBe('Break the Wall refused the text: line 12 is longer than 4,000 characters. Break long lines before sending it.');
  });

  it('starts the app when nothing listens, and waits for it', async () => {
    const at = address();
    let launched = 0;
    const server = createBreakTheWallServer({ address: at, startupMs: 5_000, launch: async () => { launched++; setTimeout(() => void app(at), 700); return true; } }, '0.3.0');
    expect(await call(server, { text: 'started late' })).toMatchObject({ result: { content: [{ text: expect.stringContaining('Opened "From your assistant" (1 lines)') }] } });
    expect(launched).toBe(1);
  });

  it('says how to install the app, or how to turn on the connection, when it cannot be reached', async () => {
    const missing = createBreakTheWallServer({ address: address(), launch: async () => false }, '0.3.0');
    expect(await call(missing, { text: 'x' })).toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('not installed') }] } });
    const off = createBreakTheWallServer({ address: address(), startupMs: 600, launch: async () => true }, '0.3.0');
    expect(await call(off, { text: 'x' })).toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('turn on "Connect AI assistants"') }] } });
  });
});

describe('the break prompt (M4a)', () => {
  const server = () => createBreakTheWallServer({ address: 'unused', launch: async () => false }, '0.3.0');
  type Got = { result: { description: string; messages: { role: string; content: { type: string; text: string } }[] } };

  it('declares prompts and lists break with one optional argument, without its text', async () => {
    const s = server();
    expect(await s.handle(initialize())).toMatchObject({ result: { capabilities: { tools: {}, prompts: { listChanged: false } } } });
    const listed = await s.handle(request(2, 'prompts/list')) as { result: { prompts: Record<string, unknown>[] } };
    expect(listed.result.prompts).toEqual([{ name: 'break', title: 'Break it down in Break the Wall', description: PROMPTS[0].description, arguments: [{ name: 'topic', description: PROMPTS[0].arguments[0].description, required: false }] }]);
  });

  it('puts the topic into one user message that ends in the tool call', async () => {
    const got = await server().handle(request(3, 'prompts/get', { name: 'break', arguments: { topic: '  How does a browser check a certificate?  ' } })) as Got;
    expect(got.result.messages).toHaveLength(1);
    const { role, content } = got.result.messages[0];
    expect(role).toBe('user');
    expect(content.type).toBe('text');
    expect(content.text).toMatch(/^The user wants to take something apart in Break the Wall\. What they asked for: How does a browser check a certificate\?\n/);
    expect(content.text).toContain('Call the Break the Wall tool open_in_break_the_wall');
    expect(content.text).toContain('use that answer unchanged');
  });

  it('leaves the topic empty when the client sends none, or only a word, and refuses an unknown prompt', async () => {
    const empty = await server().handle(request(4, 'prompts/get', { name: 'break' })) as Got;
    expect(empty.result.messages[0].content.text).toMatch(/What they asked for: \n/);
    // Claude Code splits prompt arguments on whitespace and passes only the first word (checked 2026-10-28).
    expect(renderPrompt(PROMPTS[0], { topic: 'Spiegami' })).toContain('What they asked for: Spiegami\n');
    expect(renderPrompt(PROMPTS[0], { topic: 42 })).toContain('What they asked for: \n');
    expect(PROMPTS[0].text).toContain('some clients pass only the first word');
    expect(await server().handle(request(5, 'prompts/get', { name: 'other' }))).toMatchObject({ error: { code: -32602 } });
  });
});

describe('the bundled server (M3)', () => {
  it('starts with plain Node and answers initialize and tools/list', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'btw-mcp-'));
    try {
      const outfile = join(folder, 'mcp-server.cjs');
      await build({ entryPoints: ['src/mcp/main.ts'], bundle: true, platform: 'node', target: 'node18', format: 'cjs', outfile, define: { BTW_VERSION: '"9.9.9"' }, logLevel: 'silent' });
      const child = spawn(process.execPath, [outfile], { env: { ...process.env, BTW_USER_DATA_DIR: folder }, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', chunk => { out += chunk; });
      child.stdin.end(`${initialize()}\n${request(2, 'tools/list')}\n${request(3, 'prompts/list')}\n`);
      const code = await new Promise(resolve => child.on('exit', resolve));
      const lines = out.trim().split('\n').map(x => JSON.parse(x));
      expect(code).toBe(0);
      expect(lines[0]).toMatchObject({ id: 1, result: { serverInfo: { name: 'break-the-wall', version: '9.9.9' } } });
      expect(lines[1].result.tools[0].name).toBe('open_in_break_the_wall');
      expect(lines[2].result.prompts[0].name).toBe('break');
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }, 30_000);
});
