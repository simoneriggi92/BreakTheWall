import type { Part } from '../../core/disassembly';

/**
 * The object's functional shapes (P-20261102-guided-reading G10). A shape is presentation only: it comes from fields
 * every part already has, so neither the contract nor generation changes. The argument and story kinds decide first,
 * because a premise holds something up whatever its icon; for mechanism kinds the icon says what the part does.
 */
export const SHAPES = ['beam', 'pillar', 'foundation', 'clamp', 'wedge', 'field', 'aside', 'marker', 'figure',
  'cycle', 'register', 'tape', 'switch', 'comparator', 'gauge', 'conveyor', 'chamber', 'block'] as const;
export type Shape = typeof SHAPES[number];

export const SHAPE_BY_KIND: Partial<Record<Part['kind'], Shape>> = {
  conclusion: 'beam', premise: 'pillar', ground: 'foundation', limit: 'clamp', objection: 'wedge', consequence: 'field',
  rejected: 'aside', event: 'marker', actor: 'figure',
};

export const SHAPE_BY_ICON: Record<Part['icon'], Shape> = {
  ruler: 'clamp', 'triangle-alert': 'wedge', map: 'field', sprout: 'field', ban: 'aside', flag: 'marker',
  'user-round': 'figure', users: 'figure', 'message-circle': 'figure',
  repeat: 'cycle', 'rotate-ccw': 'cycle', play: 'cycle',
  timer: 'register', database: 'register', fingerprint: 'register', 'key-round': 'register', lock: 'register', 'clipboard-check': 'register',
  'file-text': 'tape', 'list-checks': 'tape', 'book-open': 'tape',
  settings: 'switch', plug: 'switch',
  filter: 'comparator', scale: 'comparator', search: 'comparator', 'shield-check': 'comparator',
  gauge: 'gauge',
  send: 'conveyor', download: 'conveyor', rocket: 'conveyor', 'git-branch': 'conveyor',
  cpu: 'chamber', hammer: 'chamber', code: 'chamber', package: 'chamber', layers: 'chamber',
};

export const shapeOf = (part: Pick<Part, 'kind' | 'icon'>): Shape => SHAPE_BY_KIND[part.kind] ?? SHAPE_BY_ICON[part.icon] ?? 'block';
