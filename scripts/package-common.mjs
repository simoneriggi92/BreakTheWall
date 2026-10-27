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
export const size = path => `${(statSync(path).size / 1e6).toFixed(1)} MB`;

export function requireBuild() {
  for (const built of ['dist/index.html', 'dist-electron/main.cjs', 'dist-electron/preload.cjs']) {
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

/** Writes `<file>.sha256` in the format `shasum -a 256 -c` reads, and returns the digest. */
export function checksum(file) {
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.sha256`, `${digest}  ${file.split(/[\\/]/).pop()}\n`);
  return digest;
}
