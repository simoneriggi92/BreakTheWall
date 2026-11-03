import { describe, expect, it } from 'vitest';
import { allParts, PART_KINDS, partIconSchema, validateDisassembly } from '../src/core/disassembly';
import { SHAPE_BY_ICON, SHAPE_BY_KIND, SHAPES, shapeOf } from '../src/renderer/disassembly/shapes';
import { fixture, PUBLIC_FIXTURES } from './disassemblies';

// P-20261102-guided-reading G10: every part gets a functional shape from fields it already has.
describe('the object\'s shape table', () => {
  it('gives every icon a shape, and every argument and story kind its own', () => {
    for (const icon of partIconSchema.options) expect(SHAPES).toContain(SHAPE_BY_ICON[icon]);
    expect(Object.keys(SHAPE_BY_ICON).sort()).toEqual([...partIconSchema.options].sort());
    // The mechanism kinds say nothing about form: their icon decides.
    expect(PART_KINDS.filter(k => !SHAPE_BY_KIND[k])).toEqual(['step', 'component', 'artifact']);
    for (const kind of PART_KINDS) for (const icon of partIconSchema.options) expect(shapeOf({ kind, icon })).not.toBe('block');
  });
  it('lets the kind decide first, so a premise holds up whatever its icon', () => {
    expect(shapeOf({ kind: 'premise', icon: 'repeat' })).toBe('pillar');
    expect(shapeOf({ kind: 'step', icon: 'repeat' })).toBe('cycle');
  });
  it.each(PUBLIC_FIXTURES)('shapes every part of %s', async path => {
    const d = await validateDisassembly(fixture(path));
    for (const { part } of allParts(d)) expect(SHAPES).toContain(shapeOf(part));
  });
});
