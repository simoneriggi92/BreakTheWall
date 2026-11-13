# MCP server (src/mcp)

## Overview

The MCP server that lets Claude Desktop and Claude Code write a structure the app checks. It runs as plain Node (Claude Desktop's own Node, or the app's Electron with `ELECTRON_RUN_AS_NODE=1`) and reaches the app only through the local entry point in `src/desktop/incoming.ts`.

## Key files

| File | Owns |
|---|---|
| `protocol.ts` | MCP over stdio, written by hand: newline delimited JSON-RPC 2.0, no SDK |
| `server.ts` | Tools and the `break` prompt |
| `assistant.ts`, `exploration.ts` | Run the app's own accept functions from `src/core` phase by phase |
| `prompts.json` | The prompt text, read by both the server and the `.mcpb` manifest |
| `main.ts` | Entry point, bundled to `dist-electron/mcp-server.cjs` (target Node 20) |

## Commands

```bash
npm run build   # writes dist-electron/mcp-server.cjs and dist-electron/break-the-wall.mcpb
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"dev","version":"1"}}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist-electron/mcp-server.cjs
```

## Conventions

- Node only: import `src/core`, `src/desktop/incoming.ts` and `node:` modules, never Electron or React.
- Nothing but protocol goes to stdout. Logs go to stderr.
- Checks happen in the app's own accept functions, never in a copy here, so a structure from Claude meets the same rules as one from ChatGPT.
- Change the prompt text only in `prompts.json`; the build reads it for the manifest.

## Gotchas

- Claude Code splits a prompt's arguments on whitespace and passes only the first word (checked 2026-10-28). Never rely on a whole sentence arriving in one argument.
- The server finds the app's socket from the data folder, with `BTW_USER_DATA_DIR` first, exactly as the app does. A mismatch looks like "app not running".
- Packaging unpacks both server files from `app.asar` so other programs can read them; a new file the server needs at runtime must be added there too.

## Related specs

- [docs/development.md](../../docs/development.md#the-mcp-server-claude-desktop-and-claude-code): diagram, build and tests (`tests/mcp-*.test.ts`, `tests/incoming.test.ts`, `tests/assistants.test.ts`).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
