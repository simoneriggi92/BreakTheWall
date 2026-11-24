# Local server (src/server)

## Overview

The one local server per person behind the page `/break-the-wall` opens: its lock file, its HTTP API and the launcher the mod runs. Plain Node, no Electron or React. Every decision the mod could make lives here, where tests reach it.

## Key files

| File | Owns |
|---|---|
| `server.ts` | `startLocalServer`: the guard (Host, Origin, secret, no CORS), static page, presence (session leases, page polls), idle stop, and the round API: turns in, what the page shows (`/api/current`), drafts and responses, the fold of the agent's text (`PUT …/fold`, any entry, sent or not, #126), Send, the round phase, the mod's delivery long-poll |
| `rounds.ts` | `RoundStore`: rounds, free blocks, their drafts, whether their agent's text is folded (#126) and sent messages, remarks on a spec sent alone (#105), and each session's round phase, under `<userData>/rounds/projects/<hash of cwd>/<session>/` (`round-<n>.json`, `free-<n>.json`, `remarks-<n>.json`, `phase.json`), one versioned file each, replaced atomically, Zod-checked on read |
| `sessions.ts` | Sessions across projects (#102): the history column (`/api/history`), a past round (`GET /api/rounds/:s/:n`), deleting a session (its side chats stopped and forgotten first, and the spec versions it handed over deleted with their remarks and explorations, a structure still being written stopped), a session's end from the mod, an update that waits; `SessionLabels`, the skill and ticket a session began with (`session.json`); `SessionTranscripts`, where Claude Code keeps each session's transcript (`transcript.json`, #103); `SessionModels`, the models it registered with (`models.json`, #100) |
| `side-chats.ts` | Side chats (#100): per question, a `claude -p --resume <session> --fork-session --no-session-persistence` with Read, Grep and Glob only, run in the session's folder when the person asks; a fresh `claude -p` given the round's text when forking fails before a word. `sideChatCommand` words what a run is told and allowed. A turn may quote a passage of the question ("Ask here", #101), which the fork is told. Each side chat kept as `side-chat-<round>-<question>.json` beside the rounds; the page reads a round's side chats with a held read that answers when a reply grows. The process is the injected `runners.sideChat` |
| `specs.ts` | Specs handed over with `Spec: <location>` (#104): read from an issue through `gh`, a file in the session's folder, or the turn's pasted text; stored as numbered versions of their location under `<userData>/rounds/specs/<hash of location>/v<n>.json`; their structure written by the app's exploration generator on the `claude` route and saved in `<userData>/rounds/explorations/`; the spec and exploration endpoints. A handover that cannot be read keeps no version and leaves the round phase as it was; the latest of each session, with why (`unreadableWhySchema`), is listed beside the specs (in memory only) for the page to say. `claude` and `gh` arrive as injected runners (`runners` option), fakes in tests |
| `spec-remarks.ts` | Remarks on a spec (#105): one draft per spec whichever version names it, and what was sent, as `remarks.json` beside its versions; sent to the session that handed over the newest version, alone (`remarks-<n>` in its queue) or riding in the message of its round awaiting answers (`riding`, `rodeWith`, read by the round's view and Send). A remark new to the draft on a superseded version is refused (409) |
| `backing.ts` | The backing check of a spec version (#106), `GET /api/specs/:id/backing`: the statements and references read by `src/core/backing.ts`, resolved without a model: `[R2·Q3]` against the rounds of the session that handed the version over, then of the sessions of its other versions (`RoundStore.cited`); issue, pull request and comment links through the injected `gh` (found links kept for the server's life, four runs at a time); `path:a-b` against the files of the session's folder, never outside it |
| `http.ts` | What every route module answers with: `readJson` (a size cap per route), `send`, `noContent`, and the shared `transcript-gone` refusal |
| `files.ts` | How every store keeps its files: `atomicWrite`, `WriteQueue` (one write at a time per key, settled before a delete), `sessionFolders` for reading them back, and `fileInside`, the one check that a path from a turn or a spec names a file inside the session's folder |
| `gh.ts` | The `gh` runner (`spawnGh`, injected as `runners.gh`), its timeout and the issue fields read |
| `lock.ts` | `<userData>/rounds/server.lock` (port, pid, version, secret; `0600`), created whole by hard link, and `serverStatus` |
| `launch.ts`, `launcher.ts` | `node launcher.cjs start \| open <session> \| phase <session> <cwd> <skill> <args>`: find or start the server detached, replacing an older one only when no other session is registered (else it tells it the update waits), open a tab only when no page polls; `phase` (the injection hook's) opens a session's round phase on a running server, never starting one |
| `main.ts` | The detached server process; serves `../page` beside its bundle |

The status contract and the secret header are in `src/core/local-server.ts`, shared with the page. The round format (`src/core/round.ts`), the answers (with the side-chat exchanges attached to them, copied whole into the draft, #101), the page's view of a round and the return message (`src/core/round-answers.ts`), and the round phase, free blocks and the page's current view (`src/core/round-phase.ts`) are shared with the page too: the page previews the message with the function the server sends it with.

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
- A side chat runs on the plugin's `sideChatModel`, else the model the session registered with; both are kept as `models.json` (`SessionModels`) once the session has a folder, so a restart keeps them. A session that registered with neither runs its side chats on `claude`'s default.
- Remarks on a spec never go out alone while the receiving session has a round awaiting answers: their Send answers 409 `rides` with the round's number, and the round's Send words them after the answers (`answersWithRemarks` in `src/core/spec-remarks.ts`, which the page previews with too).
- Rounds and free blocks are numbered apart (a round's number is what `[R2·Q3]` backing names) but share one `order` per session: supersession and the delivery queue follow it. A delivery goes out with its id (`round-2`, `free-1`), which the mod confirms. A round kept before free blocks existed has no `order`; its number stands in.
- A session is live while its lease runs (in memory, renewed every 30 s by the mod); `POST /api/sessions/:id/end` drops it at once. Nothing about liveness is on disk: after a restart every session is ended until its mod renews. Nothing is cleaned up automatically; only `DELETE /api/sessions/:id` removes a session's folder.
- An ended session still takes answers to its latest round (#103): they wait in its queue, shown `queued` (sent, not delivered, session not live), and go out through the mod's poll once `claude --resume <id>` registers it again. A session's end releases what its mod took and never confirmed, so a resume gets it at once rather than after the lease.
- A session turns read-only only when the mod named its transcript (`$.session.info().transcriptPath`) and that file is gone: drafts, Send, responses and side-chat questions answer 409 `transcript-gone`; reads stay open. The path is kept as `transcript.json` only once the session has a round or free block, so a session that asked nothing gets no folder. The server checks the file exists, never reads it.
- Every message passes through `asText`: a leading `/` or `!` would run as a command, a skill or a shell line once `$.prompt.submit` takes it, so it is escaped with a backslash.

## Related

- [docs/research/claude-code-round-trip.md](../../docs/research/claude-code-round-trip.md): why a mod plus a detached server, and the mods API limits behind it.
