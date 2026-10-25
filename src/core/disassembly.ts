import { z } from 'zod';
import { detectLanguage } from './generation';
import { hashText, idSchema, sourceOriginSchema, sourceSchema } from './lesson';

const id = idSchema;
const text = z.string().min(1).max(2000);
const short = z.string().min(1).max(200);
const line = z.number().int().positive();

export const PART_KINDS = ['step', 'component', 'artifact', 'premise', 'conclusion', 'ground', 'limit', 'objection', 'consequence', 'rejected', 'event', 'actor'] as const;
export const partKindSchema = z.enum(PART_KINDS);
export const jointTypeSchema = z.enum(['sends-to', 'causes', 'depends-on', 'supports', 'attacks', 'limits', 'leads-to', 'because']);
export type JointType = z.infer<typeof jointTypeSchema>;
/** One loop for every subject: only the vocabulary of joints changes with the kind of material. */
export const JOINT_FAMILY: Record<JointType, 'mechanism' | 'argument' | 'story'> = {
  'sends-to': 'mechanism', causes: 'mechanism', 'depends-on': 'mechanism',
  supports: 'argument', attacks: 'argument', limits: 'argument',
  'leads-to': 'story', because: 'story',
};
/** Generic drawing symbols, named as in lucide. A closed list keeps generated parts drawable and consistent. */
export const partIconSchema = z.enum([
  'play', 'list-checks', 'package', 'rocket', 'clipboard-check', 'rotate-ccw', 'lock', 'search', 'layers', 'file-text',
  'database', 'send', 'download', 'timer', 'repeat', 'filter', 'key-round', 'fingerprint', 'settings', 'plug',
  'cpu', 'gauge', 'shield-check', 'triangle-alert', 'scale', 'sprout', 'ban', 'user-round', 'users', 'map',
  'ruler', 'message-circle', 'book-open', 'code', 'hammer', 'git-branch', 'flag',
]);
export const pointMarkSchema = z.enum(['step', 'keeps', 'caveat']);
export const exclusionReasonSchema = z.enum(['context', 'outside-question', 'repetition', 'detail', 'secrets', 'generated']);
/** States a scenario step can give a part; the player draws each one differently. */
export const sceneStateSchema = z.enum(['ok', 'active', 'failed', 'restored']);
/** Arguments with independent supports weaken rather than fall, so a load test has three outcomes. */
export const verdictSchema = z.enum(['falls', 'weakens', 'holds']);

/** Text lengths the automatic layout depends on. */
export const DISASSEMBLY_LIMITS = { partName: 48, jointLabel: 24, point: 130, minParts: 3, maxParts: 7, minPoints: 2, maxPoints: 4 } as const;

const cite = z.strictObject({ source: id, from: line, to: line });
const cites = z.array(cite).max(20);
const point = z.strictObject({ text, mark: pointMarkSchema.optional() });
export const jointSchema = z.strictObject({ from: id, to: id, type: jointTypeSchema, label: short, cites: cites.optional() });
const partBase = z.strictObject({
  id, name: short, kind: partKindSchema, icon: partIconSchema, role: text, relevant: z.boolean().optional(),
  /** Top-level parts explain themselves in 2–4 marked points; sub-parts in one sentence. */
  points: z.array(point).max(8).optional(), explain: text.optional(),
  metaphor: z.strictObject({ text, limit: text }).optional(),
  lens: z.strictObject({ what: text, why: text, how: text, critical: text }).optional(),
  critique: text.optional(),
  cites,
});
// Depth is at most three levels, so the schema nests explicitly instead of recursing.
const leafPart = partBase;
const midPart = partBase.extend({ parts: z.array(leafPart).max(12).optional(), joints: z.array(jointSchema).max(20).optional() });
const topPart = partBase.extend({ parts: z.array(midPart).max(12).optional(), joints: z.array(jointSchema).max(20).optional() });

export const disassemblySourceSchema = sourceSchema.extend({
  origin: z.enum([...sourceOriginSchema.options, 'public-domain']),
  /** First line of each page, for documents: citations can then name pages. */
  pages: z.array(z.strictObject({ page: z.number().int().positive(), from: line })).min(1).max(5000).optional(),
});
export const scopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('repository'), root: short, commit: z.string().regex(/^[a-f0-9]{7,40}$/), modified: z.array(short).max(500), note: text.optional() }),
  z.strictObject({ kind: z.literal('document'), title: short, pages: z.strictObject({ from: z.number().int().positive(), to: z.number().int().positive() }), note: text.optional() }),
]);
const option = z.strictObject({ text, correct: z.boolean(), why: text });
const vars = z.record(z.string().min(1).max(40), z.string().max(120));
const scenario = z.strictObject({
  type: z.literal('scenario'), id, title: short, setup: text, vars: vars.optional(), inference: z.boolean().optional(),
  steps: z.array(z.strictObject({
    action: short, predict: z.strictObject({ question: text, options: z.array(option).min(2).max(5) }).optional(),
    effect: z.record(id, sceneStateSchema).optional(), flow: z.array(z.tuple([id, id])).max(12).optional(), vars: vars.optional(),
    explain: text, cites: cites.optional(),
  })).min(2).max(12),
});
const load = z.strictObject({
  type: z.literal('load'), id, title: short, target: id, question: text, inference: z.boolean().optional(),
  bricks: z.array(z.strictObject({ part: id, verdict: verdictSchema, explain: text, inference: z.boolean().optional(), cites: cites.optional() })).min(2).max(7),
});
const scenarioCase = z.strictObject({
  type: z.literal('case'), id, title: short, scenario: text, question: text, options: z.array(option).min(2).max(5),
  inference: z.boolean().optional(), cites: cites.optional(),
});
export const runSchema = z.discriminatedUnion('type', [scenario, load, scenarioCase]);
export const disassemblySchema = z.strictObject({
  schemaVersion: z.literal(1), id, revision: id, kind: z.enum(['prepared', 'generated']),
  generation: z.strictObject({ provider: z.enum(['chatgpt', 'local']), runtime: z.enum(['ollama', 'lmstudio', 'llamacpp', 'openai']).optional(), model: short, createdAt: z.iso.datetime() }).optional(),
  title: short, question: text, language: z.enum(['it', 'en']),
  scope: scopeSchema.optional(),
  sources: z.array(disassemblySourceSchema).min(1).max(64),
  whole: z.strictObject({ name: short, does: text, why: text, cites }),
  parts: z.array(topPart).min(1).max(12),
  joints: z.array(jointSchema).max(20),
  bom: z.strictObject({
    excluded: z.array(z.strictObject({ source: id, from: line, to: line, reason: exclusionReasonSchema, note: text.optional() })).max(1000),
    /** Whole files or groups left out of the analysis, so their absence stays visible. */
    excludedFiles: z.array(z.strictObject({ path: short, reason: exclusionReasonSchema, note: text.optional() })).max(2000).optional(),
  }),
  runs: z.array(runSchema).min(1).max(10),
  reassemble: z.strictObject({
    title: short, instruction: text,
    /** A slot accepts one part, or any of a set of interchangeable parts. */
    slots: z.array(z.strictObject({ id, label: z.string().min(1).max(40), accepts: z.union([id, z.array(id).min(2).max(7)]) })).min(1).max(12),
    hints: z.record(id, text),
  }),
});
export type Disassembly = z.infer<typeof disassemblySchema>;
export type DisassemblySource = z.infer<typeof disassemblySourceSchema>;
export type Cite = z.infer<typeof cite>;
export type Joint = z.infer<typeof jointSchema>;
export type Run = z.infer<typeof runSchema>;
export type Part = z.infer<typeof partBase> & { parts?: Part[]; joints?: Joint[] };

/** A finding names the exact place to fix, e.g. `parts[2].parts[0].cites[1]`. */
export type Finding = { path: string; message: string };
export class DisassemblyError extends Error {
  constructor(public readonly findings: Finding[]) { super(findings.map(x => `${x.path}: ${x.message}`).join('\n')); this.name = 'DisassemblyError'; }
}
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key), '');
}

/** Every part with its location, depth-first in drawing order. */
export function allParts(d: Pick<Disassembly, 'parts'>): { part: Part; path: string; depth: number }[] {
  const walk = (parts: Part[], prefix: string, depth: number): { part: Part; path: string; depth: number }[] =>
    parts.flatMap((part, i) => [{ part, path: `${prefix}[${i}]`, depth }, ...walk(part.parts ?? [], `${prefix}[${i}].parts`, depth + 1)]);
  return walk(d.parts, 'parts', 0);
}
/** The lines a citation points at. The app copies them from the source; the format never stores a quote. */
export function citedLines(d: Pick<Disassembly, 'sources'>, c: Cite): string[] {
  const source = d.sources.find(x => x.id === c.source);
  if (!source) throw new DisassemblyError([{ path: 'cite', message: `Unknown source ${c.source}` }]);
  return source.text.split('\n').slice(c.from - 1, c.to);
}
/** The pages a citation spans, when its source has a page map. */
export function pagesOf(source: DisassemblySource, c: Pick<Cite, 'from' | 'to'>): { first: number; last: number } | undefined {
  if (!source.pages) return undefined;
  const at = (n: number) => source.pages!.reduce((page, x) => x.from <= n ? x.page : page, source.pages![0].page);
  return { first: at(c.from), last: at(c.to) };
}

export type LineStatus = 'blank' | 'assigned' | 'excluded' | 'missing';
export type BillOfMaterials = {
  sources: { id: string; title: string; status: LineStatus[]; forgotten: { from: number; to: number }[] }[];
  counts: Record<LineStatus, number>;
};
/**
 * Accounts for every source line: in the whole, a part or a joint, excluded with a reason, or forgotten.
 * Runs cite lines too, but a run does not take a line apart, so it does not count.
 */
export function billOfMaterials(d: Pick<Disassembly, 'sources' | 'whole' | 'parts' | 'joints' | 'bom'>): BillOfMaterials {
  const lines = new Map(d.sources.map(s => [s.id, s.text.split('\n')]));
  const assigned = new Map(d.sources.map(s => [s.id, new Set<number>()]));
  const excluded = new Map(d.sources.map(s => [s.id, new Set<number>()]));
  const mark = (target: Map<string, Set<number>>, c: { source: string; from: number; to: number }) => {
    const set = target.get(c.source); const max = lines.get(c.source)?.length ?? 0;
    if (set) for (let n = Math.max(1, c.from); n <= Math.min(c.to, max); n++) set.add(n);
  };
  d.whole.cites.forEach(c => mark(assigned, c));
  const joints = [...d.joints];
  for (const { part } of allParts(d)) { part.cites.forEach(c => mark(assigned, c)); joints.push(...part.joints ?? []); }
  joints.forEach(j => j.cites?.forEach(c => mark(assigned, c)));
  d.bom.excluded.forEach(x => mark(excluded, x));
  const counts: Record<LineStatus, number> = { blank: 0, assigned: 0, excluded: 0, missing: 0 };
  const sources = d.sources.map(s => {
    const status = lines.get(s.id)!.map((t, i): LineStatus => !t.trim() ? 'blank' : assigned.get(s.id)!.has(i + 1) ? 'assigned' : excluded.get(s.id)!.has(i + 1) ? 'excluded' : 'missing');
    // A forgotten range runs across blank lines, so one gap in the text is reported once.
    const forgotten: { from: number; to: number }[] = [];
    let open: { from: number; to: number } | undefined;
    status.forEach((x, i) => {
      counts[x]++;
      if (x === 'missing') { if (open) open.to = i + 1; else forgotten.push(open = { from: i + 1, to: i + 1 }); }
      else if (x !== 'blank') open = undefined;
    });
    return { id: s.id, title: s.title, status, forgotten };
  });
  return { sources, counts };
}

/** Structural host checks, shared by stored files and generated structures. Passing them is not evidence of truth. */
export function checkDisassembly(d: Disassembly): Finding[] {
  const findings: Finding[] = [];
  const add = (path: string, message: string) => findings.push({ path, message });
  const L = DISASSEMBLY_LIMITS;
  const sources = new Map(d.sources.map(s => [s.id, s.text.split('\n').length]));
  const duplicates = (values: { id: string; path: string }[], label: string) => {
    const seen = new Set<string>();
    for (const x of values) { if (seen.has(x.id)) add(x.path, `Duplicate ${label} id ${x.id}`); seen.add(x.id); }
  };
  duplicates(d.sources.map((s, i) => ({ id: s.id, path: `sources[${i}]` })), 'source');
  if ((d.kind === 'generated') !== !!d.generation) add('generation', 'Generation metadata must match the disassembly kind');
  d.sources.forEach((s, i) => s.pages?.forEach((p, k) => {
    const prev = s.pages![k - 1];
    if (k === 0 && p.from !== 1) add(`sources[${i}].pages[0]`, 'The first page must start at line 1');
    if (prev && (p.from <= prev.from || p.page <= prev.page)) add(`sources[${i}].pages[${k}]`, 'Pages must increase');
    if (p.from > sources.get(s.id)!) add(`sources[${i}].pages[${k}]`, 'Page starts after the last line');
  }));
  if (d.scope?.kind === 'document' && d.scope.pages.from > d.scope.pages.to) add('scope.pages', 'Page range is reversed');

  const checkCite = (c: { source: string; from: number; to: number }, path: string) => {
    const max = sources.get(c.source);
    if (max === undefined) add(path, `Unknown source ${c.source}`);
    else if (c.from > c.to || c.to > max) add(path, `Lines ${c.from}–${c.to} are outside the source (${max} lines)`);
  };
  const checkCites = (list: Cite[] | undefined, path: string) => list?.forEach((c, i) => checkCite(c, `${path}.cites[${i}]`));
  checkCites(d.whole.cites, 'whole');
  d.bom.excluded.forEach((x, i) => checkCite(x, `bom.excluded[${i}]`));

  const parts = allParts(d);
  duplicates(parts.map(x => ({ id: x.part.id, path: x.path })), 'part');
  const top = new Set(d.parts.map(p => p.id));
  const checkLevel = (level: Part[], joints: Joint[], path: string, jointsPath: string) => {
    if (level.length < L.minParts || level.length > L.maxParts) add(path, `${level.length} parts at this level; expected ${L.minParts}–${L.maxParts}`);
    const ids = new Set(level.map(p => p.id));
    const seen = new Set<string>();
    joints.forEach((j, i) => {
      const at = `${jointsPath}[${i}]`;
      if (!ids.has(j.from) || !ids.has(j.to)) add(at, `Joint ${j.from} → ${j.to} must connect parts of the same level`);
      if (j.from === j.to) add(at, 'A joint cannot connect a part to itself');
      if (seen.has(`${j.from}>${j.to}`)) add(at, `Duplicate joint ${j.from} → ${j.to}`);
      seen.add(`${j.from}>${j.to}`);
      if (j.label.length > L.jointLabel) add(`${at}.label`, `Joint label has ${j.label.length} characters; at most ${L.jointLabel}`);
      checkCites(j.cites, at);
    });
  };
  checkLevel(d.parts, d.joints, 'parts', 'joints');
  for (const { part, path, depth } of parts) {
    if (!part.cites.length) add(`${path}.cites`, 'A part must cite its source');
    checkCites(part.cites, path);
    if (part.name.length > L.partName) add(`${path}.name`, `Part name has ${part.name.length} characters; at most ${L.partName}`);
    if (depth === 0) {
      const n = part.points?.length ?? 0;
      if (n < L.minPoints || n > L.maxPoints) add(`${path}.points`, `A top-level part needs ${L.minPoints}–${L.maxPoints} points; it has ${n}`);
      if (part.explain) add(`${path}.explain`, 'A top-level part explains itself in points, not in one sentence');
    } else {
      if (!part.explain) add(`${path}.explain`, 'A sub-part needs a one-sentence explanation');
      if (part.points) add(`${path}.points`, 'Only top-level parts have points');
    }
    part.points?.forEach((x, i) => { if (x.text.length > L.point) add(`${path}.points[${i}]`, `Point has ${x.text.length} characters; at most ${L.point}`); });
    if (part.parts) checkLevel(part.parts, part.joints ?? [], `${path}.parts`, `${path}.joints`);
    else if (part.joints?.length) add(`${path}.joints`, 'Joints need sub-parts to connect');
  }

  duplicates(d.runs.map((r, i) => ({ id: r.id, path: `runs[${i}]` })), 'run');
  const topPart = (value: string, path: string) => { if (!top.has(value)) add(path, `${value} is not a top-level part`); };
  const oneCorrect = (options: { correct: boolean }[], path: string) => {
    if (options.filter(x => x.correct).length !== 1) add(path, 'Exactly one option must be correct');
  };
  d.runs.forEach((run, r) => {
    const at = `runs[${r}]`;
    if (run.type === 'scenario') run.steps.forEach((step, s) => {
      const sp = `${at}.steps[${s}]`;
      if (step.predict) oneCorrect(step.predict.options, `${sp}.predict.options`);
      Object.keys(step.effect ?? {}).forEach(key => topPart(key, `${sp}.effect.${key}`));
      // A flow runs along an existing joint, in either direction: a scenario can walk back up a support.
      step.flow?.forEach(([from, to], f) => {
        if (!d.joints.some(j => (j.from === from && j.to === to) || (j.from === to && j.to === from))) add(`${sp}.flow[${f}]`, `No joint between ${from} and ${to}`);
      });
      checkCites(step.cites, sp);
    });
    if (run.type === 'load') {
      topPart(run.target, `${at}.target`);
      duplicates(run.bricks.map((b, i) => ({ id: b.part, path: `${at}.bricks[${i}]` })), 'brick');
      run.bricks.forEach((b, i) => {
        topPart(b.part, `${at}.bricks[${i}].part`);
        if (b.part === run.target) add(`${at}.bricks[${i}].part`, 'A brick cannot be the target it holds up');
        checkCites(b.cites, `${at}.bricks[${i}]`);
      });
    }
    if (run.type === 'case') { oneCorrect(run.options, `${at}.options`); checkCites(run.cites, at); }
  });

  const re = d.reassemble;
  duplicates(re.slots.map((s, i) => ({ id: s.id, path: `reassemble.slots[${i}]` })), 'slot');
  // Slots that accept the same set form one group: the group needs one slot per part, and no part may sit in two groups.
  const groups = new Map<string, { parts: string[]; slots: number[] }>();
  re.slots.forEach((slot, i) => {
    const accepts = [slot.accepts].flat();
    accepts.forEach((x, k) => topPart(x, `reassemble.slots[${i}].accepts${Array.isArray(slot.accepts) ? `[${k}]` : ''}`));
    const key = [...new Set(accepts)].sort().join(',');
    const group = groups.get(key) ?? { parts: [...new Set(accepts)], slots: [] };
    group.slots.push(i); groups.set(key, group);
  });
  const placed = new Map<string, string>();
  for (const [key, group] of groups) {
    if (group.slots.length !== group.parts.length) add(`reassemble.slots[${group.slots[0]}]`, `${group.parts.length} interchangeable parts need ${group.parts.length} slots; found ${group.slots.length}`);
    for (const part of group.parts) {
      if (placed.has(part) && placed.get(part) !== key) add(`reassemble.slots[${group.slots[0]}]`, `${part} is accepted by two different groups of slots`);
      placed.set(part, key);
    }
  }
  d.parts.forEach((p, i) => {
    if (!placed.has(p.id)) add(`parts[${i}]`, `No reassembly slot accepts ${p.id}`);
    if (!re.hints[p.id]) add(`reassemble.hints.${p.id}`, `Missing reassembly hint for ${p.id}`);
  });
  Object.keys(re.hints).forEach(key => topPart(key, `reassemble.hints.${key}`));

  const language = detectLanguage(d.question, 1);
  if (language && language !== d.language) add('question', `The question reads as ${language}, but the disassembly language is ${d.language}`);

  const bom = billOfMaterials(d);
  bom.sources.forEach((s, i) => s.forgotten.forEach(x => add(`sources[${i}]`, `Lines ${x.from}–${x.to} of ${s.title} are in no part and not excluded`)));
  return findings;
}

/** Only this boundary accepts unknown disassemblies: schema, source hashes, then the structural checks. */
export async function validateDisassembly(input: unknown): Promise<Disassembly> {
  const parsed = disassemblySchema.safeParse(input);
  if (!parsed.success) throw new DisassemblyError(parsed.error.issues.map(x => ({ path: formatPath(x.path), message: x.message })));
  const d = parsed.data;
  const findings: Finding[] = [];
  for (const [i, s] of d.sources.entries()) {
    if (s.text.includes('\r') || s.sha256 !== await hashText(s.text)) findings.push({ path: `sources[${i}].sha256`, message: `Source text does not match its hash: ${s.id}` });
  }
  findings.push(...checkDisassembly(d));
  if (findings.length) throw new DisassemblyError(findings);
  return d;
}
