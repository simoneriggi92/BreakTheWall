// @vitest-environment node
import { join, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, mcpbManifest, zip } from '../scripts/zip.mjs';
import { claudeCodeCommand, unpackedPath } from '../src/desktop/assistants';
import { PROMPTS } from '../src/mcp/server';

/** Reads a zip back through its central directory, checking each entry's sizes and CRC. */
function unzip(bytes: Buffer): Map<string, Buffer> {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    expect(bytes.readUInt32LE(at)).toBe(0x02014b50);
    const [method, crc, packedSize, size, nameLength, extra, comment, offset] = [bytes.readUInt16LE(at + 10), bytes.readUInt32LE(at + 16), bytes.readUInt32LE(at + 20), bytes.readUInt32LE(at + 24), bytes.readUInt16LE(at + 28), bytes.readUInt16LE(at + 30), bytes.readUInt16LE(at + 32), bytes.readUInt32LE(at + 42)];
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    expect(bytes.readUInt32LE(offset)).toBe(0x04034b50);
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const data = method === 8 ? inflateRawSync(bytes.subarray(start, start + packedSize)) : bytes.subarray(start, start + packedSize);
    expect(data.length).toBe(size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    at += 46 + nameLength + extra + comment;
  }
  return files;
}

describe('the Claude Desktop extension (M4)', () => {
  it('is a valid zip whose manifest runs the bundled server with Claude Desktop\'s Node', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const server = Buffer.from('console.log("server")\n'.repeat(50));
    const bytes = zip([['manifest.json', JSON.stringify(mcpbManifest('0.3.0-alpha', PROMPTS))], ['server/index.js', server], ['icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])]]);
    const files = unzip(bytes);
    expect([...files.keys()]).toEqual(['manifest.json', 'server/index.js', 'icon.png']);
    expect(files.get('server/index.js')).toEqual(server);
    const manifest = JSON.parse(files.get('manifest.json')!.toString('utf8'));
    expect(manifest).toMatchObject({ manifest_version: '0.3', name: 'break-the-wall', version: '0.3.0-alpha', author: { name: 'Simone Riggi' }, icon: 'icon.png',
      server: { type: 'node', entry_point: 'server/index.js', mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'] } } });
    expect(files.has(manifest.server.entry_point)).toBe(true);
    expect(manifest.tools.map((t: { name: string }) => t.name)).toEqual(['open_in_break_the_wall', 'start_disassembly', 'submit_structure', 'submit_part', 'submit_runs']);
    // The manifest's prompt form: argument names, and the same text with ${arguments.topic}.
    expect(manifest.prompts).toEqual([{ name: 'break', description: PROMPTS[0].description, arguments: ['topic'], text: PROMPTS[0].text }]);
    expect(manifest.prompts[0].text).toContain('${arguments.topic}');
  });

  it('is the same bytes for the same input', () => {
    const entries: [string, string][] = [['a.txt', 'same']];
    expect(zip(entries).equals(zip(entries))).toBe(true);
  });
});

describe('the Claude Code command (M4)', () => {
  it('points into app.asar.unpacked in the packaged app, and leaves other paths alone', () => {
    const packed = join(sep, 'Applications', 'Break the Wall.app', 'Contents', 'Resources', 'app.asar', 'dist-electron', 'mcp-server.cjs');
    expect(unpackedPath(packed)).toBe(join(sep, 'Applications', 'Break the Wall.app', 'Contents', 'Resources', 'app.asar.unpacked', 'dist-electron', 'mcp-server.cjs'));
    expect(unpackedPath(join(sep, 'src', 'dist-electron', 'mcp-server.cjs'))).toBe(join(sep, 'src', 'dist-electron', 'mcp-server.cjs'));
  });

  it('runs the app\'s Electron as Node for every project, quoted for the system\'s shell', () => {
    expect(claudeCodeCommand({ platform: 'darwin', executable: '/Applications/Break the Wall.app/Contents/MacOS/Break the Wall', server: '/Applications/Break the Wall.app/Contents/Resources/app.asar.unpacked/dist-electron/mcp-server.cjs' }))
      .toBe("claude mcp add --scope user break-the-wall -e 'ELECTRON_RUN_AS_NODE=1' -- '/Applications/Break the Wall.app/Contents/MacOS/Break the Wall' '/Applications/Break the Wall.app/Contents/Resources/app.asar.unpacked/dist-electron/mcp-server.cjs'");
    expect(claudeCodeCommand({ platform: 'win32', executable: 'C:\\Users\\me\\AppData\\Local\\BreakTheWall\\app-0.3.0\\BreakTheWall.exe', server: 'C:\\Users\\me\\AppData\\Local\\BreakTheWall\\app-0.3.0\\resources\\app.asar.unpacked\\dist-electron\\mcp-server.cjs' }))
      .toBe('claude mcp add --scope user break-the-wall -e "ELECTRON_RUN_AS_NODE=1" -- "C:\\Users\\me\\AppData\\Local\\BreakTheWall\\app-0.3.0\\BreakTheWall.exe" "C:\\Users\\me\\AppData\\Local\\BreakTheWall\\app-0.3.0\\resources\\app.asar.unpacked\\dist-electron\\mcp-server.cjs"');
  });

  it('passes on a custom data folder, and escapes quotes', () => {
    expect(claudeCodeCommand({ platform: 'linux', executable: "/opt/it's/btw", server: '/opt/s.cjs', userData: '/tmp/btw data' }))
      .toBe("claude mcp add --scope user break-the-wall -e 'ELECTRON_RUN_AS_NODE=1' -e 'BTW_USER_DATA_DIR=/tmp/btw data' -- '/opt/it'\\''s/btw' '/opt/s.cjs'");
  });
});
