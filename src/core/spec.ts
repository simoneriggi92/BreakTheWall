import { z } from 'zod';
import { idSchema } from './lesson';
import { sessionIdSchema } from './local-server';

/**
 * A spec the agent hands over (#104): a turn whose last line is `Spec: <location>`. The location names a GitHub issue
 * (its URL, `owner/repo#n`, or `#n` in the session's repository), a file in the session's folder, or `pasted`: the
 * spec is the turn's own text above the line. The page reads specs through the views below and sends only their ids.
 */
export type SpecLocation =
  | { kind: 'github'; issue: string }
  | { kind: 'file'; path: string }
  | { kind: 'pasted' };
export interface SpecHandover { location: SpecLocation; written: string; above: string }

const SPEC_LINE = /^\s*(?:\*\*)?Spec:(?:\*\*)?\s*(.+?)\s*$/;
const ISSUE_URL = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d{1,9})(?:[#?].*)?$/;
const REPO_ISSUE = /^([\w.-]+)\/([\w.-]+)#(\d{1,9})$/;
const LOCAL_ISSUE = /^#(\d{1,9})$/;
const MAX_PATH = 1024;

/**
 * The handover in a turn, or null. Only the last line counts: the injection asks for it alone and last, and a spec
 * pasted above it may itself mention `Spec:` lines.
 */
export function parseSpecHandover(text: string): SpecHandover | null {
  const lines = text.replace(/\r\n?/g, '\n').trimEnd().split('\n');
  const match = SPEC_LINE.exec(lines.at(-1) ?? '');
  if (!match) return null;
  // `docs/spec.md`, <docs/spec.md>: the agent may quote the location as code or a link.
  const written = match[1].replace(/^`(.*)`$/, '$1').replace(/^<(.*)>$/, '$1').trim();
  const above = lines.slice(0, -1).join('\n').trim();
  const location = locationOf(written);
  return location && { location, written, above };
}

function locationOf(written: string): SpecLocation | null {
  if (written === '' || written.length > MAX_PATH || written.includes('\0')) return null;
  if (/^pasted$/i.test(written)) return { kind: 'pasted' };
  const url = ISSUE_URL.exec(written);
  if (url) return { kind: 'github', issue: `https://github.com/${url[1]}/${url[2]}/issues/${url[3]}` };
  const repo = REPO_ISSUE.exec(written);
  if (repo) return { kind: 'github', issue: `https://github.com/${repo[1]}/${repo[2]}/issues/${repo[3]}` };
  const local = LOCAL_ISSUE.exec(written);
  if (local) return { kind: 'github', issue: local[1] };
  // Another address is no file of the session's folder.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(written)) return null;
  return { kind: 'file', path: written };
}

/** A version's id: the location's hash and the version's number. It names a file on disk, so nothing else. */
export const specIdSchema = z.string().regex(/^spec-[0-9a-f]{16}-[1-9]\d{0,5}$/);

/** Why a structure was not written, as the page words it: the generation's failure code and reason. */
const specFailureSchema = z.strictObject({
  code: z.string().min(1).max(40),
  reason: z.string().min(1).max(60).optional(),
  issues: z.array(z.string().max(2000)).max(8).optional(),
});
export type SpecFailure = z.infer<typeof specFailureSchema>;

/** The structure being written for a version, or why the last attempt stopped; null when nothing ran since the start. */
export const specRunSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('running'), repairing: z.boolean() }),
  z.strictObject({ state: z.literal('failed'), failure: specFailureSchema }),
]).nullable();
export type SpecRun = z.infer<typeof specRunSchema>;

/** One version of a spec as the page reads it. */
export const specViewSchema = z.strictObject({
  id: specIdSchema,
  /** The location as the agent wrote it, to be written the same way when the spec is revised. */
  location: z.string().min(1).max(MAX_PATH),
  title: z.string().min(1).max(200),
  number: z.number().int().min(1),
  handedOverAt: z.iso.datetime(),
  session: sessionIdSchema,
  /** A later version of the same location was handed over: this one stays readable and takes no new remarks. */
  superseded: z.boolean(),
  /** The newest version of the same location; this one's own id when it is the newest. */
  latest: specIdSchema,
  exploration: z.strictObject({ id: idSchema, revision: idSchema }).nullable(),
  run: specRunSchema,
});
export type SpecView = z.infer<typeof specViewSchema>;
export const specListSchema = z.object({ specs: z.array(specViewSchema) });
