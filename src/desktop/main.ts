import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, session, shell } from 'electron';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPreparedDisassemblies } from '../fixtures/disassemblies';
import { loadPreparedLessons } from '../fixtures/lessons';
import { ProgressStore } from './progress-store';
import { progressKeySchema, progressStateSchema } from '../core/bridge';
import { resolveLanguage } from '../core/language';
import { idSchema } from '../core/lesson';
import { failure, localModelSchema, ProviderError, type GenerationProgress, type PickedSources } from '../core/provider';
import { importSource, SOURCE_LIMITS, SourceImportError } from '../core/source';
import { appFilePath, LIBRARY_DRAWN } from './app-files';
import { ChatGPTAccount } from './chatgpt/account';
import { AUTH } from './chatgpt/oauth';
import { DraftStore } from './generation-draft';
import { Generator } from './generator';
import { checkFormat, detectServer, discoverServers, localCompleter } from './local/runtimes';
import { SettingsStore } from './settings-store';
import { DisassemblyStore } from './disassembly-store';
import { LessonStore } from './lesson-store';
import { hostIdFile, SafeStorageVault } from './secure-files';

protocol.registerSchemesAsPrivileged([{ scheme: 'btw', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Break the Wall');
if (process.env.BTW_USER_DATA_DIR) app.setPath('userData', resolve(process.env.BTW_USER_DATA_DIR));
const devURL = process.env.BTW_RENDERER_URL;
if (devURL && devURL !== 'http://127.0.0.1:5173') throw new Error('Unsupported development origin');
const origin = devURL ?? 'btw://app';
/** The app icon (rendered from docs/images/brand/app-icon.svg by `npm run brand`). A packaged bundle carries its own. */
const icon = resolve(__dirname, '../assets/icon.png');
/** The start check run by `npm run package` and the release workflow: open the window, wait for the library, exit 0 or 1. */
const smokeTest = process.env.BTW_SMOKE_TEST === '1';

function trustedSender(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (!url || event.senderFrame !== event.sender.mainFrame || !url.startsWith(origin + '/')) throw new Error('Untrusted sender');
}

/** Import, account and generation operations. Tokens and file paths never cross into the renderer. */
function registerStudio(userData: string, lessons: LessonStore, disassemblies: DisassemblyStore, progress: ProgressStore) {
  const account = new ChatGPTAccount({
    vault: new SafeStorageVault(join(userData, 'credentials', 'chatgpt.bin'), safeStorage),
    hostId: hostIdFile(join(userData, 'credentials', 'agent-host.json')),
    fetch: globalThis.fetch.bind(globalThis),
    openExternal: async url => { if (!url.startsWith(AUTH.authorize + '?')) throw new Error('Unexpected sign-in URL'); await shell.openExternal(url); },
    log: message => console.info(`[chatgpt] ${message}`),
  });
  const localFetch = globalThis.fetch.bind(globalThis);
  // Taking a part apart moves the learner's progress to the new revision, through the same store the player uses.
  // A failed or cancelled generation keeps what was accepted next to the saved disassemblies (D21).
  const generator = new Generator({ chatgpt: account, local: target => localCompleter(localFetch, target) }, disassemblies, undefined, (previous, next) => progress.carry(previous, next), new DraftStore(join(userData, 'generation-draft.json')));
  const settings = new SettingsStore(join(userData, 'settings.json'));
  // Host-side text (file dialog, sign-in page) follows the same setting as the interface.
  const language = async () => resolveLanguage((await settings.read()).language, systemLocale());
  const asFailure = (error: unknown) => {
    if (error instanceof ProviderError) return { ok: false as const, failure: error.failure };
    console.error('[studio]', (error as Error)?.message);
    return { ok: false as const, failure: failure('unavailable') };
  };
  ipcMain.handle('sources:pick', async event => {
    trustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const en = await language() === 'en';
    const options = { title: en ? 'Choose text sources' : 'Scegli fonti di testo', properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[], filters: [{ name: en ? 'Text and Markdown' : 'Testo e Markdown', extensions: ['txt', 'md', 'markdown'] }] };
    const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    const result: PickedSources = { sources: [], errors: [] };
    for (const path of picked.canceled ? [] : picked.filePaths.slice(0, SOURCE_LIMITS.maxSources)) {
      const name = basename(path);
      try {
        // Size is checked before reading; only the selected files are opened, never their folder.
        const info = await stat(path);
        if (!info.isFile()) throw new SourceImportError('unsupported-type', `«${name}» non è un file.`, { name });
        if (info.size > SOURCE_LIMITS.maxFileBytes) throw new SourceImportError('too-large', `«${name}» supera il limite di ${SOURCE_LIMITS.maxFileBytes / 1000} kB.`, { name, kb: Math.ceil(info.size / 1000), limit: SOURCE_LIMITS.maxFileBytes / 1000 });
        result.sources.push(await importSource({ kind: 'file', name, bytes: new Uint8Array(await readFile(path)) }));
      } catch (error) {
        result.errors.push(error instanceof SourceImportError ? { name, message: error.message, code: error.code, params: { name, ...error.params } } : { name, message: `«${name}» non è leggibile.`, code: 'unreadable', params: { name } });
      }
    }
    if (picked.filePaths.length > SOURCE_LIMITS.maxSources) result.errors.push({ name: '', message: `Sono stati considerati solo i primi ${SOURCE_LIMITS.maxSources} file.`, code: 'truncated', params: { limit: SOURCE_LIMITS.maxSources } });
    return result;
  });
  ipcMain.handle('account:status', event => { trustedSender(event); return account.status(); });
  ipcMain.handle('account:sign-in', async (event, input: unknown) => {
    trustedSender(event);
    try { return { ok: true, status: await account.signIn({ consent: (input as { consent?: unknown })?.consent === true, language: await language() }) }; }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('account:cancel-sign-in', event => { trustedSender(event); account.cancelSignIn(); });
  ipcMain.handle('account:sign-out', event => { trustedSender(event); return account.signOut(); });
  ipcMain.handle('account:models', async event => {
    trustedSender(event);
    try { return { ok: true, models: await account.models() }; }
    catch (error) { return asFailure(error); }
  });
  /** Phase, repair, part, request and part-status changes are always sent; character counts are throttled. */
  const progressTo = (event: Electron.IpcMainInvokeEvent) => {
    let last = 0; let step = '';
    return (progress: GenerationProgress) => {
      const now = Date.now();
      const next = `${progress.phase}:${progress.repairing}:${progress.shortening}:${progress.part}:${progress.requests}:${progress.preview?.parts.map(p => p.status[0]).join('')}`;
      if (next !== step || now - last > 200) { last = now; step = next; event.sender.send('generation:progress', progress); }
    };
  };
  ipcMain.handle('generation:start', async (event, input: unknown) => {
    trustedSender(event);
    try { return await generator.generate(input, progressTo(event)); }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('disassembly:expand', async (event, input: unknown) => {
    trustedSender(event);
    try { return await generator.expand(input, progressTo(event)); }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('settings:get', event => { trustedSender(event); return settings.read(); });
  ipcMain.handle('settings:save', (event, input: unknown) => { trustedSender(event); return settings.write(input); });
  ipcMain.handle('local:discover', event => { trustedSender(event); return discoverServers(localFetch); });
  ipcMain.handle('local:connect', async (event, address: unknown) => {
    trustedSender(event);
    try {
      const server = await detectServer(localFetch, String(address ?? ''));
      return server ? { ok: true, server } : { ok: false, failure: failure('local-unreachable', { reason: 'local-not-a-server', message: 'A questo indirizzo non risponde un server di modelli riconosciuto (Ollama, LM Studio, llama.cpp o compatibile OpenAI).' }) };
    } catch (error) { return asFailure(error); }
  });
  ipcMain.handle('local:check', async (event, input: unknown) => {
    trustedSender(event);
    try { return { ok: true, check: await checkFormat(localFetch, localModelSchema.parse(input)) }; }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('generation:cancel', event => { trustedSender(event); generator.cancel(); });
  ipcMain.handle('generation:draft', event => { trustedSender(event); return generator.draft(); });
  ipcMain.handle('suggestions:start', async (event, input: unknown) => {
    trustedSender(event);
    try { return await generator.suggest(input); }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('suggestions:cancel', event => { trustedSender(event); generator.cancelSuggestions(); });
  ipcMain.handle('lessons:list', event => { trustedSender(event); return lessons.list(); });
  ipcMain.handle('disassemblies:list', event => { trustedSender(event); return disassemblies.list(); });
  ipcMain.handle('disassemblies:find', async (event, key: unknown) => {
    trustedSender(event);
    const id = idSchema.safeParse((key as { id?: unknown })?.id); const revision = idSchema.safeParse((key as { revision?: unknown })?.revision);
    return id.success && revision.success ? (await disassemblies.find(id.data, revision.data)) ?? null : null;
  });
  ipcMain.handle('account:usage-settings', async event => { trustedSender(event); await shell.openExternal('https://chatgpt.com/#settings'); });
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Break the Wall', width: 1480, height: 980, minWidth: 720, minHeight: 650,
    backgroundColor: '#f3f5ef', show: !smokeTest, ...(process.platform !== 'darwin' && existsSync(icon) ? { icon } : {}),
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) event.preventDefault(); });
  if (smokeTest) checkStart(window);
  void window.loadURL(origin + '/');
}

/** Exits 0 once the library is drawn, 1 if the page fails, its renderer dies, or nothing is drawn within 30 s. */
function checkStart(window: BrowserWindow) {
  const end = (code: number, reason: string) => { console.log(`start check: ${reason}`); app.exit(code); };
  const timer = setTimeout(() => end(1, 'the library was not drawn within 30 s'), 30_000);
  window.webContents.on('did-fail-load', (_event, code, description, url) => end(1, `${url} failed to load (${code} ${description})`));
  window.webContents.on('render-process-gone', (_event, details) => end(1, `the renderer stopped (${details.reason})`));
  window.webContents.on('did-finish-load', async () => {
    for (let i = 0; i < 100; i++) {
      if (await window.webContents.executeJavaScript(LIBRARY_DRAWN).catch(() => false)) { clearTimeout(timer); return end(0, 'the library is drawn'); }
      await new Promise(r => setTimeout(r, 250));
    }
  });
}

/** The first preferred language of the operating system, which `system` settings follow. */
const systemLocale = () => app.getPreferredSystemLanguages()[0] ?? app.getLocale();

void app.whenReady().then(async () => {
  const root = resolve(__dirname, '../dist');
  protocol.handle('btw', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
    const path = appFilePath(root, url.pathname);
    if (!path) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(path).href);
  });
  if (process.platform === 'darwin' && !app.isPackaged && existsSync(icon)) app.dock?.setIcon(icon);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('runtime:get', event => { trustedSender(event); return { platform: process.platform, mode: 'desktop', locale: systemLocale() }; });
  const userData = app.getPath('userData');
  const prepared = await loadPreparedLessons();
  const lessons = new LessonStore(join(userData, 'lessons'));
  const disassemblies = new DisassemblyStore(join(userData, 'disassemblies'));
  const preparedDisassemblies = await loadPreparedDisassemblies();
  const store = new ProgressStore(join(userData, 'workspaces'), async key => prepared.find(x => x.id === key.lessonId && x.revision === key.revision) ?? lessons.find(key.lessonId, key.revision),
    async key => preparedDisassemblies.find(x => x.id === key.disassemblyId && x.revision === key.revision) ?? disassemblies.find(key.disassemblyId, key.revision));
  ipcMain.handle('progress:load', (event, key: unknown) => { trustedSender(event); return store.load(progressKeySchema.parse(key)); });
  ipcMain.handle('progress:save', (event, input: unknown) => { trustedSender(event); return store.save(progressStateSchema.parse(input)); });
  registerStudio(userData, lessons, disassemblies, store);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch(error => { console.error('Desktop initialization failed:', error.message); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
