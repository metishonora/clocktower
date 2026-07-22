# Issue #97 Final UI Prototype Archive

## Archive identity

- Status: user-approved final prototype
- Approved on: 2026-07-22
- Canonical Git tag: `issue-97-final-prototype-v1`
- Last UI-changing commit: `f4b910b` (`add new game reset and brighten day grimoire`)
- Development entry point: `/clocktower/trouble-brewing/?prototype=snv-foundation`

The Git tag is the immutable recovery point. The development entry point remains useful for visual
comparison, but later production work may change the working-tree implementation. If the approved
prototype itself must evolve, preserve this tag and create a new versioned tag instead of moving it.

## Archived source map

- `web/src/sectsAndVioletsFoundationPrototype.tsx` — complete approved interaction specimen
- `web/src/sectsAndVioletsFoundationPrototype.css` — responsive layout and Day/Night themes
- `web/test/sectsAndVioletsFoundationPrototype.test.tsx` — behavioral and layout contracts
- `web/src/main.tsx` — development-only query-string entry point
- `web/public/assets/characters/snv/` — character artwork used by the specimen
- `docs/plans/issue-97-sects-and-violets-foundation.md` — decisions and production plan

Retrieve an archived file without switching branches with, for example:

```sh
git show issue-97-final-prototype-v1:web/src/sectsAndVioletsFoundationPrototype.tsx
```

## Approved UI baseline

The archived prototype is the comparison baseline for a possible production UI replacement:

- `직업 / 마도서 / 진행` are separate stages; utility actions sit above them.
- Demon choice shows its effective Player-distribution adjustment directly.
- Confirmed role composition is locked against accidental data loss while role details remain readable.
- Role selection uses a stable catalog and fixed summary area without button or panel movement.
- Grimoire assignment supports seat-first interaction, Player names, randomization, reset, and explicit confirmation.
- The 7–15 Player rectangular seat layout derives the Grimoire size from non-overlapping seats.
- The same Grimoire remains available during play; the current actor is highlighted there.
- The current task is dominant, while phase order is secondary and right-aligned on wide screens.
- Mobile assignment uses an outside-click-dismissed sheet and avoids unnecessary explanatory copy.
- Day/Night changes apply gradually to the whole site; the Day Grimoire and dialogs are fully light.
- Returning to assignment and starting a new game require destructive confirmation.
- Character details, Reveal, and Player details preserve readable focus and layering.

## Production replacement rule

Do not remove this archive merely because a production implementation exists. Compare the production
screen against the archived prototype at 7, 9, and 15 Players on 360 px, 390 px, iPad portrait and
landscape, and desktop. A replacement is acceptable only when it preserves or improves:

1. setup arithmetic clarity and role-selection efficiency;
2. non-overlapping Grimoire layout and seat readability;
3. stage navigation and accidental-data-loss protection;
4. current-task and current-actor visibility;
5. Day/Night contrast, animation, and modal readability;
6. keyboard, focus, screen-reader, reduced-motion, and safe-area behavior.

If production performs worse in any of these areas, use the tagged prototype as the source of truth
for the replacement rather than retaining the older production shell.

## Deliberately deferred functionality

The archive preserves UI decisions, not false functionality. These follow-ups remain separate:

- #113 — apply the approved shell to Trouble Brewing
- #114 — reusable rich character-detail panel
- #115 — persistence, JSON import/export, recovery, and new-game lifecycle
- #116 — canonical Day and recurring later-Night operation
- #117 — shared Player-status presentation and editing
- #118 — phase timer and persistence boundary
