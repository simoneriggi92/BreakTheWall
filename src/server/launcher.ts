import { homedir } from 'node:os';
import { join } from 'node:path';
import { serverDataDir } from './lock';
import { ensureServer, markPhase, openPage } from './launch';

declare const BTW_VERSION: string;

/**
 * `node launcher.cjs start [<session>] | open [<session>] | phase <session> <cwd> [<skill> <args>]`, run by the plugin. It prints one JSON line and exits,
 * leaving the server running on its own. `start` finds or starts the server; `open` also opens the page when none is
 * connected; `phase`, run by the injection hook, opens the session's round phase on a running server (#99).
 */
async function main() {
  const command = process.argv[2];
  const options = { dataDir: serverDataDir(process.platform, process.env, homedir()), serverScript: join(__dirname, 'server.cjs') };
  // The launcher's own version and the session it runs for: an older server no other session uses is replaced (#102).
  const replacing = { ...options, version: BTW_VERSION, session: process.argv[3] || undefined };
  if (command === 'start') return ensureServer(replacing);
  if (command === 'open') return openPage(replacing);
  if (command === 'phase') return markPhase({ dataDir: options.dataDir, session: process.argv[3] ?? '', cwd: process.argv[4] ?? '', skill: process.argv[5], args: process.argv[6] });
  throw new Error(`Unknown command ${JSON.stringify(command)}: use start, open or phase.`);
}

main().then(
  reply => { process.stdout.write(JSON.stringify(reply) + '\n'); },
  error => { process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1; },
);
