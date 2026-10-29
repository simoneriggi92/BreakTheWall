import { validateDisassembly, type Disassembly } from '../core/disassembly';
import atlas from './disassemblies/atlas-release.json';
import atlasEn from './disassemblies/atlas-release-en.json';
import mill from './disassemblies/mill-harm.json';
import millEn from './disassemblies/mill-harm-en.json';
import importer from './disassemblies/importer-signals.json';
import importerEn from './disassemblies/importer-signals-en.json';

/**
 * Prepared disassemblies: an original runbook (mechanism) and Mill's public-domain essay (argument), both question-led,
 * and an original document taken apart whole, without a question (P-20261029-source-entry E8); each written in Italian
 * and in English over the same sources.
 */
export function loadPreparedDisassemblies(): Promise<Disassembly[]> {
  return Promise.all([atlas, mill, importer, atlasEn, millEn, importerEn].map(x => validateDisassembly(x)));
}
