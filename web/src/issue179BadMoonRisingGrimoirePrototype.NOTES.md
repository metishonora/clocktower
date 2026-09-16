# Issue #179 Bad Moon Rising Grimoire prototype review notes

## Current slice

- Stage: 2A — Grimoire basic assignment
- Status: Approved on 2026-08-26
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-grimoire`
- Production-like frame: approved BMR header/theme, utility chrome, active `마도서` stage
- Review controls: 7/15 Players and Day/Night, outside the Production-like frame
- Data: fixture-only; no BMR Production session, persistence, route, or Character automation

## This review decides

- 7-Player and 15-Player seat density and readability
- role-first and seat-first assignment affordances
- Player name editing in the selected-seat inspector
- placement and visual priority of randomize, reset, remaining-seat count, and assignment Confirm
- mobile selected-seat sheet and 15-role scroll behavior

## Accepted Stage 2A decisions

- Keep the existing rectangular perimeter and support both role-first and seat-first assignment.
- Use the selected-seat inspector for Player name editing; on mobile, open it as the bounded bottom
  sheet with a scrollable role list.
- Show 7-Player and 15-Player fixtures without seat overlap or horizontal overflow.
- Keep the remaining-seat/Confirm action in normal layout flow at tablet and desktop widths so it
  never covers a perimeter seat; retain the reachable fixed action on small mobile.
- At tablet widths, keep the flat celestial disc and glow separated from Undo.
- Use the raised burgundy board value at Night and a flat, shadow-free board surface at Day.

## Explicitly deferred

- confirmed read-only Player details and destructive return-to-assignment dialog
- Lunatic Actual/Shown identity treatment
- Zombuul apparent-dead/actual-alive state
- live Play, ordered Death/Resurrection, private Reveal, and Mastermind extra Day

## Revision requested on 2026-08-24

- Separate the celestial disc and Undo button throughout the tablet range.
- Raise the Night board surface value so seat cards and names have clearer contrast.
- Remove the Day board's radial shading and inset shadow; keep it as a flat light surface.

## Preflight evidence

- 1440px desktop: 7/15 seats remain inside the board with no horizontal overflow.
- 768 × 1024 and 390 × 844: 15 seats have no pairwise overlap or board overflow.
- At 600px and above, the Confirm area participates in layout below the board instead of covering a
  perimeter seat; small mobile keeps the reachable fixed action.
- Mobile selected-seat sheet exposes the name field and all roles in a bounded scroll area.
- Role-first and seat-first assignment both enable Confirm after all seats are filled.
- Production build succeeds and excludes the development-only prototype entry.
