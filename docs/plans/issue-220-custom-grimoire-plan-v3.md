# #220 수정 계획 v3 — 기존 마도서의 직업별 UI/UX 복원

> 최신 승인·구현·인수 상태는 [최종 상태](../testing/issue-220-final-validation.md)를 따른다. 아래 과거 단계의 native confirm/배치 복귀 전체 제거/인수 대기 표현은 최신 기준으로 대체되었다.


2026-09-11 · 사용자 `$implement` 지시로 구현 승인. R3 판단 기록·복원과 처형 확인 문구의 첫 문장만 사용하는 선택을 포함한다. 구현 결과와 검증 인계는 [v3 구현 기록](../implementation/issue-220-custom-grimoire-v3.md)에 기록한다.

이 문서는 [v2](issue-220-custom-grimoire-plan-v2.md)의 남은 P/Q 구현을 보완·대체한다. v2의 저장·작성·순서·격리 계약은 유지한다. UI 재사용 완료 주장, Q2의 입력 위치와 Q4의 독립 준비 표시를 구현 기준으로 사용하지 않는다. [전면 조사/29개 원본 대응표](issue-220-ui-parity-audit.md)와 [QF1 검증 결과](../testing/issue-220-q-test-results.md)가 입력이다.

## 1. 확정된 목표와 범위

- BMR의 전체 테마/공통 마도서 형태를 기준으로 직업·배치·진행·공개·선택·상세·저장·기록·dialog를 대조한다. TB/SnV의 직업별 완성된 콘텐츠와 상호작용을 추출해 사용한다.
- 자체 UI는 원본 재사용 경로로 교체한다. 기존에 없는 UI는 사용자에게 먼저 확인한다. 내부 구조 재설계 허용을 UI 디자인 재량으로 해석하지 않는다.
- 세탁부/사서/수사관의 준비와 전달은 별도 Core 사실이지만 **하나의 사용자 직업 단계**다. 목록에 `세탁부 준비`/`세탁부` 두 행이나 추가 확인 단계를 만들지 않는다.
- 자유 행동은 기존 dock/패널 경로다. `변종 처형 판단`을 정규 순서 위 탭으로 만들지 않는다.
- 직접 행동의 결과 확인, 정보 대상 수락, 수신자 통지는 서로 다른 기존 흐름을 보존한다. 모든 선택을 즉시 진행으로 보내거나 모두에게 새로운 결과 단계를 붙이지 않는다.
- #205 작성 UI, S1 자동 저장, R1/R2, 첫날 밤 한정, custom/official 독립을 유지한다. 일반 낮/다음 밤/BMR 캐릭터 규칙을 추가하지 않는다.

## 2. Spec revision request R3 — 자유 행동의 기록 차이

**2026-09-11 사용자 지시 반영: 기존 판단 기록·복원까지 가져온다.** 임시 입력만 제공하고 복원을 생략하는 대안은 철회한다. 기존 SnV는 `recordMadnessCheck`와 `executeMadness`를 별도 Core 명령으로 처리한다. custom `mutant.resolveMadnessExecution`의 `execute:boolean`만으로 이를 대체한 연결에는 판단 기록이 빠져 있다.

- 합의된 아키텍처는 유지한다. custom Core가 판단 명령·확정 이벤트·replay/projection을 소유하고, 기존 custom session/GameFile이 확정 이벤트의 자동 저장·JSON·복원·Undo를 담당한다. adapter가 기존 dock/패널의 입력과 표시를 연결하고 shared presentation은 저장이나 규칙을 소유하지 않는다. official runtime/DTO/저장소를 가져오거나 별도 UI 저장소를 만들지 않는다.
- 기존 판단 기록 동작을 현재 지원하는 첫날 밤 변종 자유 행동에 연결한다. 능력 출처/대상과 canonical prefix에 결속하고 계약·검증을 함께 보완한다. 기존 유효 파일과 과거 이벤트는 계속 복원하며 이벤트를 재작성하지 않는다. 새 데이터 계약의 보완을 저장 체계 교체나 파일 버전 상승으로 확대하지 않는다.
- 판단과 처형을 구분하되 판단 기록을 처형의 새 필수 선행 조건으로 만들지 않는다. official 회귀 사례 `madness_execution_can_be_confirmed_without_a_check_event`처럼 선행 판단 기록 없이 처형할 수 있는 기존 의미도 대조한다. reload/JSON 왕복/Undo에서 각각의 확정 사실과 표시가 일치해야 한다.
- 영향: spec 6/7.1, C16/C31/C34/U06/U10/V05. 판단 기록 누락의 보완이며 세레노버스 낮 처형·일반 낮/다음 밤 엔진까지 범위를 늘리지 않는다.
- 확인 문구 결정: 사용자 승인에 따라 custom은 기존 첫 문장 `처형을 확정하면 현재 진행이 중단됩니다.`만 사용한다. 원본 창과 버튼을 공유하며 official SnV 문구와 사망 처리 방식은 유지한다.

## 3. 공통 책임·계약

| 책임 | 구체적 계약 |
| --- | --- |
| custom Core | 규칙/순서/허용 입력/확정/공개/출처 소유. 원래·획득·모의·재준비의 관련 행동과 준비 event 참조를 읽기 전용으로 제공. 웹이 이름이나 배열 인접성으로 짝을 추측하지 않음 |
| session/controller | canonical, 동일 occurrence의 draft/proposal, 입력 수락/명령 확정/결과 확인/통지/공개 origin·복귀 위치 소유. prepare 결과를 선택 결과와 혼동하지 않음 |
| adapter | Core가 제공한 관계를 하나의 사용자 흐름으로 묶는 `flowId`와 기존 표현 props 생성. 현재 실행 occurrence와 사용자 목록 행의 identity를 분리. 규칙 재계산/독자 다음 단계 선택 금지 |
| shared presentation | 값/이미지/문자열/상태/callback으로 원본 DOM·CSS·포커스·버튼 의미를 표현. official/custom DTO, WASM, session, 카탈로그를 직접 import하지 않음 |

### 같은 직업의 준비·전달 연결

`flowId`는 단순 캐릭터 이름이 아니다. Core가 확정한 정규 action reference, owner/ability instance, simulation source, 획득/재준비 원인으로 식별하고 연결된 준비/전달 occurrence 및 sourceEventId를 보존한다. 현재 `actionCause.delivery`만 조회하는 QF1 경로를 제거하고 정규 전달도 해당 준비 사실에 연결한다. 필요한 관계는 `contracts`/`projection`/WASM DTO에서 보완한다. UI 그룹 문자열을 GameFile에 저장하지 않는다.

사용자 `정보 공개` 등 기존 확정 동작에서 필요한 준비를 검증·확정한 뒤 최신 Core 응답의 **동일 관계에 속한 전달**만 제안/공개한다. 한 번의 UI 조작이 두 내부 사건에 연결될 수 있지만 중간에 별도 준비 카드/확인 버튼을 노출하지 않는다. 준비 성공 후 전달/저장 실패 시 준비를 중복 기록하지 않고 같은 직업 화면의 승인된 오류/재시도 경로로 복구한다. 자동으로 잘못된 입력이나 다른 정규 행동을 확정하지 않는다. 과거 초기 준비 선행 파일의 이벤트/Undo 단위/당시 payload는 그대로 유지한다.

### 선택·결과·통지 모델

`firstNightController`에 boolean `selecting`만 두지 않고, 선택 작업의 identity와 상태 `editing | result | notification` 및 반환할 화면을 보관한다. 기존 UI별 수락 방식은 `informationDraft | directAction | recipientNotification`으로 구분한다.

- informationDraft: 대상 선택 수락→기존 진행 편집. 세탁부 보여줄 캐릭터, Dreamer 대상/진실·쌍 편집이 이 경로다.
- directAction: 마도서에서 명령 확정→기존 결과 패널/강조/읽기 전용 상태→`다음 →`. 결과는 확정한 행동의 snapshot을 표시한다.
- recipientNotification: 세레노버스·정체 변경·쌍둥이는 해당 원본의 중앙 안내/공개/닫기/복귀 경로를 사용한다. 모든 역할에 결과 단계를 추가하지 않는다.
- 입력/과거 공개/현재 공개/통지를 구분하고, 결과나 통지를 보는 동안 canonical의 다음 actor를 이전 작업의 actor로 잘못 표시하지 않는다. 탭 왕복/취소는 기존 의미, Undo/외부 변경은 stale 작업 무효화다.

## 4. 개발 단위

### T0. 원본 화면과 교체 목록 확정

- 파일: 조사표, 본 계획, spec/traceability. 원본은 조사표 R01–R29 및 BMR #179 승인 기록.
- 작업: 각 행에 시작/선택 중/선택 완료/진행 복귀/공개/닫기/과거 공개/오류의 적용 여부와 기존 호출자를 대응한다. 규칙상 적용되지 않는 상태는 이유와 함께 기록한다. 코드 확인과 실제 화면 확인을 구별한다.
- 의존: 최초 작업. 신규 UI가 필요한 구간은 구현 전 구체적 화면/동선·문구와 이유를 사용자에게 제시한다. R3의 기록·복원 포함과 기존 아키텍처 유지 결정을 따른다.
- 완료: 모든 29개 action이 원본·변경 파일·수락/확정/복귀 방식에 연결되고 ‘generic fallback’ 행이 없다.

### T1. 원본 표현을 상태 전체 단위로 추출

- 파일: `shared-ui/{GrimoireSelectionPanel,InformationTaskPresentation,InformationInputPresentation,BmrRevealSurface,BmrInformationTask,NightTaskCard}.tsx`, `features/trouble-brewing/{TroubleBrewingProgress,TroubleBrewingLiveGrimoire,TroubleBrewingRevealScreen}.tsx`, `sectsAndVioletsLivePhase.tsx`, `sectsAndVioletsGame.tsx`, `features/{phase-control,madness,identity-change,evil-twin}`의 해당 표현.
- 신규 내부 파일: `shared-ui/GrimoireHandoffView.tsx`, `shared-ui/RoleInformationTaskView.tsx`, `shared-ui/RoleRevealContent.tsx`. 이는 기존 UI의 추출 위치이며 새 제품 화면이 아니다.
- 작업: 제목/행동자/대상/정체·획득 위계/입력 위치/버튼 활성·비활성/완료 결과까지 controlled props로 추출. 숫자 입력 하나나 빈 wrapper만 추출한 채 본문을 custom에서 다시 만들지 않는다. 기존 official 호출자도 같은 view를 소비한다.
- 의존: T0. 규칙/후보 산정·카탈로그·official controller는 official adapter에 남긴다. custom을 official DTO로 cast하지 않는다.
- 완료/검증 경계: 기존 소비자의 상태별 DOM/접근성/시각 동작 유지, custom 격리 검사 가능. 공용 부품의 실제 양쪽 사용을 확인.

### T2. 준비·전달 관계와 단일 UI 단계, QF1 수정

- 파일: `crates/custom-domain/src/{contracts,projection}.rs`, `first_night/{runtime,registry}.rs`, `characters/{trouble_brewing,sects_and_violets}.rs`, `crates/custom-wasm/src/lib.rs`, `web/src/custom/core/{types,coreAdapter,wasmClient,validation}.ts`, `custom/grimoire/{actionPresentation,firstNightController,stepInputModel,historyModel}.ts`, `grimoire-custom/taskPresentationModel.ts`, `grimoire-custom/CustomPhaseOrder.tsx`.
- 작업: 부족한 읽기 전용 인과 관계를 제공하고 정규 전달에도 해당 준비 fact를 공급한다. 표시용 `flowId`/목록 grouping은 custom adapter에서 만든다. 정상/중독/획득 세탁부와 사서/수사관의 준비→전달 차단을 함께 해소한다. 준비·전달 행을 가리고 끝내지 않고 단일 직업 카드 안의 실제 공개까지 연결한다.
- 의존: T0/T1. 시나리오 지정 상대 순서 유지. Core에서 unrelated action을 건너뛰는 UI 루프 금지. 기존 이벤트 재정렬/변조/파일 버전 상승은 하지 않는다. R3의 추가 판단 기록도 기존 파일 복원을 보존한다.
- 완료/검증: A01–A06 및 V01; 같은 UI 행에서 공개까지 완료, 다중 owner/획득/모의/재준비는 서로 분리, 구 파일 복원/Undo/중간 실패 재시도, QF1 5개 React·4개 browser 실패 해결.

### T3. 마도서 선택·강조·선택 결과·복귀 복원

- 파일: `CustomGrimoireBoard.tsx`, `CustomGrimoirePlay.tsx`, `firstNightController.ts`, `taskPresentationModel.ts`, T1 handoff view, `shared-ui/GrimoirePresentation.tsx`, `features/grimoire/sectsAndVioletsSeatStates.css`와 BMR theme 경계.
- 작업: `.issue116GrimoireSurface` 등 실제 원본 조상/좌석 구조를 추출해 스타일 적용 누락을 고친다. actor/target/poison/drunk/ineligible/result/settledOther 상태와 좌석 라벨, Actual/Shown·획득 표현을 연결한다. 확정 시 무조건 실행하는 `onSelectionDone`을 제거하고 앞 절의 직업별 수락 방식에 따른다.
- 작업: 마도서 toolbar/센터 진행 버튼/탭 잠금·취소·초기화·키보드 포커스, 행위별 제목과 확정 문구, 결과 패널의 snapshot·읽기 전용·`다음 →`를 보존한다. 기존 정보 선택에 없는 결과 화면을 새로 넣지 않는다.
- 의존: T1/T2. 결과 확인과 다음 행동 확정을 분리하고 event 두 번 적용 방지.
- 완료/검증: U05/U06/U09/U11, V02/V03. 직접 행동/정보 선택/통지 각각 실제 UI 왕복, 15인 작은 화면, 선택 시/확정 후/취소 상태별 원본 비교.

### T4. 직업별 진행·입력·공개·통지 교체

- 파일: `CustomNightTask.tsx`, `CustomStepInputs.tsx`, `CustomSetupInformationInputs.tsx`, `CustomReveal.tsx`, `taskPresentationModel.ts`, T1 view와 해당 원본 호출자.
- 작업: `CustomStepInputs`의 requiredInput 기반 JSX와 공통 확인/수정/다음 묶음을 제거하고 R01–R29의 원본 view mapping만 남긴다. 세탁부 캐릭터 입력은 기존 진행 위치, 관련 등록은 원본 선택 패널, 유일한 값은 기존 방식으로 표시한다.
- 작업: 숫자 단위/진실·전달/영향·오류, Dreamer 잠금, 재봉사 보류, 철학자·주정뱅이·획득 identity, 수학자 감사 행을 원본 표현으로 연결한다. 현재 사실의 후보는 Core가 공급한다.
- 작업: custom `RevealContent`/`People`/`Character`/자체 SpyBoard와 통지 목록을 대체한다. BMR 전체 공개 표면에 기존 직업별 콘텐츠/문구/닫기 및 수신자 안내를 사용한다. Spy는 당시 payload를 읽는 기존 좌석 표현. 타입별 아무 텍스트를 출력하는 fallback 금지.
- 의존: T1–T3. 정보 공개 보안·과거 snapshot·복원 비공개 상태는 유지. 공개 완료 전후의 입력 잠금/버튼 의미를 각 원본과 일치시킨다.
- 완료/검증: C27–C30/U07/U08 및 V04/V06. R01–R29 전체 해당 입력·공개 종류, 정상/중독/취함/보르톡스·0명·획득/모의/재준비·공개 재열기/취소·저장 실패 확인. 대표 두 직업만으로 완료 금지.

### T5. 자유 행동 dock과 정규 진행 분리

- 파일: `CustomPhaseOrder.tsx`, `CustomGrimoirePlay.tsx`, `actionPresentation.ts`, `firstNightController.ts`, `features/madness/MadnessActionDock.tsx`; 추출 `shared-ui/MadnessActionView.tsx`. R3에 따라 custom domain/contracts/projection/command/file validation/Undo/WASM 경계도 함께 변경.
- 작업: `controller.steps.map`으로 만든 정규 목록 위 선택 pill 제거. Core의 optional 원인과 실제 capability로 기존 자유 행동 dock만 활성화한다. 모든 available action을 optional로 간주하거나 행동을 숨겨 실행 불가로 만들지 않는다. 여러 owner는 기존 dock의 개별 대상 모델로 구분한다.
- 작업: 현재 정규 작업과 자유 행동 panel identity를 분리해 열기/닫기만으로 입력을 초기화하지 않는다. 확정·게임 종료·Undo 시에는 최신 canonical로 갱신한다. selection/reveal/종료 중 비활성 조건을 보존한다.
- 의존: T1/T2 + R3. 판단 기록·복원은 포함한다. 원본과 다른 처형 동선·문구는 임의 구현 금지.
- 완료/검증: C31/C32/U06 및 V05. 정규 목록 위 탭 없음, 기존 dock 위치·형식, 열기/닫기/취소/판단/처형/효과 불발/종료/Undo와 재개 검증.

### T6. 전체 BMR 테마와 승인되지 않은 UI 정리

- 파일: `customBmrTheme.css`, `customGrimoirePlay.css`, `customGrimoireSetup.css`, `CustomRoleSetup.tsx`, `CustomUtilities.tsx`, `CustomEventLog.tsx`, `CustomGrimoireSetup.tsx`, `CustomGrimoirePlay.tsx`; BMR 공용 표현 stylesheet.
- 작업: 조사표의 전 영역을 대조해 독자 카드·폭·패딩·둥근 버튼·아이콘 크기·badge 색 덮어쓰기를 줄인다. 원본이 적용되는 theme token/명시적 variant로 바꾸고 실제 official 소비자도 확인한다. `!important`로 차이를 가리는 추가 override 금지.
- 작업: 원본에 없는 별도 상세 진입, 임의 통지 목록/생존 상태 카드/진행 결과 카드/준비 배지 제거. 이미 승인된 직업 탭의 상세 조회·저장 오류·새 게임/배치 복귀 확인·유틸리티는 유지한다.
- 의존: T3–T5. SnV 클래스 이름 자체를 없애는 작업이 목표가 아니다. 재사용 selector가 남더라도 표시 테마·상태는 BMR이어야 한다. 공식 페이지 테마는 바꾸지 않는다.
- 완료/검증: C20/C21/U01–U04/U09–U12 및 V07/V08. 직업·마도서·진행·공개·utility·dialog의 낮/밤과 320/390/820/1366 폭, 긴 이름·15인·키보드·포커스 상태 전수 대조.

### T7. 구현 후 test와 완료 판정

- 파일: 기존 `docs/testing` 결과·설계, traceability, `web/test/browser/custom-grimoire.spec.ts`, `web/test/issue220InformationUi.test.tsx`, `web/test/custom/issue220*.test.ts`, 실제 공유 부품을 쓰는 공식 회귀. 테스트 설계·작성·실행은 구현 후 `$test`에서 한다.
- 필수 입력: 기존 63개 + spec V01–V08, R01–R29 원본 대응표, QF1, #209 R0–R11, 기존 F1–F4. R3의 판단 기록·독립 처형·reload/JSON/Undo 사례도 포함한다.
- 검증: 사용자 JSON의 실제 새 배치→하수인→악마→독살범→세레노버스→세탁부→남은 직업→Day, 같은 roster의 변경 순서, 구/새 파일 reload/JSON/Undo/과거 공개. 연결 성공과 원본 UI 상태 대조를 각각 기록한다.
- 검증: 직접 행동의 마도서 결과, 정보 선택 후 진행 편집, 세레노버스 통지, 자유 행동을 서로 다른 경로로 실행한다. 모든 역할/적용 상태가 근거를 가져야 한다. 범용 확인 버튼/별도 준비 행의 존재를 정답으로 삼았던 테스트는 수정 근거를 기록한다.
- 필수 프로젝트 확인: `cargo test --workspace`, `pnpm --dir web test:custom`, unit/integration/browser 회귀, `pnpm test:custom-runtime`, custom isolation/boundary/architecture/PWA, `pnpm --dir web build`. 테스트 서버는 기존 manager/operator 경계만 사용한다.
- 완료: 기존 UI의 실제 state/동작·필드 위치·테마와 변경 후 화면의 대응 근거가 있고 미승인 UI 0건, QF1 해결, 적용 항목 실패/미검증이 없어야 한다. 대표 화면/스크린샷 한 장/클래스명/컴파일 통과를 전체 완료로 간주하지 않는다. 물리 기기와 viewport 결과는 구별한다.

## 5. 실행 순서와 승인 상태

T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7. 사용자 `$implement` 승인 후 구현했으며 현재 T7 검증 중이다. R3의 기록·복원과 처형 확인 첫 문장 사용은 승인되었다. 구현 결과와 실제 인수 판정은 별도로 기록한다.

## 구현 계약 구체화 — 2026-09-11

- 판단 기록은 기존 `confirmStep` 입력에 `madnessCheck: clear | violation`을 추가하고 기존 `customActionConfirmed`의 `mutantJudgment` 결과로 기록한다. 별도 UI 저장소나 파일 버전 변경 없이 기존 이벤트 저장·replay·Undo 경로를 사용한다. 다른 직업의 해당 입력은 거부한다.
- Core 읽기 전용 `informationFlow { id, preparationEventId? }`로 준비·전달을 연결한다. controller는 연결된 준비 확정 후 전달 제안을 준비하며, 사용자 목록은 같은 flow를 한 행으로 보여준다. canonical 사건은 각각 유지한다.
- `madness` projection은 판단과 자유 행동 가능 상태를 제공한다. shared view는 규칙을 계산하지 않는다.
- 구현 후 실제 인수 판정은 T7에서 수행한다. 이번 단계의 빌드 성공을 직업별 화면/UX 동등성 검증으로 간주하지 않는다.

## T8. v3 검증 미통과 수정 — 사용자 구현 승인

2026-09-11 사용자 지시 ‘미통과 부분을 plan 갱신하고 이어서 implement’로 아래 수정과 실행을 승인했다. [검증 결과](../testing/issue-220-v3-test-results.md)의 기대 결과를 유지한다. spec/아키텍처 변경이나 새 UI 결정은 없다.

| 순서·결함 | 변경 파일·책임 | 변경과 제약 | 다음 test 완료 조건 |
|---|---|---|---|
| T8.1 F1 | shared-ui/RoleRevealContent.tsx | 공개 문구 상수를 렌더 반환 전에 초기화한다. 원본 공개 콘텐츠/문구·payload 경계 유지 | 공식 공개 10건과 custom 세탁부 공개, 영향받은 전체 integration 통과 |
| T8.2 F2 | crates/custom-domain/src/boundary.rs | 기존 mutantJudgment를 result allowlist에 연결한다. typed 역직렬화/출처/replay 검증은 그대로 유지. 새 이벤트·파일 버전·UI 저장소 없음 | 실제 판단 기록→저장→JSON/reload→Undo, 다른 직업 입력 거부, 격리 runtime 통과 |
| T8.3 F3 | core/informationPresentation.ts | shared helper import에 NodeNext .js 확장자 명시 | unit TS 컴파일 및 기존 unit 검사 통과 |
| T8.4 F4 | grimoire-custom/CustomNightTask.tsx, customBmrTheme.css | 속임수 이미지에 BMR compact와 같은 34px 크기 부여. custom 모바일 grid/버튼 override 삭제. 원본 BMR에 없는 custom 무작위 추천 연결 제거하여 원본 공개/다음 두 버튼 유지 | 320/390/820/1366 새 배치→하수인→악마→독살범에서 실제 클릭 성공, 이미지/글씨 가림 없음. force click 금지 |

독립 결함 수정 후 통합 진단은 Rust 전체 타깃, frontend 각 TS 설정, 필수 web build와 architecture/diff check로 수행한다. 테스트 설계·실행과 실제 화면 인수는 다음 test 단계이며 T7의 71개 조건/29개 action 전체 대조와 기존 browser 구 locator 이전 공백을 유지한다. 네 결함 수정만으로 전체 UI 동등성을 완료로 표시하지 않는다.

## T9 조사 항목 — 추가 사용자 인수 실패

T8의 네 결함 통과와 별개로 새 인수 실패 7건을 접수했다. 전체 UI 재사용은 미통과다. 접수 당시 제품 코드는 미수정이었으며, 이후 사용자 승인으로 아래 T9 구현을 완료했다. 실제 인수 검증은 대기 중이다. 원본과 다른 동작을 승인된 것으로 간주했던 검사도 재검토한다.

| ID | 사용자 관찰 | 코드 확인·수정 대상 | 수용 기준 |
|---|---|---|---|
| T9-1 | 현재 할 일 아이콘 설명 없음 | CustomNightTask의 일반 img와 원본 interactive identity 대조. spec의 제외 해석 정정 | 원본처럼 아이콘/정체 클릭으로 설명, 닫은 뒤 draft 보존 |
| T9-2 | 데스크톱 선택 패널이 마도서 아래 | CustomGrimoireBoard가 bmrGrimoireWorkspace confirmed(1열)에 inspector 추가 | 원본 선택 중 레이아웃/패널 위치. 데스크톱 bounding box 및 모바일 대조 |
| T9-3 | 강조 약함 | BMR 기본 seat CSS와 imported seat state CSS 우선순위/상태 mapping 대조 | 선택/actor/비선택/취소의 원본 효과. 클래스 존재만으로 통과 금지 |
| T9-4 | 선택 후 추가 다음 버튼 | acceptSelection→confirm→handoff result 및 finishHandoff 경로 | 단순 수락 뒤 진행 복귀, 원본 필수 통지/공개는 유지. 직업별 원본 행위 대조 필요 |
| T9-5 | 세탁부 선택 전 비활성 폼 노출 | CustomNightTask needsTargets가 setup을 포함하지 않아 CustomStepInputs 선행 렌더 | 선택 전 원본 대상 선택 상태만, 수락 후 정보 입력 |
| T9-6 | reveal UI 깨짐 | CustomReveal/BmrRevealSurface/RoleRevealContent의 shell·콘텐츠 CSS 조합. 사용자가 하수인/악마 외 직업별 reveal 전체로 확인 | 모든 직업별 공개 종류/폭 재현 후 원본 공개 레이아웃·크기 대조. React 렌더 성공만으로 통과 금지 |
| T9-7 | 중독/취함에서 무의미한 보여줄 캐릭터 | setupChoices→taskPresentationModel→CustomSetupInformationInputs. 해당 직업 확인 질문 전달 | Core 사실 준비와 실제 전달 입력의 원본 UI 위치/후보 의미 대조, 웹 규칙 재계산 금지 |

T9-6은 사용자 답변으로 하수인/악마 외 직업별 reveal 전체로 확정했다. T9-7은 세탁부 등 준비 정보의 정상/중독/취함 상태를 모두 대조하고 추가 제보를 반영한다. T9-4는 원본의 직업별 수락/결과/통지를 대조하여 잘못된 공통 결과 대기를 제거할 경계를 확정한다. 임의 새 UI를 만들지 않는다. 다음 구현 전에 대조 결과와 변경 파일/상태 전이/검증 조건을 구체화한다.

### T9 공개 공통 경계 추가 확인

원본 `troubleBrewingRevealScreen.css`의 `@media (max-width:620px)` 안에 있는 공개 높이/패딩 규칙이 `shared-ui/styles/bmrRolePresentation.css`에서는 미디어 조건 없이 적용되고 있다. 또한 custom 공개는 BMR 기본 section과 TB/SnV 직업별 class를 합성하므로, 원본의 shell 기본 정렬/크기/미디어 조건과 역할 콘텐츠를 함께 대조해야 한다. 단일 문구 상수 수정(F1)은 렌더 오류만 해결했으며 레이아웃 동등성을 검증하지 않았다. 하수인/악마만으로 공개 전체를 대표하지 않는다.

### T9 구현 경계 확정 — 사용자 implement 승인

- 원본 CSS selector에 공용 BMR 역할 variant를 함께 연결하여 원본 미디어 조건/정렬/아이콘/문구 계층을 그대로 사용한다. `BmrRevealSurface`는 team/role variant를 구분하고 역할 화면에는 BMR 팀 화면의 작은 h2 등 기본 규칙을 섞지 않는다. 복사된 role layout 규칙을 제거하고 색상만 BMR tokens로 적용한다. 원본 호출자의 selector/동작은 유지한다.
- `CustomNightTask`의 원본 CharacterDetailButton에 BMR theme와 역할별 기존 상세 데이터를 연결한다. 원래/획득/표시 정체 모두 조회 가능하며 draft/session에 변경 없음.
- 선택 중 workspace는 원본 stable 2열, 일반 마도서는 confirmed 1열이다. 실제 선택 class와 actor/비선택 강조 및 원본 attack-mode wrapper를 연결한다.
- controller의 일반 대상 확정은 canonical 적용 후 별도 result handoff를 만들지 않는다. 통지가 있으면 기존 notification만 남기고 닫기 후 진행 탭으로 복귀한다. 준비 정보의 대상 수락은 이벤트 확정 없이 진행 입력으로 복귀한다.
- 세탁부/사서/수사관은 유효 대상/zero 선택 전에는 원본 대상 선택 동작만 표시한다. 전달 재개/공개 후에는 준비 사실을 읽기 전용 선택 상자로 다시 노출하지 않고 원본 정보 결과 표현을 사용한다. 중독/취함 때문에 Core의 사실 준비나 실제 전달 선택을 웹에서 생략하지 않는다. 선택 후보가 없는 무의미한 캐릭터 상자는 렌더하지 않는다.
- 관련 파일: CustomNightTask/CustomStepInputs/CustomSetupInformationInputs/CustomGrimoireBoard/CustomGrimoirePlay/CustomReveal, firstNightController, BmrRevealSurface, 원본 reveal CSS와 bmrRolePresentation.css. 규칙·이벤트·파일 버전 변경 없음.
- 진단: TS 및 Rust 전체 타깃, web build, architecture, diff check. 상태별 DOM/브라우저 회귀/시각 대조는 다음 test에서 실시하며 기존 단순 result 대기를 기대한 검사는 최신 인수 요구에 따라 수정한다.


### T9 구현 결과 — 2026-09-11

T9-1–T9-7의 승인된 코드 수정을 완료했다. [구현 기록](../implementation/issue-220-t9-fixes.md)에 변경과 다음 test 인계를 기록했다. TypeScript 전체 설정, Rust 전체 타깃 check, architecture, 필수 web build, diff check가 통과했다. 테스트 실행 및 직업별/폭별 시각 대조는 아직 하지 않았으며 T7/T9 인수 상태는 미검증으로 유지한다.


### T9 test 결과 — 2026-09-11

[검증 결과](../testing/issue-220-t9-results.md): 선택·복귀·정보 입력의 보강 검사는 통과했으나 T9-6 공개 UI는 미통과다. 원본 shell/box-sizing/모바일 padding 경로 차이(F1), 320px 통지·정체 변경의 viewport 잘림(F2), 1366px 쌍둥이 내용 넘침(F3)을 기록했다. 제품 수정은 이번 test에서 하지 않았다. 원본 자체에도 좁은 화면 넘침이 관찰되어 원본 치수를 무조건 복제하지 않고, 원본 표현의 계약과 BMR shell의 가용 폭을 함께 조사해야 한다. 새 UI 결정은 승인 없이 추가하지 않는다.

## T10. 추가 사용자 인수 실패 — 수정 전 검증 기준 고정

[10항목 조사 및 실패 검사](../testing/issue-220-t10-findings.md)를 새 작업 기준으로 연결한다. 사용자 ‘이어서 진행’에 따라 조사·기준 정정·선행 회귀 검사를 수행했다. 제품 구현은 아직 하지 않았다. T9 공개 F1–F3도 미해결로 유지한다.

1. 원본 TB/BMR의 역할별 상태 전이를 먼저 대조한다. 준비 전/부분 선택/유효·무효 조합/정보 입력/공개/종료/취소/Undo, 정상·중독·취함, 같은 역할의 복수 소유자를 포함한다. test 기대값은 원본 및 spec에서 도출한다.
2. T10-3/5/6은 `firstNightController`, `stepInputModel`, `CustomGrimoireBoard`, `CustomPhaseOrder`와 Core scheduler/정보 flow projection을 함께 조사한다. Core가 유효 후보와 소유자별 준비→전달 연결을 제공하고 UI는 그 계약을 사용한다. 웹에서 새 순서를 하드코딩하거나 역할 이름만으로 흐름을 연결하지 않는다.
3. T10-2/4/7/9는 원본 setup/scalar/target editors와 `phaseInput`의 표현·입력 계약을 재사용한다. `taskPresentationModel` 및 generic treatmentGroups의 전체 후보 열거를 원본 판정 단위에 맞는 표시로 바꾼다. 정답 플레이어 UI 삭제 뒤 필요한 내부 준비 사실을 임의 첫 후보로 채우거나 Core의 전달/등록 의미를 버리지 않는다. 내부 계약 변경이 필요한 부분은 구현 전에 구체화한다.
4. T10-1/10과 T9-F1–F3은 `CustomReveal`, `BmrRevealSurface`, Spy 좌석 adapter 및 원본 reveal CSS 소비 경계를 대조한다. 악마 공개의 원본 아이콘 크기를 실제 이미지에 적용하고, Spy의 원본 좌석/토큰 badge/외곽 폭·중앙 닫기를 연결한다. 부분 렌더나 공용 wrapper 이름을 동등성 증거로 삼지 않는다.
5. T10-8은 Undo 대상 선택의 Core 단위를 유지하면서 사용자 요약을 presentation 경계에서 제공한다. 원시 step/ability/event 식별자 노출을 막고 과거 기록도 함께 확인한다.
6. 수정 전에 원본 근거→현재 실패→수정 후 통과의 대응을 남긴다. 현재 Vitest 9실패/9통과, 모바일 공개 2실패의 선행 검사를 작성했다. 아직 미완성인 관련 직업 전체/Spy·점쟁이 화면/복수 소유자의 저장·복원·Undo 검사를 보강한 뒤 해당 구현을 검증한다. 동작 검사와 계산된 크기·배치·실제 캡처 대조를 모두 통과해야 한다.

T9의 중독/취함 정답 선택을 요구했던 기대값은 철회한다. T9-3 강조 통과는 독살범 한 대상에 한정되며 두 대상 부분 선택은 실패다. 새 UI·규칙·파일 버전·저장 구조 변경을 이 보완 계획으로 자동 승인한 것으로 해석하지 않는다.

### T10 수정 전 test — 변경된 스킬 적용 결과

> 이 절은 수정 전 기록이다. 후속 구현과 검증은 문서 끝의 ‘T10 구현·검증 결과’ 및 [최신 결과](../testing/issue-220-t10-results.md)를 따른다.

2026-09-11 [테스트 준비 기록](../testing/issue-220-t10-test-preparation.md)에 개발 단위·원본 근거·예상 실패·회귀 보호·구현 후 직접 확인을 연결했다. **테스트 준비 완료**이며 T9/T10 제품 수정과 인수는 미완료다.

- integration 80건: 25 예상 실패/55 통과. Core·session 관련 회귀 19 통과. browser 6건: 4 예상 실패/2 통과. 타입 및 diff check 통과.
- 세탁부·사서·수사관 각각 정상/중독/취함, 부분/무효/유효 조합, 실제+주정뱅이 소유자 흐름을 검사한다. 요리사·공감능력자 선/악 취급과 점쟁이의 마도서 내 악마 여부 판정은 실제 UI→Core 경로로 검사한다.
- 같은 직업의 두 소유자에서 준비 기록의 자동 저장·JSON·Undo는 세 직업 모두 통과하지만, 올바른 소유자의 공개/재개 동선은 실패한다. 화면 연결 수정과 기존 저장 책임을 구별한다. Core 순서를 웹에서 재작성하거나 Undo 단위를 변경하지 않는다.
- 이전의 붉은 청어 문구만을 위한 Red, 공개 화면의 원본과 정확한 픽셀 일치 요구는 직접 대조로 정정했다. 원본 문구/배치 재사용 요구는 유지하며, 자동 검사는 기능·내용 잘림·카드 밖 이미지 넘침을 판정한다.
- 다음 implement는 이 검사들을 기준으로 T10-2/3/5/6의 입력·flow, T10-4/7/9의 판정, T10-8의 요약, T10-1/10 및 T9-F1–F3 공개 경계를 수정한다. 앞선 Red로 아직 도달하지 못한 후속 assertion까지 통과시킨다. 29행 원본 대응표와 폭별 직접 시각 대조를 마치기 전 전체 인수 통과로 표시하지 않는다.

### T10 implement 중 실제 프로덕션 대조 보완

- TB `main.tsx`의 실제 첩자 공개는 `TroubleBrewingLiveFlow` + 잠긴 `TroubleBrewingLiveGrimoire`이다. 앞선 R29의 `revealMode` 경로는 현재 production 호출자가 사용하지 않아 기준이 잘못되었다. 실제 화면은 일반 shell/비활성 utility·탭/마도서/중앙 ‘확인 완료’를 유지한다. 장식적인 ‘SPY · ACTUAL GRIMOIRE’ 전용 화면을 기준으로 삼았던 검사는 정정한다. 공유 Spy view를 실제 호출 경로에 연결하고 custom도 같은 배치·닫기를 사용한다. 공개 내용은 기존 allowlisted snapshot만 사용하며 공개에 필요 없는 현재 상태/메모를 추가하지 않는다.
- 착각 지정: 원본 `night.rs`의 good/Spy 허용 후보와 `usePhaseInputDraft`의 자동 good 등록 연결까지 이식한다. custom의 기존 `playerRegistrationOptions` projection 계약을 사용한다. UI에 별도 질문을 만들지 않고 악마/다른 하수인 선택을 차단한다. Core 확인의 등록 근거와 저장은 보존한다.
- 정보 준비의 남은 generic 취급 목록을 제거한다. 원본 `setupInfoRegistrationJudgments`의 실제 직업 우선/필요한 등록만 연결하는 기준을 custom TB projection에 적용한다. 기존 event validator/replay 범위는 축소하지 않는다.
- 시계공/재봉사 혼합 취급은 원본 SnV에 직접 대응하는 화면이 없어 사용자에게 구체적 권장안을 제시했다. 사용자는 ‘실제 정체’ 대신 실제 판정값을 명확히 표시하고, 제목을 ‘이번 판정의 XXX 취급’으로 유지하도록 지시했다. 선/악의 순서 변경은 요구하지 않았다. 이 지시에 맞춰 선/악 및 시계공의 실제 종류를 표시하고 Core 결과를 연결한다. 판정·저장 아키텍처는 유지한다.

### T10 구현·검증 결과 — 2026-09-11

T10-1–T10-10과 T9-F1–F3의 승인된 결함을 수정했다. [구현 기록](../implementation/issue-220-t10-fixes.md)과 [검증 결과·인수 항목](../testing/issue-220-t10-results.md)을 기준으로 검토한다. Rust 532, frontend unit 166, custom 181, integration 698, browser 41개 및 필수 build/격리 검사가 통과했다. 결과 건수는 서로 다른 검증 경계이며 전체 행동 인수 완료를 뜻하지 않는다.

사용자가 정정한 표기는 ‘이번 판정의 XXX 취급’과 실제 판정값이다. 선/악 순서 변경을 요구한 것으로 해석하지 않는다. 수정 전의 범용 등록 목록·정답 플레이어 질문·중복 결과 선택은 제거했다. 실제 TB 첩자 호출 경로와 토큰 조회를 확인해 잘못된 R29 기준도 바로잡았다.

T10 결함 범위의 구현·자동 검증과 관련 원본 대조를 완료하며, 물리 모바일/사용자 인수 및 T7 전체 71개 조건·29행 모든 상태의 시각 승인 상태는 별도 유지한다. 이슈 병합·종료는 하지 않는다.

### T11 인원 보정 표시·사망 태그 — 계획 승인 완료

인원 보정 표시 명세는 사용자 승인으로 spec에 추가했다(M01–M08). 변종 처형 후 남은 사망 텍스트 칩은 기존 BMR 재사용 누락으로 함께 접수했다(D01–D04). [T11 승인 계획](issue-220-t11-plan-draft.md)에 공통 Core 조회 계약, BMR 표현 공유, 설정·복원 연결, 사망 칩 제거와 통합 검증을 기록했다. 사용자가 전체 계획과 GitHub #220 게시를 승인해 구현 기준으로 확정했다. 다음 단계는 구현 전 test 준비이며 제품 수정 완료를 뜻하지 않는다.

### T11 test 준비 결과 — 2026-09-11

[테스트 준비 기록](../testing/issue-220-t11-test-preparation.md): 신규 34개 검사 작성·검토, 필요한 예상 실패 확인 완료. 관련 기존 회귀를 포함한 최종 결과는 25 예상 실패/38 통과, 타입·diff 검사 통과다. 제품 코드는 변경하지 않았다. 새 보정 metadata·설정/복원 표시와 사망 칩/빈 상태 영역이 실패 원인이며, 실제 인원 계산·사망·토큰·기록 보존은 별도 보호한다. 구현 후 실제 BMR/production 대조와 아직 Red 뒤에 가려진 assertion까지 통과시켜야 한다.

## T11 구현 및 후속 검증 — 2026-09-11

T11-1–4 구현을 반영했다. [구현 기록](../implementation/issue-220-t11-fixes.md), [검증 결과·인수 범위](../testing/issue-220-t11-results.md)를 최신 상태로 따른다. 위의 수정 전 상태는 당시 기록이다.

T11-5의 실제 낮 화면 검증에서 system.dawn의 day 입력을 화면 검사가 거부하는 기존 연결 결함을 발견했다. 기존 버튼/규칙을 유지해 정확한 입력 계약만 연결하고 실제 UI Red→Green 회귀를 추가한다. 같은 검증에서 낮 보정 제목의 밤 색상을 기존 BMR 낮 색상으로 보완했다. 새 제품 동작이나 UI 선택은 추가하지 않았다.

실행한 자동 검사와 네 너비의 production/BMR 대조 결과는 검증 문서에 기록한다. 사용자/실물 기기 인수 및 다른 사망 원인·모든 효과 공존의 직접 시각 대조는 별도 남은 범위로 유지한다.

## T12 후속 인수 수정

1. CustomSetupAdjustment의 정적 적용값에 BMR 선택 상태 CSS를 공유한다. 밤/낮 및 compact/desktop을 대조하고 실제 클릭 입력을 만들지 않는다.
2. CustomGrimoireBoard 상세의 별도 상태 칩을 모두 제거하고 진행 중 배치 복귀 버튼을 제거한다. 원형 토큰/생사/Undo/획득 능력은 유지한다. T11의 기존 중독/취함 검사 기대는 최신 사용자 지시에 맞춰 칩 부재와 상태 사실 보존으로 바꾼다.
3. 쌍둥이: custom canonicalUndo는 사건별 단위이며 official 묶음 구현과 다르다. assignTwin/learnTwin과 원인 연결은 기존 Core가 소유한다. 연속된 같은 관계의 지정·통지를 UI와 Undo로 묶되 unrelated 중간 사건은 포함하지 않는 안에 대한 답변을 기다린다. 승인 전 구현하지 않는다.

1/2의 회귀는 사망·중독·취함·획득·토큰 보존과 배치 복귀 버튼 부재를 먼저 검사해 7실패를 확인했다. 수정 후 관련 UI 20개 통과. 최종 build/production 대조는 후속 검증 기록으로 갱신한다.

T12의 세 UI 수정과 검증은 [후속 결과](../testing/issue-220-t12-results.md)에 기록했다. 쌍둥이 즉시 공개/묶음 Undo는 답변 대기이며 아직 변경하지 않았다.

## T13 전체 계획 — 승인 완료

2026-09-12. [T13 전체 계획](issue-220-t13-action-contracts-plan-draft.md)을 action의 의존 특성을 기준으로 재작성했다. [spec 개정안](../specs/issue-220-t13-action-contracts-draft.md)과 [29개 action 계약표](issue-220-action-contract-matrix.md)를 포함하며 Core 선언/실행/Undo, 모든 action별 UI, 빈 새 시나리오·저장 보존, BMR Undo UI까지 추적한다.

이전 T13 초안의 특정 조합 예외·미결정 묶음 정책·구현 중 조사/확인 계획은 대체한다. 제품과 테스트는 변경하지 않았으며 사용자 승인으로 기준 채택하고 각 단위의 test 준비를 진행한다.

## T13 구현 전 test 기록 — 2026-09-12

사용자 승인 후 [테스트 준비 기록](../testing/issue-220-t13-test-preparation.md)에 P1–P6/R01–R29를 연결했다. 테스트 준비 완료이며 제품 구현은 미완료다. Core 실행 DTO·묶음 Undo·저장 실패 후 진행·쌍둥이/점쟁이 동선·새 시나리오·BMR Undo UI의 예상 실패를 확인했다. 기존 동작 중 새 spec과 충돌하는 Undo 기대값을 정정했다. 후속 implement는 이 기록의 Red 및 가려진 후속 assertions와 원본 대조를 모두 완료해야 한다.


### T13 구현 후 기록 — 2026-09-12

승인된 action 의존 계약/29개 adapter·새 시나리오·BMR Undo를 구현했다. [구현 기록](../implementation/issue-220-t13-implementation.md), [검증 및 인수 항목](../testing/issue-220-t13-results.md). 최신 실행/Undo는 캐릭터 조합 예외가 아닌 action 선언과 실제 source를 따른다. 사용자 인수 승인은 별도다.


### 인수 피드백 보완: 이벤트 로그·보르톡스 표시 — 2026-09-12

사용자의 2026-09-12 수정 요청을 반영한다. 이벤트 로그의 항목별 다시 보기 UI를 제거한다. Core의 시작 정보 준비/전달 DTO에 기존 정보 영향 판정을 연결하고, UI 검증 계약과 공통 정보 공개 뷰의 influence/status 연결을 수정한다. 첨부 `test0912-game.json`을 회귀 fixture로 보존하고 세탁부·사서·수사관 및 320/390/820/1366px 실제 화면으로 검증한다. 결과는 [보완 검증 기록](../testing/issue-220-vortox-feedback.md)에 기록한다.


### 추가 인수 피드백: 목록 순서·중독 입력 — 2026-09-12

첨부 `test0912-game-2.json`의 배치 완료 후 하수인 정보와 진행 목록 불일치를 회귀로 고정한다. 묶음 표시는 유지하되 Core overview 순서로 정렬한다. TB 숫자 입력 스타일 누락을 공통 스타일 연결로 보완하고, 실제 입력·중독 공개 및 모바일/데스크톱 목록 순서를 확인한다. 결과는 [검증 기록](../testing/issue-220-order-poison-feedback.md)에 기록한다.


### 배치 복귀 표시 범위 정정 — 2026-09-12

사용자 정정: 진행 중 일반 마도서 탭에는 기존 `배치로 돌아가기`를 표시한다. 마도서 선택 행동(선택 및 결과/통지 연결)이 진행 중일 때만 숨긴다. 기존 BMR 초기화 확인창과 `restartFromSetup()` 경로를 재사용하고, 취소·기존 저장 보존 계약은 유지한다. 전체 진행 중 제거라는 이전 기록을 대체한다.

검증 완료: TypeScript 포함 통합 788개, 실제 브라우저 390/1366px 2개 통과. 일반 마도서 버튼 표시, 초기화 확인 취소, 선택 중 숨김, 선택 취소 후 재표시, 확인 후 기존 좌석을 채운 배치로 실제 복귀를 확인했다. production build/PWA/architecture/diff check 통과.


### 취한 시계공 입력 보완 — 2026-09-12

첨부 `test0912-game-3.json`의 철학자 영향으로 취한 시계공에 원본 숫자 입력 UI를 연결한다. Core가 유한 후보로 제공하더라도 숫자 버튼을 나열하지 않고 입력값을 해당 Core 후보와 대조한다. 이 정보 전달에는 불필요한 은둔자 취급 UI를 표시하지 않는다. 일반 취급 UI의 잔존 `실제 정체` 문구도 실제 진영/종류 값과 `이번 판정의 XXX 취급` 제목으로 교체한다. Core 규칙·허용 범위·저장 형식은 변경하지 않는다.

구조 보완: 숫자 입력은 직업별 예외 대신 Core의 후보 목록/범위 계약을 공통 `numericInputDraft`로 검증하고 draft에 반영한다. 요리사·공감 능력자 전용 후보 검증 중복을 제거한다. 화면 배치만 원본 TB/SnV를 선택한다. 첨부 철학자 영향 시계공과 중독 요리사·공감 능력자·시계공·수학자의 실제 Core 진행을 회귀로 확인한다. 기존 선택값의 입력 표시도 보존한다.


### Undo 확인창 정정 — 2026-09-12

사용자 정정에 따라 OS 기본 confirm을 제거하고 기존 앱 내 `LiveUndoDialog`를 재사용한다. Core의 최신 Undo 단위에 포함되는 사건을 사람용 요약으로 표시하며 취소/되돌리기를 제공한다. 원본 레이아웃에 BMR 색상을 적용한다. 확인창을 연 뒤 게임 상태가 바뀌면 이전 요청을 실행하지 않는다. 기존 native confirm을 요구하던 T13 문구와 테스트를 대체하며 action 의존/Undo 경계는 변경하지 않는다.

Undo 확인창 검증 완료: 통합 793개 통과. 브라우저 18개 고유 사례 통과(이전 native 대기 4개를 새 계약으로 정정 후 재실행). 취소/Escape, OS dialog 미호출, 묶음 Undo, 공개 동선, 실제 저장 복원 검사 포함. 모바일 화면 직접 확인. build/PWA/architecture/diff check 통과, 리뷰 서버 최신 빌드 일치 확인.


### Finalize 회귀 테스트 정합성 보완 — 2026-09-12

전체 CI에서 초기 `custom-grimoire.spec.ts`에 남은 구 UI 기대를 확인했다. V01–V06 및 T13 승인 기준으로 악마 선택/저장/reveal 명칭, 단일 준비·전달 흐름, 점쟁이의 연속 선택, 즉시 획득 능력의 실행·Undo 경계, 기존 자유 행동 dock·첩자 마도서·앱 내 Undo를 갱신한다. 사건 보존/파일 왕복/키보드 포커스/화면별 레이아웃과 Day 도달 검증을 유지하며 테스트를 제외하지 않는다. 제품 동작·Core·UI 변경은 없다. 철학자의 즉시 능력 선택→준비→전달 완료 후 한 번의 Undo가 앞선 독립 사건 목록을 그대로 보존하는지 저장소에서도 확인한다. 최종 결과는 최종 검증 문서와 PR CI에 기록한다.
