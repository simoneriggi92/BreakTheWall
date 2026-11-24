import { z } from 'zod';
import type { DesktopBridge } from '../core/bridge';
import { SECRET_HEADER, serverStatusSchema } from '../core/local-server';
import type { Draft, MessageLanguage, RoundView } from '../core/round-answers';
import { currentViewSchema, type CurrentView, type FreeBlockView } from '../core/round-phase';
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
  /** What the page shows (#95, #99): the latest round or free block received, or null before any. */
  getCurrent(): Promise<CurrentView | null>;
  saveDraft(round: RoundKey, draft: Draft): Promise<void>;
  /** One Send for the whole round; resolves to the message exactly as the agent receives it. */
  sendRound(round: RoundKey, draft: Draft, language: MessageLanguage): Promise<string>;
  saveReply(block: FreeBlockKey, reply: string): Promise<void>;
  /** The free block's one reply; resolves to the message exactly as the agent receives it. */
  sendReply(block: FreeBlockKey, reply: string): Promise<string>;
  /** The person ends the session's round phase: its next turns without a round stay in the terminal. */
  endPhase(session: string): Promise<void>;
}
export type RoundKey = Pick<RoundView, 'session' | 'number'>;
export type FreeBlockKey = Pick<FreeBlockView, 'session' | 'number'>;
export type PhaseBridge = Pick<PageBridge, 'endPhase'>;
export type RoundBridge = Pick<PageBridge, 'saveDraft' | 'sendRound'> & PhaseBridge;
export type FreeBlockBridge = Pick<PageBridge, 'saveReply' | 'sendReply'> & PhaseBridge;

const currentReplySchema = z.object({ current: currentViewSchema.nullable() });
const sentReplySchema = z.object({ message: z.string() });

export class RefusedError extends Error {}
/** The server no longer knows this secret: it restarted, or the tab kept an old one. */
const refused = (reply: Response) => reply.status === 401 || reply.status === 403;

export function httpBridge(secret: string, fetcher: typeof fetch = (...args) => window.fetch(...args)): PageBridge {
  const call = (path: string, init: RequestInit = {}) => fetcher(path, { ...init, headers: { ...init.headers, [SECRET_HEADER]: secret }, cache: 'no-store' });
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const roundPath = ({ session, number }: RoundKey) => `/api/rounds/${encodeURIComponent(session)}/${number}`;
  const freePath = ({ session, number }: FreeBlockKey) => `/api/free/${encodeURIComponent(session)}/${number}`;
  const ok = async (reply: Response) => {
    if (refused(reply)) throw new RefusedError('The server refused the secret.');
    if (!reply.ok) throw new Error(`The server answered ${reply.status}.`);
    return reply;
  };
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
    async getCurrent() {
      return currentReplySchema.parse(await (await ok(await call('/api/current'))).json()).current;
    },
    async saveDraft(round, draft) {
      await ok(await call(`${roundPath(round)}/draft`, json('PUT', draft)));
    },
    async sendRound(round, draft, language) {
      return sentReplySchema.parse(await (await ok(await call(`${roundPath(round)}/send`, json('POST', { draft, language })))).json()).message;
    },
    async saveReply(block, reply) {
      await ok(await call(`${freePath(block)}/reply`, json('PUT', { reply })));
    },
    async sendReply(block, reply) {
      return sentReplySchema.parse(await (await ok(await call(`${freePath(block)}/send`, json('POST', { reply })))).json()).message;
    },
    async endPhase(session) {
      await ok(await call(`/api/sessions/${encodeURIComponent(session)}/phase`, { method: 'DELETE' }));
    },
  };
}
