# Atlas Reader: Releasing the Web Client to Staging

**Purpose:** Release a new version of the Atlas Reader web client to the existing staging environment
**Not covered:** Creating clusters, namespaces, registries, DNS records, certificates, or access policies
**Current operating mode:** Releases are started by hand; staging is live, production is frozen
**Owner:** Platform team (fictional example written for the Break the Wall evaluation set)

## 1. What a release is

A release never copies files onto a server. The pipeline:

1. checks out one exact commit of the `reader-web` repository;
2. installs dependencies from the lockfile and runs the checks;
3. builds one container image that contains only the compiled assets and the web server;
4. pushes that image to the internal registry;
5. writes the image digest into a release record (`release.json`);
6. updates the staging deployment to that digest;
7. waits for the rollout and checks the health endpoint;
8. keeps the previous digest available for rollback.

The digest is the identity of a release. Tags such as `staging-142` are labels for people;
two builds can never share a digest, but a tag can be moved.

## 2. Pipelines

| Pipeline | What it does | Output |
| --- | --- | --- |
| `reader-web / check` | Install, lint, type check, unit tests, production build | `check-report.html` |
| `reader-web / image` | Build and push the container image | `release.json` |
| `reader-web / deploy-staging` | Roll the staging deployment to the recorded digest | `rollout.json` |

The three pipelines form one chain. `deploy-staging` depends on `image`, which depends on
`check`, and all three must use the same commit. Nothing runs on a schedule or on push.

## 3. Before you start

- [ ] The change is merged into `main`.
- [ ] You know the full commit SHA you expect to release.
- [ ] No other staging release is running or waiting.
- [ ] Testers know a release is about to happen.
- [ ] You have read the change for configuration, API contract or routing changes.
- [ ] You have written down which smoke tests you will run and what would make you roll back.

If the change also needs a new environment variable, add it to the staging configuration
first and review it with a second person. The image must not contain environment-specific values.

## 4. Running the chain

Open `reader-web / deploy-staging` and choose **Run with dependencies**.

1. Select branch `main`.
2. Check that the resolved commit equals the SHA you wrote down.
3. Keep "reuse previous builds" switched off, so the chain runs on this commit.
4. Start the run.

If the run dialog cannot show one commit for the whole chain, run the three pipelines one at a
time and compare the commit in each run. Never deploy a `release.json` produced from a different
commit than the one you checked.

## 5. What `check` verifies

The `check` pipeline fails if any of these fails:

- dependencies install exactly from the lockfile (no updates during install);
- the linter reports no errors;
- the type checker passes;
- unit tests pass;
- the production build completes;
- the built bundle contains no development endpoints and no `localhost` URLs;
- every route listed in `routes.json` has a page in the build output.

A failure here means the source is not releasable. Nothing outside the build server has changed.

## 6. What `image` produces

The `image` pipeline builds the container in two stages. The first stage compiles the client; the
second stage copies only the compiled assets and the web server configuration into a small runtime
image. The runtime image:

- runs as a non-root user;
- listens on port 8080;
- contains no package manager cache, no source files and no test files;
- serves `/healthz` with status `200` once the server is ready.

After pushing, the pipeline writes `release.json`:

```json
{
  "commit": "full SHA",
  "image": "registry.internal/reader-web",
  "tag": "staging-<build number>",
  "digest": "sha256:...",
  "built_at": "ISO timestamp"
}
```

Check that the commit is the one you expected and that the digest is present. If `release.json`
is missing, the image may exist in the registry but it is not approved for deployment.

## 7. What `deploy-staging` does

The deploy pipeline reads `release.json` and changes exactly one thing: the image of the `web`
container in the `reader-web` deployment of the `staging` namespace, set by digest.

It does not change replicas, resource limits, environment variables, probes or the service.
If any of those must change, that is a separate, reviewed configuration change.

The rollout replaces pods one at a time. For a short period old and new pods run together; this
is expected. The pipeline waits until:

- all replicas run the new digest;
- every new pod reports ready;
- `/healthz` answers `200` through the staging ingress.

Then it writes `rollout.json` with the previous digest, the new digest and the time of each step.

## 8. Smoke tests

From the staging network, with the browser cache disabled:

- [ ] the home page loads and shows the current build number in the footer;
- [ ] a deep link loads directly and after a refresh;
- [ ] a missing asset returns `404`, not the home page;
- [ ] HTML responses are sent with `Cache-Control: no-store`;
- [ ] hashed assets are sent with a long, immutable cache lifetime;
- [ ] signing in and opening a document works;
- [ ] the browser console shows no new errors;
- [ ] the server logs show no repeated errors after the rollout.

## 9. Rollback

### 9.1 When

Roll back when an acceptance check fails and a fix cannot be released within the agreed window:

- the rollout does not finish;
- pods restart repeatedly or stay not ready;
- the running digest differs from the one in `release.json`;
- a smoke test fails;
- users report a regression in a core flow.

### 9.2 How

1. Tell the testers that staging is being rolled back.
2. Open the `rollout.json` of the failed release and find the previous digest.
3. Run `reader-web / deploy-staging` with **Deploy recorded release** and choose the previous
   `release.json`.
4. Do not rebuild the old commit. A rebuild produces a new image; rollback means redeploying the
   exact digest that was running before.
5. Wait for the rollout checks, then repeat the smoke tests.
6. Write down the failed digest, the restored digest, the reason and the times.

### 9.3 What rollback does not undo

Redeploying the previous image does not undo:

- data written by the new version;
- messages already sent to other services;
- changes to shared configuration made for the release.

If a release changes stored data, its rollback must be designed and reviewed before the release.

## 10. When a pipeline fails

| Where it failed | What it means | What to do |
| --- | --- | --- |
| `check` | The source is not releasable; nothing else changed | Fix the source and start again |
| `image`, before the push | No new image exists | Fix the build and run `image` again |
| `image`, after the push but before `release.json` | An image exists but is not approved | Run `image` again; never deploy the orphan image by hand |
| `deploy-staging`, before the rollout starts | Staging is unchanged | Fix the input and run the deploy again |
| `deploy-staging`, during the rollout | Staging may run old and new pods | Check which digest each pod runs before rerunning or rolling back |
| `deploy-staging`, after the rollout, on the health check | The new version is running but unhealthy | Roll back unless a fix is ready within the window |

## 11. Production

This runbook covers staging only. Production releases are frozen until the production checklist is
approved; do not reuse these steps for production.
