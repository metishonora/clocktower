# Issue #133 — S&V ability validity and death-trigger timing

## Workflow checkpoint

- Phase: accepted
- Status: complete
- Approved: D1 — strict schema v3 canonical rejection; P1 — revised concrete production plan (2026-07-29)
- Open questions: none
- Branch: codex/issue-133
- Worktree: /private/tmp/clocktower-issue-133
- Test server: stopped after explicit acceptance
- Next action: merge the accepted issue branch into `develop`, push it, close the issue, and remove its worktree when requested

## Approved decisions

### P1 — Revised concrete production plan

On 2026-07-29, the user explicitly approved the concrete production change plan below. The issue
therefore advances to TDD implementation without another gate before acceptance preparation.

### A1 — User acceptance

On 2026-07-29, the user explicitly approved the acceptance build. The issue workflow is complete;
integration into `develop`, GitHub closure, and worktree removal remain pending.

### D1 — Strict canonical `NoEffect` validation within schema v3

On 2026-07-29, the user approved strict rejection of historical or forged non-canonical
`NoEffect` events that carry unused target, chooser, decision, or target-dependent audit fields.
The implementation will not normalize those events and will not introduce a schema v4 migration.
Structurally valid but non-canonical events must fail replay/import validation before any partial
state is applied. Existing canonical schema v3 events and permanent impairment events using
`expires: "never"` remain supported.

## Analysis

### Current behavior

- S&V derives Snake Charmer and Sweetheart event-backed impairment together with No Dashii and
  Vigormortis source-derived poison in `active_snv_impairments`.
- The derivation does not have one authoritative ability-validity query. No Dashii and
  Vigormortis each use a reduced source check that sees Snake Charmer poison but not Sweetheart
  drunk, while Vortox information policy checks only that a living current Vortox exists.
- Demon attacks and several active character actions independently repeat an
  `active_snv_impairments(...).any(player_id)` condition. Dead-Minon retention, reminders,
  madness, information, persistent poison, and Vortox policy consume related state through
  separate conditions.
- A `PendingDeathConsequence` correctly records `actor_impaired_at_trigger`, the source ability
  instance, and trigger identity. Sweetheart resolution uses that snapshot. Barber and Klutz
  additionally re-check the actor's current character/ability instance or current impairment,
  which can retroactively cancel a healthy trigger.
- Sweetheart `NoEffect` events can retain an unused target. Barber `NoEffect` events always retain
  a decision and may retain a chooser. Rust replay validates the computed outcome but does not
  require one canonical no-effect payload shape; TypeScript validation likewise permits the
  unused fields.
- `ActiveImpairment.expires` has only `never`, so event-backed permanent impairment and derived
  poison that lasts only while a source ability functions are indistinguishable on the replay
  contract.

### Requested outcome and invariants

- Build one S&V-local ability-validity/index path. Compute event-backed base impairment first,
  derive No Dashii/Vigormortis effects only from functioning sources, and let attacks,
  information, retained abilities, persistent effects, reminders, and Vortox policy consume the
  same result.
- Keep Sweetheart/Snake Charmer impairment attached to the player across character changes.
- Treat the trigger snapshot as the only impairment/ability-identity decision for Sweetheart,
  Barber, and Klutz after a trigger exists. Resolution-time state may still determine live target
  and chooser eligibility where the rule intrinsically requires current state, but it must not
  erase the trigger.
- Make proposal, event validation, replay, undo, and export/import converge on the same result and
  reject tampered consequences.
- Emit canonical no-effect events with no unused target, chooser, or decision fields.
- Preserve `expires: "never"` for persisted permanent impairments and add an explicit
  `whileSourceAbilityActive` lifetime for derived No Dashii/Vigormortis replay projections. This
  adds a wire enum variant without changing old event JSON.

### Scope and non-goals

- Owned here: S&V domain behavior, S&V event/replay contract validation, the thin TypeScript wire
  validator/types affected by the contract, consequence controls that currently infer the wrong
  resolution-time cancellation, character regressions, and the #111 acceptance manifest link if
  present.
- Not owned here: Trouble Brewing generalization, Vortox legal-false-domain/UI/no-execution win
  behavior from #109, broad combination acceptance from #111, or drunk/poison token display.
- No new general rules DSL or cross-script abstraction will be introduced. The authoritative
  query remains in `characters/sects_and_violets.rs` in accordance with `ARCHITECTURE.md`.

### Dependencies and ownership boundaries

- `crates/domain/src/characters/sects_and_violets.rs`: source-of-truth S&V index/query,
  consequence trigger/resolution rules, proposal and replay validation, derived projection and
  reminders.
- `crates/domain/src/contracts.rs`: optional canonical no-effect fields and the derived impairment
  lifetime enum variant.
- `crates/domain/src/tests/*`: public `propose_json`/`replay_json` character-level and forged-event
  regressions. Existing #101/#103/#104/#110-era fixtures remain regression dependencies.
- `web/src/core/types.ts` and `web/src/core/validation.ts`: exact wire shape and new lifetime.
- `web/src/features/death-consequences/DeathConsequencePanel.tsx` and focused tests: stop treating
  current character/ability/impairment as a reason to disable a healthy Barber trigger.
- `docs/acceptance/sects-and-violets-official-examples.md` or the #111 manifest: link only the
  smallest cross-character fixtures required by the issue.

### Prototype decision

Skipped. This issue corrects domain and contract behavior and removes an incorrect UI inference;
it introduces no placement, copy, visual-state, or interaction-design choice needing visual
approval.

### Compatibility direction

- Existing persisted Snake Charmer/Sweetheart events using `expires: "never"` remain valid.
- Derived No Dashii/Vigormortis impairments are replay output, not persisted source events, and
  begin serializing as `whileSourceAbilityActive`.
- Consequence event fields become optional so existing effective (non-`NoEffect`) events keep
  their current JSON. New `NoEffect` proposals omit unused fields. Replay applies strict canonical
  validation, so old or forged non-canonical `NoEffect` events with unused fields fail validation
  instead of being silently normalized. This is intentional hardening within schema v3 and will be
  covered explicitly by import/replay tests.

## Acceptance criteria

1. A single S&V-local ability-state/index path answers whether a player's current ability functions
   for the requested use timing. It owns identity, activity/liveness, retained dead-Minion ability,
   and impairment checks; character call sites do not duplicate `drunk || poisoned` logic.
2. Event-backed Snake Charmer/Sweetheart impairment is calculated first. Functioning No Dashii and
   Vigormortis sources then add derived poison without a derived-effect feedback loop.
3. A Sweetheart-impaired No Dashii produces no neighbor poison; a Sweetheart-impaired Vigormortis
   retains no dead-Minion ability and produces no poison; a Sweetheart-impaired Vortox produces no
   global false-information policy. The corresponding healthy behavior remains intact.
4. Demon attacks, active night abilities, information actors, madness sources, reminders,
   Vigormortis retention/poison, No Dashii poison, and Vortox policy consume the same authoritative
   result or a projection created by it.
5. Sweetheart, Barber, and Klutz effectiveness is fixed at the specified trigger. A healthy trigger
   remains resolvable after current impairment or character/ability-instance change. A trigger
   that was already impaired produces no effect. Night Klutz still snapshots only when deaths are
   announced; day Klutz snapshots at death.
6. Multiple simultaneous Sweetheart/Barber/Klutz consequences have deterministic death-sequence
   ordering, and resolving an earlier consequence cannot retroactively change a later trigger.
7. New no-effect events use one canonical payload shape: Sweetheart omits target; Barber omits
   chooser and decision; Klutz omits target and target-dependent audit fields if its trigger was
   already impaired. Effective variants carry exactly the inputs used to compute them.
8. Proposal and prefix-based replay validation independently recompute the same result. Forged
   reason, target, chooser, decision, identity transition, trigger reference, or outcome is rejected.
9. Permanent event-backed impairments continue to serialize as `never`; No Dashii/Vigormortis
   projections serialize as `whileSourceAbilityActive`. Undo and JSON export/import reproduce the
   same pending consequences, impairment projection, identities, and outcomes.
10. Character-level black-box coverage exists for Sweetheart, No Dashii, Vigormortis, Vortox,
    Barber, and Klutz with at least one healthy and one impaired case. Common-query tests and a
    cross-character ordering fixture remain separate layers.
11. Barber coverage includes decline, multiple living Demon chooser validation, the Demon swapping
    themself, dead Barber/Snake Charmer participants, Vigormortis/dead Sweetheart participants, and
    no-living-Demon no effect. Klutz coverage includes evil Klutz choosing evil for a good win and
    both day and announced-night triggers.
12. Existing S&V behavior, replay performance bounds, TypeScript wire validation, and production
    build remain green; no Trouble Brewing behavior or drunk/poison token UI is changed.

## Architecture and data flow

### S&V ability state

Introduce one internal S&V derived ability-state/index in
`crates/domain/src/characters/sects_and_violets.rs` (the exact private type/helper names may be
chosen during refactoring). It is constructed from one event prefix and its replayed players:

1. Collect event-backed base impairment from Snake Charmer and Sweetheart consequence events.
2. Evaluate continuous Demon sources against current identity, ability instance, liveness/activity
   policy, and base impairment.
3. From only those functioning sources, project No Dashii neighbor poison and validate recorded
   Vigormortis kill/ability-instance effects. This phase also derives dead-Minion retention and
   Vigormortis poison-choice state.
4. Combine base and derived impairment for consumer queries and replay output.

The bootstrap source predicate is private to index construction, not a competing consumer API.
It cannot depend on derived impairment: No Dashii/Vigormortis derived effects target Townsfolk,
while their source must currently be a Demon. This invariant is documented and tested so a future
character cannot accidentally introduce recursive projection.

The consumer query accepts the player, expected character/ability instance where relevant, and
ability-use timing (ongoing/active versus death trigger). This prevents callers from separately
combining identity, alive, retained ability, and impairment checks. Death-trigger recording asks
the query against the event prefix at the defined trigger and stores the result in
`actor_impaired_at_trigger`; consequence resolution never asks current ability validity again.

Build and pass the index at existing replay/proposal prefix boundaries instead of rebuilding it for
each consumer. Prefix validation may construct one index per historical event prefix, but should
not add a nested full-log scan per player; the existing issue #130 pass-count/long-session checks
remain the performance guardrail.

### Consequence snapshots and ordering

- Keep `DeathTriggerRef` and `source_ability_instance_id` as the immutable trigger identity.
- Add an internal, non-serialized `actor_alignment_at_trigger` value to
  `PendingDeathConsequence`. Klutz proposal and replay validation use this snapshot when computing
  the losing/winning team instead of reading the actor's mutable resolution-time identity.
  Do not add persisted pending state; replay rebuilds every pending consequence from confirmed
  events.
- Sweetheart and Barber snapshot at the death source event. Day Klutz snapshots at its death event;
  night Klutz snapshots at `NightDeathsAnnounced`.
- Sort by source-event order and `death_sequence`, preserving the existing typed trigger identity.
  Consequence events resolve one exact pending item. Later pending items retain their recorded
  snapshot even if the earlier outcome changes characters or applies impairment.
- Current state remains authoritative only for genuinely resolution-time inputs: a selected target
  must currently satisfy its rule and Barber's chooser must be one of the living eligible Demons
  recorded/derived for that pending opportunity. It is not used to re-check the dead source's
  character, ability instance, or impairment.

### Public contracts and canonical payloads

- Make Barber command `decision` and Klutz command `targetPlayerId` optional only so the UI can
  confirm a trigger-time no-effect without inventing a decline or empty target. Proposal rejects
  either missing value when the pending consequence is effective.
- Make consequence-event target/chooser/decision and Klutz target/alignment audit fields optional
  at deserialization and serialization boundaries. Proposal emits and replay enforces these exact
  combinations:
  - Sweetheart `drunkApplied`: target plus matching impairment; `noEffect`: neither.
  - Barber `declined`/`swapped`/same-character: eligible chooser plus matching decision;
    `noEffect`: neither chooser nor decision.
  - Klutz `safe`/team-loss: target plus trigger actor alignment and current target alignment;
    trigger-impaired `actorImpaired`: no target or alignment fields. The existing outcome spelling
    is retained; no new schema variant is introduced.
- Remove `actorImpairedAtResolution` and `sourceAbilityLost` from accepted event reasons. They are
  neither generated nor replayable. `actorImpairedAtDeath` remains the persisted spelling for the
  trigger snapshot, and `noLivingDemon` remains valid for Barber.
- Add `whileSourceAbilityActive` to `ImpairmentExpiry` and the TypeScript `ActiveImpairment` union.
  `never` remains the persisted permanent spelling for compatibility.
- TypeScript exact-key validation mirrors Rust's canonical variants so a file cannot pass the web
  boundary but fail later solely because the two contracts disagree.

### Error and recovery behavior

- Missing or ineligible inputs for an effective consequence return the existing compact invalid
  step-input error; stale pending step/event counts retain the existing stale-state errors.
- A structurally malformed canonical event fails parsing. A structurally valid but state-forged
  event fails S&V replay validation. Neither path partially applies the event.
- Undo is event removal followed by replay, so trigger snapshots and derived ability state recover
  without a new persistence mechanism.
- Import/export remains schema v3. Permanent historical impairment events continue to parse.
  Historical non-canonical no-effect events with now-unused fields are deliberately rejected rather
  than normalized, because normalization would also make forged events replayable. The acceptance
  handoff will call out this hardening explicitly.

## Concrete production change plan

### 1. Lock the current bugs at the public JSON boundary

Create `crates/domain/src/tests/issue133_ability_validity_scenarios.rs` and register it in
`crates/domain/src/tests.rs`. The first Red batch will use only `propose_json` and `replay_json`:

1. Resolve a healthy Sweetheart death against No Dashii, Vigormortis, and Vortox, then assert that
   the drunk Demon produces no neighbor poison, retained Minion ability/reminder, Vigormortis
   poison choice, or Vortox delivery reason.
2. Create healthy Barber and Klutz triggers, then place character/impairment-changing consequence
   events before their resolution; assert the pending opportunity and normal result remain.
3. Trigger already-impaired Barber and Klutz cases and assert the proposed event contains no
   unused chooser, decision, target, or alignment fields.
4. Forge each forbidden field/reason/outcome against an otherwise valid prefix and assert
   `replay_json` returns `REPLAY_FAILED`.

Each case is run independently before production edits and its expected current failure is
recorded in this document.

### 2. Replace scattered impairment checks with one S&V ability-state projection

In `crates/domain/src/characters/sects_and_violets.rs`, replace the current independent
`active_snv_impairments`, `vigormortis_poison_state`, `vigormortis_keeps_minion_ability`, and
`player_has_active_ability` decisions with one private projection built from `(players,
event_prefix)`:

1. Collect base event-backed impairment from Snake Charmer and Sweetheart only.
2. Against that base set, determine whether each current source has the expected character,
   ability instance, liveness policy, and no impairment.
3. Only functioning No Dashii sources add neighbor poison. Only functioning Vigormortis sources
   validate recorded kill effects, retain the killed Minion ability, add poison, and expose a
   pending poison retarget choice.
4. Expose consumer operations for `ability functions`, `player is impaired`, active impairment
   projection, retained Minion ability, and pending Vigormortis choices. No consumer reconstructs
   `drunk || poisoned` itself.

The source bootstrap deliberately reads only base impairment; derived No Dashii/Vigormortis poison
cannot feed back into Demon-source validity. Derived impairment serializes with
`whileSourceAbilityActive`; Snake Charmer/Sweetheart remain `never`.

Migrate every current consumer in the same file:

- `madness_assignments` source effectiveness;
- phase-step inclusion and retained dead-Minion wake/reminder logic;
- `active_information_reasons`, including a Vortox reason only when that living Vortox ability
  functions;
- demon attack, Snake Charmer, Pit-Hag, and other active ability proposal/replay checks;
- `record_death_triggers` trigger-time snapshotting;
- final replay `activeImpairments`, Vigormortis pending choices, and automatic reminders.

The completion review will use `rg active_snv_impairments` and the current duplicated
`impairment.player_id == actor.id` patterns; no call site may retain an independent effectiveness
decision outside the projection builder.

### 3. Make death consequences depend on their trigger snapshot

Update `record_death_triggers` to record impairment and actor alignment from the exact required
prefix: Sweetheart/Barber at the death event, day Klutz at death, and night Klutz at
`NightDeathsAnnounced`.

Then change both proposal and replay validation together:

- `propose_barber_consequence` and the Barber branch of
  `validate_death_consequence_event` stop reading the actor's current character, ability instance,
  or current impairment. They use only `actor_impaired_at_trigger`; an empty recorded chooser set
  remains the separate `noLivingDemon` case.
- `propose_klutz_consequence` and its validator stop adding current actor impairment to the trigger
  snapshot. Effective outcomes use `actor_alignment_at_trigger`; only selected-target liveness and
  alignment are read at resolution.
- Sweetheart keeps its existing trigger-time behavior, but its validator now recomputes the exact
  target/impairment tuple instead of accepting any `drunkApplied` payload.
- `unresolved_death_consequences` keeps source-event order plus `death_sequence`; regression tests
  prove that resolving an earlier Sweetheart/Barber/Klutz item does not rewrite a later snapshot.

### 4. Enforce one canonical event shape in Rust

In `crates/domain/src/contracts.rs`:

- add `ImpairmentExpiry::WhileSourceAbilityActive`;
- make Barber event `decision` optional;
- make Klutz event target and both alignment audit fields optional;
- make the corresponding Barber/Klutz command inputs optional for the no-effect command path;
- remove the resolution-time/source-lost no-effect reasons from accepted serialized values.

In `propose_sweetheart_consequence`, `propose_barber_consequence`, and
`propose_klutz_consequence`, construct the event fields from the computed outcome rather than
copying the command payload. No-effect construction explicitly writes `None`; effective
construction requires and writes every used field.

In `validate_death_consequence_event`, validate both state and field presence. A forbidden extra
field, missing effective field, mismatched impairment, chooser, transition, alignment, trigger, or
reason fails before `apply_player_event`. Schema remains v3; no normalization or migration path is
added under D1.

### 5. Mirror the exact contract and remove UI fallback data

In `web/src/core/types.ts` and `web/src/core/validation.ts`, mirror the Rust optional fields,
`whileSourceAbilityActive`, allowed reasons, and outcome-specific exact keys. Extend
`web/src/core/validation.test.ts` with accepted canonical shapes and rejection cases for every
unused field.

In `web/src/features/death-consequences/DeathConsequencePanel.tsx`:

- determine no effect from `actorImpairedAtTrigger` for all three consequence kinds and from an
  empty Barber chooser snapshot;
- remove current actor character/ability/current impairment from Barber no-effect calculation;
- remove the unused `activeImpairments` prop;
- send an empty resolution for no effect instead of a fake Barber decline.

In `web/src/sectsAndVioletsGame.tsx`, stop filling absent Barber decisions with `decline` and absent
Klutz targets with an empty string. Add a focused panel/command-construction test proving a healthy
trigger still opens selection after the actor changes, while a trigger-impaired consequence sends
the target-free command.

### 6. Finish character and persistence coverage

Keep character-level healthy/impaired cases discoverable by character name. Reuse existing
`issue103_death_consequence_scenarios`, `sects_and_violets_demon_attack_scenarios`, and
`issue96_sects_and_violets_information_scenarios` fixtures where they already cover healthy
behavior; add new #133 tests for the missing impaired half rather than duplicating setup helpers.

Add explicit replay-prefix/undo and serialize-then-reparse assertions for pending consequences,
permanent and source-bound impairment lifetimes, and strict rejection of old non-canonical
no-effect payloads. Link only the simultaneous cross-character regression into the #111 acceptance
inventory.

## TDD and verification map

### Recorded TDD Red results

- 2026-07-29: `cargo test -p clocktower-domain issue133 -- --nocapture`
- Result: 3 intended failures, 0 fixture/parsing failures.
- `sweetheart_drunk_no_dashii_stops_poisoning_neighbors` failed because No Dashii poison remained.
- `sweetheart_drunk_vigormortis_stops_retaining_and_poisoning_from_an_existing_kill` failed because
  Vigormortis poison remained (the reminder assertion was not yet reached).
- `sweetheart_drunk_vortox_stops_forcing_false_townsfolk_information` failed because the Vortox
  delivery reason remained active.
- 2026-07-29: the second Rust Red batch failed because healthy Barber was cancelled by current
  impairment and target-free Barber/Klutz commands were rejected as malformed. The matching Green
  run passed all 6 focused tests after trigger-snapshot and optional-command changes.
- 2026-07-29: the lifetime Red batch failed because No Dashii/Vigormortis projections serialized
  `expires: "never"`. The matching Green run passed after introducing
  `whileSourceAbilityActive` for source-derived projections only.
- 2026-07-29: TypeScript validation Red rejected `whileSourceAbilityActive` and canonical
  target-free Barber/Klutz events. The focused Green run passed 27/27 validator and
  death-consequence policy tests after the exact-shape contract and command builder changes.

### Recorded focused Green results

- `cargo test -p clocktower-domain issue133 -- --nocapture`: 11 passed.
- `cargo test -p clocktower-domain sects_and_violets_demon_attack_scenarios -- --nocapture`:
  10 passed.
- `cargo test -p clocktower-domain issue103 -- --nocapture`: 6 passed.
- `cargo test -p clocktower-domain`: 276 passed, including the issue #130 long-session budgets.
- Direct TypeScript unit compilation plus focused Node tests: 27 passed; full web TypeScript build
  completed after providing the generated WASM module path in the isolated worktree.

### TDD Red — public behavior first

Add `crates/domain/src/tests/issue133_ability_validity_scenarios.rs`, registered from
`crates/domain/src/tests.rs`, using only `propose_json` and `replay_json`. Write the smallest
independently runnable failing cases before production edits:

1. Sweetheart-drunk No Dashii has no derived neighbor poison and exposes no active source lifetime.
2. Sweetheart-drunk Vigormortis loses both retained dead-Minion ability/reminder and poison; a
   forged replay that retains either result fails.
3. Sweetheart-drunk Vortox leaves healthy Townsfolk information truthful/fixed rather than applying
   a Vortox delivery reason.
4. A healthy Barber trigger remains effective after current impairment and after an ability-instance
   or character change; a trigger-impaired Barber emits canonical no effect.
5. A healthy Klutz trigger remains effective after those resolution-time changes; a
   trigger-impaired Klutz emits canonical no effect without unused target data.
6. Simultaneous Sweetheart/Barber/Klutz triggers preserve recorded order and snapshots when earlier
   consequences are resolved first.

Run each new test by fully qualified name and confirm it fails on the intended current behavior,
not fixture setup or parsing. Existing healthy attack, No Dashii, Vigormortis, Vortox, Barber, and
Klutz tests are run alongside Red tests to establish the baseline.

### Character and contract coverage after Green

- Add or split clearly named character-level cases so each of the six characters has healthy and
  impaired coverage discoverable by test name.
- Add focused private query/index unit tests only after the public tests pass, covering base-first
  construction, source-instance invalidation, non-recursion, and lifetime projection. These do not
  replace character behavior tests.
- Extend consequence forgery tests for every canonical shape and reason, including unused fields,
  mismatched trigger, changed identity transitions, and proposal-impossible outcomes.
- Extend undo/prefix replay tests and serialize/reparse the complete JSON fixture to cover
  export/import equivalence.
- Add web validator tests for both lifetime values and exact consequence shapes. Add a focused
  `DeathConsequencePanel` interaction test proving only trigger-time impairment (or no living Demon)
  shows the no-effect action; current actor character/impairment no longer cancels a healthy trigger.
- Link the smallest simultaneous/cross-character regression to the #111 acceptance inventory;
  do not duplicate #111's full matrix.

### Regression commands

Focused iteration:

```sh
cargo test -p clocktower-domain issue133
cargo test -p clocktower-domain issue103_death_consequence_scenarios
cargo test -p clocktower-domain sects_and_violets_demon_attack_scenarios
cargo test -p clocktower-domain issue96_sects_and_violets_information_scenarios
pnpm --dir web test -- DeathConsequencePanel
```

Required final checks:

```sh
cargo test --workspace
pnpm --dir web test
pnpm --dir web build
```

Review the complete diff after the suites, then make a dedicated correctness pass for omitted
impairment consumers, projection recursion, source ability-instance matching, trigger ordering,
forged replay, character/alignment changes, old `never` imports, and accidental Trouble Brewing or
UI-copy changes.

## Implementation results

- One private `SnvAbilityState` now owns base Snake Charmer/Sweetheart impairment, source-gated No
  Dashii/Vigormortis projections, retained dead-Minion abilities, pending Vigormortis poison
  choices, impairment lookup, and active-ability lookup. Searches found no remaining consumers of
  the removed parallel helper APIs.
- Sweetheart, Barber, and Klutz proposal/replay validation now use the trigger snapshot. Canonical
  trigger-impaired events omit all unused fields, and Rust plus TypeScript reject forged extras.
- The web consequence panel and command builder no longer infer current actor cancellation or fill
  missing Barber/Klutz inputs. Empty Barber chooser lists are now always present in replay output,
  fixing a Rust/web boundary mismatch found during the high-risk review.
- Permanent event-backed impairment remains `never`; No Dashii/Vigormortis replay projections use
  `whileSourceAbilityActive`. The acceptance inventory links the cross-character #133 regression
  to #111.

### Final verification (2026-07-29)

- `cargo test --workspace`: 278 domain tests and 4 WASM adapter tests passed; doc tests passed.
- `pnpm --dir web test`: 116 compiled Node unit tests and 408 Vitest integration tests passed
  across 79 files.
- `pnpm --dir web build`: TypeScript build, current Rust WASM optimization, Vite production build,
  and PWA generation passed.
- `cargo fmt --all -- --check` and `git diff --check`: passed.
- Implementation commit `6f732ab` (`Fix S&V ability validity and trigger timing`) was pushed to
  `origin/codex/issue-133` before acceptance setup.

### Final review findings

- Verified base impairment is computed before derived poison and the source bootstrap cannot read
  its own derived projection.
- Verified Vigormortis effects require the current source ability instance and stop retention,
  poison, reminders, and pending retarget choices when the source is impaired.
- Verified trigger identity, death sequence, alignment snapshot, selected target/chooser, outcome,
  and canonical optional fields are independently recomputed at replay prefixes.
- Verified old permanent `never` values remain accepted, old non-canonical no-effect fields/reasons
  are intentionally rejected under D1, Trouble Brewing files are unchanged, and no new UI copy was
  introduced.

## Expected files

- `crates/domain/src/characters/sects_and_violets.rs`
- `crates/domain/src/contracts.rs`
- `crates/domain/src/tests.rs`
- `crates/domain/src/tests/issue133_ability_validity_scenarios.rs` (new)
- existing character scenario files where splitting/strengthening coverage is clearer than
  duplicating helpers
- `web/src/core/types.ts`
- `web/src/core/validation.ts`
- `web/src/core/validation.test.ts`
- `web/src/features/death-consequences/DeathConsequencePanel.tsx`
- `web/src/sectsAndVioletsGame.tsx`
- a focused death-consequence panel/command test (new if no suitable existing seam exists)
- `docs/acceptance/sects-and-violets-official-examples.md` or the #111 manifest linkage
- this plan document

## Rollout risks

- A second ad-hoc impairment predicate would preserve the original bug under a new name; the diff
  review will search all S&V consumers.
- Derived poison feeding source validity would create order-dependent recursion; construction phases
  and a dedicated unit test guard it.
- Recomputing the index in inner loops could regress long-session replay; issue #130 performance
  assertions and the full workspace suite guard it.
- Canonical event-field optionality can drift between Rust and TypeScript; paired exact-shape tests
  guard both boundaries.
- Trigger-time impairment and resolution-time target eligibility can be conflated; tests vary them
  independently.
- Strict rejection of historical non-canonical no-effect events is a compatibility tradeoff. It is
  preferred here over a permissive migration because the issue explicitly requires forged events
  to be unreplayable.
