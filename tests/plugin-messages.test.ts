// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIN_CLAUDE_CODE, MOD_MESSAGES, claudeCodeIsSupported, modMessages, nodeIsSupported } from '../plugin/hooks/messages';

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
    expect(MOD_MESSAGES.en.outdated).toBe('Break the Wall needs Claude Code 2.1.330 or later: run claude update, then start a new session.');
    expect(MOD_MESSAGES.it.outdated).toBe('Break the Wall richiede Claude Code 2.1.330 o successivo: esegui claude update e apri una nuova sessione.');
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
