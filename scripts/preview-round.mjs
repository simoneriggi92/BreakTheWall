import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// One round in the real page, to look at it: the built launcher starts the server on a throwaway data folder, the
// turns are posted to one session as the mod would post them, and the page's address is printed with its secret. The
// round page cannot be judged in jsdom (measure, themes, rail, drawer), so this is how a person or an agent sees it in
// a browser. The first turn must be a round, which opens the round phase; each later one is a round or, without one,
// a free block (#99), and the page shows the last.
// Usage: npm run preview:round [-- round.md [turn.md …]]   (default: scripts/fixtures/preview-round.md)
//   e.g. npm run preview:round -- scripts/fixtures/preview-round.md scripts/fixtures/preview-free.md
// Needs `npm run build:plugin` first. The server stops by itself 10 minutes after the last page closes.

const fail = message => { console.error(`preview:round: ${message}`); process.exit(1); };
if (!existsSync('plugin/server/launcher.cjs')) fail('build the plugin first: npm run build:plugin');

const turnFiles = (process.argv.length > 2 ? process.argv.slice(2) : ['scripts/fixtures/preview-round.md']).map(x => resolve(x));
for (const file of turnFiles) if (!existsSync(file)) fail(`no such turn file: ${file}`);

const dataDir = mkdtempSync(join(tmpdir(), 'btw-preview-data-'));
const server = JSON.parse(execFileSync(process.execPath, ['plugin/server/launcher.cjs', 'start'], { env: { ...process.env, BTW_USER_DATA_DIR: dataDir }, encoding: 'utf8' }));
const base = `http://127.0.0.1:${server.port}`;
const session = randomUUID();

for (const [i, file] of turnFiles.entries()) {
  const reply = await fetch(`${base}/api/turns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-btw-secret': server.secret },
    body: JSON.stringify({ session, cwd: process.cwd(), text: readFileSync(file, 'utf8'), reason: 'answer' }),
  });
  if (!reply.ok) fail(`the server refused ${file} (${reply.status})`);
  // A turn the page does not show would leave it on the app or on an earlier turn: say so here.
  const shown = await reply.json();
  if (i === 0 && shown.round === null) fail(`${file} is not a round: no "❓ **Q1** - **title**: body" question`);
  if (shown.round === null && shown.free === undefined) fail(`${file} is shown neither as a round nor as a free block: the round phase ended before it`);
}

console.log(`preview:round: ${base}/#t=${server.secret}`);
console.log(`  data folder ${dataDir} · server pid ${server.pid} (stop it early with: kill ${server.pid})`);
