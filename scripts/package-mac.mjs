// Packages the built app for Apple Silicon: bundle, ad-hoc signature, start check, DMG and checksum, in release/.
// Run through `npm run package`, which builds first. Only macOS's own tools are used besides @electron/packager.
import { packager } from '@electron/packager';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const NAME = 'Break the Wall';
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// The bundle is built outside the project: a synced folder (iCloud Documents) adds Finder attributes that break the signature.
const build = mkdtempSync(join(tmpdir(), 'btw-package-')), release = join(root, 'release');
const run = (command, args) => execFileSync(command, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const size = path => `${(statSync(path).size / 1e6).toFixed(1)} MB`;

if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Packaging runs on an Apple Silicon Mac: the start check opens the arm64 app.');
for (const built of ['dist/index.html', 'dist-electron/main.cjs', 'dist-electron/preload.cjs']) {
  if (!existsSync(join(root, built))) throw new Error(`${built} is missing: run npm run build first.`);
}
rmSync(release, { recursive: true, force: true });

// 1. The bundle icon, from the 1024 px app icon.
const iconset = join(build, 'icon.iconset');
mkdirSync(iconset, { recursive: true });
for (const px of [16, 32, 128, 256, 512]) {
  run('sips', ['-z', String(px), String(px), join(root, 'assets/icon.png'), '--out', join(iconset, `icon_${px}x${px}.png`)]);
  run('sips', ['-z', String(px * 2), String(px * 2), join(root, 'assets/icon.png'), '--out', join(iconset, `icon_${px}x${px}@2x.png`)]);
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(build, 'icon.icns')]);

// 2. The app bundle. Every runtime dependency is already bundled by Vite and esbuild, so only the build output,
// the assets and package.json go in: no node_modules.
const kept = /^\/(dist|dist-electron|assets)(\/|$)|^\/package\.json$/;
const [app] = await packager({
  dir: root, out: join(build, 'out'), overwrite: true, platform: 'darwin', arch: 'arm64',
  name: NAME, appBundleId: 'io.github.simoneriggi92.breakthewall', appVersion: version,
  appCategoryType: 'public.app-category.education', appCopyright: 'Copyright 2026 Simone Riggi. Apache License 2.0.',
  icon: join(build, 'icon.icns'), asar: true, prune: false, darwinDarkModeSupport: true,
  ignore: path => path !== '' && !kept.test(path),
});
const bundle = join(app, `${NAME}.app`);

// 3. Signature. Ad-hoc for now (owner's decision, plan P-20261027-macos-dmg): arm64 binaries must be signed to run,
// and renaming the app invalidated Electron's own signature. Developer ID signing and notarization replace this step.
run('xattr', ['-cr', bundle]);
run('codesign', ['--force', '--deep', '--sign', '-', bundle]);
run('codesign', ['--verify', '--deep', '--strict', bundle]);
console.log('signature: ad-hoc, verified');

// 4. Start check: open the packaged app with empty user data and wait for the library to be drawn.
const userData = mkdtempSync(join(tmpdir(), 'btw-start-check-'));
const started = await new Promise(done => {
  const env = { ...process.env, BTW_SMOKE_TEST: '1', BTW_USER_DATA_DIR: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(join(bundle, 'Contents/MacOS', NAME), [], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const timer = setTimeout(() => { child.kill('SIGKILL'); done({ code: null, output: output + 'start check: no answer within 60 s' }); }, 60_000);
  child.on('exit', code => { clearTimeout(timer); done({ code, output }); });
});
rmSync(userData, { recursive: true, force: true });
const reason = started.output.split('\n').find(line => line.startsWith('start check:')) ?? 'start check: no report';
if (started.code !== 0) throw new Error(`The packaged app did not start: ${reason}`);
console.log(reason);

// 5. The disk image: the app and a link to Applications, LZMA-compressed (ULMO: macOS 10.15+, the app needs 13).
const stage = join(build, 'dmg');
mkdirSync(stage, { recursive: true });
run('ditto', [bundle, join(stage, `${NAME}.app`)]);
symlinkSync('/Applications', join(stage, 'Applications'));
mkdirSync(release, { recursive: true });
const dmg = join(release, `Break-the-Wall-${version}-arm64.dmg`);
run('hdiutil', ['create', '-volname', NAME, '-srcfolder', stage, '-fs', 'HFS+', '-format', 'ULMO', '-ov', dmg]);
const digest = createHash('sha256').update(readFileSync(dmg)).digest('hex');
writeFileSync(`${dmg}.sha256`, `${digest}  ${dmg.split('/').pop()}\n`);
rmSync(build, { recursive: true, force: true });
console.log(`dmg: ${dmg.slice(root.length + 1)} (${size(dmg)})\nsha256: ${digest}`);
