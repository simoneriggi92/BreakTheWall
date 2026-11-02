import { z } from 'zod';
import { hashText, sourceSchema, type Source } from './lesson';

/** Bounds applied before anything can reach a provider. One generation request carries the whole selection. */
export const SOURCE_LIMITS = {
  maxSources: 4,
  maxCharsPerSource: 40_000,
  maxTotalChars: 60_000,
  maxLines: 1_500,
  maxLineChars: 4_000,
  maxFileBytes: 160_000,
  maxTitleChars: 120,
} as const;
export const FILE_EXTENSIONS = ['txt', 'md', 'markdown'] as const;
export const CODE_LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'C#', 'Java', 'Go', 'Rust', 'SQL', 'Shell', 'Codice'] as const;

export type ImportErrorCode = 'empty' | 'not-utf8' | 'unsupported-type' | 'too-large' | 'too-many-lines' | 'line-too-long' | 'binary' | 'duplicate' | 'too-many-sources' | 'total-too-large' | 'missing-title' | 'mismatch';
/** The message is Italian for logs; the interface words the error from its code and parameters. */
export type ImportErrorParams = { name?: string; chars?: number; limit?: number; lines?: number; line?: number; kb?: number };
export class SourceImportError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string, public readonly params: ImportErrorParams = {}) { super(message); this.name = 'SourceImportError'; }
}
export type ImportInput =
  | { kind: 'paste'; title: string; text: string; language?: string }
  | { kind: 'file'; name: string; bytes: Uint8Array };
export type UserSource = Source & { origin: 'user-pasted' | 'user-file' };

const extension = (name: string) => name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
const fmt = (n: number) => n.toLocaleString('it-IT');

function decode(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new SourceImportError('not-utf8', 'Il file non è testo UTF-8. Salvalo come UTF-8 oppure incolla il testo.'); }
}

/** Exact text that will be shown, stored and sent: line endings unified, trailing blank space removed, nothing else rewritten. */
export function normalizeText(value: string): string {
  return value.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trimEnd();
}

function checkText(text: string) {
  if (!text.trim()) throw new SourceImportError('empty', 'La fonte è vuota.');
  // Tab and newline are the only control characters a text source needs; others signal binary or corrupted data.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) throw new SourceImportError('binary', 'La fonte contiene caratteri di controllo: sembra un file binario, non testo.');
  if (text.length > SOURCE_LIMITS.maxCharsPerSource) throw new SourceImportError('too-large', `La fonte ha ${fmt(text.length)} caratteri; il limite è ${fmt(SOURCE_LIMITS.maxCharsPerSource)}. Seleziona la parte che vuoi studiare.`, { chars: text.length, limit: SOURCE_LIMITS.maxCharsPerSource });
  const lines = text.split('\n');
  if (lines.length > SOURCE_LIMITS.maxLines) throw new SourceImportError('too-many-lines', `La fonte ha ${fmt(lines.length)} righe; il limite è ${fmt(SOURCE_LIMITS.maxLines)}.`, { lines: lines.length, limit: SOURCE_LIMITS.maxLines });
  const long = lines.findIndex(line => line.length > SOURCE_LIMITS.maxLineChars);
  if (long >= 0) throw new SourceImportError('line-too-long', `La riga ${long + 1} supera ${fmt(SOURCE_LIMITS.maxLineChars)} caratteri: le citazioni per riga non sarebbero leggibili.`, { line: long + 1, limit: SOURCE_LIMITS.maxLineChars });
}

/** Turns one pasted text or one selected file into a source record. Nothing here reads directories or executes content. */
export async function importSource(input: ImportInput): Promise<UserSource> {
  let title: string; let raw: string; let language: string | undefined;
  if (input.kind === 'file') {
    if (!(FILE_EXTENSIONS as readonly string[]).includes(extension(input.name))) throw new SourceImportError('unsupported-type', `«${input.name}» non è supportato. Per ora puoi importare file .txt e .md.`, { name: input.name });
    if (input.bytes.byteLength > SOURCE_LIMITS.maxFileBytes) throw new SourceImportError('too-large', `«${input.name}» pesa ${fmt(Math.ceil(input.bytes.byteLength / 1000))} kB; il limite è ${fmt(SOURCE_LIMITS.maxFileBytes / 1000)} kB.`, { name: input.name, kb: Math.ceil(input.bytes.byteLength / 1000), limit: SOURCE_LIMITS.maxFileBytes / 1000 });
    if (!input.bytes.byteLength) throw new SourceImportError('empty', `«${input.name}» è vuoto.`, { name: input.name });
    title = input.name; raw = decode(input.bytes);
  } else {
    title = input.title.trim(); raw = input.text; language = input.language || undefined;
    if (!title) throw new SourceImportError('missing-title', 'Dai un nome alla fonte, così potrai riconoscerla nelle citazioni.');
  }
  const text = normalizeText(raw);
  checkText(text);
  const sha256 = await hashText(text);
  return sourceSchema.parse({
    id: `src-${sha256.slice(0, 12)}`, title: title.slice(0, SOURCE_LIMITS.maxTitleChars), origin: input.kind === 'file' ? 'user-file' : 'user-pasted',
    revision: 'v1', text, sha256, ...(language ? { language } : {}),
  }) as UserSource;
}

/** Checks that a whole selection can be sent in one bounded request. */
export function checkSelection(sources: Source[]): void {
  if (sources.length > SOURCE_LIMITS.maxSources) throw new SourceImportError('too-many-sources', `Puoi usare al massimo ${SOURCE_LIMITS.maxSources} fonti per percorso.`, { limit: SOURCE_LIMITS.maxSources });
  if (new Set(sources.map(x => x.sha256)).size !== sources.length) throw new SourceImportError('duplicate', 'Questa fonte è già nella selezione.');
  const total = sources.reduce((sum, x) => sum + x.text.length, 0);
  if (total > SOURCE_LIMITS.maxTotalChars) throw new SourceImportError('total-too-large', `Le fonti insieme hanno ${fmt(total)} caratteri; il limite per un percorso è ${fmt(SOURCE_LIMITS.maxTotalChars)}.`, { chars: total, limit: SOURCE_LIMITS.maxTotalChars });
}

/** An empty question means the whole source (P-20261029-source-entry); a question, when given, keeps its 10–400 characters. */
export const goalSchema = z.strictObject({
  outcome: z.string().trim().max(400, 'L’obiettivo deve restare sotto i 400 caratteri.')
    .refine(x => x === '' || x.length >= 10, 'Descrivi l’obiettivo in almeno 10 caratteri.'),
  priorKnowledge: z.string().trim().max(200, 'Le conoscenze di partenza devono restare sotto i 200 caratteri.'),
});
export type LearningGoal = z.infer<typeof goalSchema>;

/** The host re-checks every source the renderer hands over: text, hash, id and bounds must agree. */
export async function verifySelection(input: unknown): Promise<UserSource[]> {
  const sources = z.array(sourceSchema).min(1).max(SOURCE_LIMITS.maxSources).parse(input);
  for (const source of sources) {
    if (source.origin === 'original-prepared') throw new SourceImportError('unsupported-type', 'Solo le fonti importate possono generare un percorso.');
    checkText(source.text);
    const sha256 = await hashText(source.text);
    if (source.text !== normalizeText(source.text) || source.sha256 !== sha256 || source.id !== `src-${sha256.slice(0, 12)}`) throw new SourceImportError('mismatch', 'Una fonte non corrisponde al testo mostrato in anteprima. Importala di nuovo.');
  }
  checkSelection(sources);
  return sources as UserSource[];
}
