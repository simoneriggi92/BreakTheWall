import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// One round in the real page, to look at it: the built launcher starts the server on a throwaway data folder, the
// turn is posted as the mod would post it, and the page's address is printed with its secret. The round page cannot
// be judged in jsdom (measure, themes, rail, drawer), so this is how a person or an agent sees it in a browser.
// Usage: npm run preview:round [-- path/to/turn.md]   (default: scripts/fixtures/preview-round.md)
// Needs `npm run build:plugin` first. The server stops by itself 10 minutes after the last page closes.

const fail = message => { console.error(`preview:round: ${message}`); process.exit(1); };
if (!existsSync('plugin/server/launcher.cjs')) fail('build the plugin first: npm run build:plugin');

const turnFile = resolve(process.argv[2] ?? 'scripts/fixtures/preview-round.md');
if (!existsSync(turnFile)) fail(`no such turn file: ${turnFile}`);

const dataDir = mkdtempSync(join(tmpdir(), 'btw-preview-data-'));
const server = JSON.parse(execFileSync(process.execPath, ['plugin/server/launcher.cjs', 'start'], { env: { ...process.env, BTW_USER_DATA_DIR: dataDir }, encoding: 'utf8' }));
const base = `http://127.0.0.1:${server.port}`;

const reply = await fetch(`${base}/api/turns`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-btw-secret': server.secret },
  body: JSON.stringify({ session: randomUUID(), cwd: process.cwd(), text: readFileSync(turnFile, 'utf8'), reason: 'answer' }),
});
if (!reply.ok) fail(`the server refused the turn (${reply.status})`);
// A turn the server does not read as a round would open the page on the app, not on a round: say so here.
if ((await reply.json()).round === null) fail(`${turnFile} is not a round: no "❓ **Q1** - **title**: body" question`);

console.log(`preview:round: ${base}/#t=${server.secret}`);
console.log(`  data folder ${dataDir} · server pid ${server.pid} (stop it early with: kill ${server.pid})`);
