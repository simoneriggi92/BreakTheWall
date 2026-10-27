// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const spawned: { command: string; args: string[] }[] = [];
vi.mock('node:child_process', () => ({ spawn: (command: string, args: string[]) => { spawned.push({ command, args }); return { unref: () => {} }; } }));
const { runSquirrel, squirrelAction } = await import('../src/desktop/squirrel');

describe('Squirrel events on Windows (W3)', () => {
  it('maps the installer flags to shortcuts, and leaves every other start alone', () => {
    expect(squirrelAction('win32', ['app.exe', '--squirrel-install', '0.2.0'])).toEqual({ shortcut: 'create' });
    expect(squirrelAction('win32', ['app.exe', '--squirrel-updated', '0.2.0'])).toEqual({ shortcut: 'create' });
    expect(squirrelAction('win32', ['app.exe', '--squirrel-uninstall', '0.2.0'])).toEqual({ shortcut: 'remove' });
    expect(squirrelAction('win32', ['app.exe', '--squirrel-obsolete', '0.1.0'])).toEqual({ shortcut: null });
    expect(squirrelAction('win32', ['app.exe', '--squirrel-firstrun'])).toBeNull();
    expect(squirrelAction('win32', ['app.exe'])).toBeNull();
  });

  it('does nothing on other systems, whatever the arguments', () => {
    expect(squirrelAction('darwin', ['app', '--squirrel-install'])).toBeNull();
    expect(squirrelAction('linux', ['app', '--squirrel-uninstall'])).toBeNull();
  });

  it('asks Update.exe, one folder above the app version, for the shortcut of this executable', () => {
    // Absolute on every system (a drive letter on Windows), as process.execPath is.
    const exe = resolve('/Users/me/AppData/Local/BreakTheWall/app-0.2.0/BreakTheWall.exe');
    const update = resolve('/Users/me/AppData/Local/BreakTheWall/Update.exe');
    runSquirrel({ shortcut: 'create' }, exe);
    runSquirrel({ shortcut: 'remove' }, exe);
    runSquirrel({ shortcut: null }, exe);
    expect(spawned).toEqual([
      { command: update, args: ['--createShortcut=BreakTheWall.exe'] },
      { command: update, args: ['--removeShortcut=BreakTheWall.exe'] },
    ]);
  });
});
