import { contextBridge, ipcRenderer } from 'electron';
import { progressKeySchema, progressStateSchema, type DesktopBridge } from '../core/bridge';
import type { StudioBridge } from '../core/provider';

const studio = Object.freeze<StudioBridge>({
  pickSources: () => ipcRenderer.invoke('sources:pick'),
  accountStatus: () => ipcRenderer.invoke('account:status'),
  signIn: options => ipcRenderer.invoke('account:sign-in', { consent: options.consent === true }),
  cancelSignIn: () => ipcRenderer.invoke('account:cancel-sign-in'),
  signOut: () => ipcRenderer.invoke('account:sign-out'),
  listModels: () => ipcRenderer.invoke('account:models'),
  generate: request => ipcRenderer.invoke('generation:start', request),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  onGenerationProgress: listener => {
    const handler = (_event: unknown, progress: { received?: unknown; phase?: unknown }) => listener({ received: Number(progress?.received) || 0, phase: progress?.phase === 'repairing' ? 'repairing' : 'generating' });
    ipcRenderer.on('generation:progress', handler);
    return () => { ipcRenderer.removeListener('generation:progress', handler); };
  },
  listLessons: () => ipcRenderer.invoke('lessons:list'),
  openUsageSettings: () => ipcRenderer.invoke('account:usage-settings'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  discoverLocal: () => ipcRenderer.invoke('local:discover'),
  connectLocal: address => ipcRenderer.invoke('local:connect', String(address)),
  checkLocalFormat: model => ipcRenderer.invoke('local:check', model),
});
const bridge = Object.freeze<DesktopBridge>({
  getRuntime: () => ipcRenderer.invoke('runtime:get'),
  loadProgress: key => ipcRenderer.invoke('progress:load', progressKeySchema.parse(key)),
  saveProgress: state => ipcRenderer.invoke('progress:save', progressStateSchema.parse(state)),
  studio,
});
contextBridge.exposeInMainWorld('breakTheWall', bridge);
