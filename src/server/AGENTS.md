# Local server (src/server)

## Overview

The one local server per person behind the page `/break-the-wall` opens: its lock file, its HTTP API and the launcher the mod runs. Plain Node, no Electron or React. Every decision the mod could make lives here, where tests reach it.

## Key files

| File | Owns |
|---|---|
| `server.ts` | `startLocalServer`: the guard (Host, Origin, secret, no CORS), static page, presence (session leases, page polls), idle stop, and the round API: turns in, what the page shows (`/api/current`), drafts and responses, Send, the round phase, the mod's delivery long-poll |
| `rounds.ts` | `RoundStore`: rounds, free blocks, their drafts and sent messages, and each session's round phase, under `<userData>/rounds/projects/<hash of cwd>/<session>/` (`round-<n>.json`, `free-<n>.json`, `phase.json`), one versioned file each, replaced atomically, Zod-checked on read |
| `sessions.ts` | Sessions across projects (#102): the history column (`/api/history`), a past round (`GET /api/rounds/:s/:n`), deleting a session, a session's end from the mod, an update that waits; `SessionLabels`, the skill and ticket a session began with (`session.json`) |
| `lock.ts` | `<userData>/rounds/server.lock` (port, pid, version, secret; `0600`), created whole by hard link, and `serverStatus` |
| `launch.ts`, `launcher.ts` | `node launcher.cjs start \| open <session> \| phase <session> <cwd> <skill> <args>`: find or start the server detached, replacing an older one only when no other session is registered (else it tells it the update waits), open a tab only when no page polls; `phase` (the injection hook's) opens a session's round phase on a running server, never starting one |
| `main.ts` | The detached server process; serves `../page` beside its bundle |

The status contract and the secret header are in `src/core/local-server.ts`, shared with the page. The round format (`src/core/round.ts`), the answers, the page's view of a round and the return message (`src/core/round-answers.ts`), and the round phase, free blocks and the page's current view (`src/core/round-phase.ts`) are shared with the page too: the page previews the message with the function the server sends it with.

## Conventions

- A new endpoint sits behind the guard in `server.ts` and parses its body with Zod. A reply read elsewhere goes through a schema in `src/core/local-server.ts`.
- Tests drive the server over HTTP in process through `tests/local-server-harness.ts` (`useLocalServers` for temporary servers, `serverClient` for the mod's and the page's calls; add a new call there, not in a test file), and the launcher as real processes from an esbuild bundle (`tests/launcher.test.ts`); `npm run smoke:page` opens the built page in Chrome.

## Gotchas

- The lock decides: a server whose lock file names another server stops at its next idle check. That is how a lost start race ends with one server.
- A `/api/status` call restarts the idle clock, so a launcher that just found the server never sees it stop under it.
- The server listens on a random port: after a restart an open tab cannot reconnect, and says to open the page from Claude Code again.
- `BTW_USER_DATA_DIR` isolates the data folder, as in the app; tests and `smoke:page` rely on it.
- The delivery poll is held 20 s, below `$.http.fetch`'s 30 s per call. A message handed to a poll is leased (10 minutes, in memory) and counts as delivered only when the mod confirms it submitted it; unconfirmed, it comes back after the lease or a restart. The lease is long because `$.prompt.submit` first waits for the session to be idle.
- A session id names a folder, so every route that takes one checks it against `sessionIdSchema` first.
- Rounds and free blocks are numbered apart (a round's number is what `[R2·Q3]` backing names) but share one `order` per session: supersession and the delivery queue follow it. A delivery goes out with its id (`round-2`, `free-1`), which the mod confirms. A round kept before free blocks existed has no `order`; its number stands in.
- A session is live while its lease runs (in memory, renewed every 30 s by the mod); `POST /api/sessions/:id/end` drops it at once. Nothing about liveness is on disk: after a restart every session is ended until its mod renews. Nothing is cleaned up automatically; only `DELETE /api/sessions/:id` removes a session's folder.
- Every message passes through `asText`: a leading `/` or `!` would run as a command, a skill or a shell line once `$.prompt.submit` takes it, so it is escaped with a backslash.

## Related

- [docs/research/claude-code-round-trip.md](../../docs/research/claude-code-round-trip.md): why a mod plus a detached server, and the mods API limits behind it.
