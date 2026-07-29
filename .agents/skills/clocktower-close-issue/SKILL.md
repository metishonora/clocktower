---
name: clocktower-close-issue
description: Integrate an explicitly accepted Clocktower issue into develop, push it, close GitHub, and remove its worktree. Use only when the user asks to close an accepted issue.
---

# Close Clocktower Issue

Close one accepted issue without changing product scope or implementation.

## Preconditions

1. Require the issue number and an explicit close request in the current user message.
2. Read `AGENTS.md`, the GitHub issue, its plan checkpoint, and all relevant Git/worktree state.
3. Stop its test server with `.agents/skills/clocktower-issue/scripts/test-server.sh stop <number>`.
4. Require all of the following before integration:
   - checkpoint phase is `accepted` with explicit user approval recorded;
   - no open product question or blocked required check remains;
   - issue branch is committed and its worktree is clean;
   - required tests and review results are recorded;
   - the primary `develop` worktree is clean.

If a precondition fails, report it and stop without merging, pushing, closing, or deleting anything.

## Integrate and close

1. Fetch the remote and fast-forward local `develop`. Never force-push `develop` or `main`.
2. Reconcile the issue branch with current `develop` in its own worktree. Resolve only unambiguous conflicts and rerun affected required checks when `develop` changed.
3. Review the final `develop...issue-branch` diff for scope, regressions, generated files, and missing coverage.
4. Merge the issue branch into `develop` with the repository's explicit issue merge-commit convention.
5. Push `develop`, then verify the remote contains the merge commit.
   If the push is rejected because remote `develop` advanced, reconcile without force, rerun affected checks, and retry.
6. Close the GitHub issue with a concise comment containing the merge commit and verification summary.
7. Remove the issue worktree and delete its local branch only after the push and close both succeed. Do not delete a remote branch unless the user asks.
8. Report tests, review, merge commit, pushed branch, closed issue, and cleanup status.
