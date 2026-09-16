# Issue 195: Custom first-night action runtime implementation plan

## Objective

Add a custom-script first-night contract and runtime foundation without migrating or changing the
existing Trouble Brewing or Sects & Violets execution paths. A script definition owns a complete
default first-night order, Setup may reorder it for the current game only, and runtime execution
projects the persisted order through semantic action handlers.

## Approved scope and boundaries

- This issue covers first night only.
- A plan entry is either a movable system action (`dusk`, `minionInfo`, `demonInfo`, `dawn`) or a
  semantic Character action identified by `(characterId, actionId)`.
- `dusk` and `dawn` are boundaries. `minionInfo` and `demonInfo` are ordinary movable entries, so
  Character actions may be placed before, between, or after them.
- The definition stores the complete Character-pool order, not only initially assigned Characters.
  This lets abilities introduce or acquire an initially absent Character without inventing an
  order during play.
- Setup starts from the definition order, or from a deterministic built-in combined TB/S&V order
  when the definition omits one. A Setup override is persisted only in that game's
  `setupConfirmed` event and does not mutate the definition.
- The built-in combined order is a checked-in snapshot derived by filtering The Pandemonium
  Institute's public `resources/data/nightsheet.json` global `firstNight` order to the supported
  TB/S&V actions, while retaining all four system entries. It is not a merge of the two local rank
  tables. Updating that snapshot is an explicit persisted-contract change.
- Runtime uses `ActionSpec + pure ActionHandler + shared rule services + event reducer`. The action
  registry binds a stable action reference to its spec and handler. Only reducer-applied events
  mutate replay state.
- One ordered entry may project to zero, one, or multiple actionable steps according to active
  ability instances. Projection and handler execution are deterministic.
- This issue adds system handlers and test-only Character handlers. Production Character rules and
  cross-Character interactions remain Epic #190 work.
- A missing production Character handler fails explicitly. There is no manual or official-script
  fallback.
- Existing Trouble Brewing, Sects & Violets, and Bad Moon Rising behavior and execution paths remain
  unchanged. Additive shared-contract fields and replay-identity plumbing may touch their
  constructors, but they are not migrated onto the custom runtime.
- Amend the current `ARCHITECTURE.md`; do not create a competing v2 document.

## Material acceptance invariants

| Invariant | Strongest planned evidence |
| --- | --- |
| Definition-wide default order is stable and independent of `characterIds` input order | Rust boundary tests over reordered mixed definitions |
| Every plan contains each required system and Character action exactly once, with `dusk` first and `dawn` last | Rust validation positive/negative matrix |
| `minionInfo` and `demonInfo` can move around Character entries | Rust definition and Setup override round-trip tests |
| Setup override affects only the created game and is persisted canonically | Proposed-event JSON and definition immutability tests |
| Runtime supports zero/one/many active instances per entry in stable order | Pure projector tests with test-only handlers |
| Handlers cannot mutate state directly and events are the only reducer input | Handler/reducer unit tests using immutable context snapshots |
| Missing or duplicate action registration fails explicitly | Registry construction and lookup tests |
| Unsupported production Character actions never fall back to official rules | Custom runtime boundary error test plus unchanged official-module diff |
| Rust, WASM, and TypeScript expose the same plan contract | Generated-WASM integration and TypeScript parser tests |

## Test-first and review sequence

1. Add Rust contract tests for default generation, exact validation, current-game override
   persistence, projector cardinality/order, reducer behavior, registry failures, and unsupported
   production Character actions.
2. Add TypeScript structural parsing tests and generated-WASM parity tests for the read-only plan
   boundary.
3. Confirm the material tests fail for the missing Issue #195 contract.
4. Have `test_contract_reviewer` review the failing contract before Production implementation.

## Production sequence

1. Add shared plan/action-reference contracts and additive optional definition/Setup command fields.
2. Add `custom/first_night` modules for action specs, validation/default generation, registry,
   projection, pure handler output, and event reduction.
3. Extend custom Setup proposal so the canonical effective plan is stored in `setupConfirmed`.
4. Add a read-only Rust/WASM boundary that resolves and returns the effective definition plan for
   Setup consumers.
5. Add the matching TypeScript types, exact validation, WASM adapter, and parity coverage.
6. Document the architecture seam and future Character-handler ownership in `ARCHITECTURE.md`.

The generated-WASM, IndexedDB session, and browser-level Undo composition remain Issue #198. This
issue proves Setup → replay → system-step progression → event-removal replay through the Rust JSON
boundary, plus Character projection/routing through an internal test-handler fixture.

## Verification

1. Focused Issue #195 Rust, TypeScript, and generated-WASM tests.
2. `cargo test --workspace`.
3. `pnpm --dir web test`.
4. `pnpm --dir web build`.
5. Separate invariant-to-evidence audit, including confirmation that official-script serialized
   behavior and regression tests remain unchanged and that no official path dispatches through the
   custom runtime.

## Implemented evidence

- The Issue #195 Rust suites cover definition-order independence, exact-set validation, movable evil
  information, source precedence, current-game persistence, zero/one/many projection, registry
  identity failures, event-only reduction, system progression through Day, Undo replay, and forged
  provenance rejection.
- The official-path regression case rejects custom plan/provenance fields, while the full existing
  Rust and web suites retain the official serialized contracts.
- TypeScript unit coverage checks exact action-reference parsing and definition/Setup round trips.
  Generated-WASM integration coverage checks the Rust/WASM/TypeScript plan result and custom replay
  identity.
- Repeatable final commands are `cargo test --workspace`, `pnpm --dir web test`, and
  `pnpm --dir web build`.
- The deliberate automation gap is production Character behavior: Issue #195 verifies the runtime
  seam with fixture handlers, while Epic #190 owns real Character specs, handlers, and interaction
  rules. Setup-screen editing and complete custom-session browser wiring remain their separate UI
  and runtime issues.
