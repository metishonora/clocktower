# #209 TB·SnV 혼합 첫날 밤 — 구현·검증 기록

## 기준과 상태

- [Intent](https://github.com/metishonora/clocktower/issues/209#issuecomment-5587451258)
- [Spec 및 구현 전 확정 사례 §7.1](https://github.com/metishonora/clocktower/issues/209#issuecomment-5592916694)
- [Plan](https://github.com/metishonora/clocktower/issues/209#issuecomment-5593075747)
- 기준: `origin/develop`의 #208 병합 커밋 `e9518943e252d4a29037c2862ce6ed3e36f19a25`.
- 구현: `codex/issue-209`. 로컬 develop의 별도 커밋은 변경하지 않았다.

아래 책임 연결은 implement 단계에서 작성한 정적 대조다. test 단계의 실행·수용 결과는 문서 후반에 별도로 기록한다. D·O·R0–R11과 각 변형의 입력, 숫자, 출처, 기대 결과는 Spec §7.1을 그대로 기준으로 한다. 여기서 새 기대 결과나 테스트 함수·fixture 구조를 정의하지 않는다.

## 구현 내용

`first_night/catalog.rs`가 시스템 4개, 정규 캐릭터 18개, 추가 행동 7개의 전체 선언과 정규 순서 참여 여부를 제공한다. 시스템 선언은 `plan.rs`의 순서 집합 검사와 `system.rs`의 등록에 공용으로 쓰인다. 작성용 기본 순서의 시스템 삽입 위치는 유지한다.

`ActionRegistry::validate_production_completeness`는 선언의 중복, 등록의 예상 외 identity·순서 참여 불일치·handler/spec 불일치를 `FirstNightActionRegistrationInvalid`로 거부한다. 필요한 등록의 누락은 기존 lookup의 `FirstNightActionHandlerUnavailable`로 거부한다. 개수만 비교하지 않는다. 기본 `action_registry()`는 합성 후 이 검사를 거쳐 반환된다. 추가 후보를 등록된 handler에서 순회할 때 누락이 조용히 숨겨지는 경로를 차단한다.

부분 registry를 만드는 `ActionRegistry::new`와 system+fixture 구성에는 production 전체 집합을 강제하지 않는다. Wire 계약, 이벤트, 저장 버전, 공개 API에는 변경이 없다.

## 기존 연결의 점검 결과

- `game.rs::apply_event`는 직전 prefix에서 현재/선택적 occurrence를 찾고 registry 검증을 수행한다. 다음 facts와 progress, 직전 상태의 완료 snapshot을 모두 계산한 뒤 새 상태를 반환한다. Proposal도 같은 적용 경로를 사용한다.
- TB 준비 후보와 SnV 쌍둥이/돌연변이 후보는 각 Character handler가 소유한다. Scheduler는 정규·필수·즉시·선택적 후보와 source identity를 다루며 Character별 규칙을 새로 갖지 않는다. 완료 후 새 능력 admission과 회복 후 후보 정리 경로가 있다.
- `projection.rs`는 완료된 정보에 당시 snapshot을 사용한다. 현재 상태 재계산으로 과거 전달을 대체하지 않는다. 효과·모의 안내·수학자 근거는 기존 Character 및 공통 조회 계층에 남긴다.
- `CanonicalSessionController.apply/undo`는 후보 전체를 replay한 성공 결과만 반환한다. `CustomCanonicalSession.execute/load`는 그 성공 이후 채택한다. Parser와 storage는 구조 검사, core는 의미 검사를 담당한다.
- 파일 왕복은 export → parse → controller.replay → 성공 canonical의 snapshot → saveSession → load의 기존 구성 요소 합성이다. 새 import 서비스/화면을 추가하지 않았다. 저장장치 실패 시 최신 메모리 상태를 유지하는 기존 autosave 정책도 유지한다.

정적 점검에서는 추가 결함을 확인하지 못했으나, 후속 실행에서 C27-b의 Spy Reveal 내부 출처 노출을 발견하여 수정했다. 승인된 혼합 숫자·출처와 실패 후 보존의 실행 결과는 아래에 기록한다.

## 사례별 책임과 남은 검증 경계

아래 Rust 파일은 `crates/custom-domain/src/`, 웹 근거는 `web/test/custom/` 기준이다. 기존 근거는 재사용 후보이며 이번 단계에서 실행하지 않았다. 각 행에 묶인 사례도 Spec의 독립 입력·기대 결과를 유지한다.

| Spec 사례 | 구현 책임 | 기존 근거 후보 | test 단계에 남은 경계 | 구분 |
|---|---|---|---|---|
| C01-a | game, TB/SnV, effects, runtime | tbSnvFirstNight.test.ts, issue208_information.rs | R0 고정 정보값·출처별 완료와 Day 사실 전체 | Production |
| C01-b | plan, runtime admission | firstNightPlan.integration.test.ts | 시스템 정보를 옮긴 R2 명시 순서 | Production |
| C02-a, C02-b | plan, definition 검증, canonical controller | firstNightPlan.integration.test.ts, issue208_contracts.rs | 각 순서 변조의 시작·복원 거부, 작성용 기본 순서 독립성 | Production |
| C03 | catalog, registry, TB 준비 | issue208_contracts.rs, issue208_preparations.rs | 추가 행동 7개의 정규 순서 제외와 준비/전달 분리 | Production |
| C04 | Character activation, runtime | issue208_scheduler.rs | R2 보류 후 미보유 행동 생략 | Production; 기존 scheduler 근거 일부 내부 |
| C05 | TB 준비, SnV 획득, admission | issue208_information.rs | R1 두 점쟁이 출처·순서와 수학자 0 | Production |
| C06 | TB activation/준비, admission | issue208_information.rs | R2 획득 시작 정보의 남은/지난 순서 두 변형 | Production |
| C07 | SnV activation, admission | issue207_acquisition.rs | R2 empath의 남은/지난 순서, 정보 1 | Production |
| C08-a | simulation, TB/SnV | issue208_simulation.rs, tbSnvFirstNight.test.ts | TB·SnV 안내와 실제 능력 미부여 | Production |
| C08-b | simulation, SnV 선택/사용 | issue208_information.rs | acquiredDrunk의 모의 선택 연쇄·사용권 보존 | Production |
| C09-a, C09-b | simulation, effects, runtime, projection | issue207_acquisition.rs, storageReplay.test.ts | 회복 전 미전달/전달 분기와 과거 false 보존 | Production |
| C10 | TB 준비 검증, effects, snapshot | issue208_information.rs | R4 재준비 출처와 최초 Spy 표식 보존 | Production |
| C11 | SnV twin 후보/결과, runtime | issue208_twins.rs, storageReplay.test.ts | R5 지정·통지·교환·재지정·재통지와 원인 | Production |
| C12-a, C12-b | effects, TB Soldier, SnV No Dashii | issue208_effects.rs, issue208_information.rs | R10 보호와 출처별 중독, 대상 비이동 | Production |
| C13-a | TB 시작 정보, resolved definition | issue208_information.rs | 정상 혼합 정보 허용/거부 쌍 | Production |
| C13-b | TB Chef, registration judgments | issue208_information.rs | R9 쌍별 판정 1과 비인접 scope 거부 | Production |
| C13-c | SnV 정보, Vortox 판정 | issue207_information.rs | R7 실제 진영 기준 true 거부/false 허용 | Production |
| C14-a, C14-b | simulation, malfunction 집계 | issue208_information.rs, issue207_mathematician.rs | R8 정답/오답 0·1 및 모의 선택 연쇄 | Production |
| C15-a, C15-b | SnV Mathematician, malfunction, projection | issue207_mathematician.rs | 같은 주체 중복 제외와 복수 수학자 과거 전달 | Production |
| C16-a, C16-b | SnV Mutant, reducer, runtime | issue208_mutant.rs | R6 집행 여부·중독별 사실과 수학자 | Production |
| C17 | SnV twin/Mutant, reducer, runtime | issue208_mutant.rs | R11 종료·행동 차단·Day 미진입 | Production |
| C18-a | runtime, 준비 후보 | issue208_preparations.rs | 미해결 준비 중 Dawn 거부 | Production |
| C18-b | runtime 선택적 후보/복귀 | issue208_mutant.rs | 선택적 미집행 후 Dawn 허용·옛 후보 거부 | Production |
| C19 | gameFile, controller, sessionStorage, session | gameFileContract.test.ts, storageReplay.test.ts | Spec에 열거한 각 checkpoint의 전체 왕복 합성 | Production |
| C20-a, C20-b | canonicalUndo, controller, full replay | storageReplay.test.ts, tbSnvFirstNight.test.ts | 각 이벤트 한 개씩 Undo, 직전 출처·대기 복원 | Production |
| C21-a, C21-b, C21-c, C21-d | registry, occurrence, Character 결과, TS validators | storageReplay.test.ts, issue208_contracts.rs | 각 필드 독립 변조와 원본 상태·저장 보존 | Production |
| C22 | registry, runtime, canonicalStream/controller | firstNightContract.test.ts, issue208_scheduler.rs | 오래된 후보·중복 ID·완료 occurrence 재사용 거부 | Production |
| C23 | full replay, controller, storage 합성 | storageReplay.test.ts | 정상 prefix 뒤 잘못된 사건에서 전체 거부·부분 저장 없음 | Production |
| C24 | propose/replay/query 순수 경계 | firstNightContract.test.ts | 같은 입력 반복 시 사용·완료·canonical 무변경 | Production |
| C25 | compatibility, replay, 준비 출처 | compatibility.integration.test.ts, storageReplay.test.ts | 고정 호환 기록과 assignTwin 누락 무보정 거부 | Production |
| C26-a | core loader/controller, storage | productionIsolation.integration.test.ts | 로딩 실패·fixture 입력 거부·원본 보존 | 환경/Production 거부 |
| C26-b | custom 빌드/의존 경계 | productionIsolation.integration.test.ts, verify-custom-runtime-isolation.mjs | 공식 산출물 없이 실행, fixture 격리 | 환경 |
| C27-a, C27-b | event_reveal, projection, revealPayload | tbSnvFirstNight.test.ts, issue208_information.rs | 최소 Reveal·과거 Spy 전달 보존 | Production |

Production registry의 누락/예상 외 등록/잘못된 참여 분류/선언 중복은 일반 게임 명령으로 만들 수 없는 내부 결함이다. 구현된 검사에 대한 whitebox 보강은 test 단계에서 정의하며 Production 시나리오 성공의 대체 근거로 쓰지 않는다. Fixture scheduler 근거도 같은 방식으로 제한한다.

## Implement 단계에서 수행한 확인

2026-09-09, 위 기준 커밋의 #209 작업 트리 변경본:

- `cargo check -p clocktower-custom-domain -p clocktower-custom-wasm --offline` 통과.
- `cargo check -p clocktower-custom-domain -p clocktower-custom-wasm --features custom-runtime-fixtures --offline` 통과.
- `cargo check -p clocktower-custom-wasm --target wasm32-unknown-unknown --offline` 통과.
- `cargo fmt --all -- --check`, `git diff --check` 통과. 컴파일의 unused/dead-code 경고는 남아 있으며 이 작업에서 광범위한 정리를 하지 않는다.

이 시점에는 테스트를 작성·실행하지 않았으며 빌드 성공만 확인했다. 다음 절은 그 이후 test 단계에서 얻은 별도의 실행 근거다.

#205에는 R0 혼합 완료, R1/R2 획득·준비, R4 재준비와 과거 Spy 정보, R5 쌍둥이 재지정, R11 종료/Undo 및 C19 checkpoint를 전달한다. 화면에서 현재 행동·필수 준비·선택적 행동·정보 전달·재개를 연결하는 관찰은 #205의 실제 UI 단계에서 수행한다.

## Test 단계 설계와 검출력

기준은 승인된 §7.1 그대로다. 새 블랙박스 기대값을 구현 출력에서 만들지 않았다. `issue209/inputs.json`은 D와 R0–R11 입력만 옮겼다. 숫자와 출처는 테스트에서 독립적으로 확인하고, 같은 prefix의 왕복 동등성은 별도로 검사한다.

| 실제 위험 | 추가 보호와 기대값 근거 | 잘못된 구현이 통과하지 않게 한 점 |
|---|---|---|
| 등록 누락이 추가 후보 순회에서 사라짐 | `issue209_registry.rs`: 29개 각각 제거, 7개 추가 행동 오분류, 예상 외 identity, 중복/spec 불일치, 부분 구성 | 개수뿐 아니라 항목마다 제거하며 production builder 호출 자체도 격리 결함 주입으로 확인 |
| 준비를 완료로 취급하거나 두 소유자 혼합 | C03/C05/C06 및 C18-a | 자동 준비 helper를 재사용하지 않고 각 준비·전달을 명시; p1/p2 소유자·준비 기록·이벤트별 Undo 검사 |
| 같은 잘못된 계산을 replay도 반복 | C01/C07/C12–C16 | 3·0·1, 진영·생존·대상과 실제 선택의 독립 기대값을 확인한 다음 왕복 동등성 검사 |
| 올바른 실제 소유자/instance로 바꾼 위조가 수락됨 | C21-a/b/c/d | 무작위 문자열만 쓰지 않고 다른 실제 소유자·instance·이전 준비·기존 사건도 넣으며 정상 대안은 계속 확정 |
| 실패한 후보가 부분 채택되거나 저장됨 | `rejectCommand`, `rejectEvent`, C23 | append/full replay와 parser→controller에서 거부를 확인하고 원본 session snapshot 및 IndexedDB 내용 불변 검사 |
| 과거 정보가 현재 상태로 다시 계산됨 | C09-b/C10/C15-b/C20 및 기존 `issue207_mathematician` | 원래 사건·Spy 완료 행·직전 prefix 결과를 보존; 내부 historical snapshot 증거와 공개 결과를 구분 |
| 공개 마도서가 canonical 내부 출처를 누출 | C27-b 및 Reveal validator 거부 | 실제 sourceEventId가 있는 준비/중독 표식 사용; canonical 기록에는 출처가 남고 공개 payload에는 없음을 함께 확인 |

Registry 검사에서는 실행 결과를 만들지 않는 unknown-identity double 한 개만 사용한다. 나머지 등록 결함은 실제 handler로 검사한다. 이 파일과 아래 결함 주입은 내부 증거이며 mixed Production 실행을 대신하지 않는다.

격리된 임시 custom-only workspace에서 다음 probe를 실행했다. `action_registry`가 `ActionRegistry::new`를 호출하기 직전에 Fortune Teller `assignRedHerring` 등록 한 개를 제거하고, `assert!(action_registry().is_err())`를 검사한다.

1. 현재 production 완전성 gate 유지: 통과(exit 0).
2. 같은 결함에서 `registry.validate_production_completeness()?` 호출만 제거: 실패(exit 101, 누락 준비를 조용히 허용).
3. 호출 복구: 통과(exit 0).

주 작업 트리에 mutation을 적용하지 않았고 임시 복사본은 삭제했다. 실제 C27-b 테스트 역시 수정 전 `sourceEventId` 노출로 실패하고 수정 후 통과했다. 이것이 공개 경계 검사의 실제 검출력 근거다.

기존 테스트는 삭제하지 않았다. #207의 내부 snapshot·수학자 근거 검사, #208의 준비/효과/옛 통합 twin 거부, 고정 compatibility 검사를 유지하고 실행했다. 새 mixed 시나리오는 Rust에 중복 구현하지 않고 더 넓은 generated-WASM/session 경계에서 작성했으므로 계획의 `issue209_mixed_first_night.rs`는 만들지 않았다.

## 발견한 결함과 수정

**C27-b — Spy Reveal의 내부 출처 노출 (해결).** R4에서 최초 준비 후 Spy를 확인하면 공개 `automaticReminders`에 `sourceEventId`가 포함됐다. `projection.rs::custom_information_reveal`에서 전달 snapshot의 복사본만 정리하여 공개 출처를 제거했다. Canonical 정보·과거 표식·상태·저장 계약은 유지한다. TypeScript Reveal 타입에서 출처를 제외하고 validator도 공개 입력의 출처 필드를 거부한다. 표식의 비활성 사유 등 표시 상태는 유지한다.

초기 테스트 오류도 구분하여 수정했다. Fixture registry는 production action ref의 부분집합이므로 부족한 구성의 오류는 unavailable이다. 정보 결과는 기존 `result.information.deliveredResult`, 대상 Reveal은 `candidatePlayers`, 종료 없음은 `null`, 명시적 순서의 source는 `definition`이다. Chef의 정상 선 판정은 override 생략으로 표현한다. 이 수정들은 승인된 숫자·동작 기대값 변경이 아니다.

## 수용 사례 실행 결과

파일 약어: **M**=`web/test/custom/issue209MixedFirstNight.test.ts`, **R**=`issue209RoundTrip.test.ts`, **P**=`issue209Provenance.test.ts`. 모두 일반 generated custom WASM을 사용한다. 각 테스트 이름에 Spec ID가 들어 있으며 공용 `take`의 매 확정 뒤 C19 합성을 실행한다.

| 사례 | 실행 근거·관찰 결과 | 판정 |
|---|---|---|
| C01-a, C08-a(SnV), C27-a(수학자) | M R0: monk/butler/poisoner, Chef 3, Empath 0, FT 예, Drunk 안내 0→Math 1; 정규 행동 1회씩 및 Day의 중독·주인 유지 | 통과 |
| C01-b, C04 | M: 시스템 이동 순서 보존, 보류 후 Math→Dawn | 통과 |
| C02-a, C02-b | P: 누락·중복·잘못된 ref·경계·unknown을 시작/복원에서 거부, 작성용 pool 역순의 같은 기본 제안, 명시 순서 보존 | 통과 |
| C03, C05, C24 | P 추가 행동 7종 정규 순서 거부; M R1 독립 준비 2개, p2→p1 순서, 예·Math 0, 실제 philosopher 유지, 반복 propose/replay 불변 | 통과 |
| C06, C07 | M R2: 시작 정보의 남은/지난 순서 즉시 실행과 일반 Empath의 남은 순서 참여/지난 순서 미실행, 정보 monk/1 | 통과 |
| C08-a(TB), C08-b | M R8/R2: 실제 drunk 안내, acquiredDrunk 모의 연쇄, 실제 grant 하나·철학자 사용 한 번·Actual/Shown 유지 | 통과 |
| C09-a, C09-b, C15-a | M R3 회복·미완료 제거·전달 false 유지·Math 1; 기존 `issue207_mathematician`이 동일 주체의 독립 근거 2개와 내부 snapshot 보강 | 통과 |
| C10, C27-b | R R4 재준비 필요·옛 준비 참조 거부·새 mathematician 전달, 최초 Spy 사건/완료 행 보존, 공개 출처 제외·canonical 출처 보존 | 통과 |
| C11 | R R5 교환 전후 캐릭터/진영·원인·재지정·통지·Dawn 대기 | 통과 |
| C12-a, C12-b | M R10 보호·중독 출처 및 No Dashii 대상 비이동 | 통과 |
| C13-a, C13-b, C13-c | M/P: 혼합 시작 정보 쌍 허용/거부, Chef 쌍별 1·비인접 거부, Vortox 실제 선/선의 true 거부·false 허용 | 통과 |
| C14-a, C14-b | M R8: 전달 2/0에서 Math 0/1; 모의 획득/교환 없음·Math 1 | 통과 |
| C15-b | M 원래 수학자 2 전달 뒤 획득 수학자 1, 과거 사건 유지; 기존 #207이 이전 prefix 기준 0 및 내부 과거 Reveal 2 확인 | 통과 |
| C16-a, C16-b | M R6: false 후 필수 Math 유지·오래된 후보 거부, 건강/중독 집행의 사망 차이·Math 0/1·Dawn | 통과 |
| C17, C27-a(처형) | M R11: goodTwinExecuted·악 승리·firstNight 유지·행동 없음·Dawn 거부, 공개 승리/출처 미노출 | 통과 |
| C18-a, C18-b | M/R: 준비/정보/재지정/통지 중 Dawn 거부; 미집행 선택적 후보가 남아도 Dawn 허용 후 옛 후보 거부 | 통과 |
| C19 | M/R 매 확정 prefix의 export→parse→full replay→독립 IndexedDB save→새 session load; 명시된 모든 checkpoint 포함 | 통과 |
| C20-a, C20-b | R 새 통지→재지정→교환, M 집행 및 전달→준비→획득을 하나씩 Undo하여 각 이전 prefix 완전 복원 | 통과 |
| C21-a, C21-b, C21-c, C21-d | P/R 실제 다른 출처·미래/이전 사건·이중 주장·중복 대상·반대 결과·비인접 scope를 각각 거부하고 정상 후보 수락 | 통과 |
| C22, C23 | M/P 완료/선택적 옛 Step·동일 ID·새 ID의 완료 occurrence 거부, R 정상 재지정 prefix 뒤 위조 통지 전체 거부·원본 저장 유지 | 통과 |
| C25 | 고정 `compatibility.integration.test.ts` 그대로 통과; R assignTwin 삭제 거부; 기존 `issue208_twins`의 옛 통합 twin 거부 통과 | 통과 |
| C26-a | P custom adapter 로딩 실패 주입은 WASM_LOAD_FAILED, fixture kind는 Production WASM/TS 모두 거부·저장 유지 | 통과(환경 오류 주입 별도) |
| C26-b | custom-only 임시 환경의 Rust/Production WASM/fixture WASM/TypeScript/session 검사를 모두 통과. 공식 소스·WASM이 없음을 runner에서 확인 | 통과(격리) |
| C27-a(세탁부) | M 대상 쌍·monk의 정확한 최소 Reveal | 통과 |

## #203 상위 불변식 연결

| 불변식 | 가장 강한 이번 근거 |
|---|---|
| 지원 action마다 정확히 하나의 production handler | 실제 합성 registry 29개·항목별 누락/중복/분류 검사 및 gate 결함 주입 |
| proposal/reducer를 통한 canonical 변경과 동일 replay 검증 | M/R 정상 합성·P/R 개별 변조/전체 거부·C24 순수성 |
| 미보유 0, 실제·획득·변경 instance의 0/1/N 순서 | C04/C05/C06/C07/C09/C11 |
| 입력·action·actor·provenance 일치 | generated-WASM C21-a/b/c/d와 C22 |
| mixed 첫날 밤 완료·Day | R0의 독립 정보값과 정규 9개 TB 행동 완료·Dawn |
| 공식 TB·SnV 실행/직렬화 비회귀 | 공식 소스 무변경 및 의존 경계 검사, 기존 공식 domain/WASM 및 web 회귀 실행 결과 |

#203이나 #209 이슈 종료·병합을 뜻하지 않는다. #205의 실제 화면 흐름은 이 작업의 범위 밖이다.

## 실행 상태·명령·CI

2026-09-09, 기준 `e9518943e252d4a29037c2862ce6ed3e36f19a25` 위 `codex/issue-209`의 미커밋 변경 상태에서 실행했다. 최종 소스·테스트·입력·CI 파일 17개의 fingerprint는 다음과 같다. 문서 자체는 제외했다.

```text
SHA-256 41194fb6b8857195d5b1098cc0fa1eabae74d2c775cd9ee4df8cc0d7ae9f1247
```

산출 방식: `git diff --name-only`와 untracked non-ignored 파일을 합쳐 `docs/acceptance/`를 제외하고 경로순 정렬한 뒤 각 `경로 + NUL + 파일 bytes + NUL`을 SHA-256으로 계산했다. 격리 실행은 같은 최종 production 코드에서 수행했으며, 그 뒤 추가한 unknown-registry 검사와 assertion 보강은 주 작업 트리의 Rust/custom 웹 전체 검사에서 확인했다.

| 명령 | 결과 |
|---|---|
| `cargo fmt --all -- --check` | 통과 |
| `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm` | domain 140, WASM 6 통과 |
| `pnpm build:wasm:custom` | 통과 |
| `pnpm test:custom-runtime` | fixture domain 102, fixture 웹 13 통과; fixture WASM 생성 성공 |
| `pnpm --dir web test:custom` | 타입 검사 및 26 파일/109 검사 통과; #209 신규 30개 포함 |
| `node scripts/check-custom-boundaries.mjs` | 공식/custom 의존 독립 확인 |
| `node --test scripts/check-custom-boundaries.test.mjs` | 10개 통과 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 공식 소스·WASM 없는 custom Rust/WASM/타입/Production 및 fixture 웹 검사 통과 |
| `pnpm --dir web build` | 최종 Reveal 타입 포함 TypeScript/Vite/PWA 빌드 통과 |
| `cargo test -p clocktower-domain -p clocktower-wasm` | 공식 domain 381, WASM 4 통과 |
| `pnpm --dir web test` | 기존 웹 단위 166, 통합 605 통과 |
| `git diff --check` | 통과 |

기존 Rust unused/dead-code 경고는 남아 있다. 최초 offline 의존 설치의 cache 부족, sandbox 내 wasm-opt 실행 제한, 공식 WASM 생성 전 의존 경계 검사의 unresolved import는 환경 준비 후 같은 정규 명령으로 해결했다. 실패를 피하기 위해 최적화나 검사를 끄지 않았다.

새 Rust 6개는 `tests.rs`에서 production 설정으로 수집된다. 새 웹 30개는 기존 `vitest.custom.config.ts`의 `test/custom/**/*.test.ts`와 `tsconfig.custom-test.json`에 포함되며 CI의 `pnpm --dir web test:custom`에서 실행된다. Fixture 설정으로 production 사례를 실행하지 않는다.

기존 CI에 없던 boundary 검사 및 custom-only 격리 실행을 `.github/workflows/validate.yml`에 추가했다. 이 단계는 Production/fixture/공식 WASM을 생성하는 기존 단계 뒤에 위치한다. 기존 Rust workspace·공식 웹·server·browser 단계는 유지했다. 원격 CI 자체는 아직 실행하지 않았다.

**판정:** 검토한 블랙박스 수용 사례와 내부 보강 검사 통과. C27-b에서 발견한 구현 결함은 해결했다. 남은 구현 결함은 없다. 별도 Playwright 브라우저/UI 검사는 실행하지 않았으며, 새 import 화면·사용자 교체 확인·#205 실제 UI 흐름은 이 runtime 수용의 성공으로 간주하지 않는다. GitHub 병합·이슈 종료는 수행하지 않았다.
