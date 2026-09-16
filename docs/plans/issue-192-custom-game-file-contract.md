# Issue 192: Custom script and GameFile contract implementation plan

## Status

Approved contract recorded on Issue #192 on 2026-09-02. Implemented and verified on the
`codex/issue-192` branch.

## Objective

Introduce one schema-v4 GameFile script reference that distinguishes official scripts from a full
custom-script definition snapshot. Continue to accept schema-v2/v3 official files without changing
their event or rules meaning, and reject custom input explicitly until the registry in Issue #193
can resolve it.

## Approved contract

```ts
type CustomScriptDefinition = {
  id: string;
  name: string;
  characterIds: string[];
};

type ScriptReference =
  | { type: "official"; scriptId: ScriptId }
  | { type: "custom"; definition: CustomScriptDefinition };
```

Schema v4 stores this value at `game.script`. It does not also accept legacy `game.scriptId`.
Custom definitions do not carry a revision, schema version, catalog version, or ruleset version.
The enclosing GameFile schema version owns the persisted shape.

New official and custom GameFiles serialize as schema v4. TypeScript import normalizes valid
schema-v2/v3 official files to schema-v4 official references. The Rust boundary continues to parse
v2/v3 directly so their existing replay meaning remains characterized.

## Structural and semantic validation split

Issue #192 owns structural validation:

- non-blank stable definition ID and name;
- an array of non-blank Character IDs;
- exact, case-sensitive uniqueness while preserving array order;
- exactly one known `official` or `custom` script-reference arm; and
- rejection of mixed legacy/v4 fields and malformed definitions without fallback.

An empty Character array remains structurally valid. Issue #193 owns the exhaustive registry scan,
unknown Character rejection, and custom Production-ready validation. Issue #194 decides whether a
structurally valid roster can start a game for the selected player count.

## Compatibility and sequencing

- Schema v2 without `scriptId` remains Trouble Brewing.
- Schema v3 requires one known official `scriptId`.
- Schema v4 requires `game.script` and rejects legacy `game.scriptId`.
- Existing confirmed-event JSON is not migrated or reinterpreted.
- Official URL, UI, IndexedDB key, and session behavior remain unchanged.
- Downgrade import into an older v3-only app is not supported.
- Until Issue #193 lands, structurally valid custom files stop with
  `CUSTOM_SCRIPT_NOT_RESOLVED`; they never enter official rules.
- Trouble Brewing, Sects & Violets, and Bad Moon Rising are official regression consumers.

## Acceptance invariants and evidence

| Invariant | Strongest evidence |
| --- | --- |
| A game carries exactly one official reference or complete custom definition | Rust JSON-boundary and TypeScript parser positive/negative matrices |
| Custom round-trip preserves ID, name, and Character order | TypeScript import/export/import test |
| v2/v3 official files retain existing rules and event meaning | Existing Rust fixture characterization plus v4 normalization tests |
| Invalid custom input is rejected without official fallback | Rust error-code tests and generated-WASM integration |
| Rust and TypeScript use the same reference discriminators | Cross-language discriminator parity test |
| Definition changes participate in replay request identity | TypeScript replay-cache serialization test |

## Implementation sequence

1. Add the material contract tests and confirm they fail for missing schema-v4 behavior.
2. Obtain `test_contract_reviewer` review before Production implementation.
3. Add Rust `ScriptReference` and `CustomScriptDefinition`, schema-aware parsing, structural
   validation, and explicit unresolved-custom handling.
4. Add TypeScript v4 types, parser/normalizer, official helpers, serialization, and cache identity.
5. Add generated-WASM boundary coverage and verify all official consumers.
6. Run focused tests, `cargo test --workspace`, `pnpm --dir web test`, and
   `pnpm --dir web build`, then review invariant-to-evidence coverage separately.

## Non-goals

- Registry membership or Production-ready checks.
- Custom Setup, phase, or Character rule execution.
- Custom IndexedDB keys, repository, or canonical session.
- Official custom-script JSON conversion.
- Custom editing or live-play UI.
- Historical catalog or ruleset execution.

## Verification record

- `cargo test --workspace`: 382 domain tests and 4 WASM adapter tests passed.
- `pnpm --dir web test`: 170 unit tests and 603 integration tests passed, including generated-WASM
  v4 official replay and unresolved-custom coverage.
- `pnpm --dir web build`: TypeScript project build, Vite production bundle, and PWA generation
  passed.
- Invariant review: the boundary matrices cover exclusive union arms and structural failures;
  v2/v3 normalization covers every official script; custom order, exact uniqueness, definition
  cache identity, and the no-fallback unresolved result each have direct evidence.
