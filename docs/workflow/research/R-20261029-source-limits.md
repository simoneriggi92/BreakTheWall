# Research: how large a source can be

Date: 2026-10-29. Question: the owner's own document (49,357 characters, 956 lines) is refused because one source may hold at most 40,000 characters. The owner asks to remove the limit: most use goes through the MCP assistant or a hosted model, and local models can get their own handling later. What do the limits protect today, and what must replace them?

## The limits today

[`SOURCE_LIMITS`](../../../src/core/source.ts) (lines 5–13), applied by `importSource`, `checkSelection` and `verifySelection` before anything reaches a provider:

| Limit | Value | Where it acts |
|---|---|---|
| `maxCharsPerSource` | 40,000 | `checkText` (line 45): one pasted text, one file, one text from the assistant |
| `maxTotalChars` | 60,000 | `checkSelection` (line 78): all sources together |
| `maxLines` | 1,500 per source | `checkText` (line 47) |
| `maxLineChars` | 4,000 | `checkText` (line 48): a citation must point at a readable line |
| `maxFileBytes` | 160,000 | `main.ts:83`, before the file is read, and `importSource` (line 57) |
| `maxSources` | 4 | `checkSelection`, the file picker, the draft schema |

They come from the first plan's T4 ([generation-verification](../plans/P-20261021-first-learning-loop/generation-verification.md), line 13), written when a lesson was generated in one request. The record lists the values but gives no reason for them.

A further limit is not in `SOURCE_LIMITS`: the stored source schema accepts at most **100,000 characters** per source ([`src/core/lesson.ts:15`](../../../src/core/lesson.ts)), and the disassembly's sources extend that schema ([`disassembly.ts:65`](../../../src/core/disassembly.ts)). A source above it could be imported but its disassembly could not be saved.

## What each request carries

| Request | Source text it carries |
|---|---|
| Structure | every source in full, each line numbered (`buildStructureInput`) |
| Content of one part | only that part's lines (`buildContentInput`) |
| Runs and reassembly | every source in full again (`buildRunsInput`) |
| Taking a part apart later | only that part's lines (`buildExpansionInput`) |

Line numbers add about 6 characters per line. The owner's document becomes about 55,000 characters in each full request.

## What the limits protect, by route

- **The per-source limit protects nothing the total does not.** Two files of 32,327 and 17,029 characters (the owner's document split at its section 11) pass today, and every request carries exactly the same text as one file of 49,357 would. The limit only forces the split, and the split costs: two sources, citations in two files, and the overview's sections shown per file.
- **Local models are not what sets 60,000 either.** For Ollama the app sizes the window from the request: `chars / 3 + 12,000` tokens, rounded up, between 16,384 and 65,536 ([`runtimes.ts:101–104`](../../../src/desktop/local/runtimes.ts)). That covers about 160,000 characters of request. Beyond the cap, Ollama truncates the prompt silently (the code's own comment). LM Studio, llama.cpp and other local servers use the window configured in the server; when a request is too long they report it, and the app turns that into `local-context` ("increase the context to at least 32k tokens or reduce the sources"). The real local cost of a long source is memory and time, which the app does not measure.
- **ChatGPT**: requests go through the learner's plan. The context window of the offered models is not recorded in this repository and has not been checked; the evaluation never sent more than 60,000 characters.
- **The MCP assistant**: the text the assistant sends is in its own conversation; `start_disassembly` replies with the instructions, the schema and the numbered sources; the runs step replies with the numbered sources again ([`assistant.ts:72`](../../../src/mcp/assistant.ts)). The source is therefore in the assistant's context three times, plus each part's lines. At 60,000 characters that is roughly 55,000 tokens; at 150,000 it would be roughly 140,000, too close to a 200,000-token window once the assistant's own instructions and the parts are added. The tool's description states "at most 40,000 characters and 1,500 lines" in text ([`server.ts:114`](../../../src/mcp/server.ts)).
- **The interface**: the source pane draws every line (`SourcePane.tsx:50`), and Studio's preview shows the first 400. Neither was measured above 1,500 lines.
- **The local entry point** for the assistant accepts requests up to 4 MB (`incoming.ts:17`), far above any limit discussed here.

Tests that pin today's values: `tests/source.test.ts` (lines 37–50), `tests/incoming.test.ts:95`, `tests/mcp-server.test.ts:107`, `tests/mcp-assistant.test.ts:138`, `tests/i18n.test.tsx` (wording only).

## Findings

1. The per-source character limit can go: the total already bounds every request.
2. "No limit at all" is not safe on the MCP route, because the assistant receives the source three times. Sending it twice (not again with the runs step, which can refer to the numbered sources it already has) raises what the route can carry by about half.
3. The total can rise well above 60,000 for every route the owner uses. 120,000 characters is about 40,000 tokens per full request with line numbers: within Ollama's window, twice in the assistant's context with room for the parts, and assumed within ChatGPT's models until checked.
4. The stored source limit (100,000) must rise with it, or a large disassembly cannot be saved.
5. The local route needs one explicit check rather than a lower limit for everyone: before sending, if the request would exceed the window the app can give Ollama, say so and suggest another route. Other local servers already report it.
6. Quality is the open question. 3–7 parts per level on 120,000 characters rely on sub-assemblies and on taking parts apart later. Only a real generation shows whether the parts stay meaningful or turn into a table of contents.

## Assumptions

- The ChatGPT models offered handle a request of about 45,000 tokens. To be checked against current official documentation before the plan is approved, or by the witnessed generation.
- 3.3 characters per token for mixed Italian, English and code; line numbers included as above. An estimate, not a measurement.

## Recommendation

Plan a small change: no per-source character limit; a total of 120,000 characters; lines raised to match; the stored source limit raised with it; the MCP runs step without a third copy of the source; one explicit check on the local route; the interface and the tool's description reading the limits instead of repeating numbers. Verify it with a real generation on a long public source, on a route and at a cost the owner confirms, and with the owner's own document as one source.
