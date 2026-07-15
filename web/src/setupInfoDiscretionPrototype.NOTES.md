# Setup Information Discretion Prototype Notes

Question: Can the Storyteller choose only the player-facing information for drunk, poisoned, and
registration-sensitive setup information, without recording a separate actual result?

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
- **Drunk Investigator:** one editor accepts any distinct pair and any Minion. The core derives the
  delivery context without requiring or recording a baseline result.
- **Registration Investigator:** one editor is used. Including Recluse in the pair automatically
  expands the Character list to all Minions; there is no separate registration editor.

## Proposed production behavior

- Never require the Storyteller to select an actual-information baseline for an impaired setup
  actor. Record the delivered result and the drunk/poisoned reason without inventing a canonical
  true pair when several legal true pairs may exist.
- Keep actual Character, shown Character, and Character-kind color context visible in the single
  Storyteller editor.
- Present exceptional values such as poisoned Librarian `0 Outsiders` as a direct choice button,
  not a checkbox hidden among form controls.
- For numeric registration, visualize relevant neighboring Players and distinguish the base truth
  from registration-adjusted legal results.
- Express setup registration by expanding legal choices in the single delivery editor.
- Label the final section `전달 정보 · 플레이어 화면` and derive Reveal only from it.
- Disable confirmation until the single delivered draft is valid.

## User checkpoint

Confirm or revise:

1. whether the minimal Chef display should become the shared numeric-information pattern;
2. whether the single delivered-information editor is sufficient for poisoned/Drunk setup actors;
3. whether automatic Character-list expansion makes registration understandable;
4. whether the collapsed setup/load and event-log affordances are clear enough.
