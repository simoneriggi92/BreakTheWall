import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// A reply body read with `.json() as Shape` crosses a boundary as an unchecked claim: AGENTS.md asks for a Zod parse
// where untrusted data enters. The frozen Electron code keeps three such casts; any other one fails the check.
const KNOWN = new Map([
  ['src/desktop/local/runtimes.ts', 1],
  ['src/desktop/chatgpt/oauth.ts', 1],
  ['src/desktop/chatgpt/responses.ts', 1],
]);
const CAST = /\.json\(\)\)?\s+as\s/g;

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
})('src');

const found = [];
for (const file of files) {
  const name = relative('.', file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = lines.flatMap((line, i) => line.match(CAST) ? [`${name}:${i + 1}: ${line.trim()}`] : []);
  if (hits.length > (KNOWN.get(name) ?? 0)) found.push(...hits);
}
if (found.length) {
  console.error('A response body is cast instead of parsed. Parse it with a Zod schema (see src/core/local-server.ts):');
  for (const hit of found) console.error(`  ${hit}`);
  process.exit(1);
}
