import { validateDisassembly, type Disassembly } from '../core/disassembly';
import atlas from './disassemblies/atlas-release.json';
import atlasEn from './disassemblies/atlas-release-en.json';
import mill from './disassemblies/mill-harm.json';
import millEn from './disassemblies/mill-harm-en.json';

/**
 * Prepared disassemblies: an original runbook (mechanism) and Mill's public-domain essay (argument),
 * each written in Italian and in English over the same sources.
 */
export function loadPreparedDisassemblies(): Promise<Disassembly[]> {
  return Promise.all([atlas, mill, atlasEn, millEn].map(x => validateDisassembly(x)));
}
