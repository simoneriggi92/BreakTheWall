// Renders the brand's raster files (app icon, social card) from their sources in docs/images/brand, with the installed Electron.
import { spawn } from 'node:child_process';
import electron from 'electron';

const jobs = [
  ['docs/images/brand/app-icon.svg', 'assets/icon.png', 1024, 1024],
  ['docs/images/brand/social-card.html', '.github/assets/social-preview.png', 1280, 640],
];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// One Electron process per image: a second offscreen window in the same process is not reliable on every Mac.
for (const job of jobs) {
  const code = await new Promise((done, fail) => {
    const child = spawn(electron, ['scripts/brand-render.cjs', '--', ...job.map(String)], { stdio: 'inherit', env });
    child.on('error', fail);
    child.on('exit', done);
  });
  if (code !== 0) { process.exitCode = code ?? 1; break; }
}
