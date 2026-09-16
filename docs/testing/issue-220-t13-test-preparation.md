# #220 T13 테스트 준비

후속 상태: [T13 구현·검증 결과](issue-220-t13-results.md). 아래 Red는 구현 전 준비 당시의 기록이다.

2026-09-12. **테스트 준비 완료. 기능 구현·전체 인수는 미완료.** 사용자가 spec 개정안과 plan을 승인하고 이슈 기록 및 test 실행을 요청했다. 제품 코드는 변경하지 않았다. 테스트 파일·테스트 모듈 등록·기존 기대값과 문서만 수정했다.

이슈 기록: [T13 테스트 준비 결과 전체](https://github.com/metishonora/clocktower/issues/220#issuecomment-5636960140).

## 승인 기준과 기록

- [승인 spec](https://github.com/metishonora/clocktower/issues/220#issuecomment-5636672451), [승인 plan P1–P6](https://github.com/metishonora/clocktower/issues/220#issuecomment-5636673471), [29개 계약표](https://github.com/metishonora/clocktower/issues/220#issuecomment-5636674696)를 #220에 게시하고 본문 상단에 최신 기준 링크를 추가했다. 기존 Intent는 수정하지 않았다.
- 로컬 기준: [spec D1–D5/A01–A12/N01–N07/U01–U05](../specs/issue-220-t13-action-contracts-draft.md), [plan C1–C5/P1–P6](../plans/issue-220-t13-action-contracts-plan-draft.md), [action 계약표](../plans/issue-220-action-contract-matrix.md).
- 특정 조합 whitelist, 같은 캐릭터/인접 사건 추측은 기대값으로 사용하지 않는다. 준비·소비 의존과 과거 참조, 생성 능력의 기존 활성화 결정을 구별한다. 정상 준비/전달에 대한 구체적인 사례는 이 원칙을 검사하는 입력이다.

## 경계별 테스트와 결과

| 개발 단위 | 테스트·경계 | 승인 기대 / 결과 |
| --- | --- | --- |
| P1 | [Rust JSON 경계](../../crates/custom-domain/src/tests/issue220_action_dependencies.rs) | 실제 지정·통지/재지정·독립 후속의 실행·Undo DTO 4 Red. 잘못된 관계 출처 거부와 등록29개 exact-set 2 Green |
| P1 | [Core 41개](../../web/test/custom/issue220T13Core.test.ts) | 29개 등록 action, 실제 parent, 준비·완료 prefix JSON, 옛 준비 prefix/다른 소유자 기록, 즉시 Clockmaker/다단계 모의 source, 구 DTO 거부. 40 Red/1 Green |
| P1/P3 fixture | [29개 도달성](../../web/test/custom/issue220T13Reachability.test.ts), [공유 입력](../../web/test/custom/issue220T13Support.ts) | action마다 독립적으로 실제 Production Core 명령 성공을 확인: 29 Green. dusk는 setup 뒤 자동 통과하므로 가짜 확인 사건이나 화면을 만들지 않고 첫 minionInfo 진입 검사 |
| P2 | [Undo 28개](../../web/test/custom/issue220T13Undo.test.ts) | 부분/전체 준비 흐름, 정상·중독·주정뱅이·복수 소유자, JSON 재개, 실패 재시도, stale prefix/확인, 즉시/지연 능력, 중간 자유 행동. 19 Red/9 Green |
| P2 | [controller 실패 4개](../../web/test/issue220T13Execution.test.tsx) | 세 정보 직업의 준비 저장 실패 시 공개 보류, 쌍둥이 후속 propose 실패/재시도·단일 Undo. 4 Red |
| P3 | [action별 UI 41개](../../web/test/issue220T13ActionContracts.test.tsx) | R01–R29 실제 결과→공개/닫기/확정, 선택 복귀6개, 진행 행5개, 미등록 오류. 4 Red/37 Green |
| P4 | [새 시나리오 7개](../../web/test/issue220T13NewScenario.test.tsx) | 직업/마도서/진행/저장 위치, 취소·빈 작성/재진입·저장 실패, 기존 새 게임. 6 Red/1 Green |
| P5 | [Undo UI 4개](../../web/test/issue220T13UndoUi.test.tsx) | BMR empty/요약 라벨/native confirm 취소·확정/공개 잠금. 3 Red/1 Green |
| P3/P4/P5/P6 | [실제 browser 8개](../../web/test/browser/issue220-t13-production.spec.ts), [Core 생성 fixture](../../web/test/issue220T13ProductionFixtures.test.tsx) | 390/1366px 각각 쌍둥이, 점쟁이, 새 시나리오, native Undo. 8 Red. fixture 생성 자체는 Green |

Core DTO 검사는 테스트 전용 타입으로 승인된 출력 구조를 읽는다. 실제 Core 응답에 execution 값을 주입하거나 테스트용 규칙 엔진으로 대신 계산하지 않는다. DTO 부재로 앞에서 실패하는 검사와 실제 제거 사건을 비교하는 Undo 검사를 분리해, 타입 필드만 추가하고 행동은 그대로인 구현이 통과하지 못하게 했다.

29개 도달성 검사는 의존 DTO assertion과 독립 실행한다. 따라서 앞선 DTO 실패가 불법 fixture/도달 불가능한 입력을 감추지 않는다. 같은 이유로 UI 입력 조작 검사는 command→공개 내용 검사와 분리했다. 후자는 입력 widget 전체를 검증한 것으로 집계하지 않는다.

## 실행 명령과 최종 집계

| 명령 | 결과 | 의미 |
| --- | --- | --- |
| `cargo test -p clocktower-custom-domain` | 4 예상 실패 / 143 통과 | 새 실행 projection 4건 실패. 기존 custom domain 회귀 통과 |
| `pnpm --dir web test:custom` | 66 예상 실패 / 229 통과 | 새 T13 59 Red + 승인에 맞춰 바꾼 기존 Undo 7 Red. 실제 fixture/기존 저장·출처 보호 포함 |
| `pnpm --dir web test:integration:run` | 19 예상 실패 / 758 통과 | T13 UI와 변경된 기존 Undo 기대값. 수집/타입 오류를 해결한 후 재실행 |
| `pnpm --dir web exec playwright test issue220-t13-production.spec.ts --workers=2` | 8 예상 실패 | 실제 JSON 가져오기→마도서→선택/utility에서 승인 동작 미구현 확인 |
| `pnpm --dir web exec tsc -p tsconfig.browser.json --noEmit` | 통과 | 새/변경된 browser 검사 타입 |
| `git diff --check` | 통과 | 변경 형식 확인 |

custom/integration 명령에 각 테스트 설정의 TypeScript 검사가 포함된다. Rust는 `tests.rs`에서 production 설정으로 등록했다. `.github/workflows/validate.yml`의 Rust workspace/custom Production/web integration/browser 명령과 기존 glob에 모두 포함된다. 별도 테스트 실행기를 신설하지 않았다.

[실행 로그와 실패 화면](issue-220-t13-evidence/)을 보존했다. 원본 Playwright trace는 `web/test-results/issue220-t13-*/trace.zip`에 있다. 초기 테스트 작성 과정에서 발생한 frozen definition 수정·잘못 잡은 시나리오 위치·jsdom의 fixture URL·타입 오류는 해결했으며 예상 실패에 포함하지 않는다. browser 초기 sandbox의 포트 바인딩 실패도 분리했고, 허용된 재실행에서 실제 페이지의 실패를 확인했다. 임시 서버는 Playwright가 한 명령 안에서 시작·종료했으며 기존 T12 리뷰 서버는 변경하지 않았다.

## 실제 실패와 구현 지점

1. **P1 실행 계약 부재:** currentStep.execution/actionExecutions/latestUndoUnit이 없다. 현재 parser도 실행 계약 없는 응답을 허용한다. P1의 Rust→DTO→TS 검증을 함께 변경해야 한다.
2. **P2 Undo가 마지막 사건만 제거:** 준비+전달·지정+통지 완료 후 준비 사건이 남는다. 즉시 획득 시계공의 획득 root도 남는다. 사용자 요약과 실제 제거 사건을 함께 맞춰야 한다. 부분 준비만 완료한 경우, 지연 능력, 중간 독립 사건 보호는 별도 Green이다.
3. **P2 저장 실패 뒤 공개 진행:** 세탁부/사서/수사관 준비가 저장되지 않아도 다음 proposal/공개를 연다. 확정한 앞부분은 유지하되 저장 성공 전 후속 자동 진행을 멈춰야 한다. 재시도는 확정 사건을 다시 만들지 않아야 한다.
4. **P3 쌍둥이·점쟁이 단절:** 지정 후 진행 탭으로 돌아가 각각 확인/대상 선택을 다시 해야 한다. 준비/소비가 별도 진행 행으로 보인다. 390/1366px 브라우저 및 desktop 실패 screenshot에서 확인했다.
5. **P4 새 시나리오 부재:** 네 utility 위치 모두 버튼이 없다. 빈 editor·이전 import/초안 초기화·navigation 제거·저장 보존 assertion은 버튼 구현 후 끝까지 재실행해야 한다. 현재 새 게임의 같은 시나리오 유지/기존 저장 보존은 Green이다.
6. **P5 BMR Undo 차이:** empty class/접근성 이름과 native confirm 연결이 없다. UI 검사는 이 앞부분에서 Red이며 confirm 문구·취소·실제 그룹 삭제는 구현 후 후속 assertion까지 확인해야 한다.

## 테스트 검토와 기대값 정정

- `issue220V3Flows`, `issue220MixedController`, `issue220T10SetupContract`의 준비 정보 완료 Undo 기대는 전달 화면이 아닌 준비 시작으로 바꿨다. `issue209MixedFirstNight`의 준비/전달 Undo 두 번은 한 번으로, `issue209RoundTrip`의 재지정/통지 역시 한 단위로 바꿨다. 획득 action까지 무조건 포함하지 않는다.
- 기존 SnV activation에서 즉시 실행하는 시계공과 시나리오 위치를 기다리는 다른 능력을 구별했다. ‘획득 후 곧 보였다’는 관찰만으로 dependency root에 획득 사건을 넣는 테스트는 제거하고 정확한 기존 활성화 사례로 작성했다. 다단계 모의 source 참조도 즉시 실행 의존과 동일시하지 않는다.
- `issue220T10Acceptance` 및 관련 browser의 custom Undo dialog 기대를 승인된 BMR native confirm으로 변경했다. 원래 script의 `canonicalUndo.ts`는 변경하지 않았다.
- 마녀의 원본 ‘2번 P2 저주 확정’ 이름을 사용한다. 모든 직업을 ‘선택 확정’ 이름으로 고정하지 않는다.
- `issue209Support`는 fixture를 프로젝트 기준 경로로 읽어 node/jsdom 모두 같은 원본 데이터를 사용하게 했다. mock으로 실제 WASM 경로를 교체하지 않았다.
- 저장 실패/후속 오류의 주입은 외부 실패만 만든다. 성공한 replay·효과·사건·정보는 실제 Core를 사용한다.
- 아직 없는 공개 화면을 열기 위해 내부 상태를 강제 변경하지 않았다. 미등록 action fail-closed 검사에서만 read boundary를 훼손하고 canonical 불변을 확인한다.
- 순수 문구·색상·픽셀 배치에 Red를 강제하지 않았다. 기존 공유 view 검사 및 아래 직접 대조로 검증한다.

## R01–R29 전수 추적과 구현 후 확인

모든 R행은 T13 도달성/Core/UI 개별 case를 갖는다. 아래 보강 범위를 해당 row의 구현 완료 조건으로 유지한다. ‘자동 경로 통과’는 네 너비의 원본 시각 인수 완료가 아니다.

| R | action | 추가 자동 회귀 / 구현 후 직접 확인 |
| --- | --- | --- |
| R01 | dusk | 첫 하수인 정보 진입, 가짜 준비 화면·확인 사건 없음. 개별 공개/대상 입력 N/A |
| R02 | minionInfo | system 순서/수신자·허용 payload·닫기. 입력 대상 선택 N/A, 네 너비 원본 카드 |
| R03 | demonInfo | 기존 team 3개 제한/공개·T10 demon mobile. 네 너비 bluff 선택/공개 크기 |
| R04 | dawn | 기존 T11 day 입력·도착/Undo. 첫날 낮 이후 새 기능 N/A |
| R05 | assignRedHerring | 신규 board 연속 선택/행/Undo, T10 Spy 합법 등록. 지정/판정 입력 분리·강조 |
| R06 | washerwoman.prepareInformation | T10 정상/중독/주정뱅이/복수소유자·불법2명·등록, T13 저장 실패/부분Undo |
| R07 | librarian.prepareInformation | R06 변형 각각 사서로 검증. 0명(Core 허용)·불법 조합·전달까지 재대조 |
| R08 | investigator.prepareInformation | R06 변형 각각 수사관으로 검증. 정답 질문 부재·하수인 등록/전달 |
| R09 | drunk.assignShownCharacter | 실제 획득 fixture/모의 source. 원본 실제·표시 배역 표현, 초기 배치 재진입 없음 |
| R10 | poisoner.choosePoisonTarget | 실제 board확정→진행, 기존 effect·중독 토큰. 영향 시에도 합법 선택/결과 |
| R11 | butler.chooseMaster | 실제 board확정→진행. 주인 라벨·원본 결과·취소, 추가 다음 없음 |
| R12 | snakeCharmer.choosePlayer | 비교환 실제 board; 기존 정체교환/공개 payload 회귀. 교환 시 여러 수신자 닫기·마도서 유지 |
| R13 | witch.chooseCursedPlayer | 실제 저주 확정 버튼/복귀, 기존 효과 회귀. 원본 결과/취소 대조 |
| R14 | evilTwin.assignTwin | 실제 선택→안내 Red, Rust 재지정/부분Undo. 공개가 자동 열리지 않음 |
| R15 | washerwoman.learnTownsfolk | R06+공개 내용/닫기/전체Undo·JSON. 각 소유자 자기 결과·원본 카드 |
| R16 | librarian.learnOutsider | R07+공개/Undo·옛 중간 준비 prefix. 0명/2명·실제/주정뱅이 순차 |
| R17 | investigator.learnMinion | R08+공개/Undo. 중독/취함 잘못된 정답 선택 부재 |
| R18 | chef.learnEvilPairs | 기존 T10 취급/진실/쌍 단위·T9 공개. 정상/영향·실제 판정값 대조 |
| R19 | empath.learnEvilNeighbors | 기존 T10 등록·T9 공개/획득 지연Undo. 이웃/명 단위 |
| R20 | clockmaker.learnSteps | 즉시 획득 앞/뒤 순서·rootUndo, 기존 T10 혼합 취급. 칸 단위/원본 공개 |
| R21 | mathematician.learnCount | 기존 감사근거·숫자 입력/공개. 영향 원인/시점/접기 대조 |
| R22 | fortuneTeller.checkDemon | 새 준비/과거 참조·두 대상/취급·전체Undo/JSON. T10 원본 진실/공개 |
| R23 | dreamer.learnCharacters | 실제 선악 쌍 공개·기존 T10 선택복귀/실제 배역 잠금. 원본 또는 표기 |
| R24 | seamstress.compareAlignments | 실제2명 공개·기존 사용/보류/취급. 소모·같은/다른 진영 |
| R25 | philosopher.chooseAbility | 보류/실제·실패 획득·모의 source 및 immediate/deferred. 획득 identity 원본 |
| R26 | cerenovus.assignMadness | 실제 통지→닫기·기존 madness/공개. 마도서 지정/안내/공개/마도서 동선 |
| R27 | evilTwin.learnTwin | 실제 수신자 payload/닫기·재지정·단일Undo. 마도서 종료 유지 |
| R28 | mutant.resolveMadnessExecution | 실제 자유 행동·개입Undo 및 기존 T11 사망/토큰. 정규행 N/A·dock만·첫 문장 확인 |
| R29 | spy.inspectGrimoire | 실제 payload→잠긴 마도서·기존 T10 badge/상세/닫기. 네 너비 실제 TB shell·유틸 잠금 |

## implement에서 반드시 끝까지 확인할 항목

- P1 DTO Red를 해소한 뒤 뒤에 가려진 membership/parent/root/JSON prefix assertions를 모두 실행한다. 필드 존재만 맞춘 구현을 완료로 표시하지 않는다.
- P2 저장 실패·후속 실패에서 성공 prefix 보존→재시도→최종 단일 Undo·자동 저장까지 검사한다. history/root summary가 내부 ID를 노출하지 않는지 확인한다.
- P3의 각 R행을 기존 TB/SnV 실제 호출 경로와 320/390/820/1366px에서 입력·부분 선택·확정 결과·공개·닫기·취소 순서로 대조한다. 원본 동일성을 문자열 또는 대표 직업 통과로 대체하지 않는다. 기존 T9/T10 reference browser/공개 비교 검사를 재사용하고 새 UI를 만들지 않는다.
- N03/N04의 새 시나리오 확정 후 hidden editor·sourceFile·starting·restoreId가 남지 않아야 한다. 새로고침, 이전 게임 JSON 재가져오기, 이전 writer/import/validation/starting의 지연 응답, 저장 중/실패 재시도는 실제 앱에서 확인한다. 이미 작성한 후속 assertion과 기존 application/writer의 지연 응답 검사를 함께 사용한다.
- U02/U03은 native confirm이 실제 발생한 다음 취소/accept 각각 사건과 저장을 비교한다. 앞선 접근성 이름 assertion 실패만으로 확인창의 구현을 검증했다고 보고하지 않는다.
- 최종 P6에서 승인 plan의 workspace/build/PWA/architecture/production 원본 대조를 완료한다. 이번 단계는 변경된 제품의 build/인수 완료 단계가 아니다.

새 제품 결정이나 임의 UI는 추가하지 않았다. 남은 위 항목은 승인된 구현을 적용한 뒤의 검증이며 요구사항 결정을 구현자에게 넘기는 내용이 아니다.


## 구현 중 근거 정정 — 2026-09-12

즉시 획득 규칙은 SnVActivation만이 아니라 CharacterActivation의 TB 우선 분기를 함께 읽어야 한다.
`characters/trouble_brewing.rs::activation`은 시작 정보 3직업과 요리사를 RunImmediately로 분류한다.
따라서 승인 spec의 공통 immediateOrigin 원칙에 따라 획득한 세탁부의 새 준비/전달은 획득 사건과
한 실행/Undo이다. 테스트 준비 당시 기존 일부 회귀를 ‘준비+전달만 Undo’로 바꾼 기대는 잘못되어 정정했다.
중첩 주정뱅이→모의 철학자→요리사는 요리사를 만든 실제 모의 선택부터 연결하며 과거 주정뱅이 획득은 포함하지 않는다.
규칙/시나리오 순서/제품 요구를 바꾸거나 캐릭터 묶음 예외를 추가한 것이 아니다.
