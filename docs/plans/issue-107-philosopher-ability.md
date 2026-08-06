# Issue 107: Philosopher ability acquisition and duplicate drunkenness

## Workflow checkpoint

- Phase: production implementation verified; awaiting acceptance
- Rule refinement: complete
- Prototype review: approved
- Dependencies: #133, #137, and #108 complete
- Open rule questions: none
- Open UI questions: none
- Branch: `codex/issue-107-prototype`
- Worktree: `/private/tmp/clocktower-issue-107`
- Next action: production acceptance on the issue test server.

## Stable rule contract

### Selection and use

- An unspent Philosopher ability instance wakes every Night, including the First Night.
- The legal catalog is all 17 good S&V characters: 13 Townsfolk and 4 Outsiders. It includes
  Mathematician and Philosopher.
- Deferring ends only the current Philosopher step. It does not consume the once-per-game use and
  the same ability instance receives a new selection step on the next Night.
- Selecting a character consumes that Philosopher ability instance even when the Philosopher is
  drunk or poisoned.
- A healthy selection creates one granted ability instance owned by the Philosopher Player. It
  grants an ability only: actual Character, shown Character, alignment, registration and identity
  history remain Philosopher.
- A drunk or poisoned selection records the selected Character and exact impairment evidence as a
  `noEffect` resolution. It creates no grant or duplicate drunkenness. Later recovery does not
  restore the consumed selection.
- Resurrection creates a new base Philosopher ability instance under #129 and therefore a new
  once-per-game opportunity. An earlier grant is not reused.

### Self-selection

- Philosopher is a legal catalog entry.
- Selecting Philosopher records `selfDrunk`, consumes the use and creates no recursive grant.
- The Player becomes a drunk Philosopher with no remaining Philosopher selection or granted-
  ability action for that base ability instance.
- Self-drunk is tied directly to the selection event and base Philosopher ability instance. It is
  not derived through a grant, so it cannot create a source-ability feedback loop.
- It ends when that Philosopher ability instance ends through Character change or death. A later
  resurrection receives a new instance and is not self-drunk from the previous event.
- The official self-drunk result is not Mathematician abnormal behavior.

### Ability identity and ownership

- Keep `Player.abilityInstance` as the Player's current base Character ability instance.
- Add a replay-derived `AbilityGrant` for each healthy Philosopher acquisition. The stable fields
  are owner Player, granted Character, acquisition event, source Philosopher ability instance and
  an independent granted ability-instance ID.
- Use one typed `AbilityUseRef { ownerPlayerId, characterId, abilityInstanceId }` for both base and
  granted abilities at phase steps, information records, day actions, triggers and Mathematician
  audit boundaries.
- Expose active grants in replayed rules state; never persist a parallel UI copy.
- One base Philosopher ability instance can have at most one healthy grant.
- Commands, proposal and replay independently reject a forged owner, illegal Character, spent or
  stale base instance, mismatched outcome and unknown granted ability instance.

### Duplicate drunkenness and lifetime

- If the selected Character is currently in play, its unique actual holder is drunk while the
  source Philosopher ability is active.
- If it is not in play, there is no immediate drunk target. If that actual Character later enters
  play, its holder automatically becomes drunk.
- A holder who changes Character immediately becomes sober. A later unique holder becomes drunk.
- Dead Characters remain in play, so holder death alone does not remove duplicate drunkenness.
- Source Philosopher death or Character change ends the grant and duplicate drunkenness.
- Source Philosopher drunk or poisoned temporarily disables the grant and makes the original
  holder sober; recovery reactivates both.
- Other drunk or poisoned sources remain independent. A Player becomes healthy only after every
  active impairment source is gone.
- Default S&V has one actual holder for the selected good Character. Custom-script duplicate
  Character selection and target choice are out of scope.

### Ability execution

- Granted abilities use the same script-owned resolver and validation path as the base Character.
  Do not clone calculations or create Philosopher-specific manual fallbacks.
- Same-Night scheduling follows the existing S&V acquisition metadata:
  `StartKnowingImmediately`, `WakeIfOrderPending`, `TriggerIfEligible`, or `NextPhase`.
- Clockmaker executes immediately on the acquisition Night. Dreamer, Snake Charmer,
  Mathematician and other ordered Night abilities run only when their official wake position is
  still pending. Day actions and death triggers use their existing eligible boundary.
- Once-per-game state belongs to the granted ability instance. Artist, Seamstress and Juggler do
  not spend or reset the base Philosopher instance when they act.
- Healthy death-trigger effectiveness is snapshotted before source Philosopher death deactivates
  duplicate drunkenness. Sweetheart, Barber, Klutz and Sage then reuse their existing pending
  consequence or information paths.
- A drunk original holder's matching death trigger is an impaired no-effect.
- Philosopher-Mathematician reuses #108's calculation, delivery, Vortox validation, evidence and
  automatic reminder path. Each Mathematician actor excludes only its own ability-instance
  resolution.

## Canonical contract

### Command and event

- Reuse `confirmStep` with `input.characterIds` containing exactly one legal Character.
- Reuse `skipStep` for the visible defer action, but propose a typed Philosopher resolution rather
  than a generic skipped event.
- Add additive schema-v3 event `philosopherAbilityResolved` with:
  - `stepId`;
  - base Philosopher `AbilityUseRef` actor;
  - optional `selectedCharacterId` (absent only for defer);
  - exact tagged outcome `deferred`, `acquired`, `selfDrunk`, or `noEffect`;
  - `acquired` granted ability-instance ID;
  - `noEffect` trigger-time active impairment evidence.
- The event ID is the acquisition source. Replay derives the active grant, spent state,
  impairments, reminders and generated steps from the confirmed stream.
- Existing schema-v3 files replay unchanged. Event import validates all references from the prior
  prefix and rejects unknown fields.

### Replay projections

- `PhaseStep.abilityUse` identifies the exact base or granted ability instance acting.
- `RuleState.abilityGrants` exposes replayed active grants.
- `RuleState.activeImpairments` exposes Philosopher-source drunk effects with source event,
  source Character and the existing source-active lifetime semantics.
- `RuleState.automaticReminders` derives official `철학자임` and `취함` tokens:
  - selected Character out of play: `철학자임` belongs to the Philosopher seat;
  - selected Character in play: no `철학자임`; `취함` belongs to the original holder;
  - self-selection: only `취함` belongs to the Philosopher seat.
- Actual/shown Character never changes in canonical Player state because of acquisition. The
  acquired-Character token swap is a Grimoire presentation rule, not an identity transition or
  Reveal.

## Approved production UI

### Progress surface

- Use the current develop S&V shell and existing current-step layout.
- Before selection show Philosopher icon, Character name, Player name, Philosopher summary, one
  compact 17-Character select, primary `선택 확정`, and secondary `이번 밤 보류`.
- After healthy acquisition keep Philosopher as the actor. Remove the Philosopher summary and show
  one acquired-ability card containing the acquired Character icon, name and official summary.
- Later acquired-ability actions use the same actor/acquired-ability split.
- Do not show binary `취함 없음/있음` explanatory copy.
- Self-selection uses the same Philosopher identity and standard `취함` influence badge/layout as
  any other drunk actor, followed by the Philosopher summary. It has no acquired-ability card.

### Grimoire and tokens

- Reuse develop's `PlayerTokenCountBadge`, Player detail dialog and complete reminder-token
  presentation. Do not render full tokens beside seats.
- When the selected Character was out of play, visually show that Character at the Philosopher
  seat and attach `철학자임 · 출처 철학자`. The underlying Player identity remains Philosopher.
- When the selected Character was in play, keep the Philosopher token at the Philosopher seat and
  attach only `취함 · 출처 철학자` to the original holder.
- Self-selection keeps the Philosopher token and attaches only `취함 · 출처 철학자` there.
- Seat surfaces show only the standard inward `+N` badge. Complete source icon, source Character
  and reminder label appear in Player details.
- Use existing event-log summary and Undo interaction. Do not add a Philosopher-specific Undo
  confirmation surface.

### Rejected prototype directions

- Additional rules explanations or status paragraphs in the live step.
- Separate `취함 없음/있음` status rows.
- Full custom reminder tokens positioned outside a seat.
- Replacing the Philosopher seat with an in-play acquired Character or attaching `철학자임` in
  that case.
- A duplicate-Character target chooser for baseline S&V.
- Any identity Reveal caused only by acquiring an ability.

## Behavioral acceptance criteria

1. The unspent Philosopher step exposes exactly the 17 good S&V Characters and deferral returns on
   the following Night without spending the base instance.
2. A healthy out-of-play Dreamer selection records one grant, keeps canonical identity
   Philosopher, schedules the same-Night Dreamer action and derives only `철학자임` on that seat.
3. A healthy in-play Artist selection records one grant, keeps the Philosopher seat as
   Philosopher and derives only Philosopher-source `취함` on the original Artist.
4. Self-selection records `selfDrunk`, creates no grant or further action and derives only the
   self drunk impairment/reminder.
5. An impaired selection records `noEffect`, consumes the use, preserves exact impairment evidence
   and creates no grant, duplicate drunkenness or later acquisition after recovery.
6. Source impairment toggling, death, Character change and resurrection reproduce the approved
   grant and duplicate-drunk lifetime without touching independent impairment sources.
7. Every granted Character action uses its existing canonical resolver with a granted
   `AbilityUseRef`; once-per-instance usage remains independent.
8. Philosopher-Mathematician uses #108's actor-specific audit and information path without copied
   calculations or duplicate evidence.
9. Official examples 1–3 replay through Dreamer same-Night acquisition, immediate Clockmaker
   start-knowing information and in-play Artist drunk/recovery respectively.
10. Undo, every-prefix replay, reload and export/import restore selection use, active grant,
    generated steps, duplicate drunkenness, reminders and Mathematician evidence exactly.
11. Forged catalog choices, stale base/granted instances, mismatched outcomes and unknown sources
    are rejected by proposal and replay.
12. Production UI matches the approved prototype at desktop, iPad portrait and mobile sizes and
    uses the existing develop token count/detail interaction.
13. When an in-play Character is made drunk by a Philosopher grant, every live-play surface for
    that original holder shows the standard `취함` badge: ordered Night action and overview,
    information action, daytime action, or death-trigger action as applicable. The Philosopher's
    acquired-ability row does not inherit the original holder's badge.

### Duplicate-drunkenness display audit

- Information path: Clockmaker, Dreamer, Mathematician, Flowergirl, Town Crier, Oracle,
  Seamstress, Juggler Night result and Sage use canonical `activeReasons`.
- Ordered action path: Snake Charmer and the Night overview use the acting Player's canonical
  `activeImpairments`; acquired abilities use the same status slot without Character-specific
  checks.
- Day-action path: Artist, Savant and Juggler use the acting Player's canonical impairment in the
  existing action header; Artist and Savant keep `activeReasons` for their information judgment.
- Death-trigger path: Sweetheart, Barber and Klutz use the acting Player's canonical impairment
  in the existing death-consequence card.
- Mutant has no private action card or wake step; its canonical impairment and automatic reminder
  remain visible through the standard Grimoire token interaction.
- Philosopher uses the same actor-status slot while its selection step exists. Self-selection
  consumes that step, so its resulting `취함` remains a Grimoire state rather than creating an
  extra wake or action card.

## File-level implementation plan

### Rust domain

1. `contracts.rs`: add the event payload/outcome, `AbilityUseRef`, `AbilityGrant` projection and
   discriminator; keep schema v3 additive and strict.
2. `model.rs`: add optional `PhaseStep.abilityUse` and replayed grant state without replacing the
   base Player ability instance.
3. `characters/sects_and_violets.rs`: change Philosopher metadata to one-good-Character automated
   input with defer; own catalog validation, proposal resolution, replay validation, grant
   derivation, duplicate impairment/reminder projection and grant-aware scheduling here.
4. Generalize existing S&V owner queries from actual Character only to base plus granted
   `AbilityUseRef` where a second owner is real. Keep script-specific rules in this file rather than
   branching common phase/replay code per Character.
5. `messages.rs`: add compact Korean acquisition/defer/self/no-effect summaries without UI layout
   copy.
6. Update boundary discriminator mirrors and import validation; preserve old schema-v3 replay.

### Web production

1. `web/src/core/types.ts` and JSON contract tests: mirror the additive event, grant,
   ability-use, impairment and reminder projections.
2. `features/phase-control/phaseInput.ts`, `usePhaseInputDraft.ts` and `StepInputs.tsx`: collect one
   allowed Character and expose confirm/defer actions without constructing canonical results.
3. S&V progress composition: render the approved Philosopher actor/acquired-ability split from
   replay state and use the existing influence badge for self-drunk/no-effect simulation.
4. S&V Grimoire composition: derive the approved physical token swap only from active grant plus
   in-play status, and feed canonical reminders through the existing token presentation.
5. Keep prototypes development-only; production components must not import prototype files.

### Verification

1. Make `issue107_philosopher_scenarios.rs` pass one outcome at a time: catalog/defer,
   out-of-play acquisition, in-play duplicate drunk, self-drunk, impaired no-effect.
2. Add focused lifetime, forged-reference, same-Night ordering, once-per-grant and every-prefix
   replay regressions in the same Rust module.
3. Materialize the three official JSON acceptance fixtures and connect them to the existing S&V
   fixture harness and #111 cross-character coverage.
4. Add production React tests for the approved progress and Grimoire presentations using real
   replay-shaped props; keep prototype tests presentation-only.
5. Run `cargo test --workspace`, `pnpm --dir web test`, and `pnpm --dir web build` before production
   acceptance.

## Initial Red-test boundary

The first implementation checkpoint intentionally contains only five public JSON-boundary tests.
They fail on current develop because Philosopher is still a manual no-input step and there is no
typed resolution, grant, duplicate-drunk or self/no-effect projection. They do not call private
reducers and therefore remain valid while implementation internals change.
