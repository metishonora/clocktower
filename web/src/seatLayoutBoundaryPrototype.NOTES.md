# Issue 71 Seat-Layout Boundary Prototype

## Status

Approved by the product owner on 2026-07-18. Production implementation may follow this boundary,
including persistent confirmed seat coordinates through optional `GameFile` UI metadata.

## Candidate direction

- Keep layout presets, overlap feedback, `위치 조정`, and `자동 배치` directly above the setup
  Grimoire, where their effect is visible.
- Keep save/import/recovery actions in a separate management panel.
- On setup confirmation, carry the chosen coordinates into live play but render no layout toolbar,
  overlap feedback, overlap styling, drag mode, or other layout-editing affordance.
- Keep Player seat selection operational in live play.
- When setup recovery is still eligible, return to setup with the same coordinates.

## Prototype-only behavior

- The `겹침 상태 보기` checkbox is a development scenario control rendered only on the setup
  candidate. It is not proposed production copy.
- JSON and new-game controls are visual placeholders.
- State is intentionally in-memory. The approved production implementation persists confirmed
  layout data through optional `GameFile` UI metadata; this prototype does not exercise storage.

## Review checklist

- Check the setup toolbar placement at iPad landscape and narrow mobile widths.
- Confirm that live play has no layout controls or overlap feedback and recovers the vertical space.
- Select a live Player seat and confirm the operational interaction remains obvious.
- Expand `설정 및 불러오기` and confirm layout controls do not reappear there.
- Use `설정 다시 수정` and confirm the chosen seat coordinates return.
