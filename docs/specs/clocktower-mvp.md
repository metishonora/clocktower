# Clocktower Storyteller App MVP Spec

## Problem Statement

A Blood on the Clocktower Storyteller running Trouble Brewing must track hidden roles, alive/dead state, night order, day flow, tokens, information reveals, and exceptions such as Drunk, Poisoner, Spy, Recluse, Scarlet Woman, Virgin, Saint, and Mayor while also managing real people at the table.

Paper or memory can miss steps, leak secrets, confuse execution with death, or lose the reason a state changed. Existing reference tools help with grimoire layout and guided actions, but this app needs stronger event replay, undo, phase overview, explicit tokens, voting flow, and safe player-facing reveal mode for personal iPad use.

## Solution

Build a personal-use iPad-first static PWA for Trouble Brewing. The app presents a three-pane Storyteller control surface with a circular Grimoire, current step pane, phase overview, and compact Korean event log. The app stores only Confirmed Events, derives current game state by replay, supports unlimited undo, and provides JSON export/import for backup and device migration.

A Rust domain core compiled to WebAssembly owns commands, event validation, canonical Confirmed Event creation, replay, derived state, warnings, and step generation. A React/Vite TypeScript UI owns iPad layout, draft input, browser storage, reveal mode, and PWA shell. The WebAssembly boundary is a small stateless JSON API.

The Storyteller remains in control. The app computes deterministic results and warns about relevant conditions, but it does not recommend discretionary choices or auto-end the game.

## User Stories

1. As a Storyteller, I want to create a new Trouble Brewing game, so that I can start running a session without setup friction.
2. As a Storyteller, I want to enter 5-15 player names and seating order, so that the Grimoire matches the table.
3. As a Storyteller, I want to manually assign Actual Characters, so that I can use my prepared character distribution.
4. As a Storyteller, I want to enter Shown Characters separately from Actual Characters, so that Drunk setup is represented correctly.
5. As a Storyteller, I want setup validation warnings, so that I can spot suspicious Trouble Brewing setup without being blocked.
6. As a Storyteller, I want a circular Grimoire seat map, so that I can scan the table in the same shape as play.
7. As a Storyteller, I want each Player to show name, seat, alive/dead state, character info, ghost vote state, and important tokens, so that current state is obvious.
8. As a Storyteller, I want to tap a Player for selection, so that current step choices are fast.
9. As a Storyteller, I want a token and note panel for a Player, so that manual corrections and reminders are quick.
10. As a Storyteller, I want system tokens separated from script reminder tokens, so that rule-affecting state is not confused with notes.
11. As a Storyteller, I want free text Notes to have no rules impact, so that notes cannot accidentally change game logic.
12. As a Storyteller, I want a current step pane, so that I always know what action is next.
13. As a Storyteller, I want the current step to show required input and valid skip state, so that I do not miss required choices.
14. As a Storyteller, I want a full phase overview, so that I can see what remains tonight or today.
15. As a Storyteller, I want overview items to show waiting, current, complete, skipped, and needs follow-up states, so that dynamic consequences are visible.
16. As a Storyteller, I want phase transitions to be Confirmed Events, so that night/day state changes are undoable and replayable.
17. As a Storyteller, I want confirmed actions to update game state automatically, so that I do not duplicate bookkeeping.
18. As a Storyteller, I want every meaningful state change stored as a Confirmed Event, so that replay is the source of truth.
19. As a Storyteller, I want undo to remove the latest Confirmed Event and replay, so that mistakes can be safely corrected.
20. As a Storyteller, I want undo protected from accidental taps, so that live-play mistakes are less likely.
21. As a Storyteller, I want manual corrections to be Confirmed Events, so that corrections remain visible and undoable.
22. As a Storyteller, I want a compact Korean event log, so that I can answer what just happened and why.
23. As a Storyteller, I want autosave after confirmed actions, so that the game survives accidental refresh or app close.
24. As a Storyteller, I want the latest stored game to load from iPad browser storage, so that I can continue a session.
25. As a Storyteller, I want JSON export, so that I can back up or move a game.
26. As a Storyteller, I want JSON import, so that I can continue from an exported replay log.
27. As a Storyteller, I want new game/import replacement confirmation when events exist, so that I do not erase a session by accident.
28. As a Storyteller, I want the app to work as an iPad Safari-installed PWA, so that play does not require localhost.
29. As a Storyteller, I want the app to work offline after install, so that table play is not dependent on network quality.
30. As a Storyteller, I want deterministic true results computed for abilities such as Chef and Empath, so that arithmetic mistakes are avoided.
31. As a Storyteller, I want drunk or poisoned Players to still wake when appropriate, so that I can choose the displayed false information.
32. As a Storyteller, I want true results and displayed results separated, so that I can preserve Storyteller discretion.
33. As a Storyteller, I want Spy and Recluse Registration Judgments handled per rule check, so that registration is not accidentally global.
34. As a Storyteller, I want Fortune Teller choices to compute Demon, red herring, Spy, and Recluse-sensitive results, so that the result is reliable.
35. As a Storyteller, I want Undertaker information based on the previous day's executed-dead Player, so that the reveal follows Trouble Brewing.
36. As a Storyteller, I want Monk protection to apply only when valid, so that Imp deaths are resolved correctly.
37. As a Storyteller, I want Ravenkeeper night death to create a follow-up reveal step, so that triggered abilities are not missed.
38. As a Storyteller, I want Virgin nomination to trigger only on the first valid Townsfolk nomination, so that immediate execution is correct.
39. As a Storyteller, I want Slayer shot spent even when drunk or poisoned, so that once-per-game ability state is correct.
40. As a Storyteller, I want Soldier protection against Demon attack when sober and healthy, so that deaths are resolved correctly.
41. As a Storyteller, I want Mayor win and Mayor bounce situations surfaced as Storyteller decisions, so that the app does not overrule discretion.
42. As a Storyteller, I want Butler master and vote warnings, so that voting helper state is visible.
43. As a Storyteller, I want Poisoner poison to expire correctly, so that ongoing effects do not persist too long.
44. As a Storyteller, I want Scarlet Woman transfer follow-up when the Imp dies with enough players alive, so that Demon continuity is not missed.
45. As a Storyteller, I want Baron setup effects considered during validation, so that Outsider count warnings are useful.
46. As a Storyteller, I want Imp self-kill to trigger Scarlet Woman transfer when valid, so that unusual Demon choices are supported.
47. As a Storyteller, I want night deaths to affect rules state immediately, so that follow-up abilities see the correct state.
48. As a Storyteller, I want public Announcement separated from Death, so that the app can track hidden night deaths before day announcement.
49. As a Storyteller, I want Execution separated from Death, so that non-execution deaths and execution-caused deaths are not confused.
50. As a Storyteller, I want nominations recorded by nominator and nominee, so that day state is auditable.
51. As a Storyteller, I want voting to happen on the seat map, so that live hand counts are fast.
52. As a Storyteller, I want live vote count and ghost vote spending shown before confirm, so that vote mistakes are visible.
53. As a Storyteller, I want confirmed votes to update the current execution candidate, so that final execution remains separate.
54. As a Storyteller, I want final execution to require explicit confirmation, so that the app does not kill a Player from vote count alone.
55. As a Storyteller, I want good/evil win condition warnings, so that possible game end states are surfaced.
56. As a Storyteller, I want game end to be a Confirmed Event, so that ending remains under Storyteller control and undoable.
57. As a Player being shown information, I want the Reveal screen to show only my current information, so that secrets are not leaked.
58. As a Storyteller, I want preview and Reveal states separated, so that I can verify information before showing the iPad.
59. As a Storyteller, I want a clear return path from Reveal, so that I can safely resume the Grimoire.
60. As a developer, I want Rust domain logic independent from WebAssembly glue, so that rules can be tested without a browser.
61. As a developer, I want TypeScript screens to send Commands rather than create Confirmed Events, so that event shape remains canonical.
62. As a developer, I want the WebAssembly API to return CoreResult JSON, so that expected failures are handled without crashing the UI.
63. As a developer, I want generated steps derived from replay, so that undo/load/import restore the same phase state.
64. As a developer, I want no saved step lists, so that dynamic follow-ups and future ordering changes do not corrupt state.
65. As a developer, I want latest-only storage for MVP, so that persistence stays small and understandable.

## Implementation Decisions

- The MVP supports Trouble Brewing only, all 22 Trouble Brewing characters, 5-15 Players, no Travellers, no Fabled, no custom scripts, and no random assignment.
- The default delivery target is a static HTTPS PWA installed from iPad Safari.
- The frontend uses React with Vite and plain or scoped CSS. Do not add a UI component library for MVP.
- The repository implementation shape is a pure Rust domain crate, a thin Rust WebAssembly adapter crate, and a React/Vite web app.
- The Rust domain core owns Commands, event validation, canonical Confirmed Event creation, replay, derived state, warnings, and semantic step generation.
- TypeScript owns UI, Draft Input, Reveal mode presentation, browser storage, export/import, and the PWA shell.
- The WebAssembly API is stateless and JSON-based for MVP.
- The core API exposes replay of the current game file and proposal of a Command against the current game file.
- Expected core failures return a JSON result object with a stable error code and Korean message; panics or thrown exceptions are reserved for bugs and unrecoverable adapter failures.
- Confirmed Events are the only persisted source of truth.
- TypeScript must not append a Confirmed Event that did not come from a Rust Proposal.
- A Proposal contains the canonical event when confirmation is valid, plus warnings, computed preview information, and follow-up step hints when relevant.
- Manual corrections use the same Command, Proposal, Confirmed Event flow.
- Current state, current step, phase overview, warnings, and relevant derived information come from replay.
- Generated step lists are not persisted.
- Rust returns semantic step data; TypeScript maps semantic step data to UI labels and instructions.
- Rust may return short Korean messages for event summaries, compact warnings, and compact proposal messages.
- Layout-specific long copy should stay in TypeScript.
- Reveal screens render only from RevealPayload and close/return callbacks.
- The Reveal screen must not receive the full Grimoire, event log, or derived rules state.
- Browser storage is TypeScript-only.
- IndexedDB stores one latest GameFile under a single key. No saved game list for MVP.
- Starting a new game or importing a game replaces the latest stored game only after confirmation when existing events are present.
- JSON export/import uses the same GameFile shape with one schema version at the file root.
- Import performs basic JSON shape and schema version checks, then calls replay to verify the event log before replacing storage.
- Do not store rules-state snapshots for MVP. Add snapshots only if replay is slow on real iPad hardware.
- Do not add a routing library for MVP. Use app screen state for setup, play, reveal, import, and export surfaces.
- Do not add a Web Worker for the Rust core unless replay/propose blocks the UI on real iPad hardware.
- Do not add a native wrapper such as Capacitor unless PWA storage or lifecycle behavior becomes a real problem.

## Testing Decisions

- The primary test seam is the Rust domain core.
- Good Rust domain tests exercise external behavior: given a game file and Command, the core returns the expected Proposal; given a game file, replay returns the expected derived state, current step, phase overview, and warnings.
- Rust domain tests should avoid WebAssembly and browser dependencies.
- High-risk Trouble Brewing behavior should receive scenario tests, especially drunk/poisoned information, Spy/Recluse Registration Judgments, Execution versus Death, Scarlet Woman transfer, Virgin trigger, vote and ghost vote spending, and win condition warnings.
- The WebAssembly adapter should have contract tests for JSON success and expected error shapes, but the full rules matrix belongs in the domain core tests.
- TypeScript store tests should verify load, propose, confirm, autosave, undo, import, export, and replacement confirmation behavior with a mocked wasm client.
- Reveal tests should verify that RevealScreen renders only from RevealPayload and does not require full Grimoire state.
- UI tests should focus on user-visible behavior at the highest practical seam: setup flow, current step confirmation, event log update, voting flow, and reveal/return flow.
- Full browser end-to-end tests should be smoke tests rather than the main rules test suite.

## Out of Scope

- Accounts, servers, sync, multiplayer, or public player accounts.
- User-facing localhost runtime.
- Random character distribution.
- Custom scripts, house rules, generic rules DSL, Travellers, or Fabled.
- Multi-game saved game list.
- Redo stack.
- Full replay UI.
- Native wrapper.
- Web Worker.
- Rules-state snapshots.
- UI component library.
- Router library.
- External PR triage as a request surface.

## Further Notes

- Canonical project and code terms are English. User-facing UI messages are Korean.
- The app is a live Storyteller aid, not a full rules authority. Strong guide, soft authority: warn and confirm rather than hard-block unless the choice is invalid by rule.
- The Storyteller stays in control of discretionary choices, displayed false information, Mayor decisions, and final game end.
- The app should feel like a practical live-control surface: fast, readable at arm's length, high contrast, and difficult to accidentally misuse.
- If a future implementation finds the stateless JSON WebAssembly API too slow on real iPad hardware, the next measured optimization is a stateful Rust session API.
