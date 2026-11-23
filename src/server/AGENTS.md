# Local server (src/server)

## Overview

The one local server per person behind the page `/break-the-wall` opens: its lock file, its HTTP API and the launcher the mod runs. Plain Node, no Electron or React. Every decision the mod could make lives here, where tests reach it.

## Key files

| File | Owns |
|---|---|
| `server.ts` | `startLocalServer`: the guard (Host, Origin, secret, no CORS), static page, presence (session leases, page polls), idle stop, and the round API: turns in, the latest round, drafts, Send, the mod's delivery long-poll |
| `rounds.ts` | `RoundStore`: rounds, drafts and sent messages under `<userData>/rounds/projects/<hash of cwd>/<session>/round-<n>.json`, one versioned file per round, replaced atomically, Zod-checked on read |
| `lock.ts` | `<userData>/rounds/server.lock` (port, pid, version, secret; `0600`), created whole by hard link, and `serverStatus` |
| `launch.ts`, `launcher.ts` | `node launcher.cjs start \| open`: find or start the server detached, open a tab only when no page polls |
| `main.ts` | The detached server process; serves `../page` beside its bundle |

The status contract and the secret header are in `src/core/local-server.ts`, shared with the page. The round format (`src/core/round.ts`) and the answers, the page's view of a round and the return message (`src/core/round-answers.ts`) are shared with the page too: the page previews the message with the function the server sends it with.

## Conventions

- A new endpoint sits behind the guard in `server.ts` and parses its body with Zod. A reply read elsewhere goes through a schema in `src/core/local-server.ts`.
- Tests drive the server over HTTP in process (`tests/local-server.test.ts`) and the launcher as real processes from an esbuild bundle (`tests/launcher.test.ts`); `npm run smoke:page` opens the built page in Chrome.

## Gotchas

- The lock decides: a server whose lock file names another server stops at its next idle check. That is how a lost start race ends with one server.
- A `/api/status` call restarts the idle clock, so a launcher that just found the server never sees it stop under it.
- The server listens on a random port: after a restart an open tab cannot reconnect, and says to open the page from Claude Code again.
- `BTW_USER_DATA_DIR` isolates the data folder, as in the app; tests and `smoke:page` rely on it.
- The delivery poll is held 20 s, below `$.http.fetch`'s 30 s per call. A message handed to a poll is leased (10 minutes, in memory) and counts as delivered only when the mod confirms it submitted it; unconfirmed, it comes back after the lease or a restart. The lease is long because `$.prompt.submit` first waits for the session to be idle.
- A session id names a folder, so every route that takes one checks it against `sessionIdSchema` first.

## Related

- [docs/research/claude-code-round-trip.md](../../docs/research/claude-code-round-trip.md): why a mod plus a detached server, and the mods API limits behind it.
