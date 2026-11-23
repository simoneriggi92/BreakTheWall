# Local server (src/server)

## Overview

The one local server per person behind the page `/break-the-wall` opens: its lock file, its HTTP API and the launcher the mod runs. Plain Node, no Electron or React. Every decision the mod could make lives here, where tests reach it.

## Key files

| File | Owns |
|---|---|
| `server.ts` | `startLocalServer`: the guard (Host, Origin, secret, no CORS), static page, presence (session leases, page polls), idle stop |
| `lock.ts` | `<userData>/rounds/server.lock` (port, pid, version, secret; `0600`), created whole by hard link, and `serverStatus` |
| `launch.ts`, `launcher.ts` | `node launcher.cjs start \| open`: find or start the server detached, open a tab only when no page polls |
| `main.ts` | The detached server process; serves `../page` beside its bundle |

The status contract and the secret header are in `src/core/local-server.ts`, shared with the page.

## Conventions

- A new endpoint sits behind the guard in `server.ts` and parses its body with Zod. A reply read elsewhere goes through a schema in `src/core/local-server.ts`.
- Tests drive the server over HTTP in process (`tests/local-server.test.ts`) and the launcher as real processes from an esbuild bundle (`tests/launcher.test.ts`); `npm run smoke:page` opens the built page in Chrome.

## Gotchas

- The lock decides: a server whose lock file names another server stops at its next idle check. That is how a lost start race ends with one server.
- A `/api/status` call restarts the idle clock, so a launcher that just found the server never sees it stop under it.
- The server listens on a random port: after a restart an open tab cannot reconnect, and says to open the page from Claude Code again.
- `BTW_USER_DATA_DIR` isolates the data folder, as in the app; tests and `smoke:page` rely on it.

## Related

- [docs/research/claude-code-round-trip.md](../../docs/research/claude-code-round-trip.md): why a mod plus a detached server, and the mods API limits behind it.
