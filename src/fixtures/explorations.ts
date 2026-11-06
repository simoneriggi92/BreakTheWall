import { validateExploration, type Exploration } from '../core/exploration';
import atlas from './explorations/atlas-release-map.json';
import atlasEn from './explorations/atlas-release-map-en.json';
import mill from './explorations/mill-harm-map.json';
import millEn from './explorations/mill-harm-map-en.json';
import importer from './explorations/importer-signals-map.json';
import importerEn from './explorations/importer-signals-map-en.json';

/**
 * Prepared explorations (plan P-20261105-exploration X10), hand-written over the same public sources as the prepared
 * disassemblies, in Italian and in English: the importer (code, with aspects and members, opening on the aspect level),
 * Mill (an argument with one concern: no aspects, supports as bonds, its limit an annotation) and the release runbook.
 */
export function loadPreparedExplorations(): Promise<Exploration[]> {
  return Promise.all([importer, mill, atlas, importerEn, millEn, atlasEn].map(x => validateExploration(x)));
}
