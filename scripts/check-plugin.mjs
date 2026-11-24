import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { skippedModHooks } from './mod-hooks.mjs';

// The plugin's mod runs only inside Claude Code, so `npm run check` cannot reach it: Claude Code's own validator
// reads it as the engine will (it refuses, for one, `$` passed to anything but a top-level function), and its test
// kit runs the mod's tests.
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
// Its report is kept to read which events the mod hooks: one the engine skips past the mod fails the check here,
// since the kit's tests run it anyway.
let validated;
try {
  validated = execFileSync('claude', ['plugin', 'validate', 'plugin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
} catch (error) {
  process.stdout.write(error.stdout ?? '');
  process.exit(error.status ?? 1);
}
process.stdout.write(validated);
const skipped = skippedModHooks(validated);
if (skipped.length > 0) {
  console.error(`check:plugin: the mod hooks ${skipped.join(', ')}. On Claude Code 2.1.330 the built-in cc-plugin-sec-default passes these events on past every other plugin, so the hook never runs in a session. Declare a classic command hook in plugin/hooks/hooks.json instead (plugin/AGENTS.md, #96).`);
  process.exit(1);
}
// The marketplace people add (#107), read as `/plugin marketplace add` will read it.
run('claude', ['plugin', 'validate', '.claude-plugin/marketplace.json']);
// The mod's tests run inside the engine's test kit, which stands in for Claude Code beneath the mod.
run('claude', ['plugin', 'test', 'plugin']);
// The engine lays the mod's types in plugin/.claude-plugin/types only when an interactive session loads the plugin
// (claude --plugin-dir plugin); neither `claude plugin test` nor `claude -p` lays them. CI never has them, so there the
// skip is an annotation on the run, not a line lost in the log.
if (existsSync('plugin/.claude-plugin/types')) run('npx', ['tsc', '-p', 'plugin']);
else if (process.env.CI) console.log('::warning title=Mod not type-checked::The engine lays the mod\'s types only in an interactive session (claude --plugin-dir plugin); type-check the mod locally before a release.');
else console.warn('Plugin types not laid yet: load the plugin once with claude --plugin-dir plugin to type-check the mod.');
