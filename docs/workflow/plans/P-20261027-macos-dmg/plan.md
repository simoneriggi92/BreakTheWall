---
id: P-20261027-macos-dmg
title: A downloadable macOS build - ad-hoc signed DMG for Apple Silicon, built in CI on a tag
version: 1
state: implementing
current_task: K6
last_evidence: K4 verified on PR #24 - the Release workflow built the DMG on macos-15-arm64 in 2 m 37 s, start check passed, 92.8 MB artifact; release job skipped as designed
next_action: Owner chooses the version and confirms the tag; the tag run attaches the DMG to a draft release; owner installs from a download (K6)
approval: approved
---

# A downloadable macOS build

## Outcome

Someone who is not a developer can download a DMG from a GitHub release, drag Break the Wall to Applications, open it with the steps the README gives, and use the prepared examples and Studio as they work from source. A `v*` tag builds the DMG in CI and attaches it to a draft release that the owner publishes.

## Evidence

[Research R-20261027-macos-packaging](../../research/R-20261027-macos-packaging.md). In short: every runtime dependency is already bundled, so the app needs only `dist/`, `dist-electron/`, `assets/` and `package.json`; the user-data folder already follows the app name, so source and packaged builds share it; the packaged flow (asar, `btw://` protocol, icon, Keychain, Gatekeeper) has never run.

## Owner's decisions (2026-10-27)

- Ad-hoc signature now; the README explains how to open an unverified app. Developer ID and notarization later.
- Apple Silicon (arm64) only.
- `@electron/packager` for the bundle, `hdiutil` for the disk image.
- The release DMG is built by GitHub Actions on a `v*` tag, attached to a draft release; the owner publishes it.

## Scope

Included:
- `npm run package`: build, bundle, ad-hoc signature, DMG and SHA-256 checksum, in an ignored `release/` folder.
- The two guards the packaged app needs in `src/desktop/main.ts`, and an opt-in start check (`BTW_SMOKE_TEST=1`) that CI and the package script use.
- A release workflow for `v*` tags, and a manual run that builds the DMG as a workflow artifact without touching releases.
- Install instructions in the README; packaging in `docs/development.md`; CHANGELOG and adapter updates.

Not included:
- Developer ID signing, notarization, stapling (a later plan; the script leaves one place to add them).
- Intel or universal builds, an auto-updater, a DMG window background or icon layout, Windows or Linux packages.
- Any change to how disassemblies, generation or storage work.

## Preconditions

- **One plan implementing.** P-20261024-disassembly is `implementing`, with D8 and D10 waiting for the owner's witnessed checks and D11–D12 gated. The workflow allows one implementing plan. On approval of this plan, P-20261024-disassembly moves to `blocked` with the reason "waiting for the owner's witnessed checks (D8, D10); D11–D12 gated", and returns to `implementing` when this plan is completed or when the owner resumes it. This changes plan metadata only.
- **The new dependency** `@electron/packager` is installed at exactly 20.3.0 as a development dependency, and only after the owner confirms it at implementation time (the contract keeps dependency changes behind a separate confirmation).
- **External actions** (pushing a tag, creating or publishing a release) happen only on the owner's explicit confirmation when they are reached.

## Tasks

### Phase `package`

**K1. Package script.** `scripts/package-mac.mjs`, run by `npm run package` (which runs `npm run build` first):
- generates `build/icon.icns` from `assets/icon.png` with `sips` and `iconutil`;
- runs `@electron/packager` for `darwin`/`arm64` with name "Break the Wall", bundle id `io.github.simoneriggi92.breakthewall`, the version from `package.json`, the icon, `asar: true`, and an `ignore` rule that keeps only `dist/`, `dist-electron/`, `assets/` and `package.json` (no `node_modules`);
- signs the bundle ad-hoc (`codesign --force --deep --sign -`, unless the packager's own ad-hoc path is confirmed to produce a valid signature) and checks it with `codesign --verify --deep --strict`;
- builds `release/Break-the-Wall-<version>-arm64.dmg` with `hdiutil create -format UDZO` from a folder holding the app and an `/Applications` link, and writes its `.sha256`;
- `release/` and `build/` are ignored by git.

Acceptance: on the owner's Mac, `npm run package` ends with a DMG and a checksum; `codesign --verify` passes; the app inside has the Break the Wall name, version and icon in Finder; the bundle holds no `node_modules`. The DMG size is recorded.

**K2. Packaged-app guards and start check.** In `src/desktop/main.ts`:
- `app.dock.setIcon` only when `!app.isPackaged` (the bundle carries its own icon);
- the renderer root keeps resolving inside `app.asar`; if `net.fetch` of an asar `file:` URL fails, read the file and return it with its content type instead;
- with `BTW_SMOKE_TEST=1`, after the window loads, the main process checks that the library rendered (`.library` present and no renderer error reported), then exits with 0 or 1. Without the variable nothing changes.

Acceptance: `npm run check` passes with a test for any extracted helper; the start check exits 0 for `npm start` and for the packaged binary, and exits 1 when the renderer root is missing.

**K3. Automated start of the packaged app.** `npm run package` ends by starting `Break the Wall.app/Contents/MacOS/Break the Wall` with `BTW_SMOKE_TEST=1` and a temporary `BTW_USER_DATA_DIR`, and fails if it does not exit 0 within 60 s.

Acceptance: the package script reports the start check; a deliberately broken bundle (renderer missing) makes it fail.

### Phase `release`

**K4. Release workflow.** `.github/workflows/release.yml`:
- on `push` of tags `v*`, and on `workflow_dispatch`;
- runs on an explicitly arm64 macOS runner, with the same Node and npm pins as CI; `npm ci`, `npm run check`, `npm run package`;
- on a tag: creates a draft pre-release for the tag with the DMG and checksum, or uploads them to the existing release for that tag (`gh` with the workflow's `GITHUB_TOKEN`, permission `contents: write` for this job only);
- on a manual run: uploads the DMG as a workflow artifact and touches no release.

Acceptance: a manual run on the branch produces the DMG artifact; the tag path is checked on the first real tag in K6.

**K5. Instructions and records.**
- README: "Try the alpha" leads with the download (requirements: Apple Silicon, macOS version to be confirmed in K6), the drag to Applications, the Open Anyway steps, the checksum, the lack of automatic updates, and that data stays in `~/Library/Application Support/Break the Wall`; "from source" stays for developers. The alpha note at the top no longer says there is no installer.
- `docs/development.md`: packaging, the start check, how a release is made, and where Developer ID signing would go.
- CHANGELOG: an Unreleased entry. AGENTS.md: the technical-direction line about packaging. SECURITY.md: builds are ad-hoc signed and not notarized; verify the checksum.

Acceptance: links resolve; the steps match what K6 observes.

**K6. Witnessed install from a draft release.** After the owner confirms the tag (for example `v0.1.1-alpha`) and it is pushed: the workflow attaches the DMG to a draft release; the owner downloads it with a browser on their Mac and checks:
1. the DMG opens and the app copies to Applications;
2. the first open is blocked and Open Anyway works as the README says (wording recorded);
3. the library, Atlas and Mill open; a scenario runs; a Markdown source renders with a Mermaid diagram;
4. Dock, Finder and app switcher show the Break the Wall icon and name;
5. progress made with the source build is there (same data folder), and survives a quit and reopen;
6. ChatGPT sign-in: stored credentials still work, or the Keychain prompt and the need to sign in again are recorded;
7. a local model server is detected if one is running.

Acceptance: the owner reports each point; the README is corrected for anything that differs. Publishing the release is the owner's action.

## Risks

- Gatekeeper may differ on macOS 27 from what the README says; K6 records the real steps.
- The Keychain may refuse the source build's credentials to the packaged app; the cost is one new sign-in, documented if it happens.
- asar plus the custom protocol may need the fallback in K2.
- Ad-hoc builds change signature on every release, so the Keychain may ask again after each update.
- Without notarization some users will not open an unverified app at all; that is the trade-off the owner chose for now.

## Verification strategy

| Check | Kind | Command or flow |
|---|---|---|
| Types and tests | Automated test | `npm run check` |
| Production build | Targeted build | `npm run build` |
| Bundle, signature, DMG | Targeted build | `npm run package` on the owner's Mac; `codesign --verify --deep --strict` |
| Packaged start | Integration check | The start check inside `npm run package` (K3), locally and in the workflow |
| Workflow | Integration check | A manual run on the branch (K4); the tag run (K6) |
| Install and use | Witnessed flow | K6 on the owner's Mac from a downloaded draft release |

## Approval

Approve with:

```text
Approve P-20261027-macos-dmg v1
```

Approval records it only. Implementation starts with a separate `implement P-20261027-macos-dmg v1 [--phase package | --phase release]`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261027-macos-dmg v1`.
- Approved plan/version: `P-20261027-macos-dmg` / `1`.
- Recorded at: `2026-10-27T12:10:03+01:00` (Europe/Rome).
- Approved scope: K1–K3 (phase `package`) and K4–K6 (phase `release`) as written.
- Approved-content SHA-256: `dabdec3415e63ab78dfa24e19d4a76568ea64021a4b75d99a7bdebc05cf62462`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# A downloadable macOS build` up to, and not including, `## Approval`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized without the owner's confirmation right before each one:
  - installing `@electron/packager` 20.3.0 or any other dependency change;
  - pushing a tag, creating or publishing a release;
  - Developer ID signing, notarization, or any Apple account use.

## Implementation record

### Phase `package` (K1–K3), 2026-10-27

Started by the owner's command `implement P-20261027-macos-dmg v1 --phase package`. The owner confirmed `@electron/packager` 20.3.0 right before it was installed ("Sì, installa 20.3.0"); `npm install --save-dev --save-exact` added it with 0 vulnerabilities. npm also rewrote the one-line `repository` field of `package.json` on several lines; the value is unchanged.

Changes:
- `scripts/package-mac.mjs` and `npm run package` (K1, K3): `.icns` from `assets/icon.png`; the bundle with only `dist/`, `dist-electron/`, `assets/` and `package.json`; Finder attributes cleared, ad-hoc signature, `codesign --verify --deep --strict`; the start check; the DMG and its `.sha256` in `release/` (ignored by git).
- `src/desktop/app-files.ts`: `appFilePath`, the `btw://app` path resolution moved out of `main.ts` unchanged in behaviour, and now also refusing malformed escapes; `LIBRARY_DRAWN`, the start check's probe. `tests/app-files.test.ts` covers the index, files inside `app.asar`, paths leaving the root, a sibling folder sharing the prefix, and a malformed escape.
- `src/desktop/main.ts` (K2): the Dock icon is set only when the app is not packaged; with `BTW_SMOKE_TEST=1` the window stays hidden and the process exits 0 once the library is drawn, or 1 on a load failure, a renderer crash or 30 s without the library.

Decided while implementing (within the approved scope):
- The bundle is built in a temporary folder, not in the project: the project lives in an iCloud-synced Documents folder, whose `com.apple.FinderInfo` attribute made `codesign --verify` fail ("resource fork, Finder information, or similar detritus not allowed"). Only the DMG and checksum are written to `release/`.
- The DMG uses LZMA (`ULMO`) instead of zlib (`UDZO`): 92.8 MB instead of 130.8 MB. ULMO opens on macOS 10.15+, and the app needs macOS 13.
- No fallback was needed for asar: `net.fetch` of `file:` URLs inside `app.asar` serves the renderer.
- The version stays `0.1.0-alpha` in `CFBundleShortVersionString` and `CFBundleVersion`, as `package.json` has it.

Observed, for K5 and K6:
- `LSMinimumSystemVersion` is 13.0 (from Electron 45): the requirement is macOS 13 Ventura or later on Apple Silicon.
- The app is 259 MB installed. Bundle id `io.github.simoneriggi92.breakthewall`, category Education.
- `spctl -a -vv` rejects the app, as expected for an ad-hoc signature: Gatekeeper will block it after a browser download until Open Anyway.
- macOS 27 prints that `hdiutil create/attach/detach` are deprecated in favour of `diskutil image`; they still work. The script keeps `hdiutil`, which also exists on the CI runners.
- The packager warns that there is no `.icon` file (the newer Icon Composer format) and uses the `.icns`.

### Verification of phase `package`

| Check | Kind | Result |
|---|---|---|
| `npm run check` | Automated test | **passed**: 22 files, 338 tests, including `tests/app-files.test.ts` |
| `npm run build` | Targeted build | **passed** (inside `npm run package`) |
| `npm run package` | Targeted build | **passed** on the owner's Mac (arm64, macOS 27.0.1): `release/Break-the-Wall-0.1.0-alpha-arm64.dmg`, 92.8 MB |
| Signature | Targeted build | **passed**: `codesign --verify --deep --strict`; `Signature=adhoc`, no team |
| Bundle contents | Static inspection | **passed**: `app.asar` holds `/assets` (2), `/dist` (101), `/dist-electron` (3), `/package.json`; no `node_modules` |
| Name, version, icon | Static inspection | **passed**: `CFBundleName` Break the Wall, version 0.1.0-alpha, the bundle `.icns` renders the Break the Wall icon. Finder and Dock are seen in K6 |
| DMG layout and checksum | Integration check | **passed**: the mounted image holds the app and an `Applications` link; `shasum -a 256 -c` OK |
| Packaged start | Integration check | **passed**: "start check: the library is drawn", exit 0, with empty user data |
| Start check fails when broken | Integration check | **passed**: with `dist/` removed, `BTW_SMOKE_TEST=1` exits 1 ("btw://app/ failed to load (-9 ERR_UNEXPECTED)"); with it, exits 0. The package script stops on any non-zero exit |

| Task | Verdict |
|---|---|
| K1 | **verified** (Finder appearance confirmed in K6) |
| K2 | **verified** |
| K3 | **verified** |

### Clean first start (owner's request, 2026-10-27)

The owner asked to verify that a download carries none of their data: no earlier lessons or generations, no OpenAI account, only the Atlas and Mill examples.

| Check | Kind | Result |
|---|---|---|
| What the DMG holds | Static inspection | **passed**: the image root holds only `Break the Wall.app` and the `Applications` link; `Contents/Resources` holds `app.asar`, `electron.icns` and Electron's language folders |
| What `app.asar` holds | Static inspection | **passed**: `/assets/icon.png`, `/dist` (index and 98 assets), `/dist-electron` (main, preload), `/package.json`; no source maps, no user data, no `.local/` |
| Personal or private strings in `app.asar` | Static inspection | **passed**: 0 matches for `/Users/`, the owner's work and personal e-mail domains, the private repository, runbook, book and course names, `.local/` paths, OpenAI key or JWT shapes, and token or account-id values. The only matches for the owner's name are `author` and `repository` in `package.json`, which are public |
| What a new user sees | Integration check | **passed**: the packaged app from the mounted DMG, with empty user data, read over the DevTools protocol: one section, "Disassemblies", with the two cards "Releasing Atlas Reader to staging" and "The harm principle (Mill, 1859)"; no "Earlier paths", no resume card; `accountStatus` is `signed-out`; `localStorage` empty; the data folder holds only Chromium's caches, no `credentials/`, `disassemblies/`, `lessons/`, `workspaces/` or `settings.json` |

Why it holds: everything the learner creates lives in their own `~/Library/Application Support/Break the Wall` and credentials in their own Keychain; neither is read by `npm run package`. The prepared lessons of the first plan are bundled only so that old progress stays readable; the desktop app passes none to the library. A DMG built by CI from a clean checkout has even less to leave out than one built in the owner's folder.

### K5 ahead of K4 (owner's request, 2026-10-27)

The owner asked to update the README now that there will be an installer ("aggiorna anche Readme repo, perché adesso ci sarà l'installer"). Written within K5's scope:
- README: the alpha note; "Try the alpha" split into "Download the app" (requirements, the three steps with Open Anyway, the checksum, a clean start, data location, no updates) and "Run from source" (for an Intel Mac or to change the code); `npm run package` among the commands; the status table and roadmap; the plans link.
- `docs/development.md`: a Packaging section, and the two sentences that said there is no package.
- SECURITY.md, CHANGELOG (Unreleased) and the AGENTS.md technical-direction line.

Still open in K5: how a release is made (with K4), and the Open Anyway wording, to be confirmed against what K6 shows on macOS 27.

### Phase `release` (K4, K5), 2026-10-27

Started by the owner's command, typed as `vimplement P-20261027-macos-dmg v1 --phase release` and read as `implement` (plan, version and phase match the approval).

- `.github/workflows/release.yml` (K4): on a `v*` tag, a `package` job on `macos-15` (Apple Silicon, checked with `uname -m`) checks that the tag equals `v` + the `package.json` version, runs `npm ci`, `npm run check` and `npm run package`, and uploads `release/` as an artifact; a `release` job with `contents: write` only for itself uploads the DMG and checksum to the tag's release, or creates a draft pre-release with generated notes. Workflow permissions default to `contents: read`.
- **Deviation within K4:** the plan's check was a manual run on the branch. GitHub runs `workflow_dispatch` only for workflows already on the default branch, so before merging that is not possible. The workflow also runs on pull requests that touch packaging files (the workflow, the package script, `main.ts`, `app-files.ts`, `package.json`, the lockfile), building the artifact without touching releases. That pull-request run is K4's check; `workflow_dispatch` stays for later manual builds.
- `docs/development.md` (K5): "Making a release": version and CHANGELOG through a pull request, the tag on `main`, what the workflow does, the owner's check and publication.

K4 is verified when the workflow's pull-request run passes. K5's Open Anyway wording waits for K6.

PR #23 (phase `package` and the docs) was merged before the workflow commit reached it, so the workflow went into PR #24, opened for that commit alone.

### Verification of K4 and K5

| Check | Kind | Result |
|---|---|---|
| Release workflow, pull-request path | Integration check | **passed** on PR #24 (run 40496803466): image `macos-15-arm64`, `uname -m` arm64, `npm ci`, `npm run check`, `npm run package` ("signature: ad-hoc, verified", "start check: the library is drawn"), artifact `break-the-wall-dmg` of 92,806,207 bytes; "Attach to the release" skipped, as it must be without a tag. 2 m 37 s |
| CI on the same commit | Automated test | **passed**: "Types, tests and build" |
| Release workflow, tag path | Integration check | **not run**: needs a tag the owner confirms; checked in K6 |
| Release steps in `docs/development.md` | Static inspection | written; followed for real in K6 |

| Task | Verdict |
|---|---|
| K4 | **verified** for pull requests; the tag path is verified in K6 |
| K5 | **implemented**; the Open Anyway wording is confirmed in K6 |

### Version for K6

The owner chose `0.1.1-alpha` for the first DMG ("porta la versione a 0.1.1-alpha con la sezione nel CHANGELOG"). `package.json` and `package-lock.json` were set with `npm version 0.1.1-alpha --no-git-tag-version`, and the CHANGELOG has its section. The tag `v0.1.1-alpha` is pushed only after the owner confirms it, once this is on `main`.
