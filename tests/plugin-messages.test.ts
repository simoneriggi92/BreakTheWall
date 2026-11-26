// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIN_CLAUDE_CODE, claudeCodeIsSupported, pluginRootFrom } from '../plugin/hooks/engine-support';
import { MOD_MESSAGES, modMessages, nodeIsSupported } from '../plugin/hooks/messages';

describe('what /break-the-wall says when it cannot run (#94)', () => {
  it('names Node ≥ 22 on PATH, in both languages', () => {
    expect(MOD_MESSAGES.en.nodeMissing).toBe('Break the Wall needs Node ≥ 22 on PATH');
    expect(MOD_MESSAGES.it.nodeMissing).toBe('Break the Wall richiede Node ≥ 22 nel PATH');
    expect(modMessages('it-IT')).toBe(MOD_MESSAGES.it);
    expect(modMessages('en-US')).toBe(MOD_MESSAGES.en);
    expect(modMessages(undefined)).toBe(MOD_MESSAGES.en);
  });

  it('accepts Node 22 and later, and nothing else', () => {
    expect(nodeIsSupported('v22.23.2\n')).toBe(true);
    expect(nodeIsSupported('v24.1.0')).toBe(true);
    expect(nodeIsSupported('v20.19.0')).toBe(false);
    expect(nodeIsSupported('v8.0.0')).toBe(false);
    expect(nodeIsSupported('')).toBe(false);
    expect(nodeIsSupported('node: command not found')).toBe(false);
  });
});

describe('the Claude Code the plugin needs (#145)', () => {
  const manifest = JSON.parse(readFileSync('plugin/.claude-plugin/plugin.json', 'utf8'));

  it('declares it in plugin.json from the oldest Claude Code the mod has been witnessed on, the one the mod checks', () => {
    expect(MIN_CLAUDE_CODE).toBe('2.1.330');
    expect(manifest.engines).toEqual({ 'claude-code': `>=${MIN_CLAUDE_CODE}` });
  });

  it('names that version, and claude update, in both languages', () => {
    expect(MOD_MESSAGES.en.outdated).toBe(`Break the Wall needs Claude Code ${MIN_CLAUDE_CODE} or later: run claude update, then start a new session.`);
    expect(MOD_MESSAGES.it.outdated).toBe(`Break the Wall richiede Claude Code ${MIN_CLAUDE_CODE} o successivo: esegui claude update e apri una nuova sessione.`);
  });

  it('accepts that version and later ones, development builds included, and nothing older', () => {
    expect(claudeCodeIsSupported('2.1.330')).toBe(true);
    expect(claudeCodeIsSupported('2.1.332')).toBe(true);
    expect(claudeCodeIsSupported('2.2.0')).toBe(true);
    expect(claudeCodeIsSupported('3.0.0')).toBe(true);
    expect(claudeCodeIsSupported('2.1.331-dev.20261120.t101500.sha1a2b3c4')).toBe(true);
    expect(claudeCodeIsSupported('2.1.318')).toBe(false);
    expect(claudeCodeIsSupported('2.1.329')).toBe(false);
    expect(claudeCodeIsSupported('2.0.999')).toBe(false);
    expect(claudeCodeIsSupported('')).toBe(false);
  });
});

describe('the plugin folder the mod launches from (#145)', () => {
  const hookEnv = (env: Record<string, string>) => {
    const calls = { count: 0 };
    return { calls, read: async () => { calls.count++; return env; } };
  };

  it('takes $.plugin.root, with no call on hookEnv, which Claude Code before 2.1.326 lacks', async () => {
    const env = hookEnv({ CLAUDE_PLUGIN_ROOT: '/from/hook-env' });
    await expect(pluginRootFrom(() => '/from/plugin-root', env.read)).resolves.toBe('/from/plugin-root');
    expect(env.calls.count).toBe(0);
  });

  it('falls back to hookEnv on a build without $.plugin, where reading it throws, or without its root', async () => {
    const env = hookEnv({ CLAUDE_PLUGIN_ROOT: '/from/hook-env' });
    await expect(pluginRootFrom(() => { throw new TypeError("undefined is not an object (evaluating '$.plugin.root')"); }, env.read)).resolves.toBe('/from/hook-env');
    await expect(pluginRootFrom(() => undefined, env.read)).resolves.toBe('/from/hook-env');
    await expect(pluginRootFrom(() => '', env.read)).resolves.toBe('/from/hook-env');
    expect(env.calls.count).toBe(3);
  });

  it('names the missing folder rather than launching a script at the root of the disk', async () => {
    await expect(pluginRootFrom(() => undefined, hookEnv({}).read)).rejects.toThrow(/CLAUDE_PLUGIN_ROOT/);
  });
});

describe('where /break-the-wall says the page is (#147)', () => {
  const url = 'http://127.0.0.1:4000/#t=s3cret';

  it('names the address once it opened the page, in both languages', () => {
    expect(MOD_MESSAGES.en.opened(url)).toBe(`Break the Wall is open in the browser: ${url}`);
    expect(MOD_MESSAGES.it.opened(url)).toBe(`Break the Wall è aperto nel browser: ${url}`);
  });

  it('names the address when a page is already open, to reopen a tab closed a moment ago', () => {
    expect(MOD_MESSAGES.en.alreadyOpen(url)).toBe(`Break the Wall is already open in a browser tab. If you closed it, open ${url}`);
    expect(MOD_MESSAGES.it.alreadyOpen(url)).toBe(`Break the Wall è già aperto in una scheda del browser. Se l’hai chiusa, apri ${url}`);
  });
});
