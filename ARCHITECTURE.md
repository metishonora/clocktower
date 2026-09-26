# Clocktower System Architecture

## Purpose

This document records system-level design decisions for the Clocktower Storyteller app.

Requirements stay in `CONTEXT.md`. UX and visual design direction stay in `DESIGN_BRIEF.md`.

Shared domain definitions and state ownership are documented in
[DOMAIN_MODEL.md](DOMAIN_MODEL.md). Its broader responsibility model remains conceptual outside
the custom first-night runtime implemented for #206. The custom runtime details below describe
that implementation; existing official scenario runtimes remain on their current paths and are
not migrated onto it.

## Architecture Shape

Use a static iPad-first PWA with a Rust domain core compiled to WebAssembly and a TypeScript UI.

- TypeScript owns UI, draft input, reveal mode, browser storage, export/import, and PWA shell.
- Rust owns canonical domain behavior: commands, event validation, confirmed event creation, replay, derived state, warnings, and step generation.
- IndexedDB stores confirmed events as the source of truth.
- Current game state is rebuilt by replaying confirmed events.

The custom Rust runtime retains one validated replay prefix in memory per execution thread.
It reuses that aggregate only when the schema, complete script definition, and every serialized
event in the cached prefix match exactly; appended events still cross the normal validation and
reducer path. Changed or truncated histories replay from setup. A cache entry is replaced only
after replay and projection succeed, and speculative proposal results never enter it. This is
a disposable performance optimization, not persisted state or a change to canonical validation.

Build and deploy as static files over HTTPS.

```text
Rust WebAssembly build -> web asset
Vite build -> static dist
HTTPS host -> iPad Safari -> Add to Home Screen
```

Do not require a localhost server during play.

## Custom daytime runtime (#223)

`crates/custom-domain/src/day` owns daytime commands, progress, event-time participant snapshots,
nomination/vote/execution history and the transition to the next night. TB/SnV character modules
own daytime eligibility, registration, effects, death consequences and victory conditions.
`dayConfirmed` events are validated by recomputing their typed result against the exact prefix;
the UI consumes `ReplayState.day` and never patches canonical player state.

Actual and simulated abilities retain their original source identities. Death records preserve
the identity, alignment and impairments at death; Barber handoff and Juggler records remain
available to the following night. Mathematician evidence starts a new window at dawn.
Execution/death/consequence confirmations share a causal Undo unit. Canonical files and IndexedDB
store the same events, and failed saves block further live actions until retry succeeds.
The next-night transition expires day-limited effects; night action execution remains in #204.

### Custom automatic reminders (#223)

Automatic tokens are read-only projections, never reducer inputs or saved facts. The common
`reminders.rs` dispatcher registers character handlers from `characters/<script>.rs` and invokes
them with a `ReminderContext` bound to one concrete source. The source comes from the recorded
ability provenance ledger (including historical instances and acquired grants), or from confirmed
simulation guidance. The script's character pool alone never admits a handler invocation.
Historical preparations retain their original simulation source; active guidance is resolved
separately, without manufacturing an actual ability instance.

Handlers own token kind, target, evidence event and lifetime. Context queries distinguish current
instances, living owners, matching action occurrences and actual versus simulated sources; no
universal effectiveness gate is applied. Undertaker requires a living current ability/guidance
source, while Barber's pending death handoff retains its historical source. Persistent effect
markers retain historical attribution but require a currently valid maintenance binding.
Resolved effect and spent-use formatting are reusable context
helpers explicitly selected by character registrations. The common dispatcher contains no
character-name branches and never infers ability ownership from a token or target's character.

`projection::rule_state` and the Spy information handler consume the same dispatcher. The latter
freezes the result at the confirmed event prefix using the existing reveal snapshot boundary.
Overlapping observers of the same marker are deduplicated without modifying the underlying facts.
Production reminder handlers remain disabled in the isolated fixture runtime. New character tokens
must be registered in their owning script module and tested for source and lifetime boundaries;
adding a global post-processing token rule in `projection.rs`, day orchestration or TypeScript is
not supported. GameFile/schema and confirmed events remain unchanged.

## Independent official and custom runtimes (#207)

Official execution lives in `crates/domain`, `crates/wasm` and `web/src/core`.
Custom execution lives in `crates/custom-domain`, `crates/custom-wasm` and
`web/src/custom/{core,storage}`, with its session in `web/src/custom/session.ts`.
Neither runtime imports the other's domain, DTOs, validators, storage helpers or generated WASM.
The two WASM artifacts have separate adapters and initialization failures. The custom catalog
is emitted from custom-owned Rust data, including the custom TB/SnV metadata it permits.

Custom SnV rules, information candidates, active effects and causal twin repairs are owned by
`crates/custom-domain/src/characters/sects_and_violets.rs`. Custom TB registration semantics stay
in that crate's `characters/trouble_brewing.rs`. Spy/Recluse registration sources and allowed
judgments are exposed through the narrow `characters` facade for TB, SnV, Carousel and Jinx
consumers. Eligibility uses source availability and ability-scoped impairment; it does not require
a living owner. Candidate projection, command validation and replay share this policy.
Day progress captures eligible registration sources at nomination, vote and death event prefixes.
These replay-only records preserve historical availability independently of later suppression,
recovery, identity changes or impairment. Serialized participant abilities still describe ownership;
GameFile and confirmed event formats do not include the derived registration records.
Cross-script character-kind queries use the unified custom catalog (or resolved script context),
including Vigormortis neighbor and Minion checks; script-local tables only own their own metadata.
`information.rs` validates common input/result shapes; it does not import official rule
implementations. The scheduler owns progress and stable
occurrence identity, while handlers own eligibility and typed facts. A simulation refers to a real failed Philosopher choice, Drunk or Marionette identity, or acquired guidance; it cannot acquire a fictional ability instance. Pixie-derived simulated guidance keeps the original real root and the confirmed bond/death provenance.

Carousel rules live in `characters/carousel.rs`. Boffin and Pixie reuse source-bound
ability grants without changing the recipient's identity. Ownership, temporary
availability, and impairment are distinct: an impaired Boffin suspends a grant
without erasing its use history; the Demon's own impairment does not poison that
grant. Character handlers project legal choices and reminders. New private role,
ability and Marionette notifications use the existing saved recipient-by-recipient
continuation, not extra scheduler phases. Balloonist setup discretion and the
initial Boffin grant are canonical setup inputs; Marionette's believed role remains
separate from its real identity. UI does not compute eligibility or Jinx results.

Night steps and overview entries expose Core-derived `abilityImpairments` for the
acting ability, not its owner's unrelated impairments. This presentation metadata
is rebuilt on replay; it is not saved in GameFile or inferred by character-specific
UI exceptions. Daytime availability and death-trigger snapshots use the same grant
availability and ability impairment boundaries. Alignment-dependent victory rules
use the ability owner's actual team; simulated information uses its real root source
when deciding whether Vortox applies.

Custom `effects.rs` resolves character-owned effect candidates against a common fact view.

Persistent contributions carry an `EffectRule` with a mandatory binding, a time window, and
whether the original attempt succeeded. `EffectBinding` distinguishes an ordinary ability,
an ability that works after death, and the resulting identity of a transformation. `NoDeadline`
only removes the clock deadline; it never bypasses ownership, availability or impairment checks.
The historical `source_ability_use` remains the event's cause. Snake Charmer poison is maintained
by the exact resulting identity (also when an acquired Snake Charmer produces a Philosopher),
while Sweetheart drunkenness is maintained by its exact ability with an explicit death exception.
Self-inflicted impairment is a character-declared `SelfInteraction`, not an implicit exemption
for all durable records. A recipient's identity change does not erase externally maintained effects.

`effects/lifetime.rs` evaluates active, suspended, ended and never-applied states with reasons.
The existing impairment fixed-point solver evaluates these rules, retains independent overlapping
contributions, and rejects oscillating dependencies. Curse, madness, master, protection and twin
candidates use the same rule evaluator; their rule consumers and automatic reminders use its
results. Ended markers disappear; suspended and never-applied markers use `inactiveReason`.
Character modules still own target selection, day/night windows, replacement rules and grants.
Historical causes, deaths, identity changes, delivered reveals and spent uses are not deleted.
Undo and replay derive validity from the selected prefix; no effect status is serialized.

Official SnV keeps a separate `characters/sects_and_violets/effect_lifetime.rs` implementation.
It reconstructs Snake Charmer and Sweetheart bindings from canonical events and evaluates their
dependencies around the existing SnV ability-state calculation. Inconsistent cycles fail replay.
Legacy Cerenovus events have no ability-instance field; their acquisition event boundary excludes
assignments made before the current identity. Its explicit window includes the following day and
night, but not another day; a newer assignment supersedes the previous one. This does not migrate official TB/BMR, grants or the entire rules engine onto the custom evaluator.

The saved `expires: never` DTO is unchanged and does not imply an unconditional effect. Existing
files still cross strict event validation. An old result that depended on the fixed bug may fail
replay; import does not rewrite previously delivered information or saved deaths. The reported
Vortox game first conflicts at event 29 (Dreamer information), after 28 valid events. Historical
recovery/versioning remains separate from this rule correction. See
[the effect lifetime audit](docs/testing/effect-lifetime-audit.md).

`simulation.rs` derives guidance and its usage from real sources and confirmed choices.
The scheduler owns required preparation and optional candidates separately from ordered progress.
Preparation records link each delivery to the chosen version; optional events cannot consume ordinary progress.
Mutant execution uses a typed terminal result and clears all pending actions without entering Day.
Custom Mathematician audit consumes character-owned malfunction evidence and causes. It retains
actual delivered information but never requires or emits a replacement computed answer; ordinary
character information calculations retain their own computed values.

Preacher suppression is source-bound and separate from impairment: action scheduling and
ongoing effects consult the same availability boundary without creating false malfunction
evidence. Permanent source/target identity changes expire bindings; temporary source impairment
does not erase them. Chambermaid lives in `characters/bad_moon_rising.rs` and derives wake evidence
from confirmed own-ability actions, with the Mathematician forecast supplied by its Jinx.
The UI receives read-only per-target evidence and Core-owned numeric delivery constraints.
Product-specific Jinx registrations retain their issue provenance internally and share the
ordinary Jinx presentation; Boffin-origin acquisition restrictions follow nested grant provenance.

Production registers 23 ordered TB/SnV/Carousel/BMR character actions and ten additional preparation or optional actions; fixture builds separately register only system
and test handlers. `scripts/check-custom-boundaries.mjs` rejects imports across the boundary,
including indirect Cargo/TypeScript and source-include dependencies. Run its negative tests with
`node --test scripts/check-custom-boundaries.test.mjs`.

The separation checkpoint is `ca357fd`. Custom-only changes after this checkpoint run
`cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`,
`pnpm build:wasm:custom`, `pnpm --dir web test:custom`, and `pnpm test:custom-runtime`.
`node scripts/verify-custom-runtime-isolation.mjs` builds and tests custom in a temporary workspace
with official source and artifacts absent. The optional `--official` checkpoint verification
runs official TB/SnV/BMR without custom; it is not required again for custom-only behavior changes.
Release validation still includes `pnpm --dir web build` and PWA verification.

## Custom official Jinx foundation (#213)

`crates/custom-domain/resources/jinxes.json` is a checked-in TPI snapshot at
`f10cd02e3401af227ce406287eaae7bb99a06a42`. `jinxes.rs` pairs this metadata with typed
character-owned registrations. Stable pair IDs use sorted official lowercase IDs;
resolved metadata retains the exact custom character IDs. This conversion does not
relax command, definition or import ID validation.

Registry initialization checks the complete published custom character catalog against
the snapshot. Missing, duplicate, unknown, metadata-only or unverified registrations
fail with `JINX_REGISTRATION_INVALID` before a resolved script can execute. Off-catalog
official pairs remain reference data and do not enable unsupported characters.
`ResolvedScriptContext.related_jinxes()` is a deterministic read-only script query;
script membership is never a universal rule-effectiveness gate.

Registered callbacks serve information registration, succession prevention,
simulation malfunction causes, forbidden grants and shown-role setup modifiers.
Their owning TB/SnV/Carousel modules decide the conditions using
current ability provenance, the action occurrence, and before/after facts. New consumers
can add typed seams without adding character branches to the scheduler or parsing natural
language rules. Registrations link acceptance evidence; publication changes must pass
coverage and composed behavior tests.

The Fang Gu/Scarlet Woman rule runs before succession creates an identity or reveal.
Sage information uses the triggering killer and character-owned Recluse judgments;
confirmed judgments and delivered information pass the same proposal/replay validation.
Mathematician evidence retains real Drunk guidance provenance, including acquired Drunk
abilities and daytime information, without inventing a simulated ability grant. Death,
impairment and ability ownership remain separate character-owned conditions.

Related metadata and Jinx activity are not separately persisted. Existing events retain
Storyteller choices and results, and replay derives effects, audit and frozen reveals.
The source revision identifies the reference snapshot, not a persisted ruleset version.
Catalog revision, historical ruleset replay and migration remain in #191.

## Rust and TypeScript Boundary

Keep the WebAssembly boundary small and JSON-based for MVP. The APIs below describe adapter
capabilities across the app, not one combined WASM export surface. Official WASM accepts only
official records; custom WASM owns custom catalog, plan, Setup, propose and replay exports.

```ts
core.propose(gameFileJson, commandJson) -> proposalJson
core.replay(gameFileJson) -> stateJson
core.setupDistribution(requestJson) -> distributionJson
core.suggestPhaseInput(gameFileJson, requestJson) -> phaseInputSuggestionJson
core.customScriptCatalog() -> CustomScriptCatalogEntry[]
core.customFirstNightPlan(requestJson) -> CustomFirstNightPlanResult
core.customOtherNightPlan(requestJson) -> CustomFirstNightPlanResult
```

`propose` checks the schema version, validates a Storyteller command against the current event log, and returns a proposal containing the canonical event, warnings, computed result, and follow-up step hints when relevant.

`replay` checks the schema version and rebuilds the current rules state, visible step overview, and warnings from confirmed events.

`setupDistribution` is a read-only setup draft query. Its exact request union carries either an
official `scriptId` or a complete `customDefinition`, plus the player count and assigned Actual
Character IDs. The common layer owns the base player-count table; official script modules own their
modifiers, while a resolved custom roster composes the modifiers of its assigned characters. Keep
this API limited to deterministic setup guidance that has no confirmed event.

`suggestPhaseInput` is a stateless read-only live-play draft query. Replay identifies the current
step and its semantic `supportsRandomSuggestion` marker; the active script constructs complete valid
input combinations and maps a caller-supplied unsigned 32-bit choice token onto that deterministic
pool. The optional current input is used only to exclude a semantically identical complete draft
when another exists. This query returns `PhaseStepInput` only and never constructs a Command,
Proposal, Confirmed Event, persisted value, or Reveal payload.

`customScriptCatalog` is a stateless read-only compatibility query exposing only the canonical
custom-script Character `id` and `kind` pairs. It exists so the TypeScript catalog can be checked
against the generated Rust/WASM allowlist without maintaining a third fixture. It carries no
script ownership, Setup modifier, phase order, command routing, or Character-rule metadata.

`customFirstNightPlan` is a stateless read-only authoring query. Its existing wire request shape
remains `{ customDefinition: ... }`, but that request uses a separate `CustomScriptDefinitionDraft`
whose `firstNightOrder` is optional. It returns either the draft's declared order or a deterministic
authoring proposal, together with the source (`definition` or `default`). The proposal is a checked-in
snapshot of the official global first-night order filtered to the supported TB/S&V action catalog.
When a new custom definition omits an order, its caller must materialize the returned plan as the
required canonical `firstNightOrder` before saving the definition or creating a game. Completed
runtime, import, and stored-session paths never call this query as a fallback. The deterministic
proposal is available only while authoring a new definition.

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

Keep the public Rust API limited to six JSON entrypoints: the four existing result-envelope APIs
(`replay_json`, `propose_json`, `setup_distribution_json`, and `suggest_phase_input_json`), the
read-only `custom_script_catalog_json` compatibility query, and the result-envelope
`custom_first_night_plan_json` authoring query. Domain modules and their types stay crate-private unless
an external Rust consumer is intentionally added.

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
  registry.rs
  trouble_brewing.rs
  sects_and_violets.rs
  sects_and_violets/
    step_key.rs
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
- `crates/custom-domain/src/game.rs` owns custom-game replay and proposal dispatch. Its event-by-event fold validates
  each event, calculates facts and first-night progress, and adopts them together only when the
  whole transition succeeds.
- `crates/custom-domain/src/state.rs` owns replay-derived `CustomGameState`, `CustomGameFacts`, action-occurrence
  identity, and `FirstNightProgress`. Completion history and its Step/Reveal snapshots are internal
  replay values; these types are not persisted.
- `crates/custom-domain/src/event.rs` owns the finite typed fact-change handoff. `crates/custom-domain/src/first_night/registry.rs`
  owns `ActionSpec`/handler registration, common provenance, membership, and input validation, and
  constructs the private `ValidatedCustomEvent` accepted by the reducer and scheduler.
- `crates/custom-domain/src/reducer.rs` calculates facts only from previous facts and a validated event. `crates/custom-domain/src/rules.rs`
  supplies read-only facts, ownership, and ability-instance queries; it does not own action behavior
  or a universal participation predicate.
- `crates/custom-domain/src/first_night/plan.rs` owns canonical definition-order validation and the authoring-only
  deterministic default proposal. `crates/custom-domain/src/first_night/runtime.rs` owns `NightScheduler`, which
  calculates cursor, occurrence completion, exclusion, history, immediate queue, and activation
  admission; `activation.rs` supplies the pure activation decision boundary. `system.rs` owns the
  system handlers.
- `crates/custom-domain/src/projection.rs` derives public `RuleState`, current Step, and phase overview from the
  replay-derived facts and progress, retaining confirmed Step/Reveal snapshots for completed rows.
- `messages.rs` owns confirmed-event summaries, reveal and preview messages, compact warnings, and labels.
- `characters/mod.rs` owns the common script-selection interface. It must not accumulate one branch per character.
- `characters/registry.rs` resolves an ordered custom definition against the TB/S&V allowlist and
  exposes roster-scoped membership and canonical `CharacterKind`. The registry does not assign a
  script owner; custom-owned character modules supply the typed ID/kind projections; official runtime data is not imported.
- `identity.rs` owns validated event identities used while crossing the import/replay boundary.
- `characters/sects_and_violets/step_key.rs` owns S&V step-key parsing and semantic classification.
  Reducers and proposal rules consume the typed result instead of repeating string-prefix logic.

`GameFile.game.script` is the canonical script reference. Official references carry a `scriptId`;
custom references carry the complete definition snapshot that owns the Character pool and canonical
first-night order. Structural parsing first validates the definition shape, exact ID uniqueness,
and required order. Registry resolution then rejects any ID outside the current TB/S&V allowlist,
including non-canonical case and all BMR IDs, before replay or proposal can reach a script-specific
reducer. A successful resolution preserves ordered Character-pool membership and kind lookup.
`replay` and `suggestPhaseInput` obtain an official selector from that reference;
`setupDistribution` receives an exact official/custom selector in its standalone request. `propose`
resolves custom definitions for strict Setup confirmation and routes a custom game into its own
first-night runtime. Dispatch occurs before a persisted event or command can enter an official
script-specific reducer, and a custom game never falls back to another script's rules. Custom phases
after first night remain unavailable until their dedicated runtime issues.

### Character Script File Convention

Group character catalogs and character-specific rules by Blood on the Clocktower script, not by individual character. Use a snake-case file name under `characters/`; Trouble Brewing belongs in `characters/trouble_brewing.rs`.

- A script file owns that script's character catalog, alignment and kind lookup, wake order, required input rules, and deterministic character calculations.
- Do not create one source file per character.
- Do not import one script's private rules from another script file.
- Add a new script by adding a new `characters/<script_name>.rs` file and connecting it through the narrow interface in `characters/mod.rs`; do not add script conditionals throughout the common engine.
- Keep a rule in its script file when it has only one real caller. Extract shared behavior only after another script needs the same domain concept.
- Keep generic setup, phase, day, night, replay, proposal, and message behavior outside script files.

S&V is the current reference implementation for typed step identities and script lifecycle rules.
Do not reshape Trouble Brewing merely to make both implementations look alike while S&V is still
evolving. After S&V behavior is complete, reassess Trouble Brewing against the proven S&V seams and
extract only concepts that are genuinely shared. Until then, keep the script-selection interface
narrow and do not introduce a generic rules DSL or cross-script reducer abstraction.

### Custom Night Action Runtime

A persisted custom definition contains required complete `firstNightOrder` and `otherNightOrder` plans. The plan is ordered
over stable semantic references rather than over players or current assignments:

```ts
type FirstNightActionRef =
  | { kind: "system"; actionId: "dusk" | "minionInfo" | "demonInfo" | "dawn" }
  | { kind: "character"; characterId: string; actionId: string };
```

`dusk` must be first and `dawn` last. `minionInfo` and `demonInfo` are ordinary movable entries, so
the Storyteller can place Character actions before, between, or after them. The plan must contain
each system entry and each first-night action belonging to the definition's complete Character pool
exactly once. It is intentionally not reduced to initially assigned Characters: acquired or newly
introduced abilities must retain a predetermined location.

The definition snapshot owns this order for the lifetime of the custom game. `setupConfirmed` owns
only the actual roster and seat assignments; it does not carry or alter the first-night order. At
replay and proposal time, the runtime walks the explicit definition order and filters it through the
active instances exposed by the current rule service for the current roster and replay state. An
absent action instance is skipped. If an active ordered action has no registered handler, the runtime
returns an explicit unsupported-action error; it never delegates to an official script.

The `createGame` command and `setupConfirmed` event payloads reject the removed
`firstNightOrderPlan` field. There is no migration for an unpublished custom schema-v4 variant that
moved an order from Setup into the definition.

The active-action projection, generated steps, and progress are transient replay-derived values.
Progress advances only from confirmed events. Later first-night events persist the confirmed action
result and its provenance (`actionRef` and `abilityUse`); they do not persist a projected action
list, step list, or progress projection.

The custom runtime uses an event-by-event pure fold. `crates/custom-domain/src/game.rs` replays the current prefix,
then `propose_step` invokes the registered handler for the current occurrence and validates the
candidate through the same boundary used by replay. The candidate facts and progress are discarded
after proposal; only a later confirmation adds the event to the record.

Runtime composition has explicit roles:

- `ActionSpec` declares a stable action reference plus first-night participation, input kind, and
  support metadata, prerequisite action references and continuation-source declarations.
- A pure `ActionHandler` projects an action through read-only rule services and receives the current
  occurrence and typed input when proposing a result. Character handlers return a typed custom result
  in an event draft, while system handlers retain their existing system draft; acquired abilities
  remain distinguished by ability-instance provenance and deterministic ordering.
- The registry runs common and action-specific validation for the draft and persisted event,
  including input, result, action, step, actor, instance, and membership checks. It is the only
  production construction boundary for the private `ValidatedCustomEvent`.
- The facts reducer is the only component that calculates canonical fact changes. `NightScheduler`
  separately calculates cursor and occurrence progress from the event and before/after facts; it
  owns completion, exclusion, immediate queue, and history.
- The projector derives the public `RuleState`, current Step, and phase overview after a coherent
  facts/progress pair has been adopted.

The registry rejects duplicate registrations and spec/handler identity mismatches. An active
ordered Character action with no registered handler returns an explicit unsupported-action error;
an action with no active instance is skipped after filtering. The canonical Character event envelope
is `customActionConfirmed` with `stepId`, `actionRef`, `abilityUse`, `input`, and typed `result`;
system actions retain the existing `phaseStepConfirmed` wire format. Feature-gated fixture handlers
are available only to the dedicated test/fixture build; production Character implementations are
not added here. The runtime never delegates to a TB or S&V module. Existing official TB, S&V, and
BMR execution paths coexist unchanged apart from additive shared-contract plumbing and are not
migrated onto this runtime. This seam adds no new UI, other-night runtime, or Character-specific
or acquired-ability rule policy.

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

For S&V, `canonicalSessionController.ts` is the application boundary for propose, append, replay,
and undo. It rejects stale proposals, duplicate event identities, and replay results that do not
cover the exact canonical stream. React screens may own draft state, but they must not maintain an
independent confirmed-event history or bypass this controller when mutating a session.

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
    public-actions/
      SlayerAbilityDialog.tsx
    setup/
      SetupForm.tsx
      ConfirmedSetup.tsx
      SeatLayoutControls.tsx
    grimoire/
      Grimoire.tsx
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
- `features/grimoire/Grimoire.tsx` owns the confirmed live seat map and its optional voting-selection projection. Confirmed layouts are read-only during live play. `features/setup/SeatLayoutControls.tsx` owns setup-only seat presets, overlap feedback, manual layout mode, and pointer-drag behavior.
- `features/phase-control/PhaseControl.tsx` owns current-step composition, phase overview, confirmed
  Reveal follow-up, suggestion request pending/error state, and step-local draft reset.
  `features/phase-control/StepInputs.tsx` owns phase input controls and the inline suggestion action.
  `features/phase-control/usePhaseInputDraft.ts` applies a returned complete suggestion atomically.
  `features/phase-control/randomSuggestion.ts` owns the injectable browser crypto choice-token
  source. `features/phase-control/phaseInput.ts` owns phase labels plus input readiness and
  `PhaseStepInput` payload construction; keep these helpers colocated with phase control rather than
  app bootstrap.
- `features/public-actions/SlayerAbilityDialog.tsx` owns the popup-local target and per-check
  registration draft for the Trouble Brewing Slayer. The Grimoire receives only Rust-derived
  availability and an open callback; the dialog sends its confirmed draft through the app-owned
  game-store command path and never creates a canonical event itself.
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

### Slayer Public Action Contract

Discussion may host a canonical public action without completing the Discussion step. The actual
living Slayer's once-per-game action uses a dedicated `useSlayerAbility` Command containing the
Discussion step ID and expected event count, because a miss leaves that same step current. Rust
owns timing, actor and target validation, poison, explicit per-shot Recluse registration, the
computed outcome, and the derived spent/available projection.

`slayerAbilityUsed` is the auditable ability-spend event. It preserves actor, target, impairment,
registration, and outcome but never mutates life state. A successful shot generates a typed
`slayerDeath` follow-up; the target becomes dead only through a separate step-linked
`deathConfirmed` event. Replay recomputes every stored context from the prior event prefix and
restores both spent state and a pending Death after undo, reload, export, or import.

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

GameFile schema version 3 retains these event shapes introduced in schema version 2:

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

Event identities and ability-instance identities are opaque typed values in the Rust domain. Import
validates event IDs in stream order: IDs are non-blank and unique, and an event may reference only a
previously confirmed event except for an explicitly documented self-reference contract. The
checked-in TypeScript discriminator mirror is tested against Rust's command and event discriminator
constants so boundary validation cannot silently drift from the canonical contracts.

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

## Custom recovery routes (#248)

`/clocktower/custom/scenario/` opens authoring; `/clocktower/custom/grimoire/`
lists the existing autosaved sessions. `?mode=setup` denotes in-memory setup and
`?game=<game-id>` restores one exact saved game. Both HTML entries boot the same
custom application. In-app History API transitions carry validated authoring input
in memory; a cold setup route explains that setup was not saved and opens the list.
Only a successful first durable save replaces the setup URL with a game URL.

The existing `session:custom:<script-id>` records remain the persistence boundary.
Listing reads their names, actual game IDs and durable save times, isolating malformed
records. Exact-game restoration locates the slot, rereads it, replays the complete
stored snapshot, and checks it again before activation. A replaced game URL cannot
resume its successor. Listing and restoration do not save or change `savedAt`.
Root-page legacy history markers can resolve a slot into its new exact-game URL.

The application controller owns transition readiness and retires old request, setup,
play and writer ownership. Same-document browser back/forward waits for accepted saves;
failed saves keep the current route and in-memory state for retry. Cross-document Back,
reload and tab close request the browser's exit confirmation while a save or accepted
operation is pending or failed. Canceling preserves the current screen and retry path;
explicitly leaving or forced termination still restores only the last durable record.
Read-only restoration and a saved public reveal do not trigger this exit warning.
Durable activation does not cancel
a navigation waiting for that save. Public reveals stay closed on restore. Editor drafts,
pre-game setup and unconfirmed live inputs are not made durable by these routes.

The editor invalidates pending requests when hidden, and resumes interrupted order
calculation or validation on return using the same draft and requested reset mode.
Canceled file reads return to idle and cannot replace the draft with a late response.

The two custom HTML entries share a dedicated NetworkFirst cache key, independent of
game queries. A fetch after Service Worker activation warms that shell so soft navigation
can be reloaded offline. The URL still chooses the screen and local game at boot.
Official navigation caches and the no-global-navigation-fallback policy remain separate.

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
keys: latest:troubleBrewing, latest:sectsAndViolets, latest:badMoonRising
value: GameFile
```

```ts
type CustomScriptDefinition = {
  id: string;
  name: string;
  characterIds: string[];
  firstNightOrder: FirstNightActionRef[];
  otherNightOrder: FirstNightActionRef[];
};

type CustomScriptDefinitionDraft = {
  id: string;
  name: string;
  characterIds: string[];
  firstNightOrder?: FirstNightActionRef[];
  otherNightOrder?: FirstNightActionRef[];
};

type ScriptReference =
  | { type: "official"; scriptId: ScriptId }
  | { type: "custom"; definition: CustomScriptDefinition };

type GameFile = {
  schemaVersion: 4; // Official files. CustomGameFile uses schemaVersion: 5.
  exportedAt?: string;
  game: {
    script: ScriptReference;
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
};
```

IndexedDB stores one latest official `GameFile` per script without `exportedAt`. Official script
pages bind their storage driver to one script key, so navigation cannot replace another script's
latest game.
Existing official Trouble Brewing and Sects & Violets save, load, and legacy-migration behavior
remains unchanged; the required custom first-night order does not add a field to official game files.

Custom definitions and games use separate namespaced records in the same database and object
store:

```text
custom-definition:<encoded-stable-id> -> { version: 1, definition, metadata? }
session:custom:<encoded-stable-id>     -> { version: 1, customScriptId, savedAt,
                                            canonical, setupDraft, presentation }
```

The repository envelope keeps optional author/source metadata outside the runtime definition.
Saving an existing stable ID atomically replaces its complete definition envelope without touching
the corresponding game session. Unreadable definition and session records are reported separately
from missing records and cannot be overwritten by normal saves; only an explicit recovery/new-game
operation may replace them.

There is one active custom game session per stable ID. Its schema-v4 `GameFile.game.script` embeds
an immutable copy of the definition used when the game was created. Editing the repository record
therefore neither mutates nor deletes the active game. Resume is available only when the current
runtime definition exactly matches that embedded snapshot: stable ID, name, ordered Character IDs,
and both complete ordered night plans must all match. Repository metadata is excluded from this
comparison, and reverting the definition exactly restores resume eligibility. Explicitly starting
a new game replaces the active session for that stable ID.

The canonical definition in a stored custom repository record, session, or completed runtime always
contains both valid complete night orders. A missing order is invalid on load or resume and is not
filled from the authoring proposal or repaired by migration.

The definition repository prepares the WASM validator before opening IndexedDB transactions, then
validates explicit orders synchronously on save, load, list, and recovery. The adapter reuses the
Rust plan query's explicit-definition validation branch and rejects missing orders before calling
it; no proposed default is accepted or persisted. TypeScript checks JSON structure but does not
duplicate the Character action catalog. Validator initialization failures propagate as operational
errors rather than marking stored records unreadable.

Custom canonical sessions bind the controller, `GameFile`, replay output, game ID, and ordered event
IDs to the same complete script identity. Setup confirmation waits for a durable session write before
the live transition is published. Later writes coalesce to the newest meaningful snapshot; a failed
write keeps the newest canonical state in memory and is not retried until another meaningful change
is enqueued.

For a custom game, the canonical definition snapshot owns the required first-night order and
complete Character pool. The `setupConfirmed` event owns only the actual roster and seat
assignments. Later first-night events own confirmed action results and provenance (`actionRef` and
`abilityUse`) in the canonical event stream. The action projection, generated steps, and progress
remain replay-derived and are not copied into setup draft or presentation state. Custom Setup UI
remains separate UI/runtime work.

Export reads the stored `GameFile`, adds `exportedAt`, and writes JSON.

Import reads a `GameFile`, checks the basic JSON shape, schema version, and expected page script,
calls Rust `replay` to verify the complete event log, then replaces the script's stored game and
opens it. A schema-version-2 file without `scriptId` is interpreted as Trouble Brewing; schema v3
requires one known official `scriptId`. TypeScript normalizes both legacy forms to a schema-v4
official reference. Schema v4 requires exactly one `game.script` arm and rejects legacy
`game.scriptId`; a custom definition contains a non-blank ID and name plus an ordered, exactly
unique array of non-blank Character IDs plus both valid complete night orders (custom schema v5). Registry membership
is checked separately. A custom import with a missing or invalid order is rejected as a whole file;
import never fills the order from the authoring default, migrates it, or installs a successfully
replayed prefix or partial state. Schema version 1, script-aware version-2 files, wrong-script
files, and other invalid logs are rejected as whole files.

For migration, the Trouble Brewing driver checks the old `latest` key only when
`latest:troubleBrewing` is absent. It writes the normalized file to the new key after replay succeeds
and leaves the legacy value untouched. The Sects & Violets driver never reads the legacy key.

Only keep the latest stored game per script for MVP. Starting a new game or importing a game
replaces the current script's stored game after user confirmation.

Do not build a saved game list or merge imported events for MVP.

If the current stored game has confirmed events, starting a new game or importing a game must ask for confirmation before replacement.

Do not create automatic backup copies for MVP.

## Deferred

- Web Worker for the Rust core. Add only if replay/propose blocks the UI on real iPad hardware.
- Native wrapper such as Capacitor. Add only if PWA storage or lifecycle behavior becomes a real problem.
- Generic rules DSL. Out of scope for Trouble Brewing MVP.

## Custom scenario authoring and portable JSON (#197)

The Production landing composes `ScriptLanding.additionalChoice` with a lazy custom authoring
editor. The composition root owns the approved ink transition; custom components never import
an official UI helper, catalog, validator, or game runtime. Custom-owned presentation metadata
supplies labels, descriptions, and paths to static character artwork. Support membership and
kind still come exclusively from the generated custom catalog.

A portable scenario file is `{ type: "clocktower-custom-scenario", version: 2, scenario: {
name, characterIds, firstNightOrder, otherNightOrder } }`. This two-order contract is independent
of GameFile schema and repository versions. It contains neither the local definition ID nor
metadata, roster, events, or session state. Names and array order are preserved;
only the suggested download filename is sanitized. Unknown fields, unsupported versions, and
other file kinds are rejected rather than discarded or converted.

`ScenarioEditorController` owns the in-memory draft and its local ID, navigation, request
identities, and immutable validation snapshot. File reading produces a separate candidate;
only a successfully validated, still-current request can replace the draft. New authoring and
successful file imports use fresh local identities. No file operation reads or writes IndexedDB,
repository records, or game sessions. The UI does not pretend to start or resume a game; those
connections and stored-definition management remain #205.

`core/definition.ts` owns the existing definition parser, re-exported from `storage/gameFile.ts`
for current consumers. Authoring, file import, and existing persistence reuse this parser and
the existing WASM definition validator. The file codec owns only the envelope and conversion;
it has no character action catalog, exact-set validator, or automatic order repair. Operational
initialization failure is distinguished from invalid input. The current draft must have a matching
successful validation snapshot before serialization, so saving does not repeat domain validation.
Editing invalidates that snapshot; navigation alone does not. Snapshots and request counters are
not serialized as revisions.

The authoring query provides initial order, explicit reset, and the baseline for pool reconciliation.
An as-yet unnamed draft uses a query-only placeholder name; this never fills the draft's actual
name or permits exporting an unnamed definition. Reconciliation removes obsolete entries, preserves
survivors' relative order, and inserts each missing default entry before its first available default
successor. The result passes the same existing validator. Import never invokes this authoring path.

Browser delivery uses an already validated snapshot and a Blob download within the save gesture.
Feedback reports a requested download, not unobservable completion of a disk write. Failure and
cancellation preserve the draft. Repeated download and choosing the same file again are supported.

The next test stage covers the approved #197 black-box cases using Production WASM, custom
controller/file integration, and browser download/upload. Custom test configuration keeps Node
runtime tests separate from TSX/jsdom UI tests. Official pages, storage, PWA behavior, and custom
source isolation remain regression boundaries. No new rule-level test matrix is owned by #197.


## Custom grimoire presentation and scenario order (#220)

The custom Core owns executable occurrences, preparation dependencies, candidate validity,
registration judgments, and immutable reveal snapshots. The scenario definition owns regular
first-night order. Original Setup preparations are admitted at the action that declares them as prerequisites;
acquired/simulated ability preparations and invalidated preparations retain their causal
precedence. Replay alone admits an old leading Setup-preparation prefix, validating its original
source, owner, input and historical snapshot. New proposals cannot use that compatibility path.

`custom/grimoire/firstNightController` owns drafts, raw number text, selection handoff, proposals
and reveal state. `grimoire-custom/actions/registry` explicitly maps all 29 supported action references to input, selection, completion, reveal and cancellation adapters without scheduling them. `grimoire-custom/taskPresentationModel` adapts that state and Core
projections to identity, actor, ability, stage, editor, result, warnings and actions. The task and
board consume this model. Missing candidate contracts block confirmation instead of creating
raw fallback forms. Setup choices carry the correct reminder owner and registration provenance;
UI selection narrows those choices without reproducing character rules. Prepared delivery is
read-only; a Core-projected optional re-preparation reuses the same board editor.

`shared-ui` receives presentation values and callbacks, never official or custom runtime DTOs.
The official TB setup and scalar editors also consume the extracted setup and treatment controls.
Production automatic reminders remain character-owned; fixture builds do not call the production
reminder provider. Current board state and historical Spy payloads remain separate projections.

### Custom action executions and Undo (T13)

`first_night/execution.rs` resolves character-owned preparation/relationship sources and scheduler-recorded
`RunImmediately` admissions into replay-only execution membership. Matching requires the concrete owner,
ability instance and simulation source. Preparation consumers declare their prerequisites in `ActionSpec`;
the catalog contains keys and default order only. A pending consumer preview is an overview value, never
an executable scheduler admission. Confirmed snapshots freeze the relation at their event prefix.
Only the latest contiguous execution suffix can continue; an intervening independent event turns an older
source into a reference. Ordinary `JoinPendingOrder` acquisition does not join its origin's Undo unit.

The read-only DTOs are `PhaseStep.execution`, `ReplayState.actionExecutions` and `latestUndoUnit`.
The last confirmed event ID identifies an Undo unit, invalidating confirmations made before a child event.
The browser validates the complete event contents/IDs, game and definition before removing that suffix.
No execution metadata is persisted. Custom canonical GameFile uses schemaVersion 5; official GameFile remains version 4.
The controller awaits autosave before continuation or notification. Failed saves retain the confirmed prefix;
retry can restore a private notification prompt but never opens a public reveal automatically.

The original BMR Undo button is shared by BMR and custom, including its native confirmation and empty state.
New Scenario retires setup/play/writer/request ownership, remounts an empty authoring instance and clears only
the navigation marker. Existing save records are preserved until a new game's ordinary save replaces its slot.


### Custom repeated nights (#225)

The shared custom scheduler in `first_night/` runs both phases. `game.rs` selects the definition's
first-night plan during FirstNight and its other-night plan after a confirmed Day `beginNight`.
The latter admits dusk/dawn only as system boundaries, with the exact ordered/conditional action
set in `catalog.rs`. Ravenkeeper, Sage, Sweetheart, Scarlet Woman and Pit-Hag/Vigormortis effect
consequences are event-caused, not editable order entries. Barber is ordered when its opportunity
already exists, and immediate when a death occurs after its entry has passed.

`customOtherNightPlan` is an authoring-only query with the same explicit/default source contract
as `customFirstNightPlan`. Complete definitions require both arrays; runtime, import, storage and
resume never supply either default. The checked-in order and its source revision live together in
`catalog.rs`. Portable custom scenario files are v2 and custom game files are v5. Old custom formats
are rejected without migration or replacement of a valid stored session. Official codecs stay unchanged.

Occurrences add a replay-derived night number to semantic action, actual/simulated ability source
and cause. First-night IDs remain stable; later IDs start `night:<number>:`. New cycles reset cursor,
queues and completion membership while retaining confirmed history, ability provenance, spent uses
and rule-owned effects. Instant start-information acquisition may run outside the other-night plan;
ordinary acquisitions join pending entries or defer to their next eligible night. Demon replacements
created by an attack cannot attack again that night.

Night deaths retain their event source, original abilities, simulation guidance and impairment
snapshot. Character handlers decide which parts are frozen and which target eligibility is evaluated
at resolution. The same typed result is recomputed for proposal and replay validation. Prior reveals
come from confirmed snapshots; later identity changes never recalculate them. Daytime information
uses #223 participant/ability records, including their historical registration sources. At dawn,
existing daytime game-end confirmation handles a resolved win condition and blocks ordinary progress.

The existing execution/Undo calculator combines night history and all day histories in canonical
stream order. An immediate consequence shares its origin's contiguous Undo unit; a later independent
entry or new night's use does not. No queue, cycle plan, reveal recomputation policy or Undo grouping
is implemented in TypeScript. Input projections include legal Barber chooser and Imp successor IDs;
#222 owns their eventual visible controls and the other-night editor.

### Scheduled arbitrary night deaths (#232)

Newly authored custom definitions opt into `nightOrderVersion: 2`. The optional marker is part
of script identity and survives every definition/session/file boundary. Definitions without it
retain the original immediate `pitHag.chooseDeaths` execution and replay unchanged. Missing orders
are still invalid; replay never inserts or relocates an action. Portable scenarios with this marker
use version 3; legacy version 2 remains readable. Explicitly restoring the other-night order of an
old Pit-Hag scenario opts that authoring draft into version 2 and makes its changed definition
ineligible to resume the old game. Importing or continuing a stored game never upgrades it.

In version 2, a pool containing Pit-Hag requires exactly one `system.resolveNightDeaths` entry in
its other-night plan, after `pitHag.changeCharacter`. Authoring proposes it immediately after the
last Pit-Hag transformation or Demon attack in the default plan. Its position is editable; it does
not depend on Barber or an information character being present. Removing the last supported
source from the authoring pool removes the entry through the existing reconciliation mechanism.

The system action has an independent execution/Undo root. Registered character rules own its
same-night activation and sources; the shared death resolution validates living targets and
constructs the canonical death changes. A successful Demon creation activates
arbitrary deaths; attacks after activation keep their targets but do not immediately kill. The
scheduled confirmation records `nightDeathsResolved`, the selected players (including an explicit
empty list), and all creation event IDs. Validated fact changes retain the original character
occurrence as the death source, while each death's event ID is the new confirmation. Thus death
follow-ups belong to the scheduled confirmation, not to the earlier transformation or attacks.
Future source characters can share this execution/UI boundary while keeping their rules in their
own character module; no unimplemented character is enabled by this change.

Only actual confirmed deaths affect life state, effects, information, succession, or death-triggered
actions. Deaths and information confirmed before activation are never rewritten. An author who
places information before the resolution intentionally gets information about that earlier state;
its historical reveal stays immutable. The one scheduled resolution per night is an application
limit on the Storyteller's broader ability to adjust deaths throughout the night.


### Registered night-death sources and UI projections (#232 review)

`night_deaths.rs` dispatches character-owned `SourceRule` registrations from
`characters/mod.rs`. Each source declares its triggering action, preferred default
predecessors, and a pure query returning the actual confirmed source events. The
common plan builder derives required placement from those registrations; it does
not identify Pit-Hag or Demon attacks by name. Character rules own activation;
the shared resolution validates distinct living selections (including explicit
none), records all source IDs in canonical order, and preserves the earliest
source attribution and independent Undo boundary of the existing contract.
No speculative future character or generic rules language is introduced.

The authoring plan response can recommend a contract upgrade. Only an explicit
other-night reset accepts that recommendation and requests the upgraded plan;
ordinary edits, import and replay preserve the original definition. The authoring
UI does not inspect character IDs to decide upgrades.

Replay provides a read-only `nightDeaths` view with pending/resolved status,
confirmed source owners, and the exact attack event IDs awaiting resolution.
The browser formats that view; it no longer reconstructs activation from events
or edits result rows by comparing translated labels. This view is not persisted
and does not alter canonical game or scenario formats.

Action adapters declare an optional explicit-empty button and confirmation label.
The controller uses one empty-selection confirmation path, gated by the Core's
selection-count contract. Ordinary confirmation rejects empty input when a separate
empty button is configured; no character-name branch is needed. The task and board
consume the same adapter policy for skip/decline presentation.

Product UI tests that import `grimoire-custom` belong to the integration suite,
not the standalone `web/test/custom` suite. CI runs the affected UI tests and source
boundary check explicitly; isolation does not copy official UI to satisfy a test.

### Reference-only scenario characters

The custom editor and public reference document may include explicitly registered
reference-only characters (currently Deviant). Their build-time catalog is generated
from `characters/registry.rs` separately from the playable custom catalog. Definitions
retain these IDs across save/import and game creation, but resolved runtime contexts
exclude them: they cannot be assigned, acquired, transformed into, or scheduled for
night actions. The setup distribution and playable character catalog remain unchanged.
This authoring support does not enable Traveller gameplay or a manual fallback.
