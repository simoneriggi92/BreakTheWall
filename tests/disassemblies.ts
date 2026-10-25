import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** Public fixtures: the two prepared disassemblies, the original story case, then the English versions of the first two. */
export const PUBLIC_FIXTURES = ['src/fixtures/disassemblies/atlas-release.json', 'src/fixtures/disassemblies/mill-harm.json', 'tests/fixtures/disassemblies/kessmouth-quay.json',
  'src/fixtures/disassemblies/atlas-release-en.json', 'src/fixtures/disassemblies/mill-harm-en.json'];
/** Private cases live only in the ignored `.local/` folder; their tests are skipped when the files are absent. */
const PRIVATE_DIR = '.local/fixtures/disassemblies';
export const PRIVATE_FIXTURES = existsSync(PRIVATE_DIR) ? readdirSync(PRIVATE_DIR).filter(x => x.endsWith('.json')).map(x => `${PRIVATE_DIR}/${x}`) : [];
// Fresh copies, so a test can mutate its input.
export const fixture = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
export const atlas = () => fixture(PUBLIC_FIXTURES[0]);
export const mill = () => fixture(PUBLIC_FIXTURES[1]);
export const story = () => fixture(PUBLIC_FIXTURES[2]);
