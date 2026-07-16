# Clocktower System Architecture

## Purpose

This document records system-level design decisions for the Clocktower Storyteller app.

Requirements stay in `CONTEXT.md`. UX and visual design direction stay in `DESIGN_BRIEF.md`.

## Architecture Shape

Use a static iPad-first PWA with a Rust domain core compiled to WebAssembly and a TypeScript UI.

- TypeScript owns UI, draft input, reveal mode, browser storage, export/import, and PWA shell.
- Rust owns canonical domain behavior: commands, event validation, confirmed event creation, replay, derived state, warnings, and step generation.
- IndexedDB stores confirmed events as the source of truth.
- Current game state is rebuilt by replaying confirmed events.

Build and deploy as static files over HTTPS.

```text
Rust WebAssembly build -> web asset
Vite build -> static dist
HTTPS host -> iPad Safari -> Add to Home Screen
```

Do not require a localhost server during play.

## Rust and TypeScript Boundary

Keep the WebAssembly boundary small and JSON-based for MVP.

```ts
core.propose(gameFileJson, commandJson) -> proposalJson
core.replay(gameFileJson) -> stateJson
core.setupDistribution(requestJson) -> distributionJson
core.suggestPhaseInput(gameFileJson, requestJson) -> phaseInputSuggestionJson
```

`propose` checks the schema version, validates a Storyteller command against the current event log, and returns a proposal containing the canonical event, warnings, computed result, and follow-up step hints when relevant.

`replay` checks the schema version and rebuilds the current rules state, visible step overview, and warnings from confirmed events.

`setupDistribution` is a read-only setup draft query. It owns Trouble Brewing setup distribution rules, including Baron adjustment, before the setup draft is complete enough to become a `createGame` command. Its draft input is limited to player count and assigned Actual Character IDs; Rust derives all rule effects from that input. Keep this API limited to deterministic setup guidance that has no confirmed event.

`suggestPhaseInput` is a stateless read-only live-play draft query. Replay identifies the current
step and its semantic `supportsRandomSuggestion` marker; the active script constructs complete valid
input combinations and maps a caller-supplied unsigned 32-bit choice token onto that deterministic
pool. The optional current input is used only to exclude a semantically identical complete draft
when another exists. This query returns `PhaseStepInput` only and never constructs a Command,
Proposal, Confirmed Event, persisted value, or Reveal payload.

Keep the Rust WebAssembly API stateless for MVP. Calls that depend on confirmed game state receive the current `GameFile`; setup draft queries receive only their draft input.

If repeated replay becomes slow on real iPad hardware, add a stateful Rust session API as a measured optimization.

## Core API Errors

WebAssembly calls should return JSON result objects instead of throwing for expected failures.

```ts
type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CoreError };

type CoreError = {
  code: string;
  messageKo: string;
};
```

Use `CoreError` for invalid commands, unsupported schema versions, malformed input, and replay failures.

Reserve panics or thrown exceptions for bugs and unrecoverable adapter failures.

## Rust Core Structure

Keep domain logic independent from WebAssembly glue.

```text
TypeScript UI
  -> WebAssembly adapter: JSON in/out
    -> Rust domain core: commands, events, replay, rules, steps
```

The Rust domain core should be testable without a browser or WebAssembly runtime.

The WebAssembly adapter should only translate JSON requests/responses and map errors into UI-readable results.

Use this repository shape when implementation starts:

```text
crates/domain
crates/wasm
web
```

- `crates/domain`: pure Rust domain logic.
- `crates/wasm`: WebAssembly adapter for JSON in/out.
- `web`: React/Vite PWA.

### Rust Domain Module Ownership

Keep the public Rust API limited to the four JSON entrypoints: `replay_json`, `propose_json`,
`setup_distribution_json`, and `suggest_phase_input_json`. Domain modules and their types stay
crate-private unless an external Rust consumer is intentionally added.

Organize `crates/domain/src` by cohesive domain responsibility:

```text
lib.rs
boundary.rs
contracts.rs
error.rs
model.rs
proposal.rs
replay.rs
information.rs
suggestion.rs
setup.rs
phase.rs
day.rs
night.rs
messages.rs
characters/
  mod.rs
  trouble_brewing.rs
```

- `lib.rs` owns only the public JSON entrypoints and intentional module declarations.
- `contracts.rs` owns the serde command, confirmed-event, payload, game-file, and JSON response contracts.
- `model.rs` owns internal replay and rules state.
- `boundary.rs` owns JSON parsing and result-envelope serialization.
- `error.rs` owns stable domain error codes and compact Korean error messages.
- `proposal.rs` validates and proposes canonical confirmed events from commands.
- `replay.rs` composes reducers and rebuilds derived state from confirmed events.
- `information.rs` owns Delivered Information orchestration, discretion validation, legacy-event
  compatibility, and current-step information prompts.
- `suggestion.rs` owns generic current-step verification, semantic current-draft exclusion, and
  deterministic choice-token selection. Script-specific combination pools remain in
  `characters/<script_name>.rs`.
- `setup.rs`, `phase.rs`, `day.rs`, and `night.rs` own their respective rule and flow logic.
- `messages.rs` owns confirmed-event summaries, reveal and preview messages, compact warnings, and labels.
- `characters/mod.rs` owns the common script-selection interface. It must not accumulate one branch per character.

### Character Script File Convention

Group character catalogs and character-specific rules by Blood on the Clocktower script, not by individual character. Use a snake-case file name under `characters/`; Trouble Brewing belongs in `characters/trouble_brewing.rs`.

- A script file owns that script's character catalog, alignment and kind lookup, wake order, required input rules, and deterministic character calculations.
- Do not create one source file per character.
- Do not import one script's private rules from another script file.
- Add a new script by adding a new `characters/<script_name>.rs` file and connecting it through the narrow interface in `characters/mod.rs`; do not add script conditionals throughout the common engine.
- Keep a rule in its script file when it has only one real caller. Extract shared behavior only after another script needs the same domain concept.
- Keep generic setup, phase, day, night, replay, proposal, and message behavior outside script files.

Use dependency layers in this order: contracts/models/errors <- character and flow rules <- replay/proposal <- JSON boundary and public entrypoints. Imports point left, toward the foundational layers. Feature modules must not depend back on replay or proposal. This keeps script additions from creating circular dependencies.

## TypeScript App Structure

Keep the TypeScript side thin and UI-focused.

Use React with Vite for the PWA frontend. Use plain CSS or scoped CSS files; do not add a UI component library for MVP.

```text
app shell
game store
wasm client
screens/components
```

- The app shell owns PWA startup, routing, install/offline behavior, and global layout.
- The game store owns loaded event logs, draft UI state, current replay result, autosave status, undo, import, and export.
- The wasm client owns calls to `propose` and `replay`.
- Screens and components own rendering, input collection, selection state, and reveal mode presentation.

Screens should not create canonical events directly. They should send Storyteller commands through the game store to the Rust core.

Do not add a routing library for MVP. Use app screen state for setup, play, reveal, import, and export surfaces.

Add routing only if URL-addressable screens become useful.

### TypeScript Module Ownership

Keep the production React entrypoint limited to application wiring and compose feature-owned components through explicit typed props. Feature components must not import `gameStore.ts`, call `useGameStore`, or reach into state owned by another feature. When two surfaces share draft state, one feature owns its type and lifecycle while `main.tsx` passes the resulting value and callbacks to both consumers.

Organize the production UI using these responsibilities:

```text
web/src/
  entry.tsx
  main.tsx
  gameStore.ts
  gameStorage.ts
  setupDraft.ts
  voting.ts
  reveal.tsx
  components/
    CharacterSelect.tsx
    CoreFeedback.tsx
  features/
    setup/
      SetupForm.tsx
      ConfirmedSetup.tsx
    grimoire/
      Grimoire.tsx
      SeatLayoutControls.tsx
    phase-control/
      PhaseControl.tsx
      StepInputs.tsx
      phaseInput.ts
    voting/
      NominationVoteInput.tsx
      useNominationDraft.ts
    event-log/
      EventLog.tsx
```

- `entry.tsx` owns the browser DOM bootstrap and production adapter construction. It renders `App` and contains no game-flow UI.
- `main.tsx` owns development prototype routing, the single `useGameStore` call, app-level Reveal and file-import state, import/export browser effects, and top-level setup/live-play composition. It passes narrow values and callbacks to feature components instead of passing the store.
- `gameStore.ts` owns loaded confirmed events, setup draft coordination, replay/proposal state, persistence workflows, undo, import/export, and the confirmed Reveal lifecycle. It contains no feature rendering.
- `gameStorage.ts` owns the browser persistence driver. `setupDraft.ts` and `voting.ts` own pure draft/domain-adjacent UI helpers shared by their corresponding feature components.
- `reveal.tsx` owns player-facing Reveal rendering from `RevealPayload` only. Prototype TSX files remain isolated development-only surfaces and must not become production feature dependencies.
- `components/CharacterSelect.tsx` owns the reusable character select control. `components/CoreFeedback.tsx` owns reusable replay/proposal/load status and warning rendering. Shared components receive display data and callbacks only; they do not own feature state.
- `features/setup/SetupForm.tsx` owns the unconfirmed setup surface, draft Grimoire editing, character assignment, setup validation summary, and setup recovery actions. `features/setup/ConfirmedSetup.tsx` owns the compact confirmed-setup summary and undo/import/export/reset controls.
- `features/grimoire/Grimoire.tsx` owns the confirmed seat map and its optional voting-selection projection. `features/grimoire/SeatLayoutControls.tsx` owns shared seat presets, overlap feedback, manual layout mode, and pointer-drag behavior used by setup and live play.
- `features/phase-control/PhaseControl.tsx` owns current-step composition, phase overview, confirmed
  Reveal follow-up, suggestion request pending/error state, and step-local draft reset.
  `features/phase-control/StepInputs.tsx` owns phase input controls and the inline suggestion action.
  `features/phase-control/usePhaseInputDraft.ts` applies a returned complete suggestion atomically.
  `features/phase-control/randomSuggestion.ts` owns the injectable browser crypto choice-token
  source. `features/phase-control/phaseInput.ts` owns phase labels plus input readiness and
  `PhaseStepInput` payload construction; keep these helpers colocated with phase control rather than
  app bootstrap.
- `features/voting/useNominationDraft.ts` owns the nomination draft type, initialization, and reset-on-step-change lifecycle. `features/voting/NominationVoteInput.tsx` owns nominator/nominee selection and vote preview. `main.tsx` may share this feature-owned draft with Grimoire and phase control through typed props.
- `features/event-log/EventLog.tsx` owns confirmed-event list rendering and composes shared core feedback for the log surface.

Imports may point from `main.tsx` to features, from features to shared components and pure helpers, and from setup to shared seat-layout controls. Avoid feature-to-feature imports except for these deliberate UI collaborations: phase control may render voting input, setup may render the event log and shared seat-layout controls, and Grimoire may consume the voting draft type. Do not introduce a reverse dependency from a feature into `main.tsx` or `gameStore.ts`.

## Step Data

Rust replay returns semantic step data for the current phase.

```ts
type CurrentStep = {
  id: string;
  phase: "firstNight" | "day" | "night";
  kind: string;
  actorId?: string;
  requiredInput: InputSpec[];
  canSkip: boolean;
};

type PhaseOverviewItem = {
  id: string;
  kind: string;
  actorId?: string;
  status: "waiting" | "current" | "complete" | "skipped" | "needsFollowUp";
};
```

TypeScript maps semantic step data to Korean labels and instructions.

Do not persist generated step lists. Replay should derive `currentStep` and `phaseOverview` from confirmed events.

Day execution uses two semantic steps. Confirming `execution` records the selected execution but
does not change life state. When a Player was executed, replay derives a following
`executionDeath` step whose `playerId` comes from that confirmed execution. Its
`executionDeathDecision` input includes the Rust-owned `executionSurvivalAllowed` capability, so
the UI does not infer script rules. Trouble Brewing leaves that capability false and rejects the
survival outcome; confirming Death creates the separate step-linked `deathConfirmed` event.

Schema-version-2 `deathConfirmed` payloads may include an optional `stepId`. Death events without
it remain valid state-only events, while a matching step-linked Death also completes the generated
execution-Death step. `executionSurvivalConfirmed` is a known strict v2 event for future scripts,
but replay rejects it unless the generated step explicitly permits execution survival.

### Ongoing Night Contract

Rust owns ongoing-night target legality. `RequiredInput.allowedPlayerIds` contains the canonical
seat-ordered allowlist for newly generated Player-selection steps, and React must use it instead of
reconstructing self-selection, dead-target, or distinct-target rules. Optional
`playerRegistrationOptions` carries the exact per-check witness needed when a target is legal only
through Registration, such as assigning a Spy as the Fortune Teller's Red Herring.

An actual Fortune Teller creates a Storyteller-only `redHerringAssignment` step before the first
Fortune Teller check. `redHerringAssigned` persists the chosen Player and any Registration Judgment;
replay keeps that choice fixed. A legacy game that already confirmed Fortune Teller information
without the assignment retains its prior events and receives a one-time recovery assignment before
its next unconfirmed Fortune Teller check.

State-changing Poisoner, Monk, and Imp steps use `nightActionResolved`, whose strict typed resolution
records the actor, target, whether poison or protection applied, or the deterministic Imp outcome.
The baseline Imp outcomes are Death, Monk-prevented, already-dead target, impaired actor, and
non-actual Character. An Imp Death is atomic with the confirmed attack and updates life state before
later night steps. It does not append a second `deathConfirmed`; that event remains the separate Day
execution-Death contract. Soldier, Mayor bounce, Scarlet Woman transfer, and win handling extend
this seam in their owning follow-up issues.

Use these schema-version-2 wire shapes:

```ts
type RedHerringAssigned = {
  type: "redHerringAssigned";
  payload: {
    stepId: string;
    playerId: string;
    registrationJudgments: RegistrationJudgment[];
  };
};

type NightActionResolved = {
  type: "nightActionResolved";
  payload: {
    stepId: string;
    actorPlayerId: string;
    resolution:
      | {
          kind: "poison";
          targetPlayerId: string;
          applied: boolean;
          noEffectReason?: "actorImpaired" | "notActualCharacter";
        }
      | {
          kind: "monkProtection";
          targetPlayerId: string;
          applied: boolean;
          noEffectReason?: "actorImpaired" | "notActualCharacter";
        }
      | {
          kind: "impAttack";
          targetPlayerId: string;
          outcome:
            | { kind: "death"; playerId: string }
            | { kind: "prevented"; reason: "monkProtection"; sourceEventId: string }
            | {
                kind: "noDeath";
                reason: "alreadyDead" | "actorImpaired" | "notActualCharacter";
              };
        };
  };
};

type NightDeathsAnnounced = {
  type: "nightDeathsAnnounced";
  payload: { stepId: string; playerIds: string[] };
};
```

A night Death is not a public announcement. The following Day's `announceDeaths` step derives the
complete ordered unannounced-night-Death list and confirms it as `nightDeathsAnnounced`. Replay marks
those deaths announced without creating another Death. Execution Death is already public and never
enters this list.

Imp proposals use these stable warning codes and operational event-summary templates, where
`{target}` and `{actor}` use the existing `seat번 name` Player label:

- prevented by Monk: warning `DEMON_ATTACK_PREVENTED`, summary
  `임프 공격: {target} · 사망 없음 (수도승 보호)`;
- already dead: warning `DEMON_ATTACK_TARGET_ALREADY_DEAD`, summary
  `임프 공격: {target} · 사망 없음 (이미 사망)`;
- impaired actor: warning `NIGHT_ACTION_NO_EFFECT`, summary
  `임프 공격: {target} · 사망 없음 ({actor} 중독)`;
- non-actual Imp: warning `NIGHT_ACTION_NO_EFFECT`, summary
  `임프 공격: {target} · 사망 없음 ({actor} 실제 임프 아님)`;
- Death: no warning, summary `임프 공격: {target} · 사망`.

When an Imp Death creates the dynamic Ravenkeeper follow-up, the Proposal includes this transient
hint while replay remains authoritative:

```json
[{ "kind": "ravenkeeperReveal", "stepId": "night:ravenkeeper", "playerId": "player-id" }]
```

Ravenkeeper is not an unconditional wake-order step. Replay inserts `nightN:ravenkeeper`
immediately after any typed night Death kills that Ravenkeeper, completes or skips the follow-up,
then resumes later wake-order steps. Undertaker is similarly conditional: it appears only when the
immediately preceding Day has the same Player in `executionConfirmed` and its matching step-linked
`deathConfirmed`. Empath runs after earlier night Death and Ravenkeeper resolution so its nearest
living-neighbor calculation uses current replayed state.

Replay exposes a derived `ruleState` projection containing the fixed Red Herring, active poison,
active protection, and unannounced night-Death Player IDs. Effect entries identify their source
Player and source event. This projection is never persisted. Poison remains active for its selected
night and following Day, expires before the next night's Poisoner choice, and ends early if its
source loses the ability. Monk protection expires on entry to Day. React may render compact
read-only badges from this projection; manual token editing remains separate.

```ts
type RuleState = {
  redHerringPlayerId?: string;
  activePoison?: { playerId: string; sourcePlayerId: string; sourceEventId: string };
  activeProtection?: { playerId: string; sourcePlayerId: string; sourceEventId: string };
  unannouncedNightDeathPlayerIds: string[];
};
```

## Messages and Warnings

Rust may return short Korean messages for MVP.

Use this for:

- confirmed event summaries
- compact warning messages
- compact proposal messages

Avoid putting layout-specific long copy in Rust. If the same rule result needs different wording for a banner, reveal screen, and log row, TypeScript should own those screen-specific strings.

Rust warnings should still include stable codes and severity so the UI can style and filter them without parsing Korean text.

## Reveal Data

Reveal screens must render from a narrow reveal payload, not from the full game state.

```ts
type RevealPayload = {
  kind: string;
  targetPlayerIds?: string[];
  characterIds?: string[];
  value?: string | number | boolean;
  messageKo?: string;
};
```

Rust proposals may include reveal payloads for player-facing information.

TypeScript should pass only the reveal payload into reveal mode. Do not pass the full grimoire state, event log, or derived rules state into the reveal screen.

For MVP, keep one app store with the full replay result, but isolate `RevealScreen` by props. `RevealScreen` should receive only `RevealPayload` and close/return callbacks.

Do not split public and secret stores for MVP. Add that only if reveal code becomes hard to audit.

## Confirmed Events

Rust creates canonical confirmed events. TypeScript only stores confirmed events returned by Rust.

TypeScript may keep draft UI state, such as selected seats, vote toggles, preview state, and open panels. Draft state is not persisted.

Use a command/proposal/event flow.

```text
UI draft
  -> Storyteller command
  -> Rust propose
  -> Proposal
  -> Storyteller confirm
  -> append Proposal.event
  -> Rust replay
```

`Proposal` should contain the canonical event when the command can be confirmed, plus warnings, computed preview information, and follow-up step hints when relevant.

TypeScript must not append an event that did not come from a proposal returned by Rust.

### Delivered Information Contract

Treat information shown or told to a Player as confirmed domain data, not as Reveal presentation
state. Information-producing `phaseStepConfirmed` events may carry an `information` record with
these responsibilities:

- `actor` and `targetPlayerIds` identify the rule check without parsing the Korean summary.
- `computedResult` records the canonical result calculated from the replayed state before any
  false-information delivery choice. It is omitted only for a drunk or poisoned setup-information
  actor, because that flow records one ability-shaped delivered choice without fabricating an
  unselected true pair.
- `deliveredResult` records exactly what the Storyteller showed or told the Player.
- `deliveryContext` is `fixed` when the two results must match, or `discretionary` with typed
  drunk, poisoned, and per-check Registration Judgment reasons.

Numeric information prompts expose Rust-derived, sorted, deduplicated `numberChoices`. Each choice
contains its value, whether it is the unmodified computed truth, and the exact per-check
Registration Judgments needed to make a registration-only alternate legal. Setup-information
prompts similarly expose concrete Spy/Recluse registration options; TypeScript does not reconstruct
these rules.

Target-dependent Fortune Teller, Undertaker, and Ravenkeeper prompts expose Rust-derived
`targetChecks`. Each check identifies the exact target Player IDs, its computed typed result, and
the legal delivered-result choices with their Registration witnesses. Fortune Teller enumerates
seat-ordered two-Player combinations, Ravenkeeper one check per selectable target, and Undertaker
one check for its replay-derived executed-dead target. React selects an exact check and never
calculates Demon, Red Herring, Character, impairment, or Registration results.

Use a tagged `InformationResult` union/enum for result values. Add result variants when a script
implements a new kind of information; do not fall back to `serde_json::Value`, `unknown`, or a
Korean message as the persisted value. Registration Judgments identify the affected Player and
the alignment or character-kind value used for that specific check. They are not global Player
state.

Ongoing Fortune Teller information uses a typed Boolean result. Undertaker and Ravenkeeper use a
typed Character result. Under impairment, their legal ability-shaped choices are both booleans or
the Trouble Brewing Character catalog respectively; normal Registration-adjusted alternatives keep
the unmodified computed result and persist the exact per-check witness in `deliveryContext`.

Replay may derive an `informationPrompt` for the current `PhaseStep`. This prompt is transient
rules guidance containing the computed result and whether Delivered Information is fixed or must
be selected. It is not an audit-history copy. The Confirmed Event remains the only persisted audit
source, and event-log summaries consume its typed `information` payload.

For fixed delivery, Commands do not accept an alternate delivered value and Rust records
`deliveredResult = computedResult` automatically. When replayed state establishes drunk or
poisoned discretion, or a valid Registration Judgment is submitted for the current check, the
Command must include an explicit delivered result. Rust rejects missing discretionary values and
unjustified alternate values at the boundary.

Apply selectable delivery only to result kinds whose canonical calculation is implemented by the
active script. Persist other currently supported Reveal results as fixed audit records until their
own rule ticket supplies canonical true-result derivation; do not treat an unchecked Storyteller
draft as a separately computed truth. Trouble Brewing setup-information validation is owned by
#7/#30, and Fortune Teller, Undertaker, and Ravenkeeper calculations are owned by #8.

Construct the canonical event before constructing `RevealPayload`. Reveal conversion receives
only the confirmed `deliveredResult` plus the minimum information kind needed to format it. It
must not read the full ReplayState, Grimoire, command draft, or `computedResult`. A Spy result uses
a narrow Spy-specific delivered result rather than passing the general Grimoire model.

Schema version 2 stores this information contract. A `phaseStepConfirmed` event omits
`information` when its step produces no information; newly proposed supported information events
include the typed record, and import/export preserves it unchanged.

### Day and Nomination Contract

Day remains one top-level phase with typed, replayable steps in this order:

```text
announceDeaths -> whisper -> discussion -> nomination:* -> execution -> toNight
```

`whisper` and `discussion` are `StepType` values. TypeScript renders their labels and actions from
the typed step and does not infer behavior by parsing step IDs. Every transition still uses the
normal command, proposal, confirmed-event, and replay path.

Rust owns the confirmed nomination standing. It derives the execution threshold as
`max(1, ceil(livingPlayers / 2))`, derives vote counts from unique confirmed voter IDs, and derives
the highest count and execution candidate from every confirmed nomination in the current Day. A
candidate exists only when exactly one nominee has the qualifying highest count; a top tie has no
candidate. TypeScript renders this replay result and must not predict candidate or threshold changes
from an unconfirmed draft.

Rust also owns nomination eligibility and exposes `DayState.eligibleNominatorIds` and
`DayState.eligibleNomineeIds` in roster/seat order. Each list contains living Players who have not
used that role during the current Day. The roles are independent, so a prior nominee may still
nominate and a prior nominator may still be nominated; self-nomination is allowed when the Player is
eligible for both roles. Eligibility resets with the Day step prefix. TypeScript uses these canonical
ID lists for the two nomination selects and does not reconstruct eligibility from Players or
nomination history.

Schema-version-2 nomination events persist only canonical audit input:

```ts
type NominationVoteConfirmed = {
  type: "nominationVoteConfirmed";
  payload: {
    stepId: string;
    nominatorId: string;
    nomineeId: string;
    voterIds: string[];
    ghostVoteSpentPlayerIds: string[];
  };
};
```

Replay derives `voteCount`; events do not persist a duplicate count or an incremental candidate
flag. Nomination payloads reject unknown fields. Proposal and replay both enforce event order,
known and unique voters, consistent ghost-vote spending, living nominators and nominees, and no
repeated same-Day use of either role.

Manual corrections use the same command/proposal/event flow.

Correction commands should be limited to explicit game-state edits such as character correction, alive/dead status, ghost vote status, notes, and token add/remove.

Do not let TypeScript patch derived rules state directly.

## Persistence

Autosave stores the confirmed event log in IndexedDB.

Undo removes the latest confirmed event and calls `replay` again.

JSON export/import moves the confirmed event log between devices.

Do not store rules-state snapshots for MVP. The event log is the only persisted game state; current state is always produced by `replay`.

If replay becomes slow on real iPad hardware, add snapshots as a measured optimization.

TypeScript owns all browser storage.

Use a small IndexedDB wrapper without a storage dependency for MVP.

```text
database: clocktower
object store: game
key: latest
value: GameFile
```

```ts
type GameFile = {
  schemaVersion: 2;
  exportedAt?: string;
  game: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
};
```

IndexedDB stores one `GameFile` without `exportedAt`.

Export reads the stored `GameFile`, adds `exportedAt`, and writes JSON.

Import reads a `GameFile`, checks the basic JSON shape and schema version, calls Rust `replay` to
verify the complete event log, then replaces the stored game and opens it. Schema version 1 and an
invalid version-2 log are rejected as whole files; import never installs a successfully replayed
prefix or partial state.

Only keep the latest stored game for MVP. Starting a new game or importing a game replaces the current stored game after user confirmation.

Do not build a saved game list or merge imported events for MVP.

If the current stored game has confirmed events, starting a new game or importing a game must ask for confirmation before replacement.

Do not create automatic backup copies for MVP.

## Deferred

- Web Worker for the Rust core. Add only if replay/propose blocks the UI on real iPad hardware.
- Native wrapper such as Capacitor. Add only if PWA storage or lifecycle behavior becomes a real problem.
- Generic rules DSL. Out of scope for Trouble Brewing MVP.
