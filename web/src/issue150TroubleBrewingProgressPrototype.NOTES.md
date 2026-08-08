# Issue #150 Trouble Brewing Progress Fixture Decisions

This is a fixture-only review surface for the Trouble Brewing progress-tab redesign. It uses the
production shared shell and Play presentation, but it does not connect a second runtime, session,
store, persistence path, or canonical event flow.

## Review baseline

- Keep the final Issue #148 S&V hierarchy: phase and runtime, dominant current task, then the plain
  expanded `snvPhaseOverview` list. Desktop and iPad place the list beside the task; mobile stacks
  the same complete list below it. There is no drawer, overlay, toggle, or `current N/M` header.
- Keep target, nomination, and vote input in the Grimoire handoff owned by Issue #149. Like S&V,
  the progress screen shows only the current actor/context and one action that enters the Grimoire.
- Reuse S&V's production presentation contracts instead of fixture-only variants: information task
  classes, full-screen Reveal, nomination summary, execution card, Undo dialog, failure dialog, and
  shared `GameEndControls`.
- Preserve those S&V shapes while applying the Trouble Brewing forest, parchment, gold, and rust
  palette to the progress surface, tasks, phase list, dialogs, feedback, and Reveal screens.
- Keep storage and event log outside the progress fixture.

## Fixture set

1. Night target selection: S&V action card and a single Grimoire handoff.
2. Information and Reveal: S&V information task plus four TB content families in the production
   full-screen shape: setup role + two candidates, nightly boolean result, demon teammates + bluffs,
   and the actual #149 Spy Grimoire reveal.
3. Day nomination and execution: S&V highest-vote summary and execution decision card.
4. Consequence and Undo: immediate Virgin execution represented by the S&V execution/Undo patterns.
5. Error recovery: production failure dialog over an unchanged Fortune Teller information task.
6. Game end: shared warning, confirmation, completed state, and Undo entry.

## Explicitly not approved by this prototype

- Any change to canonical Command/Event, scheduling, rule outcomes, replay, Undo semantics, or saves.
- Inline Player button grids or a second target-selection implementation in the progress tab.
- A mobile phase drawer or compact progress counter.
- New Trouble Brewing automation or behavior for Travellers, Fabled, or custom scripts.
- Changes to which players, characters, values, or Grimoire state canonical rules place in a Reveal.
