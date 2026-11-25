import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginTag, releaseNotes } from './plugin-release.mjs';

// `node scripts/release-notes.mjs <release tag> <out dir>`: writes title.txt and notes.md for the draft GitHub release
// the tag makes, from the version's CHANGELOG section (#130).
const [releaseTag, out] = process.argv.slice(2);
if (!releaseTag || !out) {
  console.error('Usage: node scripts/release-notes.mjs <release tag, v<version>> <out dir>');
  process.exit(1);
}
try {
  const { version: packageVersion } = JSON.parse(readFileSync('package.json', 'utf8'));
  const { version } = pluginTag(releaseTag, packageVersion);
  const { title, notes } = releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version);
  writeFileSync(join(out, 'title.txt'), `${title}\n`);
  writeFileSync(join(out, 'notes.md'), notes);
  console.log(`${releaseTag}: ${title}`);
} catch (error) {
  console.error(`release-notes: ${error.message}`);
  process.exit(1);
}
