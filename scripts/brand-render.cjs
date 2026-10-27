// Electron main process for `npm run brand`: renders each SVG or HTML page offscreen to a PNG of the given size.
// Arguments after `--`: <source> <output.png> <width> <height>, repeated.
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const args = process.argv.slice(process.argv.indexOf('--') + 1);
app.dock?.hide();
app.whenReady().then(async () => {
  for (let i = 0; i + 3 < args.length; i += 4) {
    const [source, output, width, height] = [resolve(args[i]), resolve(args[i + 1]), Number(args[i + 2]), Number(args[i + 3])];
    const win = new BrowserWindow({ width, height, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
    await win.loadFile(source);
    await new Promise(done => setTimeout(done, 300));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width, height });
    writeFileSync(output, image.resize({ width, height }).toPNG());
    win.destroy();
    console.log(`${output} (${width}×${height})`);
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
