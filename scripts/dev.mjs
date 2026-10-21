import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
import './build-desktop.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
await server.listen();
server.printUrls();
const env = { ...process.env, BTW_RENDERER_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
const close = async () => { child.kill(); await server.close(); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 1; });
child.on('error', async error => { console.error(error); await close(); process.exitCode = 1; });
