import { z } from 'zod';

/**
 * The contract between the local server and its callers (the launcher, the mod, the page): one header for the
 * per-launch secret, one shape for `/api/status`, parsed wherever the reply is read (#94), and the session id (#95).
 */
export const SECRET_HEADER = 'x-btw-secret';
export const serverStatusSchema = z.object({
  app: z.literal('break-the-wall'),
  version: z.string().min(1).max(100),
  platform: z.string().min(1).max(40),
  pageConnected: z.boolean(),
});
export type ServerStatus = z.infer<typeof serverStatusSchema>;

/** A Claude Code session id as the mod sends it; it names a folder on disk, so nothing but letters, digits, `-` and `_`. */
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
