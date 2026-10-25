import { describe, expect, it } from 'vitest';
import { validateDisassembly } from '../src/core/disassembly';
import { initialDisassemblyState, openLevel, restoreDisassemblyState, type DisassemblyState } from '../src/core/disassembly-state';
import { atlas, mill, story } from './disassemblies';

const d = await validateDisassembly(atlas());
function progressed(): DisassemblyState {
  return {
    ...initialDisassemblyState(d), path: ['image'], selected: 'image-push',
    runs: { 'failed-smoke': { step: 3, choices: { 0: 1, 1: 1, 3: 1 }, tried: [] }, 'tag-shortcut': { step: 0, choices: { 0: 1 }, tried: [] } },
    reassembly: { placements: { s1: 'start', s2: 'image' }, locked: ['s1'] },
    notes: { deploy: 'Rifare su carta: cosa cambia il digest?', 'check-lock': 'npm ci' },
  };
}

describe('disassembly learner state', () => {
  it('round-trips the open path, runs, reassembly and notes', () => {
    const state = progressed();
    const restored = restoreDisassemblyState(d, JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual({ state });
  });
  it('keeps tried bricks and interchangeable slots', async () => {
    const m = await validateDisassembly(mill());
    expect(restoreDisassemblyState(m, { ...initialDisassemblyState(m), runs: { bricks: { step: -1, choices: {}, tried: ['utility', 'region'] } } }).notice).toBeUndefined();
    const s = await validateDisassembly(story());
    const state = { ...initialDisassemblyState(s), reassembly: { placements: { r3: 'bell', r4: 'wall' }, locked: ['r3', 'r4'] } };
    expect(restoreDisassemblyState(s, state).notice).toBeUndefined();
  });
  it('starts fresh without saved progress', () => {
    expect(restoreDisassemblyState(d, null)).toEqual({ state: initialDisassemblyState(d) });
  });
  it('restarts on a changed revision and on an unreadable shape', () => {
    expect(restoreDisassemblyState(d, { ...progressed(), revision: 'v0' }).notice).toBe('revision-changed');
    expect(restoreDisassemblyState(d, { ...progressed(), path: 'image' }).notice).toBe('invalid');
    expect(restoreDisassemblyState(d, { ...progressed(), lessonId: 'atlas-release' }).notice).toBe('invalid');
  });
  it.each<[string, (s: DisassemblyState) => void]>([
    ['a path into a part without sub-parts', s => { s.path = ['start']; s.selected = undefined; }],
    ['a path deeper than the parts', s => { s.path = ['image', 'image-push']; s.selected = undefined; }],
    ['a selection outside the open level', s => { s.selected = 'deploy'; }],
    ['an unknown run', s => { s.runs.missing = { step: 0, choices: {}, tried: [] }; }],
    ['a step past the scenario', s => { s.runs['failed-smoke'].step = 5; }],
    ['a choice on a step without a prediction', s => { s.runs['failed-smoke'].choices[2] = 0; }],
    ['a choice past the options', s => { s.runs['failed-smoke'].choices[0] = 3; }],
    ['bricks on a scenario', s => { s.runs['failed-smoke'].tried = ['start']; }],
    ['a second answer to a case', s => { s.runs['tag-shortcut'].choices[1] = 0; }],
    ['an unknown slot', s => { s.reassembly.placements.s9 = 'smoke'; }],
    ['a part placed twice', s => { s.reassembly.placements.s3 = 'start'; }],
    ['a locked slot holding the wrong part', s => { s.reassembly.locked.push('s2'); }],
    ['a note on an unknown part', s => { s.notes.missing = 'x'; }],
  ])('restarts on %s', (_name, mutate) => {
    const state = progressed(); mutate(state);
    expect(restoreDisassemblyState(d, state)).toEqual({ state: initialDisassemblyState(d), notice: 'references-changed' });
  });
  it('rejects a brick that is not in the load test', async () => {
    const m = await validateDisassembly(mill());
    expect(restoreDisassemblyState(m, { ...initialDisassemblyState(m), runs: { bricks: { step: -1, choices: {}, tried: ['bounds'] } } }).notice).toBe('references-changed');
  });
  it('resolves the open level from the path', () => {
    expect(openLevel(d, [])!.map(p => p.id)).toEqual(d.parts.map(p => p.id));
    expect(openLevel(d, ['image'])!.map(p => p.id)).toEqual(['image-build', 'image-push', 'image-record']);
    expect(openLevel(d, ['smoke'])).toBeUndefined();
  });
});
