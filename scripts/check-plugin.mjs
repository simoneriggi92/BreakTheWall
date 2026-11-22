import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// The plugin's mod runs only inside Claude Code, so `npm run check` cannot reach it: Claude Code's own validator
// reads it as the engine will (it refuses, for one, `$` passed to anything but a top-level function).
function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}
try {
  execFileSync('claude', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
} catch {
  // CI installs the CLI, so there a missing one is a failure; on a machine without it the check says so and passes.
  if (process.env.CI) { console.error('check:plugin needs the claude CLI.'); process.exit(1); }
  console.warn('check:plugin skipped: the claude CLI is not on PATH.');
  process.exit(0);
}
run('claude', ['plugin', 'validate', 'plugin']);
// The engine lays the mod's types in plugin/.claude-plugin/types when it first loads the plugin (claude --plugin-dir plugin).
if (existsSync('plugin/.claude-plugin/types')) run('npx', ['tsc', '-p', 'plugin']);
else console.warn('Plugin types not laid yet: load the plugin once with claude --plugin-dir plugin to type-check the mod.');
