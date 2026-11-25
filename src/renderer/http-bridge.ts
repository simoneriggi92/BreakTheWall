import { z } from 'zod';
import { backingReportSchema, type BackingReport } from '../core/backing';
import type { DesktopBridge } from '../core/bridge';
import { SECRET_HEADER, serverStatusSchema } from '../core/local-server';
import type { Draft, MessageLanguage, RoundView } from '../core/round-answers';
import { currentViewSchema, TURN_ROUTES, type CurrentView, type FreeBlockView, type TurnKey } from '../core/round-phase';
import { historySchema, type History } from '../core/session-history';
import { sideChatsViewSchema, type SideChatPassage, type SideChatsView } from '../core/side-chat';
import { SOURCE_LIMITS } from '../core/source';
import { specListSchema, type SpecList } from '../core/spec';
import { specRemarksViewSchema, type SpecRemarksDraft, type SpecRemarksView } from '../core/spec-remarks';
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
  saveResponse(block: FreeBlockKey, response: string): Promise<void>;
  /** The free block's one response; resolves to the message exactly as the agent receives it. */
  sendResponse(block: FreeBlockKey, response: string): Promise<string>;
  /** The person folded or unfolded the agent's text of a round or a free block (#126), kept with it on the server. */
  foldTurn(entry: TurnKey, folded: boolean): Promise<void>;
  /** The person ends the session's round phase: its next turns without a round stay in the terminal. */
  endPhase(session: string): Promise<void>;
  /** The history column (#102): project → session → numbered rounds, and an update waiting for the other sessions. */
  getHistory(): Promise<History>;
  /** A round of any session, opened from the history column. */
  getRound(round: RoundKey): Promise<CurrentView>;
  /** The person deletes a session, its rounds and drafts with it. */
  deleteSession(session: string): Promise<void>;
  /**
   * A round's side chats (#100). With `after`, the version the page already shows, the server holds the read until
   * they change past it: a reply streams in this way.
   */
  getSideChats(round: RoundKey, after: number | null, signal: AbortSignal): Promise<SideChatsView>;
  /** Asks in the side chat of one question, about a passage of it if given (#101); the reply arrives through `getSideChats`. */
  askSideChat(round: RoundKey, question: number, ask: string, passage?: SideChatPassage): Promise<void>;
  /** Every version of every spec handed over (#104), newest first. */
  /** Every version handed over, and the handovers that could not be read. */
  listSpecs(): Promise<SpecList>;
  /** Writes a version's structure again, after a failure or a cancel; the page follows it through its poll. */
  exploreSpec(id: string): Promise<void>;
  cancelSpec(id: string): Promise<void>;
  /** A version's text as it was handed over (#128): what the page shows while its structure is being written, or failed. */
  getSpecText(id: string): Promise<string>;
  /** A saved exploration, unchecked: the page validates it before showing it. Null when the server has none. */
  findExploration(key: { id: string; revision: string }): Promise<unknown | null>;
  /** The remarks on a spec (#105), named by any of its versions: the draft, what was sent, the round they ride with. */
  getSpecRemarks(id: string): Promise<SpecRemarksView>;
  saveSpecRemarks(id: string, draft: SpecRemarksDraft): Promise<void>;
  /**
   * One Send for every remark so far; resolves to the message exactly as the agent receives it. Rejects with
   * `RidesError` when a round awaits answers: the remarks then go with that round's message.
   */
  sendSpecRemarks(id: string, draft: SpecRemarksDraft, language: MessageLanguage): Promise<string>;
  /** Approves the newest version, named by its number (#132); resolves to the message exactly as the agent receives it. */
  approveSpec(id: string, version: number, language: MessageLanguage): Promise<string>;
  /** What each statement of a version rests on (#106), checked by the server without a model. */
  getSpecBacking(id: string): Promise<BackingReport>;
}
export type RoundKey = Pick<RoundView, 'session' | 'number'>;
export type FreeBlockKey = Pick<FreeBlockView, 'session' | 'number'>;
export type PhaseBridge = Pick<PageBridge, 'endPhase'>;
export type FoldBridge = Pick<PageBridge, 'foldTurn'>;
export type SideChatBridge = Pick<PageBridge, 'getSideChats' | 'askSideChat'>;
export type RoundBridge = Pick<PageBridge, 'saveDraft' | 'sendRound'> & PhaseBridge & FoldBridge & SideChatBridge;
export type FreeBlockBridge = Pick<PageBridge, 'saveResponse' | 'sendResponse'> & PhaseBridge & FoldBridge;
export type HistoryBridge = Pick<PageBridge, 'getHistory' | 'getRound' | 'deleteSession'>;
export type SpecRemarksBridge = Pick<PageBridge, 'getSpecRemarks' | 'saveSpecRemarks' | 'sendSpecRemarks' | 'approveSpec'>;
export type SpecBridge = Pick<PageBridge, 'exploreSpec' | 'cancelSpec' | 'getSpecText' | 'findExploration' | 'getSpecBacking'> & SpecRemarksBridge;

const currentReplySchema = z.object({ current: currentViewSchema.nullable() });
const sentReplySchema = z.object({ message: z.string() });
const explorationReplySchema = z.object({ exploration: z.unknown() });
const specTextReplySchema = z.object({ text: z.string().max(SOURCE_LIMITS.maxFileBytes) });

export class RefusedError extends Error {}
/** The remarks were not sent alone: a round awaits answers, and they ride in its message. */
export class RidesError extends Error {
  constructor(readonly round: number) { super(`The remarks ride with round ${round}.`); }
}
const ridesSchema = z.object({ error: z.literal('rides'), round: z.number().int().min(1) });
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
    async saveResponse(block, response) {
      await ok(await call(`${freePath(block)}/response`, json('PUT', { response })));
    },
    async sendResponse(block, response) {
      return sentReplySchema.parse(await (await ok(await call(`${freePath(block)}/send`, json('POST', { response })))).json()).message;
    },
    async foldTurn({ kind, session, number }, folded) {
      await ok(await call(`/api/${TURN_ROUTES[kind]}/${encodeURIComponent(session)}/${number}/fold`, json('PUT', { folded })));
    },
    async endPhase(session) {
      await ok(await call(`/api/sessions/${encodeURIComponent(session)}/phase`, { method: 'DELETE' }));
    },
    async getHistory() {
      return historySchema.parse(await (await ok(await call('/api/history'))).json());
    },
    async getRound(round) {
      return currentViewSchema.parse(await (await ok(await call(roundPath(round)))).json());
    },
    async deleteSession(session) {
      await ok(await call(`/api/sessions/${encodeURIComponent(session)}`, { method: 'DELETE' }));
    },
    async getSideChats(round, after, signal) {
      const path = `/api/side-chats/${encodeURIComponent(round.session)}/${round.number}${after === null ? '' : `?after=${after}`}`;
      return sideChatsViewSchema.parse(await (await ok(await call(path, { signal }))).json());
    },
    async askSideChat(round, question, ask, passage) {
      await ok(await call(`/api/side-chats/${encodeURIComponent(round.session)}/${round.number}/${question}`, json('POST', { ask, ...(passage ? { passage } : {}) })));
    },
    async listSpecs() {
      return specListSchema.parse(await (await ok(await call('/api/specs'))).json());
    },
    async exploreSpec(id) {
      await ok(await call(`/api/specs/${encodeURIComponent(id)}/exploration`, { method: 'POST' }));
    },
    async cancelSpec(id) {
      await ok(await call(`/api/specs/${encodeURIComponent(id)}/exploration`, { method: 'DELETE' }));
    },
    async getSpecText(id) {
      return specTextReplySchema.parse(await (await ok(await call(`/api/specs/${encodeURIComponent(id)}`))).json()).text;
    },
    async findExploration({ id, revision }) {
      const reply = await call(`/api/explorations/${encodeURIComponent(id)}/${encodeURIComponent(revision)}`);
      if (reply.status === 404) return null;
      return explorationReplySchema.parse(await (await ok(reply)).json()).exploration;
    },
    async getSpecRemarks(id) {
      return specRemarksViewSchema.parse(await (await ok(await call(`/api/specs/${encodeURIComponent(id)}/remarks`))).json());
    },
    async saveSpecRemarks(id, draft) {
      await ok(await call(`/api/specs/${encodeURIComponent(id)}/remarks`, json('PUT', draft)));
    },
    async sendSpecRemarks(id, draft, language) {
      const reply = await call(`/api/specs/${encodeURIComponent(id)}/remarks/send`, json('POST', { draft, language }));
      if (reply.status === 409) {
        const rides = ridesSchema.safeParse(await reply.clone().json().catch(() => null));
        if (rides.success) throw new RidesError(rides.data.round);
      }
      return sentReplySchema.parse(await (await ok(reply)).json()).message;
    },
    async approveSpec(id, version, language) {
      return sentReplySchema.parse(await (await ok(await call(`/api/specs/${encodeURIComponent(id)}/approval`, json('POST', { version, language })))).json()).message;
    },
    async getSpecBacking(id) {
      return backingReportSchema.parse(await (await ok(await call(`/api/specs/${encodeURIComponent(id)}/backing`))).json());
    },
  };
}
