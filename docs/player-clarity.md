# Player clarity refinement

Date: 2026-10-22. Requested directly by the owner after reviewing `feature/t3-player`. Implemented on `feature/player-clarity`, based on `feature/generation` (`3c3c344`) so the subsequent import and generation work is retained.

## Result

- Restore the four-block green mark.
- Replace the large introductory home section with direct access to creation, a resumable course when valid progress exists, and compact course cards.
- Move creation to a dedicated sequential workspace: material, goal, then generation. Added sources and the goal remain in the session draft when returning to the library. Drafts are not claimed to survive an app restart.
- Keep one lesson-page index. Move the concept map, atlas and page notes to a single on-demand native dialog. The concept map uses map nodes/edges and the active frame rather than repeating lesson pages.
- Open source evidence on request, with an option to keep it alongside the explanation as nodes/frames change. Preserve exact excerpts and line highlights.
- Separate exploration from the activity through “Ora prova tu”. Keep guided gates, attempts, and saved progress; do not change lesson/state schemas or provider authentication.

## Verification

- `npm run check`: strict TypeScript and 70 automated tests passed. Updated interaction tests exercise the sequential creation flow, retained draft, source pinning, frame highlights, explicit activity reveal, guided gates, tool-tab keyboard navigation, notes and course resume. Provider tests use scripted services and a local callback, not a real account.
- `npm run build`: passed. Existing Lucide `use client` bundler warnings remain.
- Browser production preview: manually exercised code frame 3 with source pinned (line 11 highlighted), atlas search, arrow-key tab switching, notes, Escape, keyboard answer submission, successful gate opening, the resume card, and material → goal → generation without sending a provider request.
- Layout: inspected the default browser layout, a wide layout with source alongside the explanation, the creation workspace at a measured 720 CSS px, and the thermostat page/tools at 375 CSS px. No document overflow in those checked states. This was a targeted check, not a new sweep of every page and disclosure combination.
- macOS production Electron: launched with isolated test data. Home and thermostat lesson were witnessed directly in the native window; screenshots remain local under ignored `.local/ui-review/`.

No live inference or account sign-in was performed for this UI refinement. No new claim of learning effectiveness, installer distribution, or completion of the larger alpha follows from these checks.
