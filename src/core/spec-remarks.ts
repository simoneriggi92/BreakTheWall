import { z } from 'zod';
import type { Question } from './round';
import { asText, messageLanguageSchema, quoted, returnMessage, type Draft, type MessageLanguage } from './round-answers';

/**
 * Remarks on a handed-over spec (#105): what the person notices while exploring it, anchored to the lines of one
 * version, returned to the agent with one Send as a request for a round before the spec is edited. The page previews
 * the message with the function the server sends it with.
 */

/**
 * Where a remark stands in a version: its lines, and the passage quoted from them, or `missing` for a place where
 * something is missing. One anchor takes one remark.
 */
export type SpecAnchor = { from: number; to: number } & ({ passage: string; missing?: undefined } | { missing: true; passage?: undefined });

const lineSchema = z.number().int().min(1).max(1_000_000);
export const specRemarkSchema = z.strictObject({
  /** The number of the version it was written on: a later version's lines are another text. */
  version: z.number().int().min(1).max(999_999),
  from: lineSchema,
  to: lineSchema,
  passage: z.string().max(5_000).refine(x => x.trim() !== '').optional(),
  missing: z.literal(true).optional(),
  text: z.string().max(50_000),
}).refine(x => x.to >= x.from && (x.passage === undefined) === (x.missing === true));
export type SpecRemark = z.infer<typeof specRemarkSchema>;

export const specRemarksDraftSchema = z.strictObject({
  /** One per spec; it returns after the fixed lines. */
  generalNote: z.string().max(50_000),
  remarks: z.array(specRemarkSchema).max(500),
});
export type SpecRemarksDraft = z.infer<typeof specRemarksDraftSchema>;
export const emptySpecRemarks = (): SpecRemarksDraft => ({ generalNote: '', remarks: [] });

/** A remark is known by its version and anchor: the same passage selected again opens the remark it has. */
export const specRemarkKey = (x: Pick<SpecRemark, 'version' | 'from' | 'to' | 'passage' | 'missing'>) =>
  `${x.version}:${x.from}:${x.to}:${x.missing ? '' : `«${x.passage}»`}`;

/** Remarks in the order of the text: by version, then by line, a quoted passage before a gap on the same lines. */
export const sortSpecRemarks = (remarks: readonly SpecRemark[]): SpecRemark[] =>
  [...remarks].sort((a, b) => a.version - b.version || a.from - b.from || a.to - b.to || Number(!!a.missing) - Number(!!b.missing));

/**
 * The draft with a remark on `anchor` of `version`: a new one with `text`, or, when the anchor already has a remark,
 * the draft as it was. What the page's selection and a backing flag (#106) both call.
 */
export function withSpecRemark(draft: SpecRemarksDraft, version: number, anchor: SpecAnchor, text = ''): SpecRemarksDraft {
  const remark: SpecRemark = anchor.missing
    ? { version, from: anchor.from, to: anchor.to, missing: true, text }
    : { version, from: anchor.from, to: anchor.to, passage: anchor.passage, text };
  if (draft.remarks.some(x => specRemarkKey(x) === specRemarkKey(remark))) return draft;
  return { ...draft, remarks: sortSpecRemarks([...draft.remarks, remark]) };
}

/** A remark with no words yet is only a mark on the page: a bare quote would ask the agent to guess why. */
export const hasWords = (remark: Pick<SpecRemark, 'text'>) => remark.text.trim() !== '';

/** One version of the spec as the message names it. */
export const specVersionLabelSchema = z.strictObject({
  number: z.number().int().min(1),
  /** The location as the agent wrote it for this version. */
  location: z.string().min(1).max(1024),
  handedOverAt: z.iso.datetime(),
});
export type SpecVersionLabel = z.infer<typeof specVersionLabelSchema>;

/**
 * The remarks on one spec as the message words them: its title and the location its revision is to name (the newest
 * version's), its versions, and the remarks to send.
 */
export const specRemarksSectionSchema = z.strictObject({
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(1024),
  versions: z.array(specVersionLabelSchema).min(1),
  draft: specRemarksDraftSchema,
});
export type SpecRemarksSection = z.infer<typeof specRemarksSectionSchema>;

const WORDS: Record<MessageLanguage, {
  header: (title: string, location: string, at: string) => string;
  ask: (location: string) => string;
  lines: (from: number, to: number) => string;
  missing: string;
}> = {
  it: {
    header: (title, location, at) => `Osservazioni sulla specifica «${title}» (${location}), versione consegnata il ${at}.`,
    ask: location => `Non modificarla ancora: chiedimi ciò che ti serve, in un round. Quando rivedi la specifica, chiudi con la riga \`Spec: ${location}\` e mantieni il fondamento di ogni affermazione.`,
    lines: (from, to) => from === to ? `riga ${from}` : `righe ${from}–${to}`,
    missing: '(manca qui)',
  },
  en: {
    header: (title, location, at) => `Remarks on the spec «${title}» (${location}), version handed over on ${at}.`,
    ask: location => `Don't edit it yet: ask me what you need, in a round. When you revise the spec, end with the line \`Spec: ${location}\` and keep each statement's backing.`,
    lines: (from, to) => from === to ? `line ${from}` : `lines ${from}–${to}`,
    missing: '(missing here)',
  },
};

/** A handover time as the message words it: the day and the minute, on the clock of the machine the page runs on. */
export function handoverMinute(iso: string): string {
  const d = new Date(iso), two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * The remarks as the agent receives them, in the page's interface language: fixed lines naming the spec, its location
 * and the version's handover time, asking for a round before any edit, for the closing `Spec:` line and for each
 * statement's backing; then the general note; then `- lines a–b «passage» — remark` by line, "(missing here)" for a
 * gap. Remarks on an earlier version come first, under their own header. Empty when nothing has words.
 */
export function specRemarksMessage(section: SpecRemarksSection, language: MessageLanguage): string {
  const words = WORDS[language];
  const general = section.draft.generalNote.trim();
  const remarks = sortSpecRemarks(section.draft.remarks.filter(hasWords));
  if (!general && remarks.length === 0) return '';
  const newest = section.versions.reduce((a, b) => b.number > a.number ? b : a);
  const numbers = [...new Set(remarks.map(x => x.version))];
  // A general note alone still names the version it is read against: the newest.
  const groups = numbers.length > 0 ? numbers : [newest.number];
  const lines: string[] = [];
  groups.forEach((number, i) => {
    const version = section.versions.find(x => x.number === number) ?? newest;
    const header = words.header(section.title, version.location, handoverMinute(version.handedOverAt));
    if (i === 0) {
      lines.push(`${header} ${words.ask(section.location)}`);
      if (general) lines.push('', general);
    } else lines.push('', header);
    const own = remarks.filter(x => x.version === number);
    if (own.length > 0) lines.push('');
    for (const remark of own) {
      const anchor = remark.missing ? words.missing : quoted(remark.passage ?? '');
      const [first, ...rest] = remark.text.trim().split(/\r?\n/);
      lines.push(`- ${words.lines(remark.from, remark.to)} ${anchor} — ${first}`, ...rest.map(line => line.trim() ? `  ${line}` : ''));
    }
  });
  return lines.join('\n');
}

/**
 * A round's message with the remarks that ride in it (#105): the answers, then each spec's remarks as their own
 * message words them, in a section after the answers, so one turn carries everything.
 */
export function answersWithRemarks(questions: readonly Question[], draft: Draft, language: MessageLanguage, riding: readonly SpecRemarksSection[]): string {
  const sections = riding.map(x => specRemarksMessage(x, language)).filter(x => x !== '');
  return asText([returnMessage(questions, draft, language), ...sections].join('\n\n'));
}

export const sendSpecRemarksSchema = z.strictObject({ draft: specRemarksDraftSchema, language: messageLanguageSchema });

/** Remarks the person sent, kept read-only as sent. */
export const sentSpecRemarksSchema = z.strictObject({
  at: z.iso.datetime(),
  generalNote: z.string(),
  remarks: z.array(specRemarkSchema),
  /** The round whose answers carried them, when they rode along; null when they went out alone. */
  round: z.number().int().min(1).nullable(),
  session: z.string(),
  /** Sent, not delivered, and the session ended: they wait for `claude --resume <id>`. */
  queued: z.boolean(),
});
export type SentSpecRemarks = z.infer<typeof sentSpecRemarksSchema>;

/** A spec's remarks as the page reads them, whichever of its versions names it. */
export const specRemarksViewSchema = z.strictObject({
  draft: specRemarksDraftSchema,
  sent: z.array(sentSpecRemarksSchema),
  /** A round of the receiving session awaits answers: the remarks ride in its message, and Send is that round's. */
  rides: z.number().int().min(1).nullable(),
  /** Claude Code no longer keeps the receiving session's transcript: nothing more can be sent to it. */
  transcriptGone: z.boolean(),
});
export type SpecRemarksView = z.infer<typeof specRemarksViewSchema>;
