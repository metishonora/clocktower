# #220 수정 구현 계획 v2 — 기존 마도서 동작 연결

**후속 기준:** [수정 계획 v3](issue-220-custom-grimoire-plan-v3.md), [전면 UI 조사](issue-220-ui-parity-audit.md), spec 7.4. 아래 Q2의 입력 위치/Q4의 별도 준비 행은 최신 사용자 지시로 대체되며 구현 근거로 재사용하지 않는다. 저장·규칙·순서 계약 및 과거 기록은 유지한다.

게시된 이전 기준: [갱신 Spec](https://github.com/metishonora/clocktower/issues/220#issuecomment-5628640924), [갱신 Plan·63개 조건](https://github.com/metishonora/clocktower/issues/220#issuecomment-5628643606). 이전 [v2 승인 기록](https://github.com/metishonora/clocktower/issues/220#issuecomment-5627693800)은 변경 이력으로 보존한다.

2026-09-11 · 수정 구현 기준 확정 · 사용자 보완 결정 R1/R2 승인 완료 · P0 기록 완료. 2026-09-11 P1–P5 구현 반영 후 잔여 작업 확인(9절 Q0–Q6), P6 검사 실행: 미통과(숫자 입력·Dreamer 후보 잠금·320px 헤더·fixture 응답 회귀). [최신 검증 결과](../testing/issue-220-v2-test-results.md). [구현 인계](../implementation/issue-220-custom-grimoire-v2.md).

전체 수정 계획을 검토용 문서로 제시한 뒤 사용자가 R2를 “하는 게 맞지. 계획에 반영해”, 남은 R1을 “그것도 승인할게”로 승인했다. 두 보완 결정을 반영한 #220의 수정 구현 기준이다. 기존 계획의 편집·Core·저장 기반은 계승하고, UI 연결·상태·검증 계획은 이 v2를 우선한다. 이슈 분리, 병합, 이슈 종료는 포함하지 않는다. 이번 기록 단계에서는 Production 코드와 테스트를 변경하거나 실행하지 않았다.

## 1. 기준과 기존 진행 상태

- 작업: `.worktrees/issue-220`, `codex/issue-220`, HEAD `e7d7c0f` 위의 기존 미커밋 구현을 이어 간다.
- 승인 spec: `docs/specs/issue-220-custom-grimoire.md`, C01–C38, S1-a–g, 9월 11일 UI 보정/BMR 전체 테마/TB 진행 순서 간소화.
- 기존 계획: `docs/plans/issue-220-custom-grimoire-plan-draft.md`. 이름은 draft지만 2026-09-10 승인됐다. GitHub 기준: https://github.com/metishonora/clocktower/issues/220#issuecomment-5620712125
- 실제 동작의 근거: SnV Production, BMR Production, TB Production. #165의 확정 후 직업 상세, #149/#150에 반영된 마도서 대상 선택과 진행/저장 분리. 이야기형 #218과 원본 #205는 변경하지 않는다.
- 규칙 기대값: `docs/acceptance/issue-209-mixed-first-night.md`의 R0–R11 및 참조 승인 spec. 구현의 출력으로 정답을 새로 만들지 않는다.

| 기존 단위 | 현재 확인한 구현 | v2 처리 |
| --- | --- | --- |
| A 저장/채택 | application/session/writer, 원자적 슬롯 대체, 저장 재시도, 이전 writer 차단 | 유지. 승인된 배치 복귀도 같은 채택 경로로 연결 |
| B 편집/JSON | #205 편집 이식, 단일 import, exact resume, 시나리오 다운로드 | 유지. 모바일 이름 가독성 보정도 유지 |
| C 설정 | Core 분포, 초과 선택 제한, BMR 배치/상세 공용화 | 부분 완료. 직업 확정 상태와 잠금, 상세 접근, 플레이 중 동일 설정 표현 누락 수정 |
| D 진행/공개 | 실제 custom 첫날 밤, proposal/확정/Undo/당시 정보 조회 | 기능 기반 유지. 대상 선택, 정보 편집, 상태 유지, 재공개, 기록 연결을 다시 구현 |
| E Production/복원 | 실제 진입, 새로고침, JSON 왕복, 유틸리티, BMR 테마 | 유지하면서 새 게임 확인, 기록 위치, 세부 표현과 전환 보정 |
| F test/인수 | 기존 자동화 실행 근거와 부분 검증 표 존재 | 완료 아님. 수정 후 검증 범위와 UI 비교 근거를 새로 기록 |

기존 테스트 결과는 당시 구현과 명시된 경계의 근거다. 기존 UI와의 동작 일치나 사용자 인수 완료를 뜻하지 않는다. 기존 수동 인수 문서의 `진행 → 기록 → 진행` 안내는 잘못된 구현을 기준으로 작성됐으므로 저장 유틸리티 경로로 정정했다. 정정된 기대 결과는 수정 구현 후 검증해야 한다.

## 2. 조사로 확인한 누락

| 항목 | 현재 구현 | 기존 근거와 수정 방향 |
| --- | --- | --- |
| 새 게임 | `CustomUtilities`가 즉시 `startSetup` 호출 | 상단 새 게임은 기존 확인창. 편집 최종 검토의 새 마도서 쓰기와 자동 저장 대체에는 확인창을 추가하지 않음 |
| 직업 확정 | 확정 버튼이 `navigate('seating')`만 호출. controller에 확정 상태가 없음 | 확정 상태와 편집 권한을 명시. roster가 꽉 찼다는 이유만으로 마도서 탭 진입을 허용하지 않음 |
| 비활성 직업 설명 | `RoleCatalog`의 native disabled가 상세 조회도 차단 | #165처럼 선택/검토를 분리. 하단 상세 바 → 상세 창 동선 유지 |
| 플레이 중 직업 탭 | 설정과 별도 catalog/간이 설명 | 같은 직업 화면을 읽기 전용으로 사용. 인원·구성·악마·확정 상태·상세 표현 일치 |
| 대상 선택 | `CustomStepInputs`의 독립 플레이어 버튼 목록 | 기존 마도서 좌석 선택과 선택 패널 연결. 진행에 플레이어 목록을 재생성하지 않음 |
| 입력 보존 | 입력과 bluff가 React task 내부 state | controller가 현재 행동의 입력 소유. 탭/저장/설명 열기 때문에 초기화되지 않음 |
| 정보 편집 | 종류별 기존 입력 대신 범용 select/checkbox | 기존 숫자, 진실/전달, 등록 판단, 두 캐릭터, 정보 준비, 능력 선택 표현을 공용화 |
| 공개 문맥 | 현재 proposal, 과거 기록, 정체 통지가 동일 reveal 필드를 공유하며 조회가 proposal을 지움 | 확정 대기와 읽기 전용 공개를 분리해 현재 입력/제안 보호 |
| 기록 | 진행 헤더의 기록 버튼, 독립 history 화면, 과거순 목록 | SnV/TB처럼 저장/불러오기 유틸리티에 최신순 기록. 당시 정보 다시 보기 유지 |
| 자리 상세 | `tokens=[]`, 별도 생존/사망 칩 | 생존 칩 제거. 기존 토큰/상세 표현에 실제 custom 사실 연결 |
| 첩자 공개 | 별도 카드 그리드 | 실제 마도서 좌석 표현의 읽기 전용 공개. 현재 게임이 아닌 전달 payload 사용 |
| 행동 라벨 | 일부 이름표가 실제 action ID와 다름 | `assignMadness`, `resolveMadnessExecution` 등 실제 등록 ID로 정리. 같은 행동의 서로 다른 소유자/준비를 구별 |
| 세부 shell | 경과 시간 누락, 설정/플레이/상세가 분리된 표현 | 기존 시간/동작 위계와 BMR 밤·낮/비활성/오류/공개 스타일 대조 |
| Core 경고 | replay/proposal에 경고가 있으나 현재 custom 화면은 오류 중심으로 표시 | 기존 warning 표현에 현재 Core 경고를 연결. UI가 자체 규칙 경고를 계산하지 않음 |

특히 #149의 승인 범위에는 이미 “플레이어 정보에서 불필요한 현재 상태: 생존 표현을 사용하지 않는다”가 들어 있고, #150은 진행의 인라인 플레이어 그리드 금지와 로그의 유틸리티 분리를 명시한다. 이번 지적은 기존 합의의 미반영이다.

## 3. Spec revision request 처리 결과 — 모두 확정

### 이미 사용자 지시로 확정된 보완 — 재질문하지 않음

S2: 상단 `새 게임`은 클릭 실수에 의한 현재 작업 초기화를 확인한다. 취소하면 화면·입력·canonical·저장이 그대로다. 확인하면 같은 definition의 빈 설정으로 이동한다. C05/S1의 `새 마도서 쓰기`, 좌석 확정 시 자동 저장 대체, JSON 이어 쓰기에 교체 확인을 재도입하지 않는다. 수정하는 것은 사용자 조작 확인이며 S1의 저장 정책이 아니다.

직업 확정 후 일반 탭 이동/설명 조회로 배역이 변경되지 않는다. 비활성 직업의 설명을 볼 수 있다. 자리 상세의 의미 없는 생존 칩을 제거한다. 대상은 마도서에서 선택하고 기록은 저장 유틸리티에 둔다. 모두 기존 UI 재사용 요구의 구체적인 인수 조건으로 추가한다.

### R1 — 확정된 직업의 명시적 재편집 경로: 사용자 승인 완료

- 차이: SnV는 직업 탭 복귀 시 확정을 유지한다. BMR은 좌석 확정 전 뒤로 가기로 roster 확정을 풀고 배치를 지운다.
- 영향: spec 2/4/7절, C06/C07/C21, 설정 권한과 복귀 동선.
- 승인 기록: 남은 결정으로 제시한 SnV 방식의 확정 유지 권장안에 사용자가 “그것도 승인할게”라고 답했다.
- 확정: SnV처럼 확정을 유지하고 배역 구성 변경은 상단 새 게임에서 한다. 직업/마도서 탭 이동과 좌석 화면의 뒤로 가기는 배역 확정을 풀지 않는다. 상세는 선택·비선택·악마 여부와 관계없이 조회 가능하다.
- R2의 배치 복귀에서도 배역 구성 확정은 유지하며, 확정된 배역을 좌석에 다시 배치하고 이름·허용 Shown을 수정한다. `reopenRoster()`나 다른 배역 확정 해제 동작은 제공하지 않는다.

### R2 — 진행 중 배치로 돌아가기: 사용자 승인 완료

- 승인 기록: 사용자가 원래 설정 복원, 첫날 밤 재시작, 새 설정 저장 성공 전 기존 자동 저장 보존에 대한 상세 설명을 확인한 뒤 “하는 게 맞지. 계획에 반영해”라고 요청했다.
- 차이: 기존 마도서는 확인 후 배치로 복귀할 수 있으나 현재 custom은 같은 위치의 화살표를 진행 이동으로 바꿨다. custom spec에는 이 복귀 후 상태가 정의돼 있지 않다.
- 영향: spec 4/6/7절, C06/C16/C18/C25, S1-a–g, application/setup/session 연결.
- 확정: 마도서의 `배치로 돌아가기` → 진행 초기화 확인 → 원래 Setup의 인원·이름·배역·Shown·배치를 가진 좌석 설정으로 복귀한다. 배치를 수정하고 새 좌석 확정과 저장이 성공하면 같은 시나리오의 새 게임으로 첫날 밤부터 시작한다. 편집 진입과 실패는 이전 자동 저장을 보존한다.
- 규칙 중간에 생긴 능력 획득/교환/중독/사망은 새 Setup에 복사하지 않는다. 원래 `setupConfirmed`를 출발점으로 삼아 반복 실행과 JSON 재개가 같은 결과를 갖게 한다.
- 확인 취소는 현재 상태 그대로. 새 확정 전 reload는 기존 저장 게임 복원. 저장 실패 재시도는 이미 수락한 새 Setup 한 건을 재저장한다.
- 새 설정 저장 성공 때 S1에 따라 기존 슬롯을 원자적으로 대체한다. 복귀 확인 이후 별도의 자동 저장 교체 확인이나 JSON 내보내기 의무 단계를 추가하지 않는다.
- 이 결정은 확정된 배역을 다시 배치하는 경로다. 배역 구성 변경은 승인된 R1에 따라 새 게임에서 한다.

### 범위와 내부 확장

기존 custom Core가 가진 사실을 표식으로 표시하기 위한 읽기 전용 projection은 기존 domain 소유권 안에서 확장한다. 게임/시나리오 JSON 버전, Command/Event, 캐릭터 규칙, Undo 단위는 바꾸지 않는다. scheduler는 시나리오의 명시적 순서를 지키도록 초기 준비의 연결을 수정한다(9.2절 정정). 수동 메모/토큰을 새로 저장하는 command, 일반 무작위 규칙 추천 API, 낮/다음 밤, BMR 능력 지원은 이 계획에 추가하지 않는다. 기존 Core 후보에서 고르는 bluff 무작위 선택은 유지한다.

## 4. 공통 책임과 확정할 인터페이스

### 데이터로 연결하는 진행 구조 — spec 7.1–7.3 구현 계약

공식 화면은 이미 currentStep/phaseOverview를 Core에서 받지만, 공식 단계 ID 분기·후속 공개 상태·입력 계약을 함께 사용한다. 기존 페이지나 controller를 통째로 custom에 연결하는 것을 재사용 완료로 보지 않는다. 구조의 기준은 `custom Core → custom session/controller → UI adapter → shared presentation`이다. 현재 단계는 Core가 정하고, 공개 중 보여 줄 카드와 draft는 controller가 같은 occurrence에 결속한다.

- `custom/grimoire/actionPresentation.ts`는 실제 actionRef/입력 의미를 표현 종류로 연결하는 한 곳이다. registry의 29개 행동과 연결표를 대조한다. 고정 순서 배열, 단계 번호 증가, step ID 접두사/접미사 추측으로 실행을 제어하지 않는다.
- 신규 `grimoire-custom/taskPresentationModel.ts`는 custom 타입을 읽고 `{ identity, actor, ability, stage, editor, result, warnings, actions }` 형태의 화면 모델을 만든다. `stage`는 준비/행동/전달/전환/종료 구분이고, `editor`는 대상/준비 정보/숫자/두 캐릭터/진영/능력/선택적 집행/악의 정보 등 필요한 표현의 구별 가능한 타입이다. 이 union은 입력 표현을 고르는 것이며 두 번째 실행 엔진이 아니다.
- 후보·최소/최대·정답/고정 여부·등록 근거는 Core 데이터에서 공급한다. 부족하면 해당 custom projection/validator를 함께 확장한다. 모델은 후보를 화면 필드로 묶고 이미 결정된 값만 연결하며, 합법성이나 캐릭터 효과를 계산하지 않는다.
- `firstNightController`가 동일 identity의 draft/선택 왕복/proposal/current·history·notification 공개를 소유한다. adapter가 제공하는 callback은 controller의 기존 작업으로 연결한다. ‘다음’은 해당 제안/후속 처리의 완료를 요청하며 다음 카드 번호를 직접 증가시키지 않는다.
- `CustomNightTask`/`CustomStepInputs`/`CustomGrimoireBoard`는 위 모델을 소비한다. 여러 컴포넌트에 같은 action/input 분기와 후보 계산을 복제하지 않는다. `CustomPhaseOrder`는 Core 개요의 순서/identity를 보존하고 짧은 라벨·상태만 표현한다.
- `shared-ui`에는 runtime DTO 없는 값/slot/callback 계약을 둔다. 기존 TB/SnV/BMR DOM·스타일·포커스·버튼 의미를 함께 추출하고 공식 호출자도 이 표현을 소비한다. 공식 페이지의 규칙/세션/저장은 각 공식 adapter에 남긴다.
- 미지원/불완전한 입력 모델은 명시적 오류로 연결하고 확정을 막는다. 기존 범용 select/checkbox를 fallback으로 만들어 완료를 가장하지 않는다. 정보 조회 실패는 현재 canonical/저장을 변경하지 않는다.



### 상태 소유

| 소유자 | 책임/인터페이스 |
| --- | --- |
| `applicationController` | 활성 editor/setup/play 및 writer 한 개. `startSetup(validated)` 유지. 승인된 R2에 따라 `restartFromSetup()` 추가: 원래 Setup으로 draft만 생성, 유효 좌석 확정 시 기존 채택 경로 사용 |
| `setupController` | 메모리의 `rosterConfirmed`, `confirmRoster()`, roster/seat 편집 권한 분리. `navigate()`는 확정·해제하지 않음. 배역 구성 변경은 새 게임에서만 가능 |
| `firstNightController` | 현재 입력·마도서 선택 handoff·proposal·확정·현재/과거/통지 공개. `inputDraft`, `beginSelection`, `togglePlayer`, `acceptSelection`, `cancelSelection`, `updateInput`, `prepareCurrent`, `selectStep`, `showHistory`, `undo` |
| `stepInputModel` | Core의 requiredInput/informationPrompt를 입력 상태/표현 모델로 변환하고 기존 `PhaseStepConfirmation` 생성. 허용 후보/수/정수 범위 등 제공된 제약을 읽음. 게임 규칙을 재계산하지 않음 |
| 신규 `actionPresentation` | 실제 actionRef와 입력 형태의 표시 이름/표현 종류. owner, ability instance, cause와 occurrence는 보존. 캐릭터 규칙·실행 순서를 소유하지 않음 |
| custom Core projection | 현재 사실에서 유효 표식/준비 출처를 읽기 전용으로 제공. 당시 공개는 기존 event prefix 조회 유지 |
| `grimoire-custom` | custom 데이터→공용 view props 연결, 탐색/포커스/반응형/테마. 공식 runtime이나 DTO로 custom 상태를 변환하지 않음 |
| `shared-ui` | 값·문자열·이미지·React slot·콜백만 받는 controlled 표현. 두 runtime의 명령/판정/저장/카탈로그를 import하지 않음 |

### 현재 입력의 수명

- 입력은 게임 ID, canonical prefix 식별, step ID, ability instance/cause에 결속한다. event 수만 같다는 이유로 이전 선택을 재사용하지 않는다.
- 진행↔직업/마도서/저장 이동, 상세 열기, 과거 정보 다시 보기에는 입력과 현재 proposal을 유지한다.
- 다른 available action을 명시적으로 선택하거나 확정/Undo/게임 전환으로 prefix가 바뀌면 이전 입력·handoff·제안을 폐기하고 최신 Core 값으로 구성한다.
- 좌석 선택을 수락해도 정보 준비·정보 전달이면 아직 canonical을 바꾸지 않는다. 진행 카드로 돌아가 추가 정보/등록 판단 후 공개·확정한다.
- 직접 대상 행동은 기존 마도서 패널에서 확정한다. 공개/후속 결과가 생기면 같은 proposal에 결속해 보여주고 기존 가리기→다음 절차로 이어 간다. 탭 이동 자체는 확정하지 않는다.
- 선택 초기화는 해당 입력을 비우고 handoff를 유지한다. 선택 취소는 그 선택 작업을 폐기하고 진행으로 복귀한다. 단순 조회용 마도서 이동과 선택 취소를 같은 동작으로 취급하지 않는다.
- `pendingProposal`과 `activeReveal { origin: current|history|notification, identity, payload }`를 분리한다. history 공개 종료 후 대기 중인 현재 제안으로 돌아갈 수 있고, 과거 payload를 현재 명령에 적용할 수 없다.
- 공개 중에는 전체 이야기꾼 shell과 조작을 숨기고 포커스를 격리한다. 복원은 비공개 상태에서 시작한다.

### 공용 표현 계약

- `RoleCatalog`: `selected`, 선택 가능 여부, 설명 조회 콜백을 구분. 선택 불가가 상세 접근 불가를 뜻하지 않게 한다. 기존 호출자는 기존 동작을 유지할 수 있는 명시적 opt-in 계약을 사용한다.
- `GrimoireSelectionPanel`: 제목, 행동자/대상 요약, 순서가 있는 선택 목록, 추가 입력 slot, 준비 여부, busy, 취소/초기화/확정 콜백. 공식 `PhaseStep` 없이 렌더링한다.
- `InformationTaskPresentation`/정보 입력 부품: identity, 진실/전달 표시, 선택 요약, 숫자/진영/캐릭터 편집 slot, 영향/경고, 공개/다음 콜백. 후보의 계산과 기본값 결정은 각 runtime adapter가 한다.
- `EventHistoryList`: event ID/번호/summary/읽기 전용 상세 action. 최신순 렌더링과 스크롤을 공용화하고 당시 정보 조회는 custom controller로 전달한다.
- `GameConfirmationDialog`: BMR 시각 표현, 취소 초기 포커스, Escape/취소/배경 닫기, 원래 버튼으로 포커스 복귀. 행동별 문구와 callback을 전달한다.
- 마도서 좌석은 기존 `GrimoirePresentation`/`RectangularGrimoireBoard` 계약을 사용한다. 편집용 `AssignmentSurface`에 라이브 규칙을 추가하지 않는다. 진행용 선택 panel과 좌석 내용 표현을 기존 TB/SnV에서 추출하고 공식 화면도 같은 부품을 사용한다.

## 5. 실제 등록 행동 29개의 연결표

지원 캐릭터 47개와 실행 action 수를 혼동하지 않는다. 현재 production registry는 TB 14 + SnV 11 + system 4다. simulation/획득/재준비는 같은 action의 다른 occurrence이며 별도 가짜 규칙을 만들지 않는다.

| 등록 action | 입력/조작·표현 | 확정 경계 |
| --- | --- | --- |
| dusk, minionInfo, demonInfo, dawn (4) | 시작/종료 카드와 `BmrInformationTask`, bluff 허용 3개 | 시스템 Core 단계 유지. dawn만 Day 전환 |
| assignRedHerring, prepareInformation×세탁부/사서/조사관 (4) | 마도서에서 1/2명 선택. 준비는 역할·정답 플레이어·등록 판단·외부인 없음 입력 | 선택 수락은 입력만; 준비 확정과 나중 정보 전달 분리 |
| drunk.assignShownCharacter (1) | 기존 캐릭터 선택 표현, custom 허용 Shown 후보 | Core 확정 후 필요한 안내 표시 |
| poisoner.choosePoisonTarget, butler.chooseMaster, snakeCharmer.choosePlayer, witch.chooseCursedPlayer, evilTwin.assignTwin (5) | 마도서 좌석 선택, 현재 행동자·대상·초기화/취소/선택 확정 | Core 결과/후속 통지. 직접 행동에 추가 범용 확인 화면을 만들지 않음 |
| learnTownsfolk, learnOutsider, learnMinion (3) | 확정 준비의 대상·직업 정보, Core 허용 전달 조정 | 조정 대상도 마도서 선택. 당시 준비 snapshot과 전달 사건 분리 |
| chef.learnEvilPairs, empath.learnEvilNeighbors, clockmaker.learnSteps, mathematician.learnCount (4) | 기존 숫자 정보/진실·전달·등록 판단·제약 입력. 수학자 감사 내역 | Core 후보/numberConstraint로 공개. 허용 단일 값은 불필요한 선택 없이 표시 |
| fortuneTeller.checkDemon, dreamer.learnCharacters, seamstress.compareAlignments (3) | 마도서 대상 선택 후 기존 boolean/캐릭터 쌍/진영 편집 | 현재 targetCheck의 결과만 공개·확정. 재봉사 보류는 Core 입력 사용 |
| philosopher.chooseAbility (1) | 기존 철학자 능력 선택과 사용하지 않기 | 획득/모의 능력과 새 필수 준비는 replay를 따름 |
| cerenovus.assignMadness (1) | 마도서 대상 + 기존 집착 캐릭터 선택 패널 | 허용 후보를 Core에 전달, 광기 통지 연결 |
| evilTwin.learnTwin (1) | 기존 쌍둥이 공개/가리기/다음 | 재지정 후 새 통지와 이전 기록 구별 |
| mutant.resolveMadnessExecution (1) | 선택적 행동의 집행/미집행 판단, 기존 결과/종료 표현 | Core 결과만 표시. 종료 시 일반 진행 차단, 허용 Undo 유지 |
| spy.inspectGrimoire (1) | 전달 payload를 기존 좌석 마도서로 공개 | 전체 세션/현재 facts 접근 없이 당시 payload만 사용 |

이 표의 예시는 행동을 합치는 key가 아니다. 모든 화면의 key/요청/후속 조회는 실제 occurrence identity를 사용한다. registry가 생성하지 않는 낮·이후 밤 입력은 기존 타입 union에 이름이 있더라도 지원하지 않는다.

## 6. 개발 단위와 순서

### P0. 결정과 기준 대조표 확정

파일: `docs/specs/issue-220-custom-grimoire.md`, `docs/plans/issue-220-custom-grimoire-plan-draft.md`, `docs/testing/issue-220-manual-acceptance.md`, 관련 구현/검증 기록, GitHub #220.

- 승인된 R1/R2와 사용자 최신 지시를 spec 수용 사례에 연결하고 이 v2 기준을 기록한다. 과거 승인/실행 근거를 지우지 않고 v2가 대체하는 부분을 명시한다. **P0 기록 완료.**
- 기존 C01–C38/S1-a–g와 이 문서 U01–U12가 어느 단위/화면/검증 경계에서 완료되는지 기록한다.
- 의존: 구현 전 필수. 위험: 미승인 분기를 구현 결정으로 숨기거나 과거 통과를 현재 통과로 승격하는 것.
- 완료: 미결정 0개, 코드 작업자가 제품 동작을 새로 선택할 필요가 없음.

### P1. 공용 표현 추출과 기존 호출 경로 유지

파일: `shared-ui/SetupPresentation.tsx`, `SetupControls.tsx`, `GrimoirePresentation.tsx`, `GrimoireToolbar.tsx`, `NightTaskCard.tsx`; 신규 `shared-ui/GrimoireSelectionPanel.tsx`, `InformationTaskPresentation.tsx`, `InformationInputPresentation.tsx`, `EventHistoryList.tsx`, `GameConfirmationDialog.tsx`.

추출 원본: `features/trouble-brewing/TroubleBrewingLiveGrimoire.tsx`, `TroubleBrewingProgress.tsx`, `TroubleBrewingScalarInformationEditor.tsx`, `TroubleBrewingSetupInformationEditor.tsx`; `features/phase-control/SectsAndVioletsInformationTask.tsx`; `sectsAndVioletsGame.tsx`의 철학자/기록; `badMoonRisingGame.tsx`의 확인창. 필요 스타일은 기존 화면별 파일에서 함께 분리한다.

- 네 번째 비슷한 UI를 새로 만들지 않고 실제 DOM/스타일을 값/slot/콜백 기반 표현으로 추출한다. 공식 호출자도 추출된 경로를 사용한다.
- 선택/판정/캐릭터 카탈로그/Command는 각 adapter에 남긴다. 공식/커스텀 경계 allowlist를 늘리지 않는다.
- 의존: P0. P2–P5가 같은 계약을 사용하므로 먼저 완료한다.
- 위험: 공유 추출로 공식 UI나 포커스가 바뀌는 것. 기본 appearance/props의 기존 동작을 보존한다.
- 검증/완료: test 단계에서 변경된 공용 부품의 공식 SnV/TB/BMR 대표 화면과 동작을 비교한다. 실제 소비자가 없는 이름뿐인 공용화는 완료가 아니다.

### P2. 직업 확정·상세·새 게임·배치 복귀

파일: `custom/grimoire/setupController.ts`, `applicationController.ts`, `grimoire-custom/CustomGrimoireSetup.tsx`, `CustomGrimoireApplication.tsx`, `CustomUtilities.tsx`; 신규 `grimoire-custom/CustomRoleSetup.tsx`.

- `confirmRoster()`로 확정 상태를 만들고 인원/악마/선택 배역 변경 명령을 controller에서 차단한다. 좌석 이름/배치 편집 권한과 분리한다.
- 설정과 live 직업 탭이 동일 `CustomRoleSetup`을 사용한다. live 구성은 원래 Setup의 확정 배역을 보여주고, 게임 중 바뀐 실제/표시 정체는 마도서에 표시한다.
- 선택 불가/확정/악마를 눌러 하단 상세 바에 표시하고, 상세 바를 눌러 상세 창을 연다. 설명 클릭으로 배역을 바꾸지 않는다. 확정 버튼의 비활성 상태도 기존 형태를 사용한다.
- 상단 새 게임 확인을 연결한다. 취소는 입력까지 보존하고 확인은 빈 설정으로 이동한다. 편집기의 새 마도서 쓰기와 저장 대체는 직접 진행한다.
- 승인된 R2의 복귀 기능을 연결한다. 초기화 확인 후 현재 canonical의 원래 `setupConfirmed`에서 definition·인원·이름·Actual/Shown·좌석을 읽어 Setup seed를 만들고 좌석 설정으로 연다. 배역은 확정된 상태, 좌석은 편집 가능한 상태로 시작한다. 진행 중 replay의 교환·획득·효과를 seed로 사용하지 않는다. R1에 따라 배역 구성의 확정은 유지하고 새 게임만 배역 구성 편집을 다시 연다.
- `restartFromSetup()`은 공개/명령 처리 중에는 실행하지 않고, 취소 시 현재 입력·제안·화면·게임을 유지한다. 복귀 진입은 메모리 draft만 바꾸며 새 유효 좌석 확정에서 기존 session/writer 활성화 경로를 사용한다. 최초 저장 성공 전 이전 슬롯을 지우지 않고, 재시도는 수락된 새 Setup 사건을 재실행하지 않는다.
- 의존: P1. 이후 P3/P4가 확정된 설정/활성 게임 계약을 사용한다.
- 위험: 화면만 disabled하고 controller는 변경을 허용하는 것, 첫 저장 실패 뒤 재확정, 기존 슬롯 조기 교체.
- 검증/완료: C05–C08/C23–C25/S1-a–g와 U01–U04/U12. Core 분포·초과 제한·비동기 최신성·배치 방식은 유지한다.

### P3. 현재 입력과 마도서 선택의 단일 상태 흐름

파일: `custom/grimoire/firstNightController.ts`, `stepInputModel.ts`; 신규 `custom/grimoire/actionPresentation.ts`; `grimoire-custom/CustomGrimoirePlay.tsx`, `CustomGrimoireBoard.tsx`, `CustomNightTask.tsx`, `CustomStepInputs.tsx`.

- 입력을 controller에 옮기고 4절의 identity/수명/취소/확정 계약을 구현한다. 임시 입력을 canonical/JSON에 저장하지 않는다.
- 현재 board를 편집용 AssignmentSurface 읽기 모드에서 실제 live 표현으로 연결한다. 기존 사각 좌석, 행동자/선택 대상 표시, 하단/측면 선택 패널, 키보드/모바일 동작을 재사용한다.
- `playerIds`, 준비의 대상 쌍, 정보 조정의 대상, 광기 대상은 모두 같은 마도서 선택 경로를 사용한다. 최소/최대/허용/의존 후보는 Core 입력을 읽고 거부된 명령은 상태를 바꾸지 않는다.
- 정보가 필요한 선택은 진행 카드로 돌아가 입력을 마치고, 직접 대상 행동은 마도서에서 처리한다. 취소/초기화/단순 조회를 구별한다.
- 일반 탭/저장/상세 이동은 현재 입력을 보존한다. 상태가 바뀐 뒤 기존 선택이나 proposal을 확정할 수 없게 한다.
- 의존: P1/P2. P4의 모든 입력과 공개가 이 상태를 사용한다.
- 위험: React remount로 입력 소실, 행동자별 같은 action 합치기, 선택만으로 확정, 표면마다 서로 다른 draft.
- 검증/완료: 29개 연결표의 모든 대상 입력, C15/C16/C29–C32 및 U05/U06. 진행에 별도 플레이어 버튼 그리드가 없어야 한다.

### P4. 정보 입력·공개·후속 통지·실제 표식

파일: `CustomNightTask.tsx`, `CustomStepInputs.tsx`, `CustomReveal.tsx`, `CustomGrimoireBoard.tsx`, `CustomPhaseOrder.tsx`, `custom/grimoire/firstNightController.ts`, `stepInputModel.ts`, `historyModel.ts`; 신규 `grimoire-custom/customPlayerPresentation.ts`; 필요한 공용 정보/공개 부품.

읽기 전용 확장 파일: `crates/custom-domain/src/projection.rs`, `contracts.rs`, `characters/trouble_brewing.rs`, 필요하면 같은 character 디렉터리의 reminder 표현 helper; `web/src/custom/core/types.ts`, `validation.ts`. 기존 `spy_reminders`가 만든 사실 기반 표시를 공통 projection으로 재사용한다. 출처별 캐릭터 규칙을 generic UI로 옮기지 않는다.

- 연결표대로 기존 정보 표현에 Core 결과를 전달한다. 숫자 0/false, 정수 제약/제외 값, 등록 판단, 꿈꾸는 자의 두 캐릭터, 정보 준비의 정답/외부인 없음, 수학자 감사 내역을 임의 범용 입력으로 축소하지 않는다.
- 획득/Shown 안내는 실제 소유자와 행동 능력을 구분한다. 준비/전달/재준비/정체 통지 각각을 유지한다. `availableActions`만 선택 행동으로 제공한다.
- replay/proposal의 Core 경고와 허용 입력의 오류·복구를 기존 상태 표현으로 연결한다. 같은 경고를 카드/상단에 반복하지 않고, pending proposal의 경고를 다른 사건의 상태로 표시하지 않는다.
- `pendingProposal`과 읽기 전용 공개 문맥을 분리한다. 현재/과거/후속 공개를 섞지 않고, 가리기/다음은 현재 proposal의 상태에만 작용한다.
- 첩자는 공개 payload의 좌석과 표식을 기존 마도서 표현으로 보여준다. 숫자/직업/쌍둥이/정체 공개도 BMR shell 안에서 기존 정보 위계를 유지한다.
- 상세의 생존 칩을 제거한다. Core가 이미 계산한 중독/취함/붉은 청어/정보 준비/주인/저주/광기/쌍둥이/사용 상태를 기존 토큰 표현으로 연결한다. 웹에서 새로운 유효성·효과 판정을 만들지 않는다.
- 순서 라벨을 실제 action ID에 맞추고 TB 간결한 목록을 유지한다. 동일한 짧은 이름이 동시에 선택 가능할 때만 최소 좌석/준비 표기로 구별하며 전체 출처는 접근성 이름과 현재 카드에 둔다.
- 의존: P3. 데이터 확장은 저장 규격/이벤트가 아닌 replay 표시 계약만 변경한다.
- 위험: computed 값을 강제해 재량을 지우거나 거짓 정보 제약을 무시하는 것, 과거 snapshot 재계산, 공개에 hidden state/출처 노출, 단순 생존을 의미 있는 표식처럼 표시하는 것.
- 검증/완료: C15/C16/C27–C32/C37/C38, R0–R11의 독립 기대값, U07–U09. 도메인과 공개 결과의 의미가 그대로여야 한다.

### P5. 기록·Undo·유틸리티·전체 테마 통합

파일: `CustomUtilities.tsx`, `CustomEventLog.tsx`, `CustomGrimoirePlay.tsx`, `CustomGrimoireSetup.tsx`, `CustomGrimoireApplication.tsx`, `customBmrTheme.css`, `customGrimoirePlay.css`, `customGrimoireSetup.css`; 공용 확인창/기록/시간 표현과 해당 공식 호출자.

- 진행의 기록 버튼과 독립 history 탭을 제거하고 저장/불러오기 아래에 최신순 기록을 연결한다. canonical event ID로 당시 정보 조회. 공개가 없는 기록을 실패한 게임 조작처럼 처리하지 않는다.
- 기존 상단 Undo 위치와 되돌릴 사건을 확인하는 SnV dialog 표현을 연결한다. 실제 Undo 단위는 기존 custom 계약만 사용한다. 확인 대기 중 prefix가 바뀌면 재평가하며 취소는 무변경이다.
- 세 utility의 위치/동작, 파일 다운로드·import 검토, 제보 취소/익명 미리보기, 저장 실패와 재시도를 같은 shell에서 확인한다.
- 기존 경과 시간의 순수 hook/format을 공용 표현으로 분리해 진행·마도서가 하나의 값을 사용한다. phase/session 전환만 초기화하며 탭 이동은 초기화하지 않는다. 기존처럼 reload 이후 시간은 새로 측정하고 파일/DB 필드를 추가하지 않는다.
- 작성기 이후 로딩/오류, 직업/배치/live/진행/저장/기록/상세/확인/공개/Day/종료 전체를 BMR 밤·낮·금색 강조로 맞춘다. 공식 아이콘/진영 의미색을 바꾸지 않는다.
- 의존: P2–P4. 위험: 유틸리티 조회가 draft를 지우거나 공개 상태가 복원되는 것, CSS 상속으로 SnV 보라색이 남는 것.
- 검증/완료: C10/C16–C21/C26/C34–C38, U01/U06/U09–U11. UI 위치뿐 아니라 왕복 동작과 상태를 함께 확인한다.

### P6. 구현 후 test와 인수 기록

파일 경계: `web/test/custom/`, `web/test/browser/`, 영향받는 공식 integration, custom domain/WASM; `docs/testing/issue-220-test-results.md`, `issue-220-manual-acceptance.md`, UI 대조 근거와 구현 기록.

- plan에서는 테스트 코드를 설계/작성/실행하지 않는다. 구현 후 `$test`가 승인된 수용 사례와 아래 경계를 입력으로 구체화한다.
- 기존 C01–C38/S1-a–g 전체와 추가 UI 조건을 추적한다. 테스트가 현재의 잘못된 UI를 정답으로 고정하지 않도록 기대값은 spec/기존 Production에서 가져온다.
- 우선 변경한 controller→실제 WASM/저장→실제 Production 화면을 확인하고, 공유 부품의 공식 소비자까지 회귀 검사한다.
- 필요한 검사: `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`, `pnpm --dir web build`, `pnpm --dir web test:custom`, `pnpm test:custom-runtime`, `node scripts/check-custom-boundaries.mjs`, `pnpm --dir web check:architecture`, `pnpm --dir web verify:pwa`, 관련 공식 unit/integration 및 Production browser.
- viewport 320/390/820/1366px에서 기본/선택 중/완료/비활성/오류/공개/Day 상태를 비교한다. 모바일 safe area, 스크롤, Tab/Shift+Tab/Enter/Space/Escape, 포커스 복귀, reduced motion을 확인한다. 물리 Safari/iPad 검증과 Chromium viewport 근거를 구별한다.
- 기존 부분 검증 C08/C15/C20/C21/C23/C29/C30/C32/C34/S1-e를 다시 추적한다. #209 게임 사례 R1/R2/R4/R5만 대표로 실행하고 나머지 입력 종류를 통과 처리하지 않는다. 이 게임 사례 ID는 본 계획의 보완 결정 R1/R2와 별개다.
- review 서버는 기존 운영자를 통해 관리하고 검토 중 유지한다. 테스트 runner의 임시 서버와 구분한다.
- 완료: 변경된 계약과 관련 회귀가 통과하고 실제 UI 조작의 근거가 있으며, 미검증 사항을 명시한다. 자동 테스트 성공만으로 사용자 인수/병합/이슈 종료를 선언하지 않는다.

## 7. 추가 블랙박스 수용 조건 — spec에 반영

[수용 조건 추적표](issue-220-reuse-traceability.md)에 C01–C38/S1-a–g/U01–U12 기존 57개를 작업 단위와 연결했다. 구조·명시 순서 보완 A01–A06을 합친 최신 기준은 63개다. 아래 표와 spec의 기대 결과는 동일하다.

| ID | 상황·조작 | 기대 결과 | 기존 spec 연결 |
| --- | --- | --- | --- |
| U01 | 설정/진행에서 상단 새 게임→취소/확인, 편집 검토에서 새 마도서 쓰기 | 상단만 초기화 확인. 취소는 입력까지 유지. 확인/직접 진입 모두 설정 편집만으로 자동 저장 불변 | C05/C18, S1-a–g |
| U02 | 배역을 채우기만 한 상태/직업 확정 후 탭 이동·인원/악마/배역 변경 | 확정 전 마도서 단계 차단. 확정 후 일반 조작으로 변경 불가. 배역 구성 변경은 새 게임에서만 가능 | C06/C07/C21 |
| U03 | 확정 전 정원 초과로 비활성/악마/확정 후 미선택 직업 클릭, 하단 상세 클릭 | 설명 바와 상세에 접근 가능. 선택 불가 배역은 변경되지 않으며 확정 후 카탈로그는 모두 조회 전용 | C07/C21 |
| U04 | 플레이 중 직업 탭과 마도서의 정체 조회 | 직업 탭은 확정 Setup의 같은 UI, 마도서는 현재 Actual/Shown/획득 상태. 변화를 roster 편집으로 취급하지 않음 | C06/C16/C21 |
| U05 | 대상이 필요한 모든 입력에서 선택/초기화/취소/확정 | 마도서 좌석과 기존 패널에서 처리. 제한과 선택 순서 유지. 정보 입력과 직접 행동의 확정 시점 구별 | C15/C29–C32 |
| U06 | 숫자·대상·bluff 입력 또는 제안 후 탭/상세/저장/과거 공개 왕복 | 현재 입력과 제안 보존. 확정/Undo/다른 action 선택 후에는 옛 입력 재사용 불가 | C16/C27/C32 |
| U07 | 준비·0명·등록 판단·숫자 0/boolean false·제약 숫자·캐릭터 쌍·획득·보류 입력 | 기존 정보 위계와 필요한 편집 제공. Core 허용값과 R0–R11의 독립 기대값 준수 | C15/C27–C31 |
| U08 | 준비/교환/재지정 전후 기록 공개 및 첩자 공개 | 해당 prefix의 payload만 공개. 첩자는 기존 마도서 좌석 형태, 현재 facts로 바꾸지 않음 | C16/C27/C30/C37 |
| U09 | 정상 생존 좌석 및 실제 상태가 있는 좌석 상세 | 의미 없는 생존 칩 없음. 실제 표식/정체/상태는 기존 상세 형태, 공개와 비공개 정보 구별 | C16/C21/C27 |
| U10 | 기록 열기/최신 기록 조회/과거 정보 공개/Undo 취소·실행 | 저장 유틸리티에서 접근, 진행 헤더 기록 버튼 없음. Undo는 기존 단위, 취소 무변경, 과거 조회 이벤트 추가 없음 | C16/C21/C27/C32 |
| U11 | 모든 화면과 BMR 밤/낮, 작은 화면/키보드/공개 포커스/시간 | 기존 위치·크기·활성/비활성·세부 테마 일치. 행위와 정보 접근 가능. 탭 이동 시간 유지 | C21/C27/C37/C38 |
| U12 | 진행 중 배치 복귀→취소/수정/저장 실패/재시도/reload | 승인된 R2: 초기화 확인 취소는 현재 입력까지 보존. 확인하면 원래 Setup으로 배치 편집. 편집/검증·저장 실패는 이전 저장 보존. 새 저장 성공 시 첫날 밤부터 한 번 시작하며 추가 교체 확인 없음. 새 확정 전 reload는 이전 게임 복원 | C06/C16/C18/C25, S1 |

## 8. 전체 완료 판단

1. R1/R2 보완 결정과 P0 기록 완료. S3는 사용자 첨부 JSON과 명시적 순서 요구에 따라 9.2절에서 정정했다. 이전 A/B 질문은 철회했으며, 시나리오 순서 이행을 다시 결정 대기로 취급하지 않는다.
2. P0 → P1 → P2 → P3 → P4 → P5 → P6 순으로 진행한다. 동일 계약의 UI/상태 변경을 분리 완료로 보고하지 않는다.
3. 기존에 잘 된 편집·Core·저장 기반은 유지하고, C/D/E의 누락 연결을 완료한다.
4. 29개 action 매핑, C01–C38/S1-a–g, U01–U12, 공식 회귀의 증거를 남긴다. 승인 UI와 다른 미연결 부분을 후속 이슈로 자동 미루지 않는다.
5. 이 문서는 구현 기준이며 전체 인수 완료 기록이 아니다. 최신 잔여 구현 순서는 9절 Q0–Q6이며, 과거 P1–P5 반영 기록을 후속 작업 완료로 취급하지 않는다.

## 9. 2026-09-11 실제 진행 피드백과 test 이후 후속 계획

사용자가 실제 15인 배치 직후 세탁부 정보 준비 화면으로 진입한 점과, 진행 카드의 `정답 플레이어`·`등록 판단` 범용 폼이 남은 점을 지적하고 계획 갱신을 요청했다. [사용자 첨부 화면](../testing/issue-220-v2-evidence/user-first-night-preparation.jpg)을 근거로 추가한다. 아래 내용은 이미 통과한 작업이나 승인된 R1/R2를 취소하지 않는다. **P1/P3/P4/P5에는 잔여 작업이 있으며, P6는 미통과다.**

### 9.1 조사 결과와 이전 검증의 한계

- `CustomStepInputs.tsx`는 `setupInfo`에 별도 정답 플레이어 select를 만들고, `requiredInput.playerRegistrationOptions` 전체를 대상 선택 여부와 관계없이 표시한다. 첨부 화면처럼 아직 선택하지 않은 다른 좌석의 등록 판단까지 먼저 나타난다. TB의 대상 선택 → 관련 캐릭터 후보 → 결과/공개 경로와 다르다. 공용 wrapper만 사용하는 것으로 기존 세부 UI 재사용을 완료 처리할 수 없다.
- `TroubleBrewingSetupInformationEditor.tsx`/`phaseInput.ts`는 선택한 대상에 따른 캐릭터 후보 및 등록 근거를 다루고, `TroubleBrewingLiveGrimoire.tsx`는 대상과 필요한 취급 선택을 실제 마도서 패널에 둔다. 숫자 정보의 등록 선택도 `TroubleBrewingScalarInformationEditor.tsx`의 취급 버튼과 결과 표현이 기준이다. 공식 DTO/규칙 함수를 custom에 import하지 않고 표현을 추출하여 두 adapter가 사용해야 한다.
- 사용자 추가 설명: **배치 완료 후 첫 진행에 하수인·악마 정보가 와야 하는데 바로 세탁부가 나왔다.** `CustomNightTask`의 `BmrInformationTask` 및 공개 payload 경로는 연결돼 있다. 전 단계가 무엇인지와 공개 기능 유무를 혼동하지 않는다.
- `TbHandler.preparation_candidates()`가 초기 준비를 만들고 `NightScheduler.normalize_progress()`가 전체 required_queue를 먼저 채운다. `FirstNightProgress.next_occurrence()`도 required_queue를 순서 cursor보다 먼저 반환한다. `CustomNightTask`는 이 currentStep을 그대로 표시한다. 따라서 준비가 필요한 배역이 있는 게임은 하수인 정보 전에 준비부터 보인다.
- `CustomPhaseOrder`는 definition에 연결한 위치에 준비/전달을 배치한 읽기 전용 개요다. 목록의 하수인/악마가 위에 있고 현재 준비가 아래인 모습은 실제 준비 우선순위와 표시 위치의 차이에서 나온다. 목록을 임의 실행 버튼으로 바꾸거나 UI에서 다음 단계만 골라 Core를 우회하는 수정은 하지 않는다.
- 직전 R0 browser 검사는 초기 준비들을 먼저 처리한 뒤 시스템 정보를 공개했다. 그 테스트가 통과한 것은 공개/후속 저장 경로의 근거이며, 사용자가 요구한 **배치 직후 첫 화면**의 근거가 아니다. 기존 결과를 삭제하지 않고 C06/C15/C27/U07/U11의 이 연결을 재검증한다.

### 9.2 S3 정정 — 사용자가 지정한 시나리오 순서를 실행 기준으로 유지

**2026-09-11 사용자 확인:** 사용자가 [실제 시나리오 JSON](../testing/issue-220-v2-evidence/user-clocktower-scenario-test.json)을 제공하고, 시나리오 설정에서 하수인/악마 정보를 먼저 뒀는데 실제 시작은 세탁부였다고 명확히 설명했다. 따라서 ‘현재 Core 순서를 보존할지’ 선택하도록 했던 앞선 질문과 A/B 결정 대기는 철회한다. 기존 사용자 요구의 실행 누락이며, 새로운 순서 정책을 사용자가 다시 선택할 일이 아니다.

첨부 JSON의 `firstNightOrder`는 다음과 같다. `dusk`는 기존 시작 처리다.

1. 하수인 정보 (`minionInfo`)
2. 악마 정보 (`demonInfo`)
3. 독살범 (`choosePoisonTarget`)
4. 세레노버스 (`assignMadness`)
5. 세탁부 (`learnTownsfolk`)
6. 사서 (`learnOutsider`)
7. 수사관 (`learnMinion`)
8. 요리사 (`learnEvilPairs`)
9. 점쟁이 (`checkDemon`)
10. 첩자 (`inspectGrimoire`)
11. 낮 시작 (`dawn`)

실제 배역/상태에 적용되지 않는 행동은 기존 Core 규칙에 따라 제외하지만, 적용되는 정규 행동 사이의 상대 순서는 이 배열을 따른다. 이 파일로 유효한 15인 배치를 마쳤다면 첫 진행 카드는 하수인 정보여야 한다. 세탁부 정보 준비를 먼저 요구해서는 안 된다. JSON은 시나리오 파일이며 사건 기록은 없으므로, 이 파일만으로 해당 사용자 게임에서 시스템 정보가 이미 실행·건너뜀 처리됐다고 단정하지 않는다. 첨부 화면에는 두 단계가 대기로 남아 있고, 조사한 코드에서는 전역 초기 준비가 그 앞을 차지한다.

**‘Core 순서 유지’의 정확한 뜻:** 시나리오가 확정한 `definition.firstNightOrder`, 실제 배역/효과에 따른 유효성, occurrence별 한 번 실행, 후속 결과의 출처를 보존한다는 뜻이다. 현재 코드의 전역 초기 준비 우선 처리까지 보존한다는 뜻이 아니다. spec 6/7절의 시나리오 명시 순서가 정답이며, 이를 어기는 scheduler 연결은 수정 대상이다. 기존 plan의 scheduler 불변 문구는 이 범위에서 정정한다.

최초 `prepareInformation`(세탁부/사서/수사관), `assignRedHerring`, `assignTwin`은 관련 행동의 준비로 연결하고, 앞선 하수인·악마 등 무관한 정규 행동을 가로막지 않게 한다. 기본 연결점은 catalog의 linked action 직전이다. 준비를 실제로 소비하는 별도 선행 규칙이 있으면 담당 handler가 그 의존 관계를 제공하며, 단순히 initialPreparation이라는 이유로 전체 게임 시작에 선행시키지 않는다. 능력 획득/모의/교환 이후의 필수 준비·재준비·통지는 기존 인과 관계에 따라 처리한다. 원래 Setup의 초기 준비와 새 능력에서 생긴 초기 준비는 출처로 구분한다.

시나리오에 별도 준비 항목을 추가로 편집하게 하거나, 배치 전에 새로운 준비 화면을 끼워 넣거나, 하수인/악마만 UI에서 강제로 골라 보여주는 방식은 사용하지 않는다. 준비와 전달 사건 및 당시 payload는 보존하고 Core의 정규 진행/준비 연결을 바로잡는다.

영향: C06/C15/C16/C27/C29/C30/C33/C34/C37, U05–U08/U11/U12와 #209의 사건 순서·준비 표식 공개·계산 근거 기대값. 이전의 초기 준비 선행 테스트는 당시 실행 증거로 남기고 새 시작 흐름의 정답으로 사용하지 않는다. 구 파일 호환과 실제 정보 규칙은 Q1의 완료 조건이다. 사용자가 후속 책임 분리 방향을 확인하고 spec·plan 수정 및 이슈 기록을 요청했다. 본 문서는 그 구현 기준이며, 구현·검증 완료나 병합·이슈 종료를 뜻하지 않는다.

### 9.3 추가 개발 단위

#### Q0. 기존 UI와 custom 진행의 연결 구조 확정·분리

- **파일:** `custom/grimoire/actionPresentation.ts`, `firstNightController.ts`, `stepInputModel.ts`; 신규 `grimoire-custom/taskPresentationModel.ts`; `CustomNightTask.tsx`, `CustomStepInputs.tsx`, `CustomGrimoireBoard.tsx`, `CustomPhaseOrder.tsx`; `shared-ui` 정보/선택 부품과 해당 공식 adapter. 구조 문서 `ARCHITECTURE.md`의 책임 설명도 이 범위에서 갱신한다.
- **변경:** 4절의 typed 화면 모델과 단일 행동→표현 연결을 확정한다. 기존 페이지에서 표현과 공식 전용 가정을 분리한다. controller는 실행 데이터와 draft, adapter는 화면 모델, shared 부품은 표현을 소유한다. 공통 shell/스타일만 재사용하고 입력·확정 경로를 다시 복제하는 방식은 종료한다.
- **의존/순서:** Q1–Q4의 공통 계약이므로 선행한다. Q1의 Core 순서/입력 projection 변경과 모델 필드를 먼저 맞춘 뒤 해당 UI를 연결한다. 필요한 projection이 아직 없으면 임시 추측 fallback을 넣지 않는다.
- **위험/제약:** 순서 고정을 adapter에 옮기기, 캐릭터별 규칙을 renderer에 복제하기, 입력/공개/확정의 서로 다른 identity를 합치기. 반대로 새 범용 workflow 엔진이나 공식 runtime 통합으로 범위를 확대하지 않는다.
- **검증/완료:** A02/A03/A04/A06과 공식 소비자 회귀. 정규 순서가 다른 두 시나리오에서 같은 입력/공개 표현을 사용하고, 29개 행동의 연결 누락이 없으며 invalid 입력 계약은 안전하게 오류로 남는다. 파일 이름만 나눈 것은 완료가 아니다.

#### Q1. 시나리오 순서에 맞는 최초 준비·시스템 정보 진입과 파일 호환

- **파일:** `crates/custom-domain/src/first_night/{runtime,registry,catalog}.rs`, `state.rs`, `game.rs`, `projection.rs`, `characters/{trouble_brewing,sects_and_violets}.rs`; `custom/grimoire/{firstNightController,historyModel,actionPresentation}.ts`; `CustomNightTask.tsx`, `CustomPhaseOrder.tsx`. 기준 문서 `ARCHITECTURE.md`, spec 6/7절 및 #209 영향 사례.
- **소유/흐름:** handler가 준비의 필요성·출처·연결 행동을 반환하고 scheduler가 순서 위치에 맞춰 admission한다. `currentStep`, `availableActions`, `phaseOverview`, 이벤트 검증은 동일한 admission 결과를 쓴다. 시스템 정보 화면은 지금의 BMR task→proposal→payload→가리기→확정 경로를 유지한다.
- **변경:** 원래 Setup에서 시작한 준비는 연결 정규 행동에 도달할 때 미해결이면 내보낸다. 다음 정규 occurrence를 먼저 산정하고 그 occurrence의 준비를 끼워 넣어, 현재 코드의 ‘전역 준비를 먼저 채우고 cursor 갱신 전 return’ 순환을 없앤다. 새 능력·교환·무효 준비의 필수 처리와 Day 차단은 유지한다. owner/ability instance/준비 버전별로 확정한다.
- **이전 기록:** 기존에 유효했던 초기 준비 선행 GameFile을 계속 읽어야 한다. 준비 사건을 삭제·재정렬하거나 그 당시 facts/payload를 새 시점으로 계산하지 않는다. replay에서만 이전 규칙에 유효한 초기 준비 admission을 엄격하게 인정하는 호환 경로를 둔다. original Setup 출처, 실제 소유자, 당시 허용 입력, 기존 순서 규칙을 모두 검증한다. 새 명령은 새 currentStep/availableActions만 수락한다. 임의의 out-of-order 사건이나 정상 prefix만 채택하는 예외는 허용하지 않는다. 파일 버전/마이그레이션을 추가하는 설계로 바뀌면 별도 spec 결정이 필요하다.
- **위험/제약:** 준비를 늦추면 독살/등록·교환 이후의 준비 후보와 감사 근거가 달라질 수 있다. Spy가 앞에 있으면 아직 없는 준비 표식은 보여주지 않는다. 이전 snapshot은 보존하고 새 흐름의 기대값은 변경된 시점의 규칙으로 독립 산출한다. 기존 tests의 숫자를 일괄 치환하지 않는다.
- **검증/완료:** 새 15인 Setup에서 첫 카드가 definition의 첫 실행 단계이며 기본 순서는 하수인→악마다. 세탁부/사서/수사관/점쟁이/쌍둥이의 최초 준비, 획득·모의·재준비, optional 및 Day 차단, 구·신 기록 reload/Undo/JSON/history를 별도로 확인한다. 연결 시점이 기존 saved file을 무효화하면 완료 아님.

#### Q2. 첨부 화면의 준비·등록 폼을 실제 기존 입력 경로로 교체

> 후속 정정: 입력 위치/사용자 단계는 v3 T2–T4를 따른다. 세탁부의 표시 캐릭터를 마도서에서 반드시 고르게 하지 않으며 진행에서 편집한다.

- **파일:** `CustomStepInputs.tsx`, `CustomGrimoireBoard.tsx`, `CustomNightTask.tsx`; `custom/grimoire/{firstNightController,stepInputModel}.ts`; `shared-ui/{GrimoireSelectionPanel,InformationInputPresentation,InformationTaskPresentation}.tsx`, 공용 정보 스타일; 공식 `TroubleBrewingSetupInformationEditor.tsx`, `TroubleBrewingScalarInformationEditor.tsx`, `TroubleBrewingLiveGrimoire.tsx` 및 SnV 정보 adapter. 후보 표현이 부족한 곳은 custom `model.rs`, `characters/trouble_brewing.rs`, TS `types.ts`/`validation.ts`의 읽기 전용 입력 projection을 확장한다.
- **소유/인터페이스:** Core는 현재 occurrence와 prefix에 유효한 준비 선택지를 제공한다. 준비 선택지는 `{ playerIds, characterId, correctPlayerId, registrationJudgments }` 또는 0명 선택의 완전한 조합으로 표현하고, 같은 TB validation/등록 정책을 재사용한다. UI는 이를 대상/표시 캐릭터/관련 취급으로 좁혀 기존 `PhaseStepConfirmation`을 만든다. 전체 세션이나 공식 DTO를 공용 표현에 넘기지 않는다. projection은 현재 준비 단계에 필요한 조합만 내보내며 중복 조합을 제거한다.
- **변경:** 대상 선택 전 빈 정답 플레이어/모든 좌석의 등록 판단을 나열하지 않는다. 대상은 실제 마도서에서 고르고, 선택한 대상에 유효한 캐릭터·관련 취급만 기존 TB 표현에 연결한다. 하나로 정해지는 정답/등록 정보는 중복 입력을 요구하지 않는다. 여러 유효한 정답 표식 배치가 가능한 경우에는 사용자 재량을 임의 확정하지 않고 선택한 두 대상에 한정한 기존 선택 패널에서 구분한다. 잘못된 `없음` 기본값으로 확인을 허용하지 않는다.
- **준비와 전달:** 이미 준비된 내용은 결과로 보여준다. 전달 조정이 허용될 때만 기존 대상 선택/정보 편집 경로를 사용한다. 사서 0명, 취함/중독/보르톡스, 실제/모의/획득 능력, 등록에 따른 재량을 지우지 않는다. 전송할 숫자와 등록 후보 전체를 합친 긴 select 대신 기존 취급 선택→결과 및 진실/전달 입력을 쓴다.
- **의존:** Q1과 독립적으로 표현을 추출할 수 있으나 최종 연결/검증은 Q1과 함께 한다. controller가 draft를 소유하고 행동 identity 변경 시 관련 선택을 폐기한다.
- **위험/제약:** `correctPlayerId`는 단순 장식이 아니라 저장되는 준비 표식 출처다. 제거한 UI 대신 잘못된 자동 정답을 저장하면 안 된다. 준비 유효성을 웹에서 다시 계산하거나 trial 명령을 자동 확정하여 값을 채우지 않는다. 공용화 후 공식 화면도 실제 공용 DOM/CSS를 소비해야 한다.
- **검증/완료:** 첨부 상태(15명, 아직 대상 미선택, 별도 등록 가능 좌석 존재)부터 실제 입력/준비/공개를 진행한다. 선택 외 좌석의 무관한 폼이 없고, 모든 Core 허용 조합이 접근 가능하며 잘못된 조합은 확정되지 않는다. 기존 TB와 같은 상태의 배치·간격·활성/비활성·버튼·키보드를 대조한다. U05/U06/U07/U09/U11, C15/C29/C30을 포함한다.

#### Q3. 숫자 편집과 Dreamer 고정 후보 (기존 F1/F4)

- **파일:** `shared-ui/InformationInputPresentation.tsx`, `InformationTaskPresentation.tsx`, `CustomStepInputs.tsx`, `firstNightController.ts`, `stepInputModel.ts`; custom SnV의 `characters/sects_and_violets.rs`/관련 projection/TS 검증기; 공식 TB/SnV 소비자.
- **변경/소유:** 입력 중 문자열과 공개 가능한 검증 숫자를 분리한다. custom의 편집 중 문자열도 controller draft로 보존하고 occurrence 전환에서 폐기한다. 1이 제외됐어도 12를 완성할 수 있고 0/false는 빈 값으로 취급하지 않는다. 오류/공개 차단 시점은 기존 정보 입력과 일치시킨다. Dreamer actual 또는 강제 후보 여부는 Core 후보/판정 projection에서 연결하며 custom의 pair 결과를 공식의 character 결과라고 가정하지 않는다. 정상 고정 후보는 잠그고 재량인 후보는 편집 가능하다.
- **의존:** Q2 공통 입력/표현 계약. **위험:** 정상 후보를 잠그려다 취함·중독·거짓 정보 재량까지 잠그거나, 미완성 숫자를 마지막 유효 값으로 전송하는 것.
- **검증/완료:** 기존 F1/F4 재현이 통과하고, 연속 타이핑·삭제·붙여넣기·0·소수·제외값·탭 왕복과 실제 Dreamer 공개 결과/잠금/재량을 확인한다. 공식 shared 소비자의 회귀가 없어야 한다.

#### Q4. 준비/전달 식별과 작은 화면 배치 (기존 F2 포함)

> 후속 정정: 아래 별도 `준비`/`정보` 행 제안은 철회한다. v3 T2에서 내부 사건을 보존하며 하나의 사용자 직업 단계로 연결한다.

- **파일:** `CustomPhaseOrder.tsx`, `CustomNightTask.tsx`, `CustomGrimoirePlay.tsx`, `customGrimoirePlay.css`, `customBmrTheme.css`, 필요 공용 `productionShell.css`, `historyModel.ts`.
- **변경:** TB의 간결한 목록을 유지하되 같은 직업의 준비와 전달을 역할 이름만 중복 표시하여 구분을 지우지 않는다. 필요한 행에는 짧은 `준비`/`정보` 표기를 사용하고 owner가 겹치면 좌석을 더한다. 준비와 현재 순서의 표시가 실행 가능한 단계라는 오해를 만들지 않게 한다. 320px 뒤로 버튼/단계명/시간의 영역이 겹치지 않도록 기존 반응형 배치를 적용한다. Q2 폼의 폭·간격도 같은 BMR 상태별 스타일로 맞춘다.
- **의존:** Q1/Q2 연결 결과. **위험:** 목록을 길게 풀어 쓰거나 같은 action의 다중 owner를 합치는 것, CSS 변경이 공식 헤더에 번지는 것.
- **검증/완료:** 320/390/820/1366에서 헤더·준비·숫자·시스템 정보·공개·기록·Day를 실제 조작/비교한다. 겹침 없이 탭/키보드/터치 대상에 접근하고 경과 시간은 유지한다. C21/U11 및 기존 F2를 포함한다.

#### Q5. 자동 표식 projection과 fixture 경계 회귀 (기존 F3)

- **파일:** custom `projection.rs`, `characters/trouble_brewing.rs`, fixture용 `first_night/fixtures.rs`/runtime 구성, `model.rs`/`contracts.rs`, TS `validation.ts` 및 해당 fixture 응답 경계.
- **변경/소유:** production 표식은 실제 지원하는 캐릭터/토큰 출처만 기존 character helper에서 만든다. fixture의 합성 Clockmaker impairment가 production reminder처럼 무조건 투영되지 않도록 runtime별 표현 공급 경계를 분리한다. 공통 replay 검증기 허용 목록을 합성 캐릭터까지 넓히거나, 실제 production 표식을 전부 지워 통과시키지 않는다. command/event/file 형태는 유지한다.
- **의존:** Q1과 같은 projection/game 파일을 건드릴 수 있으므로 통합 순서를 맞춘다. **위험:** 과거 Spy와 현재 비공개 board의 표식이 서로 바뀌거나, fixture를 위해 production 입력 검증이 느슨해지는 것.
- **검증/완료:** 두 runtime fixture 실패, 공식 소스 없는 isolation, production current/Spy 표식과 출처 검사가 통과해야 한다. C17/C36/U08/U09 및 독립 runtime 제약을 확인한다.

#### Q6. 통합 검증과 사용자 진행 경로의 재확인

- **파일 경계:** 기존 `web/test/custom`, browser/integration, custom Rust/WASM tests, `docs/testing/issue-220-v2-test-results.md`의 후속 실행 기록과 manual acceptance. 이 plan 단계에서는 테스트 코드를 작성·실행하지 않는다.
- **순서:** 승인 spec 7.1–7.3/S3 정정 → Q0 공통 연결 계약 → Q1 계약·호환 → Q2 → Q3 → Q4/Q5 통합 → Q6. 각 단위의 변경 파일·책임과 검증 경계를 함께 완료한다.
- **필수 블랙박스 경계:** 첨부 `user-clocktower-scenario-test.json`을 포함한 시나리오 실제 작성/불러오기 → 빈 roster → 15인 배역 확정 → 배치 완료 → 첫 진행 카드 → 시스템 두 정보 공개/가리기/확정 → 직업별 최초 준비/전달 → Day. 이미 준비된 fixture만으로 새 게임 첫 진입을 대체하지 않는다.
- **검증 범위:** 기존 57개 + A01–A06, 총 63개 조건과 29개 행동을 계속 추적한다. 이번 단위가 건드린 각 초기 준비·재준비·등록·정보 입력 분기, 구·신 파일 왕복/당시 정보, 공식 shared 소비자, fixture 격리를 확인한다. 기존 미검증 표의 부분 항목은 별도 공백으로 유지한다.
- **명령 경계:** 관련 custom Rust/WASM, `pnpm --dir web test:custom`, `pnpm --dir web test:unit`, integration/browser, `pnpm --dir web test:custom-runtime`, `node scripts/verify-custom-runtime-isolation.mjs`, boundaries/architecture, `pnpm --dir web build`/PWA. 실제 iPad/Safari와 Chromium viewport를 구별해 기록한다.
- **완료:** 최초 화면 요구와 첨부 UI 문제, F1–F4가 해결되고 실제 변경 경로 및 A01–A06의 검사 근거가 있어야 한다. 기존 30개 browser 통과, R0 Day 도달 또는 색상 일치만으로 전체 연결 완료를 선언하지 않는다. 사용자 인수·병합·이슈 종료는 별도다.

## 10. 2026-09-11 책임 분리 보완 기록

사용자가 기존 UI 재사용과 내부 구조 재설계의 책임 분리 설명을 확인한 뒤 “spec 및 plan 수정해서 이슈에 기록해줘”라고 요청했다. spec 7.1–7.3과 본 문서 4절/Q0–Q6을 최신 구현 기준으로 기록한다. 기존 R1/R2, 저장 원자성, BMR 테마, 공식/custom 독립 경계는 유지한다. A01–A06은 기존 57개와 함께 추적하며 현재 검증 상태는 미통과다. 이번 문서 변경에서 production 코드·테스트를 수정하거나 실행하지 않았다.


### 2026-09-11 후속 implement 반영

Q0–Q5의 구조·스케줄러·입력 projection/공용 표현·숫자 편집·Dreamer 후보·모바일 헤더·fixture 표식 경계를 구현했다. 상세 변경과 Q6 인계는 [구현 문서](../implementation/issue-220-custom-grimoire-v2.md#2026-09-11-q0q5-수정-구현)에 기록한다. 전체 웹 빌드와 production/fixture Rust 컴파일, TypeScript 및 구조 경계 진단을 통과했다. 이번 단계에서는 테스트를 작성·수정·실행하지 않았으며 63개 조건/29개 행동과 기존 F1–F4의 검증 결과는 다음 `$test`에서 갱신한다. 과거 미통과 기록을 이번 구현으로 자동 해소하지 않는다.


### 2026-09-11 Q6 검증 결과

현재 판정은 **미통과**다. 시나리오 지정 순서와 새 15인 배치의 하수인→악마 진입, 기존 F1–F4 수정은 확인했다. 다만 QF1: 세탁부(정상·중독·획득), 사서, 수사관은 정보 준비 후 전달 화면에서 준비 결과가 연결되지 않아 공개할 수 없다. Core의 준비 사실과 전달 occurrence를 adapter가 owner/source를 보존하여 연결하는 후속 구현이 필요하다. Q0–Q5 구현 기록은 전체 완료 판정이 아니다. [현재 테스트 결과·63개 조건·29개 행동 및 미검증 범위](../testing/issue-220-q-test-results.md)를 Q6의 최신 근거로 사용한다.
