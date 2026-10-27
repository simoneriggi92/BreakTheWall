import { allParts, billOfMaterials, JOINT_FAMILY, type Disassembly } from '../src/core/disassembly';
import { answerLengthRatio, optionSets, restates } from '../src/core/disassembly-generation';
import { detectLanguage } from '../src/core/generation';
import { layoutDisassembly, layoutFindings } from '../src/core/layout';
import type { GenerationStats, PhaseStats } from '../src/core/provider';

/** Structure measured from a valid disassembly. None of these numbers says whether an explanation is true. */
export interface DisassemblyMetrics {
  /** Parts on each drawn level: the top level first, then each sub-assembly. */
  partsPerLevel: number[];
  depth: number;
  families: string[];
  forgottenLines: number;
  layoutFindings: number;
  /** The language the app reads in names and points; null when it cannot tell. */
  writtenLanguage: 'it' | 'en' | null;
  runs: Record<string, number>;
  inferences: number;
  /** For each option set, the correct option's length over the mean wrong option's length. Large values give the answer away. */
  answerLengthRatios: number[];
  /** D20: the longest lead at any level, and the points and explanations that say their lead again. */
  maxLead: number; restated: number;
}

export function disassemblyMetrics(d: Disassembly): DisassemblyMetrics {
  const parts = allParts(d);
  const joints = [...d.joints, ...parts.flatMap(x => x.part.joints ?? [])];
  const runs: Record<string, number> = {};
  for (const run of d.runs) runs[run.type] = (runs[run.type] ?? 0) + 1;
  const inferences = d.runs.reduce((sum, r) => sum + (r.inference ? 1 : 0) + (r.type === 'load' ? r.bricks.filter(b => b.inference).length : 0), 0);
  return {
    partsPerLevel: [d.parts.length, ...parts.filter(x => x.part.parts).map(x => x.part.parts!.length)],
    depth: Math.max(...parts.map(x => x.depth)) + 1,
    families: [...new Set(joints.map(j => JOINT_FAMILY[j.type]))].sort(),
    forgottenLines: billOfMaterials(d).counts.missing,
    layoutFindings: [...layoutDisassembly(d).values()].reduce((sum, level) => sum + layoutFindings(level).length, 0),
    writtenLanguage: detectLanguage([...parts.map(x => x.part.name), ...d.parts.flatMap(p => p.points?.map(x => x.text) ?? [])].join(' ')) ?? null,
    runs, inferences,
    answerLengthRatios: optionSets(d.runs).flatMap(set => answerLengthRatio(set.options) ?? []),
    maxLead: Math.max(...parts.map(x => x.part.role.length)),
    restated: parts.reduce((sum, { part }) => sum + (part.points ?? []).filter(x => restates(x.text, part.role)).length + (part.explain && restates(part.explain, part.role) ? 1 : 0), 0),
  };
}

/** One attempt, as written to the JSON-lines report. Setups are named A, B, C so the review stays blind to models. */
export interface AttemptRecord {
  run: string; case: string; private: boolean; setup: string; attempt: number;
  language: 'it' | 'en'; ok: boolean; failure?: string; issues?: string[]; seconds: number;
  stats?: GenerationStats; metrics?: DisassemblyMetrics; file?: string;
}

/** One part taken apart on demand (D14), as written to `expansions.jsonl`. */
export interface ExpansionRecord {
  run: string; case: string; setup: string; part: string; ok: boolean; failure?: string; issues?: string[]; seconds: number;
  stats?: PhaseStats; metrics?: DisassemblyMetrics; file?: string;
}

const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
const total = (stats: GenerationStats | undefined, key: 'requests' | 'repairs' | 'sentChars' | 'receivedChars') => stats ? stats.structure[key] + stats.content[key] + stats.runs[key] : 0;

export interface CaseSummary {
  case: string; setup: string; attempts: number; valid: number;
  repairs: { structure: number; content: number; runs: number };
  medianSeconds?: number; medianRequests?: number; medianSentChars?: number; medianReceivedChars?: number;
  /** Must be 0 on every valid attempt: anything else is a defect in the checks, not in the model. */
  maxForgottenLines?: number; maxLayoutFindings?: number;
  languageMismatches: number; maxAnswerLengthRatio?: number; failures: string[];
  /** D20: the longest lead and the restated texts over valid attempts; valid attempts that needed a shorten request (D19). */
  maxLead?: number; restated: number; savedByShorten: number;
}
export function summarize(records: AttemptRecord[]): CaseSummary[] {
  const keys = [...new Set(records.map(r => `${r.case}\u0000${r.setup}`))];
  return keys.map(key => {
    const [id, setup] = key.split('\u0000');
    const own = records.filter(r => r.case === id && r.setup === setup);
    const valid = own.filter(r => r.ok);
    const ratios = valid.flatMap(r => r.metrics?.answerLengthRatios ?? []);
    const max = (values: number[]) => values.length ? Math.max(...values) : undefined;
    return {
      case: id, setup, attempts: own.length, valid: valid.length,
      repairs: { structure: own.reduce((s, r) => s + (r.stats?.structure.repairs ?? 0), 0), content: own.reduce((s, r) => s + (r.stats?.content.repairs ?? 0), 0), runs: own.reduce((s, r) => s + (r.stats?.runs.repairs ?? 0), 0) },
      medianSeconds: median(own.map(r => r.seconds)), medianRequests: median(own.map(r => total(r.stats, 'requests'))),
      medianSentChars: median(own.map(r => total(r.stats, 'sentChars'))), medianReceivedChars: median(own.map(r => total(r.stats, 'receivedChars'))),
      maxForgottenLines: max(valid.map(r => r.metrics!.forgottenLines)), maxLayoutFindings: max(valid.map(r => r.metrics!.layoutFindings)),
      languageMismatches: valid.filter(r => r.metrics!.writtenLanguage && r.metrics!.writtenLanguage !== r.language).length,
      maxAnswerLengthRatio: max(ratios), failures: own.filter(r => !r.ok).map(r => r.failure ?? 'unknown'),
      maxLead: max(valid.map(r => r.metrics!.maxLead ?? 0)), restated: valid.reduce((sum, r) => sum + (r.metrics!.restated ?? 0), 0),
      savedByShorten: valid.filter(r => r.stats && (r.stats.structure.shortens ?? 0) + (r.stats.content.shortens ?? 0) + (r.stats.runs.shortens ?? 0) > 0).length,
    };
  });
}
