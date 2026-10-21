import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../core/bridge';

const bridge: DesktopBridge = Object.freeze({
  getRuntime: () => ipcRenderer.invoke('runtime:get'),
});
contextBridge.exposeInMainWorld('breakTheWall', bridge);
