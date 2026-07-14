# Clocktower Agent Guide

## Working style

- When implementation needs a UI/product decision, confirm it with the user through a prototype before building the final version. Do not add UI behavior or product scope the user did not ask for.

## Code-change completion checklist

When finishing a requested code change, run the relevant tests, perform a code review pass, commit the finished work, and push the branch unless the user asks otherwise or the operation is blocked.

This checklist applies to code changes only. Do not run tests, code review, commit, or push for ordinary questions, planning, research, or documentation-only updates unless the user explicitly requests it.

- When closing a ticket, include regression coverage for the changed behavior when practical. Prefer the smallest test that would fail before the fix. If no regression test is added, state why in the completion note.
- For Rust changes, run `cargo test --workspace`.
- For web changes, run `pnpm --dir web test` and `pnpm --dir web build` when relevant.
- For local dev-server validation, bind to `0.0.0.0`.
- If commit or push is blocked by unrelated worktree changes, permissions, or network access, report the blocker clearly.
