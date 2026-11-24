// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The plugin's classic hooks (#96), run as Claude Code runs them: `node plugin/hooks/inject.mjs` with the event on
 * stdin and its answer on stdout. They ask the round skills for their options as a list, however a skill starts, and
 * ask again after a compaction in a session they asked before.
 */
const SCRIPT = join(__dirname, '..', 'plugin', 'hooks', 'inject.mjs');
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const folders: string[] = [];
afterEach(() => { for (const x of folders.splice(0)) rmSync(x, { recursive: true, force: true }); });
const dataFolder = () => { const x = mkdtempSync(join(tmpdir(), 'btw-inject-')); folders.push(x); return x; };

/** One hook run: the context it adds, or undefined when it answers with nothing. */
function hook(input: Record<string, unknown> | string, data: string): string | undefined {
  const stdout = execFileSync(process.execPath, [SCRIPT], {
    input: typeof input === 'string' ? input : JSON.stringify(input), env: { ...process.env, CLAUDE_PLUGIN_DATA: data }, encoding: 'utf8',
  });
  if (stdout.trim() === '') return undefined;
  const { hookSpecificOutput: out } = JSON.parse(stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  if (typeof input !== 'string') expect(out.hookEventName).toBe(input.hook_event_name);
  return out.additionalContext;
}
const typed = (command_name: string, session_id = SESSION) =>
  ({ hook_event_name: 'UserPromptExpansion', session_id, expansion_type: 'slash_command', command_name, command_args: '', prompt: '' });
const called = (skill: string, tool_name = 'Skill') =>
  ({ hook_event_name: 'PreToolUse', session_id: SESSION, tool_name, tool_input: { skill }, tool_use_id: 't-1' });
const started = (source: string, session_id = SESSION) => ({ hook_event_name: 'SessionStart', session_id, source });

describe('the options request rides the round skills (#96)', () => {
  it('asks a round skill the person types, bare or under its plugin, for its options as a `- **(a)** label: consequence` list', () => {
    const data = dataFolder();
    for (const name of ['grilling', 'grill-me', 'mattpocock-skills:grill-with-docs']) {
      const context = hook(typed(name), data);
      expect(context).toContain('- **(a)** label: consequence');
      expect(context).toContain('➡️');
    }
  });

  it('asks a round skill Claude calls itself through the Skill tool', () => {
    expect(hook(called('mattpocock-skills:grilling'), dataFolder())).toContain('- **(a)** label: consequence');
  });

  it('leaves every other command, skill and tool alone', () => {
    const data = dataFolder();
    expect(hook(typed('grilling-notes'), data)).toBeUndefined();
    expect(hook(called('tdd'), data)).toBeUndefined();
    expect(hook(called('grilling', 'Read'), data)).toBeUndefined();
    expect(hook(started('compact'), data)).toBeUndefined();
  });

  it('answers nothing, and never fails the hook, on input that is not an event', () => {
    const data = dataFolder();
    expect(hook('not json', data)).toBeUndefined();
    expect(hook({ hook_event_name: 'UserPromptExpansion', session_id: SESSION }, data)).toBeUndefined();
    expect(hook({ ...typed('grilling'), session_id: '../escape' }, data)).toContain('- **(a)** label: consequence');
    expect(readdirSync(data, { recursive: true })).not.toContain('escape');
  });
});

describe('a compaction drops the request, so a session that had it is asked again (#96)', () => {
  it('asks again on every compaction of a session it asked, and never on another session or another start', () => {
    const data = dataFolder();
    hook(typed('grilling'), data);
    expect(hook(started('compact'), data)).toContain('- **(a)** label: consequence');
    expect(hook(started('compact'), data)).toContain('- **(a)** label: consequence');
    expect(hook(started('compact', 'c0ffee00-0000-4000-8000-000000000002'), data)).toBeUndefined();
    expect(hook(started('startup'), data)).toBeUndefined();
    expect(hook(started('resume'), data)).toBeUndefined();
  });

  it('marks a session when Claude called the skill, too', () => {
    const data = dataFolder();
    hook(called('grill-me'), data);
    expect(hook(started('compact'), data)).toContain('- **(a)** label: consequence');
  });

  it('forgets a session not asked for thirty days, the next time it marks one', () => {
    const data = dataFolder();
    const old = 'c0ffee00-0000-4000-8000-00000000000a';
    hook(typed('grilling', old), data);
    const marks = join(data, 'options-sessions');
    const longAgo = new Date(Date.now() - 31 * 24 * 3600 * 1000);
    utimesSync(join(marks, old), longAgo, longAgo);
    hook(typed('grilling'), data);
    expect(readdirSync(marks)).toEqual([SESSION]);
    expect(hook(started('compact', old), data)).toBeUndefined();
  });

  it('counts a compaction as use, so a long session stays marked', () => {
    const data = dataFolder();
    hook(typed('grilling'), data);
    const marker = join(data, 'options-sessions', SESSION);
    const longAgo = new Date(Date.now() - 29 * 24 * 3600 * 1000);
    utimesSync(marker, longAgo, longAgo);
    hook(started('compact'), data);
    expect(Date.now() - statSync(marker).mtimeMs).toBeLessThan(60_000);
  });

  it('keeps working when the marker folder cannot be written', () => {
    const data = dataFolder();
    mkdirSync(data, { recursive: true });
    writeFileSync(join(data, 'options-sessions'), 'a file where the folder should be');
    expect(hook(typed('grilling'), data)).toContain('- **(a)** label: consequence');
    expect(hook(started('compact'), data)).toBeUndefined();
  });
});

describe('the injection marks the session\'s round phase on the server (#99)', () => {
  /** The plugin's layout with a launcher that only records how it was run, one line per run. */
  function plugin() {
    const root = dataFolder();
    mkdirSync(join(root, 'hooks'));
    mkdirSync(join(root, 'server'));
    copyFileSync(SCRIPT, join(root, 'hooks', 'inject.mjs'));
    const log = join(root, 'launched.log');
    writeFileSync(join(root, 'server', 'launcher.cjs'), `require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');`);
    const run = (input: Record<string, unknown>) => execFileSync(process.execPath, [join(root, 'hooks', 'inject.mjs')], {
      input: JSON.stringify(input), env: { ...process.env, CLAUDE_PLUGIN_DATA: join(root, 'data') }, encoding: 'utf8',
    });
    /** The launcher runs detached from the hook, so its runs are read once they have had time to land. */
    const launched = async (expected: number) => {
      for (let i = 0; i < 100 && (!existsSync(log) || readFileSync(log, 'utf8').trim().split('\n').length < expected); i++) await new Promise(done => setTimeout(done, 20));
      await new Promise(done => setTimeout(done, 100));
      return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]) : [];
    };
    return { run, launched };
  }
  const CWD = '/work/project';

  it('runs the launcher\'s phase command with the session, its working directory, and the skill with its arguments when a round skill starts', async () => {
    const { run, launched } = plugin();
    expect(run({ ...typed('grilling'), command_args: 'the history, #102', cwd: CWD })).toContain('label: consequence');
    run({ ...called('mattpocock-skills:grill-me'), tool_input: { skill: 'mattpocock-skills:grill-me', args: '#7' }, cwd: CWD });
    run({ ...called('grill-with-docs'), cwd: CWD });
    expect(await launched(3)).toEqual([
      ['phase', SESSION, CWD, 'grilling', 'the history, #102'],
      ['phase', SESSION, CWD, 'mattpocock-skills:grill-me', '#7'],
      ['phase', SESSION, CWD, 'grill-with-docs', ''],
    ]);
  });

  it('runs nothing on a compaction: the server keeps the phase, and one the person ended stays ended', async () => {
    const { run, launched } = plugin();
    run({ ...typed('grilling'), cwd: CWD });
    expect(run({ ...started('compact'), cwd: CWD })).toContain('label: consequence');
    expect(await launched(2)).toEqual([['phase', SESSION, CWD, 'grilling', '']]);
  });

  it('runs nothing for another skill, a session id that is not plain, or a turn with no working directory', async () => {
    const { run, launched } = plugin();
    run({ ...typed('tdd'), cwd: CWD });
    run({ ...typed('grilling', '../escape'), cwd: CWD });
    run(typed('grilling'));
    expect(await launched(1)).toEqual([]);
  });

  it('runs nothing when to-spec starts: the spec\'s handover ends the phase, it does not open one', async () => {
    const { run, launched } = plugin();
    run({ ...typed('to-spec'), cwd: CWD });
    run({ ...called('mattpocock-skills:to-spec'), cwd: CWD });
    expect(await launched(1)).toEqual([]);
  });
});

describe('the to-spec skill is asked for the closing `Spec: <location>` line (#104)', () => {
  it('asks to-spec, typed or called, bare or under its plugin, to end with the line, and not for options', () => {
    const data = dataFolder();
    for (const context of [hook(typed('to-spec'), data), hook(called('mattpocock-skills:to-spec'), data)]) {
      expect(context).toContain('Spec: <location>');
      expect(context).toMatch(/GitHub issue/);
      expect(context).toMatch(/`pasted`/);
      expect(context).not.toContain('- **(a)** label: consequence');
    }
  });

  it('asks again after a compaction of a session asked, alongside the options request when both were asked', () => {
    const data = dataFolder();
    hook(typed('to-spec'), data);
    const spec = hook(started('compact'), data);
    expect(spec).toContain('Spec: <location>');
    expect(spec).not.toContain('- **(a)** label: consequence');
    hook(typed('grilling'), data);
    const both = hook(started('compact'), data);
    expect(both).toContain('Spec: <location>');
    expect(both).toContain('- **(a)** label: consequence');
  });

  it('leaves a session that only had rounds without the spec request after a compaction', () => {
    const data = dataFolder();
    hook(typed('grilling'), data);
    expect(hook(started('compact'), data)).not.toContain('Spec: <location>');
  });
});
