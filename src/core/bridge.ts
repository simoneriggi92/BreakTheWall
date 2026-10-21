import { z } from 'zod';
import type { LearnerState } from './state';

export const progressKeySchema = z.strictObject({ lessonId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), revision: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/) });
export type ProgressKey = z.infer<typeof progressKeySchema>;
export interface ProgressResult { state: unknown | null; notice?: string; }
export interface RuntimeInfo { platform: string; mode: 'desktop' | 'browser'; }
export interface DesktopBridge {
  getRuntime(): Promise<RuntimeInfo>;
  loadProgress(key: ProgressKey): Promise<ProgressResult>;
  saveProgress(state: LearnerState): Promise<void>;
}

declare global {
  interface Window { breakTheWall?: DesktopBridge; }
}
