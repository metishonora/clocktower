# #220 T13 구현 계획 — action 의존 실행·29개 UI·새 시나리오·Undo

2026-09-12. **2026-09-12 사용자 승인 완료.** [spec 개정안](../specs/issue-220-t13-action-contracts-draft.md) D1–D5/A01–A12/N01–N07/U01–U05와 [29개 action 계약표](issue-220-action-contract-matrix.md)를 함께 승인받았다. 이전 T13 초안 전체를 대체한다. 요구사항 조사나 묶음 방식 선택을 구현 작업으로 미루지 않는다. 제품·테스트 코드는 이 계획 작성에서 변경하지 않았다.

## 1. 변경 범위와 확인한 현행 구조

목표는 action 자체의 의존 선언을 Core의 단일 원본으로 삼아 실행·진행 표시·UI 연결·Undo를 일치시키는 것이다. 각 action의 입력과 공개는 기존 TB/SnV production을 재사용하고 BMR 테마로 표시한다. 29개 action을 각각 완료 판정하며 특정 캐릭터 묶음 예외를 만들지 않는다.

이번 작업에는 새 게임 옆의 새 시나리오, 빈 작성기 초기화와 기존 저장 보존, BMR Undo 확인 방식 복원도 포함한다. T10–T12의 수정은 유지한다. 이야기형 #218, 지원하지 않는 낮/다음 밤 행동 추가, 저장 포맷 개편, 의도 문서 작성은 범위에 없다.

| 확인한 파일/경로 | 현행 근거 → 계획에서 바꿀 지점 |
| --- | --- |
| `first_night/catalog.rs`, `registry.rs` | 4 system+18 정규+7 추가 action. 추가 action의 linked_action은 배치 위치 표 → action 소유 선언에서 조회 |
| `characters/trouble_brewing.rs` | 준비 후보/합법성/준비 event 및 informationFlow 소유 → 규칙 유지, 공통 의존 resolver로 출처 제공 |
| `characters/sects_and_violets.rs`, `simulation.rs` | 쌍둥이 관계 source, 생성 능력/모의 parent 존재 → 현재 실행과 과거 참조 구분 |
| `first_night/runtime.rs`, `state.rs`, `projection.rs` | scheduler가 순서·완료 occurrence·확정 당시 snapshot을 보존 → 같은 fold에 실행 경계 추가 |
| `runtime.rs::legacy_initial_candidate/legacy_ordered_preparation_candidate` | 과거 준비 prefix/여러 소유자 먼저 준비한 파일 허용 → 호환 replay 유지, 비연속 묶음 금지 |
| `custom/grimoire/firstNightController.ts` | setupInfo+informationFlow 특례, requiredInput 종류에 따른 완료/통지 분기 → 공통 실행 계약+action adapter |
| `CustomPhaseOrder.tsx::groupedOverview` | Web에서 informationFlow로 그룹 생성 → Core 제공 실행 표시만 사용 |
| `custom/core/canonicalUndo.ts` | 현재 사건 하나당 한 단위, setup 제외 → Core가 제공한 실행 단위 검증/제거만 담당 |
| `canonicalSessionController.ts` | 파일/script/stream/stale 검증 후 replay → 보존하며 Core Undo 대상 연결 |
| `CustomGrimoireApplication.tsx`, `applicationController.ts` | hidden editor·sourceFile·starting·restoreId와 요청 수명 → 빈 editor 재생성 및 navigation 초기화 |
| `badMoonRisingGame.tsx` | BMR Undo는 native confirm/empty/요약 라벨. SVG는 이미 동일 → 같은 view·확인 방식 재사용 |

원본 근거는 단순 컴포넌트명이 아닌 production 호출 경로다. TB `main.tsx::confirmTroubleBrewingSelection`의 독살범/집사 확정은 직접 진행 복귀, SnV `confirmLiveHandoff/acknowledgeIdentityReveal`의 통지는 마도서 안내/공개/마도서 복귀다. 옛 감사표의 ‘독살범 추가 결과/다음’은 최신 계약표로 정정했다. 첩자 기준은 실제 TB의 잠긴 LiveFlow/LiveGrimoire 호출이며 사용되지 않는 revealMode 전용 화면이 아니다.

## 2. 구현 전 확정할 공통 계약 — 이 문안의 승인 범위

### C1. ActionSpec와 규칙 소유

`ActionSpec`에 의존 선언을 추가한다. 캐릭터별 등록은 `characters/trouble_brewing.rs`와 `sects_and_violets.rs`, system은 `first_night/system.rs`에 둔다. 공통 registry는 아래 선언과 resolver 인터페이스만 알고 캐릭터 이름별 분기를 갖지 않는다.

- `prerequisites`: 소비 action이 요구하는 선행 actionRef 및 action handler의 기존 필요성/후보 조회. 계약표 D의 P에 대응한다. 필요하지 않으면 새 action을 생성하지 않는다.
- `continuationSources`: `preparation`, `relationship`, `immediateOrigin` 출처 선언. handler가 반환한 실제 source event/occurrence와 registry의 actionRef를 대조한다. I는 공통 immediateOrigin resolver 사용을 각 캐릭터 action에서 선언한다.
- handler 조회는 `ResolvedActionDependency { predecessorOccurrence, predecessorEventId?, consumerOccurrence, sourceKind }`를 반환한다. pending 준비는 eventId 없이 occurrence로, 확정 후에는 실제 eventId로 연결한다. 직접 선행 action은 하나로 정하고 새 준비가 있을 때 그 준비가 직접 부모, 그 이전 생성 사건은 준비의 부모다.
- `immediateOrigin`은 생성 사실+정확한 능력/source+기존 `RunImmediately` 결정이 모두 있을 때만 현재 연속 의존이다. `JoinPendingOrder`는 새 실행, `Defer/NoAction`은 미실행이다. 참조 source가 있다는 이유만으로 바로 실행하지 않는다.
- registry가 누락 actionRef·잘못된 source·모호한 직접 부모·자기 참조/실제 occurrence 순환을 거부한다. 동일 action ID의 다른 instance 실행은 ID만으로 순환이라 판단하지 않는다.

`catalog.rs`는 등록 키와 기본 작성 순서 목록으로 유지한다. linked_action의 준비→소비 매핑은 ActionSpec에서 조회해 runtime/projection 모두 같은 결과를 사용한다. drunk 준비의 고정 철학자 배치 링크는 실제 획득·모의 source와 기존 큐 위치로 대체한다. 시나리오의 정규 action 순서와 기존 activation 규칙을 변경하지 않는다.

### C2. replay 내부 실행과 read-only 출력

`state.rs`의 진행 상태 및 완료 snapshot에 replay 전용 실행 관계를 기록한다. 새 `first_night/execution.rs`는 관계를 현재 실행에 편입할지 결정하는 공통 순수 함수다. facts/outcome 계산은 기존 handler에 남긴다.

실행 내부 값은 `executionId`, root occurrence, 사용자에게 표시할 소비 action occurrence, 확정 eventIds, 현재/대기 의존 occurrence, 종료 여부다. 실행 ID는 root occurrence의 기존 안정적 identity로 결정하며 타임스탬프/랜덤/UI 클릭에 의존하지 않는다. 확정 당시 parent와 실행 소속은 그 prefix에서 확정하고 나중의 정체 변화로 재해석하지 않는다.

read-only DTO를 다음 의미로 확장한다(이름은 아래를 기준으로 한다).

| 출력 | 필드와 소비자 |
| --- | --- |
| `PhaseStep.execution` | `{ id, rootStepId, displayStepId, predecessorEventId?, relation: independent/continuation/reference }`. current/available action을 controller가 같은 실행으로 연결할 근거 |
| `ReplayState.actionExecutions` | `{ id, rootStepId, displayStepId, stepIds, eventIds, status: pending/active/complete/interrupted }[]`. Core가 정한 사용자 진행 행과 과거 실행 membership |
| `ReplayState.latestUndoUnit` | `null` 또는 `{ id, executionId, eventIds, summaryStepId }`. id는 해당 단위의 마지막 확정 event ID, summaryStepId는 확정 snapshot/실행 표시 행동을 참조 |

`phaseOverview`의 내부 action 행은 호환·진단용으로 유지한다. Web은 actionExecutions의 displayStepId/stepIds로 행을 렌더링할 뿐 직접 그룹 기준을 만들지 않는다. pending 준비와 소비 action도 같은 표시 단위를 투영해 ‘세탁부 준비/세탁부’ 두 행을 만들지 않는다. source가 다른 실제/주정뱅이 소유자는 다른 실행 ID다.

`informationFlow`를 쓰는 기존 계약을 당장 삭제할 필요는 없지만 새 실행 모델에서 파생한다. 새 화면과 Undo는 execution을 기준으로만 판단한다. DTO는 Rust contracts/model/projection/boundary와 TS types/validation/adapter를 같은 단위에서 갱신한다. GameFile·canonical event·schemaVersion4·JSON parser의 exact keys는 변경하지 않는다. DTO가 없는 구버전 응답은 연결 오류로 처리하고 TS 추론으로 보완하지 않는다.

### C3. 실행 연결/종료 알고리즘

1. scheduler가 기존 시나리오/activation 기준으로 정한 현재 occurrence와 필요한 준비를 조회한다. action의 의존 선언으로 준비/소비 및 실제 source 관계를 검증한다.
2. 미확정 root이면 독립 실행을 만든다. 현재 실행 안의 검증된 부모를 잇는 현재 의존 occurrence이면 같은 실행을 유지한다. pending prerequisite도 root부터 같은 단위로 표시한다.
3. 사건 확정 시 기존 facts 처리 후 완료 snapshot과 해당 실행에 사건을 추가한다. 다음 현재 occurrence를 같은 선언으로 평가한다. 같은 실행의 입력/공개로 이어가되 다른 정규 action을 앞당기지 않는다.
4. 독립 action, 다른 소유자의 실행, 자유 행동, phase/게임 종료 또는 현재 후속 없음은 경계를 끝낸다. 나중에 그 결과를 읽는 action은 reference 관계의 새 실행이다. 선택 취소/읽기 전용 공개 열람은 canonical 경계를 만들지 않는다.
5. 실행 중 새 준비가 필요한 재지정도 같은 규칙으로 처리한다. 과거 previousPreparationEventId/triggerEventId를 따라 오래된 실행까지 합치지 않는다.
6. 옛 파일은 기존 replay admission을 보존하고 당시 stream 순서에서 실행을 재구성한다. 독립 사건이 끼어 끊긴 source는 reference다. 정상 신규 실행과 옛 실행에 서로 다른 캐릭터 목록을 두지 않는다.

최신 Undo 단위는 마지막 실행의 확정된 연속 suffix다. setupConfirmed 제외, 비연속 membership/중복 event/최신 prefix 불일치면 오류다. 관계가 있어야 묶이며 단순 연속성은 충분조건이 아니다. 독립 사건이 중간에 있으면 이를 건너뛰는 삭제를 하지 않는다. 그 사건을 Undo한 뒤 prefix를 다시 replay하면 이전 미완료 실행의 상태가 자연스럽게 복원된다.

### C4. Web 실행과 action adapter

새 `web/src/custom/grimoire/actions/registry.ts`에서 전체29 action 키를 필수 등록한다. adapter의 계약은 `inputView`, `selectionContract`, `completionContract`, `revealView`, `revealOpen/closeDestination`, `cancellation`이다. 원본 view에 Core projection을 공급하며 rule/합법 후보/의존 판단은 갖지 않는다. UI 세부는 계약표 R01–R29가 기준이다.

공통 controller는 기존 propose/apply/save/lock/stale를 유지하며 상태를 `editing → proposing → applying/saving → awaitingInput 또는 awaitingReveal → completed`로 연결한다. Core execution ID/current action이 같은 경우 다음 adapter로 인계한다. 입력 없는 연결도 공개 버튼은 자동으로 누르지 않는다. busy/public/중복 입력 잠금은 공통 처리한다.

각 draft/proposal/비동기 요청은 game stream+execution ID+action occurrence에 귀속한다. 다음 action으로 넘어갈 때 선택값을 넘겨쓰지 않는다. 알려진 예: 붉은 청어 1명 선택을 점쟁이 두 대상 draft로 복사하지 않는다. 실패하면 성공한 prefix와 현재 입력을 유지해 재시도하고, 확정한 action은 재실행하지 않는다.

공개 payload는 기존 proposal/confirmedEventReveal의 allowlist만 사용한다. UI 선택을 마쳤다는 이유로 비밀 화면을 자동 노출하지 않는다. 원본 마도서의 공개 안내를 이어 사용하는 것이 ‘직접 공개 연결’의 의미다.

### C5. Undo와 새 시나리오

Undo 범위는 Core latestUndoUnit 하나를 사용한다. session은 stream 전체 일치 및 expectedUnitId를 검증하고 suffix를 제거한 파일을 Core replay한 후 저장한다. 같은 root에 후속 사건이 더 붙으면 unit ID가 바뀌어 옛 확인이 거부된다. summaryStepId의 사용자 행동자/직업/동작으로 요약하며 내부 ID를 그대로 표시하지 않는다.

새 시나리오는 확인 후 빈 작성기 첫 화면이며 기존 저장은 이동만으로 변경하지 않는다. 저장 중에는 이동을 실행하지 않고 저장 실패 시 기존 복구 경로를 유지한다. 확정하면 editor instance/sourceFile/starting/요청 세대와 navigation marker를 초기화한다. 기존 파일을 검토하는 openEditor 의미는 바꾸지 않는다. 원본 BMR 확인창 형태와 spec N의 문구를 사용한다.

## 3. 개발 단위와 순서

각 단위는 **test 설계·작성·검토·예상 실패 확인 → 구현 → 같은 검사 통과 및 필요한 회귀** 순서다. 선행 단위의 DTO를 가짜 production 응답으로 우회해 후행 작업을 완료 처리하지 않는다. 문서 작성 단계에서 테스트나 제품 코드를 바꾸지 않는다.

### P1. Core action 선언·실행 경계·DTO

- **파일:** `crates/custom-domain/src/first_night/{registry,catalog,runtime,system,mod}.rs`, 새 `execution.rs`; `characters/{trouble_brewing,sects_and_violets}.rs`, `simulation.rs`, `state.rs`, `projection.rs`, `contracts.rs`, `model.rs`, 응답 구성의 `game.rs`/`boundary.rs`; `crates/custom-wasm/src/lib.rs`; `web/src/custom/core/{types,validation,coreAdapter,wasmClient}.ts`; `ARCHITECTURE.md`.
- **작업:** C1–C3를 같은 계약 단위로 구현한다. 29개 선언에 D 표 적용, 기존 linked_action 소비처 모두 전환, source 검증과 실행 경계/진행 표시/Undo DTO 생성. fixtures의 ActionSpec/Replay 응답도 같은 필수 계약으로 갱신한다.
- **책임:** 캐릭터 rule이 필요/출처를 결정, registry가 선언과 identity 검증, scheduler가 순서, execution fold가 같은 실행 여부, projection이 출력한다. 공개 view를 replay/facts 입력으로 쓰지 않는다.
- **의존:** 승인된 T13 spec 및 계약표. 후속 P2/P3의 선행 조건.
- **위험·제약:** 현재 29개 등록 누락, required queue가 시나리오 앞을 침범, 생성된 instance 혼동, 참조 순환, 완료 snapshot 재해석, 옛 저장 admission 삭제. 기존 regular order/activation semantics를 바꾸지 않는다.
- **test 입력:** Rust 새 `tests/issue220_action_dependencies.rs`와 기존 issue195/206/207/208 scheduler/relationship/information, TS `web/test/custom/issue220T13Core.test.ts`. `tests` 모듈 등록 및 fixture 빌드 포함. A02/A03/A05/A06/A08/A10/A11/A12.
- **완료:** source가 같은 의존 실행의 current/overview/undo metadata 일치, 29개 선언 전수성, 새 준비/과거 참조/직접·다단계 생성/옛 prefix를 실제 Core replay로 확인. GameFile roundtrip에서 새 metadata가 저장되지 않는다.

### P2. session Undo·공통 Web 흐름

- **파일:** `web/src/custom/core/{canonicalUndo,canonicalSessionController}.ts`, `custom/session.ts`, `custom/grimoire/{firstNightController,eventPresentation,actionPresentation}.ts`, 새 `grimoire-custom/actions/registry.ts` 및 adapter 타입, `grimoire-custom/{taskPresentationModel,CustomPhaseOrder}.ts/tsx`.
- **작업:** C4/C5 연결. inferCanonicalUndoUnits의 custom 사건 추론 소비를 제거하고 Core DTO를 전달한다. prepareUndo에 최신 replay unit을 사용해 검증 후 suffix만 제거한다. 공통 실행 인계를 넣고 기존 setupInfo/informationFlow만의 자동 연결과 groupedOverview 판단을 교체한다. 아직 adapter 미등록이면 기존 오류로 처리하며 범용 화면으로 대체하지 않는다.
- **책임:** action adapter는 표현, controller는 실행 전환/요청 수명, canonical session은 검증·변경·replay·저장. 실행 membership을 둘 이상에서 계산하지 않는다.
- **의존:** P1. 실제29 adapter 연결은 P3에서 각각 완료한다.
- **위험·제약:** 같은 root의 오래된 undo 확인, 부분 성공 뒤 중복 확정, 저장 실패 뒤 후속 실행, restore가 public/미확정 draft를 되살림, 기존 단일 action 흐름 회귀.
- **test 입력:** `canonicalSessionController.test.ts`, `customCanonicalSession.test.ts`, 새 `issue220T13Execution.test.ts`/`issue220T13Undo.test.ts`; 실제 Core+fake IndexedDB로 준비만/전체 완료/후속 실패/저장 실패/Undo 실패를 검사한다. A02/A03/A05–A08/A10/A11.
- **완료:** 동일 prefix의 실행/Undo가 새 session·JSON·자동 저장에서 일치. 실제 제거 eventIds와 화면 요약의 대상 일치, 실패 때 저장 내용/현재 action 보존, 명시되지 않은 자동 결합 없음.

### P3. action별 adapter·원본 UI 전수 연결

- **파일:** `web/src/custom/grimoire/actions/{system,troubleBrewing,sectsAndViolets}.ts/tsx`에 action별 명시 등록/함수; `CustomNightTask.tsx`, `CustomStepInputs.tsx`, `CustomGrimoireBoard.tsx`, `CustomReveal.tsx`, `CustomGrimoirePlay.tsx`, `taskPresentationModel.ts`; 해당 `shared-ui/` view와 TB/SnV production 호출부.
- **작업:** 다음 29행을 각각 계약표의 정확한 선택/확정/공개/닫기로 연결한다. 원본 view 추출이 필요한 경우 공식 화면과 custom 모두 그 view를 소비하게 한다. 기존 범용 분기의 소비가 없어지면 제거한다. 중복 markup/CSS로 다시 갈라놓지 않는다.
- **의존:** P1/P2. 구현 순서는 system/단일 대상 → 필수 준비/정보 → 통지/정체 변화 → 생성/모의 → 나머지 정보/첩자/자유 행동이다. 이 순서는 개발 순서이며 게임 실행 순서와 무관하다.
- **공통 위험:** requiredInput 종류로 UI를 일괄 결정, 공개 버튼 생략, 중간 진행 탭 삽입, 다른 소유자 draft 재사용, 원본에 없는 판정/다음 버튼, 기존 보정/태그 수정 회귀.

| 단위 | action 키 | 구체적인 완료 조건·핵심 검사 |
| --- | --- | --- |
| P3-R01 | system.dusk | 별도 시작 카드 없이 Core 진입, 중복 dusk 없음 |
| P3-R02 | system.minionInfo | 원본 하수인 수신자/공개/닫기, 사용자 순서와 비밀 경계 |
| P3-R03 | system.demonInfo | Core bluff 후보/정확히3명, 모바일 공개 크기·카드·닫기 |
| P3-R04 | system.dawn | 기존 낮 시작 버튼/day 입력, phase 종료·Undo |
| P3-R05 | fortuneTeller.assignRedHerring | 원본 착각 1명/합법 등록. 새 준비 후 R22 대상 선택으로 연결, 별도 draft·과거 지정 보존 |
| P3-R06 | washerwoman.prepareInformation | 합법2명/정상·중독·취함, 별도 준비 행 없이 R15까지 같은 실행 |
| P3-R07 | librarian.prepareInformation | 허용0명 또는 합법2명, 두 사서 소유자의 준비·공개 교차 없음 |
| P3-R08 | investigator.prepareInformation | 하수인 정보와 필요한 등록만, 불법 조합/불필요한 정답 선택 차단 |
| P3-R09 | drunk.assignShownCharacter | 획득한 주정뱅이 준비/모의 출처, 초기 배치로 되돌리지 않음 |
| P3-R10 | poisoner.choosePoisonTarget | 마도서 확정→진행, 독자 결과/다음 제거, 중독 토큰 보존 |
| P3-R11 | butler.chooseMaster | 합법 주인 확정→진행, 불필요한 진행 확인 없음 |
| P3-R12 | snakeCharmer.choosePlayer | 비교환/교환 분기, 원본 수신자 순차 통지/닫기→마도서 |
| P3-R13 | witch.chooseCursedPlayer | SnV 마도서 저주 선택·결과/복귀, 독자 공개 화면 없음 |
| P3-R14 | evilTwin.assignTwin | 마도서 지정→R27 원본 공개 안내, 진행 탭 왕복/추가 다음 없음 |
| P3-R15 | washerwoman.learnTownsfolk | 자기 준비로 TB 좌석·직업 공개, 닫기/완료 뒤 다음 실행 |
| P3-R16 | librarian.learnOutsider | 0명/2명 공개, 실제+주정뱅이 별도 source·연속 실행 |
| P3-R17 | investigator.learnMinion | 원본 하수인 공개, 재준비/중독·취함/Undo/복원 |
| P3-R18 | chef.learnEvilPairs | TB 첩자/은둔자 취급과 쌍 단위, 실제 판정/전달 구분 |
| P3-R19 | empath.learnEvilNeighbors | TB 이웃 취급과 명 단위, 등록/판정 일치 |
| P3-R20 | clockmaker.learnSteps | SnV 칸 단위와 승인된 ‘이번 판정의 XXX 취급’/실제 판정값 |
| P3-R21 | mathematician.learnCount | SnV 감사 접기·원인/시점·숫자·공개, generic JSON 없음 |
| P3-R22 | fortuneTeller.checkDemon | TB 두 대상/악마 취급→진행 판정/공개, 붉은 청어 draft/Undo 경계 구분 |
| P3-R23 | dreamer.learnCharacters | 마도서1명→진행 선악 쌍/실제 직업 잠금→원본 공개 |
| P3-R24 | seamstress.compareAlignments | 사용/보류·합법2명→진행 같은/다른 진영/공개·소모 |
| P3-R25 | philosopher.chooseAbility | 원본 선택/보류/획득 identity, 즉시/지연/미실행 분기와 새 ability source |
| P3-R26 | cerenovus.assignMadness | 마도서 대상+직업→원본 안내/공개→마도서. 독자 통지 목록 없음 |
| P3-R27 | evilTwin.learnTwin | 실제 relationship source/수신자 공개, 지정부터 Undo1회 및 과거 관계 참조 |
| P3-R28 | mutant.resolveMadnessExecution | 자유 dock/처형 첫 문장 확인, 별도 탭/행/중복 태그 없음. 독립 Undo |
| P3-R29 | spy.inspectGrimoire | 실제 TB 잠긴 shell/좌석/토큰 열람/중앙 확인 완료, 허용 payload만 |

- **test 입력:** 새 `web/test/issue220T13ActionContracts.test.tsx`의 R01–R29 명시 cases, `web/test/custom/issue220T13MixedFlows.test.ts`, 기존 T9–T12 회귀. 등록 키 exact-set 검사로 누락/중복/범용 fallback을 잡는다. 준비·전달은 별도 action 검사와 합친 사용자 흐름 검사를 모두 둔다.
- **블랙박스 완료:** 각 R행에 A01–A12의 적용/N/A 이유와 증거를 기록한다. 모든 action의 정상 입력·취소·실패·완료·공개·Undo·복원, Core가 허용하는 중독/취함/모의/획득/재지정 변형을 검사한다. 도달 불가능한 상태를 조작한 fixture를 실제 통과로 인정하지 않는다.
- **직접 UI 완료:** 실제 원본/Custom 경로에서 선택 강조·결과·공개·복귀를 대조한다. 320/390/820/1366px 각각 내용 잘림/오버플로·팝업 위치·선택 결과·잠금을 확인한다. 초기/준비/완료 상태 중 필요한 화면 모두 포함한다. 원본과 다른 새 UI를 만들어 합격시키지 않는다.

### P4. 새 시나리오와 editor/저장 수명

- **파일:** `web/src/grimoire-custom/{CustomUtilities,CustomGrimoireApplication,CustomGrimoireSetup,CustomGrimoirePlay}.tsx`; `custom/grimoire/{applicationController,browserSessionNavigation}.ts`; 작성기 instance 수명을 연결하는 `custom/authoring/{CustomScenarioEditor,useScenarioEditor,scenarioEditorController}.tsx/ts`; 저장 수명은 기존 `custom/storage/sessionWriter.ts`/`session.ts` 경계를 사용.
- **작업:** onNewScenario를 공통 utilities의 새 게임 바로 다음에 전달. spec N의 BMR dialog/문구 사용. app controller에 빈 작성 진입 동작 추가, 기존 hidden editor를 단순 show하지 않고 key/instance를 교체해 sourceFile/starting/초안/검토/오류 초기화. start 타이머와 이전 request 세대 무효화, setup/play/writer 수명 종료, navigation marker만 제거. mount 때 잡은 restoreId/재시도가 옛 게임을 되살리지 못하게 한다.
- **저장:** 확정 사건의 저장이 처리 중이면 완료 전 이동하지 않는다. 실패 상태는 기존 retry/stay 경로로 유지한다. 이동 자체는 기존 저장 레코드를 삭제/빈 값으로 갱신하지 않는다. 새로운 게임을 저장할 때 기존 슬롯 정책을 적용하며 추가 덮어쓰기 질문 없음. import용 openEditor는 기존 의미 유지.
- **의존:** P1/P2와 독립 구현 가능하지만 마지막 통합은 P3와 함께 한다.
- **위험:** hidden editor 재사용으로 이전 선택 잔류, stale import/restore/start timeout, writer의 늦은 write, 미저장 사건 유실, 다른 슬롯 삭제.
- **test 입력:** `web/test/custom/issue220Application.test.ts`, `issue220Writer.test.ts`, `web/test/customGrimoireUtilities.test.tsx`, 새 `issue220T13NewScenario.test.tsx`. fake IndexedDB 원본 snapshot 비교와 지연 promise/실패/반복 클릭. 실제 app 검사는 P6에 포함.
- **완료:** N01–N07 전부 통과. 취소는 상태 무변경, 확정은 빈 첫 화면, 새로고침 후 강제 옛 게임 복원 없음, 기존 저장 불러오기 가능, 기존 새 게임은 같은 시나리오 유지.

### P5. BMR Undo 표시·확인 복원

- **파일:** `web/src/badMoonRisingGame.tsx`, `web/src/grimoire-custom/CustomGrimoirePlay.tsx` 및 Undo가 노출되는 setup 연결, 새 `web/src/shared-ui/UndoButton.tsx`, `custom/grimoire/eventPresentation.ts`; 기존 `badMoonRisingGame.css`/productionShell 스타일 재사용.
- **작업:** 원본 snvGlobalUndo/empty/disabled/aria-label/동일 SVG를 공유 view로 추출하고 BMR/custom 양쪽에서 사용. Custom Undo용 GameConfirmationDialog를 제거하고 원본 `window.confirm('최근 행동을 되돌릴까요?\\n'+summary)` 방식으로 복원한다. spec U의 실제 개행 문구를 사용한다. 제거된 배치 복귀 버튼의 미사용 confirmation/onRestart UI 연결도 정리하며 Core restart 기능은 임의 삭제하지 않는다.
- **대상:** P2의 latestUndoUnit만 사용하고 확인 전후 expectedUnitId/prefix 확인. 요약은 실제 실행/행동자이며 내부 변수값이 아니다. public/busy 중 비활성 유지.
- **의존:** P2. 공유 버튼 작업 자체는 P3와 독립.
- **위험:** native confirm을 DOM modal로 잘못 검사, 원본 BMR 회귀, 요약과 제거 범위 불일치, 같은 root의 새 후속 action을 옛 확인으로 삭제.
- **test 입력:** 새 `web/test/issue220T13UndoUi.test.tsx`, 기존 BMR button/controller 회귀. window.confirm 취소/확정/대상변경, 브라우저에서는 `dialog` 이벤트의 confirm type/문구/accept/dismiss를 검사한다.
- **완료:** U01–U05와 A07/A08. 버튼 위치/크기/empty/라벨과 native confirm 원본 대조, 실제 Undo replay·자동 저장 확인.

### P6. 통합·회귀·인수 기록

- **파일:** 새 `web/test/browser/issue220-t13-production.spec.ts`, `issue220-t13-reference.spec.ts`; `fixtures/acceptance/custom-first-night/issue220/`의 실제 도달 fixture; `docs/testing/issue-220-t13-test-preparation.md`, `issue-220-t13-results.md`; `docs/plans/issue-220-action-contract-matrix.md`의 구현/검증 링크.
- **작업:** 실제 작성→배치→첫 단계 하수인/악마 정보→각 의존 실행/독립 실행→공개/Undo→JSON/자동 저장 복원→새 시나리오까지 검사. checkpoint는 시작 상태 준비에만 쓰며 검증 대상 조작 자체를 우회하지 않는다.
- **의존:** P1–P5 완료. 새로운 실패를 전수 표에 기록하고 해당 단위 수정/관련 회귀 후 재검증한다.
- **필수 실행:** `cargo test --workspace`; `pnpm --dir web test:unit`, `test:custom`, `test:integration:run`, `check:architecture`; 관련 browser와 기존 T9–T12 선택/공개/저장/인원 보정 회귀; `pnpm --dir web build`, `pnpm --dir web verify:pwa`, `git diff --check`. WASM 변경 후 web 테스트가 새 산출물을 사용하도록 프로젝트 build 경로를 선행한다.
- **직접 검증:** 29행/네 너비/해당 변형의 원본과 custom을 실제 화면으로 비교한다. 자동 테스트가 없거나 직접 못 본 항목은 미검증으로 남긴다. DOM에서 문자열이 보였다는 이유로 공개 전체가 정상이라고 판정하지 않는다.
- **서버:** 실제 review가 필요할 때 지정 operator와 manager를 통해 최신 빌드/HTTP/자산 확인. 기존 T12 서버는 이 문서 작업에서 건드리지 않는다. 리뷰 중에는 유지하고 병합/이슈 종료는 별도 요청 없이 하지 않는다.
- **완료:** 아래 수용 조건과 전수표에 미통과/미검증/미정 UI 없음. 원본 호출 경로·실행 fixture·테스트명·결과를 연결한 인수 항목표를 사용자에게 제공한다. 전체 문안 채택 및 결과 게시 범위는 사용자의 승인에 따른다.

## 4. 수용 조건 → 구현·검증 추적

| 조건 | 개발 단위 | 반드시 관찰할 경계 |
| --- | --- | --- |
| D1/D2, A08 | P1/P2 | 전수 선언과 source 검증, 임시 UI/추론 fallback 부재 |
| D3, A01/A02/A09 | P1–P3 | 각 action의 실제 선택→결과/공개→복귀·진행 행 |
| A03/A10 | P1–P3 | 같은 표시 직업/다른 소유자, 획득/모의/다단계, 즉시·지연 배정 |
| A04 | P1/P3 | 부분 선택 강조, 불법 조합 확정 불가, 중독/취함과 정확한 취급 UI |
| A05/A11/A12 | P1–P3/P6 | 시나리오 순서, 독립 삽입, 옛 준비 prefix/교차 소유자 기록 |
| D4, A06/A07 | P1/P2/P3/P5 | 각 확정 prefix의 JSON/자동 저장/Undo·요약·실제 제거 사건 |
| N01–N07 | P4/P6 | 전체 utility 위치·취소·빈 작성·저장 보존·stale 응답·기존 새 게임 |
| U01–U05 | P2/P5/P6 | BMR 버튼/기본 confirm과 실제 Undo/저장 |
| T10–T12 승인 사항 | P3/P6 | 판정 실제값, 보정 강조, 중복 태그/배치복귀 부재, reveal/선택/원본 UI |

## 5. 완료 판정과 승인

이 계획은 공통 의존 모델, 생성·과거 참조·옛 저장 경계, 29개 action별 동선, 새 시나리오, Undo UI와 검증 범위를 모두 포함한다. 구현 중에 사용자에게 묶을 조합이나 새 UI를 고르게 하는 작업은 없다. 내부 파일 분할 등 외부 계약을 바꾸지 않는 구현 세부만 작업자가 결정한다.

현재는 **전체 spec 개정안·plan 승인 완료**다. 사용자의 기록 지시에 따라 #220에 채택하고 test 준비를 진행한다. 제품 구현 완료나 전수 인수 통과를 의미하지 않는다.

## T13 구현 전 test 기록 — 2026-09-12

사용자 승인 후 [테스트 준비 기록](../testing/issue-220-t13-test-preparation.md)에 P1–P6/R01–R29를 연결했다. 테스트 준비 완료이며 제품 구현은 미완료다. Core 실행 DTO·묶음 Undo·저장 실패 후 진행·쌍둥이/점쟁이 동선·새 시나리오·BMR Undo UI의 예상 실패를 확인했다. 기존 동작 중 새 spec과 충돌하는 Undo 기대값을 정정했다. 후속 implement는 이 기록의 Red 및 가려진 후속 assertions와 원본 대조를 모두 완료해야 한다.


## T13 구현 및 검증 기록 — 2026-09-12

승인 범위 P1–P5 구현 완료. [구현 기록](../implementation/issue-220-t13-implementation.md)과 [P6 실행 결과·R01–R29 추적·사용자 인수 항목](../testing/issue-220-t13-results.md)을 연결했다. 기존 test 준비 Red 기록은 당시 상태로 보존한다. 현재 검증 결과는 결과 문서를 기준으로 보며 사용자 인수 승인은 별도다.


| 개발 단위 | 구현 후 판정 | 근거 |
| --- | --- | --- |
| P1 | 완료 | 29개 선언·Core DTO/source/legacy 회귀, Rust/fixture/WASM |
| P2 | 완료 | 연속 실행·저장 실패/재시도·stale·Core suffix Undo |
| P3 | 완료 | 29개 adapter·action 계약 및 네 너비 실제 원본/Custom 경로 |
| P4 | 완료 | 빈 작성기/요청 수명/저장 보존·actual browser |
| P5 | 완료 | BMR 공유 버튼/native confirm·실제 Undo/저장 |
| P6 | 완료 | 결과 문서의 필수 명령·184 browser·원본 대조·서버 검증. 사용자 인수 별도 |
