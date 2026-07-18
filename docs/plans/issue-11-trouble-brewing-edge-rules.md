# Issue 11: Trouble Brewing Edge Rules

## Status

Requirements decisions were approved by the user on 2026-07-16. Implementation has not started.
The required UI prototype is still pending approval and must be reviewed before production UI work.

Follow the repository's current `AGENTS.md` when implementation begins.

## Existing Work to Preserve

Issue #11 is partially implemented on `main` through earlier issues:

- #8 implements ongoing night actions and information.
- #38 persists computed and delivered information separately.
- #45 implements discretionary setup information for a Drunk Player.
- #50 implements the actual Slayer's public ability, per-shot Recluse Registration, ability spend,
  and a distinct Death follow-up.

Treat those behaviors as accepted dependencies and regression-test them. Do not reimplement them or
reverse the approved #50 decision that only the actual Slayer has tracked Slayer ability state. A
Drunk Player shown Slayer is not tracked as owning or spending the Slayer ability; a poisoned actual
Slayer still spends it with no effect.

## Approved Product and Rule Decisions

### Virgin

- Split every nomination into nomination confirmation followed by voting.
- The actual Virgin loses the ability on the first valid nomination regardless of whether the
  nominator is Townsfolk and regardless of whether the Virgin is poisoned.
- A sober and healthy actual Virgin immediately executes the nominator when that nominator is an
  actual Townsfolk or a Spy explicitly registered as Townsfolk for this check.
- A non-Townsfolk nomination or a poisoned Virgin does not execute the nominator, but the Virgin's
  ability is still spent and voting proceeds normally.
- A Drunk Player shown Virgin is not an actual Virgin and has no tracked Virgin ability.
- Virgin ability availability and spent state must be visible on the actual Virgin's Grimoire seat.
  This is passive status, not a clickable action.

### Soldier and Mayor

- A sober and healthy actual Soldier cannot die from an actual, sober and healthy Imp attack.
- A Drunk Player shown Soldier is not protected. A poisoned actual Soldier can die.
- When a sober and healthy actual Mayor would die at night, the Storyteller chooses either:
  - the Mayor dies; or
  - the Mayor lives and the attack is bounced to any other rostered Player.
- A bounce target may be alive or dead. A dead target, sober and healthy Soldier, or Monk-protected
  target produces no death. Otherwise the bounce target dies.
- Do not add an independent `nobody dies` choice. No-death is the computed result of the selected
  bounce target.
- A poisoned Mayor has no bounce choice. A Mayor already protected by the Monk would not die, so the
  Mayor ability is not applicable.

### Demon Succession

- Succession checks only the death of an actual Imp. A Recluse never triggers succession by
  registering as the Imp.
- Count living Players immediately before the Imp dies; the dying Imp is included in that count.
- If at least five Players were alive and a sober, healthy, living Scarlet Woman exists, that Scarlet
  Woman is the fixed successor. This includes Imp self-kill. The Storyteller does not choose a
  different Minion in this case.
- When the Imp kills themself and the fixed Scarlet Woman condition does not apply, the Storyteller
  chooses one living actual Minion to become the Imp.
- The self-kill choice may select a poisoned Scarlet Woman because this transfer comes from the
  Imp's ability, not the Scarlet Woman's ability.
- If the Imp self-kills with no living Minion, no succession occurs.
- If an Imp dies by execution or Slayer with fewer than five Players alive, or with no eligible
  Scarlet Woman, no succession occurs.
- A poisoned Imp's self-attack causes no death under the existing impairment rule and therefore no
  succession.

### Saint

- A sober and healthy actual Saint who is confirmed dead by execution creates a typed evil-win
  warning.
- A poisoned Saint, a Drunk Player shown Saint, or a Saint who dies outside execution creates no
  Saint warning.
- Issue #11 does not end the game. Issue #12 owns explicit game-end confirmation and undoable game
  end.

## Acceptance-Criteria Mapping

| Issue #11 criterion | Planned result |
| --- | --- |
| Drunk and poisoned information | Preserve and regression-test #8, #38, and #45 |
| Per-check Spy/Recluse Registration | Preserve existing information and Slayer contexts; add Virgin's Spy judgment |
| Virgin immediate execution | Add nomination-first flow, ability spend, immediate execution, and Death follow-up |
| Slayer spend and Demon registration | Preserve the approved #50 contract |
| Soldier Demon protection | Add to canonical Imp attack resolution |
| Mayor bounce | Add a conditional Rust-owned Storyteller decision |
| Scarlet Woman transfer | Add replay-derived succession follow-up after actual Imp death |
| Saint warning | Add replay-derived warning after execution Death without auto-ending |

## Stable Domain Contract

### Nomination and Virgin Flow

Replace the current combined nomination-and-vote transition with two replayable transitions:

```text
nomination confirmation
  -> Virgin resolution
     -> nominator executed -> Death confirmation -> to Night
     -> no execution       -> vote confirmation -> next nomination
```

Add a strict `nominationStarted` Confirmed Event containing:

- the nomination step ID;
- nominator and nominee IDs;
- any per-check Spy-as-Townsfolk Registration Judgment;
- a typed Virgin resolution:
  - not applicable;
  - spent with no execution; or
  - spent and nominator executed;
- the exact impairment context when an actual Virgin is being resolved.

The nomination confirmation itself records the Virgin's immediate execution when the ability
fires. Do not add a second execution-confirmation tap. Death remains a separate confirmation and
event, preserving the existing Execution-versus-Death distinction.

When no immediate execution occurs, generate a dynamic vote follow-up linked to the
`nominationStarted` event. The vote event stores only the linked nomination identity, canonical
voter IDs, and spent ghost-vote IDs; it must not create a second independent nominator/nominee
source of truth. Replay verifies the link and derives the completed nomination record and execution
standing.

Extend replayed Day state with the active confirmed nomination while its vote is pending. Nomination
eligibility is consumed at nomination confirmation, not at vote confirmation. Preserve the existing
unique-highest qualifying candidate derivation, tie behavior, ghost-vote lifecycle, and daily
eligibility reset.

Expose global replayed Virgin ability state with at least:

```ts
type VirginAbilityState = {
  actorPlayerId: string;
  spent: boolean;
  spentByNominationEventId?: string;
};
```

Only an actual Virgin receives this projection. React renders it but does not infer it from
Character or nomination history.

### Canonical Imp Attack Resolution

Centralize Trouble Brewing attack resolution in Rust and use the same function for Proposal and
full replay validation. Resolve in this order:

1. validate the actual Imp actor and impairment;
2. handle an already-dead original target;
3. apply active Monk protection;
4. apply sober and healthy actual Soldier protection;
5. require a Mayor decision only when an eligible Mayor would otherwise die;
6. resolve the selected bounce target with the same dead, Monk, and Soldier checks;
7. produce the final death or no-death result.

The current Imp step must expose a typed, Rust-derived conditional action prompt containing the
exact Mayor decision and bounce-target options. TypeScript must not decide whether the Mayor,
Soldier, or Monk is active.

Extend the Imp command input with a typed Mayor decision only when Rust reports it as required.
Reject missing, stale, unnecessary, self-bounce, or unknown-player decisions.

Persist enough typed context on `nightActionResolved` to audit and strictly replay:

- original Imp target;
- whether Mayor handling was applicable;
- Mayor-dies or bounce decision and bounce target;
- final death target, if any;
- Monk or Soldier prevention context;
- canonical no-death reason.

Avoid an optional catch-all source field. Use tagged variants so Monk protection can carry its
source event while intrinsic Soldier protection does not invent one.

Night-death announcement, Ravenkeeper generation, active-player derivation, summaries, and warnings
must consume the final resolved death target rather than assuming it is the original Imp target.

### Demon Succession Follow-up

After every actual Imp Death transition, replay checks whether succession is pending. Covered death
sources are:

- execution followed by `deathConfirmed`;
- Slayer followed by `deathConfirmed`;
- Imp self-kill recorded by `nightActionResolved`.

Generate a dynamic `demonSuccession` step before normal phase flow resumes. The step is:

- fixed to the eligible Scarlet Woman when the five-alive condition applies; or
- selectable from Rust-provided living actual Minion IDs for an Imp self-kill fallback.

If there is no legal successor, do not generate the step.

Add a strict `demonSuccessionConfirmed` event containing:

- the triggering Imp-death event ID and death cause;
- previous Imp Player ID;
- successor Player ID;
- successor's previous actual Character;
- new Character `imp`;
- whether succession came from Scarlet Woman or Imp self-kill.

Replay must verify the entire event from its prefix, reject forged successors and duplicate
succession, then change the successor's actual and shown Character to Imp. All subsequent night
ordering, Demon checks, Grimoire state, and future win warnings must use the transformed Character.

Confirmation produces a narrow RevealPayload for notifying the new Imp. The Reveal path must not
receive the Grimoire, event log, or unrelated rules state.

### Saint Warning

Derive a stable warning only when a `deathConfirmed` event completes the death of the actual Saint
linked to that day's execution and the Saint had their ability at the triggering point.

Use a stable warning code such as `SAINT_EXECUTED_EVIL_WIN` and a concise Korean operational
message. The warning remains derived state, is restored by replay, and disappears on undo. Do not
create an END_GAME event or automatic phase transition in this issue.

### Registration Scope

- Continue storing each Registration Judgment inside the specific information, Slayer, or Virgin
  check that used it.
- Add only Spy-as-Townsfolk Registration for the Virgin check.
- Keep Slayer's existing Recluse-as-Imp judgment unchanged.
- Do not add global registration flags to Player or RuleState.
- Do not offer Recluse Registration for Demon succession.

### Compatibility and Validation

- Existing schema-version-2 logs must replay unchanged.
- New events and tagged variants must deny unknown fields and receive matching TypeScript import
  validation.
- Proposal and replay must call the same canonical rule functions so preview and persisted outcome
  cannot drift.
- Replay must reject events with invalid order, stale links, mismatched actors or targets, forged
  impairment/protection/registration context, invalid thresholds, or impossible successors.
- Confirmed Events remain the only persisted source of truth. Do not persist generated steps or
  replay snapshots.

## Required Prototype Gate

Before production UI implementation, add one development-only prototype with scenario switching,
for example `?prototype=issue-11-edge-rules`. It must cover:

- normal Virgin trigger;
- Spy Townsfolk Registration choice;
- non-Townsfolk and poisoned-Virgin no-execution paths;
- Grimoire Virgin available and spent states;
- Mayor dies;
- Mayor bounce to a normal living Player;
- Mayor bounce to a dead, Soldier, or Monk-protected Player;
- fixed Scarlet Woman succession at five or more alive;
- selectable Minion succession for an Imp self-kill fallback;
- new-Imp confirmation and Reveal handoff.

Use the prototype to obtain explicit approval for:

- the two-stage nomination layout and confirmation wording;
- the passive Virgin ability marker's available/spent appearance;
- conditional Mayor controls and result preview;
- fixed versus selectable succession presentation;
- the new-Imp Reveal entry and return path.

Keep live-play copy concise. Do not add explanatory paragraphs that merely restate visible state.
Production UI implementation must wait for this approval.

## Test-First Implementation Order

After prototype approval and before editing production behavior:

1. Freeze the approved acceptance criteria and public JSON contract in this plan and
   `ARCHITECTURE.md`.
2. Add the smallest black-box Rust boundary tests for the missing behaviors.
3. Add focused user-visible tests for the approved nomination, Grimoire status, Mayor, and
   succession workflows.
4. Run the new tests and verify that they fail because the behaviors are absent, not because of an
   environment or harness problem.
5. Implement the smallest production changes needed to pass them.
6. Refactor only after the new tests pass, then run the complete relevant regression suites.

Do not weaken or rewrite an approved behavioral test to accommodate the implementation. If a test
contract is wrong, document the requirement error before changing it.

## Required Behavioral Coverage

### Virgin and Day Flow

- first actual Virgin nomination by an actual Townsfolk;
- Spy registration both as Townsfolk and not Townsfolk;
- first nomination by Outsider, Minion, or Demon consumes the ability and proceeds to voting;
- poisoned Virgin consumes the ability without executing;
- second nomination never triggers after any first valid nomination;
- Drunk shown Virgin has no tracked actual ability;
- immediate execution creates a distinct Death follow-up and ends nominations for the day;
- Undertaker sees the nominator only after execution Death is confirmed;
- nomination eligibility is consumed before voting;
- candidate ties, lower non-leading ties, majority threshold, ghost-vote spending, and undo remain
  correct after the split flow;
- Virgin state survives replay, reload, export, and import and is restored by undo.

### Soldier and Mayor

- sober and healthy actual Soldier prevents a direct Imp attack;
- poisoned Soldier and Drunk shown Soldier die normally;
- Soldier remains vulnerable to execution and non-Demon death sources;
- eligible Mayor can die normally or bounce to every allowed target class;
- bounce to normal living target kills that target and keeps the Mayor alive;
- bounce to dead, sober Soldier, or Monk-protected target kills nobody;
- poisoned or already-protected Mayor does not receive a bounce decision;
- bounced Ravenkeeper death creates the existing follow-up reveal;
- announcements and unannounced-night-death warnings use the final death target;
- replay rejects tampered Mayor and prevention context.

### Demon Succession

- five-alive and four-alive boundary uses the count immediately before Imp death;
- fixed Scarlet Woman succession after execution, Slayer, and Imp self-kill;
- no non-self-kill succession below the threshold;
- self-kill fallback selects among all and only living actual Minions;
- poisoned Scarlet Woman does not trigger their own ability but remains a possible self-kill
  successor;
- poisoned Imp self-target produces no death and no succession;
- no living Minion produces no self-kill successor;
- Recluse death never produces succession;
- transformed successor acts as the Imp on later nights and is the Demon for later checks;
- pending and confirmed succession survive undo, reload, export, and import;
- replay rejects wrong trigger links, threshold, successor, prior Character, duplicate transfer, and
  fabricated events.

### Saint and Existing Behavior

- healthy actual Saint executed and dead creates the warning;
- poisoned Saint, Drunk shown Saint, and non-execution death do not;
- warning disappears on undo and returns on replay/import;
- no path automatically ends the game;
- existing drunk/poisoned information, Registration-sensitive information, Slayer, night actions,
  voting, Death, Ravenkeeper, and Reveal regression suites remain green.

## Production Change Map

### Rust domain

- `contracts.rs`: strict nomination-start, Mayor context, succession, and event payloads.
- `model.rs`: active nomination, Virgin ability state, new step/input types, and action prompts.
- `characters/trouble_brewing.rs`: Virgin, Soldier, Mayor, Scarlet Woman, and Imp succession rules.
- `day.rs`: nomination/vote split, Virgin resolution, immediate execution, and day progression.
- `night.rs`: canonical Imp attack inputs, Mayor options, final death target, and succession ordering.
- `proposal.rs`: canonical event construction, validation, previews, warnings, and Reveal hints.
- `replay.rs`: strict event recomputation, transformed Characters, pending follow-ups, and Saint
  warning derivation.
- `messages.rs` and `error.rs`: concise Korean summaries and stable validation errors.
- `tests/`: focused boundary scenarios grouped by Virgin/day, Demon attack, succession, and Saint.

Keep script-specific rules in `characters/trouble_brewing.rs` rather than distributing them across
generic phase modules.

### Web

- `core/types.ts`: mirror all new tagged contracts and replay projections.
- `core/validation.ts`: strict import/replay contract validation.
- `features/voting/`: two-stage nomination and linked vote drafts.
- `features/phase-control/`: Mayor decision controls, dynamic Death/succession steps, feedback, and
  Reveal transition.
- `features/grimoire/Grimoire.tsx`: narrow Rust-derived Virgin ability-status prop and passive marker.
- `gameStore.ts` and composition code: append only Rust-proposed events and preserve pending
  follow-ups across replay.
- prototype files and tests: development-only issue #11 scenario surface.
- unit/integration tests: approved layouts, command creation, error display, state restoration, and
  narrow Reveal behavior.

TypeScript must not calculate Character eligibility, impairment, Registration, protection, bounce
outcomes, living thresholds, or successors.

### Documentation

- Update `ARCHITECTURE.md` with the final nomination, attack, succession, warning, and JSON boundary
  contracts after prototype approval.
- Update this plan if prototype approval changes placement, wording, or confirmation sequence.

## Verification and Completion

Run:

- `cargo fmt --check`
- `cargo test --workspace`
- `pnpm --dir web test`
- `pnpm --dir web build`

For UI validation, bind the development server to `0.0.0.0` and inspect the 1366 x 1024 iPad
viewport. Exercise every prototype-approved path, including focus handling, cancellation, stale
commands, result feedback, Reveal return, and disabled/spent states.

Review the complete diff for:

- rule decisions leaking into TypeScript;
- Proposal/replay drift;
- execution and Death being collapsed;
- Mayor bounce using the original rather than final death target;
- Scarlet Woman and Imp self-kill abilities being conflated;
- Recluse accidentally triggering succession;
- Character transformation not affecting later phases;
- warnings auto-ending the game;
- unnecessary live-play copy;
- schema-version-2 regression or permissive event parsing.

Finish the code change by committing the reviewed result and pushing the dedicated issue branch,
unless explicitly told otherwise or blocked. Report regression coverage, the final commit, the
pushed branch, and any blocked checklist item.

## Handoff Notes

- This document is the only issue #11 artifact created in this planning pass; no implementation or
  tests were run.
- Before code work, follow the current `AGENTS.md`: update `main`, then create a dedicated issue
  worktree and branch.
- The source checkout contained unrelated user work when this file was written, including changes
  to `AGENTS.md` and an issue #43 plan. Preserve those changes and do not absorb them into issue #11.
- The first deliverable is the development-only prototype and user approval, not production rule
  implementation.
