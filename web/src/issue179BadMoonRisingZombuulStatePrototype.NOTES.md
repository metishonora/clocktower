# Issue #179 Bad Moon Rising Zombuul state prototype review notes

## Current slice

- Stage: 2D — Zombuul first-death apparent / actual life state
- Status: Reminder-token shell concept approved on 2026-08-26; exact token behavior deferred
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-zombuul-state`
- Data: fixed 15-player fixture; no BMR Production session, persistence, or Character automation

## This review decides

- The Zombuul seat keeps the muted public-death surface without the normal funeral/shroud marker.
- The seat token-count badge and Player detail use the official Zombuul `사망` reminder-token pattern.
- The reminder token's accessible description records that the Player is publicly dead but actually alive.
- The separate `공개 상태 / 실제 상태` cards are removed because they repeat the reminder token's rule meaning.
- Other Characters keep the approved Character-token placeholder unchanged.

## Explicitly deferred

- Zombuul's second death and transition to actual death
- nominations, voting interaction, and spending the ghost vote
- private Reveal, live Play, and Character automation

## Reviewed shell example

- Seat 15 is grayscale and has a `+1` attached-token badge while still showing `좀버얼` to the
  Storyteller; it does not use the normal funeral/shroud marker.
- Detail shows one circular `좀버얼 · 사망` reminder token in the established S&V token area.
- The Character ability copy and token tooltip/accessibility label provide the apparent-death meaning
  without an additional persistent status panel.

The exact official reminder-token content, actual-death transition, nomination behavior, and ghost-vote
rules are not part of Issue #179. They are decided with the Zombuul Character implementation.

## Preflight evidence

- Day/Night rendered preflight passed at 390 × 844, 768 × 1024, 1024 × 768, and 1440 × 900.
- The rendered DOM contains no funeral/shroud icon or separate public/actual status cards, and contains
  one attached-token count badge plus one `좀버얼 · 사망` token.
- At 390px, the document and body remain 390px wide; the bottom sheet and reminder token stay within
  the viewport without clipping.
- The web production build succeeds and continues to exclude the development-only prototype entry.
