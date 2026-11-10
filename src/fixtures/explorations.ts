import { validateExploration, type Exploration } from '../core/exploration';
import atlas from './explorations/atlas-release-map.json';
import atlasEn from './explorations/atlas-release-map-en.json';
import mill from './explorations/mill-harm-map.json';
import millEn from './explorations/mill-harm-map-en.json';
import importer from './explorations/importer-signals-map.json';
import importerEn from './explorations/importer-signals-map-en.json';
import pressEnter from './explorations/press-enter-map-en.json';

/**
 * Prepared explorations (plan P-20261105-exploration X10), hand-written over the same public sources as the prepared
 * disassemblies, in Italian and in English: the importer (code, with aspects and members, opening on the aspect level),
 * Mill (an argument with one concern: no aspects, supports as bonds, its limit an annotation) and the release runbook.
 *
 * First comes "From address bar to rendered page" (X36), in English only: Claude Code wrote the explanation and its
 * structure in one real run over the MCP server on 2026-11-10, and the app checked and saved it. Only its kind, its id,
 * its source's origin and the run's record were changed to make it a prepared file. It is first because anyone who
 * writes software recognises the topic, so the structure is what a newcomer notices.
 */
export function loadPreparedExplorations(): Promise<Exploration[]> {
  return Promise.all([pressEnter, importer, mill, atlas, importerEn, millEn, atlasEn].map(x => validateExploration(x)));
}
