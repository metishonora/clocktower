# Clocktower Agent Guide

## Working style

- Keep `main` deployable. Start normal code work from an updated `develop` in a dedicated issue branch and worktree.
- Issue branches target `develop`; releases target `main` through `develop`.
- Branch hotfixes from `main` and merge them back into `develop`.
- When explicitly closing an issue, stop its review server and remove its clean issue worktree after merge and push. If the worktree is dirty or unmerged, preserve it and report the blocker; never force removal.
- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values and add explanatory copy only for validation, failure, recovery, destructive actions, or explicit requests.
- Materially different approaches may be proposed when they have a concrete benefit. Before adopting one in tests or production implementation, document in the plan how it differs from approved decisions or established project references, along with its rationale and tradeoffs, and obtain explicit user approval.
- For Rust domain changes, follow `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Prototype workflow

- Use prototypes to settle one bounded set of material UI decisions before production implementation.
- Keep the review screen faithful to the current `develop` UI even when data or behavior is simplified, and keep review-only controls outside it. Do not add tests solely for prototype presentation.
- Have `prototype_reviewer` verify new or materially revised prototypes before user review.
- Record approved decisions and retain the approved prototype as the production visual baseline.
- Prototype approval covers UI and interaction only; production acceptance uses the real entry and runtime.

## Test contract review

- For non-trivial behavior changes, after confirming new or materially changed tests fail for the expected reason and before writing production code, have `test_contract_reviewer` review the test contract against approved decisions, references, and material acceptance invariants.
- Resolve reported blockers and obtain user decisions for material unapproved product changes before implementation. Repeat the review only when the test contract changes materially.

## Test server lifecycle

- Delegate requested Clocktower test-server operations to `web_server_operator`. If it is unavailable, use only `node scripts/test-server-manager.mjs`; agent unavailability must not block the operation, and direct server or process commands are prohibited.
- `.codex/web-server.json` and the shared manager own profiles, ports, binding, process ownership, verification, URLs, and session cleanup. Never terminate an unrecorded or unverified process.
- Keep review servers running across turns while the review remains active. Stop them through the lifecycle manager when the review concludes, the worktree or phase changes, the server is replaced, or the user requests it. A turn boundary alone is not a reason to stop.

## Completion

- Changes limited to the test-server manager, its lifecycle hooks, or server-operator configuration require focused manager tests and a real start/HTTP/stop smoke test. Do not run full application regression suites unless application runtime or build behavior changes.
- For Rust changes, run `cargo test --workspace`.
- For relevant web changes, run `pnpm --dir web test` and `pnpm --dir web build`.
