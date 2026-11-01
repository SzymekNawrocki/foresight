# Fast and slow lanes: the owner approves intent and results, not every step

Until now every change went through the owner three times: merge the PR, approve the deploy in the `production` environment, and run the model eval locally. With an agent writing the code, those steps became the bottleneck. The eval baseline for #79 waited four days for a local run, and an unapproved old Deploy run once blocked the queue (2026-10-29). The steps also taught less over time: clicking Approve on a green build is not review. Decided on 2026-11-01 (#81).

Key decisions:

- **Two lanes, picked by the files a PR touches.** A required `Lane` check decides.
  - **Fast lane (default):** app code under `apps/` and `packages/`. The PR merges itself (GitHub auto-merge) once every required check is green, and Deploy runs without a reviewer.
  - **Slow lane:** `infra/`, `.github/`, `scripts/`, the LLM prompt, the eval and the seed Threads. These can cost money, widen access or change what the model decides. `Lane` fails until the owner adds the `owner-approved` label, and the owner merges by hand. HCP Terraform `apply` stays a manual confirmation.
- **Safety moves from the click to the pipeline.** Deploy saves the live Lambda code before uploading, runs a smoke test on `/`, `/api/health` and `/api/threads`, and puts the old code back if the test fails. The signature check (cosign) and the OIDC trust on the `production` environment stay as they were.
- **The eval runs in CI.** PRs that touch the analysis, eval, LLM or Thread code run `pnpm eval` with a `GROQ_API_KEY` secret and post the score as a PR comment. Groq is the same free plan the ingest already uses (ADR 0003), so this keeps the 0 PLN rule. A manual run on `main` gives the baseline. The eval is not a required check, because LLM output varies between runs; the owner reads the score on slow-lane PRs anyway.
- **Dependabot npm patch/minor updates auto-merge.** Majors and GitHub Actions updates stay with the owner. A merge made with `GITHUB_TOKEN` does not start push-triggered workflows, so Deploy also runs weekly (Tuesday 09:00 UTC) to put those merges on prod.
- **AI code review stays local** (`/code-review` in Claude Code). Running it in Actions needs a paid API.

## Considered Options

- **Keep the manual gates.** Safe, but the owner spends attention on clicks that check nothing a pipeline cannot.
- **Auto-merge everything, including infra.** Fastest, but a bad Terraform or IAM change can cost money or open access, and the 0 PLN rule has no undo.
- **Preview environments per PR.** Useful later; for now they add infrastructure that must also stay always free.

## Consequences

- The `Lane` label is a guard against accidents, not against someone with write access: the agent works with the owner's token and could add the label. The rule is that only the owner adds it.
- A failed smoke test leaves the run red and the old code live; the published Lambda version of the bad build stays as a record.
- Repo settings outside Terraform: auto-merge allowed, branches deleted on merge, a ruleset on `main` requiring the CI checks and `Lane`, and no required reviewer on `production`.
