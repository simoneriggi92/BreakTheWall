import { progressStateSchema, type DesktopBridge, type ProgressKey, type ProgressState } from '../core/bridge';

// Lesson keys keep their original form, so progress saved before disassemblies still loads.
const keyOf = (key: ProgressKey) => 'lessonId' in key ? `btw:v1:${key.lessonId}:${key.revision}` : `btw:v1:disassembly:${key.disassemblyId}:${key.revision}`;
export const browserBridge: DesktopBridge = {
  async getRuntime() { return { platform: 'web', mode: 'browser' }; },
  async loadProgress(key) {
    const raw = localStorage.getItem(keyOf(key));
    if (!raw) return { state: null };
    try { return { state: JSON.parse(raw) }; }
    catch {
      localStorage.setItem(keyOf(key) + ':preserved:' + crypto.randomUUID(), raw);
      return { state: null, notice: 'Progressi browser illeggibili: copia conservata, nuova sessione.' };
    }
  },
  async saveProgress(state: ProgressState) {
    localStorage.setItem(keyOf('lessonId' in state ? state : { disassemblyId: state.disassemblyId, revision: state.revision }), JSON.stringify(progressStateSchema.parse(state)));
  },
};
