import { contextBridge, ipcRenderer } from 'electron';
import { progressKeySchema, type DesktopBridge } from '../core/bridge';
import { stateSchema } from '../core/state';

const bridge = Object.freeze<DesktopBridge>({
  getRuntime: () => ipcRenderer.invoke('runtime:get'),
  loadProgress: key => ipcRenderer.invoke('progress:load', progressKeySchema.parse(key)),
  saveProgress: state => ipcRenderer.invoke('progress:save', stateSchema.parse(state)),
});
contextBridge.exposeInMainWorld('breakTheWall', bridge);
