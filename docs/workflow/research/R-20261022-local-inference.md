# Local inference trial

Date: 2026-10-22. Question: can a model running on the owner's Mac generate Break the Wall lessons with acceptable time, validity and quality? This is a research note. No application code was changed.

## Setup

- Machine: Apple M4 Pro, 20-core GPU, 48 GB unified memory, macOS.
- Models, both Q4_K_M GGUF downloaded through Ollama 0.30.8: [LFM2.5-24B-A2B](https://huggingface.co/LiquidAI/LFM2.5-24B-A2B) (Liquid AI, 14.5 GB) and [Qwen3.6-35B-A3B](https://huggingface.co/ggml-org/Qwen3.6-35B-A3B-GGUF) (ggml-org, 20.4 GB).
- Request: the app's own `GENERATION_INSTRUCTIONS`, `buildGenerationInput` and `draftJsonSchema`. Each result went through `assembleLesson`, the same validation a provider result gets. Context 32k, thinking disabled, one attempt per case and no repair pass.
- Cases:
  - `text`: an original 45-line Italian note on blood-glucose regulation.
  - `code`: `src/desktop/chatgpt/account.ts`.
  - `large`: four `src/core` files, about 10k prompt tokens.

## Finding about the runtime

Ollama 0.30.8 ignored `format` (JSON Schema) for both models. Even a two-field schema produced free JSON with different fields. The OpenAI-compatible `response_format` of the bundled `llama-server` was also ignored. The native `llama-server` `/completion` endpoint with `json_schema` did enforce the schema. The trial therefore used `/apply-template` and then `/completion`. An app integration cannot rely on Ollama's `format` as it stands.

## Results

| Model | Case | Prompt tokens | Prompt speed | Output tokens | Generation speed | Total | Passes app validation |
|---|---|---|---|---|---|---|---|
| LFM2.5-24B-A2B | text | 1,750 | 918 tok/s | 10,355 | 89.9 tok/s | 117 s | no: 53 issues |
| LFM2.5-24B-A2B | code | 3,416 | 940 tok/s | 7,369 | 89.5 tok/s | 86 s | no: 22 issues |
| LFM2.5-24B-A2B | large | 10,348 | 877 tok/s | 2,297 | 87.5 tok/s | 38 s | no: 10 issues |
| Qwen3.6-35B-A3B | text | 1,659 | 603 tok/s | 5,301 | 48.8 tok/s | 111 s | no: 9 issues |
| Qwen3.6-35B-A3B | code | 3,481 | 699 tok/s | 3,927 | 48.4 tok/s | 86 s | **yes**: 5 pages, map/sequence/comparison/source, choice + order |
| Qwen3.6-35B-A3B | large | 10,632 | 642 tok/s | 5,146 | 46.4 tok/s | 128 s | **yes**: 4 pages, 6 representations, choice + order |

Timings come from llama.cpp and are a single run each. The memory-mapped model load (8–15 s) is excluded.

## Validity: how they failed

- **LFM2.5** produced schema-shaped JSON whose internal references did not hold together:
  - `text`: 30 activities, of which one activity block referenced an id that did not exist; evidence cited a source named `glicemia` instead of its id.
  - `code`: 12 pages with 2 evidence spans; checkpoints and concept pages pointed to missing ids.
  - `large`: evidence ids written as source ids.

  These are structural failures, not borderline cases.
- **Qwen3.6** failed only `text`. It padded two activity ids with filler (`act-previsione-diabete-1234567890abcdef…`) up to the schema's 64-character id pattern, so the checkpoints no longer matched. It also cited two evidence ids it never defined.

## Quality: claims checked against cited lines

Only Qwen's two valid lessons were reviewed. Each was checked claim by claim against the source.

- **`code`:**
  - Correct: the two-minute refresh margin, serialized refresh, PKCE generated before the browser opens, revocation on sign-out.
  - Wrong or misleading:
    - A comparison row swaps what the app and the server send.
    - Sign-out is described as "cancellazione dati", but the registration is kept.
    - "La sessione finisce se il refresh fallisce" omits the key point that only terminal refresh errors end it.
    - The order activity's retry feedback is generic.
- **`large`:**
  - Correct: the overall pipeline and the order of validation checks.
  - Wrong: a frame says the renderer re-verifies sources before display, citing `verifySelection`. That function actually re-checks sources before a provider request. The correct choice answer says the hash is compared "with the one provided" by the model, but hashes come from the host. This is exactly the plan's named risk: a valid citation attached to a false explanation.
- **Both:** the order activity listed its items already in the solution order, so the learner starts from the answer. The app does not shuffle or reject this. That gap applies to any provider, not just local models.

## Assessment

- **Performance is not the obstacle.** One lesson takes 40 s to 2 min on this Mac.
- **Quality is the obstacle.** LFM2.5 is fast (≈90 tok/s), but in this task and setup it does not keep cross-references consistent. Qwen3.6 produced 2 of 3 valid lessons at ≈48 tok/s, with factual slips of the kind the app cannot detect structurally.
- **No comparison point yet.** The same cases have not been run through the ChatGPT route, because T5's live inference is still blocked.

Levers not tried:
- Qwen's thinking mode, followed by a schema-constrained answer.
- One repair request that returns the validator's issues to the model.
- Shorter id patterns to remove the room for filler.
- The MLX runtime, reported at roughly 80 tok/s for Qwen3.6 on this hardware.

A local provider is not usable as a drop-in today. It is a plausible secondary route with Qwen3.6, a repair pass and the llama.cpp `/completion` interface. Adopting it would be a plan revision.

Artifacts (raw outputs, assembled lessons, reports and the harness) are kept outside the repository in the session's scratch directory. The models remain in Ollama's store (~35 GB) until removed with `ollama rm`.
