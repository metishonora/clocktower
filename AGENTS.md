# Clocktower Agent Guide

## Issue workflow

- Start issue work with `$clocktower-analyze-issue #<number>` and wait for its analysis questions. After it records `analysis-approved`, continue with `$clocktower-issue #<number>`. Use `$clocktower-close-issue #<number>` only after explicit user acceptance.
- Keep `main` deployable; release by merging `develop` into `main`.
- For code work outside the issue lifecycle, update `develop`, then create a dedicated branch and worktree from it.
- Branch hotfixes from `main` and merge them back into `develop`.

## Product rules

- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values such as thresholds, living-Player counts, vote counts, and eligibility. Add explanatory copy only to prevent misleading or destructive actions, communicate validation or failure, explain recovery, or satisfy an explicit request.
- For Rust domain changes, follow `ARCHITECTURE.md` module ownership and script-file conventions, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Code quality

- Use test-first development for non-trivial behavior changes: confirm the smallest stable behavioral or regression test fails for the intended reason before production edits.
- Before completing a code change, run relevant tests, review the full diff, commit, and push unless the user asks otherwise or an operation is blocked.
- When closing a ticket, add the smallest practical regression coverage for changed behavior. If none is added, state why.
- For Rust changes, run `cargo test --workspace`.
- For web changes, run `pnpm --dir web test` and `pnpm --dir web build` when relevant.
- Bind local validation servers to `0.0.0.0`.
- Report commit, push, test, or review blockers clearly.
