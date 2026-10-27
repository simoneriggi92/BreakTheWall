---
id: P-20261027-windows-alpha
title: A Windows alpha - Windows in CI, platform-aware wording, an unsigned x64 Squirrel installer next to the DMG
version: 1
state: implementing
current_task: W3
last_evidence: W1, W2 verified; W3-W5 implemented - .ico, Squirrel events, package:win, release job; 348 tests and the Mac package pass locally; Windows packaging not run yet
next_action: Push phase package to PR #27 so the Release workflow builds the Windows setup (W4, W5 acceptance)
approval: approved
---

# A Windows alpha

## Outcome

Someone on a Windows x64 PC downloads an installer from the same GitHub release as the DMG, gets past SmartScreen with the steps the README gives, and finds Break the Wall in the Start menu, working as on the Mac. Windows stays working: every pull request runs the checks and the start check on Windows too, and the interface no longer says "this Mac" on a PC.

## Evidence

[Research R-20261027-windows](../../research/R-20261027-windows.md), from the throwaway branch `spike/windows-ci` (run 40532360535): `npm ci`, types and build pass on `windows-latest`; the app starts from source and as a packaged `win32`/`x64` folder (365 MB) and draws the library; two tests fail because they write POSIX paths; 7 interface strings per language name the Mac. Not seen yet: credentials through DPAPI, file dialogs, local models, appearance, an installer, SmartScreen.

## Owner's decisions (2026-10-27)

- Format: a Squirrel installer (`electron-winstaller`), per user, without administrator rights.
- No code signing for this alpha; the README explains SmartScreen's "More info" → "Run anyway".
- x64 only.
- The witnessed install runs in a Windows 11 virtual machine on the owner's Mac (Windows on ARM, running the x64 app through emulation).

## Scope

Included:
- Path-neutral tests and a Windows job in CI.
- Platform-aware wording for the device and the credential store, in English and Italian.
- `assets/icon.ico`, rendered by `npm run brand` and committed like `assets/icon.png`.
- The Squirrel install, update and uninstall events handled in `main.ts` (Start menu and desktop shortcuts), without a new runtime dependency.
- `npm run package:win` on Windows: bundle, start check, installer and checksum; a Windows job in the Release workflow that attaches the installer to the same release as the DMG.
- README, development notes, CHANGELOG, SECURITY and the adapter.

Not included:
- Code signing, Windows on ARM (arm64) builds, automatic updates, Microsoft Store, Linux.
- Any change to disassemblies, generation or storage beyond the wording.

## Preconditions

- **One plan implementing.** On approval, P-20261024-disassembly moves to `blocked` again ("waiting for the owner's witnessed checks (D8, D10); D11–D12 gated"), and returns to `implementing` when this plan completes or the owner resumes it.
- **The new dependency** `electron-winstaller` 5.4.4 is installed exactly, as a development dependency, only after the owner confirms it at implementation time. A dry run adds 99 packages; none ships in the app.
- **External actions** (pushing a tag, creating or publishing a release) only on the owner's explicit confirmation when reached. The spike branch `spike/windows-ci` is deleted once W2 is merged, on the owner's confirmation.

## Tasks

### Phase `ci`

**W1. Path-neutral tests and Windows in CI.**
- `tests/app-files.test.ts` builds its root with `path.resolve`, so the expected paths follow the platform; `tests/eval.test.ts` checks containment with `path.relative` (or `path.sep`) instead of `folder + '/'`.
- `.github/workflows/ci.yml` gains a second job, "Windows: types, tests and build", on `windows-latest`: `npm ci`, `npm run check`, `npm run build`, and the start check from source (`BTW_SMOKE_TEST=1 npm start`). The macOS job keeps its name, "Types, tests and build", which the ruleset requires; whether to require the Windows job too is left to the owner.

Acceptance: both jobs pass on the pull request; the Windows job reports 326 tests passed and "start check: the library is drawn".

### Phase `wording`

**W2. The interface names the right device.** The renderer already receives `platform` from `runtime:get`. The 7 strings per language that say "this Mac", "this Mac's keychain" or the macOS keychain take the device and the credential store from the platform: "this Mac" / "the macOS Keychain" on macOS, "this PC" / "Windows' credential protection" on Windows ("questo Mac" / "il Portachiavi di macOS", "questo PC" / "la protezione delle credenziali di Windows"), and a neutral "this computer" elsewhere. The browser preview keeps today's wording.

Acceptance: `tests/i18n.test.tsx` (or a new test) renders the account and local-model texts for `darwin` and `win32` in both languages and finds no "Mac" in the Windows ones; `npm run check` passes on both CI jobs.

### Phase `package`

**W3. Icon and Squirrel events.**
- `npm run brand` also writes `assets/icon.ico` (16, 24, 32, 48, 64, 128 and 256 px, PNG-encoded entries, written without a new dependency), committed with the other brand assets.
- `src/desktop/squirrel.ts`: a pure function from the process arguments to the action Squirrel asks for (`--squirrel-install`, `--squirrel-updated` → create shortcuts; `--squirrel-uninstall` → remove them; `--squirrel-obsolete` → quit), and `main.ts` running `Update.exe --createShortcut`/`--removeShortcut` for the app and quitting before any window opens, on Windows only.

Acceptance: a unit test covers every argument and the non-Windows case; the `.ico` opens in the Mac's Preview with all sizes.

**W4. Package and installer on Windows.** `scripts/package-win.mjs`, run by `npm run package:win` on a Windows x64 machine (CI):
- `@electron/packager` for `win32`/`x64` with the same `ignore` rule as the Mac (no `node_modules`), the `.ico`, version and copyright;
- the start check on the packaged `Break the Wall.exe` with empty user data;
- `electron-winstaller` builds `release/Break-the-Wall-<version>-x64-setup.exe` (no MSI), with its `.sha256`.

Acceptance: on the Windows runner the script ends with the setup and its checksum, after "start check: the library is drawn".

**W5. Release workflow.** `.github/workflows/release.yml` gains a `windows` job on `windows-latest` (the tag check, `npm ci`, `npm run check`, `npm run package:win`, artifact), runs on pull requests that touch Windows packaging too, and the `release` job waits for both builds and attaches the DMG, the setup and both checksums.

Acceptance: the pull-request run produces both artifacts; the tag path is checked in W7.

### Phase `release`

**W6. Instructions and records.** README: "Try the alpha" gets "Windows (x64)" next to the Mac (requirements, the setup, SmartScreen's "More info" → "Run anyway", the checksum with `certutil` or PowerShell `Get-FileHash`, the Start menu, data in `%APPDATA%\Break the Wall`, what uninstall removes, no automatic updates); the platform badge and status. `docs/development.md`: Windows packaging and the CI job. CHANGELOG, SECURITY (unsigned on Windows too) and the adapter's technical-direction line.

Acceptance: the steps match what W7 observes.

**W7. Witnessed install in the Windows 11 virtual machine.** After the owner confirms the tag and the release workflow attaches the setup to a draft release, the owner downloads it with a browser in the virtual machine and checks:
1. SmartScreen appears and "More info" → "Run anyway" works (wording recorded);
2. the setup installs without administrator rights and Break the Wall is in the Start menu with its icon;
3. the library, Atlas and Mill open; a scenario runs; a Markdown file picked from disk renders, with a Mermaid diagram;
4. ChatGPT sign-in works and survives a restart (DPAPI);
5. a local model server on the host or in the VM is detected if one is running;
6. uninstall from Settings → Apps removes the app and its shortcuts; the data folder stays, as the README says.

Acceptance: the owner reports each point; the README is corrected for anything that differs. Publishing is the owner's action.

## Risks

- The virtual machine is Windows on ARM running the x64 app through emulation: a native x64 PC is not covered, and performance there is not representative.
- Unsigned Squirrel installers are sometimes flagged by antivirus heuristics, not only SmartScreen; W7 records what Defender does.
- Squirrel installs per user under `%LOCALAPPDATA%`; a machine that blocks apps there (managed company PCs) cannot install it.
- A second CI job lengthens every pull request by a few minutes.
- Fonts and focus styles on Windows have never been looked at; W7 may find visual issues that become their own fixes.

## Verification strategy

| Check | Kind | Command or flow |
|---|---|---|
| Types and tests on macOS and Windows | Automated test | `npm run check` in both CI jobs |
| Start on Windows from source | Integration check | Windows CI job, `BTW_SMOKE_TEST=1 npm start` |
| Wording | Automated test | Rendered texts for `darwin` and `win32`, both languages |
| Squirrel events, icon | Automated test, static inspection | Unit test; the `.ico`'s sizes |
| Installer | Targeted build, integration check | `npm run package:win` with the start check, on the Windows runner |
| Release workflow | Integration check | Pull-request run (W5); tag run (W7) |
| Install and use | Witnessed flow | W7 in the Windows 11 virtual machine |

## Approval

Approve with:

```text
Approve P-20261027-windows-alpha v1
```

Approval records it only. Implementation starts with a separate `implement P-20261027-windows-alpha v1 [--phase ci | --phase wording | --phase package | --phase release]`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261027-windows-alpha v1`.
- Approved plan/version: `P-20261027-windows-alpha` / `1`.
- Recorded at: `2026-10-27T16:45:06+01:00` (Europe/Rome).
- Approved scope: W1 (phase `ci`), W2 (phase `wording`), W3–W5 (phase `package`) and W6–W7 (phase `release`) as written.
- Approved-content SHA-256: `8baf089142310bfddde5f2b631563b76d6e0c413f570acf274531ec17e9bf7c1`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# A Windows alpha` up to, and not including, `## Approval`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized without the owner's confirmation right before each one:
  - installing `electron-winstaller` 5.4.4 or any other dependency change;
  - pushing a tag, creating or publishing a release;
  - deleting the `spike/windows-ci` branch;
  - code signing or any certificate or account use.

## Implementation record

### Phase `ci` (W1), 2026-10-27

Started by the owner's command `implement P-20261027-windows-alpha v1 --phase ci`.

- `tests/app-files.test.ts`: the root is built with `path.resolve` and the expected paths with `path.join`, so they follow the platform; the sibling-prefix case resolves its root the same way.
- `tests/eval.test.ts`: containment is checked with `path.relative` (inside when the relative path is not empty, does not start with `..` and is not absolute) instead of `folder + '/'`.
- `.github/workflows/ci.yml`: a second job, "Windows: types, tests and build", on `windows-latest` with bash: `npm ci`, `npm run check`, `npm run build`, and the start check (`BTW_SMOKE_TEST=1` with a temporary `BTW_USER_DATA_DIR`, through `npm start`, which returns the app's exit code). The macOS job and its required name are unchanged; requiring the Windows job in the ruleset is left to the owner.

| Check | Kind | Result |
|---|---|---|
| `npm run check` on macOS | Automated test | **passed**: 22 files, 338 tests |
| The two changed test files | Automated test | **passed** on macOS: 10 tests |
| Workflow syntax | Static inspection | **passed**: jobs `check` and `windows` |
| Windows job | Automated test, integration check | **passed** on PR #27 (job 122295504466, `windows-2025-vs2026`): 22 files, 326 tests; build; "start check: the library is drawn" |
| macOS job on the same commit | Automated test | **passed**: "Types, tests and build" |

| Task | Verdict |
|---|---|
| W1 | **verified** |

### Phase `wording` (W2), 2026-10-27

Started by the owner's command `implement P-20261027-windows-alpha v1 --phase wording`.

- `src/renderer/i18n/devices.ts`: the 9 texts per language that name the computer or its credential store (`suggest.local`, `generate.noKeychain`, `generate.useAccount`, `generate.sentLocal`, `local.staysHere`, `local.models`, `local.otherAddress`, `failures.storage`, `failures['local-address']`) are written once per language as functions of the device's words: Mac ("this Mac", "the system keychain", "in this Mac's keychain"), Windows ("this PC", "Windows credential protection", "protected by Windows on this PC") and other systems ("this computer", "the system keyring"). `forPlatform` returns the catalog unchanged on `darwin`, in the browser preview (`web`) and when the platform is not known yet, and swaps in the device's texts otherwise. The catalogs keep their Mac wording as written.
- `src/renderer/preferences.tsx`: the provider keeps the `platform` that `getRuntime()` already returned and passes the catalog through `forPlatform`.
- `src/renderer/i18n/it.ts`: `failures.storage` now says "Il portachiavi di sistema", like `generate.noKeychain`, so both are written from the same words.
- `tests/studio.test.tsx`: its desktop bridge reports `darwin`, the system those tests describe (they expect "questo Mac"); before, it reported a placeholder `test`.
- `tests/i18n.test.tsx`: the device texts with the Mac's words equal both catalogs (no drift); `darwin`, `web` and an unknown platform keep the catalog; `win32` and `linux` leave no "Mac" or keychain anywhere in either catalog and keep the same keys; the provider renders "Models on this PC" / "protected by Windows on this PC" for `win32` in English, the Italian equivalents, and the Mac wording for `darwin`.

| Check | Kind | Result |
|---|---|---|
| `npm run check` on macOS | Automated test | **passed**: 22 files, 345 tests (7 new) |
| Both CI jobs | Automated test | **passed** on PR #27 at `e2c9d93`: "Types, tests and build" (macOS) and "Windows: types, tests and build" |

| Task | Verdict |
|---|---|
| W2 | **verified** |

### Phase `package` (W3–W5), 2026-10-27

Started by the owner's command `implement P-20261027-windows-alpha v1 --phase package`. The owner confirmed `electron-winstaller` 5.4.4 right before it was installed ("Sì, installa 5.4.4"); `npm install --save-dev --save-exact` added it with 0 vulnerabilities.

- **W3, icon**: `npm run brand` also writes `assets/icon.ico`, rendered from `app-icon.svg` at 1024 px and resized to 16, 24, 32, 48, 64, 128 and 256 px PNG entries (`scripts/brand-render.cjs` writes the ICO header itself; no dependency). `assets/icon.png` and the social card re-render unchanged. A first attempt rendered at 256 px and captured only a corner of the 1024 px SVG; caught by looking at the entries.
- **W3, Squirrel**: `src/desktop/squirrel.ts` maps `--squirrel-install` / `--squirrel-updated` to creating the shortcuts, `--squirrel-uninstall` to removing them, `--squirrel-obsolete` to quitting, and every other start (including `--squirrel-firstrun`) to a normal start, on Windows only; `runSquirrel` runs `Update.exe --createShortcut=<exe>` or `--removeShortcut=<exe>` one folder above the versioned app folder. `main.ts` runs it first and exits before anything else. `tests/squirrel.test.ts` covers every flag, other systems, and the `Update.exe` call.
- **W4**: `scripts/package-common.mjs` now holds what both package scripts share (the `ignore` rule, the start check, the checksum file); `scripts/package-mac.mjs` uses it, unchanged in behaviour. `scripts/package-win.mjs` and `npm run package:win`: `@electron/packager` for `win32`/`x64` with the executable `BreakTheWall.exe` (Squirrel needs a name without spaces; the product name stays Break the Wall), the `.ico` and version metadata; the start check on the packaged `.exe`; `electron-winstaller` writes `release/Break-the-Wall-<version>-x64-setup.exe` (no MSI, no delta) and its `.sha256`.
- **W5**: the Release workflow gains "Windows x64 setup" on `windows-latest` (tag check, `npm ci`, `npm run check`, `npm run package:win`, artifact `break-the-wall-windows-setup`); pull requests touching `scripts/package-*.mjs`, `squirrel.ts` or `assets/` run it too; "Attach to the release" waits for both builds and uploads the DMG, the setup and both checksums.

| Check | Kind | Result |
|---|---|---|
| `npm run check` on macOS | Automated test | **passed**: 23 files, 348 tests (3 new in `tests/squirrel.test.ts`) |
| `.ico` entries | Static inspection | **passed**: 7 PNG entries, 16–256 px, each the full icon |
| `npm run package` on macOS after the shared module | Targeted build | **passed**: signature verified, "start check: the library is drawn", 92.8 MB DMG |
| Workflow syntax | Static inspection | **passed**: jobs `package`, `windows`, `release` (needs both) |
| `npm run package:win` and the Windows release job | Integration check | **not run yet**: needs the Windows runner, on the pull request |
