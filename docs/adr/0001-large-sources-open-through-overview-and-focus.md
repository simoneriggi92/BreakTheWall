---
status: accepted
---

# Large sources open through an overview and a focus

A repository does not fit one reading: today's budget (`SOURCE_LIMITS`, about 120k characters) holds one module, and a medium repository is 9 to 39 times that. Three principles had to survive: no question is needed, nothing waits inside the view, and parts are roles, not named components. So any source larger than the app's budget, whatever its kind, opens through two readings, both finished before the view opens: an **overview**, one model request over a digest the app builds without a model (file tree with sizes, manifests, top-level docs, declared links with their `file:line`), which returns what the source is about, its aspects and its roles with their member files; and a **focus**, one role of the overview read in depth as any source is today. Everything else is listed in the bill of materials. (Owner, 2026-11-18, ticket "Whole repository or a question: how does a repository open?".)

## Decision

- **Trigger.** The app's own budget, the same on every route, not the chosen route's ceiling: one source always has one shape.
- **Focus.** One role, filled up to the budget by following declared links from the role's centre; the rest of the role is "outside the focus", and a single file larger than the budget is cut into line ranges.
- **Who chooses it.** Without a question, the detector's rule on the overview's shape: the main nucleus, then its role with the most bonds. No rule on names or folders; an entry point declared in a manifest is already a declared link. With a question, the question goes into the overview request, which names the roles it crosses; the first becomes the focus, the others are marked. If no role answers, the app says so and opens on the default focus.
- **The view.** Unchanged: the overview's roles are sub-assemblies, the focus is open, the others are closed with their function, members and declared links. The guide starts with the whole and the aspects, then the focus's way in.
- **Another area** is a new reading of the same snapshot, never a part taken apart inside the view.
- **An oversized digest** is reduced deterministically (deep folders collapsed to one line, links kept only between listed files, overlapping docs deduplicated) and the bill of materials says so. If it still does not fit, the app says the source is too large and does not open it. No silent cut.
- **A language without a parser** gives an overview with interpreted bonds only; the focus is chosen the same way, and "How it was read" says so.

## Considered options

- **A question required for repositories.** Rejected: an exception to "No question needed" for one kind of source is a mode in disguise.
- **One folder at a time, chosen by the learner.** Rejected: the learner must already know where to start, and folders split responsibilities.
- **Selecting an area inside the open view.** Rejected: it revives "take this part apart", retired on 2026-11-05.
- **An overview without a model** (tree and imports shown as they are). Rejected: it draws members instead of roles and cannot say what the source is about or name its aspects.
- **The route's ceiling as trigger.** Rejected: the same repository would open whole on one route and in two readings on another.
- **An overview split over several requests.** Rejected: it costs more and roles from different requests would have to be merged.

## Consequences

- Every opening of a large source costs one more request than a source within the budget.
- The digest fits the measured repositories (httpx about 24k, this repository about 83k; FastAPI about 106k after collapsing `tests/` and `docs_src/`), not a monorepo of tens of thousands of files, which will be reported as too large.
- `docs/product.md` changes in the spec, not here: the "No question needed" paragraph, the "Large sources" section and the whole-repository exclusion.
