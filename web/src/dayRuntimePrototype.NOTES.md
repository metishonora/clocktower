# Day Runtime Prototype Notes

Run `pnpm prototype:day-runtime`, then open:

`http://localhost:5173/?prototype=day-runtime`

Target viewport: iPad Pro 12.9-inch (5th generation), landscape, 1366 × 1024 CSS pixels.

This isolated development-only prototype compares:

- A: `낮 경과 MM:SS` at the right side of the phase-panel header, beside the existing input badge.
- B: a smaller inline `낮 경과 MM:SS` beneath the current phase/step title.

Use the toolbar to inspect `00:00`, `05:07`, `12:34`, `42:17`, and `60:00` on Whisper,
Discussion, Nomination/Voting, Execution, and confirmed Storyteller follow-up surfaces. Night,
Setup, and full-screen Reveal intentionally omit the runtime.

No production timer, persistence, replay, event, Rust, or WASM behavior is connected to this
prototype. Production implementation remains blocked until one placement and its compact styling
are approved.
