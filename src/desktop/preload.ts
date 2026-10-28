import { contextBridge, ipcRenderer } from 'electron';
import { progressKeySchema, progressStateSchema, type DesktopBridge } from '../core/bridge';
import { incomingSourceSchema, previewSchema, type StudioBridge } from '../core/provider';

const studio = Object.freeze<StudioBridge>({
  pickSources: () => ipcRenderer.invoke('sources:pick'),
  accountStatus: () => ipcRenderer.invoke('account:status'),
  signIn: options => ipcRenderer.invoke('account:sign-in', { consent: options.consent === true }),
  cancelSignIn: () => ipcRenderer.invoke('account:cancel-sign-in'),
  signOut: () => ipcRenderer.invoke('account:sign-out'),
  listModels: () => ipcRenderer.invoke('account:models'),
  generate: request => ipcRenderer.invoke('generation:start', request),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  generationDraft: () => ipcRenderer.invoke('generation:draft'),
  suggest: request => ipcRenderer.invoke('suggestions:start', request),
  cancelSuggestions: () => ipcRenderer.invoke('suggestions:cancel'),
  onGenerationProgress: listener => {
    // A preview that does not parse is dropped; the rest of the progress still arrives (D22).
    const handler = (_event: unknown, p: { received?: unknown; phase?: unknown; repairing?: unknown; shortening?: unknown; requests?: unknown; part?: unknown; parts?: unknown; preview?: unknown }) => {
      const preview = p?.preview === undefined ? undefined : previewSchema.safeParse(p.preview);
      listener({
        phase: p?.phase === 'content' || p?.phase === 'runs' ? p.phase : 'structure', repairing: p?.repairing === true, ...(p?.shortening === true ? { shortening: true } : {}),
        received: Number(p?.received) || 0, requests: Number(p?.requests) || 0,
        ...(typeof p?.part === 'number' && typeof p?.parts === 'number' ? { part: p.part, parts: p.parts } : {}),
        ...(preview?.success ? { preview: preview.data } : {}),
      });
    };
    ipcRenderer.on('generation:progress', handler);
    return () => { ipcRenderer.removeListener('generation:progress', handler); };
  },
  onIncomingSource: listener => {
    // Anything that does not parse as a pasted source is dropped; the host imported it, so this only guards the boundary.
    const handler = (_event: unknown, incoming: unknown) => {
      const parsed = incomingSourceSchema.safeParse(incoming);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on('studio:incoming', handler);
    void ipcRenderer.invoke('incoming:ready');
    return () => { ipcRenderer.removeListener('studio:incoming', handler); };
  },
  listLessons: () => ipcRenderer.invoke('lessons:list'),
  listDisassemblies: () => ipcRenderer.invoke('disassemblies:list'),
  findDisassembly: key => ipcRenderer.invoke('disassemblies:find', { id: String(key?.id ?? ''), revision: String(key?.revision ?? '') }),
  expandPart: request => ipcRenderer.invoke('disassembly:expand', request),
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
