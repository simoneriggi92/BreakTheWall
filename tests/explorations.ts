import { hashText } from '../src/core/lesson';
import type { Exploration } from '../src/core/exploration';

/** An original, hand-written source for the exploration tests: a night bakery, in twenty lines. */
export const BAKERY = [
  '# The night bakery',
  '',
  '## Why bread goes stale',
  'Bread left out loses water and the crumb hardens.',
  '',
  '## The dough',
  'Flour and water are mixed into a dough.',
  'The dough rests overnight in the cold room.',
  '',
  '## The oven',
  'The rested dough is baked at dawn.',
  'The oven thermometer drifts by ten degrees.',
  '',
  '## Selling',
  'The baker sets the loaves on the counter.',
  'Customers pay at the till.',
  '',
  '## Price list',
  'Loaf 2, roll 1.',
  '',
].join('\n');

const c = (from: number, to = from) => ({ from, to });
const pt = (text: string, line: number) => ({ text, cites: [c(line)] });

/** A valid exploration of BAKERY: one nucleus of five parts in two aspects, a premise, an annotation, a reference. */
export async function bakery(): Promise<Exploration> {
  return {
    schemaVersion: 1, id: 'night-bakery', revision: 'r1', kind: 'prepared', title: 'The night bakery', language: 'en',
    whole: 'How a night bakery turns flour into bread on the counter by dawn.',
    source: { id: 'bakery', title: 'The night bakery', origin: 'original-prepared', revision: 'r1', text: BAKERY, sha256: await hashText(BAKERY) },
    start: 'mix',
    aspects: [{ id: 'make', name: 'Making the bread' }, { id: 'sell', name: 'Selling it' }],
    parts: [
      { id: 'staling', kind: 'prerequisite', name: 'Why bread goes stale', role: 'Bread loses water and hardens if it waits.', cites: [c(3, 4)], points: [pt('Water leaves the crumb', 4), pt('The crumb hardens', 4)], members: [] },
      { id: 'mix', kind: 'part', aspect: 'make', name: 'The mix', role: 'Flour and water become a dough.', cites: [c(6, 7)], points: [pt('Flour and water', 7), pt('Mixed into a dough', 7)],
        members: [{ id: 'flour', name: 'Flour', does: 'gives the dough its body', cites: [c(7)] }, { id: 'water', name: 'Water', does: 'binds the flour', cites: [c(7)] }] },
      { id: 'rest', kind: 'part', aspect: 'make', name: 'The rest', role: 'The dough waits overnight in the cold.', cites: [c(8)], points: [pt('Overnight', 8), pt('In the cold room', 8)], members: [] },
      { id: 'bake', kind: 'part', aspect: 'make', name: 'The bake', role: 'The rested dough becomes bread at dawn.', cites: [c(10, 11)], points: [pt('At dawn', 11), pt('Only rested dough', 11)], members: [] },
      { id: 'drift', kind: 'annotation', on: 'bake', name: 'The thermometer drifts', role: 'The oven reads ten degrees off.', cites: [c(12)], points: [], members: [] },
      { id: 'counter', kind: 'part', aspect: 'sell', name: 'The counter', role: 'The loaves wait for customers.', cites: [c(14, 15)], points: [pt('Set by the baker', 15), pt('On the counter', 15)], members: [] },
      { id: 'till', kind: 'part', aspect: 'sell', name: 'The till', role: 'Customers pay for the bread.', cites: [c(16)], points: [pt('Customers pay', 16), pt('At the till', 16)], members: [] },
      { id: 'prices', kind: 'reference', on: 'till', name: 'The price list', role: 'What each loaf costs.', cites: [c(18, 19)], points: [], members: [] },
    ],
    links: [
      { from: 'mix', to: 'rest', class: 'bond', label: 'hands the dough', basis: 'declared', cites: [c(7, 8)] },
      { from: 'rest', to: 'bake', class: 'bond', label: 'gives rested dough', basis: 'declared', cites: [c(8, 11)] },
      { from: 'bake', to: 'counter', class: 'bond', label: 'supplies loaves', basis: 'interpreted', cites: [c(11, 15)] },
      { from: 'counter', to: 'till', class: 'bond', label: 'sends customers', basis: 'interpreted', cites: [c(15, 16)] },
      { from: 'staling', to: 'bake', class: 'prerequisite', label: 'explains the dawn', basis: 'interpreted', cites: [c(4, 11)] },
      { from: 'prices', to: 'till', class: 'reference', label: 'prices for', basis: 'declared', cites: [c(19)] },
    ],
    traces: [{ question: 'How does a loaf reach the counter?', steps: [
      { text: 'It is mixed.', parts: ['mix'], cites: [c(7)] },
      { text: 'It rests.', parts: ['rest'], cites: [c(8)] },
      { text: 'It is baked.', parts: ['bake'], cites: [c(11)] },
      { text: 'It is set out.', parts: ['counter'], cites: [c(15)] },
    ] }],
  };
}

const range = (c: { from: number; to: number }) => [c.from, c.to];
/** An exploration as a model answers the structure request (X7): the shape that passed the gate. */
export function toAnswer(x: Pick<Exploration, 'start' | 'whole' | 'aspects' | 'parts' | 'links' | 'traces'>) {
  return {
    start: x.start, whole: x.whole, aspects: x.aspects,
    parts: x.parts.map(p => ({
      id: p.id, kind: p.kind === 'prerequisite' ? 'prereq' : p.kind, on: p.on ?? null, aspect: p.aspect ?? null, name: p.name, role: p.role, cites: p.cites.map(range),
      points: p.points.map(q => ({ text: q.text, mark: q.mark ?? null, cites: q.cites.map(range) })),
      members: p.members.map(m => ({ id: m.id, name: m.name, does: m.does, cites: m.cites.map(range) })),
    })),
    links: x.links.map(l => ({ from: l.from, to: l.to, cls: l.class, label: l.label, basis: l.basis, cites: l.cites.map(range) })),
    traces: x.traces.map(t => ({ question: t.question, steps: t.steps.map(s => ({ text: s.text, parts: s.parts, cites: s.cites.map(range) })) })),
  };
}
