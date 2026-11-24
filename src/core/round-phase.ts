import { z } from 'zod';
import { sessionIdSchema } from './local-server';
import { asText, roundViewSchema } from './round-answers';

/**
 * The round phase of a session (#99): from the first round, or from the plugin asking a skill for rounds, until the
 * person ends it from the page or three turns in a row pass without a round. Within it, a turn without a round is a
 * free block: the turn's text and one response field, so a clarifying turn does not send the person back to the terminal.
 * Outside it, turns stay in the terminal.
 */
export const QUIET_TURNS_END_PHASE = 3;

export interface Phase {
  open: boolean;
  /** Turns in a row without a round since the last round or the phase's start. */
  quietTurns: number;
}
export const OPEN_PHASE: Phase = { open: true, quietTurns: 0 };
export const CLOSED_PHASE: Phase = { open: false, quietTurns: 0 };

/**
 * What a turn of the session's main loop does to its phase, and whether the page shows it as a free block. A round
 * opens the phase or keeps it open; a turn without one counts toward its end. The turn that ends it is still shown:
 * the person sees the answer to what they sent from the page, and only the next turn stays in the terminal.
 */
export function afterTurn(phase: Phase | undefined, hasRound: boolean): { phase: Phase; free: boolean } {
  if (hasRound) return { phase: OPEN_PHASE, free: false };
  if (!phase?.open) return { phase: phase ?? CLOSED_PHASE, free: false };
  const quietTurns = phase.quietTurns + 1;
  return { phase: { open: quietTurns < QUIET_TURNS_END_PHASE, quietTurns }, free: true };
}

export const responseSchema = z.string().max(50_000);

/** A free block as the page reads it. */
export const freeBlockViewSchema = z.strictObject({
  session: sessionIdSchema,
  number: z.number().int().min(1),
  receivedAt: z.iso.datetime(),
  /** The agent's turn, whole: nothing in it is parsed. */
  text: z.string(),
  /** The response as drafted, kept across a reload. */
  response: z.string(),
  sent: z.strictObject({ message: z.string(), at: z.iso.datetime() }).nullable(),
  /** A later turn of the same session arrived on the page: this one no longer takes a response. */
  superseded: z.boolean(),
});
export type FreeBlockView = z.infer<typeof freeBlockViewSchema>;

/** What the page shows: the latest round or free block across sessions, and whether its session is in the phase. */
export const currentViewSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('round'), round: roundViewSchema, phaseOpen: z.boolean() }),
  z.strictObject({ kind: z.literal('free'), block: freeBlockViewSchema, phaseOpen: z.boolean() }),
]);
export type CurrentView = z.infer<typeof currentViewSchema>;

/** The response as the agent receives it: the person's own words, never a command. */
export const freeBlockMessage = (response: string) => asText(response.trim());
