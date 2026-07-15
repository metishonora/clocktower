# Issue 29: Demon Bluff Constraint Architecture

## Scope

Constrain Trouble Brewing first-night Demon bluff input to unused good Characters. The Storyteller
may still confirm zero to three bluffs. Random or automatic information suggestions are explicitly
outside this issue.

## Rule Ownership

Trouble Brewing owns the definition of a legal Demon bluff in
`crates/domain/src/characters/trouble_brewing.rs`:

- the Character is Townsfolk or Outsider;
- no Player has that Character as their Actual Character;
- a Drunk Player's Shown Character does not count as assigned;
- results follow the script catalog order.

The common phase layer does not know which Character kinds are legal bluffs. It only validates a
character selection against an optional allowlist carried by `RequiredInput`.

## Replay Contract

`RequiredInput` gains an optional `allowedCharacterIds` field. The first-night Demon information
step populates it from the replayed Player roster; unrelated character-selection steps omit it.
The field is derived guidance rather than persisted game state.

```text
setupConfirmed event
  -> replayed Players
  -> Trouble Brewing legal Demon bluff calculation
  -> firstNight:demonInfo.requiredInput.allowedCharacterIds
  -> TypeScript renders only matching catalog entries
```

Rust remains the single owner of the rule. TypeScript must not infer availability from the full
Grimoire or duplicate Character-kind filtering.

## Command and Event Flow

The existing command, Proposal, event, and Reveal contracts remain intact:

```text
filtered UI draft (0-3 Character IDs)
  -> confirmStep Command
  -> Rust validates count, uniqueness, known Character, and allowlist membership
  -> canonical phaseStepConfirmed event with ConfirmedInformation
  -> RevealPayload built only from deliveredResult
```

No new command or event variant is introduced. `schemaVersion` remains `1` because the only JSON
addition is optional derived replay metadata.

## Validation and Compatibility

The same `validate_required_input` path runs for Proposal creation and replay. Consequently:

- newly submitted assigned, Minion, or Demon bluff IDs are rejected with `INVALID_STEP_INPUT`;
- duplicate and unknown IDs remain rejected;
- zero through three legal IDs remain valid;
- imported historical events with illegal Demon bluffs fail replay;
- historical legal events, including a null input representing zero bluffs, remain replayable;
- historical `phaseStepConfirmed` events without typed `information` retain the existing schema-1
  compatibility behavior after their step input passes validation.

## Web Responsibilities

`web/src/features/phase-control/StepInputs.tsx` filters the shared Character catalog by
`allowedCharacterIds` when the field is present. Selection order, manual toggling, the three-item
maximum, confirmation, persistence, and Reveal follow-up behavior remain unchanged.

The Wasm boundary validator accepts an omitted allowlist or an array of string IDs and rejects
malformed values before they reach feature rendering.

## Regression Strategy

Rust boundary tests cover the derived allowlist, the Drunk Actual/Shown distinction, valid
zero-to-three confirmation, rejection of assigned and evil Characters, rejection during replay,
canonical Confirmed Information, and the narrow Reveal payload.

TypeScript unit and integration tests cover boundary parsing, allowlist-based rendering, command
submission using the visible selection, and the existing confirmed Reveal path without Grimoire
data.
