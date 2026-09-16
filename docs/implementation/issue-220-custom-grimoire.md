# #220 implementation handoff

> 최신 구현 인계: [수정 구현 v2](issue-220-custom-grimoire-v2.md). P1–P5 반영, P6 테스트 대기.

> 2026-09-11 상태 정정: 아래는 이전 구현 인계다. 사용자 인수와 코드 대조에서 확인한 미연결 UI/상태 문제는 [수정 계획 v2](../plans/issue-220-custom-grimoire-plan-v2.md)의 P1–P5에서 해결한다. 현재 #220 구현 완료를 뜻하지 않는다.

Status: implementation complete; test stage executed, full acceptance remains partial. Updated 2026-09-11.

[Test-stage results](../testing/issue-220-test-results.md): new regression tests and Production browser checks pass; remaining UI/device coverage is explicitly recorded. The sections below preserve the implement-stage handoff.

Baseline: [approved Spec v3](../specs/issue-220-custom-grimoire.md) and [approved implementation plan](https://github.com/metishonora/clocktower/issues/220#issuecomment-5620712125). This record does not approve a merge, close #220, or declare the 45 acceptance cases passed.

## Implemented units

| Plan | Result |
| --- | --- |
| A — session adoption and autosave | Added the application session owner and per-scenario writer leases. Valid Setup/import activation replaces its slot without confirmation in one IndexedDB transaction. Ordinary writes compare the last owned snapshot before replacement. Revoked queues cannot overwrite the new owner; accepted snapshots are retained for save retry. |
| B — editor and import | Production source panel has new/JSON choices, direct successful import to review, current validated handoff, immediate scenario download, and exact-match game resume. The original imported game stays separate from the editable definition. Scenario imports receive fresh IDs; game imports retain their IDs and require full replay. |
| C — setup | Existing SnV shell/catalog/seat composition consumes custom distribution and setup inputs. New setup starts with no actual roles. The application creates the canonical session; Setup publishes play only after the first save succeeds. Existing-game refusal was removed from the partial implementation. |
| D — first night | Added custom step input mapping, owner/source-aware action labels, required/optional action selection, information choices, preparation/registration inputs, public reveal isolation, canonical confirmation, history and Undo. Non-reveal actions confirm once; reveal actions show, conceal, then commit. Day/game-end stop the out-of-scope actions. |
| E — Production and restore | Production custom landing loads the composition. Browser history state selects the saved custom slot on refresh. Full replay restores privately; it does not automatically show a player reveal. Game JSON export preserves canonical identity/events and supported seat layout. |

## Ownership and extensions

- `web/src/custom/grimoire/applicationController.ts` owns transitions and the active session. `setupController.ts` owns the editable setup draft; `firstNightController.ts` owns interaction/proposal state and observes canonical saves.
- `web/src/custom/storage/sessionWriter.ts` orders writes by scenario slot and revokes former owners. `sessionStorage.ts::writeOwnedSession` performs atomic activation or compare-and-write. Storage layout and GameFile v4 remain unchanged.
- `CustomCanonicalSession.fromFile`, `propose`, `applyProposal`, `retrySave`, and its read-only replay getter connect existing canonical operations without duplicating accepted events.
- `confirmed_event_reveal` is a read-only custom WASM export. It validates the entire file and returns the replay fold's existing completed-event reveal snapshot, which was captured through `projection::event_reveal` at the original prefix. It does not propose a new command or recalculate information from current facts.
- TB start-information input projection now fills the existing `playerRegistrationOptions` field using `registration_source` and `registration_allowed`. This makes existing preparation/registration behavior selectable in the UI; it does not introduce a new registration rule or stored schema.
- React composition remains in `web/src/grimoire-custom`. It uses read-only shared presentation and the pure SnV reveal wrapper. Official runtime/controller imports were not introduced into `src/custom`, and no boundary allowlist was changed.
- The preserved #205/#220 prototype and the old memory-only setup review entry are not the Production runtime.

## Build and diagnostic results

- `pnpm --dir web build`: passed, including both official/custom WASM builds, TypeScript and Vite. Existing Rust unused/dead-code warnings remain.
- After the final TypeScript interaction refinements: `pnpm --dir web exec tsc -b` and `pnpm --dir web exec vite build` passed.
- `node scripts/check-custom-boundaries.mjs`: passed.
- `pnpm --dir web check:architecture`: passed.
- `git diff --check`: passed for tracked changes.
- The first sandboxed build could not execute wasm-opt. The authorized elevated build completed; no build configuration or security policy was weakened.

No test code was written or changed in this implement stage, and no Rust/web/browser test suites were executed. Tests already present as uncommitted changes originated in the earlier partial Setup work; their old expectations are not acceptance evidence for Spec v3.

## Inputs for the test stage

Use all C01–C38 and S1-a–g from Spec v3 and the approved plan's verification mapping. In particular, observe these boundaries during the planned acceptance work:

- The existing partial Setup tests still describe the superseded refusal to replace an existing game. Bring those assertions into line with approved Spec v3; do not reintroduce confirmation or backup requirements to satisfy them.
- Verify actual IndexedDB activation, read/IO/replay failure distinctions, same-ID replacement, late former-owner writes, and retry of an accepted Setup/action without duplicate events. Include imported records and Undo histories when examining writer ownership.
- Exercise real first-night input/payload handling with the existing #209 R0–R11 independent inputs and expected outcomes, including preparation, registration, simulation/acquisition, multiple sources, repaired twins, pending identity notices, and game end/Undo. Compilation is not evidence that every rule branch has been exercised in the UI.
- Compare the Production editor and SnV composition with the approved prototype at desktop, mobile and iPad sizes. Verify touch/keyboard, scrolling, public reveal background hiding/inert behavior, focus restoration, and refresh while revealing. No fresh browser or physical-device review was performed in this implement stage.
- Verify full game/scenario file round trips, supported imported seat positions, exact definition edit/restore, stale asynchronous editor results, and external HTTP browser-ID fallback.
- Run the planned official regressions, runtime suites, browser acceptance and PWA verification in the test stage. Do not treat the old representative five-player prototype as full coverage.

## Review server cleanup

The designated server operator attempted to stop the former issue-220 prototype server on port 10220 through the lifecycle manager at phase transition. The manager could not verify the recorded process owner and refused to stop it; status remains `running / unverified`. Reconcile removed no stale record. No direct process termination was attempted, no new review server was started, and issue-218's server was preserved. Resolve the manager record before replacing or relying on that review server in the test stage.

## 2026-09-11 추가 인수 보정

마도서 전체 테마는 최신 사용자 요청에 따라 BMR로 통일했다. 공식 BMR과 `BmrInformationTask`/`BmrRevealSurface`를 공유하고, 직업 상세의 BMR 낮/밤 및 제보 BMR 테마를 추가했다. 진행 순서는 TB의 상태+직업명 규약만 참고해 `CustomPhaseOrder`와 custom 소유 `phaseOverviewLabel`로 간소화했다. 상세·검증 근거는 `docs/testing/issue-220-ui-corrections.md`의 최신 섹션을 따른다. 이전 SnV 시각 테마 설명보다 이 보정이 우선하며 Core/저장 계약은 바뀌지 않는다.
