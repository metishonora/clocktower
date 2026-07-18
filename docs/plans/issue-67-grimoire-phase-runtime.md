# Issue 67: Numbered Phase and Runtime in the Grimoire Center

## Status

The product decisions, implementation plan, and development-only center-treatment prototype were
approved on 2026-07-19. Production implementation and regression coverage are complete.

## Approved Product Contract

- The confirmed Grimoire center replaces `현재 상태` with a two-line status.
- The numbered phase is the smaller first line and the elapsed runtime is the larger second line.
- The visible content is only `2일차 낮` and `12:34`; visible `경과` copy is omitted.
- The combined accessible name describes the value as the elapsed time for the numbered phase, but
  the timer is not an `aria-live` region that announces every tick.
- Setup keeps `입력 중`.
- Ended games show only `게임 종료`; the runtime is hidden.
- The existing Day runtime in the phase-control header is removed rather than duplicated.

The numbering convention is:

- `firstNight:*` displays `1일차 밤`;
- `day:*` and `night:*` display `2일차 낮` and `2일차 밤`;
- `dayN:*` and `nightN:*` display day number `N + 1`.

The runtime remains transient UI state. It uses unbounded `MM:SS`, includes background wall-clock
time, and never enters events, replay contracts, storage, exports, Rust, or WASM.

## Runtime Boundaries

- Setup confirmation starts First Night at `00:00`.
- A change of numbered phase resets to `00:00`.
- Step changes and ordinary undo within the same numbered phase preserve the start.
- Reveal open and close preserve the start while hiding the Grimoire surface.
- Undo across a phase boundary starts the restored phase at `00:00`.
- Loading, importing, reloading, or reopening starts the active phase at `00:00`.
- Game end clears the active runtime. Undoing game end starts the restored phase at `00:00`.
- Interval and visibility callbacks only request rendering; elapsed time comes from an injectable
  clock and ticks must not invoke replay, create events, or write storage.

## Prototype Gate

Build an isolated development-only prototype for the approved hierarchy before production code.
It must cover numbered First Night, Day, Night, a later cycle, setup, game end, representative
runtime values through `60:00`, Player counts 5, 12, and 15, all four seat presets, and the mobile
bottom-sheet focused states.

Review at:

- 1366 x 1024 (iPad Pro 12.9-inch landscape);
- 390 x 844; and
- 360 x 800.

Confirm typography, center/seat separation, compact-seat behavior, and bottom-sheet visibility.
Production implementation does not begin until the user approves this prototype.

## Test-First Production Work

After prototype approval, add the smallest black-box `ClocktowerApp` regression test before
editing production behavior. Confirm it fails for the missing center contract, then implement the
smallest change and refactor only after it passes.

Required coverage includes numbering and resets for First Night, Day, Night and later cycles;
same-phase continuity; Reveal continuity; background catch-up; session/import resets; same-phase
and cross-phase undo; game end and game-end undo; setup copy; removal of duplicate header runtime;
and proof that ticks do not replay, persist, or create events.

## Expected Change Map

- Generalize `dayRuntime.ts` and `useDayRuntime.ts` into phase-runtime modules.
- Add a pure numbered-phase derivation from the stable step-ID prefixes.
- Keep the hook above the full-screen Reveal return in `main.tsx` and pass a narrow center status
  to `Grimoire`.
- Render setup, active runtime, and game-end center states in `Grimoire.tsx`.
- Remove the Day-runtime prop and rendering from `PhaseControl.tsx`.
- Apply only the approved center typography and responsive sizing in `styles.css`.
- Do not change Rust, WASM, event, replay, or persisted schemas.

## Completion

Run the focused regression test, `pnpm --dir web test`, `pnpm --dir web build`, and
`git diff --check`; repeat visual checks at the approved viewports and Player-count boundaries;
review for reset, persistence, replay, accessibility, duplicate UI, and collision regressions;
then commit and push `codex/issue-67`.
