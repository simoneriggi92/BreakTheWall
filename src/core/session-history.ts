import { z } from 'zod';
import { sessionIdSchema } from './local-server';

/**
 * The page's history column (#102): every project the server keeps rounds for, its sessions (when they started,
 * live or ended, the round skill and ticket they began with) and their numbered rounds with their state. Sessions
 * with no round or free block are left out: every Claude Code session registers, few ask anything.
 */
export const historyRoundStateSchema = z.enum(['open', 'sent', 'superseded']);
export type HistoryRoundState = z.infer<typeof historyRoundStateSchema>;

export const historySessionSchema = z.strictObject({
  session: sessionIdSchema,
  /** When its first round or free block arrived. */
  startedAt: z.iso.datetime(),
  /** Registered by a running Claude Code session; an ended session can come back with `claude --resume`. */
  live: z.boolean(),
  /** The round skill whose start first marked the session, as it is named without its plugin. */
  skill: z.string().nullable(),
  /** The issue that skill was started on (`/grill-with-docs #70`), when its arguments name one. */
  ticket: z.number().int().min(1).nullable(),
  rounds: z.array(z.strictObject({ number: z.number().int().min(1), receivedAt: z.iso.datetime(), state: historyRoundStateSchema })),
});
export type HistorySession = z.infer<typeof historySessionSchema>;

export const historyProjectSchema = z.strictObject({
  /** The working directory the sessions ran in: it names the project. */
  cwd: z.string().min(1),
  sessions: z.array(historySessionSchema),
});
export type HistoryProject = z.infer<typeof historyProjectSchema>;

export const historySchema = z.strictObject({
  /** The project with the latest activity first, and in each the latest session first. */
  projects: z.array(historyProjectSchema),
  /** A newer version of the server waits for the other sessions to end before it replaces this one. */
  update: z.string().nullable(),
});
export type History = z.infer<typeof historySchema>;

/** The project's name as the page shows it: the last folder of its working directory. */
export const projectName = (cwd: string) => cwd.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || cwd;
