# Issue 77: Phase Runtime on the Grimoire Table Marker

## Status

The issue analysis and product decisions were approved on 2026-07-19. Build and review the
development-only placement prototype before changing the production Grimoire.

## Approved Product Contract

- During an active game, the numbered phase and elapsed runtime replace the visible `테이블`
  label inside the existing table-marker region.
- The visible hierarchy remains the approved Issue 67 treatment: a smaller numbered phase above
  a larger tabular `MM:SS` value, with no visible `경과` copy.
- The active timer is a low, compact two-line treatment. It is not a separate circular center badge.
- The table-marker element owns the active timer in the DOM; no sibling or duplicate runtime
  instance remains elsewhere in the seat map.
- Setup and ended-game center states keep their existing behavior. This issue does not redesign
  `입력 중` or `게임 종료`.
- Collision guarantees cover Player counts 5 through 15, all four generated seat presets, normal
  and compact seat styling, and manually confirmed layouts that do not place a seat inside the
  reserved central table region. Arbitrary manual placement inside that region is out of scope.
- The combined accessible name remains `<numbered phase> 경과 시간 <runtime>` and the timer does
  not become an `aria-live` region.

## Unchanged Runtime Contract

- First Night, Day, Night, and later-cycle numbering remains unchanged.
- A numbered-phase transition resets the runtime to `00:00`.
- Steps within the same numbered phase, Reveal open/close, and foreground catch-up preserve the
  same transient wall-clock measurement.
- Loading, importing, reloading, or reopening starts the active phase at `00:00`.
- Timer ticks never create events, invoke replay, or write persistence.
- No Rust, WASM, event, replay, storage, or export contract changes are permitted.

## Prototype Gate

Extend the existing Grimoire phase-runtime development prototype with the approved table-marker
placement and keep the old center placement available only as a comparison control. The table
placement is the default.

Review at minimum:

- 1366 x 1024 iPad landscape;
- 1024 x 1366 iPad portrait;
- 390 x 844 mobile with both phase-panel heights;
- 360 x 800 mobile with both phase-panel heights;
- a representative desktop viewport;
- Player counts 5, 12, and 15 across circle, oval, long-table, and horseshoe presets;
- `00:00`, a normal elapsed value, and `60:00`.

The user must approve the prototype before production files are changed.

## Test-First Production Work

1. Add the smallest black-box `ClocktowerApp` regression test asserting that an active runtime is
   inside the table marker and that the seat map contains exactly one runtime instance.
2. Run the focused test and confirm it fails because production still renders the runtime as a
   sibling center badge.
3. Move only the active runtime markup into the table marker and add a dedicated compact table
   treatment in `styles.css`.
4. Keep the existing setup/end fallback markup and all runtime state modules unchanged.
5. Run the focused placement test plus the existing phase/day runtime regressions.

## Expected Change Map

- `web/src/grimoirePhaseRuntimePrototype.tsx` and `.css`: placement comparison and review surface.
- `web/test/grimoirePhaseRuntimePrototype.test.tsx`: prototype placement contract.
- `web/test/phaseRuntimeProduction.test.tsx`: production DOM placement and duplicate regression.
- `web/src/features/grimoire/Grimoire.tsx`: table-marker ownership of the active runtime.
- `web/src/styles.css`: compact in-table runtime styling and responsive sizing.

## Completion Checks

- `pnpm --dir web test`
- `pnpm --dir web build`
- `git diff --check`
- visual checks at the approved viewports and layout boundaries
- review for collision, duplicate runtime, accessibility, runtime reset, persistence, replay, and
  unrelated setup/end-state regressions
- commit and push `codex/issue-77`
