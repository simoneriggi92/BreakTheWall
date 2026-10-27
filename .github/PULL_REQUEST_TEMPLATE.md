## What changes

<!-- What the change does and why. Link the issue it closes: "Closes #12". -->

## How it was checked

- [ ] `npm run check` passes (strict TypeScript and every test)
- [ ] `npm run build` passes
- [ ] A test covers the new behavior, in both interface languages where wording matters
- [ ] Checked by hand in the desktop app or the browser preview (say which, and what you tried)

## Boundaries

- [ ] `src/core` stays independent of React and Electron
- [ ] No new dependency, or it is pinned to an exact version and explained above
- [ ] Interface text is in both `src/renderer/i18n/it.ts` and `en.ts`
- [ ] Only public content: no credentials, private documents or private code

<!-- Larger changes follow the research → plan → implement workflow in CONTRIBUTING.md. -->
