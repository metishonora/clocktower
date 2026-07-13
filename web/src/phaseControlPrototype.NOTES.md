# Phase Control Prototype Notes

Question: Which clean phase-control layout should replace verbose rule-help UI for a rule-literate Storyteller?

Run: `pnpm prototype:phase-control`, then open `http://localhost:5173/?prototype=phase-control&variant=A`.

Shared decisions already made:

- Default screen includes phase action, acting Player, status information, and true information when false information may be shown.
- Rules explanation stays out of the default screen.
- Grimoire Peek is a temporary read-only overlay for full state checks.
- iPad default uses a right-side action panel. Mobile uses a bottom sheet.

Variants:

- A - map-first split: Grimoire remains dominant, action panel fixed on the right.
- B - action-first split: action panel dominates, context is secondary.
- C - order-first split: phase order rail drives the layout, Grimoire and action panel sit beside it.

Decision placeholder:

- Chosen direction:
- Pieces to keep:
- Pieces to reject:
- Issue #25 comment URL:
