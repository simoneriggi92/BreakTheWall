// Electron main process for `npm run brand`: renders each SVG or HTML page offscreen to a PNG of the given size, or to
// a Windows .ico holding the sizes Windows asks for. Arguments after `--`: <source> <output.png|.ico> <width> <height>, repeated.
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const args = process.argv.slice(process.argv.indexOf('--') + 1);
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** An .ico with one PNG-encoded entry per size (Windows Vista and later read PNG entries). */
function ico(image) {
  const pngs = ICO_SIZES.map(size => image.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const at = 6 + 16 * i, size = ICO_SIZES[i] % 256; // 0 means 256
    header.writeUInt8(size, at); header.writeUInt8(size, at + 1); header.writeUInt8(0, at + 2); header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(png.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}
app.dock?.hide();
app.whenReady().then(async () => {
  for (let i = 0; i + 3 < args.length; i += 4) {
    const [source, output, width, height] = [resolve(args[i]), resolve(args[i + 1]), Number(args[i + 2]), Number(args[i + 3])];
    const win = new BrowserWindow({ width, height, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
    await win.loadFile(source);
    await new Promise(done => setTimeout(done, 300));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width, height });
    writeFileSync(output, output.endsWith('.ico') ? ico(image) : image.resize({ width, height }).toPNG());
    win.destroy();
    console.log(`${output} (${width}×${height})`);
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
