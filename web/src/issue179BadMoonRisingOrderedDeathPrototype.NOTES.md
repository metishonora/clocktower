# Issue #179 Bad Moon Rising ordered attack prototype review notes

## Current slice

- Stage: 3C — one ability, two ordered outcomes
- Status: Approved on 2026-08-27
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-ordered-death`
- Data: fixed 15-player Night fixture; canonical `orderedDeathResolved` presentation only

## This review decides

- The existing SnV Grimoire `completedSelection` surface shows two results as ordered rows immediately after target confirmation.
- Each row leads with order, Player, and actual `사망` / `생존` outcome.
- The two selected seats remain visible with their settled alive/dead states.
- The Character name remains context, while the ordered results are the primary content of the selection panel.
- The only next action is the existing Grimoire `다음 →` action.
- Result rows keep the existing borderless SnV row style; outcome color does not add a left accent line.

## User correction

- Rejected: returning to the Progress tab to show a separate result card.
- Review flow: `진행 → 마도서 대상 선택 → 같은 마도서에서 결과 확인`.

## Explicitly deferred

- outcome source and protection-candidate detail
- Shabaloth or Professor resurrection presentation
- dawn/public night-results announcement
- detailed Grimoire Character-token presentation
- target selection and command production behavior

## Final acceptance evidence

- Defer cross-viewport Day/Night render checks to the final production acceptance pass.
- Verify that the production flow remains in the Grimoire from target confirmation through result review.
