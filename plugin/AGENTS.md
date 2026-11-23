# Claude Code plugin (plugin)

## Overview

The plugin `claude --plugin-dir plugin` loads: a mod (`hooks/register.ts`) that checks Node, runs `server/launcher.cjs`, keeps the session registered and serves `/break-the-wall`. `server/` and `page/` are build output of `npm run build:plugin`.

## Conventions

- The mod is a thin adapter: it runs only inside Claude Code and has no automated test. Logic goes to `src/server`; the mod forwards.
- Its own words live in both languages in `hooks/messages.ts`, since "needs Node" must be said when no server can run.
- `npm run check:plugin` is its check: Claude Code's validator, and `tsc -p plugin` once types are laid.

## Gotchas

- The validator refuses `$` passed to anything but a function declared at the module's top level: state the hooks share sits at module level, not in a closure inside `register`.
- `$.process.run` waits until the child's pipes close: a child that starts a long-lived process must detach it with no pipes back (the launcher does).
- The mod imports only files of the plugin, never `src/`: the secret header and the status shape are restated there by hand.
- The engine writes the `claude-code` types into `.claude-plugin/types/` on the first load; until then `tsc -p plugin` has nothing to check against.

## Related

- [docs/research/claude-code-round-trip.md](../docs/research/claude-code-round-trip.md): the mods API facts and the pattern this mod follows.
