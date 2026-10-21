import { z } from 'zod';
import type { LearnerState } from './state';
import type { StudioBridge } from './provider';

export const progressKeySchema = z.strictObject({ lessonId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), revision: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/) });
export type ProgressKey = z.infer<typeof progressKeySchema>;
export interface ProgressResult { state: unknown | null; notice?: string; }
export interface RuntimeInfo { platform: string; mode: 'desktop' | 'browser'; }
export interface DesktopBridge {
  getRuntime(): Promise<RuntimeInfo>;
  loadProgress(key: ProgressKey): Promise<ProgressResult>;
  saveProgress(state: LearnerState): Promise<void>;
  /** Import, account and generation. Present only in the desktop host. */
  studio?: StudioBridge;
}

declare global {
  interface Window { breakTheWall?: DesktopBridge; }
}
