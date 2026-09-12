# #220 ([205-2]) — conventional custom grimoire

## Specification

Published Spec: https://github.com/metishonora/clocktower/issues/220#issuecomment-5620580626

[Approved #220 Spec v3](../specs/issue-220-custom-grimoire.md) is the implementation baseline, copied from #205 and reconciled with its final approved editor flow. The first implementation unit below records partial work already performed; it does not supersede that Spec or constitute full UI approval. Port the approved #205 editor before the next full-flow user review.

## Baseline and ownership

User decision on 2026-09-10: preserve #205 and its approved editor work; build a conventional SnV-shaped custom grimoire in #220 without waiting for #218. #218 develops the story presentation independently and will consume the same custom game connection.

Branch: `codex/issue-220`, based on fetched `origin/develop` (`e7d7c0f`). Existing issue worktrees and servers are preserved.

The strict custom boundary disallows even unowned UI code imports from `src/custom`. Therefore the custom controller remains in `src/custom/grimoire`, while `src/grimoire-custom` composes its data and commands with the existing `shared-ui` shell, catalog and rectangular board. No checker allowlist or official-runtime import is added. The story UI can consume the same controller; no game-state or storage fork is needed.

## First implementation unit

- Add an optional typed new-grimoire handoff to the existing authoring review. The callback receives only the current immutable validated scenario. Existing Production entry points without a consumer retain the disabled action.
- Keep scenario candidate pool and actual roster separate. Start with no chosen roles or assignments.
- Query the existing custom WASM for composed setup distribution. Do not reproduce Baron/Fang Gu/Vigormortis or Shown Character rules in the controller.
- Reuse SnV presentation shell, role catalog, seat layout and styles; supply custom-owned labels and artwork.
- Confirm a real `createGame` through the custom canonical session. Publish live state only after the storage driver acknowledges the accepted Setup event.
- Retain the accepted event after a failed save and retry that snapshot without a duplicate command. Existing same-ID stored games and unreadable records are preserved.
- Add independent `/clocktower/issue-220-grimoire.html` review entry. It accepts editor output or a representative mixed scenario whose order is generated/validated by Production WASM. It uses **memory storage only**, visibly disclosed in review tools. Production routes are not redirected to this unfinished screen.

This is a working Setup connection, not completion of #220. The first-night result panel is a handoff checkpoint; it has no simulated action execution or advance button.

## Remaining units

1. Bring the final #205 editor interactions into Production with the connected composition root, including entry transition. Current optional callback alone does not port that approved UI revision.
2. First-night required/optional/preparation actions, candidate selection, information proposals and public reveals, confirmed history, replay and Undo. Use custom Step/result contracts, not official controller assumptions.
3. Durable browser session lifecycle and exact-match resume, validated GameFile import/export, storage recovery and current/last-saved state. The review route's memory driver is not a substitute. Resolve any material file-format or replacement-policy discrepancy with the final #205 decisions before implementation.
4. Full mixed first-night acceptance, mobile/desktop review, official non-regression, PWA/build and runtime isolation verification.

## Verification

The first unit uses real Production custom WASM and IndexedDB integration tests for setup, distribution modifiers, canonical order preservation, write failure/retry and existing-game preservation. Rendering review includes the exact existing SnV screen for comparison. Detailed results follow after execution.

### First-unit results (2026-09-10)

- `pnpm --dir web test:custom`: 29 files / 138 tests passed, including six new real-WASM Setup-controller cases and the editor handoff UI case.
- `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`: 141 domain + 6 WASM tests passed.
- `pnpm test:custom-runtime`: 102 fixture domain tests + 13 fixture web tests passed.
- Custom/official boundary checker and PWA contract check passed. Required web build passed; existing Rust unused/dead-code warnings remain unchanged.
- Root manually tested actual editor name/pool/order/review -> new-grimoire handoff (not just the sample shortcut), then selected a mixed 5-player roster, edited a name and confirmed Setup. Real replay reached first night/minion information. No Setup action preview/list was added.
- Desktop and 390px/320px rendering inspected. Fixed narrow tab clipping, navigation scroll retention, and inherited ability-description line clamp. Screenshot/DOM evidence is under `docs/prototypes/issue-220/`.
- Independent `prototype_reviewer` inspected rendered captures, the official SnV reference, source boundaries and root interaction evidence; the review found no remaining blocker in this first-unit scope. Reviewer could not use live CUA because its Mac session was locked, so it used root-captured evidence. Physical iPad/Safari validation was not performed.
- Manager-owned review server: profile `prototype:phase-control`, port `10220`, kept running at `리뷰 서버(검증 당시)issue-220-grimoire.html`.

No Production redirect, full first-night execution UI, persistent browser resume or GameFile UI is claimed complete. Existing #205/#218 worktrees remain untouched.

### HTTP review-origin correction (2026-09-10)

User reported the review page did not work. The earlier browser acceptance used localhost, where `crypto.randomUUID` is available; the shared `HTTP review host` origin does not provide that secure-context method. Both the initial editor render and later default game ID generation called it unconditionally. Regression tests reproduced both failures with `randomUUID` absent.

Added a custom-owned browser ID helper that uses native `randomUUID` when available and otherwise creates RFC 4122 version-4 IDs from `crypto.getRandomValues`. Both entry points use it; no insecure random fallback or browser security setting change was added. The two regression cases and the full custom web suite now pass (30 files, 140 tests). The custom/official import boundary remains intact. Further manual browser retesting on this turn was unavailable because the CUA host Mac was locked; this result is test/source evidence, not an external-device browser claim.

After the correction, the external review HTML, corrected ID module and custom WASM binary each returned HTTP 200 at the shared `review-server` address. The served ID module contains the `getRandomValues` fallback. The final web build passed. No server restart or security configuration change was necessary.
