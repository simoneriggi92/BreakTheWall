import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The local page in a real browser (#94), the way `/break-the-wall` opens it: the built launcher starts the server
// on a throwaway data folder, headless Chrome opens the page with the secret, and a fresh tab opens it without.
// Needs `npm run build:plugin` first. Chrome comes from CHROME_PATH or the usual install places.
// Driven over the DevTools protocol, not --dump-dom: the page's held poll keeps the network busy, so a virtual-time
// budget never ends and a --timeout dump catches the page before its first answer.

const fail = message => { console.error(`smoke:page: ${message}`); process.exitCode = 1; };
const wait = ms => new Promise(done => setTimeout(done, ms));
const CHROMES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};
const chromePath = process.env.CHROME_PATH ?? (CHROMES[process.platform] ?? CHROMES.linux).find(existsSync);
if (!existsSync('plugin/server/launcher.cjs')) { fail('build the plugin first: npm run build:plugin'); process.exit(); }
if (!chromePath) { fail('no Chrome found; set CHROME_PATH'); process.exit(); }

const dataDir = mkdtempSync(join(tmpdir(), 'btw-smoke-data-'));
const profile = mkdtempSync(join(tmpdir(), 'btw-smoke-chrome-'));
const server = JSON.parse(execFileSync(process.execPath, ['plugin/server/launcher.cjs', 'start'], { env: { ...process.env, BTW_USER_DATA_DIR: dataDir }, encoding: 'utf8' }));
const base = `http://127.0.0.1:${server.port}`;
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const deadline = setTimeout(() => { fail('timed out'); cleanup(); }, 60_000);

function cleanup() {
  clearTimeout(deadline);
  chrome.kill();
  try { process.kill(server.pid); } catch { /* already stopped */ }
  // Chrome may still hold its profile for a moment; the temporary folder is left to the system if so.
  setTimeout(() => { for (const dir of [dataDir, profile]) try { rmSync(dir, { recursive: true, force: true }); } catch { /* busy */ } process.exit(); }, 500);
}

const status = async () => (await (await fetch(`${base}/api/status`, { headers: { 'x-btw-secret': server.secret } })).json());

try {
  // Chrome writes the port it chose into its profile.
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await wait(100); } }
  if (!port) throw new Error('Chrome did not start');

  /** One tab, driven over its own DevTools socket. */
  async function tab(url) {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, error) => { socket.onopen = done; socket.onerror = error; });
    let id = 0; const pending = new Map();
    socket.onmessage = message => { const data = JSON.parse(message.data); pending.get(data.id)?.(data.result); };
    const send = (method, params = {}) => new Promise(done => { pending.set(++id, done); socket.send(JSON.stringify({ id, method, params })); });
    const read = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    return { read, close: () => socket.close() };
  }
  const settle = async (read, expression) => { for (let i = 0; i < 50; i++) { const value = await read(expression); if (value) return value; await wait(100); } return null; };

  const opened = await tab(`${base}/#t=${server.secret}`);
  const label = await settle(opened.read, 'document.querySelector(".runtime")?.textContent?.startsWith("CLAUDE CODE") && document.querySelector(".runtime").textContent');
  if (!label) fail('the page opened with the secret does not show the app');
  if (await opened.read('location.hash') !== '') fail('the secret is still in the address');
  if (!await opened.read('!!sessionStorage.getItem("btw:page-secret")')) fail('the tab did not keep the secret');
  await wait(300);
  if ((await status()).pageConnected !== true) fail('the server does not count the open page as connected');

  const stray = await tab(`${base}/`);
  const line = await settle(stray.read, 'document.querySelector("main.secretless")?.textContent');
  if (!line?.includes('/break-the-wall')) fail('a tab without the secret does not say to open it from Claude Code');

  // A round with diagrams (#114): Mermaid measures labels while the production policy refuses its styles, so a label
  // measured in one font and shown in another is clipped. Only a real browser under that policy shows it. Every HTML
  // label counts: edge labels in a flowchart, bold titles in a class diagram.
  const turn = await fetch(`${base}/api/turns`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-btw-secret': server.secret },
    body: JSON.stringify({ session: randomUUID(), cwd: process.cwd(), text: readFileSync('scripts/fixtures/preview-round.md', 'utf8'), reason: 'answer' }),
  });
  if (!turn.ok) throw new Error(`the server refused the preview round (${turn.status})`);
  // Q1 holds a flowchart and Q3 a class diagram; only the question in focus is drawn.
  const drawnLabels = () => settle(opened.read, `(() => {
    const labels = [...document.querySelectorAll('.md-diagram.drawn foreignObject')].filter(fo => fo.textContent.trim());
    if (!labels.length) return null;
    return labels.map(fo => {
      const box = fo.getBoundingClientRect(), inner = fo.querySelector('span, p') ?? fo.firstElementChild, text = inner?.getBoundingClientRect();
      return { label: fo.textContent.trim(), clipped: !text || Math.max(text.width, inner.scrollWidth) > box.width + 0.5 || text.height > box.height + 0.5 };
    });
  })()`);
  const first = await drawnLabels();
  await opened.read(`document.querySelectorAll('nav .round-outline-item')[2]?.click()`);
  await wait(200);
  const third = first && await drawnLabels();
  const labels = first && third && [...first, ...third];
  if (!labels) fail('the round\'s diagrams did not draw');
  else if (labels.some(l => l.clipped)) fail(`diagram labels are clipped: ${labels.filter(l => l.clipped).map(l => l.label).join(', ')}`);

  if (!process.exitCode) console.log(`smoke:page: the page opens with the secret (${label}), a tab without it says: ${line}, and a round's diagrams draw ${labels.length} labels whole`);
  opened.close(); stray.close();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  cleanup();
}
