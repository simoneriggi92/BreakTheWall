import { spawn } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

/** What the Windows installer (Squirrel) asks the app to do when it starts it with one of its flags. */
export type SquirrelAction = { shortcut: 'create' | 'remove' } | { shortcut: null };

/**
 * Squirrel starts the app with `--squirrel-install` or `--squirrel-updated` (make the Start menu and desktop shortcuts),
 * `--squirrel-uninstall` (remove them) or `--squirrel-obsolete` (an old version, about to be removed), and expects it to
 * do that and quit. `--squirrel-firstrun` and every other start are normal starts: null.
 */
export function squirrelAction(platform: string, argv: readonly string[]): SquirrelAction | null {
  if (platform !== 'win32') return null;
  const flag = argv.find(arg => arg.startsWith('--squirrel-'));
  if (flag === '--squirrel-install' || flag === '--squirrel-updated') return { shortcut: 'create' };
  if (flag === '--squirrel-uninstall') return { shortcut: 'remove' };
  if (flag === '--squirrel-obsolete') return { shortcut: null };
  return null;
}

/** Runs Squirrel's Update.exe, next to the versioned app folder, for the shortcut; the caller quits right after. */
export function runSquirrel(action: SquirrelAction, execPath = process.execPath) {
  if (!action.shortcut) return;
  const update = resolve(dirname(execPath), '..', 'Update.exe');
  const flag = action.shortcut === 'create' ? '--createShortcut' : '--removeShortcut';
  spawn(update, [`${flag}=${basename(execPath)}`], { detached: true, stdio: 'ignore' }).unref();
}
