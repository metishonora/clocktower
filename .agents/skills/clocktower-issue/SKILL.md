---
name: clocktower-issue
description: Continue an analysis-approved Clocktower issue through UI prototype, planning, TDD implementation, and acceptance. Use after issue analysis or for prototype, plan, implementation, and acceptance feedback.
---

# Clocktower Issue

Drive an analyzed issue to explicit user acceptance. Follow `AGENTS.md`. Do not merge into `develop` or close the issue; `$clocktower-close-issue` owns integration.

## Start or resume

1. Require an issue number; do not guess between multiple active issues.
2. Read the GitHub issue with `gh`, `AGENTS.md`, its plan, and current Git/worktree state.
3. Stop the issue's recorded test server before other work unless the current user message explicitly asks to keep it running. Run `.agents/skills/clocktower-issue/scripts/test-server.sh stop <number>`.
4. Require the dedicated issue worktree and an `analysis-approved` or later checkpoint. If either is missing, stop and direct the user to `$clocktower-analyze-issue #<number>`.
5. Recover the active phase from the checkpoint and verify it against repository state. Never infer an approval that is not recorded. From `analysis-approved`, advance to `prototype` when visual approval is required; otherwise advance to `plan`.
6. Read only the reference for the active phase:
   - prototype: `references/prototype.md`
   - architecture plan or implementation: `references/plan-implement.md`
   - acceptance preparation or feedback: `references/acceptance.md`
7. Update the checkpoint before every pause and after every user decision or phase transition.

## Durable checkpoint

Keep this compact block near the top of the issue plan:

```markdown
## Workflow checkpoint

- Phase: analysis-approved | prototype | plan | implement | accept | accepted
- Status: active | waiting-for-user | blocked | complete
- Approved: <decision references or none>
- Open questions: <items or none>
- Branch: <branch or none>
- Worktree: <path or none>
- Test server: <PID/state path or none>
- Next action: <one concrete action>
```

Record detailed requirements, decisions, plans, and test results in normal plan sections rather than expanding the checkpoint.

## Approval gates

- Pause after the prototype for visual and interaction approval.
- Pause after the architecture and implementation plan for production approval.
- Brief the behavioral tests immediately before TDD implementation; do not require another gate unless the user asks.
- Pause after acceptance setup with the checklist and live Tailscale URL.
- Mark `accepted` only from explicit user approval, then direct the user to `$clocktower-close-issue #<number>`.

At each pause, state what was recorded and give the exact short resume command: `$clocktower-issue #<number> continue` plus the needed decision.
