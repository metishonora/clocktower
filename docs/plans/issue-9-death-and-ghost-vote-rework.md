# Issue 9: Execution Death Resolution and Ghost-Vote Rework

## Status

Approved on 2026-07-16. The development-only UI prototype was approved on 2026-07-16. Production
implementation, sequential behavioral-test handoff, independent review, and final verification were
completed on 2026-07-16.

Work remains on branch `codex/issue-9` in `/private/tmp/clocktower-issue-9`.

## Updated Baseline

This plan is based on `main` at `7ea6145`, after issue #33 and issue #31 were merged.

The following issue #9 requirements are already owned by the updated baseline and will not be
reimplemented:

- Rust calculates `max(1, ceil(livingPlayers / 2))` as the execution threshold.
- Rust derives the current execution candidate from every confirmed nomination in the current Day.
- A qualifying top tie clears the candidate, a lower tie does not displace a higher unique leader,
  and a later unique higher result becomes the candidate.
- The nomination event and replay contract use strict `schemaVersion: 2`; schema version 1 remains
  intentionally unsupported.
- The live UI shows the replay-derived confirmed standing and does not project an unconfirmed Draft
  candidate.
- Daily nominator and nominee eligibility comes from Rust replay.

Issue #9 will preserve those contracts and add only the remaining execution/Death, Grimoire,
proposal-preview, and ghost-vote lifecycle behavior.

## Approved Product Decisions

1. Keep the official vote threshold already implemented by #33.
2. Keep strict schema version 2 and do not restore schema-version-1 import compatibility.
3. After a confirmed execution, require a separate execution-Death resolution step.
4. Model both `died` and `survived` outcomes in the generic contract so a future script can allow
   execution without Death.
5. Trouble Brewing does not allow the `survived` outcome. Its button remains visible but dimmed and
   disabled, and the Rust core rejects a forged command or imported event that selects it.
6. Always show explicit alive/dead and ghost-vote state on confirmed Grimoire seats.
7. Use concise operational values and labels; do not add prose that repeats visible state.

## Acceptance Criteria

### Execution and Death

- Confirming `day:execution` still creates `executionConfirmed` and does not change `Player.alive`.
- A confirmed execution makes `day:executionDeath` the next current step for the executed Player.
- The step displays the executed seat and Player, an enabled `사망 확정` action, and a visible but
  disabled `사망하지 않음` action for Trouble Brewing.
- Confirming Death creates a distinct `deathConfirmed` event tied to `day:executionDeath`, changes
  that Player to dead only during replay, and advances to `day:toNight`.
- A direct Trouble Brewing command for `died: false` fails with a stable domain error and appends no
  event.
- A schema-version-2 Trouble Brewing file containing an execution-survival event is rejected in
  full rather than partially replayed.
- Confirming `noExecutionConfirmed` advances directly to `day:toNight`; the execution-Death step is
  derived as skipped and is never presented as the current step.
- Undoing `deathConfirmed` restores the Player to alive and returns to `day:executionDeath` through
  normal replay.

### Grimoire and Ghost Votes

- Every confirmed seat always displays exactly one concise status:
  - `생존`
  - `사망 · 유령표 남음`
  - `사망 · 유령표 사용됨`
- Dead seats remain visually distinct outside voting mode. Used-ghost seats receive the strongest
  muted treatment.
- During voting, a dead Player with an unused ghost vote is selectable from the Grimoire.
- A dead Player whose ghost vote is already used is visibly unavailable and cannot be selected.
- The nomination input continues to show live valid vote count and the exact ghost votes that will
  be spent before confirmation.
- Confirmation stores the spent ghost Player IDs in the canonical nomination event and replay marks
  them used.
- The spent ghost vote cannot be selected or confirmed again.
- Undo removes the latest nomination event and restores the ghost vote; reloading or importing the
  same valid v2 file preserves the used state.

### Candidate Preview Consistency

- The confirmed UI standing remains replay-only and does not change while the Draft changes.
- Rust uses one shared standing derivation for replay and nomination Proposal preview.
- The Proposal preview for a nomination reports the projected post-confirm threshold, highest vote
  count, and nullable execution candidate.
- Appending that Proposal event and replaying produces exactly the same standing, including top ties,
  lower ties, below-threshold results, and a new higher unique candidate.

## Stable Public Contract

### Generated Day Step

Rust adds this semantic step after `day:execution`:

```ts
type PhaseStep = {
  id: "day:executionDeath" | `day${number}:executionDeath`;
  phase: "day";
  stepType: "executionDeath";
  playerId: string;
  requiredInput: {
    kind: "executionDeathDecision";
    target: "execution";
    executionSurvivalAllowed?: boolean;
    optional: false;
  };
  canSkip: false;
};
```

For Trouble Brewing, `executionSurvivalAllowed` is absent or `false`. The field belongs to the Rust
step contract so the UI never guesses script rules.

### Command Input

The existing `confirmStep` command is reused:

```ts
{
  type: "confirmStep";
  payload: {
    stepId: "day:executionDeath";
    input: { died: boolean };
  };
}
```

`died: false` is structurally valid but invalid for a Trouble Brewing step whose
`executionSurvivalAllowed` is false.

### Confirmed Events

Execution-caused Death extends the existing event without breaking current schema-version-2 Death
events used elsewhere:

```ts
{
  type: "deathConfirmed";
  payload: {
    playerId: string;
    stepId?: string;
  };
}
```

- Existing v2 Death events without `stepId` remain valid and continue to reduce Player state only.
- A Death event with `stepId` also completes the matching execution-Death step.

The future-compatible non-Death outcome is explicit:

```ts
{
  type: "executionSurvivalConfirmed";
  payload: {
    stepId: string;
    playerId: string;
  };
}
```

Trouble Brewing proposal and replay validation reject this event. A future script may enable it by
returning `executionSurvivalAllowed: true` for its generated step; no schema change will then be
needed.

### Nomination Proposal Preview

The persisted v2 nomination event remains unchanged. Only its non-persisted Proposal preview gains
the shared standing:

```ts
{
  voteCount: number;
  ghostVoteSpentPlayerIds: string[];
  executionStanding: {
    executionVoteThreshold: number;
    highestVoteCount: number;
    executionCandidate: null | {
      nomineeId: string;
      voteCount: number;
    };
  };
}
```

The production UI does not render this projected candidate; it continues to render the latest
successful replay state as required by #33.

## Domain Design

### Day Step Generation

- Add `executionDeath` after `execution` in `day_steps`.
- `ExecutionConfirmed` completes only `day:execution`, leaving `day:executionDeath` current.
- `NoExecutionConfirmed` completes `day:execution` and derives `day:executionDeath` as skipped so
  the next current step is `day:toNight`.
- The execution-Death step carries the executed `playerId` from replay-derived Day state rather than
  accepting an editable Player selection from TypeScript.

### Proposal and Replay

- Route `StepType::ExecutionDeath` to a dedicated proposal function in `proposal.rs`.
- Resolve the Player from the current Day's `confirmedExecution`; reject missing or mismatched state.
- Produce `DeathConfirmed` for `died: true`.
- Produce `ExecutionSurvivalConfirmed` only when the generated step explicitly allows it.
- Extend phase-status replay so step-linked Death/survival events complete only the current matching
  execution-Death step.
- Keep Player mutation in `replay_players`; proposals and UI never mutate alive state directly.
- Validate event order, phase, Player identity, alive state, and Trouble Brewing survival eligibility
  before accepting the complete log.

### Shared Candidate Standing

- Extract the existing #33 threshold/highest/unique-leader calculation into a pure helper owned by
  `day.rs`.
- Use the helper from `replay_day_state` without changing existing derived results.
- Use it again after adding the proposed nomination record to the prior current-Day nominations.
- Serialize that result into Proposal preview and keep the canonical nomination event minimal.

## UI Prototype Gate

After this plan is approved, first build a development-only prototype in the issue worktree. It will
not call the real store or create production events.

The prototype will show these switchable states at the target 1366 x 1024 iPad viewport:

1. Normal Grimoire with alive, dead/unspent, and dead/spent status badges.
2. Voting mode with a selected dead ghost voter and a disabled spent ghost voter.
3. Execution-Death resolution with executed Player context, enabled `사망 확정`, and dimmed disabled
   `사망하지 않음`.
4. Post-Death Grimoire state before transition to Night.

Review will focus on arm's-length status legibility, seat-card crowding, clear disabled treatment,
and avoiding explanatory copy. Production UI work pauses until the user approves this prototype.

## Sequential Test-First Handoff

After prototype approval, Sol finalizes the acceptance criteria and public contract above and uses
the required sequential handoff:

1. `luna_logic_worker` receives only the approved behavior, public contracts, project specs, and
   existing black-box test conventions. It does not receive a production implementation design and
   does not edit production files.
2. The test worker adds the smallest behavioral/regression coverage at Rust JSON and React user-flow
   seams and demonstrates failures caused by the missing behavior.
3. Sol reviews the tests and personally verifies the intended failures. Harness, dependency, and
   unrelated failures do not satisfy the gate.
4. Only then, a separate `luna_worker` implements production changes and may add implementation-
   coupled unit tests. It must not weaken or rewrite approved behavioral tests.
5. Test authoring and production implementation remain sequential, not parallel.

The failing behavioral coverage must establish:

- Execution -> execution-Death -> distinct Death event -> dead Player -> transition to Night.
- No execution bypasses the execution-Death current step.
- Trouble Brewing disables/rejects survival in UI, proposal, and strict replay.
- Death visibility outside voting and dead-unspent/dead-spent voting behavior.
- Ghost-vote preview, persistence, rejection after spending, undo restoration, and stable v2
  reload/import.
- Proposal-preview standing equals replay standing for the required candidate sequences.

## Production Change Map

Rust domain:

- `contracts.rs`: optional Death `stepId`, execution-survival event, and typed command fields.
- `model.rs`: execution-Death step/input types and survival capability flag.
- `day.rs`: execution-Death generation and shared standing derivation.
- `proposal.rs`: Death/survival proposal routing and projected nomination standing.
- `replay.rs`: strict step-linked event validation, status progression, and Player replay behavior.
- `messages.rs`: concise Korean execution-Death event summaries and preview values.
- `error.rs`: stable error for disallowed execution survival if an existing error is not precise.
- `tests/`: black-box execution/Death, candidate-preview, ghost lifecycle, and invalid-log cases.

Web:

- `core/types.ts`: v2 event, step, input, and RequiredInput additions.
- `core/validation.ts`: exact validation for both Death payload forms and the survival event.
- `features/phase-control/phaseInput.ts`: typed execution-Death title, input label, and payload.
- `features/phase-control/StepInputs.tsx`: executed Player result actions and disabled Trouble Brewing
  survival control.
- `features/phase-control/PhaseControl.tsx`: route the new typed step without duplicating rules.
- `features/grimoire/Grimoire.tsx`: persistent life/ghost status badge and accessible state label.
- `voting.ts`: keep vote eligibility helpers focused on Draft selection; add or extract display-state
  helpers only if shared by tests and Grimoire.
- `styles.css`: status badge, dead/spent seat hierarchy, and disabled survival treatment.
- unit/integration tests: visible states, disabled behavior, command payload, event append, replay,
  autosave, undo, and import/reload paths.

Development-only prototype:

- Add a focused issue-9 prototype component and CSS or extend the existing Day voting prototype
  without coupling it to production features.
- Add a development query route and `pnpm` script following the repository's existing prototype
  convention.

Documentation:

- Update `ARCHITECTURE.md` for the execution-Death semantic step, optional step-linked Death event,
  future survival event, and Rust-owned capability flag.
- Keep `schemaVersion: 2`; do not document or add a v1 migration path.

## Verification and Completion

After implementation:

1. Run `cargo fmt --check`.
2. Run `cargo test --workspace`.
3. Run `pnpm --dir web test`.
4. Run `pnpm --dir web build`.
5. Bind the local prototype/production server to `0.0.0.0` and visually verify 1366 x 1024 plus the
   existing narrow responsive layout.
6. Exercise normal Death, disabled survival, no execution, ghost vote spend, undo, reload, and import
   paths in the production UI.
7. Review the complete diff for schema-v2 drift, duplicate candidate logic, TypeScript-owned rules,
   accidental alive-state mutation, excessive live-play copy, and weakened strict replay validation.
8. Commit the reviewed work on `codex/issue-9` and push the branch.
9. Report the final commit, pushed branch, tests, prototype decision, regression coverage, and any
   blocker. Do not close issue #9 unless every reworked acceptance criterion is satisfied.

## Explicit Non-Goals

- Restoring or migrating schema-version-1 files.
- Adding another playable character script.
- Implementing a Trouble Brewing rule that permits survival after execution.
- Changing #31 nomination eligibility.
- Replacing #33's confirmed replay-only candidate standing with a Draft projection.
- Adding timers, alarms, public abilities, win-condition handling, or unrelated Day controls.
