# Official Jinx foundation (#213)

## Scope and reference

The custom runtime registers official Jinx metadata and callable character rules together.
TB/SnV's three pairs are the initial consumers; BMR/Carousel characters are not activated.

Source: [TPI jinxes.json, 915347e](https://github.com/ThePandemoniumInstitute/botc-release/blob/915347e627c3f6cd1f438f82b6001784e11b3e8b/resources/data/jinxes.json),
checked 2026-09-15. The checked-in file is the complete official reference snapshot.
Rule explanations were also checked against the official Mathematician, Sage and Scarlet
Woman wiki pages. General mixed-character interactions remain outside this issue.

## Registration contract

1. Add a reviewed official snapshot deliberately; source changes are not fetched at runtime.
2. Each pair whose characters are in the published custom catalog must have exactly one
   matching registration, nonempty typed rules, and named acceptance evidence.
3. Bind rules in the owning `characters/<script>.rs` module. The common registry dispatches
   typed callbacks; applicability belongs to each rule and its consumer.
4. Use `ResolvedScriptContext.related_jinxes()` for script metadata. It is independent of
   actual roster membership, ability ownership, and event-specific application.
5. Run coverage and public Core/WASM acceptance before publishing a character. A new
   character that introduces an unimplemented official pair fails resolution. Metadata
   alone cannot pass the registration gate.
6. New rule consumers add a typed seam as needed. The test-only future pair exercises the
   real registry constructor, lookup and dispatch, and remains unavailable to production.

## Evidence

| Contract | Evidence |
| --- | --- |
| Complete official coverage; no missing, duplicate, unknown or metadata-only bindings | `issue213_jinxes::official_coverage_rejects_missing_duplicate_metadata_only_and_unknown_bindings` |
| Future pair uses the same registry and callback dispatch | `issue213_jinxes::additional_catalog_pair_uses_the_same_registry_and_typed_dispatch` |
| Fang Gu jump preserves Scarlet Woman, with no extra identity reveal | `issue213_jinxes::fang_gu_jump_suppresses_scarlet_succession_and_phantom_reveals` |
| Ordinary Fang Gu death still allows succession | `issue213_jinxes::ordinary_fang_gu_death_still_allows_scarlet_succession` |
| Sage requires exact Recluse judgment and freezes delivery | `issue213_jinxes::sage_recluse_choice_requires_exact_judgment_and_survives_replay` |
| Acquired, poisoned, dead or lost Recluse source | `issue213_jinxes::sage_jinx_uses_acquired_recluse_ability_and_current_impairment`, `sage_does_not_use_a_lost_recluse_ability`, `dead_recluse_can_register_and_poisoned_sage_needs_no_invented_registration` |
| Drunk false/true information, new audit windows, immutable reveals and tampered provenance | `issue213_jinxes::drunk_information_across_nights` |
| Actual failed effect vs no failure | `issue213_jinxes::drunk_failed_swap_is_detected_only_when_a_swap_should_have_happened` |
| Daytime Drunk information and acquired Drunk provenance | `issue213_jinxes::drunk_day_information_is_counted_by_actual_failure_not_drunkenness`, `acquired_drunk_keeps_its_real_source_in_later_night_evidence` |
| Existing first-night behavior | `issue208_information::drunk_empath_jinx_counts_only_incorrect_delivery_and_survives_reload_undo` and existing #208/#209 contracts |
| Real UI treatment selection, WASM, frozen reveal, IndexedDB, file round-trip and causal Undo | `web/test/custom/issue213Jinxes.test.ts` and `web/test/issue213JinxUI.test.tsx` |

Before production changes, the Fang Gu and Sage public-API tests reproduced respectively
an extra Scarlet Woman transformation and a missing Recluse information option. Assertions
use independently specified outcomes, not results read back as their own expected values.

Same-ruleset save/reload is covered. Preserving old rulesets across catalog upgrades is
not introduced; the source commit is not a new GameFile revision or migration contract.

## Implementation verification (2026-09-15)

- `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`: 214 domain and 6 WASM tests passed.
- `pnpm --dir web test:custom`: 339 tests passed.
- `pnpm --dir web exec vitest run test/issue213JinxUI.test.tsx`: production input integration passed.
- Custom and integration TypeScript checks passed.
- Custom boundary checker and its 10 negative tests passed.
- `pnpm --dir web build` and `pnpm --dir web verify:pwa` passed.
- `node scripts/verify-custom-runtime-isolation.mjs`: isolated production/fixture Rust and WASM builds, TypeScript, custom and fixture tests passed with official sources and artifacts absent.

### Acceptance feedback: Sage selection

Sage's two delivered players are selected on the existing grimoire board. The progress
panel shows the selected players and a styled change-target button, without enumerating
all pairs or showing a separate Recluse treatment control. Selecting a pair automatically
uses its Core-projected registration evidence, preferring the permitted Recluse interpretation. UI/Core integration covers partial selection, reversed seat order, exact
Recluse judgment, and the frozen reveal. Controller regression also checks impossible
pairs, changing to the actual killer, and clearing a cancelled selection.

User acceptance completed on 2026-09-15 after the Sage board-selection, target-change
button and automatic Recluse-registration corrections; the user requested finalization.
