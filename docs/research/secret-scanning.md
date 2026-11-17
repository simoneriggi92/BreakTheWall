# Scanning a repository for secrets by content, on the device

Date: 2026-11-17. Scope: research for issue #61 (map #58). No app source, configuration or dependency is changed. The measurements below ran from throwaway scripts outside the repository, with no package installed.

## Why this research

A local repository will become a source that may be previewed and sent to a hosted model. The earlier hand disassembly ([R-20261025](../workflow/research/R-20261025-repository-and-document.md), finding 2) found a git-tracked configuration file holding API keys and a database password. A filter on file names (`.env`) would have sent them. So detection must read **content**, run **before preview**, exclude the file and show the reason.

The question: which rule sets and tools can do that inside an Electron 45 + TypeScript app on macOS arm64 and Windows x64, under Apache-2.0, ideally without shipping a native binary?

Labels used below: **Fact** is backed by the cited source or by a measurement reported here; **Inference** is the author's reading of those facts.

## Short answer

Reuse **gitleaks' default rule file** (MIT) as data, compiled to JavaScript regular expressions inside the app, with gitleaks' own keyword prefilter, entropy thresholds and allowlists. Add **own rules** for the class of secret that triggered this research (connection strings and passwords in configuration files), because the gitleaks default set misses several of them. Do not use TruffleHog (AGPL-3.0, and its strength is verifying secrets over the network). Use detect-secrets for ideas (entropy limits, false-positive filters), not for code.

## Comparison

| | gitleaks (default rules) | detect-secrets | TruffleHog | secretlint |
|---|---|---|---|---|
| Licence | MIT ¹ | Apache-2.0; `keyword.py` partly MIT (from bandit) ² | AGPL-3.0 since v3.0 ³ | MIT ⁴ |
| Rule format | One generated TOML file: per rule `regex` (Go RE2), `entropy`, `keywords`, `secretGroup`, `path`, allowlists, stopwords ⁵ | Python plugin classes: regex per provider, `Base64HighEntropyString` (limit 4.5), `HexHighEntropyString` (limit 3.0), `KeywordDetector` ⁶ | Go code per detector; custom detectors in YAML (regex + keyword) ³ | TypeScript rule packages; preset `recommend` with ~28 rules incl. `database-connection-string` ⁴ |
| Size | 222 rules (221 regex, 130 with entropy, 221 with keywords) ⁵ | 27 plugins ⁶ | "over 700"/"over 800" detectors ³ | ~28 rules in the preset ⁴ |
| Reusable from Node without a native binary | **Yes, as data**: all 221 regexes compile in Electron 45's V8 after a mechanical translation (measured, below) | Ideas and regexes portable by hand; the tool itself needs Python | No: Go code, AGPL | Yes, it is Node (≥ 22) ⁴, but it would be a new dependency |
| Finds the finding-2 class (passwords in config, connection strings) | Partly: misses URIs with credentials, passwords with symbols, XML `key`/`value` (measured) | Keyword plugin targets assignments; not measured | Not evaluated (excluded on licence) | URI connection strings for MongoDB, MySQL, PostgreSQL ⁷ |
| Maintenance | "Feature complete … security patches only"; successor Betterleaks (MIT) ⁸ | Last release v1.5.0, 2024-05-06 ⁹ | Active ³ | Active ⁴ |
| Network | None | None | Verifies by calling providers unless `--no-verification` ³ | None |

## Findings

### 1. gitleaks: the rule file is reusable data, not just a binary

- **Fact.** Licence MIT, "Copyright (c) 2019 Zachary Rice" ¹. The default rules live in [`config/gitleaks.toml`](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml) (3,209 lines, `minVersion = "v8.25.0"`), generated from Go code; latest release v8.30.1 (2026-03-21) ⁵.
- **Fact.** Rule fields: `regex` ("Golang regular expression … Golang's regex engine does not support lookaheads"), `secretGroup`, `entropy` ("minimum shannon entropy a regex group must have"), `keywords` ("used for pre-regex check filtering"), `path`, per-rule `allowlists`, and `stopwords` that target the extracted secret ⁸. The file also carries a global allowlist: lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` …), `node_modules`, images, fonts, vendored dependencies ⁵.
- **Fact.** The detector builds an Aho-Corasick trie of all keywords, matches it once per fragment, and runs a rule's regex only when one of its keywords is present (rules without keywords always run) ¹⁰.
- **Fact (measured).** Translation needed for JavaScript: a leading or mid-pattern `(?i)` becomes a scoped `(?i:…)` group up to the end of its enclosing group; `\z` becomes `$` (no `m` flag); `(?-i:…)` is kept. With that, **221 of 221** regexes compile in Electron 45 (V8 15.6, Node 24.22 inside Electron). In plain Node 22.23.2 (V8 12.4) only **79 of 221** compile: RegExp modifiers `(?i:…)` are not available there.
- **Inference.** The repository's Node 22 toolchain (Vitest) cannot compile the translated rules as is. Either the rules are expanded at build time into modifier-free patterns (e.g. `(?i:ab)` → `[aA][bB]`, which needs a regex parser), or the scanner's tests run under Electron's runtime (`ELECTRON_RUN_AS_NODE=1`). This is the main engineering cost of reuse.
- **Fact.** No maintained pure-JavaScript port of the gitleaks engine was found on npm: packages named for gitleaks wrap the Go binary (e.g. `@b12k/gitleaks`, `gitleaks-secret-scanner`) or are Rust ports with native bindings (`@visulima/secret-scanner`, "a Rust port of gitleaks detection, exposed via NAPI") (npm search, 2026-11-17).
- **Fact.** gitleaks is "feature complete"; its author moved to Betterleaks (MIT), which keeps TOML rules but adds [Expr](https://expr-lang.org) logic for filtering and validation ⁸ ¹¹. **Inference.** Pin a gitleaks commit and vendor the TOML with its licence notice; Expr-based Betterleaks rules would not be pure data any more.

### 2. detect-secrets: good heuristics, not reusable code

- **Fact.** Apache-2.0 ⁹. Plugins include provider formats (AWS, GitHub, GitLab, Slack, Stripe, npm, OpenAI, private keys, JWT, basic auth …), `KeywordDetector`, and two entropy plugins over quoted strings: base64 (charset includes URL-safe `-_` and `=`, limit 4.5) and hex (limit 3.0, with a penalty for all-digit strings because "the number of false positives … greatly exceeds realistic true positive scenarios") ⁶.
- **Fact.** Its false-positive filters ([`filters/heuristic.py`](https://github.com/Yelp/detect-secrets/blob/master/detect_secrets/filters/heuristic.py)) drop sequential strings, UUIDs, ID-like strings, templated values (`{secret}`, `${secret}`), indirect references, non-text files, Swagger files and a fixed list of lockfiles (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `poetry.lock` …).
- **Inference.** Reusing it means shipping Python, which the app does not. The heuristics are short and worth reimplementing in TypeScript (with attribution if code is ported); the plugin regexes are Python `re` syntax and mostly portable.

### 3. TruffleHog: excluded on licence and on purpose

- **Fact.** AGPL-3.0 since v3.0; contributions need a CLA; detectors are Go code; it can "log in to confirm if that secret is live", e.g. an AWS `GetCallerIdentity` call, unless `--no-verification` is passed ³.
- **Inference.** Copying its detector code or regexes into an Apache-2.0 app would put the combined work under AGPL obligations; Apache-2.0 code can flow into (A)GPLv3 works, not the reverse. Shipping its binary as a separate program is arguably aggregation, but it adds a Go binary per platform and a licence obligation for little gain. Its distinguishing feature, verification, sends the candidate secret to the provider, which contradicts "on the device". Not a fit.

### 4. False positives: generic rules and entropy are the noise, allowlists remove most of it

- **Fact.** A benchmark study of secret detection tools (Basak et al., ESEM 2023) reports precision of 75% for GitHub secret scanning and 46% for gitleaks (recall 88%), and names "generic regular expressions" and "ineffective entropy calculation" as the main causes of false positives ¹².
- **Fact (measured).** Corpus: 40 MB of text files (8,924 files) from this repository's `node_modules`, which should hold no real secrets.
  - gitleaks rules with keywords and entropy but **without** allowlists: 412 findings, 410 from `generic-api-key` (identifiers like `privateKey: NonSharedBuffer`).
  - Adding that rule's own allowlists (`^[a-zA-Z_.-]+$`, its match allowlist and 1,453 stopwords): **10 findings**, all false positives on inspection: TLS pin hashes in `@types/node` comments, a SHA-256 in `electron/checksums.json`, the base64 alphabet, and a README example password (`"hunter99"`).
  - detect-secrets-style entropy over quoted strings: **1,617 hits** (1,110 hex strings, mostly colour palettes in `d3.js`; 327 integrity hashes). In this repository's `package-lock.json` alone: **380 hits, one per `"integrity": "sha512-…"` field**.
- **Fact (computed).** Shannon entropy of typical non-secrets: SHA-1 hex 3.74, UUID 3.39, sha512 integrity base64 5.57; AWS's documented example secret 4.66; a weak human password `Passw0rd!` 2.95.
- **Inference.** Entropy alone cannot tell a hash from a key: hex hashes clear gitleaks' 3.5 and detect-secrets' 3.0, integrity fields clear 4.5. Mitigations that work: entropy only after a keyword/assignment context (as gitleaks does); path allowlists for lockfiles and vendored code; stopwords and placeholder filters (`${…}`, `{{…}}`, `xxxx`, `changeme`); UUID and pure-hex-digest filters unless the key name says "secret". Human passwords have low entropy, so a password next to `Password=` must be caught by context, never by entropy.

### 5. The gitleaks default set misses the finding-2 class

- **Fact (measured).** Fake inputs run through the translated gitleaks rules, keywords and entropy:

  | Input (fake) | Result |
  |---|---|
  | ADO.NET `Password=Tr0ub4dor3xQ9;` | caught (`generic-api-key`) |
  | ADO.NET `Password=Tr0ub4dor&3x!;` | **missed** (value charset `[\w.=-]` excludes `&`, `!`) |
  | `DATABASE_URL=postgres://app:Xk29fLq7Pz@db.internal:5432/orders` | **missed** (no generic URI-credential rule; no keyword on the line) |
  | JSON `"ClientSecret": "q8Z~vH2mN4pR…"` | **missed** (`~` outside the charset) |
  | XML `<add key="SmtpPassword" value="h7Gq2Lp9Wz4x" />` | **missed** (key and value in separate attributes) |
  | JSON `"ApiKey": "9f8e…"`, AWS key id, GitHub PAT, PEM private key | caught |

- **Fact.** secretlint's `database-connection-string` rule covers `mongodb(+srv)://`, `(jdbc:)mysql(x)://` and `postgres(ql)://` with named `username`/`password` groups, and drops placeholders (`password`, `${password}` …), repeated characters, passwords shorter than 4 and user = password ⁷.
- **Inference.** The app needs its own small rule set on top: (a) URI credentials for any scheme (`scheme://user:pass@host`); (b) key/value connection strings (`Password=`, `Pwd=`, `User Password=` in ADO.NET, JDBC, ODBC); (c) a config-aware rule: a key whose name contains `password|passwd|pwd|secret|token|apikey|api_key|client_secret|private_key|connectionstring` with any non-placeholder value, in JSON, YAML, XML attributes, `.ini`, `.properties` and `.env`. These rules use no entropy; placeholders are filtered instead.

### 6. Cost on a medium repository

- **Fact (measured, Apple Silicon, Electron 45 runtime, 40 MB / 8,924 files, files over 1 MB skipped).**

  | Strategy | Time | Regex runs |
  |---|---|---|
  | Every rule on every file, no prefilter | 71.2 s | ~1.97 M |
  | Per-rule keyword check with `includes` on the lowercased file | 4.3 s | — |
  | One combined keyword regex per file, then only matching rules | **1.0 s** | 10,500 |

  The heaviest rule is `generic-api-key` (0.5 s of the total). Reading the files is not included.
- **Fact.** Go's `regexp` (RE2) guarantees time linear in the input ¹³; V8's default engine backtracks. Growing adversarial inputs ×10 against all 221 rules flagged two rules as superlinear: `curl-auth-header` and `curl-auth-user` on repeated `curl ` text (5 kB: 2 ms; 50 kB: 211 ms; 200 kB: 3.1 s, quadratic). The slowest linear case was 0.26 s on 50 kB.
- **Fact.** V8's experimental linear-time engine (`--enable-experimental-regexp-engine`, flag `l`) ¹⁴ rejected 212 of 221 rules ("Cannot be executed in linear time"), mostly because of bounded repetitions such as `{250,}`.
- **Inference.** Rules written for RE2 were never tested against backtracking. Guard the scan: run it off the main thread (a worker or `utilityProcess`) with a time budget that terminates it, cap file and line length (minified bundles), and either rewrite the two `curl` rules or drop them (a `curl` command with a token is also caught by the provider rules). The combined-keyword prefilter must report **overlapping** keywords (Aho-Corasick does; a regex alternation consumes `apikey` and hides `key`), or rules will be skipped silently.

## Recommendation

1. **Engine in the app, no binary.** A TypeScript scanner in `src/core` (pure functions over `path + text`), run from the desktop host off the main thread, before any preview or model call.
2. **Rules = vendored gitleaks TOML (MIT, pinned commit, notice in `NOTICE`) + own config/connection-string rules** (finding 5), translated at build time into a checked JSON rule bundle. Keep gitleaks' keywords, entropy, rule allowlists, stopwords and global path allowlist; replace the two quadratic `curl` rules.
3. **Policy tuned for recall.** A false positive costs one excluded file with a visible reason; a false negative sends a secret to a hosted model. On any finding, exclude the **whole file** before preview, show rule id and line number, never the value.
4. **Tests** (in `tests/`, failing without the change): one fake positive per own rule; the finding-5 table as regression cases; the false-positive cases from finding 4 (integrity fields, UUIDs, hex digests, placeholders); a time-budget test with the adversarial `curl` input.

## Open questions

- May the learner override an exclusion ("this is a fake key")? That is a product decision, and it changes how much false-positive noise is acceptable.
- Test runtime: build-time expansion of `(?i:…)` (needs a regex parser, a dev dependency) or scanner tests under Electron's runtime?
- Should git history be scanned, or only the working copy that becomes the source? This note assumed the working copy.
- The precision/recall figures above come from one 2023 study and one `node_modules` corpus; a corpus of ordinary application code with planted fake secrets would give a fairer false-positive rate.

## Sources

1. gitleaks [LICENSE](https://github.com/gitleaks/gitleaks/blob/master/LICENSE) (MIT); repository licence via GitHub API, 2026-11-17.
2. detect-secrets [`plugins/keyword.py`](https://github.com/Yelp/detect-secrets/blob/master/detect_secrets/plugins/keyword.py) header (MIT notice from bandit).
3. [TruffleHog README](https://github.com/trufflesecurity/trufflehog) (licence, detectors, verification, `--no-verification`, custom detectors).
4. [secretlint README](https://github.com/secretlint/secretlint) (MIT, preset rules, opt-in philosophy, Node ≥ 22); `@secretlint/secretlint-rule-preset-recommend` 13.1.0 on npm.
5. gitleaks [`config/gitleaks.toml`](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml) (read 2026-11-17); [releases](https://github.com/gitleaks/gitleaks/releases).
6. detect-secrets [`plugins/`](https://github.com/Yelp/detect-secrets/tree/master/detect_secrets/plugins) and [`high_entropy_strings.py`](https://github.com/Yelp/detect-secrets/blob/master/detect_secrets/plugins/high_entropy_strings.py).
7. secretlint [`database-connection-string/index.ts`](https://github.com/secretlint/secretlint/blob/main/packages/@secretlint/core/src/builtin/rules/database-connection-string/index.ts).
8. [gitleaks README](https://github.com/gitleaks/gitleaks/blob/master/README.md) (configuration fields, feature-complete notice, Betterleaks).
9. [detect-secrets repository](https://github.com/Yelp/detect-secrets) (Apache-2.0; tag v1.5.0, 2024-05-06).
10. gitleaks [`detect/detect.go`](https://github.com/gitleaks/gitleaks/blob/master/detect/detect.go) (Aho-Corasick prefilter, `MaxTargetMegaBytes`, decode depth).
11. [Betterleaks README](https://github.com/betterleaks/betterleaks) (MIT, Expr logic, Aho-Corasick + RE2, opt-in validation).
12. S. K. Basak, J. Cox, B. Reaves, L. Williams, [A Comparative Study of Software Secrets Reporting by Secret Detection Tools](https://arxiv.org/abs/2307.00714), ESEM 2023.
13. Go [`regexp` package documentation](https://pkg.go.dev/regexp) (linear-time guarantee).
14. V8 blog, [An additional non-backtracking RegExp engine](https://v8.dev/blog/non-backtracking-regexp).
