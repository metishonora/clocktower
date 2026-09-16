# Issue #179 Bad Moon Rising confirmed Grimoire prototype review notes

## Current slice

- Stage: 2B — confirmed read-only Grimoire and return-to-assignment confirmation
- Status: Approved on 2026-08-26
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-grimoire-confirmed`
- Data: fixture-only; no BMR Production session, persistence, route, or Character automation

## This review decides

- Which assignment controls disappear after confirmation
- Read-only Player detail hierarchy opened from a seat, using the established S&V slide-over / mobile
  bottom-sheet dialog pattern
- Placement and destructive treatment of `배치로 돌아가기`
- Confirmation copy, cancel behavior, and transition back to the approved assignment surface

## Revision decisions

- Rejected: keeping Player details in an always-present Grimoire inspector. It differed from the existing
  S&V confirmed-game interaction.
- Approved: use the S&V dialog structure and information order while applying the BMR blood-moon
  palette.
- Day alignment badges use explicit high-contrast foreground, fill, and border colors for both `선` and
  `악` instead of relying on the low-opacity shared treatment.
- Rejected: a generic `현재 상태 · 생존` row. The established detail surface reserves this area for
  attached Character/status tokens.
- Current placeholder keeps the token-area footprint without inventing BMR Character state. Poisoning,
  drunkenness, usage, and other implemented states will use the existing circular token presentation.

## Explicitly deferred

- Character-specific identity, reminder-token content, Death/Resurrection rules, Reveal payloads, and
  extra-Day behavior

## Preflight evidence

- 1440px desktop: selected-seat details use the established right-side S&V slide-over without clipping.
- 390 × 844 and 768 × 1024: selected-seat details use the established bounded bottom sheet without
  horizontal overflow; 1024 × 768 uses the right-side slide-over.
- The return dialog initially focuses Cancel, closes with Escape or backdrop, and restores focus to
  `배치로 돌아가기`.
- Confirming return opens the approved Stage 2A assignment surface with all Player names and the
  complete role assignment retained.
- Rendered prototype preflight passed; the web production build succeeds and excludes this DEV-only
  entry.
