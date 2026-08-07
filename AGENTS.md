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

- Reserve port `5173` for the `develop` worktree. For issue worktrees, use port `10000 + issue number`; choose and record an unused port for other worktrees or necessary exceptions.
- If the assigned port is occupied by anything other than the server recorded for the current worktree, do not stop it; use and record an alternate port.
- Run requested test servers detached from the tool session, bound to `0.0.0.0`, and record their PID, port, log, and worktree so they remain available after the response.
- Stop only a recorded server after verifying its PID and command belong to the current worktree. Never terminate an unknown process merely because it occupies the desired port.
- Verify the process and server response, then provide a clickable Tailscale IPv4 URL.
- At the start of the next user turn, stop only the server recorded for that worktree unless the user explicitly asks to keep it running.

## Completion

- For code changes, run relevant tests, review the complete diff, commit, and push unless the user asks otherwise or an operation is blocked.
- Do not apply this workflow to questions, planning, research, prototypes, or documentation-only changes unless explicitly requested.
- When closing a ticket, add the smallest practical regression coverage for changed behavior. State why when none is added.
- For Rust changes, run `cargo test --workspace`.
- For relevant web changes, run `pnpm --dir web test` and `pnpm --dir web build`.
