# A macOS installer (DMG) for the alpha

Date: 2026-10-27. Scope: research before planning a downloadable build. No app source, configuration or dependency is changed.

## Why this research

The alpha runs only from source: `git clone`, `npm ci`, `npm run build`, `npm start` ([README](../../../README.md#try-the-alpha)). That stops anyone who is not a developer, and the launch post asks exactly those people for feedback. The owner asked for a DMG on 2026-10-27 ("procediamo con generazione DMG") and decided four questions the same day:

| Question | Owner's decision |
|---|---|
| Signing | Ad-hoc now, with the steps to open an unverified app in the README; Developer ID and notarization later |
| Architecture | Apple Silicon (arm64) only |
| Tool | `@electron/packager` for the app bundle, macOS `hdiutil` for the disk image |
| Where the DMG is built | A GitHub Actions workflow on a `v*` tag, attaching the DMG to a draft release that the owner publishes |

## Current state

- **Build.** `npm run build` type-checks, bundles the renderer with Vite into `dist/` (5.9 MB, including Mermaid) and bundles the main and preload scripts with esbuild into `dist-electron/` (1.8 MB, CommonJS, only `electron` external) ([build-desktop.mjs](../../../scripts/build-desktop.mjs)). `package.json` `main` is `dist-electron/main.cjs`.
- **No runtime `node_modules`.** Every runtime dependency (React, Mermaid, markdown-it, zod, lucide) is bundled by Vite or esbuild. Prepared fixtures are imported JSON, not files read at run time ([disassemblies.ts](../../../src/fixtures/disassemblies.ts)). A packaged app needs `dist/`, `dist-electron/`, `assets/` and `package.json` only.
- **Start.** `npm start` runs the `electron` binary from `node_modules` on the project folder ([start.mjs](../../../scripts/start.mjs)). The running bundle is `Electron.app`, so the Dock shows the icon only because `main.ts` calls `app.dock.setIcon` with `assets/icon.png` (1024 × 1024).
- **Paths inside the app.** [main.ts](../../../src/desktop/main.ts) resolves the renderer root as `resolve(__dirname, '../dist')` and serves it through the privileged `btw://app` protocol with `net.fetch(pathToFileURL(path))`. Inside an asar archive `__dirname` is `…/app.asar/dist-electron`; Electron's file loading reads asar paths, but this flow has never run packaged.
- **User data.** `app.setName('Break the Wall')` runs before anything else, so settings, disassemblies, progress and credentials live in `~/Library/Application Support/Break the Wall` for the source build. A packaged app with the same name uses the same folder; the owner's Mac already has it.
- **Credentials.** The ChatGPT vault uses Electron `safeStorage`, whose key lives in the macOS Keychain. A Keychain item's access is tied to the code signature of the app that created it; a packaged app with a different (ad-hoc) signature may be asked for access, or may not read credentials stored by the source build. Not yet observed.
- **Sign-in.** The OAuth flow opens the system browser and listens on `127.0.0.1` ([oauth.ts](../../../src/desktop/chatgpt/oauth.ts)); nothing in it depends on how the app is started.
- **CI.** [ci.yml](../../../.github/workflows/ci.yml) runs `npm run check` and `npm run build` on `macos-latest` with Node 22.23.2 and npm 10.9.8, permissions `contents: read`. There is no release workflow; the owner published v0.1.0-alpha by hand (the agent's token cannot create releases).
- **Machine.** The owner's Mac is arm64 with macOS 27.0.1. `codesign`, `hdiutil`, `iconutil`, `sips` and `notarytool` are present. There is no signing identity (`security find-identity -v -p codesigning`: 0 valid identities).

## Options considered

| Choice | Option | Notes |
|---|---|---|
| Bundle | `@electron/packager` 20.3.0 (published by the Electron project; last modified 2026-08-11) | Renames the app and its helpers, writes `Info.plist`, packs `app.asar`, sets the icon. A dry run adds 105 packages to development dependencies only. Its own ad-hoc signing path through `@electron/osx-sign` is not confirmed; `codesign --force --deep --sign -` is the fallback. |
| Bundle | `electron-builder` | Bundle, DMG, signing and notarization from configuration, with a much larger dependency tree. Not chosen. |
| Disk image | `hdiutil create -format UDZO` from a folder with the app and an `/Applications` link | Built into macOS: no dependency, no window background or icon layout. |
| Icon | `.icns` from `assets/icon.png` with `sips` and `iconutil` | Built into macOS; generated at package time, not committed. |
| Signing | Ad-hoc (`-`) | Required for arm64 binaries to run at all. Gatekeeper still blocks a downloaded ad-hoc app: since macOS 15 the user opens it from System Settings → Privacy & Security → Open Anyway (the Control-click bypass is gone). |
| Signing | Developer ID + notarization | Needs the Apple Developer Program and secrets in CI. Deferred by the owner. |
| Release | Workflow on `v*` tags with `contents: write`, using `gh` and the workflow's `GITHUB_TOKEN` | Creates a draft pre-release, or uploads to the release if the tag already has one. |

## Constraints and risks

- **The existing tag cannot carry a DMG.** `v0.1.0-alpha` points at a commit without the packaging code, so the first DMG needs a new tag (the owner chooses it, for example `v0.1.1-alpha`). Pushing a tag and publishing a release are external actions that need the owner's confirmation.
- **Gatekeeper wording and steps** on macOS 27 must be seen on a real download (the quarantine flag is set only by the browser), not inferred.
- **Keychain access** after switching from the source build to the packaged app must be witnessed; at worst the learner signs in to ChatGPT again.
- **asar and the `btw://` protocol** must be exercised in the packaged app: the library, a prepared disassembly, Mermaid in a rendered source, and the Dock/app icon.
- **No updates.** Without an updater, each version is a new download; the README must say so.
- **Size.** Electron's arm64 framework is most of the bundle; the DMG is expected around 100 MB compressed. To be measured.
- **CI runner.** `macos-latest` must be arm64 for the arm64 build to be tested on its own architecture; the workflow names an arm64 runner explicitly rather than relying on the alias.

## Recommendation

Plan a small, separate change: a `npm run package` script (packager + ad-hoc signature + `hdiutil`, with a checksum), the guards the packaged app needs in `main.ts`, a tag-driven release workflow, and the install instructions. Verify it with an automated start of the packaged binary and a witnessed install from a downloaded draft release on the owner's Mac. Keep Developer ID signing and notarization as a later, owner-gated step with the hooks in place.
