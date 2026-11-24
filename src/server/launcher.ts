import { homedir } from 'node:os';
import { join } from 'node:path';
import { serverDataDir } from './lock';
import { ensureServer, markPhase, openPage } from './launch';

/**
 * `node launcher.cjs start | open | phase <session> <cwd>`, run by the plugin. It prints one JSON line and exits,
 * leaving the server running on its own. `start` finds or starts the server; `open` also opens the page when none is
 * connected; `phase`, run by the injection hook, opens the session's round phase on a running server (#99).
 */
async function main() {
  const command = process.argv[2];
  const options = { dataDir: serverDataDir(process.platform, process.env, homedir()), serverScript: join(__dirname, 'server.cjs') };
  if (command === 'start') return ensureServer(options);
  if (command === 'open') return openPage(options);
  if (command === 'phase') return markPhase({ dataDir: options.dataDir, session: process.argv[3] ?? '', cwd: process.argv[4] ?? '' });
  throw new Error(`Unknown command ${JSON.stringify(command)}: use start, open or phase.`);
}

main().then(
  reply => { process.stdout.write(JSON.stringify(reply) + '\n'); },
  error => { process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1; },
);
