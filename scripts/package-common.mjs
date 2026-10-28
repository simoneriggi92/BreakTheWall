// Shared by the macOS and Windows package scripts: what goes into the app, and the start check of the packaged app.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..');
export const NAME = 'Break the Wall';
export const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
export const COPYRIGHT = 'Copyright 2026 Simone Riggi. Apache License 2.0.';
// Every runtime dependency is already bundled by Vite and esbuild, so only the build output, the assets and
// package.json go in: no node_modules.
const kept = /^\/(dist|dist-electron|assets)(\/|$)|^\/package\.json$/;
export const ignore = path => path !== '' && !kept.test(path.replaceAll('\\', '/'));
// The MCP server and the Claude Desktop extension are read by other programs (Claude Code, Claude Desktop), which
// cannot look inside app.asar: they go to app.asar.unpacked (P-20261028-mcp-integration M4).
export const asar = { unpack: '**/dist-electron/{mcp-server.cjs,break-the-wall.mcpb}' };
export const MCP_FILES = ['dist-electron/mcp-server.cjs', 'dist-electron/break-the-wall.mcpb'];
export const size = path => `${(statSync(path).size / 1e6).toFixed(1)} MB`;

export function requireBuild() {
  for (const built of ['dist/index.html', 'dist-electron/main.cjs', 'dist-electron/preload.cjs', ...MCP_FILES]) {
    if (!existsSync(join(root, built))) throw new Error(`${built} is missing: run npm run build first.`);
  }
}

/** Opens the packaged app with empty user data and BTW_SMOKE_TEST=1, and fails unless it draws the library. */
export async function startCheck(executable) {
  const userData = mkdtempSync(join(tmpdir(), 'btw-start-check-'));
  const started = await new Promise(done => {
    const env = { ...process.env, BTW_SMOKE_TEST: '1', BTW_USER_DATA_DIR: userData };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, [], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); done({ code: null, output: output + 'start check: no answer within 60 s' }); }, 60_000);
    child.on('exit', code => { clearTimeout(timer); done({ code, output }); });
  });
  rmSync(userData, { recursive: true, force: true });
  const reason = started.output.split(/\r?\n/).find(line => line.startsWith('start check:')) ?? 'start check: no report';
  if (started.code !== 0) throw new Error(`The packaged app did not start: ${reason}`);
  console.log(reason);
}

/**
 * Runs the packaged MCP server as Claude Code will, with the app's Electron in Node mode, and fails unless it answers
 * `initialize` and lists its tool and its prompt. `resources` is the folder holding app.asar.unpacked.
 */
export async function serverCheck(executable, resources) {
  for (const file of MCP_FILES) {
    const path = join(resources, 'app.asar.unpacked', file);
    if (!existsSync(path)) throw new Error(`${path} is missing from the package.`);
  }
  const userData = mkdtempSync(join(tmpdir(), 'btw-server-check-'));
  const answered = await new Promise(done => {
    const child = spawn(executable, [join(resources, 'app.asar.unpacked', MCP_FILES[0])], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', BTW_USER_DATA_DIR: userData }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); done(''); }, 30_000);
    child.on('exit', () => { clearTimeout(timer); done(output); });
    child.stdin.end(['{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"server-check","version":"1"}}}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}', '{"jsonrpc":"2.0","id":3,"method":"prompts/list"}'].join('\n') + '\n');
  });
  rmSync(userData, { recursive: true, force: true });
  const replies = answered.split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } });
  const info = replies.find(x => x.id === 1)?.result?.serverInfo;
  const tools = replies.find(x => x.id === 2)?.result?.tools?.map(t => t.name) ?? [];
  const prompts = replies.find(x => x.id === 3)?.result?.prompts?.map(p => p.name) ?? [];
  if (info?.name !== 'break-the-wall' || !tools.includes('open_in_break_the_wall') || !prompts.includes('break')) throw new Error(`The packaged MCP server did not answer: ${answered.slice(0, 300) || 'no output'}`);
  console.log(`server check: the MCP server ${info.version} answers with the tools ${tools.join(', ')} and the prompt ${prompts.join(', ')}`);
}

/** Writes `<file>.sha256` in the format `shasum -a 256 -c` reads, and returns the digest. */
export function checksum(file) {
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.sha256`, `${digest}  ${file.split(/[\\/]/).pop()}\n`);
  return digest;
}
