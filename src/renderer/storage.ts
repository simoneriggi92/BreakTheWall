import type { DesktopBridge, ProgressKey } from '../core/bridge';
import { stateSchema, type LearnerState } from '../core/state';

const keyOf = (key: ProgressKey) => `btw:v1:${key.lessonId}:${key.revision}`;
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
  async saveProgress(state: LearnerState) {
    localStorage.setItem(keyOf(state), JSON.stringify(stateSchema.parse(state)));
  },
};
