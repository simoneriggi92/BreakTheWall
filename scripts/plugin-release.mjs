import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * The Claude Code plugin as a release publishes it (#107): built on a `v<version>` tag, written to the orphan `plugin`
 * branch and tagged `plugin-v<version>`, the tag `.claude-plugin/marketplace.json` on main pins. The release job in
 * .github/workflows/release.yml runs these through scripts/pack-plugin.mjs.
 */
export const PLUGIN_NAME = 'break-the-wall';
export const PLUGIN_REPO = 'simoneriggi92/BreakTheWall';

/** `v0.6.0` → `plugin-v0.6.0`. The release tag, package.json, plugin.json and the server's own version are one. */
export function pluginTag(releaseTag, packageVersion) {
  const version = /^v(.+)$/.exec(releaseTag)?.[1];
  if (!version) throw new Error(`A release tag is v<version>; got ${releaseTag}.`);
  if (version !== packageVersion) throw new Error(`The tag ${releaseTag} names ${version}, package.json ${packageVersion}: they move together.`);
  return { version, tag: `plugin-v${version}` };
}

/**
 * The marketplace's entry must pin the tag this release writes. A release whose tag main does not pin would leave
 * every new install on the older plugin, so the release stops instead: bump the pin with the version.
 */
export function checkMarketplacePin(marketplace, tag) {
  const entry = marketplace?.plugins?.find?.(plugin => plugin?.name === PLUGIN_NAME);
  if (!entry) throw new Error(`.claude-plugin/marketplace.json lists no ${PLUGIN_NAME} plugin.`);
  const { source } = entry;
  if (source?.source !== 'github' || source.repo !== PLUGIN_REPO) throw new Error(`The marketplace's ${PLUGIN_NAME} entry must come from github ${PLUGIN_REPO}.`);
  if (source.ref !== tag) throw new Error(`The marketplace pins ${source.ref ?? 'no ref'}, this release writes ${tag}: move the pin with package.json's version.`);
}

// Development files: the mod's tests run under `claude plugin test` in the repository, not in a person's session.
const LEFT_OUT = [/\.test\.ts$/, /^AGENTS\.md$/, /^tsconfig\.json$/, /^\.claude-plugin\/types(\/|$)/];
// Claude Code installs a plugin's Node dependencies when it finds a package manifest with a lockfile; the plugin is
// bundled so that nothing is installed on the person's machine.
const INSTALLS = [/(^|\/)package(-lock)?\.json$/, /(^|\/)(npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/, /(^|\/)node_modules(\/|$)/];
const BUILT = ['server/server.cjs', 'server/launcher.cjs', 'page/index.html'];

/** Every file under `dir`, as a path with forward slashes. */
function files(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? files(dir, path) : [path];
  });
}

/**
 * Copies the built plugin at `from` into the folder `to`, replacing what it held, as a release ships it: with the
 * license files beside it, and plugin.json given the release's version.
 */
export function packPlugin({ from, to, version, notices }) {
  const missing = BUILT.filter(file => !existsSync(join(from, file)));
  if (missing.length > 0) throw new Error(`The plugin is not built (${missing.join(', ')} missing): run npm run build:plugin first.`);
  const paths = files(from);
  const installs = paths.filter(path => INSTALLS.some(pattern => pattern.test(path)));
  if (installs.length > 0) throw new Error(`${installs[0]} would make Claude Code run an install step; the plugin ships bundled.`);

  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const path of paths.filter(path => !LEFT_OUT.some(pattern => pattern.test(path)))) {
    mkdirSync(dirname(join(to, path)), { recursive: true });
    cpSync(join(from, path), join(to, path));
  }
  for (const file of notices) cpSync(file, join(to, basename(file)));

  const manifestPath = join(to, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
}
