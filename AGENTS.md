# Clocktower Agent Guide

## Working style

- Before starting work on an issue, create a dedicated Git worktree and branch for that issue, and perform all implementation, testing, review, commit, and push work there. If the current directory is already the issue's dedicated worktree, continue using it instead of creating another one.
- When implementation needs a UI/product decision, confirm it with the user through a prototype before building the final version. Do not add UI behavior or product scope the user did not ask for.
- For Rust domain changes, follow the module ownership and script-file conventions in `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Test-first behavior changes

- Use a sequential test-first handoff for non-trivial changes to domain rules, state transitions, voting or win conditions, persistence, undo/replay, WASM contracts, and user-visible workflows.
- Sol must finalize the acceptance criteria and stable public contract before delegation. The test worker may use the approved requirements, project specs, existing public interfaces, and test conventions, but must not receive a proposed implementation design or edit production source.
- The test worker writes the smallest black-box behavioral or regression test at a stable seam and demonstrates that it fails for the intended reason; environment, harness, and unrelated failures do not count. Sol reviews this result before implementation starts.
- A separate implementation worker then changes production code and may add implementation-coupled unit tests, but must not weaken, delete, or rewrite the approved behavioral test without Sol approval.
- Skip this handoff for documentation-only work and trivial mechanical changes. Keep both workers in the issue worktree and do not run test and source implementation in parallel.

## Code-change completion checklist

When finishing a requested code change, run the relevant tests, perform a code review pass, commit the finished work, and push the branch unless the user asks otherwise or the operation is blocked.

This checklist applies to code changes only. Do not run tests, code review, commit, or push for ordinary questions, planning, research, or documentation-only updates unless the user explicitly requests it.

- When closing a ticket, include regression coverage for the changed behavior when practical. Prefer the smallest test that would fail before the fix. If no regression test is added, state why in the completion note.
- For Rust changes, run `cargo test --workspace`.
- For web changes, run `pnpm --dir web test` and `pnpm --dir web build` when relevant.
- For local dev-server validation, bind to `0.0.0.0`.
- If commit or push is blocked by unrelated worktree changes, permissions, or network access, report the blocker clearly.
