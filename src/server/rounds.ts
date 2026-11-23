import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { draftSchema, emptyDraft, sessionIdSchema, type Draft, type RoundView } from '../core/round-answers';
import { roundSchema, type Round } from '../core/round';

/**
 * Every round the server receives, with its draft and, once sent, the message exactly as delivered (#95). Kept on
 * disk by project (working directory) → session → round, one versioned file per round, rewritten whole and replaced
 * atomically on every change, and checked with Zod when read back: a file that does not parse is left alone.
 */
const sentSchema = z.strictObject({
  message: z.string().max(2_000_000),
  at: z.iso.datetime(),
  /** When the mod took it for the session; null while it waits in the queue. */
  deliveredAt: z.iso.datetime().nullable(),
});
const storedRoundSchema = z.strictObject({
  version: z.literal(1),
  session: sessionIdSchema,
  cwd: z.string().min(1).max(4096),
  number: z.number().int().min(1),
  receivedAt: z.iso.datetime(),
  round: roundSchema,
  draft: draftSchema,
  sent: sentSchema.nullable(),
});
type StoredRound = z.infer<typeof storedRoundSchema>;

/** Why a change to a round was refused; the server answers each with its own status. */
export type RoundRefusal = 'unknown' | 'sent' | 'superseded';

export class RoundStore {
  private rounds = new Map<string, StoredRound>();
  private writes = new Map<string, Promise<void>>();

  private constructor(private dir: string) {}

  static async open(dataDir: string): Promise<RoundStore> {
    const store = new RoundStore(join(dataDir, 'projects'));
    await store.load();
    return store;
  }

  /** A new round of a session, numbered after the session's earlier rounds. */
  async add(session: string, cwd: string, round: Round): Promise<StoredRound> {
    const number = this.ofSession(session).reduce((most, x) => Math.max(most, x.number), 0) + 1;
    const stored: StoredRound = { version: 1, session, cwd, number, receivedAt: new Date().toISOString(), round, draft: emptyDraft(), sent: null };
    await this.save(stored);
    return stored;
  }

  /** The round received last, across every session: the one the page shows. */
  latest(): RoundView | null {
    let latest: StoredRound | undefined;
    for (const x of this.rounds.values()) if (!latest || x.receivedAt > latest.receivedAt || (x.receivedAt === latest.receivedAt && x.number > latest.number)) latest = x;
    return latest ? this.view(latest) : null;
  }

  /** The questions of one round, to word its message. */
  questions(session: string, number: number) {
    return this.rounds.get(key(session, number))?.round.questions;
  }

  async saveDraft(session: string, number: number, draft: Draft): Promise<RoundRefusal | null> {
    const found = this.answerable(session, number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, draft });
    return null;
  }

  /** Records the round as sent with its message, which then waits in the session's queue. */
  async send(session: string, number: number, draft: Draft, message: string): Promise<RoundRefusal | null> {
    const found = this.answerable(session, number);
    if (typeof found === 'string') return found;
    await this.save({ ...found, draft, sent: { message, at: new Date().toISOString(), deliveredAt: null } });
    return null;
  }

  /** The oldest message still waiting for a session, or undefined. */
  nextDelivery(session: string): { number: number; message: string } | undefined {
    const waiting = this.ofSession(session).filter(x => x.sent && !x.sent.deliveredAt).sort((a, b) => a.number - b.number)[0];
    return waiting?.sent ? { number: waiting.number, message: waiting.sent.message } : undefined;
  }

  async delivered(session: string, number: number) {
    const found = this.rounds.get(key(session, number));
    if (found?.sent && !found.sent.deliveredAt) await this.save({ ...found, sent: { ...found.sent, deliveredAt: new Date().toISOString() } });
  }

  private answerable(session: string, number: number): StoredRound | RoundRefusal {
    const found = this.rounds.get(key(session, number));
    if (!found) return 'unknown';
    if (found.sent) return 'sent';
    // Only the latest round of a session takes answers; the agent is waiting on that one.
    if (this.ofSession(session).some(x => x.number > number)) return 'superseded';
    return found;
  }

  private ofSession(session: string) {
    return [...this.rounds.values()].filter(x => x.session === session);
  }

  private view(x: StoredRound): RoundView {
    const latestOfSession = !this.ofSession(x.session).some(y => y.number > x.number);
    return {
      session: x.session, number: x.number, receivedAt: x.receivedAt, ...x.round, draft: x.draft,
      sent: x.sent ? { message: x.sent.message, at: x.sent.at } : null,
      superseded: !latestOfSession,
    };
  }

  private file(x: Pick<StoredRound, 'cwd' | 'session' | 'number'>) {
    // The working directory names the project; hashed, so any path makes a safe folder name.
    const project = createHash('sha256').update(x.cwd).digest('hex').slice(0, 16);
    return join(this.dir, project, x.session, `round-${x.number}.json`);
  }

  /**
   * Memory first, so a read right after a change sees it; the files follow in order, one write at a time per round,
   * so a slower earlier write never lands over a later one.
   */
  private save(x: StoredRound): Promise<void> {
    const id = key(x.session, x.number);
    this.rounds.set(id, x);
    const file = this.file(x);
    const write = (this.writes.get(id) ?? Promise.resolve()).catch(() => {}).then(() => atomicWrite(file, JSON.stringify(x, null, 2)));
    this.writes.set(id, write);
    return write;
  }

  private async load() {
    for (const project of await entries(this.dir)) {
      for (const session of await entries(join(this.dir, project))) {
        for (const name of await entries(join(this.dir, project, session))) {
          if (!/^round-\d+\.json$/.test(name)) continue;
          try {
            const x = storedRoundSchema.parse(JSON.parse(await readFile(join(this.dir, project, session, name), 'utf8')));
            this.rounds.set(key(x.session, x.number), x);
          } catch { /* A file that does not parse is not a round; it stays on disk untouched. */ }
        }
      }
    }
  }
}

const key = (session: string, number: number) => `${session}/${number}`;

async function entries(dir: string): Promise<string[]> {
  try { return await readdir(dir); } catch { return []; }
}

async function atomicWrite(file: string, data: string) {
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
