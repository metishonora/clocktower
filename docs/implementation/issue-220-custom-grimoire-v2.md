# #220 수정 구현 v2 인계

2026-09-11 · 승인된 [수정 계획 v2](../plans/issue-220-custom-grimoire-plan-v2.md)의 P1–P5 구현 반영. P6 테스트·수용 판정은 미실행.

기존 미커밋 구현과 테스트 파일을 보존한 채 `codex/issue-220`에서 이어 작업했다. 이 문서는 기능 테스트 통과, 사용자 인수, 병합 또는 이슈 종료를 뜻하지 않는다.

## 계획 대비 변경

| 단위 | 구현 |
| --- | --- |
| P1 공용 표현 | TB 선택 패널, TB 숫자·준비 정보 입력, SnV 꿈꾸는 자/재봉사/철학자 입력·수학자 근거·기록, BMR 확인창과 경과 시간의 순수 표현을 shared-ui로 추출. 공식 호출자도 같은 부품을 사용한다. 정보 CSS는 shared-ui로 이동하고 공식 경로는 호환 import를 유지한다. |
| P2 설정과 복귀 | controller의 rosterConfirmed/confirmRoster로 인원·악마·직업 구성 변경을 잠근다. 좌석 편집은 별도 유지한다. 설정과 live는 CustomRoleSetup을 공유하며 live는 원래 setupConfirmed 구성을 표시한다. 선택 불가 직업도 하단 설명과 상세 창을 열 수 있다. 새 게임 확인 및 원래 Setup으로 배치 복귀를 연결했다. 복귀 자체는 저장하지 않는다. |
| P3 입력과 마도서 | 현재 입력·bluff·전달 조정 값을 FirstNightController가 소유한다. canonical 및 행동 출처 identity를 확인하며 확정/Undo/행동 전환에 초기화한다. 일반 탭/저장/상세 조회는 입력을 유지한다. live는 AssignmentSurface 대신 GrimoirePresentation/RectangularGrimoireBoard를 사용한다. 대상/정보 준비/전달 조정/광기 대상을 같은 좌석 선택 경로에 연결한다. |
| P4 정보와 공개 | Core 후보·제약을 읽어 숫자, 등록 판단, 두 캐릭터, 진영, 준비된 정보와 조정, 정답 플레이어, 수학자 근거를 표시한다. 단일 결과와 0/false를 유지한다. activeReveal의 current/history/notification과 현재 proposal을 분리한다. 첩자는 공개 payload만으로 사각 좌석 마도서와 토큰을 표시한다. 기존 spy_reminders를 읽기 전용 ruleState.automaticReminders projection에 재사용하고 상세/좌석 배지에 연결했다. |
| P5 통합 | 기록은 저장/불러오기 아래 최신순 목록. 상단 Undo에는 사건 요약과 stale-prefix 확인이 있는 확인창을 연결했다. 새 게임·배치 복귀·Undo 취소는 canonical을 변경하지 않는다. 진행/마도서가 같은 경과 시간을 사용한다. 밤/낮, 정보 입력·기록·확인·상세·공개 테마를 BMR에 맞췄다. |

## 저장·경계

- GameFile/Command/Event 및 저장 버전 변경 없음. 새 확정의 원자적 대체/재시도는 기존 writer 경로를 사용한다.
- 배치 복귀 seed는 원래 setupConfirmed의 인원·이름·Actual/Shown·좌석이다. 현재 교환/획득/사망/중독 상태를 새 Setup에 복사하지 않는다.
- `src/custom`와 custom Rust는 공식 runtime/DTO에 의존하지 않는다. UI 어댑터에서 순수 공용 props로 연결한다.
- 공개 컴포넌트는 세션/전체 replay를 받지 않는다. 기록 조회는 기존 당시 prefix 공개 API를 사용한다.
- 수동 표식/메모 command, 일반 무작위 추천 API, 낮/다음 밤/BMR 능력은 추가하지 않았다.

## 수행한 확인

- `pnpm --dir web build` 통과: official/custom WASM, TypeScript, Vite, PWA 산출물 생성.
- 최종 테마·선택 재진입 보완 후 `pnpm --dir web exec tsc -b` 및 `pnpm --dir web exec vite build` 통과.
- `node scripts/check-custom-boundaries.mjs`, `pnpm --dir web check:architecture`, `git diff --check` 통과.
- Rust의 기존 unused/dead-code 경고 및 WASM 정적/동적 import 청크 경고가 남는다. 첫 샌드박스 빌드의 wasm-opt 실행 제한은 허용된 빌드 재실행으로 해소했다.
- 이번 implement 단계에서는 테스트 코드를 작성·수정하거나 테스트 스위트를 실행하지 않았다. 이전 테스트 결과는 이번 변경의 근거로 승격하지 않는다.

## test 인계

[57개 조건 추적표](../plans/issue-220-reuse-traceability.md), 계획의 29개 등록 행동 및 #209 R0–R11을 그대로 입력으로 사용한다.

특히 다음은 실행 검증 전이다.

- 확정 후 모든 직업의 상세 접근, 인원/악마/배역 변경 거부, 탭 왕복과 최초 구성을 보여 주는 live 역할 화면.
- 배치 복귀 취소/확인/새로고침/저장 실패/재시도와 이전 슬롯 보존. 저장 대체 확인창이 재도입되지 않았는지.
- 대상 선택의 최소/최대/의존 후보, 준비와 직접 행동의 확정 경계, 광기 캐릭터, 전달 조정 대상 선택 취소와 보존.
- 같은 수의 다른 canonical prefix/획득 출처/재준비 전환, pending proposal 중 history·통지 공개 왕복, Undo 뒤 입력 폐기.
- 0/false, 정수/제외 값, 여러 등록 후보, 꿈꾸는 자 쌍, 사서 외부인 없음, 정보 준비의 정답 지정, 실제 수학자 근거.
- 현재/과거 첩자 payload, 표식 출처, 공개 중 이야기꾼 shell 은닉 및 포커스 복귀.
- 공식 SnV/TB/BMR 공용 부품 회귀, 320/390/820/1366px의 배치/선택/정보/기록/공개/낮 상태와 터치·키보드·reduced motion. 실제 Safari/iPad 확인은 별도다.

테스트나 UI 비교에서 차이가 나오면 승인 spec/기존 마도서를 기준으로 수정한다. 현재 출력을 기대값으로 고정하지 않는다.

## 검토 서버

운영자가 lifecycle manager로 `preview:10220`의 running/verified/keep 상태를 확인했다. [검토 서버](리뷰 서버(검증 당시))에서 `CustomGrimoireApplication-EnOCjWCO.js`와 `CustomGrimoireApplication-DP_LWdyl.css`가 HTTP 200이며 최종 dist와 본문이 일치한다. 서버는 재시작 없이 유지했다. 이 확인은 산출물 제공 확인이며 UI 수용 테스트가 아니다.

## 2026-09-11 test 실행 후 상태

[수정 v2 검증 결과](../testing/issue-220-v2-test-results.md)에 신규 회귀·57개 조건·29개 행동의 검증 범위와 미해결 결함을 기록했다. 공식 unit import 확장자 문제는 수정했지만 네 구현 결함이 남아 검증 미통과다. 위 구현 당시의 테스트 대기 목록은 이 최신 실행 기록을 함께 참조한다. 사용자 인수·P6 통과를 선언하지 않는다.

## 실제 첫 진행 피드백 후 계획 갱신

배치 직후 세탁부 초기 준비가 먼저 나오는 현상과 준비/등록 전용 폼 미반영을 [plan v2 9절](../plans/issue-220-custom-grimoire-plan-v2.md#9-2026-09-11-실제-진행-피드백과-test-이후-후속-계획)의 Q1–Q6으로 추적한다. S3는 사용자 첨부 JSON에 따라 시나리오 명시 순서 이행으로 정정했다. 이전 A/B 결정 대기는 철회했다. 이 기록 단계는 production 수정 또는 재검증 결과가 아니다.

## 승인된 구조 보완 반영

사용자 요청에 따라 spec 7.1–7.3, plan 4절/Q0–Q6 및 A01–A06을 이슈 기록 기준으로 추가했다. 기존 UI의 사용자 동작을 유지하며 내부 진행 연결은 재설계할 수 있다. 전체 추적은 기존 57개 + 신규 6개로 63개다. 이 보완은 문서 작업이며 구현·검증 완료가 아니다.

## 2026-09-11 Q0–Q5 수정 구현

사용자가 `$implement`로 후속 수정을 요청해 승인된 spec 7.1–7.3과 plan 9절을 구현했다. 이전 test 미통과 기록은 보존한다. 아래는 구현 내역이며 Q6 검증 통과 선언이 아니다.

| 단위 | 이번 변경 |
| --- | --- |
| Q0 | 29개 actionRef의 표현 dispatch를 `actionPresentation`으로 모으고 `taskPresentationModel`에 identity/actor/ability/stage/editor/result/warnings/actions를 구성했다. task·입력·마도서가 이를 소비하며 잘못된 입력 계약은 확인을 막는다. controller가 명령 조립과 입력 초안을 소유한다. `ARCHITECTURE.md`에 책임 경계를 기록했다. |
| Q1 | 원래 Setup 출처의 초기 준비를 catalog linked action에 연결했다. 새 능력/재준비의 필수 우선순위는 유지한다. currentStep·선택 가능 행동·대기 목록·이벤트 fold가 같은 scheduler를 사용한다. 구 파일의 선행 초기 준비는 replay에서만 기존 후보 순서와 입력/소유자 검증을 거쳐 받아들인다. 새 proposal에는 이 호환 경로를 열지 않는다. |
| Q2 | TB validation으로 완전한 준비 조합과 등록 provenance를 projection한다. 대기/과거 행에는 후보를 붙이지 않고 현재/선택 가능 행동만 입력 후보를 받는다. 대상·표시 캐릭터·정답 표식·관련 등록 선택은 실제 마도서 선택 패널에 연결했다. 유일한 정답/등록은 자동 연결하고 모호한 정답은 명시 선택한다. 준비된 전달은 읽기 전용이며 수정은 Core가 제공하는 optional 재준비로 연결한다. 긴 등록 select를 공용 취급 버튼과 결과 표시로 바꿨다. 공식 TB 준비·숫자·마도서 입력도 같은 공용 DOM/CSS를 쓴다. |
| Q3 | 숫자 편집 문자열과 유효한 값을 분리했다. 제외된 중간 숫자를 거쳐 다자리 값을 입력할 수 있고 미완성 값은 전달하지 않는다. custom 문자열은 controller 초안에 유지한다. Dreamer 고정 캐릭터는 Core가 전체 허용 쌍에서 고정 여부를 확인해 내려주며 UI가 실제 정체를 추측하지 않는다. |
| Q4 | 목록의 준비/전달·붉은 청어·쌍둥이·배역 지정을 짧게 구분했다. 모바일 헤더의 제목·시간 영역을 제한하고 줄바꿈을 허용했다. 새 공용 취급/선택 입력에 BMR 상태별 색상·비활성·포커스를 연결했다. |
| Q5 | fixture 빌드가 production 자동 표식 제공자를 호출하지 않게 분리했다. production 표식 및 현재 board/과거 Spy payload 분리는 유지하며 TS 표식 허용 목록을 넓히지 않았다. |

### Q6 인계

- 이번 단계에서 테스트 코드의 작성·수정 및 테스트 스위트 실행은 하지 않았다. 전체 63개 조건, 29개 행동과 A01–A06의 검증 상태는 대기다.
- 사용자 JSON은 시나리오 정의만 포함하므로 사용자의 실제 15인 GameFile을 재현했다고 주장하지 않는다. 다음 test에서 새 15인 배치로 하수인→악마→시나리오 지정 행동을 진행하고, 순서를 바꾼 유효 정의도 확인한다.
- 구 초기 준비 prefix와 새 prefix 각각의 JSON/reload/Undo/당시 공개를 확인한다. 임의 out-of-order 및 다른 능력 출처는 거부해야 한다.
- 세탁부/사서/조사관, 0명, 등록 가능 대상, 두 정답 후보, 중독/취함/보르톡스, 획득/모의/재준비와 선택 후 탭 왕복을 실제로 진행한다. 많은 후보가 있는 혼합 배역의 projection 응답 시간도 확인한다.
- 숫자 `1` 제외 상태에서 `12` 입력, 지우기/잘못된 중간 값/탭 복귀, 정상·재량 Dreamer 쌍을 다시 검증한다.
- 기존 F1–F4와 320/390/820/1366px, 공식 TB/SnV/BMR 공유 입력·스타일, fixture 응답/production 표식 격리를 재검증한다. 이전 테스트의 초기 준비 선행 기대값을 새 흐름에 재사용하지 않는다.


### 이번 구현의 빌드·진단 결과

- `pnpm --dir web build` 통과: official/custom WASM, TypeScript, Vite 및 PWA 산출물 생성. 샌드박스의 wasm-opt 실행 제한은 같은 빌드의 허용된 재실행으로 해결했다.
- `cargo check -p clocktower-custom-domain`, `cargo check -p clocktower-custom-domain --features custom-runtime-fixtures`, `pnpm --dir web exec tsc -b --pretty false` 통과.
- `node scripts/check-custom-boundaries.mjs`, `pnpm --dir web run check:architecture`, `git diff --check` 통과. 기존 unused/dead-code 및 청크 경고는 남아 있다.
- 새 산출물 JS: `CustomGrimoireApplication-DseKL34u.js`. 서버 운영자의 정적 자산 확인은 사용자 진행 테스트와 구분한다.

검토 서버 운영자가 `preview:10220`의 running/verified/keep 상태를 확인했다. 최신 `CustomGrimoireApplication-DseKL34u.js`와 `CustomGrimoireApplication-BAmACcqe.css`는 HTTP 200이며 dist와 본문이 일치한다. 서버 재시작 및 UI 테스트는 하지 않았고 [검토 URL](리뷰 서버(검증 당시))을 유지했다.


### 2026-09-11 후속 test 판정

**미통과 — QF1 정보 준비→전달 UI 연결 결함.** 정상·중독·획득 세탁부, 사서, 수사관에서 준비 확정 후 “전달 정보가 연결되지 않았습니다.”가 표시되며 정보 공개가 막힌다. React 5건과 browser 4건이 같은 결함으로 실패했다. 테스트 단계에서는 production 코드를 수정하지 않았다. 통과한 순서·입력·모바일 회귀와 남은 검증 범위는 [현재 테스트 보고서](../testing/issue-220-q-test-results.md)에 기록했다.


### 2026-09-11 UI 재사용 후속 조사

추가 사용자 인수 피드백으로 [기존 UI 전면 조사](../plans/issue-220-ui-parity-audit.md), [후속 계획 v3](../plans/issue-220-custom-grimoire-plan-v3.md), spec 7.4를 작성했다. 위 Q0–Q5는 UI 재사용 완료를 뜻하지 않는다. 독립 준비 행, 자체 공개/범용 입력/자유 행동 탭/선택 흐름은 후속 교체 대상이며 QF1도 남아 있다. 제품 구현은 시작하지 않았다. 신규 UI는 사전 승인, R3는 기존 판단 기록·복원을 기존 custom Core/session 구조 안에서 연결하는 것으로 확정했다. 처형 결과 동선의 원본 대조와 전체 계획 승인은 남아 있다.
