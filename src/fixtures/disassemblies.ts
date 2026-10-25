import { validateDisassembly, type Disassembly } from '../core/disassembly';
import atlas from './disassemblies/atlas-release.json';
import mill from './disassemblies/mill-harm.json';

/** Prepared disassemblies: an original runbook (mechanism) and Mill's public-domain essay (argument). */
export function loadPreparedDisassemblies(): Promise<Disassembly[]> {
  return Promise.all([atlas, mill].map(x => validateDisassembly(x)));
}
