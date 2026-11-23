import { z } from 'zod';

/**
 * The contract between the local server and its callers (the launcher, the mod, the page): one header for the
 * per-launch secret and one shape for `/api/status`, parsed wherever the reply is read (#94).
 */
export const SECRET_HEADER = 'x-btw-secret';
export const serverStatusSchema = z.object({
  app: z.literal('break-the-wall'),
  version: z.string().min(1).max(100),
  platform: z.string().min(1).max(40),
  pageConnected: z.boolean(),
});
export type ServerStatus = z.infer<typeof serverStatusSchema>;
