# Issue 8: Ongoing Night Actions and Information — Approval Plan

## Status

Approved by the user on 2026-07-16. Work remains in the dedicated worktree
`/private/tmp/clocktower-issue-8` on branch `codex/issue-8` and follows the sequential test-first
gates below.

## Approved Product Decisions

1. Issue #8 owns the baseline ongoing-night flow for Poisoner, Monk, Imp, Ravenkeeper, Empath,
   Fortune Teller, Undertaker, and the following public death announcement. Issue #11 retains
   Soldier protection, Mayor bounce, Scarlet Woman transfer, and the remaining cross-character
   edge-rule matrix; issue #12 retains win warnings and explicit game end.
2. An actual Fortune Teller adds a Storyteller-only Red Herring assignment step before their first
   information check. The assignment is a Confirmed Event, is replayed and undoable, and remains
   fixed for later nights.
3. Fortune Teller, Undertaker, and Ravenkeeper information implements the relevant Spy/Recluse
   per-check Registration Judgments now. Registration is never stored as global Player state.
4. Confirming an Imp choice atomically records the selected target and deterministic resolution in
   one typed Confirmed Event. A resulting death changes replayed life state immediately. Public
   announcement remains a separate following-Day Confirmed Event.
5. Rule-derived poison and protection appear as compact read-only Grimoire badges. Manual token
   editing remains issue #10.
6. Undertaker is generated only when the previous Day has a Player who was both executed and then
   confirmed dead from that execution.
7. A small isolated UI prototype will be reviewed before production UI implementation. It will
   cover rule-status badges, Red Herring assignment, resolved Imp outcomes, targeted information,
   and the following-Day death announcement.

## Scope

### Included

- script-owned target eligibility and official ongoing-night order;
- active-actor filtering, with Ravenkeeper as the deliberate death-triggered exception;
- Poisoner selection, replay-derived source/target audit, and expiry at the next dusk;
- early termination of a persistent effect when its source loses the relevant ability;
- Monk selection of another Player and protection for the current night;
- atomic Imp attack resolution for death, Monk prevention, an already-dead target, and an impaired
  actor;
- immediate night-death life-state updates and separate public announcement state;
- dynamic Ravenkeeper follow-up on any recorded night death of that Ravenkeeper;
- ongoing Empath calculation after earlier night deaths have been reduced;
- persistent Fortune Teller Red Herring assignment and pair-based yes/no information;
- Undertaker lookup of the previous Day's executed-dead Player;
- fixed, impaired, and Registration-adjusted Delivered Information for the issue's information
  Characters;
- typed summaries, Reveal payloads, proposal previews, warnings, follow-up hints, replay validation,
  import compatibility, and Undo/reload stability;
- compact production UI after prototype approval.

### Deferred

- Soldier prevention, Mayor bounce, Scarlet Woman/Imp transfer, and their decision follow-ups (#11);
- general win warnings and game-end confirmation (#12);
- manual System/Script Token and note editing (#10);
- Slayer, Virgin, Saint, and other Day edge rules (#11/#50 as applicable);
- random suggestions for ongoing-night targets or information;
- a generic rules DSL or rules-state snapshots.

The issue #8 resolver will still record a no-effect result for a Drunk-shown or currently poisoned
Poisoner/Monk/Imp so the implemented actions never create a knowingly false rules effect. Issue #11
will extend the same typed resolution seam to the deferred Characters and discretionary outcomes.

## Final Acceptance Criteria

1. Every generated target-selection step exposes Rust-owned legal Player IDs. React does not infer
   self-selection, dead-target, or distinct-target rules.
2. Poisoner may select any existing Player. A newly proposed event records the target and the active
   poison source. The effect is active for the selected night and following Day, expires before the
   next night's Poisoner choice, and ends early if its source loses the ability.
3. Monk may select any existing Player except themself. Valid protection is active for that night
   only; an impaired or non-actual Monk selection is logged but applies no protection.
4. Imp may select any existing Player, including themself or a dead Player. Confirmation records
   exactly one canonical attack-resolution event. An unprotected living target dies immediately;
   Monk protection prevents death; choosing a dead target creates no new death; an impaired or
   non-actual Imp creates no death.
5. Replay, reload, import, and Undo reproduce the same poison, protection, life, Red Herring,
   unannounced-death, current-step, and overview state.
6. A night death is hidden from public announcement state until the following Day announcement is
   confirmed. The announcement event records the exact replay-derived Player IDs and marks them
   announced without creating a second death.
7. A Ravenkeeper who dies at night creates an immediate current follow-up before later wake-order
   steps. The follow-up accepts any existing Player, including dead Players, and creates typed,
   safely revealed character information. No unrelated fixed Ravenkeeper step is generated.
8. Ongoing Empath information counts the nearest living Player in each direction after all earlier
   night deaths, with legal Spy/Recluse alignment judgments and impairment choices.
9. An actual Fortune Teller receives one Red Herring assignment step before their first check. An
   actual good Player is directly legal; a Spy is legal only with the exact Rust-provided Good
   registration witness. The chosen Player remains fixed.
10. Fortune Teller chooses exactly two distinct existing Players, including self or dead Players,
    and receives a yes/no result from the current Demon, the Red Herring, and legal Recluse Demon
    registration. Impairment permits either ability-shaped result while preserving audit context.
11. Undertaker appears only when the previous Day has a matching `executionConfirmed` and
    step-linked `deathConfirmed`. The target is derived, not entered. Normal truth uses the Actual
    Character; legal Spy/Recluse registration or impairment may alter the delivered Character while
    preserving the computed value and reason.
12. Each information confirmation persists `ConfirmedInformation`, produces only a narrow
    `RevealPayload`, and uses the already-approved repeatable post-confirm Reveal lifecycle.
13. Forged targets, results, registration witnesses, resolutions, announcements, stale steps,
    duplicate Players, invalid expiry references, and out-of-order events create no proposal or
    fail whole-file replay.
14. Event summaries and warnings state the operational result concisely in Korean without leaking
    Storyteller-only information into Reveal.

## Stable Domain and JSON Contract

### Phase steps and legal targets

Extend `RequiredInput` additively with:

```ts
type RequiredInput = {
  // existing fields
  allowedPlayerIds?: string[];
  playerRegistrationOptions?: RegistrationJudgment[];
};
```

- `allowedPlayerIds` is in seat order and is authoritative for both UI eligibility and proposal
  validation.
- Poisoner, Imp, Ravenkeeper, and Fortune Teller checks include all Players; Fortune Teller still
  requires exactly two distinct IDs.
- Monk excludes its actor ID.
- Red Herring includes actual-good Players plus a Spy only when the adjacent registration option is
  supplied.
- A missing allowlist retains compatibility for historical generic steps; all newly generated
  issue #8 steps include it.

Add a semantic `redHerringAssignment` `StepType`. Use the stable ID
`firstNight:fortuneTellerRedHerring` for a normal first-game assignment. For a legacy game that
already confirmed a Fortune Teller check without an assignment, insert the same semantic recovery
step immediately before the next unconfirmed Fortune Teller check, using that phase's prefix.

### Replayed rules state

Extend `ReplayState` with a compact, Rust-owned projection:

```ts
type RuleState = {
  redHerringPlayerId?: string;
  activePoison?: {
    playerId: string;
    sourcePlayerId: string;
    sourceEventId: string;
  };
  activeProtection?: {
    playerId: string;
    sourcePlayerId: string;
    sourceEventId: string;
  };
  unannouncedNightDeathPlayerIds: string[];
};
```

`ReplayState.ruleState` is derived only. It is never persisted as a snapshot. The UI maps the two
active effects to read-only badges and does not patch them.

### Typed ongoing-night events

Add strict schema-version-2 event variants:

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
    resolution: NightActionResolution;
  };
};

type NightActionResolution =
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
        | { kind: "noDeath"; reason: "alreadyDead" | "actorImpaired" | "notActualCharacter" };
    };

type NightDeathsAnnounced = {
  type: "nightDeathsAnnounced";
  payload: {
    stepId: string;
    playerIds: string[];
  };
};
```

- New proposals use these variants instead of generic `phaseStepConfirmed` for the corresponding
  state-changing steps.
- The event stores the deterministic result so audit history does not require reinterpreting a
  selection after future rules are added. Replay recomputes the expected result from prior events
  and requires an exact match.
- An Imp `death` outcome is itself the single night-death Confirmed Event agreed for this issue; no
  second `deathConfirmed` is appended.
- `nightDeathsAnnounced` validates against the ordered complete set of currently unannounced night
  deaths. Empty lists are valid and mean that no one died that night.
- Future issue #11 variants extend `impAttack.outcome` or introduce a typed decision follow-up; they
  do not reinterpret the issue #8 outcomes.

### Information results and target-dependent prompts

Extend the persisted tagged union:

```ts
type InformationResult =
  | ExistingInformationResults
  | { kind: "boolean"; value: boolean }
  | { kind: "character"; characterId: string };
```

Keep the existing `ConfirmedInformation` audit shape. Extend the transient `InformationPrompt`
with Rust-calculated target checks:

```ts
type TargetInformationCheck = {
  targetPlayerIds: string[];
  computedResult: InformationResult;
  choices: Array<{
    result: InformationResult;
    isComputed: boolean;
    registrationJudgments: RegistrationJudgment[];
  }>;
};

type InformationPrompt = {
  // existing issue #7 fields remain
  targetChecks: TargetInformationCheck[];
};
```

- Fortune Teller receives one check for every seat-ordered two-Player combination.
- Ravenkeeper receives one check per selectable target.
- Undertaker receives one check for its replay-derived executed-dead target.
- React finds the exact target set and renders only the returned choices; it never calculates a
  Demon, Red Herring, Actual Character, impairment range, or Registration result.
- For a fixed result, the computed choice is the only choice and the Command omits an alternate.
- For impairment, choices contain the full ability-shaped range: both booleans for Fortune Teller
  and all Trouble Brewing Characters for Undertaker/Ravenkeeper.
- For Registration, the alternate choice carries the exact witness submitted with that choice.
- The current numeric `numberChoices` and setup-information registration contract remain intact.

### Reveal and messages

Reuse the narrow text Reveal payload for boolean and character information:

- Fortune Teller: `예 / 아니요` only;
- Undertaker and Ravenkeeper: the delivered Character only;
- no target's Actual Character, registration rationale, poison source, event log, or Grimoire state
  enters player-facing Reveal unless that value is the explicitly delivered result;
- Storyteller summaries may include compact actual-versus-delivered audit detail and reason labels.

Proposal warnings use stable codes for operationally relevant non-death results:

- `DEMON_ATTACK_PREVENTED`;
- `DEMON_ATTACK_TARGET_ALREADY_DEAD`;
- `NIGHT_ACTION_NO_EFFECT`;
- `NIGHT_DEATH_UNANNOUNCED` in replay while a public announcement is pending.

## Character and Flow Rules

### Poisoner

- Generate for a living actual Poisoner or living Drunk shown Poisoner in the existing wake model.
- Accept one existing Player, including self or dead.
- Derive the active poison from the latest applied Poisoner action in the current night cycle.
- Keep it active through the following Day, then expire it when `toNight` is confirmed, before the
  next Poisoner step.
- Stop the effect early when replay shows the source dead or no longer possessing the ability.
- Preserve the current typed `DeliveryReason::Poisoned` event/source references.

### Monk

- Generate on nights after the first for a living waking actor.
- Accept exactly one Player other than the actor; alive and dead are both legal.
- Apply protection only when the actor's Monk ability is active.
- Expire at the following dawn/Day entry; do not expose it as a Day status.

### Imp and night death

- Generate on nights after the first for a living waking actor.
- Accept any one Player, including self and dead.
- Resolve in this order: inactive actor, already-dead target, active Monk protection, death.
- Mark a death before generating later steps so Ravenkeeper and Empath observe the new state.
- Self-death is a valid death. Scarlet Woman/Minion transfer and win handling remain deferred.

### Ravenkeeper

- Remove the unconditional Ravenkeeper entry from the normal night Character list.
- Insert `nightN:ravenkeeper` immediately after a night event kills that Ravenkeeper.
- Generate from any typed night death cause, not only a direct Imp target, so issue #11 Mayor bounce
  can use the same seam.
- Accept any one Player and produce target-dependent Character choices.
- Complete or skip the follow-up before later official wake-order steps.

### Empath

- Add Empath to every-night order after night deaths and Ravenkeeper resolution.
- Calculate nearest living neighbors in both directions from the replayed seat map.
- Keep the existing numeric-choice, impairment, and alignment-registration audit contract.

### Fortune Teller

- Generate Red Herring assignment once for an actual Fortune Teller before their first check.
- Persist an actual-good choice directly; require the exact Good witness when assigning a Spy.
- Keep Recluse directly eligible because the Recluse is actually good.
- Generate a normal Fortune Teller check every night for each living waking actor.
- Accept two distinct Players, including actor and dead Players.
- Compute yes when either target is the current Demon or fixed Red Herring; add legal Recluse-as-
  Demon alternate choices and impairment choices.

### Undertaker

- Search only the immediately preceding Day cycle.
- Require the same Player in `executionConfirmed` and its matching step-linked `deathConfirmed`.
- Omit the step if no such Player exists.
- Derive the information target and Actual Character from replay; no target input is accepted.
- Offer legal Spy good-Character and Recluse evil-Character registration alternatives, or every
  Trouble Brewing Character under impairment.

### Death announcement

- The following Day's `announceDeaths` step shows the replay-derived unannounced night deaths and
  only a death icon, seat number, and Player name for each entry.
- Confirmation records the exact list, produces a concise public-safe summary, and changes only
  announcement state.
- Execution deaths are already public and are marked announced when reduced; they never appear in
  this night-death list.

## Replay, Validation, and Compatibility

1. Split the internal replay model from the serialized UI projection. Reducers derive actors,
   effects, deaths, Red Herring assignment, announcement state, and prior-Day execution evidence.
2. Generate steps from the state at each event boundary. Dead actors disappear immediately; a
   dead Ravenkeeper appears only through the trigger-specific follow-up.
3. Proposal and replay call the same script-owned target, result, registration, and action-resolution
   functions. Imported events cannot bypass proposal rules.
4. Keep schema version 2. New variants and optional replay fields are additive; old events are not
   rewritten.
5. Historical generic Poisoner and Monk `phaseStepConfirmed` events retain their input-derived
   legacy effect behavior. Historical generic Imp events remain valid but do not retroactively kill
   a Player because they did not persist a resolved death.
6. Historical information events without the new typed results retain the existing compatibility
   path. New Fortune Teller/Undertaker/Ravenkeeper proposals always persist typed information.
7. If a legacy game reached Fortune Teller without a Red Herring assignment, replay preserves prior
   confirmed checks and inserts a one-time recovery assignment before the next unconfirmed Fortune
   Teller check. No prior information is retroactively recomputed.
8. Strict event parsing, phase matching, current-step matching, and whole-file replay failure remain
   unchanged.

## UI Prototype and Production Design

The isolated prototype was reviewed and approved on 2026-07-16. No additional prototype is needed.
Production UI uses these confirmed decisions:

1. Desktop keeps the existing Grimoire-first layout with a right action panel. Narrow screens use
   the approved fixed bottom sheet and keep all step tabs visible.
2. Grimoire `중독` and `보호` badges are read-only and visually distinct: poison uses purple and
   protection uses blue. The UI reads them only from `ReplayState.ruleState`.
3. Red Herring is a one-Player selection from Rust-provided eligible IDs. A Spy remains selectable,
   but the panel does not display a Registration explanation. When a selected Spy requires the
   Rust-provided Good witness, the command attaches that witness automatically.
4. Imp results use one concise operational line only, for example
   `3번 서연 - 수도승에 의해 보호됨` or `5번 하린 - 사망`. Warning codes, follow-up prose, and
   duplicate headings are not rendered in the live action panel.
5. Fortune Teller uses a two-stage workflow: select two Players and confirm, then freeze Grimoire
   editing and show `점쟁이 결과`, one `결과` row (`악마 있음` or `악마 없음`), and `Reveal`.
   The player-facing Reveal continues to contain only `예` or `아니요`.
6. Ravenkeeper and Undertaker reuse the same confirmed-result/Reveal lifecycle with their
   Rust-provided Character result. Their registration or impairment audit remains persisted but is
   not expanded into explanatory live-play copy.
7. The following-Day death announcement renders only a death icon, seat number, and Player name.
   It does not show the living-Player count inside the announcement.

Production implementation then:

1. updates TypeScript contracts and runtime validation for `RuleState`, target allowlists,
   target-dependent information choices, typed night events, and boolean/Character results;
2. extends `usePhaseInputDraft` with prompt-provided Player/result selection and resets it on step,
   game, target, and Undo changes;
3. uses `allowedPlayerIds` as the sole target-eligibility source for both the panel and Grimoire;
4. maps a Red Herring Spy selection to its exact prompt-provided registration witness without
   exposing the rationale in visible copy;
5. adds the compact action/result states to `StepInputs.tsx`, while `PhaseControl.tsx` owns the
   selection-to-confirmed-result transition and disables Grimoire edits after confirmation;
6. adds distinct read-only poison/protection badges to `Grimoire.tsx` without importing phase
   control or calculating rules in React;
7. renders the minimal death-announcement list from replay-provided IDs;
8. keeps `main.tsx` as wiring only and preserves the repeatable pending-confirmed Reveal
   open/close/continue lifecycle.

## Sequential Test-First Handoff

This is a non-trivial rules, replay, persistence-contract, and user-workflow change, so the project
test-first handoff is mandatory.

### Gate 1: domain behavioral tests

1. Sol freezes this approved acceptance contract and updates architecture documentation only.
2. `luna_logic_worker` receives the acceptance criteria, public JSON contract, existing specs, and
   test conventions, but no production implementation design or production-source assignment.
3. The worker adds the smallest black-box Rust scenario tests covering the canonical event/replay
   seams and demonstrates failure for the intended missing behavior.
4. Sol reviews the tests, observed error, public-contract fidelity, and absence of production edits.
5. Only after that review, a separate `luna_worker` implements the Rust production behavior and may
   add implementation-coupled unit tests. The approved behavioral tests may not be weakened,
   deleted, or rewritten without Sol approval.

### Gate 2: production UI workflow

1. Sol built/reviewed the isolated prototype and obtained user UI approval on 2026-07-16.
2. `luna_logic_worker` adds the smallest web integration/regression tests for the approved visible
   workflow and demonstrates the intended failure without editing production UI.
3. Sol reviews the failing behavior.
4. The separate implementation worker updates production React/TypeScript and coupled unit tests
   without weakening the approved integration tests.

Parallel writes are not used for these gates. Domain and web implementation proceed sequentially in
the same issue worktree.

## Regression Matrix

### Rust domain

- Poisoner first night and later-night lifetime, next-dusk expiry, source-death expiry, Undo, reload,
  and import;
- Monk self-target rejection, other/dead target acceptance, night-only expiry, impaired no-effect;
- Imp living target death, protected target, dead target, self-kill, impaired no-effect, forged
  resolution, and immediate Player state;
- announcement separation, empty announcement, exact list validation, duplicate announcement, and
  execution-death exclusion;
- Ravenkeeper direct night death, generic night-death trigger compatibility, target alive/dead,
  fixed/registration/impaired Character result, ordering, skip, and no false trigger;
- Empath newly dead neighbor, nearest living neighbor on both sides, 0/1/2, registration,
  impairment, and current-night poison;
- Red Herring direct good assignment, self assignment, Spy Good witness, forged/evil assignment,
  one-time persistence, legacy recovery, Undo, and later nights;
- Fortune Teller Demon, dead Demon, Red Herring, neither, Recluse Demon alternate, duplicate target,
  impairment, persisted audit, and Reveal isolation;
- Undertaker executed-dead match, no execution, execution without matching death, Actual Drunk,
  Spy/Recluse registration, impairment, and previous-Day boundary;
- old schema-v2 generic night events and existing issue #7/#9 information/death scenarios.

### Web unit and integration

- legal target disablement and bidirectional Grimoire selection;
- compact poison/protection badges and correct expiry projection;
- Red Herring selection with an automatically attached prompt-provided registration witness and no
  visible Registration explanation;
- pair-dependent Fortune Teller choice lookup without TS rule calculation;
- Ravenkeeper target-change invalidation of a prior result choice;
- Undertaker derived target and fixed/selectable result rendering;
- atomic Imp event confirmation, summary, replay, autosave, and no duplicate event;
- death announcement icon/seat/name rendering and public-safe confirmation;
- pending Reveal single-event, reopen, close, continue, Undo, reload, and import behavior;
- runtime rejection of malformed new events, RuleState, prompt checks, and Reveal results;
- iPad landscape and narrow-width layout for badges and choice controls.

## Implementation Order After Approval

Completed: architecture contract, domain test-first Gate 1, Rust implementation, lifetime review
regressions, full Rust verification, isolated prototype, and visual approval.

Remaining work proceeds in this order:

1. Have `luna_logic_worker` add the smallest black-box web integration tests for the approved
   production workflow and demonstrate that they fail for the intended missing UI behavior.
2. Review those failures and freeze the production component seams before implementation.
3. Have the separate `luna_worker` update TypeScript/runtime contracts, draft state, phase inputs,
   Grimoire badges, result/Reveal transition, and death announcement without weakening the approved
   integration tests.
4. Run focused web tests, then `pnpm --dir web test` and `pnpm --dir web build`.
5. Bind the validation server to `0.0.0.0` and visually verify the approved iPad landscape and
   narrow-screen bottom-sheet layouts.
6. Run `cargo test --workspace` again and perform a final code-review pass for script ownership,
   event/replay parity, forged-import rejection, effect expiry, death ordering, Reveal isolation,
   accessibility, and unrelated changes.
7. Run all required tests one final time, commit the finished code, and push `codex/issue-8` unless
   blocked.

## Completion Evidence

The final completion note will include:

- the committed branch and pushed commit;
- domain, web, build, and visual-validation results;
- the behavioral regression tests that failed before implementation and pass afterward;
- a concise event/replay compatibility summary;
- any intentionally deferred #11/#12 behavior;
- any blocked checklist item and exact blocker.
