import { z } from 'zod';
import { stateSchema, type LearnerState } from './state';
import { disassemblyStateSchema, type DisassemblyState, type StateNotice } from './disassembly-state';
import type { StudioBridge } from './provider';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
/** Lessons and disassemblies keep separate progress; the key's field says which one is meant. */
export const progressKeySchema = z.union([
  z.strictObject({ lessonId: key, revision: key }),
  z.strictObject({ disassemblyId: key, revision: key }),
]);
export type ProgressKey = z.infer<typeof progressKeySchema>;
export const progressStateSchema = z.union([stateSchema, disassemblyStateSchema]);
export type ProgressState = LearnerState | DisassemblyState;
/** Lesson notices are sentences; disassembly notices are codes, worded by the interface. */
export interface ProgressResult { state: unknown | null; notice?: string; noticeCode?: StateNotice | 'unreadable'; }
export interface RuntimeInfo { platform: string; mode: 'desktop' | 'browser'; }
export interface DesktopBridge {
  getRuntime(): Promise<RuntimeInfo>;
  loadProgress(key: ProgressKey): Promise<ProgressResult>;
  saveProgress(state: ProgressState): Promise<void>;
  /** Import, account and generation. Present only in the desktop host. */
  studio?: StudioBridge;
}

declare global {
  interface Window { breakTheWall?: DesktopBridge; }
}
