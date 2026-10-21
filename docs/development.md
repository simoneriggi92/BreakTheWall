# Local development

The player targets macOS. Use Node 22.23.2 and npm 10.9.8 (the versions verified for this alpha). Dependencies are pinned in `package.json` and `package-lock.json`; use npm rather than mixing lockfiles.

```sh
npm ci
npm run dev
```

Electron may download its official platform binary on first launch. Network access is needed for installation, not for the prepared lessons. `npm run dev` starts Vite on `127.0.0.1:5173` and launches Electron. Renderer changes reload; restart the command after desktop/preload changes.

```sh
npm run check
npm run build
npm start
```

`check` runs strict TypeScript checks and the automated tests. `build` checks types, bundles the renderer into `dist/`, and bundles main/preload into `dist-electron/`. `start` launches that production build locally. This is not a signed installer or a distributable application package.

`npm run dev:web` opens the same renderer for browser layout inspection. Browser preview and Electron are different runtime checks; browser persistence does not prove desktop persistence. Desktop test data can be isolated by setting `BTW_USER_DATA_DIR` to an absolute test directory before starting the app.

## Boundaries

The renderer has no Node integration, filesystem API, or credentials. Electron uses sandboxing, context isolation, permission denial, navigation restrictions, and an application-owned `btw://app/` protocol. The preload exposes named operations, never a generic IPC or shell API. The development server is loopback-only; production content policy allows no network connections.

The domain module must remain independent of React and Electron. Lesson content is data rendered with application-owned components; source text is never HTML or executable UI.

## Toolchain references

Versions were checked against npm metadata on 2026-10-21. The current [Vite guide](https://vite.dev/guide/) documents its Node requirements. The host follows the relevant boundaries in Electron's [security guide](https://www.electronjs.org/docs/latest/tutorial/security) and [sandbox model](https://www.electronjs.org/docs/latest/tutorial/sandbox). Runtime data validation follows [Zod's parsing model](https://zod.dev/basics). These references explain choices; they are not evidence of a successful app launch.
