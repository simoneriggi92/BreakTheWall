# Foundation evidence

Date: 2026-10-21. Scope: project foundation and the first proposed learning loop. This is an evidence note, not a runtime integration report.

## Observed facts

| ID | Evidence | Implication |
|---|---|---|
| E1 | The owner explicitly described learning any subject from uploaded sources or information retrieved by AI. | Code exploration cannot define the core product boundary. |
| E2 | The owner used the earlier interactive code prototype and reported substantial help understanding the repository. | Personal usefulness is observed through owner report; broad effectiveness remains untested. |
| E3 | The prototype combined navigation, maps, an atlas, stepwise source highlights, concept lenses, and activities. It was authored and corrected interactively. | Preserve its experience direction; automated reproduction of that quality is still work to do. |
| E4 | Initial local inspection found an empty Git repository on `main`, no remote, and no tracked application, instructions, manifests, CI, or test files. | There are no discovered application build/test commands to reuse. |
| E5 | GitHub metadata identifies `simoneriggi92/BreakTheWall` as public, with default branch `main` and reported size 0. | Keep private prototype source material outside this public project. |
| E6 | `origin` was configured locally to the owner-provided GitHub repository during foundation setup. | This workspace is connected; no commit, push, or application implementation is established by that operation. |

## Official documentation consulted

- [React component/data-flow approach](https://react.dev/learn/thinking-in-react) and [TypeScript overview](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html): support the proposed typed, component-based player. Runtime input validation remains a separate requirement.
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model): main and renderer processes have different capabilities. This supports the proposed separation of desktop access and lesson rendering.
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation): a context bridge can expose selected operations across an isolated preload boundary. Argument validation and a narrow API remain application responsibilities.
- [OpenAI ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source): documents eligible plan usage for open-source and locally hosted apps. Paid or remotely hosted offerings follow a separate inquiry path. This is an integration direction, not a verified account entitlement.
- [OpenAI preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations): the route has request, tool, and session constraints. Verify the actual generation contract instead of treating it as unrestricted API access.

Documentation was consulted on the date above. No user authentication, provider inference, document upload, external service call for a lesson, or application build was performed.

## Proposed decisions and assumptions

| Item | Classification | Rationale / verification |
|---|---|---|
| Start with text import and one complete learning loop. | Proposed scope. | Keeps a useful outcome small while leaving discovery and richer adapters explicit. |
| TypeScript/React player with a thin Electron host. | Proposed implementation choice. | Reuses the web-based experience direction. T1 will establish actual versions, tooling, and launch/build commands. |
| Initial desktop verification on macOS. | Proposed delivery boundary. | The owner works on macOS. Other platforms need separate packaging and checks. |
| Versioned lesson packages and local progress files. | Proposed design. | Supports deterministic rendering, repeatable evaluation, and offline lesson reuse after generation. |
| The same blocks work for code and non-code topics. | Product hypothesis to test. | Must demonstrate both without changing renderer code for the topic. |
| Source-linked activities improve comprehension beyond a generic chat. | Learning hypothesis. | Requires learner observations on reconstruction, transfer, and repeated use. |

## Not established

There is no automated lesson-generation pipeline, selected dependency version, provider configuration, live account-access proof, packaged application, public prototype asset clearance, selected license, multi-platform verification, or commercial validation in this foundation.

The first implementation plan must not mark prepared development fixtures as AI-generated results. AI-assisted web discovery remains a visible next slice rather than a falsely working source mode.
