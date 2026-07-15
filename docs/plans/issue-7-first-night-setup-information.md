# Issue 7: First-Night Information — Final Architecture Plan

## Status

Approved and implemented in the dedicated worktree `/private/tmp/clocktower-issue-7` on branch
`codex/issue-7`. Domain, web, regression-test, responsive-browser, and production-build validation
are complete. The finished change is committed and pushed after the final review pass.

## Final Product Decisions

1. Numeric information uses direct result buttons. The prototype's Chef `0 / 1` is only an example;
   Rust supplies every distinct value legal for the current check. The replay-derived value is
   marked `진실`, and other selectable values are marked `거짓` in the Storyteller UI.
2. The current actor card remains visible. Chef/Empath registration-sensitive information shows the
   relevant neighboring Players, followed immediately by the numeric result buttons. Extra truth,
   explanation, and registration-form cards are not shown.
3. Normal Washerwoman, Librarian, and Investigator information uses one candidate/Character editor
   constrained by the actual replayed state.
4. A drunk or poisoned setup-information actor also uses one editor. The Storyteller may select any
   two distinct existing Players and any Character of the ability's required kind; poisoned
   Librarian may select zero Outsiders. The UI does not request or record a separate true pair.
5. Registration does not add a second editor. Selecting Spy or Recluse as a candidate expands the
   Character list with the concrete Characters that Player may register as for that check.
6. Setup-information candidate cards always show Storyteller-only Actual Character, differing Shown
   Character, and Character-kind color. Long lines must wrap inside the card.
7. Candidate selection is bidirectional: selecting in the information panel highlights the same
   Players in the Grimoire, and clicking an eligible Grimoire seat changes the same draft.
8. During a confirmed game, `설정 및 불러오기` and `이벤트 로그` are collapsed by default and expand
   independently. Collapsed panels must not reserve a third full-width column or stretch Grimoire.
9. Demon/Minion information and the legal Demon-bluff allowlist merged in issue #29 remain unchanged.
   Spy's visual Grimoire Reveal remains in issue #42.

## Scope Interpretation

- `아무 직업` remains ability-shaped: Washerwoman chooses any Townsfolk, Librarian any Outsider,
  and Investigator any Minion. It does not mix unrelated Character kinds.
- Bidirectional Grimoire selection applies to the setup-information candidate editor in this issue.
  Nomination voting keeps its existing, separate Grimoire projection.
- Numeric choices are not a fixed `0 / 1 / 2` range in React. Rust returns the legal set for the
  current Character, roster, impairment state, and per-check registration possibilities.

## Architecture Constraints

Follow `ARCHITECTURE.md` ownership:

- Rust owns legal results, impairment, registration, command validation, canonical events, replay,
  and Reveal payload construction.
- `characters/trouble_brewing.rs` owns Trouble Brewing calculations and registration eligibility.
- `information.rs` owns generic information orchestration and audit contracts.
- React owns draft interaction and rendering only; it must not recreate legal result rules.
- Phase-control owns the shared setup-information draft lifecycle. `main.tsx` only wires that
  feature-owned state to PhaseControl and Grimoire.
- Confirmed events returned by Rust remain the only persisted game history.

## Domain Contract Changes

### Information prompt choices

Extend the transient `InformationPrompt` with Rust-derived choice metadata.

```text
numberChoices: [
  {
    value,
    isComputed,
    registrationJudgments
  }
]

setupInfoRegistrationOptions: [
  {
    playerId,
    registeredAs,
    characterIds
  }
]
```

- `numberChoices` is sorted numerically and deduplicated by value.
- `isComputed` marks the replay-derived truth. Exactly one displayed value has this mark.
- `registrationJudgments` is the deterministic rule witness associated with a registration-only
  alternate. React submits it with the selected value but does not calculate it.
- When several registration assignments produce the same number, Trouble Brewing selects one
  deterministic witness. The observable result appears only once.
- Selecting the computed truth requires no registration judgment and remains fixed delivery unless
  drunk/poisoned discretion is active.
- `setupInfoRegistrationOptions` tells React which Character IDs become legal when an eligible Spy
  or Recluse is among the selected candidates.

Add optional `characterId` to `RegistrationJudgment` for concrete setup-information registration.
Existing Chef/Empath events use alignment-only judgments and remain compatible.

### Numeric choice generation

In `characters/trouble_brewing.rs`:

- keep the existing Chef adjacent-evil-pair and Empath living-neighbor calculations;
- enumerate legal Good/Evil registration assignments for the eligible Spy/Recluse Players;
- calculate each resulting number and deduplicate the set;
- for a drunk/poisoned numeric actor, expose every ability-shaped number in the script-owned range;
- mark the unmodified replay result as truth even when it is not the smallest value;
- never hardcode the prototype's `0` or `1` in generic UI code.

For Chef, the script-owned structural range is `0..=seated_player_count`; for Empath it is the
number of evil living neighbors that the ability can currently report. Proposal validation reruns
the same calculation, so a forged value outside the prompt is rejected.

### Setup-information validation modes

Use three explicit validators owned by Trouble Brewing and orchestrated by `information.rs`:

- **normal truth:** two distinct existing Players and a required-kind Character actually represented
  by one of them; Librarian zero only when the roster has no Actual Outsider;
- **registration-adjusted truth:** the same single input, with a submitted Rust-provided concrete
  registration option allowed to represent the Character;
- **impaired delivery:** two distinct existing Players and any known Character of the required kind,
  without representation validation; Librarian zero is always allowed.

Normal and registration-adjusted information records the selected result as computed and delivered.
For drunk/poisoned setup information, the canonical event records delivered information and the
impairment reason without fabricating an unselected true pair. `ConfirmedInformation.computedResult`
therefore becomes optional only for this explicit case; existing schema-v1 typed events retain their
required value in practice and remain replayable. Update the Delivered Information section of
`ARCHITECTURE.md` to document this exception.

### Atomic command and replay validation

In `proposal.rs`, `phase.rs`, `information.rs`, and `replay.rs`:

1. derive active impairment and registration choices from replayed state;
2. select the correct setup-information validation mode before general StepInput validation;
3. validate the submitted numeric/setup choice and any hidden prompt-provided judgment together;
4. construct the canonical Confirmed Event only after full validation;
5. derive summary and Reveal only from that confirmed event;
6. replay typed events through the identical validator;
7. preserve the documented legacy path for schema-v1 events without typed information.

Invalid or tampered commands return a stable CoreError and no event, summary, or Reveal payload.

## Web State and Component Design

### Feature-owned phase input draft

Extract the current local state in `PhaseControl.tsx` into
`features/phase-control/usePhaseInputDraft.ts`.

The hook owns:

- selected Player IDs;
- selected Character ID(s);
- zero-Outsider mode;
- selected numeric choice and its prompt-provided registration witness;
- reset on current-step ID change;
- invalidation when Player selection changes the legal Character list;
- max-selection and zero-Outsider selection rules.

`main.tsx` calls this phase-control-owned hook and passes its narrow projections to:

- `PhaseControl`, which renders and confirms the draft;
- `Grimoire`, which receives only selected IDs, disabled state, and `onTogglePlayer`.

This follows the existing nomination-draft pattern without making Grimoire import phase-control.

### Bidirectional setup-information selection

Add an optional Grimoire prop shaped like:

```text
setupInformationSelection: {
  selectedPlayerIds,
  disabled,
  onTogglePlayer
}
```

- PhaseControl candidate buttons and Grimoire seats call the same hook-owned toggle function.
- Both render `aria-pressed` and the same selected state immediately.
- The hook enforces two distinct Players and max selections; Grimoire contains no domain rules.
- Zero-Outsider mode clears and disables Player selection in both surfaces.
- Step change, confirmation, skip, and Reveal follow-up clear the projection.
- Layout editing disables seat selection.
- Nomination voting and setup-information selection are mutually exclusive app-level projections.

### Setup-information single editor

Update `StepInputs.tsx` and `phaseInput.ts`:

- render one editor for normal, impaired, and registration-adjusted setup information;
- use Rust prompt metadata rather than Actual Character filtering when impairment/registration
  expands choices;
- submit the selected pair/zero and Character once;
- attach the matching prompt-provided concrete registration judgment only when needed;
- disable confirmation until the single draft is structurally complete.

### Numeric information buttons

Replace the free-form numeric input and registration selects with buttons from `numberChoices`.

- render every unique choice, including `0`, `1`, `2`, and larger values when legal;
- mark `isComputed` as `진실`; mark other selectable values as `거짓`;
- show the relevant neighbor visualization before the buttons for Chef/Empath checks;
- submit the chosen value plus the choice's hidden registration witness;
- preserve Reveal isolation and show only the chosen delivered value to the Player.

### Candidate-card overflow

In `styles.css`:

- give `.setupInfoCandidateDetails` and all grid children `min-width: 0`;
- use normal wrapping and `overflow-wrap: anywhere` for Actual/Shown Character lines;
- remove single-line clipping assumptions from setup-information cards;
- use a one-column candidate grid at narrow phase-rail widths if two columns cannot contain the
  Storyteller context;
- add a regression assertion for `본인 인식: 점쟁이` and visually check iPad/mobile widths.

### Collapsed auxiliary panels and layout independence

During confirmed play:

- compose PhaseControl, collapsed ConfirmedSetup, and collapsed EventLog in the right rail;
- change `confirmedShell` to Grimoire + right-rail columns so a collapsed log does not reserve a
  third column;
- add `align-items: start` and keep Grimoire's own height independent;
- use native `details/summary` semantics with clear `+ / −` affordances;
- keep open/closed state as non-persisted UI state;
- show event/warning counts in the EventLog summary so important state is visible while collapsed.

The unconfirmed setup editor remains visible because it is the primary task, while its embedded
EventLog uses the same collapsed EventLog component.

## Boundary and Compatibility

Update Rust serde contracts, `web/src/core/types.ts`, and runtime validation together:

- optional setup-information `computedResult` only for impaired delivery;
- optional concrete registration `characterId`;
- numeric choices and setup-registration prompt options;
- strict known Character/value validation;
- old alignment-only registration events remain valid;
- old typed information with computedResult remains valid;
- old schema-v1 events without information keep the documented compatibility path.

No game-file schema bump is planned because changes are additive/optional and old events are not
rewritten.

## Implementation Order

1. Update `ARCHITECTURE.md` and shared Rust/TypeScript contracts.
2. Add Trouble Brewing legal numeric choices and setup registration-option calculations.
3. Generalize information prompt, proposal, and replay validation.
4. Add focused Rust regression tests before wiring the UI.
5. Extract the feature-owned phase input draft hook.
6. Implement single setup-information editor and dynamic numeric buttons.
7. Wire bidirectional Grimoire selection and selected-seat styling.
8. Fix candidate wrapping and confirmed layout/collapsible panels.
9. Update runtime validation, web tests, event summaries, and Reveal checks.
10. Run full verification, review the diff, commit, and push `codex/issue-7`.

## Regression Coverage

### Rust domain

- Chef truth values `0`, `1`, `2+` appear dynamically for matching rosters;
- Chef/Empath registration outcomes are enumerated, deduplicated, sorted, and validated;
- computed truth does not require an unnecessary registration judgment;
- poisoned/Drunk numeric range accepts legal values and rejects out-of-range values;
- exact Recluse-next-to-Demon/Minion Chef scenario permits the adjusted pair count;
- normal Washerwoman/Librarian/Investigator truth validation;
- poisoned/Drunk setup information accepts one arbitrary ability-shaped input;
- poisoned Librarian accepts zero despite Actual Outsiders;
- Spy/Recluse concrete setup registration expands only the legal kind/Characters;
- missing, malformed, duplicate-Player, wrong-kind, unknown-Character, and forged prompt choices fail;
- canonical event/replay parity, delivered-only impaired audit, Reveal isolation, and legacy events;
- issue #29 legal Demon-bluff behavior remains unchanged.

### Web unit/integration

- numeric buttons render all prompt choices and mark the computed value as truth;
- selected numeric choice submits its exact prompt-provided witness;
- setup information renders exactly one editor in normal, impaired, and registration modes;
- Drunk/poisoned options expand without Actual representation filtering;
- Recluse/Spy selection expands the concrete Character list without a second editor;
- long `본인 인식: 점쟁이` text stays inside the candidate card;
- clicking a panel candidate highlights Grimoire and clicking Grimoire updates the panel;
- max two, deselection, zero-Outsider disabling, step reset, busy state, and layout-edit guard;
- settings/load and EventLog start collapsed, expand independently, and expose summary counts;
- a taller rail does not stretch Grimoire or shift seat positions;
- confirmation persists only the Rust proposal event and Reveal receives only RevealPayload.

## Verification and Completion

- `cargo test --workspace`
- `pnpm --dir web test`
- `pnpm --dir web build`
- browser validation at iPad landscape and narrow mobile widths, binding any dev server to
  `0.0.0.0`
- manual code-review pass for Rust ownership, boundary validation, replay parity, Reveal isolation,
  accessibility, and unrelated-worktree preservation
- commit the finished change and push `codex/issue-7`

If an acceptance rule cannot retain its regression test, the completion note must state why.
