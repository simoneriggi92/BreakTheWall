# Coding standards

Judgement calls the reviewer applies to a diff. Mechanical rules belong in a check (`npm run check`, CI), not here; the rules in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) still apply.

## Generation routes

- **Schema misses are refused answers.** Every way a route's provider reports an answer that misses the schema (an unparseable reply, a reply outside the schema, the provider giving up on its own structured-output retries) reaches the acceptance as a refused answer, so the one repair runs as on every other route. Only process, network and account failures become a `ProviderFailure`. Source: #93, where `claude -p`'s `error_max_structured_output_retries` first skipped the repair.
