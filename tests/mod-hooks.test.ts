// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { skippedModHooks } from '../scripts/mod-hooks.mjs';

/** What `claude plugin validate plugin` prints about the mod's hooks, as Claude Code 2.1.330 words it. */
const validated = (hooks: string) => [
  'Validating hooks: /work/plugin/hooks/hooks.json',
  '',
  `  ❯ ./register.ts hooks: ${hooks}`,
  '  ❯ ./register.ts calls: $.clock.after (via pollDelivery)',
  '',
  'Provides:',
  '  ❯ hooks: PreToolUse Skill command "node \\"${CLAUDE_PLUGIN_ROOT}/hooks/inject.mjs\\""',
].join('\n');

describe('the mod hooks no event the engine skips past it (#96)', () => {
  it('names each classic.* or skill.prompt hook the validator lists for a hooks module', () => {
    expect(skippedModHooks(validated('session.start, classic.PreToolUse{tool=Skill}, turn.complete, skill.prompt, classic.SessionStart'))).toEqual([
      'classic.PreToolUse', 'skill.prompt', 'classic.SessionStart',
    ]);
  });

  it('passes the mod as it is, and the plugin\'s classic command hooks', () => {
    expect(skippedModHooks(validated('session.start, turn.complete, command.run{command=break-the-wall}'))).toEqual([]);
  });
});
