# #225 implementation and verification

## Scope and baseline

- Pulled `develop`, retaining the five local workflow commits. Product baseline: `e762782`; merged baseline: `5a9af3f`.
- Implementation branch/worktree: `codex/issue-225`, `.worktrees/issue-225`.
- Removed the retired reviewer-agent requirement from #225 at the user's request. No separate reviewer was used.
- The result is custom Core/WASM, nonvisual authoring, files and session integration. Production other-night editing and progress controls remain #222. Official runtime ownership is unchanged.

## Implemented contracts

Complete definitions require `firstNightOrder` and `otherNightOrder`. Each plan validates its phase-specific exact set and system boundaries. Authoring may query deterministic defaults; load, import, resume and replay never fill missing plans. The checked-in action order and upstream revision are in `first_night/catalog.rs`. Custom game files use schema 5 and portable scenario files use version 2; old custom formats are rejected without migration or modifying valid stored data.

The existing scheduler and handler registry now execute both night phases. A replay-derived night number distinguishes repeated actions, while ability provenance, spent uses, historical results and rule-owned effects keep their appropriate lifetimes. New cycles reset progress and retain history. Acquisitions join pending order, defer past entries, or deliver start information immediately outside the later-night plan. Demon succession from an attack defers the new attack until the next night.

TB/SnV handlers provide typed other-night attacks, protection, information and transformations. Death-caused Ravenkeeper, Sage and Sweetheart actions retain the original source; Barber is ordered or immediate according to when the opportunity appears. Pit-Hag demon creation creates a mandatory arbitrary-death consequence. Vigormortis records the killed Minion source, poison selection and retained ability. New Imp succession and Barber chooser candidates are available as input metadata for #222.

Day information consumes #223 participant and ability records rather than current identities. Historical registration uses the recorded ability and impairment state. At dawn, a resolved win condition enters the existing day-end confirmation contract. The same replay fold validates proposed and imported events; it derives pending work, confirmed reveals and contiguous causal Undo units across day/night history.

## Acceptance evidence

`crates/custom-domain/src/tests/issue225_nights.rs` contains 22 production-domain tests with explicit expected actions/results:

- Complete definitions; missing, duplicate, unknown, trigger and wrong-boundary order rejection.
- Stable authoring defaults independent of roster input order, preserving explicit saved order.
- Actual second and third nights, distinct occurrence IDs, stable ability source, stale/forged event rejection.
- Ravenkeeper death, pending restoration, fixed reveal and causal suffix Undo.
- Pit-Hag acquisition outside the plan; pending versus passed ordinary acquisition.
- Sage valid/invalid pairs and frozen reveal; Barber ordered/late death and decline; Sweetheart effect.
- Vigormortis dead Minion participation and poison provenance, including a poisoned retained Minion receiving an ineffective action.
- Fang Gu's game-wide single jump across ability instances; fixed Scarlet Woman precedence over Imp starpass.
- Mandatory Pit-Hag arbitrary deaths; Seamstress use remaining spent across nights.
- Flowergirl, Town Crier, Oracle and Juggler consuming the completed day; historical registration remaining valid after tonight's poisoning.
- Existing end confirmation after a demon disappears at night, with further ordinary progress rejected.
- Poisoned Sage misinformation contributing to the current night’s Mathematician audit, with death-time cause and night identity.

`web/test/custom/issue225Nights.test.ts` exercises actual generated WASM through `CustomCanonicalSession`, portable game JSON and IndexedDB. It verifies pending-death reload, confirmed reveal, causal Undo, third-night identity, stale commands and atomic invalid-save rejection. Other-night order also participates in resume identity. Existing authoring/session suites cover import failure, asynchronous replacement guards and save/retry behavior.

## Final verification

- `cargo test --workspace`: **592 passed** — 201 custom domain, 6 custom WASM, 381 official domain, 4 official WASM; doc tests passed.
- `pnpm --dir web run test:custom`: **317 passed** across 46 files, including actual WASM/session tests.
- `node scripts/verify-custom-runtime-isolation.mjs`: passed in a fresh temporary workspace with official source and generated artifacts absent. Runs production and fixture Rust, both WASM builds, TypeScript, production custom web and fixture web tests. The fixture registry remains a bounded first-night test tool; production later-night acceptance runs against production handlers.
- `pnpm --dir web run check:architecture`: passed.
- `pnpm --dir web build`: passed, including official/custom WASM generation, TypeScript, Vite and PWA generation.
- `git diff --check`: passed.

No review server was needed for this nonvisual scope. The implementation has not been merged, and #225 has not been closed.

## Finalization coverage

The existing `Validate Clocktower` workflow targets `develop` PRs and runs the new domain tests through `cargo test --workspace`, the new WASM/session tests through `test:custom`, plus fixture isolation, general web tests and Production browser tests. No additional workflow is needed to discover the #225 tests.

Finalization also updated the general web and browser consumers of custom fixtures to schema 5 / scenario version 2. Tests that add characters explicitly update both definition orders. Browser tests use the maintained acceptance fixture rather than rewriting historical #220 evidence. These changes preserve the first-night UI acceptance scope; they do not add #222's later-night controls. Unit, integration and browser results are recorded with the final PR/CI evidence.
