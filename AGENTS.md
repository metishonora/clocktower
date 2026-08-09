# Clocktower Agent Guide

## Working style

- Keep `main` deployable. Start normal code work from an updated `develop` in a dedicated issue branch and worktree.
- Merge issue branches into `develop` only after explicit user acceptance. Release by merging `develop` into `main`.
- Branch hotfixes from `main` and merge them back into `develop`.
- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values and add explanatory copy only for validation, failure, recovery, destructive actions, or explicit requests.
- For Rust domain changes, follow `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Prototype workflow

- Use prototypes to settle the intended final UI before production implementation, so production work carries the approved design forward instead of redesigning it.
- Keep prototypes visually aligned with the current `develop` app shell, layout, styles, and target viewports so review feedback applies directly to the final experience.
- Use only the fixture state needed for visual review. Do not create fake behavior that is unnecessary for the decisions being reviewed, and keep review controls outside the production-like screen.
- Record approved and rejected UI decisions in the issue plan, and retain a reviewable approved prototype reference until production acceptance.
- Treat the approved prototype as the visual acceptance baseline. Reusing existing components is acceptable only when the resulting production UI remains faithful to that baseline.
- Before requesting production acceptance, compare the real production UI with the approved prototype for the agreed states and target viewports. Fix unintended differences or obtain explicit approval for necessary deviations.
- Prototype approval validates UI and interaction decisions only. Production acceptance must use the real production entry and runtime.
- Skip TDD and full regression suites for isolated prototypes. Run focused checks only when shared production code or configuration changes.

## Test server lifecycle

- For requested Clocktower test servers, use `clocktower_server_operator` when available; otherwise invoke the repository test-server manager directly. Agent unavailability must not block server operations.
- Use only `node scripts/test-server-manager.mjs` for test-server start, status, keep, release, reconcile, and stop operations. `pnpm test-server` is a manual convenience alias, not the agent entry point. Do not improvise Vite, screen, detached-process, port-selection, or process-termination commands.
- The manager owns worktree-specific port allocation, `0.0.0.0` binding, strict-port handling, detached execution, process ownership, logs, HTTP verification, and the Tailscale IPv4 URL.
- Never terminate a process not recorded and verified by the manager.
- By default, stop the session-owned server on the next user turn. Preserve it when the user explicitly requests continued operation.

## Completion

- For code changes, run relevant tests, review the complete diff, commit, and push unless the user asks otherwise or an operation is blocked.
- Do not apply this workflow to questions, planning, research, prototypes, or documentation-only changes unless explicitly requested.
- Changes limited to test-server management, hooks, or agent configuration require focused manager tests and a real start/HTTP/stop smoke test. Do not run full application regression suites unless application runtime or build behavior changes.
- When closing a ticket, add the smallest practical regression coverage for changed behavior. State why when none is added.
- For Rust changes, run `cargo test --workspace`.
- For relevant web changes, run `pnpm --dir web test` and `pnpm --dir web build`.
