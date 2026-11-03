import type { Disassembly, Joint, JointType, Part } from './disassembly';

/**
 * The metaphor test (P-20261103-lab-mode L1): is there an object that represents a source's parts and documented
 * joints without inventing a link, a cause or a dependency? Every part needs a component that does what the part
 * does, and every joint a physical connection of its type. Context, limits and clarifications need no component:
 * they are annotations linked to the source. One failure, and the source is drawn as an atlas.
 *
 * The library holds one metaphor, the bench, for mechanisms. The test compares the metaphors it has: an atlas means
 * that none of them fits without forcing, not that no object could. Ids are stable; the renderer translates them.
 */
export const BENCH_COMPONENTS = ['round-track', 'start-button', 'relay', 'clock-register', 'drawer-archive', 'register', 'lock', 'checklist',
  'tape-printer', 'binder', 'key-switch', 'socket', 'control-panel', 'conveyor', 'launch-ramp', 'switch-point', 'sieve', 'lens', 'scale',
  'comparator', 'machine', 'crate', 'layer-press'] as const;
export type BenchComponent = typeof BENCH_COMPONENTS[number];

/** A part maps by its icon, which says what it does. Icons with no entry have no component on the bench. */
export const BENCH_BY_ICON: Partial<Record<Part['icon'], BenchComponent>> = {
  repeat: 'round-track', play: 'start-button', 'rotate-ccw': 'relay', timer: 'clock-register', flag: 'clock-register',
  database: 'drawer-archive', fingerprint: 'register', 'key-round': 'register', lock: 'lock', 'clipboard-check': 'checklist',
  'file-text': 'tape-printer', 'list-checks': 'tape-printer', 'book-open': 'binder', settings: 'key-switch', plug: 'socket',
  gauge: 'control-panel', send: 'conveyor', download: 'conveyor', rocket: 'launch-ramp', 'git-branch': 'switch-point',
  filter: 'sieve', search: 'lens', scale: 'scale', 'shield-check': 'comparator', cpu: 'machine', hammer: 'machine', code: 'machine',
  package: 'crate', layers: 'layer-press',
};

export const BENCH_CONNECTIONS = { 'sends-to': 'cable', causes: 'command', 'depends-on': 'read-cable' } as const satisfies Partial<Record<JointType, string>>;
export type BenchConnection = typeof BENCH_CONNECTIONS[keyof typeof BENCH_CONNECTIONS];

/** Limits and clarifications are annotations: a source can qualify a part without a new component. */
export const ANNOTATION_KINDS: ReadonlySet<Part['kind']> = new Set(['limit']);

export type PartFit =
  | { part: string; as: 'component'; component: BenchComponent }
  | { part: string; as: 'annotation' }
  | { part: string; as: 'none'; failure: 'no-component' };
export type JointFit =
  | { joint: number; ok: true; connection: BenchConnection }
  | { joint: number; ok: false; failure: 'no-connection' };
export interface RepresentationChoice {
  view: 'object' | 'atlas';
  metaphor: 'bench';
  /** One row per top-level part, in order. */
  parts: PartFit[];
  /** One row per top-level joint between parts that are not annotations; `joint` is its index in `d.joints`. */
  joints: JointFit[];
  failures: number;
}

export function chooseRepresentation(d: Pick<Disassembly, 'parts' | 'joints'>): RepresentationChoice {
  const parts: PartFit[] = d.parts.map(p => {
    if (ANNOTATION_KINDS.has(p.kind)) return { part: p.id, as: 'annotation' };
    const component = BENCH_BY_ICON[p.icon];
    return component ? { part: p.id, as: 'component', component } : { part: p.id, as: 'none', failure: 'no-component' };
  });
  const annotated = new Set(parts.filter(x => x.as === 'annotation').map(x => x.part));
  const joints: JointFit[] = d.joints.flatMap((j: Joint, joint): JointFit[] => {
    if (annotated.has(j.from) || annotated.has(j.to)) return [];
    const connection = (BENCH_CONNECTIONS as Partial<Record<JointType, BenchConnection>>)[j.type];
    return [connection ? { joint, ok: true, connection } : { joint, ok: false, failure: 'no-connection' }];
  });
  const failures = parts.filter(x => x.as === 'none').length + joints.filter(x => !x.ok).length;
  return { view: failures ? 'atlas' : 'object', metaphor: 'bench', parts, joints, failures };
}
