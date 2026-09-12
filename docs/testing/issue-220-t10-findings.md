# #220 T10 추가 인수 실패와 선행 회귀 검사

> 구현 후 결과는 [T10 검증 보고서](issue-220-t10-results.md)에 기록했다. 아래 내용은 수정 전 조사다. 특히 첩자 `revealMode` 참조는 실제 production 잠금 마도서 경로로 정정했으며 R29와 최신 보고서를 따른다.

> 후속: 변경된 test 스킬에 따른 보강·검토·최종 실행은 [테스트 준비 기록](issue-220-t10-test-preparation.md)을 기준으로 한다. 아래 9실패/9통과 및 2 browser 실패는 초기 조사 당시 결과다. 후속 검사에서 관련 직업/소유자/저장 경계를 넓혔으며, 문구·정확한 픽셀 일치만을 위한 검사는 직접 대조로 정정했다.

2026-09-11. 사용자의 추가 제보 10건을 접수하고 TB/BMR 원본 코드를 대조했다. 제품 코드는 변경하지 않았다. [계획](../plans/issue-220-custom-grimoire-plan-v3.md)의 T10과 [spec](../specs/issue-220-custom-grimoire.md)에 기준을 구체화했다.

## 이전 판정 정정

중독/취함 세탁부에서 정답 플레이어를 별도로 고르게 한 검사는 원본 TB UI의 계약을 검증하지 않았다. 원본 `TroubleBrewingSetupInformationEditor`와 `phaseInput`은 대상 두 명과 전달 캐릭터를 사용하며, 중독/취함에서 별도 정답 선택을 요구하지 않는다. 해당 기대값을 바로잡아 현재 구현이 실패하는 검사로 변경했다. 실제 전달 후보와 내부 사실/출처 보존은 별도 Core 계약이며, 내부 필드를 그대로 사용자 입력으로 노출할 근거가 아니다.

한 명 선택 직후 흐림, 불가능한 조합 수락, 동일 직업의 여러 소유자 흐름, Undo 설명을 빠뜨렸다. 컴포넌트 공유·클래스 존재·정상 한 경로의 클릭 성공을 UI 재사용 완료로 판단한 것이 반복 실패의 원인이다. 테스트를 먼저 만들더라도 새 구현을 정답으로 삼으면 이 문제를 막지 못하므로 원본 상태별 기대값을 먼저 고정한다.

## 접수·조사 결과

| ID | 문제 | 원본 근거 및 확인 | 수정 전 수용 기준 |
|---|---|---|---|
| T10-1 | 모바일 악마 공개 과대 표시 | 원본 `BmrEvilInformationReveal`는 64px medallion을 전달. custom은 제한 없는 img를 전달하며 320/390에서 400px로 측정됨 | 공개 아이콘·카드·닫기 버튼이 BMR 크기와 모바일 가용 폭을 지킴. 선택 화면의 34px와 공개의 64px를 구별 |
| T10-2 | 중독 세탁부 정답 플레이어 선택 | `CustomSetupInformationInputs`가 correctPlayers>1이면 상자를 노출. TB 원본에는 이 입력 없음 | 중독/취함에서는 두 대상과 전달할 직업으로 진행. 정답 플레이어 추가 입력 없음. 내부 사실/출처 계약 보존 |
| T10-3 | 두 명 선택 중 한 명만 고르면 나머지 흐림 | custom `ids.length>0`; TB `selectionComplete`에서만 settledOther 적용 | 한 명 선택 중 남은 유효 좌석 유지. 두 명 선택 완료/선택 취소/초기화의 원본 효과 |
| T10-4 | 은둔자 취급에 모든 직업 노출 | generic treatmentGroups가 등록 판단 JSON 변형들을 모두 나열. 사용자 답변에 따라 관련 직업 전체 조사 대상 | 요리사/공감능력자 등은 원본 선/악, 점쟁이는 악마 여부 등 해당 행동의 판정 단위만. 직업 정보의 기존 ‘보여줄 캐릭터’ 입력과 구별 |
| T10-5 | 사서의 불가능한 조합 수락 후 복귀 | custom은 인원수만 확인. TB `setupInfoSelectionCanComplete/IsComplete`는 유효 정보가 가능한 조합까지 검사 | 부분 선택의 후보와 최종 수락이 같은 Core 허용 조합을 사용. 불가능한 두 명은 진행 복귀 불가 |
| T10-6 | 실제 사서/주정뱅이 사서 준비가 공개와 분리 | 실제 WASM에서 p2 준비 뒤 공개 없이 p11 준비로 이동. controller의 준비+전달 연결이 ‘바로 다음 Core step이 같은 flow’일 때만 작동 | 각 소유자의 선택→필요 정보→공개가 하나의 사용자 흐름. occurrence/소유자/실제·표시 능력 출처를 보존하며 다른 소유자와 섞지 않음 |
| T10-7 | 요리사의 첩자 취급 UI 차이 | TB scalar editor는 ‘이번 판정의 첩자 취급’ 아래 선/악 두 버튼과 결과. custom은 범용 scope별 등록 목록·결과 선택 | 원본 필드 위치·선/악 의미·활성 상태. Core의 실제 계산 및 등록 출처 보존 |
| T10-8 | Undo 내부 변수 노출 | 실제 확인창에 `단계 확정: firstNight:cerenovus:assignMadness:owner3:p14:instance9:setup:p14` 노출 | 기존 Undo 단위 유지, 설명에는 사용자용 직업·행동·대상 요약. 파일 내부 식별자는 노출하지 않음 |
| T10-9 | 붉은 청어/점쟁이 실제 능력 UI 차이 | TB는 착각 지정/착각 좌석 표식을 구별. custom은 점쟁이 능력/선택으로 합침. `CustomStepInputs`의 점쟁이 대상·결과 경로도 원본과 다른 일반 분기를 사용 | 착각 지정과 실제 두 대상 판정 각각 원본 제목·선택·복귀·정보 입력·취급·공개 흐름을 비교 |
| T10-10 | 첩자 공개 차이 | 외곽 SpyGrimoireView는 공유하지만 custom은 별도 좌석 매핑/1180px shell/본문 표식 문자열을 사용. TB 원본의 +토큰 개수 badge 누락을 검사로 확인 | TB revealMode의 좌석/정체/표식/토큰 badge/폭/중앙 닫기 재사용. payload 외 비공개 상태 접근 금지 |

## 먼저 작성한 검사와 실행

- `issue220InformationUi.test.tsx`: 중독/취함 정답 선택 기대를 정정. 정상 입력·대상 전 숨김·공개·draft 유지 보호는 보존.
- `issue220T10Acceptance.test.tsx`: 첫 대상의 흐림, 사서 불가 조합, 실제 사서+주정뱅이 사서 순서, 실제 Undo dialog, 요리사 은둔자/첩자 취급, 붉은 청어 제목/좌석 표식, 첩자 토큰 badge.
- `issue220-t10-demon-reveal.spec.ts`: 새 게임→하수인→악마 정보 공개 후 실제 이미지 폭·캡처, 320/390px. 원본 BMR 64px+테두리 범위를 독립 기준으로 사용.

실행 결과: 집중 Vitest 18건 중 **9실패/9통과**, 모바일 browser **2실패**. 모두 사용자 동작 불일치가 관찰된 실패이며 기대값을 현재 구현에 맞춰 변경하지 않았다. integration/browser 타입 검사 및 diff check는 통과했다. 제품 수정 전 실패 증거이므로 추가 인위적 mutation은 하지 않았다.

[Vitest 로그](issue-220-t10-evidence/regressions.log), [모바일 로그](issue-220-t10-evidence/demon.log), [390px 악마 공개](issue-220-t10-evidence/browser/issue220-t10-demon-reveal--a885c--sized-bluff-icons-at-390px/demon-reveal.png).

CI의 기존 integration/browser glob에 포함된다. 지금 검사는 10항목 전체 시각 인수를 완성한 것은 아니다. 특히 은둔자 모든 정보 역할, 점쟁이 실제 능력의 전체 상태, 첩자 전체 시각 대조, 같은 역할의 여러 소유자에서 저장·복원·Undo까지의 보강이 더 필요하다. 이 보강과 T9 공개 실패를 함께 완료 기준에 두며 구현 완료나 전체 인수 통과로 표시하지 않는다.
