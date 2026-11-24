import { z } from 'zod';

/**
 * Side chats (#100): one per question of a round, each a list of turns the person asked and the replies a read-only
 * fork of the agent's session gave. Kept by the server, read by the page; nothing here reaches the agent.
 */

/** What the person asks in one turn. */
export const sideChatAskSchema = z.string().max(20_000).refine(x => x.trim() !== '', 'empty');

export const sideChatTurnSchema = z.strictObject({
  number: z.number().int().min(1),
  ask: sideChatAskSchema,
  /** The reply as it streamed; once done, the fork's final answer. */
  reply: z.string().max(1_000_000),
  /** What the reply read, in order: a file (`src/a.ts`, `src/a.ts:10-40`) or a search (`grep "x" in src`, `glob "*.ts"`). */
  files: z.array(z.string().max(4_200)).max(500),
  status: z.enum(['running', 'done', 'failed']),
  /**
   * `fork`: a copy of the agent's session, which knows the conversation as of the question. `fresh`: forking failed,
   * and a new `claude -p` answered from the round's text alone.
   */
  route: z.enum(['fork', 'fresh']),
  at: z.iso.datetime(),
});
export type SideChatTurn = z.infer<typeof sideChatTurnSchema>;

export const sideChatSchema = z.strictObject({
  question: z.number().int().min(1),
  turns: z.array(sideChatTurnSchema).max(1_000),
});
export type SideChat = z.infer<typeof sideChatSchema>;

/**
 * A round's side chats as the page reads them, with a version that grows on every change: a read that names the
 * version it already has is held until there is a newer one.
 */
export const sideChatsViewSchema = z.strictObject({
  version: z.number().int().min(0),
  sideChats: z.array(sideChatSchema),
});
export type SideChatsView = z.infer<typeof sideChatsViewSchema>;
