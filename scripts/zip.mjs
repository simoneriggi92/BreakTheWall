// A minimal zip writer for the Claude Desktop extension (.mcpb): deflated entries, no folders, no dependency.
import { deflateRawSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Builds a zip from `[path, bytes]` entries. Paths use forward slashes. The timestamp is fixed (1980-01-01), so the
 * same input always gives the same bytes.
 */
export function zip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const [path, content] of entries) {
    const name = Buffer.from(path, 'utf8');
    const data = Buffer.from(content);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * The extension's manifest (MCPB manifest version 0.3): Claude Desktop runs the bundled server on its own Node.
 * `prompts` are the server's (src/mcp/prompts.json), in the manifest's form: argument names and the text.
 */
export function mcpbManifest(version, prompts = []) {
  return {
    manifest_version: '0.3',
    name: 'break-the-wall',
    display_name: 'Break the Wall',
    version,
    description: 'Open a text from Claude in Break the Wall, the desktop app that takes it apart into parts you can explore, run and reassemble.',
    author: { name: 'Simone Riggi', url: 'https://github.com/simoneriggi92' },
    homepage: 'https://github.com/simoneriggi92/BreakTheWall',
    license: 'Apache-2.0',
    icon: 'icon.png',
    server: { type: 'node', entry_point: 'server/index.js', mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'] } },
    tools: [
      { name: 'open_in_break_the_wall', description: 'Open a text in Break the Wall Studio.' },
      { name: 'start_disassembly', description: 'Write a Break the Wall disassembly yourself, checked by the app phase by phase.' },
      { name: 'submit_structure', description: 'Submit the structure of the disassembly.' },
      { name: 'submit_part', description: 'Submit the content of one top-level part.' },
      { name: 'submit_runs', description: 'Submit the runs; the finished disassembly is saved and opened in Break the Wall.' },
    ],
    prompts: prompts.map(p => ({ name: p.name, description: p.description, arguments: p.arguments.map(a => a.name), text: p.text })),
    compatibility: { platforms: ['darwin', 'win32'], runtimes: { node: '>=20.0.0' } },
  };
}
