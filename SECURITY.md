# Security policy

Break the Wall handles two things that must not leak: the learner's sources, and the ChatGPT credentials kept in the macOS Keychain. Reports about either are welcome and treated as a priority.

## Supported versions

Break the Wall is an alpha. Only the latest commit on `main` and the app attached to the latest release receive security fixes. The macOS app is signed ad-hoc and not notarized by Apple, and the Windows setup is not code-signed: download them only from this repository's releases, and check each against the `.sha256` file published with it.

## Reporting a vulnerability

Please do not open a public issue. Report it privately instead:

1. **Preferred:** on GitHub, open the repository's **Security** tab and choose **Report a vulnerability**.
2. **Or by email:** simone.riggi92@gmail.com, with "Break the Wall security" in the subject.

Include what you found, how to reproduce it, and what an attacker could reach. You will get an answer within 7 days. Once a fix is on `main`, the report is credited in the advisory unless you prefer otherwise.

## In scope

- Credentials or tokens reaching the renderer, the logs, or a file outside the Keychain-backed vault.
- A source, or text derived from it, leaving the device through a route the learner did not choose, or a local-model request reaching a host other than this Mac.
- Code execution from a source, a markdown document, a Mermaid diagram or a model's answer (the renderer must show them as data).
- An IPC call that a page other than the app's own can reach, or that accepts input the host does not validate.
- A loosened content security policy in the production build.

## Out of scope

- The correctness of generated explanations: they are checked for structure and citations, not for truth, as the README states.
- Vulnerabilities in a model provider's own service; report those to the provider.
