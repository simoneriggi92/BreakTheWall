// Packages the built app for Windows x64: bundle, start check, Squirrel installer and checksum, in release/.
// Run through `npm run package:win` on Windows (CI): electron-winstaller runs Squirrel's Windows tools.
import { packager } from '@electron/packager';
import { createWindowsInstaller } from 'electron-winstaller';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asar, checksum, COPYRIGHT, ignore, NAME, requireBuild, root, serverCheck, size, startCheck, version } from './package-common.mjs';

// Squirrel's names: no spaces in the executable or the package id; the Start menu shows the product name.
const EXE = 'BreakTheWall';
const build = mkdtempSync(join(tmpdir(), 'btw-package-')), release = join(root, 'release');

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows packaging runs on Windows x64: the start check opens the x64 app.');
requireBuild();
rmSync(release, { recursive: true, force: true });

// 1. The app folder, with only what the app needs (see package-common.mjs) and the icon rendered by `npm run brand`.
const [app] = await packager({
  dir: root, out: join(build, 'out'), overwrite: true, platform: 'win32', arch: 'x64',
  name: NAME, executableName: EXE, appVersion: version, appCopyright: COPYRIGHT,
  icon: join(root, 'assets/icon.ico'), asar, prune: false, ignore,
  win32metadata: { CompanyName: 'Simone Riggi', FileDescription: NAME, ProductName: NAME, InternalName: EXE, OriginalFilename: `${EXE}.exe` },
});

// 2. Start check: open the packaged app with empty user data and wait for the library to be drawn; then run its MCP server.
await startCheck(join(app, `${EXE}.exe`));
await serverCheck(join(app, `${EXE}.exe`), join(app, 'resources'));

// 3. The installer. Unsigned for the alpha (owner's decision, plan P-20261027-windows-alpha): SmartScreen asks the
// user to confirm. Code signing would be the `windowsSign` option here.
const setup = `Break-the-Wall-${version}-x64-setup.exe`;
await createWindowsInstaller({
  appDirectory: app, outputDirectory: join(build, 'installer'), exe: `${EXE}.exe`, name: EXE, title: NAME,
  description: 'Take the text apart.', authors: 'Simone Riggi', owners: 'Simone Riggi', copyright: COPYRIGHT, version,
  setupExe: setup, setupIcon: join(root, 'assets/icon.ico'), noMsi: true, noDelta: true,
  iconUrl: 'https://raw.githubusercontent.com/simoneriggi92/BreakTheWall/main/assets/icon.ico',
});
mkdirSync(release, { recursive: true });
const installer = join(release, setup);
copyFileSync(join(build, 'installer', setup), installer);
const digest = checksum(installer);
rmSync(build, { recursive: true, force: true });
console.log(`setup: release/${setup} (${size(installer)})\nsha256: ${digest}`);
