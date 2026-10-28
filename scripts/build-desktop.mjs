import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { mcpbManifest, zip } from './zip.mjs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const prompts = JSON.parse(readFileSync('src/mcp/prompts.json', 'utf8'));

await build({
  entryPoints: ['src/desktop/main.ts', 'src/desktop/preload.ts'],
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  outdir: 'dist-electron', outExtension: { '.js': '.cjs' }, external: ['electron'],
});

// The MCP server runs outside Electron's app: on Claude Desktop's Node, or on the app's Electron in Node mode.
await build({
  entryPoints: ['src/mcp/main.ts'],
  bundle: true, platform: 'node', target: 'node18', format: 'cjs',
  outfile: 'dist-electron/mcp-server.cjs', define: { BTW_VERSION: JSON.stringify(version) },
});

// The Claude Desktop extension, opened from the app's "Use with Claude" panel.
writeFileSync('dist-electron/break-the-wall.mcpb', zip([
  ['manifest.json', JSON.stringify(mcpbManifest(version, prompts), null, 2)],
  ['server/index.js', readFileSync('dist-electron/mcp-server.cjs')],
  ['icon.png', readFileSync('assets/icon.png')],
]));
