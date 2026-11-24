# Claude Code plugin (plugin)

## Overview

The plugin `claude --plugin-dir plugin` loads: a mod (`hooks/register.ts`) that checks Node, runs `server/launcher.cjs`, keeps the session registered, serves `/break-the-wall`, posts every turn's final text on `turn.complete`, reports a session's end on `session.end` and registers the id `/clear` or `/resume` goes on under (#102), and long-polls the server for answers it submits with `$.prompt.submit({ asUser: true })` and then confirms. `server/` and `page/` are build output of `npm run build:plugin`.

Beside the mod, `hooks/hooks.json` declares classic command hooks running `hooks/inject.mjs` (#96): on `UserPromptExpansion`, `PreToolUse` on `Skill` and `SessionStart` on `compact`, it asks the round skills (`grilling`, `grill-me`, `grill-with-docs`) for options as `- **(a)** label: consequence`, and re-asks after a compaction in a session marked under `$CLAUDE_PLUGIN_DATA/options-sessions/`. A round skill starting (not a compaction) is also the injection marker that opens the session's round phase (#99): it runs `server/launcher.cjs phase <session> <cwd>` detached, so the skill's start never waits. `tests/plugin-injection.test.ts` runs it as Claude Code does, stdin to stdout.

## Conventions

- The mod is a thin adapter: logic goes to `src/server`, where Vitest reaches it; the mod forwards what the engine reports and decides nothing. What it still owns is the order of its calls (submit, then confirm), held by `hooks/register.test.ts`.
- Its tests run under `claude plugin test plugin` with the engine's kit (`claude-code/testing`): the test answers every call the mod makes on `$` with `{ value }` as Claude Code would, and acts as the bottom of the events it raises (`session.start`, `turn.complete`).
- Its own words live in both languages in `hooks/messages.ts`, since "needs Node" must be said when no server can run.
- `npm run check:plugin` is its check: Claude Code's validator, the mod's tests, and `tsc -p plugin` once types are laid.

## Gotchas

- The validator refuses `$` passed to anything but a function declared at the module's top level: state the hooks share sits at module level, not in a closure inside `register`.
- `$.process.run` waits until the child's pipes close: a child that starts a long-lived process must detach it with no pipes back (the launcher does).
- `$.clock.sleep` counts against the hook's own time; awaiting `$.http.fetch` does not. The delivery loop is therefore a chain of `$.clock.after` timers, each running one held poll.
- Until the engine lays the types, the mod type-checks against the `claude-code.d.ts` the `plugin-authoring` skill writes, from a tsconfig kept outside the repository.
- The mod imports only files of the plugin, never `src/`: the secret header and the status shape are restated there by hand. For the same reason it has no Zod: a reply it reads (the launcher's line, a delivery) is checked field by field with `typeof` before use, the one exception to the root rule. `hooks/inject.mjs` shares it, for the same reason: it is plain Node with no dependencies, so it checks Claude Code's hook input the same way.
- A mod's `classic.*` and `skill.prompt` hooks can be skipped: on 2.1.330 the built-in `cc-plugin-sec-default` runs first on `classic.PreToolUse`, `classic.SessionStart` and `skill.prompt` and passes the event on past every other plugin (the transcript says "hook was skipped"). Classic command hooks in `hooks.json` still run, which is why the injection is one (witnessed, #96). `check:plugin` fails on such a mod hook (`scripts/mod-hooks.mjs`).
- The engine writes the `claude-code` types into `.claude-plugin/types/` only when an interactive session loads the plugin; `claude plugin test` and `claude -p --plugin-dir` do not (witnessed on 2.1.330). Until then `tsc -p plugin` has nothing to check against, and CI never type-checks the mod: `check:plugin` flags the skip there with a warning.

## Related

- [docs/research/claude-code-round-trip.md](../docs/research/claude-code-round-trip.md): the mods API facts and the pattern this mod follows.
