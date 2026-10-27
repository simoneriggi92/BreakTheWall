# Review of P-20261027-macos-dmg v1

Date: 2026-10-27. Reviewer: the agent, before asking for approval.

| # | Finding | Resolution |
|---|---|---|
| 1 | Two plans would be implementing at once (P-20261024-disassembly is `implementing`). | Resolved: the plan's preconditions move P-20261024-disassembly to `blocked` on approval, with its waiting reason, and back when this plan completes. |
| 2 | The start check (`BTW_SMOKE_TEST=1`) adds a test path to production code. | Accepted: it is opt-in, only reads the page and exits, and is the only automated proof that asar, the `btw://` protocol and the renderer work together in the packaged app. |
| 3 | The minimum macOS version is not stated. | Resolved in scope: K5 states it from the packaged `Info.plist` (`LSMinimumSystemVersion`, set from Electron), confirmed in K6. |
| 4 | `macos-latest` may change architecture. | Resolved: K4 names an arm64 runner and the job checks `uname -m` before building. |
| 5 | The packager downloads Electron for the target at build time. | Accepted: it uses the version pinned in `package.json` through `@electron/get`'s cache; CI has network access. |
| 6 | Ad-hoc signatures change with each release; the Keychain may ask again. | Accepted as a residual risk, written in the plan and to be recorded in K6. |
| 7 | The first DMG cannot be attached to `v0.1.0-alpha`, whose commit has no packaging code. | Resolved: K6 uses a new tag chosen and confirmed by the owner. |

No open findings.
