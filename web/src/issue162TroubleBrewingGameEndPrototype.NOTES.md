# Issue 162 Trouble Brewing Game End Prototype

Open the development-only route:

`/?prototype=issue-162-tb-game-end`

The review controls are outside the production-like application frame. Combine the canonical cause,
presentation state, and TB day/night theme to inspect every approved string and state.

## Decisions represented

- Canonical pending game-end immediately presents a non-dismissible, modal winner dialog.
- Demon absence, two living players, Saint execution, and Mayor no-execution use complete Korean
  reasons rather than warning-code copy.
- When Demon absence and two living players become true from the same event, good wins and Demon
  absence is the canonical cause.
- The dialog shows only the winner and complete reason before its single confirmation action. It
  omits the redundant eyebrow, canonical-cause badge, and simultaneous-condition notice in every
  fixture. Busy disables its only action. A failed
  confirmation uses the established production failure dialog and returns to the pending dialog.
- Confirmed game end keeps the real TB Grimoire visible but read-only and shows a persistent winner
  and complete-reason dock without a cause badge.
- The end dock has no dedicated Undo. The existing header Undo shows the causal event and END_GAME
  as one canonical unit, then returns to live play.
- No manual game-end entry point is present following the decision to remove it in #153.

## Canonical copy fixtures

- Demon absence / good: `살아 있는 악마가 없습니다.`
- Two or fewer living players / evil: `생존자가 2명 이하로 남았습니다.`
- Saint execution death / evil: `성자가 처형되어 사망했습니다.`
- Mayor no-execution / good: `시장을 포함해 정확히 3명이 살아 있고, 오늘 아무도 처형되지 않았습니다.`
- Demon absence and two-living simultaneous case / good: Demon absence remains the canonical cause,
  but the dialog displays no additional simultaneous-condition notice.

## Review coverage

The controls expose pending, busy, confirmation failure, confirmed end, and post-Undo live states
for both TB themes. Visual checks cover 360px and 390px mobile widths, iPad, and desktop. The mobile
fixtures keep the blocking dialog and persistent end dock inside the safe-area-aware production
frame without horizontal overflow.

Autosave, import, and reload restoration intentionally have no distinct visual fixture: restored
canonical pending and ended states use the same presentation shown here.
