import { describe, expect, it } from 'vitest';
import { atlasLayout, inside, overlaps } from '../src/core/atlas';
import { BENCH, benchLayout, flowLevels, openedLayout, projectedRatio } from '../src/core/bench';
import type { Disassembly } from '../src/core/disassembly';
import { faceOf, outlineOf } from '../src/core/faces';
import { BENCH_BY_ICON, chooseRepresentation } from '../src/core/representation';
import { atlas, fixture, mill, PUBLIC_FIXTURES, story } from './disassemblies';

const importer = (): Disassembly => fixture('src/fixtures/disassemblies/importer-signals.json');
const src = (text: string) => ({ sources: [{ id: 's', text }] });
const cite = (from: number, to: number) => [{ source: 's', from, to }];

describe('the metaphor test (L1)', () => {
  it('draws the importer and the release chain as an object: every part has a component, every joint a connection', () => {
    for (const d of [importer(), atlas() as Disassembly]) {
      const c = chooseRepresentation(d);
      expect(c.view).toBe('object');
      expect(c.failures).toBe(0);
      expect(c.parts.map(x => x.part)).toEqual(d.parts.map(p => p.id));
      expect(c.joints.map(x => x.joint)).toEqual(d.joints.map((_, i) => i));
    }
    const c = chooseRepresentation(importer());
    expect(c.parts.find(x => x.part === 'round')).toEqual({ part: 'round', as: 'component', component: 'round-track' });
    expect(c.joints.every(j => j.ok)).toBe(true);
  });
  it('draws Mill as an atlas: the bench has no connection for an argument, and its limit is an annotation', () => {
    const d = mill(), c = chooseRepresentation(d);
    expect(c.view).toBe('atlas');
    expect(c.parts.find(x => x.part === 'bounds')).toEqual({ part: 'bounds', as: 'annotation' });
    // the limit's own joint is not checked: annotations need no connection
    expect(c.joints.some(j => d.joints[j.joint].from === 'bounds')).toBe(false);
    expect(c.joints.filter(j => !j.ok).map(j => d.joints[j.joint].type).sort()).toEqual(['attacks', 'supports', 'supports', 'supports']);
  });
  it('sends a source to the atlas when one part has no component, and names that part', () => {
    const d = importer();
    d.parts[0].icon = 'message-circle';
    expect(BENCH_BY_ICON['message-circle']).toBeUndefined();
    const c = chooseRepresentation(d);
    expect(c.view).toBe('atlas');
    expect(c.failures).toBe(1);
    expect(c.parts[0]).toEqual({ part: d.parts[0].id, as: 'none', failure: 'no-component' });
  });
  it('is deterministic on every public fixture', () => {
    for (const f of PUBLIC_FIXTURES) expect(chooseRepresentation(fixture(f))).toEqual(chooseRepresentation(fixture(f)));
    expect(chooseRepresentation(story()).view).toBe('atlas');
  });
});

describe('faces from a part’s own lines (L2)', () => {
  it('gives the importer’s round no face of its own, but its numbered code steps when it has them', () => {
    const text = ['### Round', '```', ' 1  Stamp the heartbeat    ← first', ' 2  Read the switch', ' 3  Fetch', '```'].join('\n');
    const face = faceOf(src(text), { icon: 'repeat', cites: cite(1, 6) })!;
    expect(face.face).toBe('wheel');
    expect(face.items.map(i => i.label)).toEqual(['1. Stamp the heartbeat', '2. Read the switch', '3. Fetch']);
  });
  it('gives a part citing only prose no face', () => {
    const text = 'The round asks each feed for records.\nIt hands every record to a worker.';
    expect(faceOf(src(text), { icon: 'file-text', cites: cite(1, 2) })).toBeUndefined();
    for (const p of mill().parts) expect(faceOf(mill(), p)).toBeUndefined();
  });
  it('ignores headings inside code fences', () => {
    const text = ['### One', 'x', '```', '### Not a heading', '```', '### Two', 'y'].join('\n');
    expect(outlineOf(src(text), { cites: cite(1, 7) }).heads.map(h => h.label)).toEqual(['One', 'Two']);
  });
  it('joins list continuations, names an item by its bold phrase, and keeps the ⚠ mark', () => {
    const text = ['- **Liveness of the loop**: did it go round?', '  It beats before any skip.', '- ⚠ a short one', 'after'].join('\n');
    const list = outlineOf(src(text), { cites: cite(1, 4) }).list;
    expect(list.map(i => i.label)).toEqual(['Liveness of the loop', '⚠ a short one']);
    expect(list[0].text).toBe('Liveness of the loop: did it go round? It beats before any skip.');
    expect(list[0].to).toBe(2);
    expect(list[1].warn).toBe(true);
  });
  it('reads table rows under their section, with header and cells', () => {
    const text = ['### Registers', '| Name | Value |', '|---|---|', '| `Switch` | bool |', '| Cursor (time) | UpdatedAt |'].join('\n');
    const face = faceOf(src(text), { icon: 'database', cites: cite(1, 5) })!;
    expect(face.face).toBe('drawers');
    expect(face.items.map(i => i.label)).toEqual(['Switch', 'Cursor']);
    expect(face.items[1].cells).toEqual(['Cursor (time)', 'UpdatedAt']);
  });
});

describe('the bench layout (L3)', () => {
  const footprintsOverlap = (a: { x: number; y: number; w: number; d: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
  it('places every module, with no two footprints overlapping, on every public fixture', () => {
    for (const f of PUBLIC_FIXTURES) {
      const d = fixture(f), { modules } = benchLayout(d.parts, d.joints), all = Object.values(modules);
      expect(Object.keys(modules).sort()).toEqual(d.parts.map((p: { id: string }) => p.id).sort());
      for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) expect(footprintsOverlap(all[i], all[k])).toBe(false);
    }
  });
  it('puts the importer’s round before its registers and the night board after them', () => {
    const d = importer(), L = flowLevels(d.parts.map(p => p.id), d.joints);
    expect(L.pause).toBeLessThan(L.round);
    for (const r of ['heartbeat', 'finished', 'outcomes']) { expect(L.round).toBeLessThan(L[r]); expect(L[r]).toBeLessThan(L.board); }
  });
  it('folds a long flow into a further band, so no public fixture’s bench is much wider than it is tall on screen', () => {
    for (const f of PUBLIC_FIXTURES) { const d = fixture(f); expect(projectedRatio(benchLayout(d.parts, d.joints).area)).toBeLessThanOrEqual(2.6); }
    const chain = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` })), links = chain.slice(1).map((p, i) => ({ from: `p${i}`, to: p.id, type: 'sends-to' as const }));
    const { modules } = benchLayout(chain, links);
    expect(new Set(Object.values(modules).map(m => m.y)).size).toBe(3);   // 7 columns in bands of 3
    expect(modules.p0.y).toBeGreaterThan(modules.p3.y);                    // the first band stands at the back
  });
  it('lays an opened level in one row up to five parts, and in two rows above, the back row raised', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));
    expect(new Set(openedLayout(ids(5), [], () => BENCH.minW).map(p => p.y)).size).toBe(1);
    const six = openedLayout(ids(6), [], () => BENCH.minW);
    expect(six.filter(p => p.z > 0)).toHaveLength(3);
    expect(six.filter(p => p.z > 0).every(p => p.y > 0)).toBe(true);
  });
});

describe('the atlas layout (L4)', () => {
  it('puts Mill’s claim at the centre, its supports in front, what follows behind, the limit left, the objection right, the rejected part apart', () => {
    const R = Object.fromEntries(atlasLayout(mill().parts, mill().joints).map(r => [r.id, r]));
    expect([R.claim.cx, R.claim.cy]).toEqual([0, 0]);
    expect(R.utility.cy).toBeLessThan(0); expect(R.sovereignty.cy).toBeLessThan(0);
    expect(R.region.cy).toBeGreaterThan(0);
    expect(R.bounds.cx).toBeLessThan(0);
    expect(R.objection.cx).toBeGreaterThan(0);
    expect(R['abstract-right'].apart).toBe(true);
    expect(Object.values(R).filter(r => r.apart)).toHaveLength(1);
  });
  it('lets no two regions overlap, and keeps every sub-region inside its region, on every public fixture', () => {
    for (const f of PUBLIC_FIXTURES) {
      const d = fixture(f), regions = atlasLayout(d.parts, d.joints);
      expect(regions.map(r => r.id)).toEqual(d.parts.map((p: { id: string }) => p.id));
      for (let i = 0; i < regions.length; i++) for (let k = i + 1; k < regions.length; k++) expect(overlaps(regions[i], regions[k])).toBe(false);
      for (const r of regions) for (const kid of r.kids) expect(inside(kid, r)).toBe(true);
    }
    const R = atlasLayout(mill().parts, mill().joints);
    expect(R.find(r => r.id === 'bounds')!.kids).toHaveLength(3);
    expect(R.find(r => r.id === 'region')!.kids).toHaveLength(3);
  });
});
