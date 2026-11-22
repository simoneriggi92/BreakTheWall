import { homedir } from 'node:os';
import { join } from 'node:path';
import { serverDataDir } from './lock';
import { ensureServer, openPage } from './launch';

/**
 * `node launcher.cjs start | open`, run by the plugin's mod. It prints one JSON line and exits, leaving the server
 * running on its own. `start` finds or starts the server; `open` also opens the page when none is connected.
 */
async function main() {
  const command = process.argv[2];
  const options = { dataDir: serverDataDir(process.platform, process.env, homedir()), serverScript: join(__dirname, 'server.cjs') };
  if (command === 'start') return ensureServer(options);
  if (command === 'open') return openPage(options);
  throw new Error(`Unknown command ${JSON.stringify(command)}: use start or open.`);
}

main().then(
  reply => { process.stdout.write(JSON.stringify(reply) + '\n'); },
  error => { process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1; },
);
