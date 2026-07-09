# Clocktower Storyteller App Design Brief

## Product Shape

Personal iPad-first local app for a Blood on the Clocktower Storyteller running Trouble Brewing.

Default delivery is an iPad Safari-installed PWA. The user should not need to run a localhost server during play. The app should load like a normal Home Screen app after installation.

The UI should feel like a practical live-control surface, not a marketing site, encyclopedia, or decorative companion app. The Storyteller will use it while managing real people at a table, so speed, scanability, and mistake prevention matter more than visual flourish.

## Primary Device

- iPad first.
- Landscape is the primary layout.
- Portrait/mobile should remain usable through tabs or stacked views.
- Large tap targets.
- High contrast.
- Readable at arm's length.
- Avoid dense tiny controls during live play.

## Main Landscape Layout

Use a 3-pane layout:

1. Left: Grimoire seat map
2. Center: Current step/action
3. Right: Phase overview and event log

The user should always be able to answer:

- Who is alive?
- What state tokens are active?
- What step am I on?
- What steps are still coming?
- What did I just confirm?

## Grimoire Seat Map

The seat map is the anchor of the app.

Requirements:

- Circular seating arrangement.
- Show seat number, player name, shown/actual character as appropriate for Storyteller view.
- Show alive/dead clearly.
- Show ghost vote status.
- Show important tokens without clutter.
- Tap a player for selection.
- Long-press or secondary action opens token/note panel.
- During voting, seat taps toggle votes.

Avoid:

- Drag-heavy interactions for MVP.
- Tiny token piles that require precision.
- Hiding core state behind modals.

## Current Step Pane

The center pane should focus on the current Storyteller action.

It should show:

- Phase and step title.
- Acting character/player.
- Clear instruction.
- Required selections.
- Computed true result when deterministic.
- Drunk/poisoned/registration warnings.
- Displayed result controls when the Storyteller must choose what to reveal.
- Confirm button.
- Skip button only when valid.

The app should not recommend discretionary Storyteller choices.

## Overview Pane

Existing reference UI lacks a good full overview. This app should improve that.

Show the full current phase sequence with status:

- waiting
- current
- complete
- skipped
- needs follow-up

The Storyteller should be able to jump to a step, but the default flow should continue forward.

The overview should make it easy to see what remains tonight/today.

## Event Log

Show confirmed events as short human-readable Korean summaries.

The log should help answer:

- What did I just do?
- Why is this player dead/poisoned/protected?
- What did I undo?

Keep it compact. The log is a support surface, not the main interaction.

## Voting UI

Voting should happen on the seat map.

Flow:

1. Choose nominator and nominee.
2. Start vote.
3. Tap seats as hands are raised.
4. Show live vote count.
5. Show ghost votes that will be spent.
6. Confirm vote.
7. Update current execution candidate.
8. Final execution still requires Storyteller confirm.

## Token And Notes UI

Support:

- common rule tokens
- Trouble Brewing character-specific reminder tokens
- free text note per player

Token editing should be fast:

- player long-press opens token/note panel
- current step exposes only relevant token actions
- no full token designer in MVP

## Reveal Screen

Reveal is the only player-facing screen.

Requirements:

- Full-screen.
- Shows only the current information.
- Hides grimoire, state, log, and controls that reveal secrets.
- Large centered text.
- Optional character/player badges when relevant.
- Clear close/return path for Storyteller.
- Preview and reveal must be separate.

Use reveal for cases like:

- Demon/minion info.
- Fortune Teller yes/no.
- Empath number.
- Undertaker character.
- Ravenkeeper result.
- Storyteller-selected setup information.

## Save, Load, Undo

UI requirements:

- Autosave confirmed events silently.
- Show last saved/recovered state simply.
- Load latest game from iPad browser storage.
- Use IndexedDB-backed storage for game event logs.
- Provide JSON export/import for backup and device migration.
- Undo last confirmed event.
- Undo should be visible but protected from accidental taps, such as confirm dialog or press-and-hold.
- No redo for MVP.

The UI should not expose implementation details like WebAssembly, Rust, or IndexedDB during normal play. Those are implementation choices, not Storyteller-facing concepts.

## Visual Direction

Dark theme is acceptable and likely appropriate, but practical readability wins.

Use:

- restrained color palette
- clear phase colors
- strong alive/dead contrast
- accessible contrast
- consistent iconography
- compact but not cramped panels

Avoid:

- marketing hero sections
- decorative card-heavy layout
- excessive animation
- tiny text
- hidden critical controls
- one-note purple-only palette

## Reference Screens

The reference site already does these things well:

- circular grimoire layout
- guided night action
- player-facing reveal screen

This app should improve:

- full phase overview
- confirmed event log
- undo/load/replay reliability
- explicit state tokens
- voting flow
- deterministic true result vs Storyteller-displayed result
- follow-up steps for triggered effects

## Design Priorities

1. Prevent missed steps.
2. Prevent secret leakage.
3. Make current state obvious.
4. Make confirm/undo safe.
5. Keep live-play interactions fast.
6. Keep Storyteller discretion easy.
