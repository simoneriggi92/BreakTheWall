import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { defaultSettings, settingsSchema, type StudioSettings } from '../core/provider';

/** Non-secret preferences: which route generates, and the chosen local server and model. */
export class SettingsStore {
  constructor(private file: string) {}
  async read(): Promise<StudioSettings> {
    try { return settingsSchema.parse(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch { return defaultSettings; }
  }
  async write(input: unknown): Promise<StudioSettings> {
    const settings = settingsSchema.parse(input);
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file + '.pending', JSON.stringify(settings), { mode: 0o600 });
    await rename(this.file + '.pending', this.file);
    return settings;
  }
}
