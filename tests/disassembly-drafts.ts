import type { ContentDraft, ExpansionDraft, RunsDraft, StructureDraft } from '../src/core/disassembly-generation';
import { allParts, lineRanges, linesOf, type Cite, type Disassembly, type Joint, type Part } from '../src/core/disassembly';
import { hashText } from '../src/core/lesson';
import { importSource, type UserSource } from '../src/core/source';

/** A prepared disassembly's only source, imported as the learner would paste it. */
export async function pastedSource(d: Disassembly): Promise<UserSource> {
  return importSource({ kind: 'paste', title: d.sources[0].title, text: d.sources[0].text });
}

/** What a model would answer in each phase to rebuild `d` over `sourceId`: the reverse of composing a disassembly. */
export function draftsFrom(d: Disassembly, sourceId: string): { structure: StructureDraft; contents: ContentDraft[]; runs: RunsDraft } {
  const cites = (list: Cite[] = []) => list.map(c => ({ ...c, source: sourceId }));
  const joint = (j: Joint) => ({ from: j.from, to: j.to, type: j.type, label: j.label, cites: cites(j.cites) });
  const fit = (p: Part): StructureDraft['parts'][number]['run'] => d.runs.some(r => r.type === 'load' && r.target === p.id) ? 'load' : d.runs.some(r => r.type === 'scenario' && r.steps.some(s => s.effect?.[p.id])) ? 'scenario' : 'none';
  const structure: StructureDraft = {
    title: d.title, whole: { ...d.whole, cites: cites(d.whole.cites) },
    parts: d.parts.map(p => ({
      id: p.id, name: p.name, kind: p.kind, icon: p.icon, role: p.role, cites: cites(p.cites), relevant: p.relevant ?? true, run: fit(p),
      parts: p.parts ? p.parts.map(s => ({ id: s.id, name: s.name, kind: s.kind, icon: s.icon, role: s.role, cites: cites(s.cites) })) : null,
      joints: p.joints ? p.joints.map(joint) : null,
      excluded: (p.excluded ?? []).map(x => ({ source: sourceId, from: x.from, to: x.to, reason: x.reason, note: x.note ?? '' })),
    })),
    joints: d.joints.map(joint),
    excluded: d.bom.excluded.map(x => ({ source: sourceId, from: x.from, to: x.to, reason: x.reason, note: x.note ?? '' })),
  };
  const contents: ContentDraft[] = d.parts.map(p => ({
    points: (p.points ?? []).map(x => ({ text: x.text, mark: x.mark ?? null })),
    metaphor: p.metaphor ?? null, lens: p.lens ?? null, critique: p.critique ?? null,
    ...(p.parts ? { parts: p.parts.map(s => ({ id: s.id, explain: s.explain ?? '', critique: s.critique ?? null })) } : {}),
  }));
  const vars = (v?: Record<string, string>) => Object.entries(v ?? {}).map(([name, value]) => ({ name, value }));
  const runs: RunsDraft = {
    runs: d.runs.map(r => r.type === 'load'
      ? { type: 'load', title: r.title, target: r.target, question: r.question, inference: !!r.inference, bricks: r.bricks.map(b => ({ part: b.part, verdict: b.verdict, explain: b.explain, inference: !!b.inference, cites: cites(b.cites) })) }
      : r.type === 'case'
      ? { type: 'case', title: r.title, scenario: r.scenario, question: r.question, options: r.options, inference: !!r.inference, cites: cites(r.cites) }
      : { type: 'scenario', title: r.title, setup: r.setup, vars: vars(r.vars), inference: !!r.inference, steps: r.steps.map(s => ({
          action: s.action, predict: s.predict ?? null, effects: Object.entries(s.effect ?? {}).map(([part, state]) => ({ part, state })),
          flow: (s.flow ?? []).map(([from, to]) => ({ from, to })), vars: vars(s.vars), explain: s.explain, cites: cites(s.cites),
        })) }),
    reassemble: {
      title: d.reassemble.title, instruction: d.reassemble.instruction,
      slots: d.parts.map(p => ({ part: p.id, label: d.reassemble.slots.find(s => [s.accepts].flat().includes(p.id))!.label })),
      hints: d.parts.map(p => ({ part: p.id, hint: d.reassemble.hints[p.id] })),
    },
  };
  return { structure, contents, runs };
}

/** A completer that answers each phase from the drafts, as a model with a perfect memory of `d` would. */
export function scriptedAnswer(drafts: ReturnType<typeof draftsFrom>, schemaName: string, input: string): string {
  if (schemaName === 'break_the_wall_structure') return JSON.stringify(drafts.structure);
  if (schemaName === 'break_the_wall_runs') return JSON.stringify(drafts.runs);
  const id = /PART TO WRITE: ([a-z0-9-]+)/.exec(input)![1];
  return JSON.stringify(drafts.contents[drafts.structure.parts.findIndex(p => p.id === id)]);
}

/** A prepared fixture relabelled as generated, as the store holds it. */
export function generatedFrom(d: Disassembly, model = 'model-a'): Disassembly {
  const copy = structuredClone(d);
  copy.id = `g-${d.id}`; copy.kind = 'generated'; copy.generation = { provider: 'chatgpt', model, createdAt: '2026-10-26T10:00:00.000Z' };
  return copy;
}

/** A synthetic mechanism `levels` deep: each part on the first branch splits its lines into three, down to parts of 3 lines. */
export async function deepDisassembly(levels = 5): Promise<Disassembly> {
  const size = 3 ** levels;
  const text = Array.from({ length: 3 * size }, (_, i) => `Line ${i + 1} describes one step of the mechanism.`).join('\n');
  const chain = (ids: string[]) => ids.slice(1).map((to, i) => ({ from: ids[i], to, type: 'sends-to' as const, label: 'then' }));
  const level = (prefix: string, from: number, span: number, depth: number): Part[] => [0, 1, 2].map(k => {
    const id = `${prefix}${k + 1}`; const start = from + k * span;
    const part: Part = { id, name: `Piece ${id}`, kind: 'step', icon: 'settings', role: `What ${id} does.`, cites: [{ source: 'deep', from: start, to: start + span - 1 }] };
    if (depth === 0) part.points = [{ text: `${id} starts the work.` }, { text: `${id} hands it on.` }]; else part.explain = `${id} does one third of its parent's work.`;
    if (k === 0 && depth < levels - 1) { part.parts = level(`${id}-`, start, span / 3, depth + 1); part.joints = chain(part.parts.map(p => p.id)); }
    return part;
  });
  const parts = level('p', 1, size, 0);
  return {
    schemaVersion: 1, id: 'deep', revision: 'v1', kind: 'prepared', title: 'Deep mechanism', question: 'How does the work pass from one step to the next?', language: 'en',
    sources: [{ id: 'deep', title: 'deep.txt', origin: 'original-prepared', revision: 'v1', text, sha256: await hashText(text) }],
    whole: { name: 'The mechanism', does: 'Passes the work along.', why: 'Each step needs the one before.', cites: [{ source: 'deep', from: 1, to: 1 }] },
    parts, joints: chain(parts.map(p => p.id)), bom: { excluded: [] },
    runs: [{ type: 'case', id: 'r1', title: 'A new case', scenario: 'Step two stops.', question: 'What happens to step three?', options: [{ text: 'It waits for the work', correct: true, why: 'It needs it.' }, { text: 'It runs on its own', correct: false, why: 'It cannot.' }] }],
    reassemble: { title: 'Rebuild', instruction: 'Put the steps back.', slots: parts.map((p, i) => ({ id: `s${i + 1}`, label: String(i + 1), accepts: p.id })), hints: Object.fromEntries(parts.map(p => [p.id, `Step ${p.id}.`])) },
  };
}

/** What a model would answer to take `partId` apart: its non-blank lines in three runs, joined in a chain. */
export function splitAnswer(d: Disassembly, partId: string): ExpansionDraft {
  const part = allParts(d).find(x => x.part.id === partId)!.part;
  const keys = [...linesOf(d, part.cites)];
  const third = Math.ceil(keys.length / 3);
  const english = d.language === 'en';
  const parts = [0, 1, 2].map(k => ({
    id: `${partId}-x${k + 1}`, name: `${part.name.slice(0, 40)} ${k + 1}`, kind: part.kind, icon: part.icon,
    role: english ? `This is the ${['first', 'second', 'third'][k]} piece of the part.` : `È il ${['primo', 'secondo', 'terzo'][k]} pezzo della parte.`,
    explain: english ? 'It takes one stretch of the lines and explains what it does in the part.' : 'Prende un tratto delle righe e spiega che cosa fa nella parte.',
    critique: null, cites: lineRanges(d, keys.slice(k * third, (k + 1) * third)),
  }));
  return { parts, joints: [{ from: parts[0].id, to: parts[1].id, type: 'leads-to', label: 'then', cites: [] }, { from: parts[1].id, to: parts[2].id, type: 'leads-to', label: 'then', cites: [] }], excluded: [] };
}
