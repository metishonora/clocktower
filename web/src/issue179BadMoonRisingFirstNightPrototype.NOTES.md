# Issue #179 Bad Moon Rising first-night prototype review notes

## Current slice

- Stage: 3A — first-night current task and official order
- Status: Approved after revisions on 2026-08-27
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-first-night`
- Data: fixed 15-player fixture; no BMR Production session, persistence, Character automation, or
  canonical commands

## This review decides

- The Play surface keeps the established current-task / phase-order hierarchy with the BMR blood-moon
  palette.
- The phase header shows `첫날 밤` and elapsed time, with the established route back to the Grimoire.
- A BMR Character step that is not implemented offers only the real resolution actions
  `처리 완료 / 해당 없음`; prototype-only status badges are not added.
- The current-task card follows the established Sects & Violets order: `현재 할 일`, Character
  identity, ability, then actions. It does not add a duplicate `N / total` progress badge, and its
  actions follow the content instead of being pinned to an artificially tall card.
- The phase order follows the page flow without a nested scroll region, matching the established
  Sects & Violets layout.
- The current Character identity is display-only. It does not invent a Character hint or detail action
  that the existing S&V progress screen does not provide.
- The order list uses the roster-filtered first-night sequence already defined by the BMR Domain.
- Fixture interactions advance manual steps only to review repeated layout; they do not simulate
  Character inputs, targets, results, or reminders.

## Explicitly deferred

- Product Grimoire handoff and target-selection state
- Character-specific inputs, validation, automation, and official icons
- player-facing Reveal and evil-information payloads
- later-night Death/Resurrection, Day, and Mastermind extra-Day states

## Preflight evidence

- Revised Day/Night rendered preflight passed at 390 × 844, 768 × 1024, 1024 × 768,
  and 1440 × 900 before the final acceptance pass was deferred.
- A focused follow-up preflight passed the compact SnV current-task hierarchy at 390 × 844,
  768 × 1024, and 1024 × 768 in both themes; the former blank region, duplicate progress badge,
  text clipping, and action clipping are absent.
- A focused desktop-site header preflight passed at 1112 × 834, 1280 × 960, and 1440 × 900 in
  both themes. The moon/sun and undo remain visibly separate, with 149–164 px measured horizontal
  spacing across those desktop widths.
- On wide desktop-site viewports, the Play panel keeps its intended gutter width but uses equal
  auto margins after `max-width` is reached, so it remains centered instead of leaving the extra
  width only on the right. Mobile and pad insets remain unchanged.
- Every viewport keeps the document width equal to the viewport width; the current-task and order
  surfaces remain inside the horizontal boundary.
- The phase order has no nested scrollbar; it stays beside the task on wide screens and follows it
  in the document flow on narrow screens.
- The current Character identity has no click behavior or secondary detail surface.
- At 1024 × 768, the compact landscape treatment keeps both resolution actions fully visible above the
  viewport boundary while preserving the side-by-side order list.
- `처리 완료` advances to the next manual Character; `해당 없음` advances and retains that outcome in
  the order list.
- The web production build succeeds and excludes the development-only entry.
