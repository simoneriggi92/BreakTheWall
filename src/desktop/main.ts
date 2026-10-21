import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPreparedLessons } from '../fixtures/lessons';
import { ProgressStore } from './progress-store';
import { progressKeySchema } from '../core/bridge';
import { stateSchema } from '../core/state';

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
  const store = new ProgressStore(join(app.getPath('userData'), 'workspaces'), await loadPreparedLessons());
  ipcMain.handle('progress:load', (event, key: unknown) => { trustedSender(event); return store.load(progressKeySchema.parse(key)); });
  ipcMain.handle('progress:save', (event, input: unknown) => { trustedSender(event); return store.save(stateSchema.parse(input)); });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch(error => { console.error('Desktop initialization failed:', error.message); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
