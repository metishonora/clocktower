# Clocktower Agent Guide

## Working style

- Keep `main` deployable. Start normal code work from an updated `develop` in a dedicated issue branch and worktree.
- Merge issue branches into `develop` only after explicit user acceptance. Release by merging `develop` into `main`.
- Branch hotfixes from `main` and merge them back into `develop`.
- Do not add UI behavior or product scope the user did not request.
- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values and add explanatory copy only for validation, failure, recovery, destructive actions, or explicit requests.
- For Rust domain changes, follow `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Prototype workflow

- Use prototypes to settle and record concrete UI decisions before production implementation, avoiding late redesign after the feature is built.
- Build a disposable static harness matching the current `develop` app shell, layout, styles, and target viewports. Reuse production presentation components when practical so feedback transfers to the final UI.
- Use only the fixture state needed for visual review. Do not create fake behavior that is unnecessary for the decisions being reviewed, and keep review controls outside the production-like screen.
- Record approved and rejected UI decisions in the issue plan before finalizing the production plan.
- Prototype approval validates UI and interaction decisions only. Production acceptance must use the real production entry and runtime.
- Skip TDD and full regression suites for isolated prototypes. Run focused checks only when shared production code or configuration changes.

## Test server lifecycle

- Run requested test servers detached from the tool session, bound to `0.0.0.0`, with logs and PID recorded so they remain available after the response.
- Verify the process and server response, then provide a clickable Tailscale IPv4 URL.
- At the start of the next user turn, stop the recorded server unless the user explicitly asks to keep it running.

## Completion

- For code changes, run relevant tests, review the complete diff, commit, and push unless the user asks otherwise or an operation is blocked.
- Do not apply this workflow to questions, planning, research, prototypes, or documentation-only changes unless explicitly requested.
- When closing a ticket, add the smallest practical regression coverage for changed behavior. State why when none is added.
- For Rust changes, run `cargo test --workspace`.
- For relevant web changes, run `pnpm --dir web test` and `pnpm --dir web build`.
