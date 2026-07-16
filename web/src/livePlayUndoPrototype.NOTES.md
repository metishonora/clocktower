# Issue #43 Live-play Undo Prototype Notes

Run `pnpm prototype:live-play-undo`, then open:

`http://localhost:5173/?prototype=live-play-undo`

This development-only prototype compares two placements for `최근 행동 되돌리기`:

- Variant A keeps the action on the current-action surface, including the pending Reveal follow-up.
- Variant B associates the action with the newest event inside the event-log surface.

Use the scenario switcher to inspect normal live play, pending Reveal, setup-only eligibility, and a
busy/replaying state. The interaction is mocked locally: it does not import production features,
read or mutate the game store, replay through Wasm, or persist a GameFile.

Candidate copy shown for approval:

- action: `최근 행동 되돌리기`;
- title: `최근 확정 행동을 되돌릴까요?`;
- target: `되돌릴 항목: {latestEvent.summary}`;
- actions: `취소`, `되돌리기`.
