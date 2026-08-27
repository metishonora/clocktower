# Issue #179 Bad Moon Rising survival-result prototype review notes

## Current slice

- Stage: 3B — execution established, target survives
- Status: Rejected on 2026-08-27 — separate result screen duplicates the existing vote/result flow
- Entry: removed after rejection; the NOTES retain the decision record
- Data: fixed 15-player Day fixture; no canonical Execution/Death command or Character rule result

## This review decides

- The current task separates `처형 · 성립` from `결과 · 생존` instead of treating Execution and
  Death as the same event.
- The surviving Player remains the dominant subject, with the actual Character available to the
  Storyteller.
- `생존` is visually emphasized without adding a token or claiming a specific protection source.
- The phase order keeps a single `처형` step current; it does not invent a separate public phase for
  the result-resolution fixture.
- The only next action is `다음 단계`.

## Explicitly deferred

- protection candidates, applied/prevented/bypassed source detail, and audit disclosure
- player-facing survival announcement
- Character-specific survival rules and canonical commands
- ordered multiple Death, Resurrection, Zombuul, and Mastermind states

## User decision

- Do not add a separate `처형 결과` task or follow-up screen.
- Reuse the existing vote/result UI to show the established executee and the resulting alive/dead state.
- Keep Execution and Death distinct in data and rules without turning that distinction into an extra phase.
- The rejected prototype component, styles, and development entry were removed from the retained examples.

## Rendered preflight

- PASS on 2026-08-27 with no blocker or non-blocker.
- Reviewed Day/Night at 390 × 844 and 1440 × 900, plus Day at 768 × 1024 and 1024 × 768.
- No horizontal overflow; result and primary action remain readable.
- Play panel stays centered; moon/sun and undo remain separate.
- Production build passes and excludes the development-only route.
