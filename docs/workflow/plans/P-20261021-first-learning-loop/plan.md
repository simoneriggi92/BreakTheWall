---
id: P-20261021-first-learning-loop
title: A reusable desktop learning loop from a selected text source
version: 2
state: blocked
current_task: T5
last_evidence: T5b verified live (Qwen3.6 via llama.cpp, code and non-code lessons, restart); 92 tests and build pass; T5 live inference still blocked by ChatGPT plan usage
next_action: Blocked on ChatGPT plan usage for the T5 live inference; resume with implement P-20261021-first-learning-loop v2 --phase generation when usage is available, then T7
approval: granted
approved_version: 2
approved_by: Project owner (explicit user message)
approved_at: 2026-10-22T10:06:06+02:00
approved_scope_sha256: 03f6a0c9b08f7a0921e9804be180cd8ebf7ed915e64ca3ac2b2fa385322828ae
---

# First learning loop

## Outcome

A learner imports a short text source, states a goal, generates a source-linked interactive lesson, responds to an activity, and resumes the same lesson and notes after restarting the desktop app.

One code topic and one non-code topic must use the same contracts and renderer. This plan implements the first text-source slice of the general product. AI-assisted source discovery and other import formats remain separate, visible roadmap items.

## Evidence and current state

Read [AGENTS.md](../../../../AGENTS.md), the [product definition](../../../product.md), [proposed architecture](../../../architecture.md), and [foundation evidence E1–E6](../../research/R-20261021-foundation.md).

The repository started empty. There are no discovered application commands, dependency versions, CI checks, or test runners yet. Current evidence is document and repository inspection only. An earlier prepared prototype is not an implemented generation pipeline.

## Scope and proposed choices

- macOS desktop alpha using a TypeScript/React player and a thin Electron host.
- Pasted text and selected UTF-8 `.txt` / `.md` files; source preview, visible limits, and a user-defined learning goal.
- A versioned lesson format, source references, and a small vocabulary of map, sequence, comparison, lens, source-excerpt, and activity blocks.
- Source-based generation through a provider adapter with two routes the learner chooses in the app: Sign in with ChatGPT where eligible, or a model server already running on the same Mac (Ollama, LM Studio, or llama.cpp server).
- Guided and exploration modes, contextual minimap, atlas, notes, attempts, feedback, and local resume.
- Deterministic activity feedback and reference comparison for free text. No claimed automated mastery assessment.

Not included: downloading, installing, or starting local models or runtimes from the app; model servers on other machines; AI-assisted web discovery, PDF/OCR, audiovisual import, full-repository crawling, arbitrary generated executable UI, adaptive course planning across sessions, cloud synchronization, collaboration, billing, a vector database, a universal knowledge graph, or a multi-agent framework.

## Ordered tasks

### Phase player — reusable player

#### T1 — Establish the desktop toolchain and boundaries

- Purpose: make the proposed application reproducible before building features.
- Action: establish supported, compatible dependency versions and the package manager from official guidance; add the minimal Electron/React/TypeScript project, lockfile, and actual development/check commands.
- Boundary: renderer has no direct Node/filesystem/credential access; preload exposes narrowly named, validated operations. Keep domain contracts independent of the shell.
- Acceptance: app launches locally on macOS; a clean install and production build work using documented commands; checks are discoverable from project files. No credentials are needed to open the prepared-fixture mode.
- Evidence: exact toolchain versions, commands, exit results, and a witnessed desktop launch. Do not claim installer distribution from a development launch.
- Dependencies: none after plan approval and a separate implement command.

#### T2 — Define and validate lesson/source/state contracts

- Purpose: render generated content as data rather than executing model-produced UI.
- Action: implement versioned source records, span references, goals, lesson packages, visual blocks, activities, and learner state. Validate input before rendering.
- Acceptance: reject unknown blocks, out-of-range or missing source spans, dangling map/frame references, and invalid activity solutions; excerpts resolve to exact source content. Code locators are optional and non-code sources are valid.
- Evidence: focused contract tests with valid and invalid packages, including source text that resembles instructions or executable markup.
- Dependencies: T1.

#### T3 — Render two honest prepared lessons

- Purpose: establish a reusable visual experience and a reference for later generation quality.
- Action: create original, shareable development fixtures: a small request-processing code flow and a negative-feedback thermostat explanation. Render both through the same player, including prediction choices and sequence reconstruction, and record page/frame navigation, activity attempts, notes, atlas, and minimap.
- Acceptance: both fixtures work without topic-specific renderer branches; changing frames updates related evidence/highlights; wrong activity responses receive specific feedback; guided gates respect the activity state and exploration mode allows navigation. Label fixtures as prepared examples.
- Evidence: witnessed keyboard flows for both topics, meaningful activity interaction tests, and layout checks in narrow and wide windows. Inspect clarity as well as absence of overflow.
- Dependencies: T2.

### Phase generation — source to generated lesson

#### T4 — Import and preview a bounded text source

- Purpose: let the learner choose exactly which material grounds a lesson.
- Action: accept pasted text and selected UTF-8 text/Markdown files, normalize them into source records, and collect a goal. Establish explicit source-size limits and meaningful errors before model submission.
- Acceptance: unsupported/invalid input does not become a lesson; source preview matches what will be sent; no background directory crawl or source-code execution occurs. Selecting a source alone does not send it to a provider.
- Evidence: valid text/code imports plus empty, non-UTF-8, unsupported, and over-limit cases.
- Dependencies: T2, T3.

#### T5 — Integrate one eligible account/provider

- Purpose: prove the documented access direction with the actual client before relying on it for generation.
- Action: implement a provider adapter and the supported sign-in/renewal path using current official documentation. The owner completes sign-in in this application; do not copy another application's credentials. Use OS-protected credential storage and keep tokens out of renderer state, logs, fixtures, and lesson exports. Use real capabilities instead of a hard-coded entitlement assumption.
- Acceptance: successful sign-in and one completed generation request; cancellation, expired/revoked session, unavailable model, and quota/limit failures produce recoverable UI states. Prepared examples remain available without a live account.
- Evidence: contract-level failure tests and a witnessed inference with an eligible account. If access or a required response feature cannot be verified, record it as blocked; mocks cannot satisfy live-inference acceptance. Do not silently add a BYOK requirement.
- Dependencies: T1, T4. Requires the owner to complete account sign-in when needed.

#### T5b — Generate with a local model on this Mac

- Purpose: let the learner generate without an account or usage limit, with the source staying on the device, as an explicit alternative to ChatGPT.
- Action: in the generation step, offer a choice between ChatGPT and "Modello locale" and remember it.
  - "Cerca sul Mac" probes the default loopback ports of Ollama, LM Studio and llama.cpp server and lists their models. A manual address is accepted only for loopback hosts.
  - A short capability check sends a tiny schema-constrained request and shows whether the server enforces the lesson format, because the [local inference trial](../../research/R-20261022-local-inference.md) found a runtime that silently ignored it.
  - Requests use each runtime's schema mechanism, stream progress, and support cancellation.
  - For local results only, one repair request returns the validator's issues to the model before the lesson is rejected.
  - Generated lessons record provider, runtime and model, and are labelled as generated by a local model.
- Acceptance:
  - With a server running, discovery finds it and its models without typing an address.
  - With none running, the step shows short setup guidance instead of an error.
  - A server that does not enforce the schema is identified before generation and the learner is told what that means.
  - Stopped servers, unloaded or missing models, too-small context, timeouts, cancellation and malformed output produce recoverable states; older lessons and notes are untouched.
  - No source content is sent to a non-loopback address.
  - The ChatGPT route and prepared examples keep working.
- Evidence:
  - Contract tests with fake servers for each runtime, including one that ignores the schema, and for discovery, the address boundary and the repair pass.
  - Studio interaction tests for choosing, discovering and configuring.
  - A witnessed generation in the desktop app with a real local model for each of the two domains, and a restart.
  - A semantic review of the generated claims, recorded as for T6.
- Dependencies: T4. Independent of T5. Uses models and runtimes the owner installs; the app does not download them.

#### T6 — Generate, validate, save, and resume the lesson

- Purpose: complete the product's first real learning loop.
- Action: combine the selected source and goal into a bounded generation request; obtain typed lesson content; validate the completed result; save an accepted package and learner state atomically.
- Acceptance: a generated lesson has a meaningful route and representation variety, resolvable evidence, usable activities, and source-linked feedback. Unsupported or invalid responses fail visibly. Cancellation or a malformed response preserves older lessons and notes. Saved lessons reopen without another inference request.
- Evidence: actual generation for each of the two domains through at least one live route (ChatGPT or local model, recorded per lesson), source/claim review, an invalid-provider-result test, and a witnessed restart with preserved page/frame, attempts, and notes. Generated output must be distinguishable from prepared examples.
- Dependencies: T3, T4, and T5 or T5b.

### Phase alpha-verification — evaluate the alpha

#### T7 — Verify the desktop outcome and collect usable feedback

- Purpose: establish whether the first slice is usable beyond the development fixtures.
- Action: run the application checks discovered in T1; produce and launch a local desktop build; record known limitations and block/page-level feedback. Exercise a new source without adding topic-specific UI code.
- Acceptance: the complete T4–T6 flow is witnessed on macOS; source links and activities work; no known data-loss or lesson-rendering blocker remains. Record factual mistakes and density/sequence issues rather than treating a successful render as learning validation.
- Evidence: build/test results, desktop screenshots, live-generation notes that omit credentials, and a concise usability record. External learner sessions happen only with participants and materials the owner authorizes; their absence is reported honestly, not counted as a passed test.
- Dependencies: T6.

## Definition of done

T1–T7 meet their acceptance criteria with the correct evidence level. At least one real generated code lesson and one real generated non-code lesson use the same player. The owner can import, learn, respond, inspect sources, and resume. Documentation distinguishes implemented, prepared, unverified, and deferred capabilities.

The source-discovery mode is not part of this plan's completion claim. No claim of general learning efficacy, support for arbitrary material formats, or readiness for every platform follows from this alpha.

## Risks and concrete responses

| Risk | Response / point of failure |
|---|---|
| A valid citation is attached to a false explanation. | Keep semantic source review in T6/T7; structure validation alone is insufficient. |
| Model output exceeds the supported format or available context. | Apply visible bounds and validate completed output; return a useful failure instead of silently dropping evidence. |
| Account access or required response behavior is unavailable. | Establish this in T5 and report the dependency; preserve prepared mode without presenting it as live generation. T5b offers an independent route. |
| A local runtime accepts a schema but does not enforce it. | Observed with Ollama 0.30.8. T5b checks enforcement with a probe before generation and says so in the UI; validation still runs on every result. |
| Local models produce valid structure with false explanations, or break cross-references. | Observed in the trial. Label the model, keep claim review in T5b/T6/T7, and allow one repair pass for structural issues only. |
| The learner's Mac cannot run a capable model. | Show requirements and the ChatGPT alternative; do not present a small model as equivalent. |
| A loopback port is served by an unrelated application. | Identify the runtime by its documented endpoints before listing it; never send sources until the learner selects a model. |
| Visual variety adds clutter. | Use one main representation per page, progressive disclosure, and a shared context area; review both topics in T3. |
| Persisted state no longer matches revised content. | Bind state to a lesson revision and explicitly preserve, migrate, or invalidate affected state. |
| Private material enters a public fixture or commit. | Use original/shareable fixtures and exclude earlier private source snapshots. |

## Verification strategy

No application command is invented in this plan. T1 must establish commands from actual manifests/scripts, after which verification uses those commands. Contract tests cover invalid structures and evidence; interaction tests cover learner behavior; witnessed checks cover desktop launch, provider inference through each implemented route, and restart. Technical checks do not establish semantic correctness or learning effectiveness.

## Review and authorization

Version 2 adds T5b, a local-model route chosen in the app, after the [local inference trial](../../research/R-20261022-local-inference.md). The [author self-review](review.md) covers v2. The owner approved v2 on 2026-10-22. Implementation of T5b waits for a separate implement command.

Approval command for this version:

`Approve P-20261021-first-learning-loop v2`

Approval records the authorized plan only. A later, separate implementation command starts edits, for example:

`implement P-20261021-first-learning-loop v2 --phase generation`

Named phase identifiers are `player` (T1–T3), `generation` (T4, T5, T5b, T6), and `alpha-verification` (T7). Select only the requested phase or the next task under the shared workflow contract. GitHub publication requires separate authorization; this plan does not authorize a push or merge.

## Approval record

Version 2:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261021-first-learning-loop v2`.
- Approved plan/version: `P-20261021-first-learning-loop` / `2`.
- Recorded at: `2026-10-22T10:06:06+02:00` (Europe/Rome).
- Approved scope: T1–T7 including T5b and their stated acceptance criteria, the `player`, `generation` (T4, T5, T5b, T6) and `alpha-verification` phases, the text-source alpha, and the listed exclusions.
- Approved-content SHA-256: `03f6a0c9b08f7a0921e9804be180cd8ebf7ed915e64ca3ac2b2fa385322828ae`.
- Digest definition: as for version 1 below.
- Authority boundary: this records plan approval only. A later separate implement command must select the next task or a named phase. Publication, credentials, licensing, model downloads and other separately protected actions are not authorized by this record.

Version 1 (superseded by v2's material change; kept as history):


- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261021-first-learning-loop v1`.
- Approved plan/version: `P-20261021-first-learning-loop` / `1`.
- Recorded at: `2026-10-21T16:54:08+02:00` (Europe/Rome).
- Approved scope: T1–T7 and their stated acceptance criteria, the `player`, `generation`, and `alpha-verification` phases, the text-source alpha, and the listed exclusions.
- Approved-content SHA-256: `261b12cb31888cf0657b75599e54af451967c9eefe6c7381f162e991051519a8`.
- Digest definition: SHA-256 of the UTF-8 plan body beginning with `# First learning loop` and ending immediately before `## Review and authorization`, preserving its exact whitespace. YAML metadata and administrative authorization/approval sections are excluded so recording state does not alter the approved content.
- Authority boundary: this records plan approval only. A later separate implement command must select the next task or a named phase. Publication, credentials, licensing, and other separately protected actions are not authorized by this record.

## Player phase execution

Authorized command: `implement P-20261021-first-learning-loop v1 --phase player`.

- T1: complete; see [player verification](player-verification.md).
- T2: complete; 18 targeted tests passed.
- T3: verified. Both prepared lessons render through one player; 15 interaction tests, 3 desktop store tests, a scripted two-launch desktop resume, and a layout sweep at 375–1440 px. See [player verification](player-verification.md).
- T4–T7: not started; outside this implementation command.
- Player phase verified on 2026-10-21; results in [player verification](player-verification.md#verification-run--player-phase).

The approved scope above remains unchanged. Runtime evidence will be recorded here as tasks complete.

## Generation phase execution

Authorized command: `implement P-20261021-first-learning-loop v1 --phase generation`.

- T4: complete; import cases and preview-equals-request covered by tests. See [generation verification](generation-verification.md).
- T5: implemented. Owner sign-in witnessed in the production build with plan usage granted and models listed. Blocked on the live inference: the owner's plan usage was exhausted and resets later.
- T6: implemented and covered by contract and interaction tests. Live generation for both domains, claim review and the restart check depend on T5's inference.
- T7: not started; outside this implementation command.

Version 2, authorized command: `implement P-20261021-first-learning-loop v2 --phase generation`.

- T5b: verified. Discovery, format check, live local generation for both domains, repair phase, progress estimate and restart were witnessed in the production build. Claim review found factual slips in both lessons. See [generation verification](generation-verification.md#t5b--local-model-route-plan-v2).
- T6: its live-generation, restart and claim-review evidence is now satisfied through T5b's local route. The ChatGPT route is still unwitnessed.
- T5: implemented; live inference still blocked by plan usage.
- T7: not started.

## State change

- 2026-10-22T12:58:04+02:00: the owner set this plan to `blocked`. T5's witnessed ChatGPT inference waits for plan usage. This lets [P-20261022-generation-quality](../P-20261022-generation-quality/plan.md) become the active plan. The approved scope of v2 is unchanged.
