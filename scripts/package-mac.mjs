// Packages the built app for Apple Silicon: bundle, ad-hoc signature, start check, DMG and checksum, in release/.
// Run through `npm run package`, which builds first. Only macOS's own tools are used besides @electron/packager.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asar, checksum, COPYRIGHT, ignore, NAME, requireBuild, root, serverCheck, size, startCheck, version } from './package-common.mjs';

// The bundle is built outside the project: a synced folder (iCloud Documents) adds Finder attributes that break the signature.
const build = mkdtempSync(join(tmpdir(), 'btw-package-')), release = join(root, 'release');
const run = (command, args) => execFileSync(command, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();

if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Packaging runs on an Apple Silicon Mac: the start check opens the arm64 app.');
requireBuild();
rmSync(release, { recursive: true, force: true });

// 1. The bundle icon, from the 1024 px app icon.
const iconset = join(build, 'icon.iconset');
mkdirSync(iconset, { recursive: true });
for (const px of [16, 32, 128, 256, 512]) {
  run('sips', ['-z', String(px), String(px), join(root, 'assets/icon.png'), '--out', join(iconset, `icon_${px}x${px}.png`)]);
  run('sips', ['-z', String(px * 2), String(px * 2), join(root, 'assets/icon.png'), '--out', join(iconset, `icon_${px}x${px}@2x.png`)]);
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(build, 'icon.icns')]);

// 2. The app bundle, with only what the app needs (see package-common.mjs).
const [app] = await packager({
  dir: root, out: join(build, 'out'), overwrite: true, platform: 'darwin', arch: 'arm64',
  name: NAME, appBundleId: 'io.github.simoneriggi92.breakthewall', appVersion: version,
  appCategoryType: 'public.app-category.education', appCopyright: COPYRIGHT,
  icon: join(build, 'icon.icns'), asar, prune: false, darwinDarkModeSupport: true,
  ignore,
});
const bundle = join(app, `${NAME}.app`);

// 3. Signature. Ad-hoc for now (owner's decision, plan P-20261027-macos-dmg): arm64 binaries must be signed to run,
// and renaming the app invalidated Electron's own signature. Developer ID signing and notarization replace this step.
run('xattr', ['-cr', bundle]);
run('codesign', ['--force', '--deep', '--sign', '-', bundle]);
run('codesign', ['--verify', '--deep', '--strict', bundle]);
console.log('signature: ad-hoc, verified');

// 4. Start check: open the packaged app with empty user data and wait for the library to be drawn; then run its MCP server.
await startCheck(join(bundle, 'Contents/MacOS', NAME));
await serverCheck(join(bundle, 'Contents/MacOS', NAME), join(bundle, 'Contents/Resources'));

// 5. The disk image: the app and a link to Applications, LZMA-compressed (ULMO: macOS 10.15+, the app needs 13).
const stage = join(build, 'dmg');
mkdirSync(stage, { recursive: true });
run('ditto', [bundle, join(stage, `${NAME}.app`)]);
symlinkSync('/Applications', join(stage, 'Applications'));
mkdirSync(release, { recursive: true });
const dmg = join(release, `Break-the-Wall-${version}-arm64.dmg`);
run('hdiutil', ['create', '-volname', NAME, '-srcfolder', stage, '-fs', 'HFS+', '-format', 'ULMO', '-ov', dmg]);
const digest = checksum(dmg);
rmSync(build, { recursive: true, force: true });
console.log(`dmg: ${dmg.slice(root.length + 1)} (${size(dmg)})\nsha256: ${digest}`);
