// Bundles the evaluation runner and starts it inside Electron, which the ChatGPT route needs for the Keychain-backed session.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import electron from 'electron';

await build({
  entryPoints: ['eval/runner.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  outfile: 'dist-eval/runner.cjs', external: ['electron'], logLevel: 'warning',
});
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['dist-eval/runner.cjs', '--', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
