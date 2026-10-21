import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, session, shell } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPreparedLessons } from '../fixtures/lessons';
import { ProgressStore } from './progress-store';
import { progressKeySchema } from '../core/bridge';
import { stateSchema } from '../core/state';
import { failure, ProviderError, type PickedSources } from '../core/provider';
import { importSource, SOURCE_LIMITS, SourceImportError } from '../core/source';
import { ChatGPTAccount } from './chatgpt/account';
import { AUTH } from './chatgpt/oauth';
import { Generator } from './generator';
import { LessonStore } from './lesson-store';
import { hostIdFile, SafeStorageVault } from './secure-files';

protocol.registerSchemesAsPrivileged([{ scheme: 'btw', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Break the Wall');
if (process.env.BTW_USER_DATA_DIR) app.setPath('userData', resolve(process.env.BTW_USER_DATA_DIR));
const devURL = process.env.BTW_RENDERER_URL;
if (devURL && devURL !== 'http://127.0.0.1:5173') throw new Error('Unsupported development origin');
const origin = devURL ?? 'btw://app';

function trustedSender(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (!url || event.senderFrame !== event.sender.mainFrame || !url.startsWith(origin + '/')) throw new Error('Untrusted sender');
}

/** Import, account and generation operations. Tokens and file paths never cross into the renderer. */
function registerStudio(userData: string, lessons: LessonStore) {
  const account = new ChatGPTAccount({
    vault: new SafeStorageVault(join(userData, 'credentials', 'chatgpt.bin'), safeStorage),
    hostId: hostIdFile(join(userData, 'credentials', 'agent-host.json')),
    fetch: globalThis.fetch.bind(globalThis),
    openExternal: async url => { if (!url.startsWith(AUTH.authorize + '?')) throw new Error('Unexpected sign-in URL'); await shell.openExternal(url); },
    log: message => console.info(`[chatgpt] ${message}`),
  });
  const generator = new Generator(account, lessons);
  const asFailure = (error: unknown) => {
    if (error instanceof ProviderError) return { ok: false as const, failure: error.failure };
    console.error('[studio]', (error as Error)?.message);
    return { ok: false as const, failure: failure('unavailable') };
  };
  ipcMain.handle('sources:pick', async event => {
    trustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { title: 'Scegli fonti di testo', properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[], filters: [{ name: 'Testo e Markdown', extensions: ['txt', 'md', 'markdown'] }] };
    const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    const result: PickedSources = { sources: [], errors: [] };
    for (const path of picked.canceled ? [] : picked.filePaths.slice(0, SOURCE_LIMITS.maxSources)) {
      const name = basename(path);
      try {
        // Size is checked before reading; only the selected files are opened, never their folder.
        const info = await stat(path);
        if (!info.isFile()) throw new SourceImportError('unsupported-type', `«${name}» non è un file.`);
        if (info.size > SOURCE_LIMITS.maxFileBytes) throw new SourceImportError('too-large', `«${name}» supera il limite di ${SOURCE_LIMITS.maxFileBytes / 1000} kB.`);
        result.sources.push(await importSource({ kind: 'file', name, bytes: new Uint8Array(await readFile(path)) }));
      } catch (error) {
        result.errors.push({ name, message: error instanceof SourceImportError ? error.message : `«${name}» non è leggibile.` });
      }
    }
    if (picked.filePaths.length > SOURCE_LIMITS.maxSources) result.errors.push({ name: '', message: `Sono stati considerati solo i primi ${SOURCE_LIMITS.maxSources} file.` });
    return result;
  });
  ipcMain.handle('account:status', event => { trustedSender(event); return account.status(); });
  ipcMain.handle('account:sign-in', async (event, input: unknown) => {
    trustedSender(event);
    try { return { ok: true, status: await account.signIn({ consent: (input as { consent?: unknown })?.consent === true }) }; }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('account:cancel-sign-in', event => { trustedSender(event); account.cancelSignIn(); });
  ipcMain.handle('account:sign-out', event => { trustedSender(event); return account.signOut(); });
  ipcMain.handle('account:models', async event => {
    trustedSender(event);
    try { return { ok: true, models: await account.models() }; }
    catch (error) { return asFailure(error); }
  });
  ipcMain.handle('generation:start', async (event, input: unknown) => {
    trustedSender(event);
    let last = 0;
    try {
      return await generator.generate(input, received => {
        const now = Date.now();
        if (now - last > 200) { last = now; event.sender.send('generation:progress', { received }); }
      });
    } catch (error) { return asFailure(error); }
  });
  ipcMain.handle('generation:cancel', event => { trustedSender(event); generator.cancel(); });
  ipcMain.handle('lessons:list', event => { trustedSender(event); return lessons.list(); });
  ipcMain.handle('account:usage-settings', async event => { trustedSender(event); await shell.openExternal('https://chatgpt.com/#settings'); });
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Break the Wall', width: 1480, height: 980, minWidth: 720, minHeight: 650,
    backgroundColor: '#f3f5ef',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) event.preventDefault(); });
  void window.loadURL(origin + '/');
}

void app.whenReady().then(async () => {
  const root = resolve(__dirname, '../dist');
  protocol.handle('btw', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(path).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('runtime:get', event => { trustedSender(event); return { platform: process.platform, mode: 'desktop' }; });
  const userData = app.getPath('userData');
  const prepared = await loadPreparedLessons();
  const lessons = new LessonStore(join(userData, 'lessons'));
  const store = new ProgressStore(join(userData, 'workspaces'), async key => prepared.find(x => x.id === key.lessonId && x.revision === key.revision) ?? lessons.find(key.lessonId, key.revision));
  ipcMain.handle('progress:load', (event, key: unknown) => { trustedSender(event); return store.load(progressKeySchema.parse(key)); });
  ipcMain.handle('progress:save', (event, input: unknown) => { trustedSender(event); return store.save(stateSchema.parse(input)); });
  registerStudio(userData, lessons);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch(error => { console.error('Desktop initialization failed:', error.message); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
