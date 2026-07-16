# Issue 50: Slayer Public Ability During Discussion

## Status

Approved by the user on 2026-07-16 after reviewing the development-only prototype. Implemented
and verified through the sequential behavioral-test handoff below on the same date.

Work remains in the dedicated `/private/tmp/clocktower-issue-50` worktree on
`codex/issue-50`.

## Approved Requirement Decisions

- Track only the actual Slayer. A Drunk who was shown Slayer and any Player bluffing as Slayer do
  not create a Slayer-use event and do not receive a tracked use state.
- The actor must be the living actual Slayer and must not have spent the ability. A poisoned actual
  Slayer remains eligible to act; confirmation spends the ability but has no effect.
- The action is available only while the current typed Day step is Discussion.
- The Slayer may choose any rostered Player, including themself or a dead Player. Missing and
  unknown targets are invalid. A dead target is a legal selection but cannot produce a Death.
- Only a Recluse target has a registration choice for this check. Spy is never offered a Demon
  registration choice and cannot make a Slayer shot succeed.
- A successful shot creates a separate Death follow-up. The Slayer-use event itself never changes
  `alive` state.
- Automatic game-end confirmation, other public abilities, nominations, voting, and custom scripts
  remain out of scope.

The issue's original “drunk Slayer spends the ability” acceptance criterion is narrowed by the
user decision above: a Drunk shown Slayer has no tracked Slayer ability to spend. Poisoned actual
Slayer behavior remains required.

## Prototype UI Contract

The development-only prototype is available at `?prototype=slayer-ability`.

- The entry point is the actual Slayer's Character icon inside their Grimoire seat token.
- The icon is enabled only during Discussion when that living actual Slayer is unspent. It remains
  visible but disabled after use and outside Discussion.
- No separate Slayer card or explanatory copy is added to the Discussion panel.
- Selecting the icon opens a modal popup with the actor fixed to that Slayer.
- The popup lists every Player as a target. Dead Players remain selectable and show `사망`.
- Selecting a Recluse reveals a required, initially unselected decision:
  `악마로 등록하지 않음` or `악마로 등록`.
- No Spy registration control is shown.
- The review block shows `actor -> target` plus the Recluse decision when applicable.
- The destructive confirmation warning is:
  `확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.`
- The actions are `취소` and `학살자 사용 확정`.
- The computed outcome is not previewed before confirmation.
- A miss closes the popup, shows `아무 일도 일어나지 않음`, spends the icon, and leaves
  Discussion current. A success makes the distinct `사망 확인` follow-up current.

Production dialog behavior must also include initial focus, focus containment, Escape/close
handling, and restoration of focus to the Slayer icon.

## Stable JSON Contract

### Command

Add a command that does not complete the current Discussion step:

```ts
type UseSlayerAbilityCommand = {
  type: "useSlayerAbility";
  payload: {
    discussionStepId: string;
    expectedEventCount: number;
    actorPlayerId: string;
    targetPlayerId: string;
    targetRegistration:
      | { kind: "canonical" }
      | { kind: "recluseAsDemon"; registeredCharacterId: "imp" };
  };
};
```

`expectedEventCount` is required because an unsuccessful Slayer event leaves the same Discussion
step current. A step ID alone cannot distinguish an old draft from a command created after another
event. Proposal rejects a count mismatch as `STALE_COMMAND` before constructing an event.

`targetRegistration` is always explicit. `canonical` is required for ordinary targets and for a
Recluse that does not register as Demon. `recluseAsDemon` is valid only when the target is the
actual Recluse; Rust rejects it for Spy and every other Character.

### Confirmed Event

Add a strict schema-version-2 event:

```ts
type SlayerAbilityUsedEvent = {
  type: "slayerAbilityUsed";
  payload: {
    discussionStepId: string;
    actorPlayerId: string;
    targetPlayerId: string;
    impairmentContext:
      | { kind: "healthy" }
      | {
          kind: "poisoned";
          sourcePlayerId: string;
          sourceEventId: string;
        };
    registrationContext:
      | { kind: "canonical"; registeredAsDemon: boolean }
      | {
          kind: "recluseDecision";
          registeredAsDemon: boolean;
          registeredCharacterId?: "imp";
        };
    outcome:
      | {
          kind: "noEffect";
          reason: "actorPoisoned" | "targetNotDemon" | "targetAlreadyDead";
        }
      | { kind: "deathPending"; playerId: string };
  };
};
```

The event is the single auditable ability-spend transition. Replay recomputes and verifies every
context and outcome field from the event-log prefix; it rejects forged or inconsistent payloads.
Outcome precedence is actor poisoned, target already dead, target not registered as Demon, then
Death pending.

Event summaries remain public-result shaped and concise:

- `학살자: 3번 서연 → 1번 민지 · 아무 일도 없음`
- `학살자: 3번 서연 → 9번 태오 · 사망 확인 필요`

The detailed impairment and registration reason remains available in the typed event payload for
audit/export without expanding live-play copy.

### Replay Projection and Follow-up

Replay adds an optional global rule projection because the once-per-game state must survive every
phase:

```ts
type SlayerAbilityState = {
  actorPlayerId: string;
  spent: boolean;
  canUseNow: boolean;
};
```

`canUseNow` is true only when the actor is alive, the ability is unspent, the current step is typed
Discussion, and no Slayer Death follow-up is pending. Rust remains the source of truth for the
icon's enabled state.

A `deathPending` outcome generates:

```ts
type SlayerDeathStep = {
  id: `${discussionStepId}:slayerDeath`;
  phase: "day";
  stepType: "slayerDeath";
  requiredInput: {
    kind: "slayerDeathDecision";
    playerId: string;
    survivalAllowed: false;
  };
};
```

Confirming it creates the existing strict `deathConfirmed` event with `stepId` and `playerId`.
Until then the target remains alive. After confirmation replay marks the target dead and returns to
the same Discussion step. There is no survival action for a successful Trouble Brewing Slayer
shot.

## Validation and Error Contract

Proposal and full replay validation must reject:

- any current phase/step other than typed Discussion: `SLAYER_WRONG_PHASE`;
- mismatched `expectedEventCount`: `STALE_COMMAND`;
- a missing, unknown, dead, non-Slayer, or already-spent actor: `INVALID_SLAYER_ACTOR` or
  `SLAYER_ALREADY_USED` as applicable;
- a missing or unknown target: `INVALID_SLAYER_TARGET`;
- a non-Recluse `recluseAsDemon` choice, a missing registration choice, or any Spy-as-Demon
  judgment: `INVALID_SLAYER_REGISTRATION`;
- a second Slayer-use event in replay;
- an event whose phase, actor/target, impairment source, registration context, outcome, or pending
  Death relationship does not match the canonical prefix state.

The target being dead is not a validation error. It canonically produces
`noEffect/targetAlreadyDead` and still spends the ability.

## Rust Production Change Map

- `contracts.rs`: typed command, event payload, impairment/registration/outcome enums, and strict
  serde field handling.
- `model.rs`: `SlayerAbilityState`, Slayer Death step types, and replay projection.
- `characters/trouble_brewing.rs`: actual-Slayer eligibility and script-specific target registration
  resolution. Keep Slayer rules here rather than adding a character-specific module.
- `day.rs`: the Discussion public-action seam, spent-state derivation, and generated Slayer Death
  follow-up.
- `proposal.rs`: stale-count, actor, target, timing, registration, and poison validation; canonical
  event and follow-up proposal construction.
- `replay.rs`: strict replay-time recomputation, duplicate-use rejection, pending follow-up
  restoration, and step-linked Death validation.
- `messages.rs`: concise confirmed-event summaries, proposal feedback, and Korean error messages.
- `error.rs`: stable Slayer validation codes and compact Korean messages.
- `tests/`: black-box JSON-boundary scenarios plus implementation-coupled rule unit tests where
  useful.

## Web Production Change Map

- `core/types.ts`: command, event, replay projection, Slayer Death step, and typed context unions.
- `core/validation.ts`: strict validation for imported/replayed Slayer contracts.
- `gameStore.ts`: `useSlayerAbility` proposal/append path using the current event count; keep the
  existing event log as the sole persisted source of truth.
- `main.tsx`: compose the Rust-derived Slayer state, Grimoire entry callback, popup draft, and
  phase follow-up without moving domain decisions into React.
- `features/grimoire/Grimoire.tsx`: show only the actual Slayer's ability icon and consume a narrow
  `enabled/spent/onUse` prop. It must not import the store or infer timing.
- `features/public-actions/SlayerAbilityDialog.tsx`: actor-fixed popup, all-Player target selection,
  conditional Recluse judgment, review, warning, accessibility, and confirm/cancel behavior.
- `features/phase-control/PhaseControl.tsx` and `phaseInput.ts`: distinct Slayer Death confirmation
  and concise post-confirmation feedback.
- `styles.css`: target iPad modal, actionable/disabled Slayer icon, and follow-up treatment.
- unit/integration tests: icon availability, popup contract, registration choice, Command creation,
  core error display, result feedback, and Death follow-up.

The production UI will not add passive Character icons to every Grimoire seat as part of this
issue. Only the requested Slayer ability icon is added.

## Sequential Test-First Handoff

After user approval:

1. Sol freezes the acceptance criteria and JSON contract in this plan.
2. `luna_logic_worker` receives only the approved requirements, stable public contracts, project
   specs, and existing test conventions. It does not receive the production change map and does
   not edit production source.
3. The test worker writes the smallest black-box Rust boundary and user-visible workflow tests and
   demonstrates failures caused by the missing Slayer behavior.
4. Sol reviews the tests and personally reruns the failing cases. Harness, dependency, or unrelated
   failures do not satisfy the gate.
5. Only then a separate `luna_worker` implements production behavior and may add coupled unit
   tests. It must not weaken, delete, or rewrite the approved behavioral tests without Sol approval.
6. Test and production implementation remain sequential and use this issue worktree.

Required failing behavioral coverage:

- available only for the living, unspent actual Slayer during Discussion;
- rejects a Drunk shown Slayer, bluffing/non-Slayer actor, dead actor, wrong phase, stale count,
  unknown target, and repeated use;
- successful canonical Imp and Recluse-as-Demon shots;
- ordinary miss, poisoned actual Slayer, and dead-target no-effect outcomes that still spend;
- Spy cannot receive the Demon registration choice;
- exact auditable event payload and replay rejection of inconsistent payloads;
- no alive/dead mutation before the separate Death confirmation;
- undo, reload, export, and import restore spent state and a pending Death follow-up;
- Grimoire icon availability, popup wording/selection, explicit Recluse decision, miss feedback,
  and successful Death follow-up.

## Verification and Completion

After implementation:

- run `cargo fmt --check`;
- run `cargo test --workspace`;
- run `pnpm --dir web test`;
- run `pnpm --dir web build`;
- bind local validation to `0.0.0.0` and inspect the 1366 x 1024 iPad viewport;
- exercise Discussion availability, every popup selection path, disabled icon states, miss, poison,
  Recluse success/miss, and Death follow-up;
- review the complete diff for rule leakage into TypeScript, replay/event drift, accidental Drunk or
  Spy support, silent life-state mutation, unnecessary live-play copy, and persistence regressions;
- commit the approved prototype/plan and finished implementation, then push `codex/issue-50`;
- report regression coverage, final commit, pushed branch, and any blocked checklist item.
