/**
 * The mod's hooks the engine may run past it (#96). On Claude Code 2.1.330 the built-in `cc-plugin-sec-default` runs
 * first on `classic.*` events and `skill.prompt` and passes them on past every other plugin, so a mod hook there
 * passes its kit tests and never runs in a session. A classic command hook in `hooks/hooks.json` runs; see
 * plugin/AGENTS.md. Read from `claude plugin validate`'s own list of each hooks module's hooks, not from the source.
 */
const MODULE_HOOKS = /\S+\.(?:tsx?|mjs|js)\s+hooks:\s+(.+)$/;

/** Each event a hooks module hooks that the engine may skip, in the order the validator lists them. */
export function skippedModHooks(validateOutput) {
  const skipped = [];
  for (const line of validateOutput.split('\n')) {
    const listed = MODULE_HOOKS.exec(line)?.[1];
    if (!listed) continue;
    // A matcher's braces may hold a comma of their own: split only between hooks.
    for (const hook of listed.split(/,\s*(?![^{]*\})/)) {
      const event = hook.trim().split('{')[0];
      if (event.startsWith('classic.') || event === 'skill.prompt') skipped.push(event);
    }
  }
  return skipped;
}
