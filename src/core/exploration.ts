import { z } from 'zod';
import { disassemblySourceSchema, formatPath, type Finding } from './disassembly';
import { hashText, idSchema } from './lesson';

/**
 * The structure of one source, as the app explores it (plan P-20261105-exploration X2). Unlike a disassembly it has no
 * runs, no reassembly and no fixed number of parts: the source decides how it holds together, and the app computes the
 * shape (nuclei, layers, levels) from the parts and their cited relations.
 */
export const EXPLORATION_LIMITS = {
  name: 48, role: 110, point: 130, label: 28, does: 90, whole: 160, question: 160, stepText: 200,
  parts: 40, minPoints: 2, points: 4, members: 14, aspects: 4, traces: 3, steps: 8,
} as const;

/** part: does or means something; prerequisite: to understand first; annotation: a limit or finding on one part;
 * reference: material to consult; procedure: a how-to apart from the main subject. */
export const EXPLORATION_PART_KINDS = ['part', 'prerequisite', 'annotation', 'reference', 'procedure'] as const;
/** bond: how the thing works; prerequisite: what must come first; reference: points to; group: belongs to. */
export const LINK_CLASSES = ['bond', 'prerequisite', 'reference', 'group'] as const;
/** declared: the cited lines state the relation in words; interpreted: the reader reconstructs it. */
export const LINK_BASES = ['declared', 'interpreted'] as const;

const id = idSchema;
const L = EXPLORATION_LIMITS;
const line = z.number().int().positive();
/** One line range of the exploration's single source. No quote is stored: the lines are read from the source. */
const citeSchema = z.strictObject({ from: line, to: line });
const cites = z.array(citeSchema).min(1).max(20);
const pointSchema = z.strictObject({ text: z.string().min(1).max(L.point), mark: z.enum(['step', 'keeps', 'caveat']).optional(), cites });
/** A component the source names, kept inside its role and already extracted, so the view shows it without waiting. */
const memberSchema = z.strictObject({ id, name: z.string().min(1).max(L.name), does: z.string().min(1).max(L.does), cites });
const explorationPartSchema = z.strictObject({
  id, kind: z.enum(EXPLORATION_PART_KINDS),
  /** The part an annotation (or a reference about one part) is about. */
  on: id.optional(),
  /** The aspect a role belongs to, one of the exploration's aspects. */
  aspect: id.optional(),
  name: z.string().min(1).max(L.name), role: z.string().min(1).max(L.role), cites,
  points: z.array(pointSchema).max(L.points),
  members: z.array(memberSchema).max(L.members),
});
const linkSchema = z.strictObject({
  from: id, to: id, class: z.enum(LINK_CLASSES), label: z.string().min(1).max(L.label), basis: z.enum(LINK_BASES), cites,
});
const traceSchema = z.strictObject({
  question: z.string().min(1).max(L.question),
  steps: z.array(z.strictObject({ text: z.string().min(1).max(L.stepText), parts: z.array(id).min(1).max(8), cites: z.array(citeSchema).max(20) })).min(1).max(L.steps),
});

export const explorationSchema = z.strictObject({
  schemaVersion: z.literal(1), id, revision: id, kind: z.enum(['prepared', 'generated']),
  /** As for disassemblies; `assistant` is the learner's AI assistant writing through the MCP server. */
  generation: z.strictObject({
    provider: z.enum(['chatgpt', 'local', 'assistant']), runtime: z.enum(['ollama', 'lmstudio', 'llamacpp', 'openai']).optional(),
    model: z.string().min(1).max(200), createdAt: z.iso.datetime(),
  }).optional(),
  title: z.string().min(1).max(200), language: z.enum(['it', 'en']),
  /** One sentence on what the source is about as a whole. */
  whole: z.string().min(1).max(L.whole),
  source: disassemblySourceSchema,
  /** The part the logic starts from. */
  start: id,
  /** The large concerns of the source: none, or two to four. */
  aspects: z.array(z.strictObject({ id, name: z.string().min(1).max(L.name) })).max(L.aspects),
  parts: z.array(explorationPartSchema).min(1).max(L.parts),
  links: z.array(linkSchema).max(120),
  /** The questions the source itself walks. */
  traces: z.array(traceSchema).max(L.traces),
});

export type Exploration = z.infer<typeof explorationSchema>;
export type ExplorationPart = z.infer<typeof explorationPartSchema>;
export type ExplorationLink = z.infer<typeof linkSchema>;
export type ExplorationCite = z.infer<typeof citeSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Trace = z.infer<typeof traceSchema>;

export class ExplorationError extends Error {
  constructor(public readonly findings: Finding[]) { super(findings.map(x => `${x.path}: ${x.message}`).join('\n')); this.name = 'ExplorationError'; }
}

/** The first line a part cites: source order for every rule that needs one. */
export const firstLine = (p: { cites: ExplorationCite[] }) => Math.min(...p.cites.map(c => c.from));

/**
 * The structural rules between parts, links and traces, each finding at its exact path, for one repair request.
 * Points outside their part are a measure (pointsInside), not an error.
 */
export function checkExploration(x: Exploration): Finding[] {
  const out: Finding[] = [], say = (path: string, message: string) => out.push({ path, message });
  const lines = x.source.text.split('\n').length;
  const inRange = (cs: ExplorationCite[], path: string) => cs.forEach((c, i) => {
    if (c.from > c.to) say(`${path}[${i}]`, `The range starts after it ends (${c.from}-${c.to})`);
    else if (c.to > lines) say(`${path}[${i}]`, `Line ${c.to} is past the end of the source (${lines} lines)`);
  });
  const parts = new Map<string, ExplorationPart>();
  x.parts.forEach((p, i) => { if (parts.has(p.id)) say(`parts[${i}].id`, `Duplicate part id: ${p.id}`); else parts.set(p.id, p); });
  const memberIds = new Set(x.parts.flatMap(p => p.members.map(m => m.id)));
  const aspects = new Set<string>();
  x.aspects.forEach((a, i) => { if (aspects.has(a.id)) say(`aspects[${i}].id`, `Duplicate aspect id: ${a.id}`); aspects.add(a.id); });
  if (x.aspects.length === 1) say('aspects', 'Name no aspect, or two to four: one aspect is the whole source');

  x.parts.forEach((p, i) => {
    const at = `parts[${i}]`;
    inRange(p.cites, `${at}.cites`);
    const wantsPoints = p.kind === 'part' || p.kind === 'prerequisite';
    if (wantsPoints && p.points.length < L.minPoints) say(`${at}.points`, `A ${p.kind} has ${L.minPoints}-${L.points} points; it has ${p.points.length}`);
    p.points.forEach((q, j) => inRange(q.cites, `${at}.points[${j}].cites`));
    if (p.members.length && !wantsPoints) say(`${at}.members`, `Only parts and prerequisites have members; this is a ${p.kind}`);
    const seen = new Set<string>();
    p.members.forEach((m, j) => {
      if (seen.has(m.id)) say(`${at}.members[${j}].id`, `Duplicate member id in ${p.id}: ${m.id}`);
      seen.add(m.id); inRange(m.cites, `${at}.members[${j}].cites`);
    });
    if (p.kind === 'annotation' && !p.on) say(`${at}.on`, 'An annotation is about one part: name it in "on"');
    if (p.on !== undefined) {
      const target = parts.get(p.on) ?? x.parts.find(q => q.id === p.on);
      if (!target) say(`${at}.on`, `Unknown part: ${p.on}`);
      else if (target.kind === 'annotation') say(`${at}.on`, `${p.on} is an annotation; "on" names the part it is about`);
    }
    if (p.aspect !== undefined && !aspects.has(p.aspect)) say(`${at}.aspect`, `Unknown aspect: ${p.aspect}`);
  });

  x.links.forEach((l, i) => {
    const at = `links[${i}]`, a = x.parts.find(p => p.id === l.from), b = x.parts.find(p => p.id === l.to);
    inRange(l.cites, `${at}.cites`);
    if (!a) say(`${at}.from`, memberIds.has(l.from) ? `${l.from} is a member, not a part: link its part` : `Unknown part: ${l.from}`);
    if (!b) say(`${at}.to`, memberIds.has(l.to) ? `${l.to} is a member, not a part: link its part` : `Unknown part: ${l.to}`);
    if (!a || !b) return;
    if (l.from === l.to) say(at, `A link joins two parts; this one joins ${l.from} to itself`);
    if (l.class === 'bond' && (a.kind !== 'part' || b.kind !== 'part')) say(`${at}.class`, `A bond joins two parts of kind "part"; ${l.from} is a ${a.kind}, ${l.to} a ${b.kind}`);
    if (l.class === 'prerequisite' && a.kind !== 'prerequisite') say(`${at}.class`, `A prerequisite link starts from a prerequisite; ${l.from} is a ${a.kind}`);
  });

  x.traces.forEach((t, i) => t.steps.forEach((s, j) => {
    const at = `traces[${i}].steps[${j}]`;
    s.parts.forEach((pid, k) => {
      if (!parts.has(pid)) say(`${at}.parts[${k}]`, memberIds.has(pid) ? `${pid} is a member, not a part: a trace walks parts` : `Unknown part: ${pid}`);
    });
    inRange(s.cites, `${at}.cites`);
  }));

  const start = parts.get(x.start);
  if (!start) say('start', `Unknown part: ${x.start}`);
  else if (start.kind !== 'part') say('start', `The start is a part of kind "part"; ${x.start} is a ${start.kind}`);
  return out;
}

/** How many points rest on lines their own part cites: a measure of the extraction, shown in "how it was read". */
export function pointsInside(x: Pick<Exploration, 'parts'>): { points: number; inside: number } {
  let points = 0, inside = 0;
  for (const p of x.parts) for (const q of p.points) {
    points++;
    if (q.cites.every(c => p.cites.some(d => d.from <= c.from && c.to <= d.to))) inside++;
  }
  return { points, inside };
}

/** The only boundary that accepts an unknown exploration: schema, source hash, then the structural rules. */
export async function validateExploration(input: unknown): Promise<Exploration> {
  const parsed = explorationSchema.safeParse(input);
  if (!parsed.success) throw new ExplorationError(parsed.error.issues.map(x => ({ path: formatPath(x.path), message: x.message })));
  const x = parsed.data, findings: Finding[] = [];
  if (x.source.text.includes('\r') || x.source.sha256 !== await hashText(x.source.text)) findings.push({ path: 'source.sha256', message: `Source text does not match its hash: ${x.source.id}` });
  findings.push(...checkExploration(x));
  if (findings.length) throw new ExplorationError(findings);
  return x;
}
