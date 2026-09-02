# Issue 193: Custom script registry and resolved context implementation plan

## Status

Implemented on the `codex/issue-193` branch. Approved product and scope decisions are recorded on
Issue #193, and the implementation builds on the Issue #192 schema-v4 custom-definition snapshot
merged into `develop` by PR #199.

## Objective

Resolve a structurally valid `CustomScriptDefinition` into one deterministic
`ResolvedScriptContext` backed by an exhaustive Trouble Brewing and Sects & Violets custom
allowlist. Preserve the definition's Character order while exposing unique membership and canonical
`CharacterKind` lookup to later Setup and phase work.

## Approved boundaries

- Production-ready means the Character's official-script implementation is complete.
- The custom registry contains the 22 Trouble Brewing and 25 Sects & Violets Characters.
- Canonical `imp` is supported; case-different `Imp` is not a valid Character ID.
- Full TB/S&V cross-Character interaction support belongs to Epic 1.
- Bad Moon Rising custom support belongs to Epic 2 and BMR IDs are rejected by this registry.
- `CustomScriptDefinition` remains `{ id, name, characterIds }`; no revision, catalog version, or
  ruleset version is introduced.
- The registry owns ID and canonical kind only. It does not add a Character owner contract, Setup
  modifiers, phase order, command routing, a rules DSL, or per-Character Rust files.

No material departure from the approved issue or current `ARCHITECTURE.md` is proposed.

## Acceptance invariants and evidence

| Invariant | Strongest planned evidence |
| --- | --- |
| Every selected ID resolves to exactly one custom registry entry and canonical kind | Rust registry uniqueness/coverage and mixed-definition resolution tests |
| Unknown, non-canonical-case, and BMR IDs cannot enter a resolved custom context | Rust JSON-boundary and TypeScript semantic-validation negative tests |
| A supported but unselected Character is absent from context membership and kind lookup | Rust `ResolvedScriptContext` membership tests |
| Rust and TypeScript expose the same TB/S&V custom IDs and kinds | Generated-WASM catalog versus TypeScript registry integration test |
| Failed custom resolution never dispatches official rules | Boundary test asserting the dedicated unsupported-custom error before replay dispatch |
| Official TB/S&V catalog and kind behavior is unchanged | Existing catalog characterization plus full Rust/web regression suites |

## Test-first sequence

1. Add Rust contract tests for all 47 entries, kind parity with the existing script catalogs,
   order preservation, membership, empty definitions, canonical `imp`, invalid `Imp`, unknown IDs,
   and BMR rejection.
2. Add TypeScript tests for the TB/S&V allowlist, kind normalization, BMR exclusion, and semantic
   custom-definition validation.
3. Add a generated-WASM integration test that compares the actual Rust registry with the actual
   TypeScript registry.
4. Run the focused tests and record the expected Red result before Production implementation.
5. Have `test_contract_reviewer` review the material contract and resolve blocking findings.

## Production implementation

1. Add a narrow catalog adapter to the existing TB and S&V script modules. Each adapter derives
   `{ id, kind }` from its typed `ALL`, `as_str()`, and existing metadata; it does not expose private
   rules or duplicate canonical kind data.
2. Add `characters/registry.rs` with the combined allowlist, `ResolvedScriptContext`, ordered
   resolved entries, membership, kind lookup, and kind projection.
3. Add `UNSUPPORTED_CUSTOM_SCRIPT_CHARACTER` and call the resolver after Issue #192 structural
   validation at the GameFile boundary. Empty definitions remain semantically valid; unknown,
   case-different, and BMR IDs fail before any official dispatch.
4. Keep `CUSTOM_SCRIPT_NOT_RESOLVED` as the temporary guard when a valid registry-resolved custom
   GameFile reaches Setup/phase execution, which remains owned by Issues #194 and #195. It must no
   longer mask unsupported Character IDs.
5. Add a read-only Rust/WASM custom-catalog boundary returning only `{ id, kind }` so the web test
   can compare the real language catalogs without introducing a third catalog fixture.
6. Add a TypeScript custom registry derived from the existing TB and S&V presentation catalogs.
   Normalize S&V's lowercase presentation kinds only at this boundary; do not change existing UI
   contracts or remove BMR from official-game validation.
7. Apply TypeScript semantic resolution after the existing structural parser and update the stale
   Issue #192 unknown-membership characterization to the approved Issue #193 behavior.
8. Document the custom allowlist, structural/semantic validation split, and resolved-context seam in
   `ARCHITECTURE.md`.

## Expected files

- New: `crates/domain/src/characters/registry.rs`
- New: `crates/domain/src/tests/issue193_custom_script_registry_scenarios.rs`
- New: `web/src/customScriptRegistry.ts`
- New: `web/src/customScriptRegistry.test.ts`
- New: `web/test/issue193CustomScriptRegistry.integration.test.tsx`
- Update: TB/S&V character modules, `characters/mod.rs`, `boundary.rs`, `error.rs`, domain/WASM
  public adapters, `gameStorage.ts`, relevant test manifests, and `ARCHITECTURE.md`

## Verification

1. Focused Rust Issue #193 and catalog tests.
2. Focused TypeScript registry, GameFile contract, and real-WASM parity tests.
3. `cargo test --workspace`.
4. `pnpm --dir web test`.
5. `pnpm --dir web build`.
6. Separate invariant-to-evidence review confirming every Issue #193 invariant has direct evidence
   and no BMR, Setup, phase, command, custom persistence/session, or UI behavior was added.

## Verification evidence (2026-09-03)

- Test contract review: passed after removing the unintended single-official-script owner
  assumption and adding exhaustive resolver plus shared-boundary coverage.
- `cargo test --workspace`: 387 domain tests and 4 WASM adapter tests passed.
- `pnpm --dir web test`: 173 unit tests and 604 integration tests across 85 files passed.
- `pnpm --dir web build`: production TypeScript, Vite, WASM, and PWA build passed.
- Invariant audit: all 47 TB/S&V IDs resolve with canonical kinds; unknown, case-different, and BMR
  IDs fail at the shared GameFile boundary; unselected membership stays absent; generated WASM and
  TypeScript catalogs match exactly; supported custom execution retains the explicit later-issue
  guard; no owner contract or BMR/Setup/phase/command/custom persistence/session/UI behavior was
  introduced.
