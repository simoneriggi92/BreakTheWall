import { appendFileSync, readFileSync } from 'node:fs';
import { checkMarketplacePin, packPlugin, pluginTag, releaseNotes } from './plugin-release.mjs';

// `node scripts/pack-plugin.mjs <release tag> <out dir>`, after `npm run build:plugin`: the plugin as the release
// writes it to the `plugin` branch (#107). Prints the plugin tag, and hands it to the workflow through GITHUB_OUTPUT.
const [releaseTag, out] = process.argv.slice(2);
if (!releaseTag || !out) {
  console.error('Usage: node scripts/pack-plugin.mjs <release tag, v<version>> <out dir>');
  process.exit(1);
}
try {
  const { version: packageVersion } = JSON.parse(readFileSync('package.json', 'utf8'));
  const { version, tag } = pluginTag(releaseTag, packageVersion);
  checkMarketplacePin(JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8')), tag);
  // The release job drafts its notes from this section once the plugin tag is written: refuse here, before the tag.
  releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version);
  packPlugin({ from: 'plugin', to: out, version, notices: ['LICENSE', 'NOTICE'] });
  console.log(`${tag}: the plugin is in ${out}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nversion=${version}\n`);
} catch (error) {
  console.error(`pack-plugin: ${error.message}`);
  process.exit(1);
}
