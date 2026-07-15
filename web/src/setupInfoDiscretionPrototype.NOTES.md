# Issue #45 Drunk Setup Information Prototype Notes

Question: Can a Drunk setup-information actor use the same single delivered-information input as
a poisoned actor without leaking the Drunk state into Reveal?

Run: `pnpm prototype:setup-info-discretion`, then open
`http://localhost:5173/?prototype=setup-info-discretion`.

This prototype uses the accepted issue #25 map-first layout with a right-side action panel. It does
not call the core, persist an event, or alter a game file.

The revised prototype follows the user's mobile reference for information presentation: show only
the acting Player, relevant relationship, and direct result buttons. The two-column workspace keeps
the Grimoire and action panel independently sized. Setup/load and event-log panels are collapsed by
default and expand only on request.

## Scenarios

- **Chef + Recluse registration:** visually connects the adjacent Imp and Recluse, marks `0` as the
  truth and `1` as the alternate direct result, without additional explanatory cards.
- **Fixed Washerwoman:** one constrained information editor. Delivered information is fixed and no
  duplicate delivered editor is shown.
- **Poisoned Librarian:** one editor accepts any distinct pair and any Outsider, or
  zero Outsiders. No separate actual result is requested or recorded.
- **Drunk Investigator:** one editor accepts any distinct pair and any Minion, matching the
  poisoned Librarian interaction instead of asking for a separate baseline.
- **Registration Investigator:** one editor is used. Including Recluse in the pair automatically
  expands the Character list to all Minions; there is no separate registration editor.

## Revised interaction decision

- Use one delivered-information editor for both Drunk and poisoned setup-information actors.
- Allow the Drunk delivery to use any distinct roster pair and any ability-shaped Character. A
  Drunk Librarian delivery may also use zero Outsiders.
- Keep actual Character, shown Character, and Character-kind color context visible in the
  Storyteller-facing editor.
- Present exceptional values such as poisoned Librarian `0 Outsiders` as a direct choice button,
  not a checkbox hidden among form controls.
- For numeric registration, visualize relevant neighboring Players and distinguish the base truth
  from registration-adjusted legal results.
- Express setup registration by expanding legal choices in the single delivery editor.
- Label the final section `전달 정보 · 플레이어 화면` and derive Reveal only from it.
- Disable confirmation until the single delivered draft is valid.
- Construct the confirmation preview and safe Reveal output from the delivered value only.

## User decision

Approved on 2026-07-15:

- Match the poisoned single-editor flow for Drunk setup information.
- Keep the existing Storyteller-only Actual/Shown Character context.
- Do not collect or persist a separate sober baseline for a Drunk setup-information delivery.
