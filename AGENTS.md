# Clocktower Agent Guide

## Working style

- Before starting code work, pull the latest `main`, then create a dedicated issue worktree and branch.
- When implementation needs a UI/product decision, confirm it with the user through a prototype before building the final version. Do not add UI behavior or product scope the user did not ask for.
- Keep live-play UI concise for a rule-literate Storyteller. Do not add explanatory sentences that merely restate visible labels, state, or already-decided behavior. Prefer actionable operational values such as thresholds, living-Player counts, vote counts, and eligibility. Keep explanatory copy only when it is needed to prevent a misleading or destructive action, communicate validation or failure, explain recovery, or satisfy an explicit user request.
- For Rust domain changes, follow the module ownership and script-file conventions in `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Test-first behavior changes

- Apply test-first development to non-trivial changes in domain rules, state transitions, voting or win conditions, persistence, undo/replay, WASM contracts, and user-visible workflows.
- Finalize the acceptance criteria and stable public contract, then write the smallest black-box behavioral or regression test at a stable seam before editing production code.
- Run the new test and confirm that it fails for the intended behavioral reason; environment, harness, and unrelated failures do not count.
- Implement the smallest production change without weakening, deleting, or rewriting the approved behavioral test. If the test must change, first explain the requirement or test error that makes the change necessary.
- Refactor only after the test passes, then run the relevant regression checks and review the diff. Skip this workflow for documentation-only work and trivial mechanical changes.

## Test server lifecycle

- When the user requests a test server, run it as a detached background process bound to `0.0.0.0`, record its PID, and keep it running after the response.
- Provide an explicit clickable `http://<tailscale-ip>:<port>` link using the machine's current Tailscale IPv4 address, not `localhost`.
- At the start of the next user turn, stop the recorded test server before doing other work unless the user explicitly asks to keep it running.

## Code-change completion checklist

When finishing a requested code change, run the relevant tests, perform a code review pass, commit the finished work, and push the branch unless the user asks otherwise or the operation is blocked.

This checklist applies to code changes only. Do not run tests, code review, commit, or push for ordinary questions, planning, research, or documentation-only updates unless the user explicitly requests it.

- When closing a ticket, include regression coverage for the changed behavior when practical. Prefer the smallest test that would fail before the fix. If no regression test is added, state why in the completion note.
- For Rust changes, run `cargo test --workspace`.
- For web changes, run `pnpm --dir web test` and `pnpm --dir web build` when relevant.
- For local dev-server validation, bind to `0.0.0.0`.
- If commit or push is blocked by unrelated worktree changes, permissions, or network access, report the blocker clearly.
