import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { sessionIdSchema } from '../core/local-server';
import { draftSchema, emptyDraft, type Draft, type RoundView } from '../core/round-answers';
import { roundSchema, type Round } from '../core/round';
import type { HistoryRoundState } from '../core/session-history';
import { afterTurn, CLOSED_PHASE, OPEN_PHASE, responseSchema, type CurrentView, type FreeBlockView, type Phase } from '../core/round-phase';

/**
 * What the page shows of each session (#95, #99): its rounds with their drafts, its free blocks with their responses,
 * the message each sent exactly as delivered, and whether the session is in the round phase. Kept on disk by project
 * (working directory) → session, one versioned file per round (`round-<n>.json`), per free block (`free-<n>.json`)
 * and for the phase (`phase.json`), rewritten whole and replaced atomically on every change, and checked with Zod when
 * read back: a file that does not parse is left alone.
 */
const sentSchema = z.strictObject({
  message: z.string().max(2_000_000),
  at: z.iso.datetime(),
  /** When the mod confirmed it submitted it to the session; null while it waits or is in flight. */
  deliveredAt: z.iso.datetime().nullable(),
});
const entryFields = {
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  number: z.number().int().min(1),
  /**
   * Where the entry stands among the session's rounds and free blocks, which are numbered apart. Absent on a round
   * kept before free blocks existed, when the round's number was its place.
   */
  order: z.number().int().min(1).optional(),
  receivedAt: z.iso.datetime(),
  sent: sentSchema.nullable(),
};
const storedRoundSchema = z.strictObject({ ...entryFields, round: roundSchema, draft: draftSchema });
const storedFreeSchema = z.strictObject({ ...entryFields, kind: z.literal('free'), text: z.string().max(1_000_000), response: responseSchema });
const storedPhaseSchema = z.strictObject({
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  open: z.boolean(),
  quietTurns: z.number().int().min(0),
});
type StoredRound = z.infer<typeof storedRoundSchema>;
type StoredFree = z.infer<typeof storedFreeSchema>;
type Stored = StoredRound | StoredFree;
type StoredPhase = z.infer<typeof storedPhaseSchema>;
/** A round or a free block: numbered apart, so the kind and the number together name an entry. */
export type Kind = 'round' | 'free';
type EntryOf<K extends Kind> = K extends 'round' ? StoredRound : StoredFree;

export interface SessionSummary {
  session: string;
  cwd: string;
  startedAt: string;
  latestAt: string;
  rounds: { number: number; receivedAt: string; state: HistoryRoundState }[];
}

/**
 * Where a session stands, as the server knows it (#103): live while its lease runs, and whether Claude Code's
 * transcript of it is gone. The store reads it whenever it shows a round.
 */
export interface Standing {
  live(session: string): boolean;
  transcriptGone(session: string): boolean;
}
const NO_STANDING: Standing = { live: () => false, transcriptGone: () => false };

/** Why a change to a round or a free block was refused; the server answers each with its own status. */
export type RoundRefusal = 'unknown' | 'sent' | 'superseded';

const kindOf = (x: Stored): Kind => 'round' in x ? 'round' : 'free';
const orderOf = (x: Stored) => x.order ?? x.number;
/** How the mod names what it confirms: `round-2`, `free-1`. */
/** Where the sessions' folders live, by project, inside the server's data folder. */
export const projectsDir = (dataDir: string) => join(dataDir, 'projects');
export const deliveryId = (kind: Kind, number: number) => `${kind}-${number}`;

export class RoundStore {
  private entries = new Map<string, Stored>();
  private phases = new Map<string, StoredPhase>();
  private writes = new Map<string, Promise<void>>();
  /** Messages handed to a poll and not yet confirmed, until when; kept in memory, so a restart offers them again. */
  private leases = new Map<string, number>();

  private constructor(private dir: string, private standing: Standing) {}

  static async open(dataDir: string, standing: Standing = NO_STANDING): Promise<RoundStore> {
    const store = new RoundStore(projectsDir(dataDir), standing);
    await store.load();
    return store;
  }

  /** A new round of a session, numbered after the session's earlier rounds; it opens the round phase. */
  async add(session: string, cwd: string, round: Round): Promise<StoredRound> {
    const stored: StoredRound = { ...this.newEntry(session, cwd, 'round'), round, draft: emptyDraft() };
    await Promise.all([this.save(stored), this.setPhase(session, cwd, afterTurn(this.phaseOf(session), true).phase)]);
    return stored;
  }

  /** A turn of the session's main loop that holds no round: a free block while the phase is open, else nothing. */
  async addTurn(session: string, cwd: string, text: string): Promise<StoredFree | null> {
    const before = this.phaseOf(session);
    const { phase, free } = afterTurn(before, false);
    if (before) await this.setPhase(session, cwd, phase);
    if (!free) return null;
    const stored: StoredFree = { ...this.newEntry(session, cwd, 'free'), kind: 'free', text, response: '' };
    await this.save(stored);
    return stored;
  }

  /** The plugin asked a skill of the session for rounds: the phase opens, or starts its count again. */
  startPhase(session: string, cwd: string): Promise<void> {
    return this.setPhase(session, cwd, OPEN_PHASE);
  }

  /** The person ended the phase from the page. False for a session the page never showed. */
  async endPhase(session: string): Promise<boolean> {
    const cwd = this.phases.get(session)?.cwd ?? this.ofSession(session)[0]?.cwd;
    if (cwd === undefined) return false;
    await this.setPhase(session, cwd, CLOSED_PHASE);
    return true;
  }

  /** The round or free block received last, across every session: the one the page shows. */
  current(): CurrentView | null {
    let latest: Stored | undefined;
    for (const x of this.entries.values()) if (!latest || x.receivedAt > latest.receivedAt || (x.receivedAt === latest.receivedAt && orderOf(x) > orderOf(latest))) latest = x;
    return latest ? this.viewOf(latest) : null;
  }

  /** One round of a session as the page shows it, for the history column (#102); undefined when there is none. */
  round(session: string, number: number): CurrentView | undefined {
    const found = this.entries.get(key(session, 'round', number));
    return found && this.viewOf(found);
  }

  private viewOf(x: Stored): CurrentView {
    const phaseOpen = this.phaseOf(x.session)?.open ?? false;
    const superseded = this.ofSession(x.session).some(y => orderOf(y) > orderOf(x));
    const sent = x.sent ? { message: x.sent.message, at: x.sent.at } : null;
    const base = { session: x.session, number: x.number, receivedAt: x.receivedAt, sent, superseded };
    const standing = { phaseOpen, queued: this.queued(x), transcriptGone: this.standing.transcriptGone(x.session) };
    if ('round' in x) {
      const round: RoundView = { ...base, ...x.round, draft: x.draft };
      return { kind: 'round', round, ...standing };
    }
    const block: FreeBlockView = { ...base, text: x.text, response: x.response };
    return { kind: 'free', block, ...standing };
  }

  /** Sent, not yet delivered, and its session ended: it waits for `claude --resume <id>`. */
  private queued(x: Stored): boolean {
    return Boolean(x.sent && !x.sent.deliveredAt && !this.standing.live(x.session));
  }

  /** The questions of one round, to word its message. */
  questions(session: string, number: number) {
    return this.asked(session, number)?.round.questions;
  }

  /** One round as the agent asked it, with the working directory of its session (#100). */
  asked(session: string, number: number): { cwd: string; round: Round } | undefined {
    const found = this.entries.get(key(session, 'round', number));
    return found && 'round' in found ? { cwd: found.cwd, round: found.round } : undefined;
  }

  async saveDraft(session: string, number: number, draft: Draft): Promise<RoundRefusal | null> {
    const found = this.answerable(session, 'round', number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, draft });
    return null;
  }

  async saveResponse(session: string, number: number, response: string): Promise<RoundRefusal | null> {
    const found = this.answerable(session, 'free', number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, response });
    return null;
  }

  /** Records the round as sent with its message, which then waits in the session's queue. */
  async send(session: string, number: number, draft: Draft, message: string): Promise<RoundRefusal | null> {
    const found = this.answerable(session, 'round', number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, draft, sent: sentNow(message) });
    return null;
  }

  /** Records the free block as answered with its message, which then waits in the session's queue. */
  async sendResponse(session: string, number: number, response: string, message: string): Promise<RoundRefusal | null> {
    const found = this.answerable(session, 'free', number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, response, sent: sentNow(message) });
    return null;
  }

  /**
   * The oldest message waiting for a session, leased to the poll that takes it: not offered again until the lease
   * runs out, and lost only once the mod confirms it submitted it. A mod that died or failed to submit leaves the
   * message to come back.
   */
  take(session: string, leaseMs: number): { id: string; message: string } | undefined {
    const now = Date.now();
    const waiting = this.ofSession(session)
      .filter(x => x.sent && !x.sent.deliveredAt && (this.leases.get(entryKey(x)) ?? 0) <= now)
      .sort((a, b) => orderOf(a) - orderOf(b))[0];
    if (!waiting?.sent) return undefined;
    this.leases.set(entryKey(waiting), now + leaseMs);
    return { id: deliveryId(kindOf(waiting), waiting.number), message: waiting.sent.message };
  }

  /**
   * The session ended (#103): what its mod took and never confirmed will not be submitted now, so it is offered again
   * as soon as the session is resumed, not once its lease runs out.
   */
  release(session: string): void {
    for (const x of this.ofSession(session)) this.leases.delete(entryKey(x));
  }

  /** The working directory a session's rounds were kept under; undefined for a session the page never showed. */
  cwdOf(session: string): string | undefined {
    return this.ofSession(session)[0]?.cwd;
  }

  /** The mod submitted the message: it is delivered and never offered again. False when the entry sent nothing. */
  async confirm(session: string, kind: Kind, number: number): Promise<boolean> {
    const found = this.entries.get(key(session, kind, number));
    if (!found?.sent) return false;
    this.leases.delete(entryKey(found));
    if (!found.sent.deliveredAt) await this.save({ ...found, sent: { ...found.sent, deliveredAt: new Date().toISOString() } });
    return true;
  }

  /**
   * Every session the page showed something of (#102): its working directory, when its first and latest round or
   * free block arrived, and its rounds in number order with their state.
   */
  summaries(): SessionSummary[] {
    const bySession = new Map<string, Stored[]>();
    for (const x of this.entries.values()) bySession.set(x.session, [...bySession.get(x.session) ?? [], x]);
    return [...bySession].map(([session, all]) => {
      const last = Math.max(...all.map(orderOf));
      const times = all.map(x => x.receivedAt).sort();
      const rounds = all.filter((x): x is StoredRound => 'round' in x).sort((a, b) => a.number - b.number).map(x => ({
        number: x.number, receivedAt: x.receivedAt,
        state: this.queued(x) ? 'queued' as const : x.sent ? 'sent' as const : orderOf(x) < last ? 'superseded' as const : 'open' as const,
      }));
      return { session, cwd: all[0].cwd, startedAt: times[0], latestAt: times.at(-1) ?? times[0], rounds };
    });
  }

  /**
   * The person deleted the session from the page (#102): its rounds, free blocks, drafts, waiting messages and phase
   * go, on disk with every other file of its folder. False for a session the page never showed.
   */
  async deleteSession(session: string): Promise<boolean> {
    const kept = [...this.ofSession(session), ...this.phases.has(session) ? [this.phases.get(session)!] : []];
    if (kept.length === 0) return false;
    for (const x of this.ofSession(session)) { this.entries.delete(entryKey(x)); this.leases.delete(entryKey(x)); }
    this.phases.delete(session);
    // A write still on its way would put a file back into the folder after it is gone.
    await Promise.all([...this.writes].filter(([id]) => id.startsWith(`${session}/`)).map(([, write]) => write.catch(() => {})));
    await Promise.all([...new Set(kept.map(x => this.sessionDir(x)))].map(dir => rm(dir, { recursive: true, force: true })));
    return true;
  }

  private newEntry(session: string, cwd: string, kind: Kind) {
    const ofSession = this.ofSession(session);
    const number = ofSession.filter(x => kindOf(x) === kind).reduce((most, x) => Math.max(most, x.number), 0) + 1;
    const order = ofSession.reduce((most, x) => Math.max(most, orderOf(x)), 0) + 1;
    return { version: 1 as const, session, cwd, number, order, receivedAt: new Date().toISOString(), sent: null };
  }

  private answerable<K extends Kind>(session: string, kind: K, number: number): EntryOf<K> | RoundRefusal {
    // The key carries the kind, so what it finds is of that kind.
    const found = this.entries.get(key(session, kind, number)) as EntryOf<K> | undefined;
    if (!found) return 'unknown';
    if (found.sent) return 'sent';
    // Only the latest round or free block of a session takes answers; the agent is waiting on that one.
    if (this.ofSession(session).some(x => orderOf(x) > orderOf(found))) return 'superseded';
    return found;
  }

  private ofSession(session: string) {
    return [...this.entries.values()].filter(x => x.session === session);
  }

  private phaseOf(session: string): Phase | undefined {
    return this.phases.get(session);
  }

  private setPhase(session: string, cwd: string, phase: Phase): Promise<void> {
    const before = this.phases.get(session);
    if (before && before.open === phase.open && before.quietTurns === phase.quietTurns) return Promise.resolve();
    const stored: StoredPhase = { version: 1, session, cwd: before?.cwd ?? cwd, ...phase };
    this.phases.set(session, stored);
    return this.write(`${session}/phase`, join(this.sessionDir(stored), 'phase.json'), stored);
  }

  private sessionDir(x: { cwd: string; session: string }) {
    return sessionFolder(this.dir, x);
  }

  private save(x: Stored): Promise<void> {
    this.entries.set(entryKey(x), x);
    return this.write(entryKey(x), join(this.sessionDir(x), `${kindOf(x)}-${x.number}.json`), x);
  }

  /**
   * Memory first, so a read right after a change sees it; the files follow in order, one write at a time per file,
   * so a slower earlier write never lands over a later one.
   */
  private write(id: string, file: string, data: unknown): Promise<void> {
    const write = (this.writes.get(id) ?? Promise.resolve()).catch(() => {}).then(() => atomicWrite(file, JSON.stringify(data, null, 2)));
    this.writes.set(id, write);
    return write;
  }

  private async load() {
    for (const project of await entries(this.dir)) {
      for (const session of await entries(join(this.dir, project))) {
        for (const name of await entries(join(this.dir, project, session))) {
          const schema = /^round-\d+\.json$/.test(name) ? storedRoundSchema : /^free-\d+\.json$/.test(name) ? storedFreeSchema : name === 'phase.json' ? storedPhaseSchema : null;
          if (!schema) continue;
          try {
            const x = schema.parse(JSON.parse(await readFile(join(this.dir, project, session, name), 'utf8')));
            if ('open' in x) this.phases.set(x.session, x);
            else this.entries.set(entryKey(x), x);
          } catch { /* A file that does not parse is left on disk untouched. */ }
        }
      }
    }
  }
}

/** `<projects>/<project>/<session>`: the working directory names the project, hashed, so any path makes a safe folder name. */
export function sessionFolder(projectsDir: string, x: { cwd: string; session: string }) {
  return join(projectsDir, createHash('sha256').update(x.cwd).digest('hex').slice(0, 16), x.session);
}

const key = (session: string, kind: Kind, number: number) => `${session}/${deliveryId(kind, number)}`;
const entryKey = (x: Stored) => key(x.session, kindOf(x), x.number);
const sentNow = (message: string) => ({ message, at: new Date().toISOString(), deliveredAt: null });

export async function entries(dir: string): Promise<string[]> {
  try { return await readdir(dir); } catch { return []; }
}

/** Written beside the file, then renamed over it: a reader sees the old file or the new one, never half of one. */
export async function atomicWrite(file: string, data: string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(6).toString('hex')}.pending`;
  try {
    await writeFile(temp, data, { mode: 0o600 });
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
