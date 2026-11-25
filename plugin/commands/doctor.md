---
description: Find out why Break the Wall does not open · Scopri perché Break the Wall non si apre
---

The person ran `/break-the-wall:doctor` because Break the Wall's page does not open, or `/break-the-wall` is missing or does nothing. Break the Wall is a Claude Code plugin: a mod (a hooks module) checks Node, starts a local server and registers `/break-the-wall`. This command is a plain prompt, so it is here even when the mod is blocked; find what is blocking it.

Check each point below in order. Only read and run the commands named here: change no setting and no file, because a policy belongs to the person or to their organization. If a check cannot be made, say so and go on.

1. **Node.** Run `node --version`. The server needs Node 22 or later on the `PATH` Claude Code was started with. If it is missing or older, the fix is "Break the Wall needs Node ≥ 22 on PATH": install Node 22 or later, or start Claude Code from a shell where `node` is that version (a version manager such as nvm sets `PATH` only in the shells that load it).

2. **Whether mods can load at all.** In a new empty temporary folder (not the project, which may hold a mod of its own), run `claude plugin test`.
   - `no hooks module to load`: mods can load here.
   - `hooks modules are turned off here`: `disableAllHooks` or the organization's `allowManagedHooksOnly` blocks every installed mod; point 3 says which.
   - `the rollout switch`: Anthropic has turned installed mods off; nothing on this machine changes that.

3. **Policy settings.** Read the files that exist among these and look for the keys named below:
   - managed settings: `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS), `/etc/claude-code/managed-settings.json` (Linux and WSL), `C:\Program Files\ClaudeCode\managed-settings.json` (Windows), and every `*.json` in the `managed-settings.d/` folder beside it;
   - the person's own: `~/.claude/settings.json`, and in the project `.claude/settings.json` and `.claude/settings.local.json`.

   The keys:
   - `"disableAllHooks": true`: no hook and no mod runs, so `/break-the-wall` is missing. In the person's own files, they can remove it; in managed settings, only their administrator can.
   - `"allowManagedHooksOnly": true` (managed only): only the organization's mods load, so `/break-the-wall` is missing.
   - `"allowManagedModsOnly": true` under `pluginConfigs` → `cc-plugin-sec-default@builtin` → `options` (managed only): the organization allows only its own mods, so this one is refused.
   - `enabledPlugins` with `"break-the-wall@break-the-wall": false`: the plugin is turned off; `/plugin` turns it on again.

   An organization can also deliver these from the claude.ai admin console, which leaves no file here. The `Setting sources` line of `/status` names the managed source in force, and the debug log (point 4) has the refusal.

4. **The debug log.** Claude Code writes one only for a session started with `claude --debug`, under `~/.claude/debug/` (the newest file; `latest` points to it). Search it for `break-the-wall`:
   - `hooks module break-the-wall@break-the-wall not loaded:` followed by a reason: `disableAllHooks in managed settings`, or `only managed plugins and built-in plugins run` (`allowManagedHooksOnly`, or `disableAllHooks` in a settings file of the person's own);
   - `mods are limited to your organization's by policy (allowManagedModsOnly)`;
   - `hook skipped` or `did not load`, with the reason after it;
   - lines starting `break-the-wall:`, which the mod writes when the server would not start or the page would not open.

   If there is no debug log for this session, ask the person to start Claude Code again with `claude --debug`, run `/break-the-wall` once, and then this command again.

This command running at all means the session is not in `--safe-mode`, which loads no installed plugin (this command included).

Answer in the language the person writes in. Give one line per point: what you found, and the one thing to do about it. End with the most likely cause, or say that every check passed and quote the last `break-the-wall` lines of the debug log.
