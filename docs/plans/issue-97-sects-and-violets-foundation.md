# Issue 97: Sects & Violets Foundation

## Status

Issue analysis and the product decisions below were approved on 2026-07-21. The initial setup and
manual-live-play prototype was approved on 2026-07-21 as the production visual direction. Continue
test-first, but land the production UI through the incremental specimen and integration gates below
instead of treating the approved concept screen as a complete interaction specification.

Gate A's first review specimen was reviewed on 2026-07-22. Product feedback removed the artificial
unselected Demon and under/exact/over specimen controls. One Demon is always selected. Setup shows
one effective distribution with only the selected Demon's adjustment called out, rather than
separate base and final tables.

Gate B and the start of Gate C now share one approved workflow direction: the catalog is an actual
role selector, its bottom panel describes the last-touched role, and completing the exact roster
enables confirmation. Confirmation advances directly to the Grimoire seating/assignment stage.

The second Gate B review on 2026-07-22 fixed three additional behaviors: changing to a different
Demon resets every non-Demon role choice, selected cards use highlight alone without changing
their contents or dimensions, and the top-level workflow tabs are `직업`, `배치`, and `진행`.
`배치` stays unavailable until the role roster is confirmed. Issue #97 owns the fixed-height
selection summary, official role icons, and a baseline detail dialog with type, Korean summary,
automation status, and official rules link. Richer reusable cross-tab character details remain
Issue #114.

Gate B was approved on 2026-07-22 after removing the redundant overall selection-progress sentence
and visible selected/unselected copy from the role summary. Gate C is now in progress. Its first
specimen supports both role-first and seat-first assignment, clearing an assigned seat, local role
icons, an assigned-seat counter, and a visual circular Grimoire.

The next Gate C review renamed the second tab from `배치` to `마도서`; the same surface remains
available during Play instead of duplicating a Play-only Grimoire. The seating surface no longer
repeats a step number, heading, or selected-role total. It adds random assignment and reset actions.
`저장 / 불러오기` is a separate tab aligned to the far edge of the workflow navigation; this
specimen establishes its surface and action placement before production persistence wiring.

The following Gate C iteration increases seat and icon size, raises unassigned-seat contrast, and
uses a taller mobile oval to reduce overlap. A selected seat exposes its Player-name input in the
side inspector without enlarging or adding names to every seat token. Randomize and assignment
reset preserve those names; changing Player count clears them. The storage actions use the explicit
labels `export JSON` and `import JSON`.

After assignment confirmation, the same `마도서` surface switches from editing to live reference:
the role tray and assignment controls disappear, and selecting a seat shows Player name, alignment,
role, the existing character-detail entry point, and current status chips. There is deliberately no
`배치 편집` action. During assignment, the seat inspector reserves a fixed-height name-input slot so
selecting a seat cannot resize the Grimoire. Seat tokens show seat number, Player name, icon, and
role within their existing footprint.

The next Grimoire specimen replaces the oval with a rectangular perimeter. Desktop distributes
seats evenly across all four edges; mobile keeps only two seats on the narrow top and bottom edges
and distributes the remainder vertically to avoid overlap. Editing and confirmed modes reserve the
same toolbar, workspace, panel, and footer heights. Confirmed mode replaces the center assignment
count with a placeholder `1일차 밤` and `00:00` timer. A corner return action requires explicit
confirmation, preserves seating/name/role setup, and resets all live progress state before returning
to assignment. The role-to-detail panel swap uses a short responsive transition.

The latest mobile pass removes the assignment panel from the initial Grimoire composition.
Selecting a seat opens one bottom sheet containing the seat number, Player-name input, and the
entire compact role list directly; there is no nested role popup or close icon, and tapping the
backdrop closes the sheet. Seat-first assignment keeps the sheet open, while role-first desktop
assignment still clears the completed selection. Empty and assigned cards use identical fixed
dimensions, with 15-Player non-overlap protected after actual role assignment.

Grimoire size is derived after laying out fixed-size perimeter slots rather than by spreading seats
through a predetermined height. Top and bottom rows, 12–16 px gaps, centered side lanes, and outer
padding determine the smallest wrapping height for each Player count; the canvas grows only when
another side slot is required. Assigned seats encode two independent
visual axes: the stored actual alignment controls the border/background, while Character kind
controls a separate accent. This deliberately supports future good Demons and evil Townsfolk.
Mobile side-edge positions therefore remain visually connected to the top and bottom rows while
reserving the 76 px token height plus a fixed gap. A parameterized layout
regression checks every Player count from 7 through 15 at both 320 px mobile and compact desktop
dimensions after the 7-Player corner-overlap report.
Confirmed Grimoire adds `진행 →` below the phase timer, role confirmation points to `마도서 →`,
and Play provides `← 마도서`. The top navigation no longer auto-scrolls on these actions; the full
destination content panel crosses the viewport with a short directional horizontal transition.

The role-confirmation CTA now lives inside the fixed-height role-detail panel, and that combined
panel is rendered outside the animated catalog surface and fixed to the viewport bottom. The setup
surface reserves matching bottom space, so every role card can scroll above the panel while the CTA
stays reachable without covering the role summary. In Grimoire assignment,
assigned roles receive a visible highlight and the current seat's role receives a stronger active
state. Role buttons own removal and movement: pressing the current role again unassigns it, while
pressing a role assigned elsewhere moves it to the current seat and clears its previous seat. The
separate unassign button is removed.

Grimoire confirmation follows the same prominent floating CTA pattern and remains visible in its
disabled treatment from the start; it becomes actionable only when every seat is assigned. On
mobile the role-selection floating panel
keeps only its two actions and omits the icon and short summary. At tablet widths, the idle
`좌석 또는 직업 선택` inspector is hidden so the selection tray starts with the role list, matching
the mobile content hierarchy. Confirming the Grimoire no longer inserts live Player details above
the board on mobile: seat details reuse the same backdrop-and-bottom-sheet interaction as editing,
and confirmation clears the selected seat so the board stays in place. The return action is a
compact left-arrow in the top Grimoire toolbar. The edit sheet groups seat number, assigned role,
and alignment icon on one row with the Player-name input beneath it. The separate setup-side role
progress panel is removed because distribution and catalog group counts already expose that state.
Both edit and confirmed Grimoire states place a compact back arrow at the left edge of the top
toolbar; the confirmed-state arrow uses a destructive red treatment because returning clears live
game state. Alignment badges use the literal `선` and `악` labels with the existing good/evil
background colors in both edit and live Player details. Save/Load is a separate utility navigation
above the three workflow tabs, so it never becomes a fourth horizontally scrolling stage.
Live Player details omit an empty `상태 이상 없음` chip; status-effect chips appear only when an
effect actually exists. Character-detail dialogs use a layer above the mobile seat sheet so their
content cannot be obscured by the Player panel that launched them.
Tablet Grimoire editing hides both the roster-count header and the idle selection prompt. Once a
seat is selected, only the compact two-row seat/role/alignment and Player-name block precedes the
role grid. At stacked tablet widths the selection panel inherits the Player-count-derived mobile
Grimoire height instead of retaining a fixed 520 px height, preventing unnecessary internal scroll
for small games while giving 15-Player role grids the larger canvas they require.

## Approved Scope

- Add the official Sects & Violets catalog: 13 Townsfolk, 4 Outsiders, 4 Minions, and 4 Demons.
- Support standard 7–15 Player games. Do not expose or accept 5–6 Player S&V games.
- Use the attached Korean reference PDF for Korean names and short ability summaries. Translate
  detailed examples from the official English rules rather than inventing localized rulings.
- Keep Trouble Brewing behavior unchanged and isolate all script-specific rules behind
  `characters::ScriptRules` and `characters/sects_and_violets.rs`.
- Implement baseline setup modifiers in this issue:
  - Fang Gu: `+1 Outsider, -1 Townsfolk`.
  - Vigormortis: `-1 Outsider, +1 Townsfolk` only when the base setup has an Outsider to remove.
- Represent unimplemented S&V abilities as explicit manual phase work, with stable event, replay,
  undo, export, and import semantics. Do not silently use Trouble Brewing behavior.
- Bundle the official S&V character icons locally. Rules cards in this issue contain the short
  ability summary, character type, icon, official Wiki link, and automation support status.
- Detailed rulings, translated examples, and automation remain owned by the existing character
  child issues. No additional issue is required for this foundation.

## Approved Production UI Direction

- Use the approved S&V prototype as the production shell instead of copying the existing Trouble
  Brewing setup and live-play layout.
- Treat its strengths as durable product direction: visible effective setup counts and Demon
  adjustment, large phase
  identity, separate Setup/Play surfaces, a right-aligned phase order on wide screens, and a large
  current task.
- Before game start, Setup is editable. After `setupConfirmed`, the Setup tab becomes a read-only
  roster and seating review; it cannot mutate canonical setup history.
- Present pre-game and live work as stable `직업`, `마도서`, and `진행` tabs, with
  `저장 / 불러오기` at the far edge. Confirming the role roster advances to `마도서`;
  production `진행` is gated by confirmed seating/setup.
- Replace the prototype's generic setup-adjustment selector with a Demon selector. Selecting one
  Demon includes and pins it in the roster. Changing the Demon clears all other role choices so an
  obsolete composition cannot survive the adjustment change.
- Show one effective distribution and state only how the selected Demon adjusted it. Do not expose
  separate base/final tables or under/exact/over specimen controls in production.
- Setup proceeds through Player count and Demon, roster selection, seat/role assignment, and final
  review. Keep the active stage and summary stable so mobile users do not repeatedly traverse a
  long page.
- Seat assignment supports both role-first and seat-first interaction; drag-and-drop is never the
  only input method.
- Live play retains a visual Grimoire. On desktop and iPad, the current task and Grimoire share the
  main area and phase order remains on the right. On mobile, the current task and Grimoire remain
  primary and phase order opens from a fixed bottom drawer trigger.
- Day uses a brighter lilac/ivory surface than Night. Phase text and iconography also distinguish
  Day from Night so color is not the only signal.
- Unimplemented behavior stays visibly manual. Later character issues replace manual steps without
  redesigning the shell or invalidating historical manual events.
- Applying this shell to Trouble Brewing is a separate follow-up issue. Issue 97 must not refactor
  the existing TB production workflow or make the S&V surface import TB feature components.

## Character Catalog

Use these stable IDs and Korean display names:

| Kind | ID | Korean name |
| --- | --- | --- |
| Townsfolk | `clockmaker` | 시계공 |
| Townsfolk | `dreamer` | 꿈꾸는 자 |
| Townsfolk | `snakeCharmer` | 뱀 조련사 |
| Townsfolk | `mathematician` | 수학자 |
| Townsfolk | `flowergirl` | 꽃팔이 소녀 |
| Townsfolk | `townCrier` | 포고꾼 |
| Townsfolk | `oracle` | 예언자 |
| Townsfolk | `savant` | 백치천재 |
| Townsfolk | `seamstress` | 재봉사 |
| Townsfolk | `philosopher` | 철학자 |
| Townsfolk | `artist` | 화가 |
| Townsfolk | `juggler` | 곡예사 |
| Townsfolk | `sage` | 현자 |
| Outsider | `mutant` | 변종 |
| Outsider | `sweetheart` | 사랑꾼 |
| Outsider | `barber` | 이발사 |
| Outsider | `klutz` | 얼뜨기 |
| Minion | `evilTwin` | 사악한 쌍둥이 |
| Minion | `witch` | 마녀 |
| Minion | `cerenovus` | 세레노버스 |
| Minion | `pitHag` | 마귀할멈 |
| Demon | `fangGu` | 팡 구 |
| Demon | `vigormortis` | 비고르모르티스 |
| Demon | `noDashii` | 노 다시 |
| Demon | `vortox` | 보르톡스 |

The final Korean ability strings are transcribed from the supplied PDF during the web catalog
work. The domain owns IDs, kinds, validation, order, and setup behavior, not presentation copy.

## Setup Distribution Contract

- Preserve the shared official base distribution table for 7–15 Players.
- Replace the Baron-specific boolean seam with a script-owned setup adjustment result.
- Trouble Brewing continues to apply `-2 Townsfolk, +2 Outsiders` when Baron is present.
- S&V applies Fang Gu and Vigormortis adjustments from the actual-character selection.
- Adjustments compose deterministically and may never underflow a character count.
- Setup validation, normalization, warning calculation, and Player construction must resolve
  character kinds through the selected script; cross-script IDs are rejected.

## Manual Phase Contract

Add explicit support metadata and a dedicated resolution path:

- `PhaseStepSupport = "automated" | "manual"`.
- A manual step is resolved with a command equivalent to
  `resolveManualStep { stepId, outcome: "handled" | "notApplicable" }`.
- Resolution emits `manualPhaseStepResolved` and records the outcome.
- Manual steps cannot use the normal automated confirm/skip path; automated steps cannot use the
  manual command.
- Replay and overview distinguish `manualComplete` from `notApplicable`.
- Existing manual events remain replayable after a character is automated in a later issue.
- Undo, JSON export/import, and reload preserve the manual resolution exactly.

After First Night, S&V enters a concise `낮 수동 진행` bridge. The Storyteller resolves the day
manually and advances to the next night. A persistent support indication makes it clear that S&V
day character rules are not yet automated.

## Official Night Order

First Night must allow system and character entries to interleave in this order:

1. Philosopher
2. Minion Info
3. Demon Info
4. Snake Charmer
5. Evil Twin
6. Witch
7. Cerenovus
8. Clockmaker
9. Dreamer
10. Seamstress
11. Mathematician
12. transition to manual day

Later nights use:

1. Philosopher
2. Snake Charmer
3. Witch
4. Cerenovus
5. Pit-Hag
6. Fang Gu
7. No Dashii
8. Vortox
9. Vigormortis
10. Barber
11. Sweetheart
12. Sage
13. Dreamer
14. Flowergirl
15. Town Crier
16. Oracle
17. Seamstress
18. Juggler
19. Mathematician
20. transition to manual day

Philosopher and Seamstress remain available until manually handled. Juggler appears only on its
first applicable later night. Barber, Sweetheart, and Sage appear only when their death condition
is known; an unresolved condition must remain explicit rather than being guessed. Dusk and dawn
are phase boundaries, not separate user-facing steps.

## Reminder Token Inventory

Store a canonical 37-token S&V inventory with multiplicity and placement metadata:

- Snake Charmer: poisoned ×1
- Mathematician: abnormal ×5
- Flowergirl: demon voted ×1, demon not voted ×1
- Town Crier: minion nominated ×1, minions not nominated ×1
- Seamstress: no ability ×1
- Philosopher: drunk ×1, is the Philosopher ×1 global
- Artist: no ability ×1
- Juggler: correct ×5
- Sweetheart: drunk ×1
- Barber: haircuts tonight ×1
- Evil Twin: twin ×1
- Witch: cursed ×1
- Cerenovus: mad ×1
- Fang Gu: dead ×1, once ×1
- Vigormortis: dead ×1, has ability ×3, poisoned ×3
- No Dashii: dead ×1, poisoned ×2
- Vortox: dead ×1

## Incremental UI Specimen Gates

Keep one development-only S&V workflow lab as the index for all specimens. It must let the user
switch component, scenario, viewport-oriented density, and Setup/Play surface without navigating
back through production flows. Each gate follows the same cycle:

1. write the smallest interaction/DOM contract test and confirm the intended failure;
2. implement isolated components and representative states in the workflow lab;
3. review wide and mobile compositions with the user;
4. record approved decisions here;
5. add the production integration test and land only that approved slice.

### Gate A — Setup arithmetic and selection

Specimens:

- Player-count selector for every supported count from 7 through 15;
- Demon selector for Fang Gu, Vigormortis, No Dashii, and Vortox, with one always selected;
- one effective distribution summary with the selected Demon's adjustment called out;
- live selected/required counts derived from actual role choices;
- pinned selected-Demon treatment in the character catalog.

Scenarios include 7 normal, 8 Fang Gu, 8 Vigormortis, 7 Vigormortis with no removable Outsider,
and 15 Players. Approval fixes the arithmetic hierarchy, labels, and compact/mobile wrapping.

### Gate B — Roster construction

Specimens:

- character-kind navigation and selected-roster tray;
- compact character cards with icon, Korean name, type, support status, and rules-card access;
- add, remove, replace, duplicate warning, remaining-count, and pinned-Demon states;
- a fixed-height bottom detail panel for the last-touched role so differing summary lengths never
  move the catalog, plus a baseline detail dialog with icon, type, short Korean ability summary,
  automation status, and official rules link; richer reusable details are tracked by Issue #114;
- 7-Player and 15-Player density, including one-handed mobile selection.

Approval fixes how users move between kinds, how much rules information appears during selection,
and how the selected roster remains visible without full-page scroll reversal.

### Gate C — Seating and role assignment

Specimens:

- empty, partially assigned, complete, and validation-error seat maps;
- role-first and seat-first assignment;
- swap, clear, rename, and seat-order operations;
- mobile assignment tray and wide-screen simultaneous roster/seat composition;
- final setup review showing every Player, seat, Actual Character, and unresolved problem.

Approval fixes tap behavior, focus/selection persistence, mobile panel transitions, and the exact
boundary between draft editing and canonical `setupConfirmed`.

### Gate D — Live-play shell and Grimoire

Specimens:

- large First Night, Day, and later-Night phase headers;
- manual, automated, handled, not-applicable, waiting, and follow-up current-task states;
- visual Grimoire for 7 and 15 Players with current actor emphasis;
- desktop/iPad right phase rail and mobile bottom-drawer phase order;
- brighter Day and darker Night compositions;
- read-only Setup review while Play is active.

Approval fixes information hierarchy, responsive ownership of the phase rail, Day/Night theme
tokens, and what baseline Player state appears in the Grimoire. Character-specific effects and
inputs remain in their child issues.

### Gate E — Integrated workflow lab

Combine the approved components into restartable end-to-end samples:

- 7-Player setup through First Night;
- 8-Player Fang Gu and Vigormortis setup comparisons;
- incomplete setup recovery;
- First Night manual → automated → manual progression;
- manual Day → later Night transition;
- reload, undo, export/import, and historical manual-event replay states.

Review at desktop, iPad landscape/portrait, and representative 390 px and 360 px mobile widths.
This gate validates composition and recovery; it does not reopen component decisions already
approved unless integration exposes a concrete conflict.

Keep live-play copy concise and operational. Do not add instructional prose that merely repeats
visible state.

## Test-First Work Order

1. Add black-box Rust tests for the 25-character catalog, cross-script rejection, the 7–15 limit,
   and Fang Gu/Vigormortis distribution adjustments; confirm the intended failures.
2. Implement the script dispatch and setup adjustment seam with no S&V live-rule automation.
3. Add black-box contract/replay tests for manual resolution and the official first/later-night
   order; confirm the intended failures.
4. Implement the smallest manual event/state/phase runtime needed to pass those tests.
5. Evolve the approved concept screen into Gates A–E, landing each production slice only after its
   specimen and integrated states are approved.
6. Complete assets, rules cards, reminder inventory, setup draft persistence, production manual
   phase UI, and replay/import/export wiring through those slices.
7. Apply the approved shell and interaction structure to Trouble Brewing without changing TB
   domain behavior in follow-up Issue #113.
8. Issue #112 records that Issue #97 owns Fang Gu's baseline setup adjustment while Issue #112
   owns the jump-specific automation and regression coverage.

## Completion Checks

- `cargo test --workspace`
- `pnpm --dir web test`
- `pnpm --dir web build`
- `git diff --check`
- Review for cross-script leakage, setup underflow/composition, manual-event compatibility, undo,
  replay, import/export, official order, accessibility, and Trouble Brewing regressions.
- Commit and push `codex/issue-97`.
