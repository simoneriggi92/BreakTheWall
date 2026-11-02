// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { connect } from 'node:net';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answer, defaultUserData, IncomingServer, incomingAddress, lineReader, MAX_LINE_BYTES, type IncomingHandlers } from '../src/desktop/incoming';
import { importSource } from '../src/core/source';

/** Opens like the app does: the import's limits apply, and the title and line count come back. */
const handlers = (opened: unknown[] = []): IncomingHandlers => ({
  version: '0.3.0-test',
  open: async input => {
    const source = await importSource({ kind: 'paste', title: input.title || 'From your assistant', text: input.text });
    opened.push({ ...input, source });
    return { title: source.title, lines: source.text.split('\n').length };
  },
});

describe('the address of the local entry point (M1)', () => {
  it('follows the data folder Electron uses for "Break the Wall", and BTW_USER_DATA_DIR', () => {
    expect(defaultUserData('darwin', {}, '/Users/me')).toBe(join('/Users/me', 'Library', 'Application Support', 'Break the Wall'));
    expect(defaultUserData('win32', { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'C:\\Users\\me')).toBe(join('C:\\Users\\me\\AppData\\Roaming', 'Break the Wall'));
    expect(defaultUserData('linux', {}, '/home/me')).toBe(join('/home/me', '.config', 'Break the Wall'));
    expect(defaultUserData('linux', { XDG_CONFIG_HOME: '/cfg' }, '/home/me')).toBe(join('/cfg', 'Break the Wall'));
    expect(defaultUserData('darwin', { BTW_USER_DATA_DIR: '/tmp/btw' }, '/Users/me')).toBe('/tmp/btw');
  });

  it('is a socket in the data folder, a per-folder pipe on Windows, and a temporary socket when the path is too long', () => {
    const data = '/Users/me/Library/Application Support/Break the Wall';
    expect(incomingAddress('darwin', data)).toBe(join(data, 'incoming.sock'));
    const pipe = incomingAddress('win32', 'C:\\Users\\me\\AppData\\Roaming\\Break the Wall');
    expect(pipe).toMatch(/^\\\\\.\\pipe\\break-the-wall-[0-9a-f]{12}$/);
    expect(incomingAddress('win32', 'C:\\other')).not.toBe(pipe);
    const long = '/Users/me/' + 'x'.repeat(100);
    const fallback = incomingAddress('darwin', long, '/private/tmp');
    expect(dirname(fallback)).toBe(join('/private/tmp'));
    expect(basename(fallback)).toMatch(/^break-the-wall-[0-9a-f]{12}\.sock$/);
  });
});

describe('line framing', () => {
  it('joins lines split across chunks and splits chunks holding several lines', () => {
    const lines: string[] = [];
    const read = lineReader(line => lines.push(line), 100);
    expect(read(Buffer.from('{"a":'))).toBe(true);
    expect(read(Buffer.from('1}\n{"b":2}\r\n{"c"'))).toBe(true);
    expect(read(Buffer.from(':3}\n'))).toBe(true);
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('keeps multi-byte characters split across chunks whole', () => {
    const lines: string[] = [];
    const read = lineReader(line => lines.push(line), 100);
    const bytes = Buffer.from('perché\n');
    read(bytes.subarray(0, 5)); read(bytes.subarray(5));
    expect(lines).toEqual(['perché']);
  });

  it('stops at a line over the limit, with or without its newline', () => {
    const lines: string[] = [];
    const read = lineReader(line => lines.push(line), 10);
    expect(read(Buffer.from('x'.repeat(11)))).toBe(false);
    expect(read(Buffer.from('ok\n'))).toBe(false);
    const other = lineReader(line => lines.push(line), 10);
    expect(other(Buffer.from('x'.repeat(11) + '\n'))).toBe(false);
    expect(lines).toEqual([]);
  });
});

describe('answers', () => {
  it('says hello with the app version and protocol', async () => {
    expect(await answer('{"v":1,"type":"hello"}', handlers())).toEqual({ ok: true, app: 'break-the-wall', version: '0.3.0-test', protocol: 1 });
  });

  it('opens a text, with its title and question', async () => {
    const opened: unknown[] = [];
    const reply = await answer(JSON.stringify({ v: 1, type: 'open', title: 'HTTPS', text: 'one\ntwo\nthree', question: 'How is a certificate checked?' }), handlers(opened));
    expect(reply).toEqual({ ok: true, title: 'HTTPS', lines: 3 });
    expect(opened).toHaveLength(1);
  });

  it('refuses bad JSON, another protocol, an unknown type and a malformed request', async () => {
    const h = handlers();
    expect(await answer('{oops', h)).toMatchObject({ ok: false, code: 'bad-json' });
    expect(await answer('null', h)).toMatchObject({ ok: false, code: 'protocol' });
    expect(await answer('{"v":2,"type":"hello"}', h)).toMatchObject({ ok: false, code: 'protocol' });
    expect(await answer('{"v":1,"type":"delete"}', h)).toMatchObject({ ok: false, code: 'unknown-type' });
    expect(await answer('{"v":1,"type":"open"}', h)).toMatchObject({ ok: false, code: 'bad-request' });
    expect(await answer('{"v":1,"type":"open","text":"x","extra":1}', h)).toMatchObject({ ok: false, code: 'bad-request' });
  });

  it('passes on the import limits a paste meets, and hides other failures', async () => {
    expect(await answer('{"v":1,"type":"open","text":"   "}', handlers())).toMatchObject({ ok: false, code: 'empty' });
    expect(await answer(JSON.stringify({ v: 1, type: 'open', text: 'x'.repeat(120_001) }), handlers())).toMatchObject({ ok: false, code: 'too-large', params: { chars: 120_001, limit: 120_000 } });
    const broken: IncomingHandlers = { version: '1', open: async () => { throw new Error('/Users/me/secret path'); } };
    expect(await answer('{"v":1,"type":"open","text":"x"}', broken)).toEqual({ ok: false, code: 'unavailable', message: 'The app could not open the text.' });
  });
});

describe('the listener', () => {
  const folders: string[] = [];
  afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
  // Short, so the socket path stays within the system's limit.
  const folder = () => { const f = mkdtempSync(join(tmpdir(), 'btw-')); folders.push(f); return f; };

  /** Sends raw bytes and collects every answer line until the app closes the connection or `count` lines arrived. */
  function exchange(address: string, payload: string | Buffer, count = 1): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const replies: unknown[] = [];
      const socket = connect(address, () => socket.write(payload));
      const read = lineReader(line => { replies.push(JSON.parse(line)); if (replies.length === count) { socket.end(); resolve(replies); } });
      socket.on('data', chunk => read(chunk));
      socket.on('close', () => resolve(replies));
      socket.on('error', reject);
    });
  }

  it('listens only while enabled, answers in order, and removes its socket when turned off', async () => {
    const address = incomingAddress(process.platform, folder());
    const server = new IncomingServer(address, handlers());
    await expect(exchange(address, '{"v":1,"type":"hello"}\n')).rejects.toThrow();
    await server.setEnabled(true);
    await server.setEnabled(true);
    expect(server.listening).toBe(true);
    if (process.platform !== 'win32') expect(statSync(address).mode & 0o777).toBe(0o600);
    const replies = await exchange(address, '{"v":1,"type":"open","text":"a\\nb"}\n{"v":1,"type":"hello"}\n', 2);
    expect(replies).toEqual([{ ok: true, title: 'From your assistant', lines: 2 }, { ok: true, app: 'break-the-wall', version: '0.3.0-test', protocol: 1 }]);
    await server.setEnabled(false);
    expect(server.listening).toBe(false);
    if (process.platform !== 'win32') expect(existsSync(address)).toBe(false);
    await expect(exchange(address, '{"v":1,"type":"hello"}\n')).rejects.toThrow();
  });

  it('replaces a socket file left behind by an app that did not close', async () => {
    if (process.platform === 'win32') return;
    const address = incomingAddress(process.platform, folder());
    const first = new IncomingServer(address, handlers());
    await first.setEnabled(true);
    // Simulate a crash: the file stays, nothing listens.
    (first as unknown as { server: { close(): void } }).server.close();
    const second = new IncomingServer(address, handlers());
    await second.setEnabled(true);
    expect(await exchange(address, '{"v":1,"type":"hello"}\n')).toMatchObject([{ ok: true }]);
    await second.setEnabled(false);
  });

  it('closes a connection whose line is too long, after saying why', async () => {
    const address = incomingAddress(process.platform, folder());
    const opened: unknown[] = [];
    const log = vi.fn();
    const server = new IncomingServer(address, handlers(opened), process.platform, log);
    await server.setEnabled(true);
    const replies = await exchange(address, Buffer.alloc(MAX_LINE_BYTES + 1, 0x61));
    expect(replies).toEqual([{ ok: false, code: 'too-large', message: `A request may be at most ${MAX_LINE_BYTES} bytes.` }]);
    expect(opened).toEqual([]);
    await server.setEnabled(false);
  });
});
