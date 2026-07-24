# Issue 96: Clockmaker, Flowergirl, Town Crier, and Oracle Information

## Status

Refinement completed on 2026-07-24 and amended the same day with the exact Clockmaker wording and
automatic reminder-token lifecycle. The user approved the domain, ownership, misinformation,
registration, fixture, token, and UI directions below. Production UI implementation still starts
with the small isolated prototype required by the project workflow, but the approved player-facing
wording is fixed and is not an open product question.

## Approved product contract

### Ownership boundary

- Issue #96 owns the canonical normal calculation for Clockmaker, Flowergirl, Town Crier, and
  Oracle, their Delivered Information consumer path, their production information UI, and a common
  result-domain seam that later impairment and Vortox work can reuse.
- Issues #103, #107, and #110 own creation, overlap, and lifetime of their drunk or poisoned
  sources. Issue #96 consumes active impairment reasons without reimplementing those Characters.
- Issue #109 owns Vortox activation, false-only enforcement, overlap precedence, Vortox-specific
  persisted audit context, and the no-execution win rule. It must reuse the result domains supplied
  by Issue #96 instead of recalculating Character answers.
- Issue #111 owns final cross-Character combinations, including overlapping impairment, Vortox,
  dynamic ability ownership, character/alignment changes, and persistence equivalence.
- Issue #121 supplies the approved read-only canonical token presentation interface. Issue #96 owns
  the Flowergirl and Town Crier reminder catalog entries, their rule-derived target and lifetime,
  and their replay/Undo regressions; it does not add a second token-placement UI.

### Registration and identity

- Base Sects & Violets uses the replayed Actual Character and actual alignment. It exposes no
  registration selector for these four Characters because the base script contains no
  misregistering Character.
- Traveller exile, Traveller registration, and off-script Spy/Recluse/custom-script registration
  remain out of scope.
- Keep the shared per-check Registration Judgment contract additive and intact for other scripts and
  future work; do not store a registration choice as global Player state.
- `shownCharacter` is never an input to these calculations.

### Delivered Information

- Every newly confirmed supported information step persists the existing typed
  `ConfirmedInformation` audit record: actor, target IDs, computed result, delivered result, and
  delivery context.
- Normal information is fixed. Rust records `deliveredResult = computedResult` without accepting an
  alternate.
- Drunk or poisoned delivery requires an explicit Storyteller choice from the Character's
  ability-shaped result domain. The delivered value may equal the computed truth because an
  impaired ability is allowed to work normally.
- The common consumer accepts zero or more typed active reasons so later multi-source impairment
  work does not need a second information path.
- Vortox later uses the same result domain but removes the computed truth from the legal choices.
  Issue #96 does not implement Vortox activation or overlap precedence.
- Reveal conversion receives only the confirmed delivered result and the minimum Character ID
  needed to format it. Computed truth, impairment, Vortox, registration, roster, and event history
  never enter the player-facing payload.
- Storyteller audit presentation may show both the computed and delivered values with compact typed
  reason labels. The event summary includes the actual value only when delivery differed or the
  context was discretionary.

## Canonical Character rules

### Clockmaker

- Generate the normal Clockmaker information step on the first night for a living current ability
  holder at the official Clockmaker wake position.
- Calculate immediately before confirming that step from the replayed event prefix. Earlier
  first-night identity changes therefore affect the answer.
- Sort all seated Players by seat and treat the seating as a circle.
- Identify Players whose current Actual Character kind is Demon and Minion. Life state does not
  remove a Player's Character from the distance calculation.
- The result is the smallest circular seat-edge distance from any Demon to any Minion. Adjacent
  Players have distance `1`.
- A valid base S&V setup always supplies at least one Demon and one Minion. Later dynamic states
  without either kind are deferred to their owning cross-Character issue and must not fabricate a
  computed result.
- The impaired ability-shaped domain is `1..=floor(playerCount / 2)`.

### Flowergirl

- Generate only on nights after the first for a living current ability holder.
- Inspect only confirmed `nominationVoteConfirmed` events from the immediately preceding Day
  cycle.
- For each vote event, replay the identity prefix at that event and determine whether any recorded
  voter was a Demon when that vote was confirmed.
- Return `true` if at least one such vote exists. Number of nominations, execution outcome, and the
  Demon's identity at the later Flowergirl step are irrelevant.
- No nominations, no confirmed votes, or only votes without a Demon produce `false`.
- The impaired ability-shaped domain is both Boolean values.

### Town Crier

- Generate only on nights after the first for a living current ability holder.
- Inspect only confirmed `nominationStarted` events from the immediately preceding Day cycle.
- Replay the identity prefix at each nomination start and return `true` if its nominator was a
  Minion at that event boundary.
- A nomination counts even if it produces no normal vote or execution, including a future immediate
  consequence that ends the nomination flow. Vote count and execution outcome are irrelevant.
- No nomination or only non-Minion nominators produce `false`.
- The impaired ability-shaped domain is both Boolean values.

### Oracle

- Generate only on nights after the first for a living current ability holder, after the Demon
  action and its immediate deaths and before later official wake-order entries.
- Calculate from the replayed state immediately before Oracle confirmation, including every death,
  character change, and alignment change already confirmed in that Night.
- Count all dead Players whose current actual alignment is evil. Character kind is irrelevant.
- A death or alignment change confirmed after the Oracle step is not included until a later Oracle
  check.
- The impaired ability-shaped domain is `0..=currentDeadPlayerCount`.

### Actor eligibility and changing state

- A dead ordinary Townsfolk does not receive a fixed wake step. If the Demon kills Flowergirl, Town
  Crier, or Oracle before that Character's position, regenerated replay state omits the step.
- Dynamic ability ownership, duplicate holders, and immediate use of an acquired Clockmaker ability
  are owned by #107. Issue #96 exposes calculations that accept an explicit actor and event boundary
  so #107 can call the identical canonical path.
- Existing `manualPhaseStepResolved` events for these steps remain replayable after automation.
  Newly proposed events use the automated Delivered Information path.

## Stable domain and JSON direction

### Script dispatch

- Remove the current assumption that shared `information.rs` can reach only Trouble Brewing
  calculation helpers.
- Extend the narrow script-rule dispatch so the active script owns computed results, legal result
  domains, active delivery reasons, and Character-specific calculation inputs.
- Keep all four calculations in `characters/sects_and_violets.rs` in accordance with
  `ARCHITECTURE.md`; do not create one file per Character or import Trouble Brewing private rules.
- Common orchestration continues to own Confirmed Information construction, strict boundary
  validation, Reveal conversion, summaries, and legacy-event compatibility.

### Information prompt

- Reuse `InformationResult::Number` for Clockmaker and Oracle and `InformationResult::Boolean` for
  Flowergirl and Town Crier.
- Reuse sorted, deduplicated `numberChoices` for the two numeric Characters.
- Add an additive targetless Boolean-choice prompt field rather than pretending Flowergirl or Town
  Crier has Player targets. Each choice contains the Boolean value, whether it is the computed
  result, and an empty Registration Judgment list in base S&V.
- Fixed prompts expose the computed result and only the fixed legal choice. Impaired prompts expose
  the complete approved ability-shaped domain.
- Rust owns every choice and validates the exact submitted delivered result. React never infers a
  range, truth value, historical Demon/Minion status, or impairment permission.

### Historical event boundaries

- Map `night` to the preceding `day`, `night2` to `day2`, and so on through the existing canonical
  phase-prefix helper. First Night has no preceding-Day information check.
- Flowergirl evaluates `voterIds` from `nominationVoteConfirmed`; Town Crier evaluates
  `nominatorId` from `nominationStarted`.
- Reconstruct event-time identity from the event prefix. Do not use the final roster at the
  information step and do not persist a duplicate `wasDemon` or `wasMinion` flag in Day events.
- Undo removes canonical events and replay recomputes the result. Import rejects a tampered
  information result whose stored computed/delivered/context data does not match its prior prefix.

### Automatic reminder tokens

- Clockmaker and Oracle have no reminder token owned by this issue.
- Flowergirl and Town Crier each expose exactly one automatic canonical reminder on their current
  living ability holder's Player seat through the #121 token-presentation interface. The reminder
  is read-only; Storyteller manual token editing cannot create, remove, or override it.
- On entry to each Day, replay initializes Flowergirl to `악마 투표 안 함` and Town Crier to
  `하수인 지목 안 함` when the corresponding living ability holder exists.
- Confirming a `nominationVoteConfirmed` event that includes a Player who is a Demon at that event
  prefix atomically replaces Flowergirl's reminder with `악마 투표함` in the same replay result.
- Confirming a `nominationStarted` event whose nominator is a Minion at that event prefix atomically
  replaces Town Crier's reminder with `하수인 지목함` in the same replay result.
- A positive reminder is sticky for the rest of that Day and its following Night. Later abstentions,
  non-Demon votes, or non-Minion nominations do not revert it. The next Day initializes a new
  negative state.
- Keep the reminder through the corresponding Night information step so it remains operationally
  useful to the Storyteller. Remove it when the source no longer has a living active ability holder;
  #107 later extends the same projection for dynamic or duplicate ownership.
- Do not append a separate token event. The Day transition, nomination, or vote event remains the
  single source of truth, and Rust derives the token projection from its confirmed event prefix.
  Therefore the triggering action and visible reminder update are one canonical operation, while
  Undo, replay, reload, and import cannot separate them.
- Use the official reminder labels already present in the S&V Character data and include the source
  Character label/icon and a concise description in the common token presentation.

## Approved UI and Reveal contract

### Prototype gate

- Before production changes, build one isolated review surface using the existing S&V Night shell.
- Show a fixed normal result and a selectable impaired result for at least one numeric and one
  Boolean Character.
- Verify the Storyteller editor, post-confirm Reveal, repeat Reveal, and desktop/iPad/mobile layout.
- The review decides layout and interaction details only. It must not reopen the wording or domain
  rules already approved here.

### Storyteller flow

- The current task shows the Character, actor, concise ability context, and Rust-computed official
  result.
- Normal delivery offers one confirmation action. Impaired delivery adds a compact `전달할 정보`
  selector containing only Rust-provided choices.
- Confirmation first appends the canonical event and completes the action checkpoint. It then opens
  the Reveal returned by that proposal.
- Do not retain the current static-summary `정보 공개` behavior that can Reveal before a Confirmed
  Event exists.
- Repeat Reveal uses the persisted delivered result and never creates a second event.

### Player-facing Reveal

- Clockmaker:
  - label: `악마와 하수인의 거리`
  - value: `{n}칸`
- Flowergirl:
  - label: `오늘 악마가…`
  - true value: `투표함`
  - false value: `투표하지 않음`
- Town Crier:
  - label: `오늘 하수인이…`
  - true value: `지목함`
  - false value: `지목하지 않음`
- Oracle:
  - label: `죽은 악한 플레이어`
  - value: `{n}명`
- Flowergirl and Town Crier Reveal is a statement of recorded status, never a question. Do not use
  `예`, `아니오`, `있음`, `없음`, or a question mark for these two Characters.
- Player-facing Reveal contains no explanation of why the value is true or false and no actual vs.
  delivered comparison.

## Official examples and edge-case disposition

### Rust regressions

- `clockmaker-example-1`: adjacent Fang Gu and Pit-Hag yields `1`.
- `clockmaker-example-2`: the nearest of the two Minion directions yields `3`.
- `flowergirl-example-1`: execution occurs but the Demon abstains, yielding `false`.
- `flowergirl-example-2`: the Demon votes on one of multiple nominations and no execution occurs,
  yielding `true`.
- `townCrier-example-1`: at least one of several nominators is a Minion and no execution occurs,
  yielding `true`.
- `oracle-example-1`: the executed and Demon-killed Players are all good, yielding `0` after the
  Demon action.

### Preserved out-of-scope examples

- `clockmaker-example-3`, `flowergirl-example-3`, `townCrier-example-2`, and `oracle-example-2`
  remain stored as out of scope because Traveller adjudication or exile is central.
- Keep their source text, disposition, reason, and #111 link unchanged. Do not silently convert
  exile into nomination, voting, execution, or death.

### Additional regression matrix

- Clockmaker circular wrap-around, multiple Minions, seat-order independence, and legal impaired
  range endpoints.
- Flowergirl no nominations, zero-vote nomination, Demon abstention, Demon vote, multiple votes,
  event-time Demon followed by Night identity change, negative-to-positive reminder replacement,
  sticky positive reminder state, next-Day reset, and Undo of the relevant vote.
- Town Crier no nominations, non-Minion nomination, Minion nomination without execution,
  event-time Minion followed by identity change, negative-to-positive reminder replacement, sticky
  positive reminder state, next-Day reset, and Undo of the relevant nomination.
- Oracle zero dead, mixed dead alignments, Night death before Oracle, alignment change before Oracle,
  later event exclusion, and legal impaired range endpoints.
- A Character killed before their wake position has no step or Delivered Information event.
- Forged computed values, delivered values outside the domain, missing impaired choices, alternate
  normal choices, stale steps, mismatched actors, wrong Day cycles, and tampered audit reasons fail
  proposal or whole-file replay.
- Legacy manual resolutions for all four Characters remain valid and retain their historical
  summaries after automation.

## JSON acceptance fixtures

Add one normal canonical JSON fixture per Character in a new Sects & Violets acceptance fixture
set, in addition to the six official-example Rust regressions:

1. Clockmaker records a fixed numeric result and restores the same current step after Undo.
2. Flowergirl derives `투표함` from a confirmed Demon vote in the preceding Day and projects the
   matching `악마 투표함` reminder on the Flowergirl holder.
3. Town Crier derives `지목함` from a confirmed Minion nomination in the preceding Day and projects
   the matching `하수인 지목함` reminder on the Town Crier holder.
4. Oracle counts dead evil Players after the current Night's Demon action.

The manifest records Character IDs, official source pointers, expected phase boundaries, event
summary fragments, delivered values, and the owning issue. Focused Web acceptance verifies that
each fixture renders the same Storyteller value and player-facing Reveal after replay. Issue #111
later adds overlapping source and full export/import combinations rather than duplicating these
baseline fixtures.

## Test-first implementation sequence

### Gate 0: branch and prototype

1. Update `develop`, create a dedicated Issue #96 worktree and branch, and leave unrelated working
   tree changes untouched.
2. Build the isolated Storyteller/Reveal prototype described above.
3. Verify its review interactions and target viewports, then obtain layout approval before changing
   production UI.

### Gate 1: canonical calculations

1. Add the six official-example Rust regressions and the smallest boundary tests for event-time
   identity and Oracle's post-Demon state.
2. Run them and confirm TDD Red because the current S&V steps are manual and have no calculations.
3. Implement the four script-owned calculation functions and preceding-Day prefix lookup.
4. Add living-actor filtering and confirm that a death before wake position removes the step.
5. Add the two replay-derived reminder projections and prove that their triggering Day event,
   lifetime, next-Day reset, and Undo behavior are atomic.

### Gate 2: Delivered Information seam

1. Add failing contract tests for fixed number/Boolean information, ability-shaped impaired choices,
   multiple active reasons, and strict rejection of forged choices.
2. Refactor shared information orchestration behind script dispatch without changing Trouble
   Brewing behavior.
3. Make the four S&V steps automated and attach canonical prompts.
4. Build `ConfirmedInformation`, summaries, and narrow Reveal payloads from the confirmed result.
5. Add replay validation and explicit legacy manual-event compatibility.

### Gate 3: production UI

1. Add failing Web tests for the approved Storyteller flow and exact player-facing text.
2. Integrate numeric and targetless Boolean editors into the S&V current-task surface.
3. Replace static pre-confirm information display with propose, append, then Reveal.
4. Feed the two automatic reminders into the existing #121 `PlayerTokensByPlayerId` presentation so
   the Grimoire updates immediately after the triggering nomination or vote confirms.
5. Preserve repeat Reveal, checkpoint Undo, autosave, focus return, and operation-error behavior.
6. Confirm that Reveal never contains computed truth, reason labels, roster details, or event data.

### Gate 4: fixtures and persistence regressions

1. Add the four JSON fixtures and manifest coverage.
2. Add focused replay, Undo, reload, and export/import-equivalence checks appropriate to #96.
3. Add tamper tests that mutate historical Day events and Delivered Information independently.
4. Update the official-example acceptance inventory with concrete test and fixture pointers while
   retaining the four Traveller exclusions.

### Gate 5: refactor and final verification

1. Refactor only after focused tests pass; keep S&V rules in the script module and shared
   orchestration script-neutral.
2. Run the complete Rust and Web suites and production build.
3. Review the diff once for correctness, legacy manual-event compatibility, Trouble Brewing
   regression, event-boundary errors, leakage into Reveal, and missing official-example coverage.
4. Commit the completed work and push the Issue #96 branch.

## Required verification

- Focused Issue #96 Rust calculation, contract, replay, and tamper tests.
- Focused S&V production UI and real-WASM tests.
- JSON fixture manifest and replay checks.
- `cargo test --workspace`.
- `pnpm --dir web test`.
- `pnpm --dir web build`.
- Manual iPad-sized verification of normal and impaired numeric/Boolean confirmation, all four
  Reveal variants, immediate reminder updates in the Grimoire, next-Day reminder reset, repeat
  Reveal, and Undo restoration.
- Additional high-risk review for event-prefix identity, prior-Day mapping, actor death between
  wake positions, atomic reminder derivation, token lifetime, multi-source consumer compatibility,
  persisted audit privacy, and old manual event replay.

## Completion criteria

- Rust calculates and validates all four official baseline results at their exact event boundaries.
- Normal and discretionary Delivered Information is typed, auditable, replayable, undoable, and
  stable through reload and JSON round trips.
- The production S&V UI uses the approved concise status Reveal wording and never leaks
  Storyteller-only context.
- Flowergirl and Town Crier reminder tokens appear, replace, reset, disappear, and restore from the
  same canonical Day history as their information result, using the shared #121 presentation.
- Six official examples have concrete Rust regression pointers, four Traveller examples retain an
  explicit exclusion reason, and four Character-level JSON fixtures pass.
- Trouble Brewing acceptance and all existing S&V lifecycle, Day, Demon, Snake Charmer, storage,
  and event-log behavior remain deployable.
