import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { build as buildPage } from 'vite';

// The Claude Code plugin (#94): the local page and the server bundled into plugin/, so the plugin runs with no
// install step. The output is build output: it is ignored on main and published by the release.
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('plugin/.claude-plugin/plugin.json', 'utf8'));
if (manifest.version !== version) throw new Error(`plugin.json has version ${manifest.version}, package.json ${version}: they move together.`);

// `--mode page` gives the page its entry and the content policy with connect-src 'self'.
await buildPage({ mode: 'page', logLevel: 'warn', build: { outDir: 'plugin/page', emptyOutDir: true } });

await build({
  entryPoints: { server: 'src/server/main.ts', launcher: 'src/server/launcher.ts' },
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  outdir: 'plugin/server', outExtension: { '.js': '.cjs' }, define: { BTW_VERSION: JSON.stringify(version) },
});
