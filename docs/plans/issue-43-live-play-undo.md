# Issue #43: Latest Live-Play Undo

## Approved product decision

Approved on 2026-07-16:

- Placement: **Variant B**, attached to the latest event/event-log surface and visible while the log is collapsed.
- Action label: `Undo`.
- Dialog title: `최근 확정 행동을 되돌릴까요?`.
- Target line: `되돌릴 항목: {latestEvent.summary}`.
- Dialog actions: `취소` and `되돌리기`.

Production keeps live-play Undo separate from initial setup recovery. Live Undo removes exactly the
latest post-setup event, guards the expected event ID, replays and autosaves the reduced GameFile,
and clears transient workflow state only after confirmed removal. Setup recovery remains
`설정 다시 수정` and is offered only when `setupConfirmed` is the sole replayed event.

The development prototype is isolated from the production store and persistence. Production work
follows test-first development in the dedicated `codex/issue-43` worktree.
