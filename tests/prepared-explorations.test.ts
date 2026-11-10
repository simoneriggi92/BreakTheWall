import { describe, expect, it } from 'vitest';
import { pointsInside, type Exploration } from '../src/core/exploration';
import { aspectLevel, levelShape, premiseOf, subLevel } from '../src/core/exploration-levels';
import { shapeOf } from '../src/core/exploration-shape';
import { readingReport } from '../src/core/reading-report';
import { sourceIndex } from '../src/core/source-index';
import { loadPreparedDisassemblies } from '../src/fixtures/disassemblies';
import { loadPreparedExplorations } from '../src/fixtures/explorations';

/** What the detector, the levels and the report make of one exploration: a change in any of them shows here. */
function recorded(x: Exploration) {
  const shape = shapeOf(x), index = sourceIndex(x.source.text), report = readingReport(x, shape, index), level = aspectLevel(x);
  return {
    nuclei: shape.nuclei.map(n => n.ids.length), depth: shape.nuclei[0]?.depth, loose: shape.loose.length, entry: shape.entry, trace: shape.trace ?? null,
    aspects: x.aspects.map(a => a.id), premise: premiseOf(x, index)?.id ?? null,
    aspectLevel: level && { blocks: level.parts.filter(p => p.kind === 'part').map(p => p.id), joints: level.links.filter(l => l.class === 'bond').length, entry: levelShape(level, 'aspects').entry },
    subLevels: x.aspects.map(a => subLevel(x, a.id).parts.filter(p => p.kind === 'part').length),
    coverage: `${report.inMap}/${report.total}`, leftOut: report.leftOut, interpreted: report.basis.interpreted, points: pointsInside(x),
  };
}

const EXPECTED: Record<string, ReturnType<typeof recorded>> = {
  'press-enter-map': {
    // Claude's run (X36): three aspects, the pipeline framing as the premise, one trace that walks the whole navigation
    nuclei: [11], depth: 4, loose: 0, entry: 'trace', trace: 0, aspects: ['reach', 'exchange', 'render'], premise: 'overview',
    aspectLevel: { blocks: ['reach', 'exchange', 'render'], joints: 6, entry: 'trace' }, subLevels: [4, 3, 4],
    coverage: '67/67', leftOut: [], interpreted: 4, points: { points: 38, inside: 38 },
  },
  'importer-signals-map': {
    // the winter night is the trace that walks every role, so it is the way in
    nuclei: [7], depth: 3, loose: 0, entry: 'trace', trace: 2, aspects: ['signals', 'reading'], premise: 'silence',
    aspectLevel: { blocks: ['signals', 'reading'], joints: 1, entry: 'trace' }, subLevels: [5, 2],
    coverage: '153/179', leftOut: [], interpreted: 1, points: { points: 22, inside: 22 },
  },
  'mill-harm-map': {
    nuclei: [5], depth: 4, loose: 0, entry: 'layers', trace: null, aspects: [], premise: null, aspectLevel: null, subLevels: [],
    coverage: '123/124', leftOut: [], interpreted: 0, points: { points: 13, inside: 13 },
  },
  'atlas-release-map': {
    nuclei: [6], depth: 6, loose: 0, entry: 'trace', trace: 0, aspects: ['chain', 'operator'], premise: 'identity',
    aspectLevel: { blocks: ['operator', 'chain'], joints: 2, entry: 'trace' }, subLevels: [3, 3],
    coverage: '101/112', leftOut: [], interpreted: 2, points: { points: 21, inside: 21 },
  },
};

describe('the prepared explorations (X10)', () => {
  it('are seven valid files: Claude\'s English one first (X36), then six in Italian and English over the prepared disassemblies\' public sources', async () => {
    const all = await loadPreparedExplorations(), sources = (await loadPreparedDisassemblies()).flatMap(d => d.sources);
    expect(all.map(x => `${x.id}:${x.language}`)).toEqual([
      'press-enter-map-en:en',
      'importer-signals-map:it', 'mill-harm-map:it', 'atlas-release-map:it', 'importer-signals-map-en:en', 'mill-harm-map-en:en', 'atlas-release-map-en:en',
    ]);
    for (const x of all) {
      expect(x.kind).toBe('prepared');
      expect(x.generation).toBeUndefined();
      if (x.id === 'press-enter-map-en') expect(x.source.origin).toBe('original-prepared');
      // Claude's explanation is its own source, written in the run; every other file reads a prepared disassembly's source.
      if (x.id !== 'press-enter-map-en') expect(sources.some(s => s.id === x.source.id && s.sha256 === x.source.sha256)).toBe(true);
    }
  });

  it('say the same thing in both languages: the same parts, cites, links and traces', async () => {
    const all = await loadPreparedExplorations();
    const frame = (x: Exploration) => ({
      start: x.start, aspects: x.aspects.map(a => a.id), source: x.source.sha256,
      parts: x.parts.map(p => [p.id, p.kind, p.on, p.aspect, p.cites, p.points.map(q => [q.mark, q.cites]), p.members.map(m => [m.id, m.cites])]),
      links: x.links.map(l => [l.from, l.to, l.class, l.basis, l.cites]), traces: x.traces.map(t => t.steps.map(s => [s.parts, s.cites])),
    });
    for (const it of all.filter(x => x.language === 'it')) expect(frame(all.find(x => x.id === `${it.id}-en`)!)).toEqual(frame(it));
  });

  it.each(Object.keys(EXPECTED))('records the shape, levels and reading report of %s', async id => {
    const all = await loadPreparedExplorations();
    for (const x of all.filter(y => y.id === id || y.id === `${id}-en`)) expect(recorded(x)).toEqual(EXPECTED[id]);
  });

  it('opens the importer on the aspect level and Mill on its roles', async () => {
    const all = await loadPreparedExplorations(), byId = (id: string) => all.find(x => x.id === id)!;
    expect(aspectLevel(byId('importer-signals-map'))).not.toBeNull();
    const mill = byId('mill-harm-map');
    expect(aspectLevel(mill)).toBeNull();
    expect(mill.links.filter(l => l.class === 'bond')).toHaveLength(mill.links.length);
    expect(mill.parts.filter(p => p.kind === 'annotation').map(p => p.on)).toEqual(['principle']);
  });
});
