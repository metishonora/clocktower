# Issue 67 Grimoire Phase Runtime Prototype

Run `pnpm --dir web prototype:grimoire-phase-runtime`, then open:

`http://<tailscale-ip>:5173/?prototype=grimoire-phase-runtime`

This development-only prototype implements the approved hierarchy: a smaller numbered phase above
a larger tabular `MM:SS` value. The visible center contains no `경과` label. The combined accessible
name still describes the elapsed value, and no live announcements are used.

Review the controls for First Night, Day, Night, a later Day, game end, setup, `00:00` through
`60:00`, 5/12/15 Players, and all four seat presets. On narrow mobile widths, use the bottom-sheet
toggle to compare the Grimoire-focused and controls-focused heights.

Target viewports are 1366 x 1024, 390 x 844, and 360 x 800. Confirm center typography and separation
from seat controls, especially at 12 and 15 Players. No production timer, replay, event, persistence,
Rust, or WASM behavior is connected to this prototype.
