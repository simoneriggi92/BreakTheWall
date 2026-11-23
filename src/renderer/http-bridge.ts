import type { DesktopBridge } from '../core/bridge';
import { SECRET_HEADER, serverStatusSchema } from '../core/local-server';
import { browserBridge } from './storage';

/**
 * The bridge the app takes as a prop, served by the local server instead of Electron's preload (#94). Every call
 * carries the per-launch secret in a header; the page talks only to its own origin (`connect-src 'self'`).
 */
export interface PageBridge extends DesktopBridge {
  /**
   * One held poll: while it is open the server counts this page as connected. Resolves when the server answers,
   * `'refused'` when it no longer knows the secret (it restarted, or the tab kept an old one).
   */
  poll(signal: AbortSignal): Promise<'answered' | 'refused'>;
}

export class RefusedError extends Error {}
/** The server no longer knows this secret: it restarted, or the tab kept an old one. */
const refused = (reply: Response) => reply.status === 401 || reply.status === 403;

export function httpBridge(secret: string, fetcher: typeof fetch = (...args) => window.fetch(...args)): PageBridge {
  const call = (path: string, init: RequestInit = {}) => fetcher(path, { ...init, headers: { ...init.headers, [SECRET_HEADER]: secret }, cache: 'no-store' });
  return {
    async getRuntime() {
      const reply = await call('/api/status');
      if (refused(reply)) throw new RefusedError('The server refused the secret.');
      if (!reply.ok) throw new Error(`The server answered ${reply.status}.`);
      const status = serverStatusSchema.parse(await reply.json());
      return { platform: status.platform, mode: 'page' };
    },
    // Progress stays in this browser until the server keeps the rounds (the later tickets of #92).
    loadProgress: key => browserBridge.loadProgress(key),
    saveProgress: state => browserBridge.saveProgress(state),
    async poll(signal) {
      const reply = await call('/api/page/poll', { signal });
      if (refused(reply)) return 'refused';
      await reply.body?.cancel();
      return 'answered';
    },
  };
}
