import { describe, expect, it } from 'vitest';
import { validateDisassembly, type Finding } from '../src/core/disassembly';
import { checkExploration, ExplorationError, pointsInside, validateExploration, type Exploration } from '../src/core/exploration';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { bakery } from './explorations';

async function findings(input: unknown): Promise<Finding[]> {
  try { await validateExploration(input); return []; }
  catch (error) { if (error instanceof ExplorationError) return error.findings; throw error; }
}
const part = (x: Exploration, id: string) => x.parts.find(p => p.id === id)!;
const at = (fs: Finding[]) => fs.map(f => f.path);

describe('the exploration contract (X2)', () => {
  it('accepts a valid hand-written exploration, with and without aspects', async () => {
    expect(await findings(await bakery())).toEqual([]);
    const flat = await bakery(); flat.aspects = []; flat.parts.forEach(p => { delete p.aspect; });
    expect(await findings(flat)).toEqual([]);
  });

  it('finds duplicate part ids and duplicate member ids', async () => {
    const x = await bakery(); x.parts.push({ ...part(x, 'rest') });
    part(x, 'mix').members.push({ ...part(x, 'mix').members[0] });
    expect(at(checkExploration(x))).toEqual(expect.arrayContaining(['parts[8].id', 'parts[1].members[2].id']));
  });

  it('finds a cite out of range, on a part, a point, a member, a link and a trace step', async () => {
    const x = await bakery(), far = { from: 30, to: 31 };
    part(x, 'rest').cites = [far]; part(x, 'bake').points[0].cites = [far]; part(x, 'mix').members[0].cites = [far];
    x.links[0].cites = [far]; x.traces[0].steps[0].cites = [far];
    expect(at(checkExploration(x))).toEqual(expect.arrayContaining([
      'parts[2].cites[0]', 'parts[3].points[0].cites[0]', 'parts[1].members[0].cites[0]', 'links[0].cites[0]', 'traces[0].steps[0].cites[0]']));
    const y = await bakery(); part(y, 'rest').cites = [{ from: 9, to: 8 }];
    expect(checkExploration(y)).toEqual([{ path: 'parts[2].cites[0]', message: 'The range starts after it ends (9-8)' }]);
  });

  it('wants every annotation on an existing part', async () => {
    const x = await bakery(); delete part(x, 'drift').on;
    expect(at(checkExploration(x))).toEqual(['parts[4].on']);
    const y = await bakery(); part(y, 'drift').on = 'oven';
    expect(checkExploration(y)).toEqual([{ path: 'parts[4].on', message: 'Unknown part: oven' }]);
  });

  it('allows bonds only between parts of kind "part"', async () => {
    const x = await bakery(); x.links.push({ from: 'prices', to: 'till', class: 'bond', label: 'prices', basis: 'declared', cites: [{ from: 19, to: 19 }] });
    expect(checkExploration(x)).toEqual([{ path: 'links[6].class', message: 'A bond joins two parts of kind "part"; prices is a reference, till a part' }]);
  });

  it('starts a prerequisite link only from a prerequisite', async () => {
    const x = await bakery(); x.links[4].from = 'mix';
    expect(at(checkExploration(x))).toEqual(['links[4].class']);
  });

  it('walks traces through real parts, never through a member', async () => {
    const x = await bakery(); x.traces[0].steps[0].parts = ['flour']; x.traces[0].steps[1].parts = ['oven'];
    expect(checkExploration(x)).toEqual([
      { path: 'traces[0].steps[0].parts[0]', message: 'flour is a member, not a part: a trace walks parts' },
      { path: 'traces[0].steps[1].parts[0]', message: 'Unknown part: oven' },
    ]);
  });

  it('wants the start to be a part of kind "part"', async () => {
    const x = await bakery(); x.start = 'staling';
    expect(at(checkExploration(x))).toEqual(['start']);
  });

  it('wants 2-4 points on parts and prerequisites', async () => {
    const x = await bakery(); part(x, 'rest').points = part(x, 'rest').points.slice(0, 1);
    expect(checkExploration(x)).toEqual([{ path: 'parts[2].points', message: 'A part has 2-4 points; it has 1' }]);
    const y = await bakery(); part(y, 'rest').points = Array.from({ length: 5 }, () => part(y, 'rest').points[0]);
    expect(at(await findings(y))).toEqual(['parts[2].points']);
  });

  it('keeps members on parts and prerequisites only', async () => {
    const x = await bakery(); part(x, 'drift').members = [{ id: 'gauge', name: 'Gauge', does: 'reads the heat', cites: [{ from: 12, to: 12 }] }];
    expect(at(checkExploration(x))).toEqual(['parts[4].members']);
  });

  it('wants each aspect named, and none or two to four of them', async () => {
    const x = await bakery(); part(x, 'till').aspect = 'deliver';
    expect(checkExploration(x)).toEqual([{ path: 'parts[6].aspect', message: 'Unknown aspect: deliver' }]);
    const y = await bakery(); y.aspects = y.aspects.slice(0, 1); y.parts.forEach(p => { if (p.aspect === 'sell') p.aspect = 'make'; });
    expect(at(checkExploration(y))).toEqual(['aspects']);
  });

  it('measures points outside their part without calling them errors', async () => {
    const x = await bakery(); part(x, 'rest').points[0].cites = [{ from: 11, to: 11 }];
    expect(checkExploration(x)).toEqual([]);
    expect(pointsInside(x)).toEqual({ points: 12, inside: 11 });
  });

  it('checks the source against its hash', async () => {
    const x = await bakery(); x.source.text = x.source.text.replace('dawn', 'noon');
    expect(at(await findings(x))).toContain('source.sha256');
  });

  it('rejects a disassembly, and a disassembly validator rejects an exploration', async () => {
    const [d] = await loadPreparedDisassemblies();
    expect((await findings(d)).length).toBeGreaterThan(0);
    await expect(validateDisassembly(await bakery())).rejects.toThrow();
  });
});
