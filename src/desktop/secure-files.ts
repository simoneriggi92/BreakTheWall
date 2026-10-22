import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { newHostId, type AccountRecord, type Vault } from './chatgpt/account';

export interface Cipher { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }

async function atomicWrite(file: string, data: string | Buffer) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.pending`;
  await writeFile(temp, data, { mode: 0o600 });
  await rename(temp, file);
}

/** Credentials encrypted with Electron safeStorage (a Keychain-held key on macOS). No plaintext fallback. */
export class SafeStorageVault implements Vault {
  constructor(private file: string, private cipher: Cipher) {}
  available() { return this.cipher.isEncryptionAvailable(); }
  async read(): Promise<AccountRecord | null> {
    if (!this.available()) return null;
    let raw: Buffer;
    try { raw = await readFile(this.file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    try {
      const record = JSON.parse(this.cipher.decryptString(raw)) as AccountRecord;
      return record?.version === 1 && typeof record.clientId === 'string' ? record : null;
    } catch { return null; }
  }
  async write(record: AccountRecord) {
    if (!this.available()) throw new Error('Protected storage unavailable');
    await atomicWrite(this.file, this.cipher.encryptString(JSON.stringify(record)));
  }
  async clear() { await rm(this.file, { force: true }); }
}

/** The agent host id is an opaque, non-secret identifier that stays stable for this installation. */
export function hostIdFile(file: string) {
  let cached: Promise<string> | undefined;
  return () => cached ??= (async () => {
    try {
      const value = JSON.parse(await readFile(file, 'utf8')) as { hostId?: unknown };
      if (typeof value.hostId === 'string' && /^urn:uuid:[0-9a-f-]{36}$/.test(value.hostId)) return value.hostId;
    } catch { /* created below */ }
    const hostId = newHostId();
    await atomicWrite(file, JSON.stringify({ hostId }));
    return hostId;
  })();
}
