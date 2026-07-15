# Issue 46: Randomized First-Night Draft Suggestions

## Status and product decisions

Approved for production implementation after the development-only prototype gate.

- Place one inline `무작위 추천` action in the supported candidate-input header. After the first
  successful use, label it `다시 추천`.
- Do not add a second action near the confirmation controls.
- Do not show recommendation counts, draft summaries, manual-edit status, or explanatory copy about
  recommendation versus confirmation. Show feedback only when a suggestion request fails.
- A suggestion replaces Draft Input only. It never proposes, appends, persists, confirms, or reveals
  an event.
- Suggested fields remain editable through the existing controls. The separate existing `확정`
  action remains the only path into Command, Proposal, canonical Confirmed Event, replay, and Reveal.
- Re-suggestion must exclude the current complete semantic draft whenever another complete draft
  exists. Player-pair and Character-set ordering does not make an otherwise identical draft new.
- Browser randomness samples complete canonical combinations. Tests control the selection token and
  never depend on real randomness.

The approved scope expands the issue's original out-of-scope note for drunk and poisoned setup
information: an impaired Washerwoman, Librarian, or Investigator receives a random ability-shaped
delivered draft that may be true or false. Random Spy/Recluse Registration Judgment choices remain
out of scope.

## Stable public contract

Add one stateless read-only core entrypoint alongside replay, propose, and setup distribution:

```text
suggest_phase_input_json(gameFileJson, requestJson) -> CoreResult<PhaseInputSuggestion>
```

The Wasm export is `suggest_phase_input`; the TypeScript adapter method is `suggestPhaseInput`.

Request JSON:

```json
{
  "stepId": "firstNight:washerwoman:player-1",
  "currentInput": {
    "playerIds": ["player-2", "player-8"],
    "characterId": "chef"
  },
  "choiceToken": 1234567890
}
```

- `stepId` must equal the replay-derived current step.
- `currentInput` is optional and may be incomplete. It is used only to avoid returning the same
  complete semantic draft when an alternative exists.
- `choiceToken` is an unsigned 32-bit value supplied by a browser crypto source. Rust maps it onto
  the deterministically ordered complete-combination pool. Tests pass fixed values.

Success JSON value:

```json
{
  "stepId": "firstNight:washerwoman:player-1",
  "input": {
    "playerIds": ["player-2", "player-8"],
    "characterId": "chef"
  }
}
```

`input` is a complete existing `PhaseStepInput`; it is not a Command, Proposal, or Event. No schema
version changes and no persisted event-contract changes are introduced.

Replay-derived supported steps expose `requiredInput.supportsRandomSuggestion: true`. It is omitted
for unsupported steps. React uses only this Rust-owned semantic marker to decide whether to render
the action; it does not identify supported Characters or reconstruct rule eligibility.

Expected errors use the existing CoreResult envelope:

- malformed request -> `MALFORMED_REQUEST`;
- no current step -> `NO_CURRENT_STEP`;
- mismatched step ID -> `STALE_STEP`;
- current step without the semantic support marker -> `UNSUPPORTED_DRAFT_SUGGESTION`;
- no complete valid combination -> `NO_VALID_DRAFT_SUGGESTION`.

An error returns no partial input and cannot change the current web draft.

## Complete-combination rules

Trouble Brewing owns the catalogs and eligibility in `characters/trouble_brewing.rs`. Generic
suggestion orchestration must not embed script-specific Character IDs or kinds.

### Normal setup information

For Washerwoman, Librarian, and Investigator:

- enumerate unordered pairs of two distinct existing Players;
- enumerate the ability's required Character kind;
- retain a pair/Character combination only when at least one candidate has that Actual Character;
- use Actual Character only; Shown Character never represents setup truth;
- do not generate Spy/Recluse Registration Judgments;
- when Librarian has no Actual Outsider, the only normal suggestion is `{ zeroOutsiders: true }`.

### Drunk or poisoned setup information

- enumerate every unordered pair of two distinct existing Players;
- combine each pair with every Character in the ability's required script-owned kind;
- for Librarian, include `{ zeroOutsiders: true }` as an additional complete delivered draft even
  when an Actual Outsider exists;
- do not generate a computed baseline or Registration Judgment;
- confirmation continues to record the existing impaired delivered-information contract.

### Demon information

- consume the legal unused-good Character allowlist established by issue #29;
- enumerate unordered three-Character combinations;
- Actual Character determines whether a Character is used;
- a Drunk Shown Character remains eligible when otherwise unused;
- every suggestion contains exactly three distinct legal Character IDs.

The existing Demon input continues to permit manual confirmation of zero, one, or two legal bluffs.
Failure to construct an exact-three suggestion therefore does not by itself block Demon information.
A fixed setup-information failure indicates an invalid Actual roster or inconsistent current step
that cannot produce rule-valid fixed information.

## Rust ownership

- Extend `RequiredInput` with the optional serialized support marker.
- Add a crate-private suggestion orchestrator that replays the GameFile, verifies the current step,
  requests the script-owned complete pool, excludes a semantically identical current draft when
  possible, applies `choiceToken`, and returns one complete input.
- Keep Trouble Brewing pool construction in `characters/trouble_brewing.rs` and expose it through the
  narrow character-module interface.
- Add boundary, public domain, and Wasm adapter functions without changing propose or replay behavior.
- The query must not construct a canonical event or RevealPayload and must not mutate GameFile data.

## Web ownership

- Extend CoreAdapter, Wasm client, types, and boundary validators for the request/result and replay
  support marker.
- Use an injectable unsigned-32-bit browser crypto token source. Production uses
  `crypto.getRandomValues`; integration tests inject fixed values.
- The game store supplies the current GameFile to the read-only adapter call but never appends the
  result to events or persistence.
- Phase-control owns request pending/error state and atomic application to `usePhaseInputDraft`.
- Applying a setup suggestion replaces Player IDs, Character ID, zero-Outsider mode, and registration
  judgments together. Applying a Demon suggestion replaces the full Character-ID list together.
- Manual setters continue to work immediately after application.
- Render only the approved inline `무작위 추천` / `다시 추천` action and failure-only feedback.

## Sequential test-first handoff

1. A logic test worker receives only this approved behavior and public JSON contract. It adds the
   smallest black-box domain regression tests and demonstrates an intended failure before production
   implementation exists.
2. Sol reviews the failing reason and freezes the accepted test.
3. A separate implementation worker changes production source and may add implementation-coupled
   unit tests, but may not weaken or rewrite the accepted black-box test without Sol approval.

Black-box coverage must include all four supported suggestion types, normal Actual/Shown behavior,
impaired false-capable delivery, Librarian zero, exact-three issue-29 Demon bluffs, semantic
re-suggestion replacement, deterministic tokens, stale/unsupported/unavailable errors, and absence
of an event or Reveal in the query response.

Web regression coverage must include first recommendation, re-recommendation atomic replacement,
manual editing, failure preserving the current draft, no propose/autosave on recommendation,
confirmation through the existing Proposal/event/Reveal path, and RevealPayload-only rendering.

## Completion verification

- `cargo test --workspace`
- `pnpm --dir web test`
- `pnpm --dir web build`
- local iPad-oriented validation with the dev server bound to `0.0.0.0`
- independent review of rule ownership, event-path isolation, atomic draft replacement, and safe Reveal
- commit and push `codex/issue-46`
