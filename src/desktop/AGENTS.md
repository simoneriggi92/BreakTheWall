# Desktop host (src/desktop)

## Overview

The Electron main process and its preload. It owns every file, network and credential operation, so the renderer never has to. It also hosts the local entry point the MCP server talks to, and the Windows installer hooks.

## Key files

| File | Owns |
|---|---|
| `main.ts` | Window, `btw://app` protocol, navigation and permission rules, every `ipcMain` handler |
| `preload.ts` | The named bridge the renderer sees (`DesktopBridge`, `StudioBridge` from `src/core`) |
| `incoming.ts` | Local socket or pipe for AI assistants, off unless the learner turns on "Connect AI assistants" |
| `chatgpt/` | Sign in with ChatGPT (OAuth on a one shot `127.0.0.1` listener) and the Responses calls |
| `local/runtimes.ts` | Discovery and schema mechanism per local model server (loopback only) |
| `*-store.ts`, `secure-files.ts` | Versioned files under `<userData>`, replaced atomically; credentials through `safeStorage` |
| `squirrel.ts` | Windows install, update and uninstall shortcuts |

## Conventions

- A new desktop operation is one named `ipcRenderer.invoke` in `preload.ts` with its handler in `main.ts`. Never expose a generic IPC, shell or filesystem call.
- Every `ipcMain.handle` starts with `trustedSender(event)`, which refuses any frame outside the app origin. A new handler without it is a hole.
- Validate everything that crosses the bridge with the Zod schemas in `src/core`: the handler parses its input, and the preload drops what arrives from the host and does not parse.
- Network calls happen only here, in the main process. The local model route accepts only `127.0.0.1`, `localhost` or `[::1]`.
- Keep the window locked: `sandbox`, `contextIsolation`, no `nodeIntegration`, denied permissions, no new windows, navigation only inside the app origin. The production content policy is not loosened.
- Credentials never go in plain files or renderer state. Without the macOS Keychain, sign in is disabled rather than stored in plain text.

## Gotchas

- `BTW_USER_DATA_DIR` (absolute path) isolates a run's data folder; `incoming.ts` derives the socket address from it, so the MCP server must see the same value.
- `BTW_SMOKE_TEST=1` makes the main process exit 0 once the library is drawn, 1 otherwise. CI and both packaging scripts rely on it.
- `npm run dev` reloads renderer changes only. Restart it after changing `main.ts` or `preload.ts`.
- `incoming.ts` is imported by `src/mcp`, which runs as plain Node: keep it free of `electron` imports.

## Related specs

- [docs/development.md](../../docs/development.md#boundaries): boundaries, data layout and packaging in full.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
