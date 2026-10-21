# Generation phase verification

Date: 2026-10-21. Scope: T4–T6, in progress. Branch `feature/generation`. Toolchain as in [player verification](player-verification.md).

## Provider documentation used

Sign in with ChatGPT for open-source, locally hosted apps, read on 2026-10-21: [overview](https://developers.openai.com/siwc/token-sharing-open-source), [registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [token reference](https://developers.openai.com/siwc/token-sharing-open-source/token-reference), [errors and recovery](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations). Endpoints match the published [OpenID configuration](https://auth.openai.com/.well-known/openid-configuration).

The documentation neither lists nor excludes structured outputs (`text.format` with a JSON Schema) for this route. The first live request settles it.

## What is implemented

- **T4:** pasted text and selected UTF-8 `.txt` / `.md` files become source records. Bounds: 4 sources, 40,000 characters per source, 60,000 in total, 1,500 lines, 4,000 characters per line, 160 kB per file. File size is checked before the file is read; only the selected files are opened. The preview shows the numbered lines that are sent, and "Cosa verrà inviato" shows the exact request text. The host re-verifies text, hash and bounds before any request.
- **T5:** OAuth with PKCE in the system browser and a loopback callback on `127.0.0.1`. The ID token is verified against OpenAI's JWKS (RS256, issuer, audience, expiry, nonce). Plan permission is read from the granted scopes. Tokens are encrypted with Electron `safeStorage`; there is no plaintext fallback. Refresh is serialized, and only documented terminal refresh codes end a session. Sign-out revokes the refresh token and keeps the registration. Available models come from `GET /v1/models`.
- **T6:** one streamed Responses request (`store: false`, `stream: true`) with a strict JSON Schema draft. The model cites line ranges and the host copies the quotes. The completed result passes the lesson contract and a minimum route check (≥3 pages, a map, ≥3 representations, activities, spans ≤80 lines) before an atomic save. Generated lessons are labelled "Generato con AI" with the model name.

## Evidence so far

| Check | Level | Result |
|---|---|---|
| `npm run check` | automated test | exit 0, 68 tests: 18 contract, 15 player, 3 progress store, 6 source import, 6 lesson assembly, 14 provider/account/generation, 6 studio interaction |
| `npm run build` | targeted build | exit 0, same harmless `"use client"` warning as the player phase |
| Import cases | automated test | Valid paste, pasted code and `.md` with BOM/CRLF are accepted. Empty, missing title, non-UTF-8, binary, `.pdf`, `.ts`, extensionless, over-size file, over-length text, too many lines, over-long line, too many sources, duplicates and over-total selections are refused. Tampered or prepared-origin sources are refused by the host |
| Preview equals request | automated test | Request text equals the goal plus each source's numbered lines; the renderer's "Cosa verrà inviato" shows the same string; nothing is sent before "Genera" |
| Failure states | automated test, fake transport | Browser denial, cancelled sign-in, missing plan scope, transient and terminal refresh failures, usage limit (before and during streaming), not eligible, unsupported capability, unavailable model, 503, incomplete stream, refusal, network failure and cancellation each map to a recoverable state. ID tokens with a bad signature, unknown key, wrong nonce, audience or issuer, or an expired token are rejected |
| Save boundaries | automated test | Invalid output and cancellation write nothing and keep earlier lessons; a busy generator refuses a second request; unreadable saved lessons are skipped, counted and left on disk |
| Studio layout | witnessed screenshots of the production build | Library with filled studio at 1440, 1024 and 720 px, dark mode, no horizontal overflow |
| Live sign-in | witnessed: owner signed in through the system browser in the production build, isolated `BTW_USER_DATA_DIR` | App reported signed in with plan usage granted. `GET /v1/models` returned 7 visible models. The credentials file is encrypted (mode 0600, no token-like strings); the app log contains no token-like strings |
| Live inference | **blocked** | The owner's plan usage was exhausted at sign-in time and resets later. No generation request has been sent |

Defects found and fixed during implementation:

- A sign-in cancelled before the loopback port opened was lost, so the sign-in never ended. The provider test caught it; the listener now honors an already-aborted signal.
- Progress saves resolved generated lessons asynchronously before queueing, so two quick saves could land out of order. Lookup now runs inside the write queue.

## Remaining for T5–T6

1. When usage is available, run one generation per domain (code and non-code) in the production build, signed in with the stored session.
2. Review the generated claims against their cited lines; record mistakes rather than counting a render as correct.
3. Restart the app and confirm that a generated lesson reopens with page/frame, attempts and notes, without a new request.

Known limitations so far:

- Electron 45 reports the synchronous `safeStorage` calls as deprecated. They work; moving to the async API is a follow-up.
- Signing in with a different ChatGPT account on the same installation is refused. Switching accounts currently requires clearing the app's credential file.
- `GET /v1/models` succeeding is not proof that inference with structured output is accepted for this route.
