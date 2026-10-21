import { build } from 'esbuild';

await build({
  entryPoints: ['src/desktop/main.ts', 'src/desktop/preload.ts'],
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  outdir: 'dist-electron', outExtension: { '.js': '.cjs' }, external: ['electron'],
});
