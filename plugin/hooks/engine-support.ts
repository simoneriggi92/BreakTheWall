/**
 * What the mod needs of the Claude Code it runs on (#145). The mods API is early access and grows by release: a call
 * on `$` that a build lacks throws a TypeError where it is made. Kept apart from register.ts so that Vitest reaches
 * it; register.ts hands in the engine's calls.
 */

/** The oldest Claude Code the mod has been witnessed on; plugin.json's `engines` range starts here too. */
export const MIN_CLAUDE_CODE = '2.1.330';

/** Whether a Claude Code version (`2.1.332`, or a development build's `2.1.332-dev.…`) is at least `MIN_CLAUDE_CODE`. */
export function claudeCodeIsSupported(version: string): boolean {
  const release = (v: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())?.slice(1).map(Number);
  const have = release(version);
  const need = release(MIN_CLAUDE_CODE);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) if (have[i] !== need[i]) return have[i]! > need[i]!;
  return true;
}

/**
 * The plugin's folder: `$.plugin.root`, a property and no call, and `hookEnv()` only where it is missing. Claude Code
 * before 2.1.326 has no `hookEnv`; which build first has `$.plugin.root` is not known, so neither is assumed. Reading
 * it on a build without `$.plugin` throws, hence the try.
 */
export async function pluginRootFrom(readRoot: () => unknown, hookEnv: () => Promise<Record<string, string | undefined>>): Promise<string> {
  let root: unknown;
  try { root = readRoot(); } catch { root = undefined; }
  if (typeof root === 'string' && root) return root;
  const fromEnv = (await hookEnv()).CLAUDE_PLUGIN_ROOT;
  // Without it the launcher would be looked for at the root of the disk, and fail as an unreadable reply.
  if (!fromEnv) throw new Error('Claude Code named no plugin folder: neither $.plugin.root nor CLAUDE_PLUGIN_ROOT.');
  return fromEnv;
}
