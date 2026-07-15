# Issue 33: Day Stages and Canonical Execution Candidate

## Status

Approved on 2026-07-16 after the development-only UI prototype review.

Implementation must remain in the `codex/issue-33` branch and its dedicated worktree. Production
work starts with the sequential behavioral-test handoff described below.

## Scope

Issue #33 will:

- split the existing Day flow into explicit Death Announcement, Whisper, Discussion,
  Nomination/Voting, and Execution steps;
- correct the execution threshold to at least half of living Players, rounded up, with a minimum
  of one vote;
- make Rust the sole owner of the threshold, highest confirmed vote count, and execution
  candidate derived from all confirmed nominations in the current day;
- replace incremental candidate flags and duplicated stored values with a strict schema-version-2
  nomination event;
- show one large confirmed execution-candidate standing during Nomination/Voting;
- reject incompatible or invalid files in full rather than partially replaying them.

The following work stays outside #33:

- once-per-day nominator and nominee eligibility and its dimmed/disabled UI: #31;
- the Slayer public ability during Discussion: #50;
- current-Day elapsed runtime: #51;
- timers, countdowns, alarms, other public abilities, and partial replay recovery.

## Approved Day Flow

Day remains the top-level `Phase`. Rust adds typed Day steps rather than expanding the top-level
phase enum:

```text
Death Announcement
  -> Whisper
  -> Discussion
  -> Nomination/Voting (one or more confirmed nominations)
  -> Execution
  -> transition to Night
```

The step IDs follow the existing cycle-prefix convention:

```text
day:announceDeaths
day:whisper
day:discussion
day:nomination:1
day:execution

day2:announceDeaths
day2:whisper
day2:discussion
day2:nomination:1
day2:execution
```

`StepType` gains `whisper` and `discussion`. TypeScript renders these typed values and must not
infer behavior by parsing the step ID. Confirming Death Announcement enters Whisper. The Whisper
action is `토론 시작`; the Discussion action is `지명 및 투표 시작`. These transitions use the
canonical Command, Proposal, Confirmed Event, and replay path, so they remain auditable and
undoable.

## Execution Threshold and Standing

Rust calculates:

```text
executionVoteThreshold = max(1, ceil(livingPlayers / 2))
```

Representative thresholds are:

- 5 living Players -> 3 votes;
- 6 living Players -> 3 votes;
- 7 living Players -> 4 votes;
- 8 living Players -> 4 votes;
- 0 or 1 living Player -> minimum 1 vote.

Candidate derivation uses every confirmed nomination in the current day:

1. derive each nomination's vote count from its confirmed unique voter IDs;
2. find the highest confirmed vote count, or zero when no nomination is confirmed;
3. return no execution candidate when that count is below the threshold;
4. return the Player when exactly one nominee has the highest qualifying count;
5. return no execution candidate when multiple nominees share the highest qualifying count;
6. ignore ties below an existing higher unique candidate;
7. allow a later new unique higher count to become the candidate.

Required examples:

- A 5, then B 5 -> no candidate, highest count 5;
- A 5, then B 3, then C 3 -> A remains candidate with 5;
- A 5, then B 5, then C 6 -> C becomes candidate with 6;
- every unique or tied result below threshold -> no candidate with the actual highest count.

## Schema-Version-2 Contract

Compatibility with schema version 1 is intentionally not preserved. Rust, TypeScript storage,
import validation, tests, and generated WASM contracts move to `schemaVersion: 2` together.

The persisted nomination event is flattened and contains only canonical audit/state-transition
data:

```ts
{
  type: "nominationVoteConfirmed",
  payload: {
    stepId: string;
    nominatorId: string;
    nomineeId: string;
    voterIds: string[];
    ghostVoteSpentPlayerIds: string[];
  };
}
```

The event no longer persists:

- a duplicate nested `input.stepId`;
- `voteCount`, which is derived from `voterIds.length`;
- `updatesExecutionCandidate`, which cannot represent top ties and is replaced by full replay
  derivation.

Replay exposes the typed Day projection:

```ts
type DayState = {
  nominations: NominationRecord[];
  executionVoteThreshold: number;
  highestVoteCount: number;
  executionCandidate?: ExecutionCandidate;
  confirmedExecution?: ConfirmedExecution;
};
```

`NominationRecord` in replay includes the derived `voteCount` for UI and audit display even though
the persisted event does not duplicate it.

## Strict Validation and File Rejection

Import and persisted-game loading never keep a prefix of an invalid event log. They either replay
the complete schema-version-2 file or reject the complete file before replacing current storage.

Replay rejects:

- schema version 1 or any unsupported version;
- nomination events out of the generated step order;
- missing, duplicate, or unknown voter IDs;
- unknown nominator or nominee IDs;
- repeated same-day nominators or nominees;
- a dead nominator;
- ghost-vote spending that is not a subset of voters or conflicts with prior alive/ghost state;
- malformed or inconsistent event payloads.

Proposal validation must prevent the app from creating an event that replay would reject. When an
incompatible IndexedDB value is found, the app reports it without loading partial state and offers
an explicit path to discard it and begin a new game.

## Approved UI Contract

During Nomination/Voting, the right-side phase surface shows one large standing derived only from
the latest successful replay:

```text
현재 처형 후보

5번 Eun — 5표
기준 4표 · 생존자 8명
```

When there is no qualifying unique candidate:

```text
현재 처형 후보

후보 없음 — n표
기준 4표 · 생존자 8명
```

No confirmed nominations displays `후보 없음 — 0표`. A unique leader below threshold and a top
tie both display `후보 없음 — n표`.

The standing never projects the unconfirmed Draft. Seat taps continue to update only the Draft
vote count and pending ghost-vote list. Confirming the vote appends the Rust proposal event; the
standing changes only after the resulting replay succeeds.

Do not show explanatory sentences that restate this behavior. The accepted prototype explicitly
removes:

- `확정된 투표만 반영`;
- nomination-specific prose explaining why the displayed Player is the candidate;
- prose explaining that Draft voter changes do not update the confirmed standing.

Prefer operational values such as threshold, living count, current Draft votes, and pending ghost
votes. This principle is also recorded in `AGENTS.md` for future live-play UI work.

## Sequential Test-First Handoff

After this plan and prototype are approved:

1. `luna_logic_worker` receives only the approved behavior, public contracts, project specs, and
   existing test conventions. It does not receive a production implementation design and does not
   edit production source.
2. The test worker writes the smallest black-box behavioral/regression tests covering the new
   stable seams and demonstrates failure for the intended pre-change reason.
3. Sol reviews the tests and personally verifies those failures. Harness, dependency, or unrelated
   failures do not satisfy the gate.
4. Only after the gate passes, a separate `luna_worker` changes production code and may add
   implementation-coupled unit tests. It must not weaken or rewrite the approved behavioral tests.
5. Test and production implementation do not run in parallel.

The failing behavioral coverage must establish:

- representative odd/even thresholds and the minimum-one rule;
- top ties, lower ties, and a new unique higher candidate;
- Day sequence transitions through Whisper and Discussion;
- the schema-version-2 nomination event and complete rejection of v1/invalid logs;
- the user-visible confirmed standing, including no Draft candidate projection.

## Production Change Map

Rust domain:

- `contracts.rs`: schema-version-2 nomination payload and typed step values;
- `model.rs`: Day standing fields and derived nomination record;
- `day.rs`: Day sequence, threshold, candidate derivation, and Day replay;
- `replay.rs`: strict event ordering, nomination integrity, and full-log rejection;
- `proposal.rs`: flattened canonical nomination event;
- `messages.rs`: summaries built from derived vote count;
- `tests/`: black-box phase, threshold, candidate, audit, and invalid-log scenarios.

Web:

- `core/types.ts`: schema-version-2 `GameFile`, `GameEvent`, `StepType`, and `DayState`;
- `core/validation.ts`: strict v2 event and replay validation;
- `gameStorage.ts`: v1 rejection and explicit incompatible-save discard path;
- `voting.ts`: remove TypeScript threshold and candidate prediction;
- `features/voting/NominationVoteInput.tsx`: retain Draft vote and ghost-vote values only;
- `features/phase-control/PhaseControl.tsx`: typed Day stages and confirmed standing;
- `features/phase-control/phaseInput.ts`: concise titles and forward actions;
- `styles.css`: accepted iPad candidate-standing treatment;
- unit and integration tests for boundary, phase, standing, and persistence behavior.

Architecture documentation is updated to record schema version 2, typed Day steps, the optimized
nomination event, and the canonical Day standing.

## Completion and Verification

After implementation:

- run `cargo fmt --check`;
- run `cargo test --workspace`;
- run `pnpm --dir web test`;
- run `pnpm --dir web build`;
- bind local validation to `0.0.0.0` and verify the target 1366 x 1024 iPad viewport;
- review the complete diff for contract drift, duplicated rule logic, unnecessary UI prose, event
  audit loss, and accidental schema-1 compatibility;
- commit the reviewed result and push `codex/issue-33`;
- report the schema incompatibility, regression coverage, and related follow-up issues.
