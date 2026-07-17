# Issue #28 Phase Layout Reorder Prototype

Run `pnpm prototype:phase-layout-reorder`, then open:

`http://localhost:5173/?prototype=phase-layout-reorder`

This development-only prototype compares the phase overview above the current action:

- Variant A keeps the existing vertical overview list.
- Variant B uses a compact horizontal progress treatment.
- The Mobile preview makes the overview a disclosure, collapsed by default so the action remains
  immediately available in the fixed bottom sheet.

The prototype uses local display state only. Confirm and Skip do not send Commands, replay, or
persist a GameFile. Pending Reveal and game-end surfaces are intentionally out of scope.
