import { readFile, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { z } from 'zod';
import {
  emptySpecRemarks, hasWords, sendSpecRemarksSchema, specRemarkKey, specRemarkSchema, specRemarksDraftSchema, specRemarksMessage,
  type SpecRemarksDraft, type SpecRemarksSection, type SpecRemarksView,
} from '../core/spec-remarks';
import { sessionIdSchema } from '../core/local-server';
import { specIdSchema } from '../core/spec';
import { WriteQueue } from './files';
import { noContent, readJson, send, TRANSCRIPT_GONE } from './http';
import type { RoundStore } from './rounds';

/**
 * Remarks on a handed-over spec (#105): one draft per spec, whichever version it is read in, kept with the spec's
 * versions as `remarks.json`, and what was sent, read-only. Remarks go to the session that handed over the newest
 * version: alone through its queue, or riding in the message of a round it awaits answers to.
 */

/** One version of a spec, as the remarks need it. */
export interface RemarkedVersion {
  number: number;
  location: string;
  handedOverAt: string;
  title: string;
  session: string;
  cwd: string;
  /** How many lines its text has: a remark's lines stand inside it. */
  lines: number;
}
export interface RemarkedSpec { key: string; folder: string; versions: RemarkedVersion[] }

export interface SpecRemarksContext {
  /** The spec a version id names, with every version of it; undefined for an id that names none. */
  specOf(id: string): RemarkedSpec | undefined;
  /** Every spec handed over, to find those whose remarks ride with a round. */
  allSpecs(): RemarkedSpec[];
  rounds: RoundStore;
  transcriptGone(session: string): boolean;
  /** A message waits for the session: a poll waiting takes it, and the page shows it as sent. */
  queued(session: string): void;
  /** What the page shows changed. */
  changed(): void;
}

const sentBatchSchema = z.strictObject({
  at: z.iso.datetime(),
  generalNote: z.string().max(50_000),
  remarks: z.array(specRemarkSchema).max(500),
  session: sessionIdSchema,
  /** The message that carried them: their own (`remarks-<n>`) or a round's answers (`round-<n>`). */
  delivery: z.strictObject({ kind: z.enum(['remarks', 'round']), number: z.number().int().min(1) }),
});
type SentBatch = z.infer<typeof sentBatchSchema>;
const storedSchema = z.strictObject({
  version: z.literal(1),
  key: z.string().min(1).max(4200),
  draft: specRemarksDraftSchema,
  sent: z.array(sentBatchSchema),
});
type Stored = z.infer<typeof storedSchema>;

const sameRemark = (x: SpecRemarksDraft['remarks'][number]) => `${specRemarkKey(x)}\n${x.text.trim()}`;

/** Remarks riding with a round: the spec they are on and how the message words them. */
export interface Riding { key: string; section: SpecRemarksSection }

const REMARKS_PATH = /^\/api\/specs\/([^/]+)\/remarks(\/send)?$/;
const MAX_REMARKS_BYTES = 1024 * 1024;

export async function specRemarkRoutes(context: SpecRemarksContext) {
  const { rounds } = context;
  const stored = new Map<string, Stored>();
  const writes = new WriteQueue();
  for (const spec of context.allSpecs()) await load(spec);

  async function load(spec: RemarkedSpec) {
    try {
      const x = storedSchema.parse(JSON.parse(await readFile(join(spec.folder, 'remarks.json'), 'utf8')));
      if (x.key === spec.key) stored.set(spec.key, x);
    } catch { /* No remarks yet, or a file that does not parse, left on disk untouched. */ }
  }
  const of = (key: string): Stored => stored.get(key) ?? { version: 1, key, draft: emptySpecRemarks(), sent: [] };
  function save(spec: RemarkedSpec, x: Stored): Promise<void> {
    stored.set(spec.key, x);
    return writes.write(spec.key, join(spec.folder, 'remarks.json'), x);
  }
  const newest = (spec: RemarkedSpec) => spec.versions.reduce((a, b) => b.number > a.number ? b : a);
  const sectionOf = (spec: RemarkedSpec, draft: SpecRemarksDraft): SpecRemarksSection => {
    const latest = newest(spec);
    return { title: latest.title, location: latest.location, versions: spec.versions.map(x => ({ number: x.number, location: x.location, handedOverAt: x.handedOverAt })), draft };
  };

  /**
   * Whether a draft fits the spec: every remark on a version it has, inside its lines. A remark new to the draft on a
   * superseded version is refused: its text is no longer what the agent works on.
   */
  function check(spec: RemarkedSpec, draft: SpecRemarksDraft): 'bad-request' | 'superseded' | null {
    const latest = newest(spec).number;
    const kept = new Set(of(spec.key).draft.remarks.map(specRemarkKey));
    for (const remark of draft.remarks) {
      const version = spec.versions.find(x => x.number === remark.version);
      if (!version || remark.to > version.lines) return 'bad-request';
      if (remark.version !== latest && !kept.has(specRemarkKey(remark))) return 'superseded';
    }
    return new Set(draft.remarks.map(specRemarkKey)).size === draft.remarks.length ? null : 'bad-request';
  }

  /**
   * The draft without what a Send already took: the page's save of a draft can leave before a Send and land after it,
   * and must not put the sent remarks and note back, to go out a second time. A remark is the same one when its anchor
   * and its words are.
   */
  function unsent(spec: RemarkedSpec, draft: SpecRemarksDraft): SpecRemarksDraft {
    const { sent } = of(spec.key);
    const remarks = new Set(sent.flatMap(b => b.remarks.map(sameRemark)));
    const notes = new Set(sent.map(b => b.generalNote).filter(x => x !== ''));
    return {
      generalNote: notes.has(draft.generalNote.trim()) ? '' : draft.generalNote,
      remarks: draft.remarks.filter(x => !hasWords(x) || !remarks.has(sameRemark(x))),
    };
  }

  /** What a Send takes: the general note and the remarks with words. Remarks without words stay in the draft. */
  async function markSent(spec: RemarkedSpec, draft: SpecRemarksDraft, session: string, delivery: SentBatch['delivery']) {
    const batch: SentBatch = { at: new Date().toISOString(), generalNote: draft.generalNote.trim(), remarks: draft.remarks.filter(hasWords), session, delivery };
    const before = of(spec.key);
    await save(spec, { ...before, draft: { generalNote: '', remarks: draft.remarks.filter(x => !hasWords(x)) }, sent: [...before.sent, batch] });
  }

  function view(spec: RemarkedSpec): SpecRemarksView {
    const x = of(spec.key), session = newest(spec).session;
    const transcriptGone = context.transcriptGone(session);
    return {
      draft: x.draft,
      sent: x.sent.map(b => ({
        at: b.at, generalNote: b.generalNote, remarks: b.remarks, session: b.session,
        round: b.delivery.kind === 'round' ? b.delivery.number : null,
        queued: rounds.waitsForResume(b.session, b.delivery.kind, b.delivery.number),
      })),
      rides: transcriptGone ? null : rounds.awaiting(session) ?? null,
      transcriptGone,
    };
  }

  /** The remarks with words, on every spec handed over by `session`, that would ride in its round's message. */
  function riding(session: string): Riding[] {
    return context.allSpecs().flatMap(spec => {
      if (newest(spec).session !== session) return [];
      const draft = of(spec.key).draft;
      if (draft.generalNote.trim() === '' && !draft.remarks.some(hasWords)) return [];
      return [{ key: spec.key, section: sectionOf(spec, draft) }];
    });
  }

  /** The round's message carried these remarks: they are sent, with the round's delivery. */
  async function rodeWith(session: string, round: number, carried: readonly Riding[]) {
    for (const x of carried) {
      const spec = context.allSpecs().find(y => y.key === x.key);
      if (spec) await markSent(spec, x.section.draft, session, { kind: 'round', number: round });
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    const found = REMARKS_PATH.exec(path);
    if (!found) return false;
    const [, id, sending] = found;
    const spec = specIdSchema.safeParse(id).success ? context.specOf(id) : undefined;
    if (!spec) { send(res, 404, { error: 'unknown' }); return true; }
    if (req.method === 'GET' && !sending) { send(res, 200, view(spec)); return true; }
    const target = newest(spec);
    if (req.method === 'PUT' && !sending) {
      const parsed = specRemarksDraftSchema.safeParse(await readJson(req, MAX_REMARKS_BYTES));
      if (!parsed.success) { send(res, 400, { error: 'bad-request' }); return true; }
      const draft = unsent(spec, parsed.data);
      const refused = check(spec, draft);
      if (refused) { send(res, refused === 'superseded' ? 409 : 400, { error: refused }); return true; }
      await save(spec, { ...of(spec.key), draft });
      context.changed();
      noContent(res);
      return true;
    }
    if (req.method === 'POST' && sending) {
      const body = sendSpecRemarksSchema.safeParse(await readJson(req, MAX_REMARKS_BYTES));
      if (!body.success) { send(res, 400, { error: 'bad-request' }); return true; }
      const draft = unsent(spec, body.data.draft);
      const refused = check(spec, draft);
      if (refused) { send(res, refused === 'superseded' ? 409 : 400, { error: refused }); return true; }
      if (context.transcriptGone(target.session)) { send(res, 409, TRANSCRIPT_GONE); return true; }
      await save(spec, { ...of(spec.key), draft });
      // The agent waits on a round: the remarks go with its answers, so one turn carries everything.
      const awaiting = rounds.awaiting(target.session);
      if (awaiting !== undefined) { context.changed(); send(res, 409, { error: 'rides', round: awaiting }); return true; }
      const message = specRemarksMessage(sectionOf(spec, draft), body.data.language);
      if (message === '') { send(res, 400, { error: 'bad-request' }); return true; }
      const number = await rounds.sendRemarks(target.session, target.cwd, message);
      await markSent(spec, draft, target.session, { kind: 'remarks', number });
      context.queued(target.session);
      send(res, 200, { message });
      return true;
    }
    return false;
  }

  /**
   * The session was deleted with the versions it handed over (#102): remarks on those versions go from the draft and
   * from what was sent, and so does what was sent to it; a spec with no version left loses its folder.
   */
  async function forget(session: string, gone: readonly { key: string; folder: string; numbers: number[]; whole: boolean }[]) {
    for (const x of gone) {
      await writes.settle(key => key === x.key);
      if (x.whole) {
        stored.delete(x.key);
        await rm(x.folder, { recursive: true, force: true });
        continue;
      }
      const before = stored.get(x.key);
      if (!before) continue;
      const kept = (remark: { version: number }) => !x.numbers.includes(remark.version);
      const sent = before.sent.filter(b => b.session !== session).map(b => ({ ...b, remarks: b.remarks.filter(kept) }))
        .filter(b => b.remarks.length > 0 || b.generalNote !== '');
      const spec = context.allSpecs().find(y => y.key === x.key);
      if (spec) await save(spec, { ...before, draft: { ...before.draft, remarks: before.draft.remarks.filter(kept) }, sent });
    }
  }

  return { handle, riding, rodeWith, forget };
}
export type SpecRemarkRoutes = Awaited<ReturnType<typeof specRemarkRoutes>>;
