# Issue 177: Ordered Death and survival foundation implementation plan

## Status

Implemented and verified on 2026-08-24 after the contract, implementation plan, and black-box-test
review checkpoints were approved. This document and its black-box tests remain the foundation
contract for follow-up Character producers.

The plan implements Issue #174 decision D3 as a script-neutral contract. It does not automate any
Bad Moon Rising Character and does not expose Bad Moon Rising Production UI.

## Objective

Add the smallest shared Death contract that can:

1. persist a complete Death action without leaving a replayable incomplete attempt;
2. preserve source, target, phase, stable target order, explicit bypass policy, applicable
   prevention checks, and the final outcome;
3. apply every target resolution in order so later targets observe earlier actual Deaths;
4. distinguish actual Death, protection/survival, and a source or target that produced no valid
   Death attempt;
5. keep Execution occurrence independent from whether the executee dies;
6. retain Storyteller-only provenance while reusing the existing restricted public announcement
   events;
7. preserve the same meaning through schema-v3 JSON, replay, import/export, canonical Undo, and the
   real Rust/WASM/TypeScript boundary; and
8. accept all existing Trouble Brewing and Sects & Violets event streams without migration or
   reinterpretation.

## Non-goals

- Sailor, Innkeeper, Tea Lady, Devil's Advocate, Pacifist, Fool, Assassin, or another Character's
  protection calculation or ability-spent behavior.
- Goon target-by-target interruption or alignment change.
- Pukka and other delayed or scheduled Deaths.
- Shabaloth Resurrection, Zombuul public-life state, or Mastermind game-end deferral.
- A generic Storyteller command that can author arbitrary Death results.
- Production UI, BMR route/theme/assets, or public Reveal presentation.
- Rewriting legacy `deathConfirmed`, `executionSurvivalConfirmed`, `nightActionResolved`, or
  `pitHagArbitraryDeathsConfirmed` events.
- A destructive migration or schema-version increase.

## Inherited constraints and proposed D3 direction

- This plan proposes the Issue #174 D3 recommendation: a script-neutral Death contract rather than
  Character-owned Death event variants.
- The Rust core remains the canonical event author and replay authority.
- The WASM boundary remains stateless and JSON-based.
- Historical TB/S&V persisted event meanings and successful imports remain unchanged.
- BMR Character automation and all visual decisions remain deferred.

## Approved contract decisions

### 1. One complete event per ordered action

Add one additive schema-v3 event discriminator, `orderedDeathResolved`. The enclosing
`GameEvent.id` is the stable action/group identity; its payload owns the source and a non-empty
ordered list of complete target resolutions. Do not duplicate the event ID as a second payload
`actionId` that could disagree with it.

Do not persist `deathAttemptCreated` or another incomplete canonical event. Draft target selection
and future per-target Storyteller choices remain outside the canonical stream until the full action
can be confirmed. A crash before confirmation therefore leaves no partial Death action to replay.

The array order is canonical and every entry also carries a one-based `sequence`. The two must
agree and sequences must be exactly `1..N`. Existing duplicate `GameEvent.id` rejection guarantees
action identity uniqueness.

### 2. Source is a tagged union

Not every Death has a source Character. Use an explicit union instead of nullable Character fields:

```ts
type OrderedDeathSource =
  | {
      kind: "ability";
      abilityUse: AbilityUseRef;
      abilityOrigin: AbilityOrigin;
    }
  | {
      kind: "execution";
      executionEventId: string;
    }
  | {
      kind: "event";
      sourceEventId: string;
      cause: "rulesConsequence";
    };
```

`abilityUse` supplies actor Player, source Character, and ability-instance provenance. `execution`
keeps the public execution decision separate from its actual Death result. `event` is limited to a
prior canonical source; it is not a free-form Character-name escape hatch.

Ability references must match the actor's replayed ability instance and approved `AbilityOrigin`
immediately before the action; setup ability instances retain their existing synthetic `setup`
origin rather than pretending the Setup event ID created them. Event references must resolve to the
matching prior canonical event. Execution references must resolve to a prior
`executionConfirmed` event for the attempted Player.

### 3. Bypass policy is explicit data

Each attempt carries one of:

```ts
type DeathBypassPolicy =
  | { kind: "none" }
  | { kind: "allTargetProtections" };
```

The pipeline never infers bypass from `source.characterId === "assassin"` or another Character
string. Future rules may add a typed policy variant, but existing variants must not change meaning.

### 4. Prevention audit records every applicable candidate

An attempt stores all applicable protection candidates in evaluation order:

```ts
type PreventionCheck = {
  sequence: number;
  source: {
    abilityUse: AbilityUseRef;
    abilityOrigin: AbilityOrigin;
  };
  selection: "deterministic" | "storyteller";
  decision: "applied" | "notApplied" | "bypassed";
};
```

Candidate sequences are one-based and contiguous. `allTargetProtections` requires every candidate
to be `bypassed`. `none` forbids `bypassed`. At most one candidate may be `applied`, and a
`prevented` outcome must reference exactly that applied candidate by `preventionSequence`.
`occurred` forbids an applied candidate. `noEffect` represents a failure before target protection
resolution and therefore requires an empty candidate list.

This foundation validates and preserves these decisions; it does not discover candidates or make
Character-specific decisions.

### 5. Outcome has three semantic variants

Use a third `noEffect` variant rather than describing an invalid source or already-dead target as
"protected":

```ts
type OrderedDeathOutcome =
  | { kind: "occurred"; playerId: string }
  | { kind: "prevented"; preventionSequence: number }
  | {
      kind: "noEffect";
      reason: "sourceInvalid" | "actorImpaired" | "targetAlreadyDead" | "targetIneligible";
    };
```

`occurred.playerId` may differ from `attempt.targetPlayerId`, preserving redirects such as a Mayor
bounce without pretending the original target died. Only `occurred` changes actual life state.
`prevented` and `noEffect` must not create a Death, trigger Death consequences, or consume a ghost
vote.

### 6. Canonical wire shape

```ts
type OrderedDeathResolvedPayload = {
  source: OrderedDeathSource;
  resolutions: Array<{
    sequence: number;
    attempt: {
      targetPlayerId: string;
      bypassPolicy: DeathBypassPolicy;
    };
    preventionChecks: PreventionCheck[];
    outcome: OrderedDeathOutcome;
  }>;
};
```

The enclosing `GameEvent.phase` is the authoritative phase for every resolution in the action.
The event and nested structs use strict unknown-field rejection in Rust and exact-key runtime
validation in TypeScript.

### 7. Ordered replay semantics

Replay validates and applies `resolutions` from sequence 1 through N:

- every target and occurred Player must exist;
- an `occurred` Player must be alive immediately before that sequence;
- `targetAlreadyDead` must refer to a target dead at that sequence, including a Death from an
  earlier resolution in the same action;
- duplicate actual Deaths in one action are invalid;
- first-night/night occurred outcomes enter the existing unannounced night-Death projection in the
  same order;
- prevented/no-effect outcomes leave actual life and public announcement state unchanged; and
- later generic Death consumers receive stable `(eventId, sequence)` identity rather than
  reconstructing order from Character-specific payloads.

Semantic violations return `INVALID_DEATH_RESOLUTION`. Broken prior-event or ability-instance
references continue to return `INVALID_EVENT_REFERENCE`. Shape failures return `MALFORMED_EVENT`.

### 8. Execution and atomic Undo

`executionConfirmed` continues to establish that an Execution occurred and that the Day ends even
if its Death is prevented. An execution-sourced ordered Death event records only the actual Death
resolution.

One ordered event is already an atomic Undo unit. When its source references a causal event such as
`executionConfirmed`, canonical Undo groups the source, intervening required follow-ups, and the
ordered resolution using the typed source reference. It must not infer the relationship from a
step-ID suffix or Character name.

### 9. Public/private boundary

`orderedDeathResolved` is Storyteller-only canonical state and may contain ability provenance and
protection decisions. There is deliberately no phase-neutral projector: exposing a prevented night
target would reveal who was attacked. Public projection is source- and timing-specific:

- first-night/night prevented and no-effect targets produce no public value;
- first-night/night actual Deaths become eligible only for
  `nightDeathsAnnounced.playerIds` at the dawn announcement step;
- Execution occurrence is public through `executionConfirmed`; an execution-sourced ordered
  resolution may project only `{ playerId, outcome: "died" | "survived" }` because the executee is
  already public, and it must omit the attempt, source, bypass, and prevention data;
- legacy `executionSurvivalConfirmed` remains accepted and continues to expose only step and Player
  identity, never a protection cause;
- ability/event-sourced daytime results remain private until the owning Character workflow defines
  its public announcement; and
- no public/Reveal payload receives `source`, `preventionChecks`, `bypassPolicy`, ability-instance
  IDs, or private cause data.

This issue adds no component that accepts a canonical `GameEvent` as a Reveal payload.

### 10. Legacy compatibility

- Keep schema version 3.
- Deserialize and replay every legacy Death-bearing event exactly as today.
- Add a shared internal Death-fact iterator that can read new `(eventId, sequence)` facts and map
  legacy Deaths to their existing stable order without rewriting stored JSON.
- Existing TB/S&V commands keep emitting their approved legacy events in this issue. Converting a
  Character producer to `orderedDeathResolved` requires its own behavior issue and acceptance
  coverage.
- Existing fixtures must remain byte-compatible on import/export unless the existing exporter
  already normalizes envelope metadata.

## Runtime and module ownership

### Rust domain

- `contracts.rs`: wire structs/enums and the new `GameEventKind` discriminator.
- A small shared Death module: semantic validation, ordered application, source reference checks,
  and legacy/new Death-fact iteration.
- `boundary.rs`: duplicate identity and explicit prior-event reference integrity.
- The shared Death module: validate ability-instance provenance against the replay timeline.
- Script replay modules: delegate generic state application, night-announcement eligibility, and
  restricted execution projection to the shared module without adding Character-name branching.
- `error.rs`: stable `INVALID_DEATH_RESOLUTION` response.

Character-specific candidate discovery, protection priority, bypass selection, and ability-spent
effects remain in `characters/<script>.rs` when their own issues are implemented.

### TypeScript boundary

- `types.ts`: additive event and nested union types.
- `wireDiscriminators.ts`: keep Rust and TypeScript discriminators locked together.
- `validation.ts`: exact shape plus sequence/cross-field validation before a value becomes a typed
  `GameEvent`.
- `canonicalUndo.ts`: group typed causal source references; no Character/step-name inference for
  the new contract.

### WASM

No new endpoint is needed. `replay` supplies the real JSON round-trip and rejection boundary for
imported canonical events. Future Character commands will produce the same event through
`propose`.

## Acceptance invariants and strongest evidence

| ID | Externally observable invariant | Strongest planned evidence |
| --- | --- | --- |
| OD-01 | Ability source, actor, Character, ability instance, phase, target, sequence, and bypass survive without loss | Shared schema-v3 fixture accepted by Rust and TS parsers; real WASM replay after export/import |
| OD-02 | A multi-target action applies exactly in stored order | Rust replay asserts per-Player life and ordered unannounced Death IDs |
| OD-03 | `occurred`, `prevented`, and `noEffect` remain distinct | Rust replay state plus strict TS tagged-union validation |
| OD-04 | Prevention candidates and final selection are auditable | Parsed canonical event deep-equals the fixture after TypeScript import/export |
| OD-05 | Missing, duplicate, reordered, or forged sequences are rejected | Rust `INVALID_DEATH_RESOLUTION` table test and TS runtime rejection table |
| OD-06 | Explicit bypass cannot contradict candidate decisions | Rust/TS tampered-payload rejection |
| OD-07 | Execution remains recorded when its Death is prevented | Execution-source replay scenario and typed causal Undo test |
| OD-08 | Undo never leaves part of an ordered action | Single-event multi-target Undo and execution-source grouped Undo tests |
| OD-09 | Public announcement omits private provenance | Strict `nightDeathsAnnounced`/execution-survival payload regression tests |
| OD-10 | Old TB/S&V files keep their exact meaning | Existing acceptance suites plus focused representative legacy replay tests |
| OD-11 | Actual WASM and TypeScript agree on acceptance/rejection | Generated-WASM integration fixture and tampered replay test |

## Black-box test files written before implementation

- `fixtures/acceptance/shared/issue-177-ordered-death.json`
  - one prevented target followed by one actual Death;
  - complete ability provenance and a deterministic prevention candidate;
  - stable ordered result used by both Rust and TypeScript tests.
  - This is a synthetic shared-contract fixture, not a claim that Shabaloth acts on the first
    night; Character timing and target-count legality stay with later Character producers.
- `crates/domain/src/tests/issue177_ordered_death_foundation_scenarios.rs`
  - valid ordered replay and night projection;
  - tampered sequence, prevention, bypass, and provenance rejection;
  - explicit bypass policy taking precedence over an Assassin source Character name;
  - legacy replay regression.
- `web/src/core/issue177OrderedDeathContract.test.ts`
  - TypeScript strict event validation and tamper rejection;
  - canonical multi-target and execution-causal Undo behavior.
- `web/test/issue177OrderedDeathFoundation.integration.test.tsx`
  - real generated WASM replay after TypeScript import/export;
  - real WASM semantic rejection of a reordered payload.

The pre-implementation `develop` baseline confirmed the intended red state: positive contract
acceptance, semantic error-code, real-WASM, and typed causal-Undo assertions failed because
`orderedDeathResolved` was not a known event, while legacy and existing-public-payload privacy
regressions passed. All of these tests pass after the implementation recorded below.

## Implementation sequence after approval

1. Confirm the implementation-plan and black-box-test review checkpoint, then freeze the JSON
   fixture.
2. Add Rust wire types, discriminator, errors, and strict structural deserialization.
3. Add shared semantic validation and ordered replay application.
4. Add TypeScript types, discriminator, and runtime validation.
5. Add typed causal Undo grouping and public-projection privacy regression coverage.
6. Regenerate WASM and make the real boundary tests pass.
7. Run focused tests, then `cargo test --workspace`, `pnpm --dir web test`, and
   `pnpm --dir web build`.
8. Review invariant-to-evidence coverage separately from command success and record any remaining
   Character-automation gaps as follow-up work.

## Approved review decisions (2026-08-24)

1. **Outcome taxonomy** — approved `occurred | prevented | noEffect` so invalid/no-op attempts are
   not mislabeled as protection.
2. **Persistence atomicity** — approved exactly one `orderedDeathResolved` event containing the
   complete ordered action; do not persist an incomplete attempt.
3. **Foundation API boundary** — approved no generic arbitrary-Death command; validate imported
   events through replay and let later Character commands produce them.
4. **Public projection** — approved reuse of `nightDeathsAnnounced`, `executionConfirmed`, and
   the legacy `executionSurvivalConfirmed` contract where already persisted; derive new sanitized
   death/survival values only for public executees, never expose prevented night targets, and do not
   persist a duplicate resolution or add a provenance-bearing Reveal type.
5. **Legacy strategy** — approved preserving old events and adding a shared legacy/new read model
   rather than migrating or immediately converting TB/S&V producers.

## Implementation verification

- Rust workspace: 375 domain tests and 4 WASM adapter tests passed.
- TypeScript unit boundary: 167 tests passed, including all four Issue #177 contract tests.
- Generated-WASM integration: 82 files and 592 tests passed, including both Issue #177 real-WASM
  scenarios.
- Production TypeScript compilation and Vite/PWA build passed with the optimized release WASM.
- Invariant review found no uncovered foundation invariant; Character-specific production commands,
  public UI, protection discovery, and delayed/resurrection/game-end behavior remain intentional
  follow-up gaps under the approved non-goals.
