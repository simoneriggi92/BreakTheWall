import { homedir } from 'node:os';
import { join } from 'node:path';
import { serverDataDir } from './lock';
import { startLocalServer } from './server';

declare const BTW_VERSION: string;

/** The detached server process the launcher starts. It serves the page built beside it, in the plugin's `page/`. */
async function main() {
  const server = await startLocalServer({
    dataDir: serverDataDir(process.platform, process.env, homedir()),
    staticDir: join(__dirname, '..', 'page'),
    version: BTW_VERSION,
  });
  // Another server already owns the lock: this one steps aside.
  if (!server) return;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { void server.stop(); });
  // A closing terminal is not a reason to stop: the server outlives the session that started it.
  process.on('SIGHUP', () => {});
  await server.stopped;
}

main().then(() => process.exit(0), () => process.exit(1));
