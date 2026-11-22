// @vitest-environment node
import { describe, expect, it } from 'vitest';
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
