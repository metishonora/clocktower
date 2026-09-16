# Issue 175: Bad Moon Rising foundation implementation plan

## Status

Approved implementation baseline. This plan and its black-box acceptance tests define the
Production foundation contract. BMR UI and visual decisions remain explicitly out of scope.

Approved on Issues #174 and #175:

- D1: support 7–15 non-Traveller Players.
- D2: return every valid Godfather Setup option and require an explicit Storyteller choice.
- D8: use the documented 34 unique / 42 physical reminder inventory as the provisional baseline.
- Defer BMR theme colors, route, UI, icons, and assets to the later BMR UI prototype.
- Keep D6/D7 and Character ability automation deferred as described by Issue #174.

## Objective

Add the smallest script-owned BMR domain and wire foundation that can:

1. identify and persist `badMoonRising` independently of Trouble Brewing and Sects & Violets;
2. validate the official 25-Character catalog and Lunatic Actual/Shown identity;
3. calculate standard 7–15 Player Setup and persist an explicit Godfather option;
4. generate the official roster-filtered first/later-night order using typed BMR step identities;
5. require explicit manual resolution for every unautomated BMR Character step;
6. register the official reminder inventory without generating runtime reminders; and
7. survive create, replay, import/export, and undo through the real Rust/WASM/TypeScript boundary.

## Non-goals

- Character ability outcomes, Death ordering, protection, impairment, delayed effects,
  Resurrection, public-life projection, or game-end deferral.
- Lunatic deception content or delivery automation.
- BMR route, landing exposure, Production UI, prototype, theme, icon, logo, or PWA assets.
- Traveller, Fabled, Custom Script, Jinx, or house rules.
- Closing #174 or resolving its D6/D7 official-ruling gaps.

## Contract decisions

### Script and catalog

- Add `badMoonRising` to Rust serde and TypeScript `ScriptId`.
- Add `characters/bad_moon_rising.rs` and a private typed `step_key` module. Common dispatch gains
  one BMR arm; TB/S&V private rules and persisted meanings remain unchanged.
- Register exactly the 25 IDs and 13/4/4/4 kinds in the Issue #174 reference.
- Add a TypeScript BMR catalog containing the approved Korean name and short ability copy for
  validation and later presentation reuse. Do not add it to the visible script landing list.
- Split the visible landing-script type/list from the complete domain `ScriptId` set so adding BMR
  does not require a placeholder theme or expose an unfinished route.
- A Lunatic must have `actualCharacter: "lunatic"` and a BMR Demon `shownCharacter`. That identity
  is preserved instead of being normalized back to `lunatic`. Other BMR Characters keep their
  Actual Character as their Shown Character.

### Setup query

Keep existing TB/S&V successful JSON byte-shape semantics by using an untagged result union:

```ts
type SetupDistributionResult =
  | SetupDistribution
  | { options: SetupDistributionOption[] };

type SetupDistributionOption = {
  id: "addOutsider" | "removeOutsider";
  distribution: SetupDistribution;
};
```

- No Godfather: return the existing single `SetupDistribution` object.
- Godfather: return `options`, ordered `addOutsider` then `removeOutsider`, containing only valid
  choices.
- `addOutsider` means `-1 Townsfolk/+1 Outsider`.
- `removeOutsider` means `+1 Townsfolk/-1 Outsider`.
- At base Outsider 0 (7/10/13 Players), return only `addOutsider`.
- Never select an option from roster order or another implicit rule.

### Confirmed Setup and replay

Extend the create command and Setup event additively:

```ts
type CreateGamePayload = {
  players: SetupPlayerInput[];
  setupChoiceId?: "addOutsider" | "removeOutsider";
};

type SetupConfirmedPayload = CreateGamePayload;
```

- Godfather present: `setupChoiceId` is required even when only one option is valid.
- Godfather absent: `setupChoiceId` must be absent.
- Missing, unknown, or unavailable choices fail with `INVALID_SETUP_CHOICE`.
- Persist the choice on `setupConfirmed`; expose it as optional `ReplayState.setupChoiceId` so a
  replay consumer can verify the confirmed option without reinterpreting the roster.
- Omit the optional field for historical and new TB/S&V files. Keep schema version 3 because the
  event addition is backward-compatible.

### Phase foundation

Use typed BMR step keys with stable serialized IDs:

- `firstNight:<step>`
- `day<cycle?>:<step>` where cycle 1 omits the number, matching the existing prefix convention
- `night<cycle?>:<step>` where cycle 1 omits the number

The phase overview is roster-filtered and follows this canonical policy:

```text
First Night
minionInfo → lunatic → demonInfo → sailor → courtier → godfather
→ devilsAdvocate → pukka → grandmother → chambermaid → toDay

Later Night
sailor → innkeeper → courtier → gambler → devilsAdvocate → lunatic → exorcist
→ [active Demon position]
→ assassin → godfather → professor → gossip → tinker → moonchild
→ grandmother → chambermaid → toDay
```

- The active Demon position is `zombuul`, `pukka`, `po`, or the two ordered steps
  `shabalothResurrection` then `shabalothAttack`.
- Dusk is represented by entering the phase; `toDay` is the Dawn/announcement boundary. They are
  not duplicated as Character work.
- `minionInfo` and `demonInfo` reuse the existing evil-information step boundary. `lunatic` is a
  separate private manual workflow placeholder before Demon info on the first night and before
  Exorcist on later nights.
- Every BMR Character step, including both Shabaloth steps, has `support: "manual"` and completes
  only through `manualPhaseStepResolved` with `handled` or `notApplicable`.
- A minimal `day:manual` step followed by `day:toNight` makes later-night replay reachable without
  inventing typed BMR public actions. Later issues replace the manual boundary with approved events.
- BMR accepts only Setup, generic phase confirmation/skip where valid, and manual-step resolution.
  Unsupported TB/S&V Character commands and events fail at script dispatch.

### Reminder inventory

- Store static script metadata for all 25 Characters. Chambermaid, Pacifist, and Mastermind have
  explicit empty reminder associations; the other 22 link to the documented inventory.
- Treat Courtier `Drunk 1/2/3` as three unique products for the unique count.
- Assert 34 unique products and a physical-count sum of 42.
- Do not create `RuleState.automaticReminders` from this metadata. Runtime generation belongs to
  later Character issues.

### TypeScript and persistence boundary

- Update `ScriptId`, command/event/replay/setup result types, and runtime validators together.
- Give BMR its own IndexedDB key through the existing `latest:<scriptId>` rule.
- Keep BMR out of `ScriptLanding` and route selection. Production-entry acceptance means the real
  generated WASM adapter and canonical session/storage helpers, not a React screen.
- Import rejects a BMR file when another script is expected, just as existing script isolation does.

## Acceptance invariants and evidence

| Invariant | Strongest planned evidence |
| --- | --- |
| 1. Exact 25 IDs and 13/4/4/4 kinds | Public create-command acceptance for every ID plus a script-private exhaustive catalog test that rejects duplicates/omissions |
| 2. 7–15 Setup table | JSON-entrypoint table test for every supported count plus 6/16 create/query rejection |
| 3. Explicit Godfather choice survives boundaries | JSON-entrypoint option/invalid-choice/event/replay test, then real WASM + canonical controller import/export/undo integration test |
| 4. Official night order | Black-box phase-overview tests for the complete first-night roster and each Demon later-night position; private typed-step parser tests |
| 5. Manual means manual | Black-box wrong-resolution-path test and handled/not-applicable replay status test |
| 6. 34 unique / 42 physical reminder metadata | Script-private exhaustive inventory/count/25-association test; no public catalog endpoint is added solely for testing |
| 7. TB/S&V remain unchanged | Existing exact fixtures and full Rust/web suites, plus unchanged single-distribution JSON assertions |
| 8. Production create/replay/import/export/undo | Real generated WASM adapter and TypeScript canonical session/storage integration test without rendering a BMR route |

## Implementation sequence after review

1. Make the new black-box tests pass by adding the additive Rust contracts and BMR script dispatch.
2. Add the exhaustive Rust catalog/reminder/typed-step tests and implement static metadata.
3. Implement BMR Setup query/choice validation and Lunatic identity normalization.
4. Implement the minimal BMR replay/proposal phase state machine and manual boundaries.
5. Update TypeScript types, validators, catalog, script-keyed persistence, and hidden landing set.
6. Add the real WASM/canonical-session boundary test for import/export/undo.
7. Run focused tests early, then `cargo test --workspace`, `pnpm --dir web test`, and
   `pnpm --dir web build`.
8. Review invariant-to-evidence coverage separately from command success and record any remaining
   automation gap before acceptance.

## Review questions

1. Approve the untagged setup result union so existing TB/S&V successful JSON remains unchanged?
2. Approve requiring an explicit Godfather choice even when only `addOutsider` is valid?
3. Approve `ReplayState.setupChoiceId` as the observable replay projection of the confirmed event?
4. Approve the minimal `day:manual → day:toNight` bridge rather than reusing Character-aware
   TB/S&V Day behavior?
5. Approve treating standard Minion/Demon info as existing evil-info boundaries while Lunatic stays
   a distinct manual private-workflow placeholder?
