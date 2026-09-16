# #220 T10 테스트 준비 — 변경된 test 스킬 적용

> 후속: [구현 기록](../implementation/issue-220-t10-fixes.md), [검증 결과](issue-220-t10-results.md). 아래 Red는 수정 전 증거로 유지한다. 첩자 원본 기준과 ‘읽기 전용’의 뜻은 실제 production 호출·캡처에 따라 후속 보고서에서 정정했다.

2026-09-11. **테스트 준비 완료. 기능 검증 완료 또는 인수 통과가 아니다.**

승인된 [spec](../specs/issue-220-custom-grimoire.md)의 T10/U05–U11/V01 및 [plan v3](../plans/issue-220-custom-grimoire-plan-v3.md)의 T9 공개 실패·T10 수정 단위를 대상으로 검사 작성, 기대값 검토, 예상 실패 확인을 수행했다. 이 단계에서 제품 코드는 수정하지 않았다. 기존 작업 중 변경은 보존했다.

최종 결과: integration **25 예상 실패 / 55 통과**, 관련 Core·session 회귀 **19 통과**, browser **4 예상 실패 / 2 통과**. 타입 검사와 diff check 통과. 수집·환경 오류를 최종 실패에 포함하지 않았다. 상세 로그와 JSON은 [evidence](issue-220-t10-evidence/pretest-integration.json)에 남긴다.

## 개발 단위와 검증 경계

| 개발 단위 | 근거 | 선행 검사와 현재 결과 |
| --- | --- | --- |
| T10-2 준비 입력 | TB `TroubleBrewingSetupInformationEditor`, spec T10: 대상 둘과 전달 직업으로 충분, 정답 플레이어 추가 질문 없음 | `issue220T10SetupContract`: 세탁부·사서·수사관 각각 정상/중독/주정뱅이. 실제 Play→좌석→입력→공개→확정. 정상 3 통과, 중독/취함 6 실패 |
| T10-3 부분 선택 | TB LiveGrimoire의 완료 전/후 좌석 표현, spec T10 | 같은 세 직업 각각 한 명→두 명→한 명으로 되돌림. 첫 명만 골라도 14좌석에 완료 후 흐림 상태가 붙는 3 실패. 다음 후보 조작 및 완료 버튼 상태도 검사 |
| T10-5 조합 유효성 | TB `phaseInput.setupInfoSelectionCanComplete/IsComplete`, spec U05/T10 | 세 직업 각각 불가능한 두 번째 자리 차단·오래된 draft의 최종 수락 거부 3 실패. 유효 조합·취소·재선택·확정 전 canonical 보존 3 통과 |
| T10-4/7 취급과 결과 | TB `TroubleBrewingScalarInformationEditor`, `teamTreatmentPresentation`, spec T10 | 요리사/공감능력자 × 첩자 선/악. 원본 선/악 버튼→숫자 공개→확정→실제 정체 보존·등록 근거 저장. 원본 판정 그룹 부재로 4 실패 |
| T10-4/9 점쟁이 | TB의 `issue85FortuneTellerRecluseRegistration` 실제 진행 검사 및 spec T10 | 붉은 청어를 먼저 지정하고 실제 두 대상 판정. 마도서에서 은둔자를 악마로 취급/아님을 결정하기 전 수락 차단, 복귀 후 결과만 표시, false/true 공개. 판정 그룹 부재로 2 실패. 원본 TB 회귀 9 통과 |
| T10-6 소유자별 한 흐름 | spec T10/V01: 실제·표시·획득 능력의 소유자/발생 출처 유지 | 세 직업 각각 실제 직업+같은 배역의 주정뱅이. 첫 소유자 준비 뒤 공개 및 JSON 재개에서 같은 소유자 작업 유지 3 실패. 첫 공개→두 번째 소유자의 선택·입력·공개·완료까지 테스트 본문에 작성 |
| T10-6 저장/Undo 경계 | spec S1/U10: 기존 저장 구조·canonical Undo 단위 보존 | `issue220T10RecoveryContract`: 위 세 직업의 준비 기록 자동 저장→슬롯 복원→JSON 복원→Undo→슬롯 재복원 3 통과. UI 실패와 독립 실행 |
| T10-8 Undo | spec U10/T10, 기존 확인창과 canonical 단위 | 실제 세레노버스 행동 뒤 확인창을 열어 역할 식별 가능한 요약, 내부 ID 미노출을 요구. 원시 식별자 때문에 1 실패. 취소 시 draft/기록 보존과 확정 시 마지막 사건만 제거되는 검사는 같은 실행에서 통과 |
| T10-10 첩자 | TB LiveGrimoire revealMode·PlayerTokenCountBadge·SpyGrimoireView, spec U08/T10 | 토큰 0/1/2개 및 같은 라벨의 두 토큰 개수. +1/+2 누락 1 실패. 당시 payload만 읽기, 7개 읽기 전용 좌석, 중앙 닫기, Storyteller 가림·포커스·정리·payload 불변 1 통과 |
| T10-1 모바일 악마 공개 | 기존 BMR evil reveal과 spec U11/T10 | 실제 작성→배치→하수인→악마 공개. 320/390px에서 이미지가 카드와 dialog 안에 들어가야 함. 양쪽 모두 400px 이미지 넘침으로 실패 |
| T9-F1–F3 직업 공개 | 원본 TB/SnV 역할별 공개와 BMR 가용 폭, spec U11 | 27개 공개 payload의 원본/커스텀 render 대조. DOM 공개/닫기·비공개 가림 27 통과. 4개 폭의 browser 검사 중 320/1366 실패, 390/820 통과 |

같은 공통 입력을 세탁부 한 사례로 대표하지 않았다. 준비 정보의 세 직업, 숫자 판정의 요리사/공감능력자, 별도 대상 판정인 점쟁이를 나눴다. SnV 꿈꾸는 자의 실제 직업 잠금/반대 진영 전달, 제약 숫자 0/제외값, 획득 세탁부 연결은 기존 `issue220InformationUi` 검사를 재사용했다. 원본마다 다른 정보 계약을 모두 TB 선/악 선택으로 통일하는 요구는 추가하지 않았다.

## 테스트 검토와 정정

- 현재 UI의 내부 필드를 정답으로 삼지 않는다. 중독/취함 ‘정답 플레이어’ 질문을 요구하던 기대는 철회한 상태를 유지했다. 정상 상태에서도 `inputDraft.correct` 저장 위치를 강제하던 검사를 제거하고 실제 공개/표식 결과로 검사한다.
- 실제 WASM·session·application controller를 사용한다. 입력 후보와 실행 결과를 mock으로 공급하지 않는다. fake IndexedDB는 저장 API 환경만 제공하고, navigation callback만 대체한다. 기존의 후보 계약 누락 검사 한 건은 장애 주입 목적의 mock이다.
- 테스트 입력은 고정된 독립 게임 예시에서 고른다. Core가 내놓은 첫 후보를 기대값으로 다시 사용하지 않는다. 요리사는 첩자 악 취급 3쌍/선 취급 1쌍, 공감능력자는 각각 1/0, 점쟁이는 악마·붉은 청어가 아닌 은둔자+시장을 대상으로 false/true를 구분한다.
- 요리사의 Core 인접 쌍별 등록 출처를 삭제하거나 실제 직업/진영을 변경하는 구현은 허용하지 않는다. 선으로 등록할 때 witness가 기록되는지 확인하며, 실제 정체와 같은 악 취급에는 불필요한 override를 강제하지 않는다. 기존 provenance 회귀도 유지한다.
- 소유자 테스트는 화면의 현재 인물·공개 payload·재개 동선을 검사한다. 공개 중 raw Core scheduler가 어느 행을 가리켜야 하는지는 고정하지 않는다. 저장 사건 구조·준비/전달 사건 분리·Undo 단위는 기존 계약 그대로다.
- Undo가 빈 문구로 바뀌어도 통과하지 않게 역할 이름을 요구한다. 취소/실행을 함께 확인한다. 첩자 토큰은 고정 +1을 추가한 구현이 통과하지 않도록 +2와 0개도 검사한다.
- 붉은 청어의 정확한 제목·좌석 문구만 확인하던 Red는 직접 원본 대조로 옮겼다. 행동 구분과 실제 점쟁이 조작은 별도 기능 검사로 남겼다.
- 공개 화면의 원본과 정확한 width/height/node 좌표 일치 요구를 제거했다. 원본 자체의 넘침을 복제할 이유가 없다. 자동 검사는 viewport 잘림·가로 넘침·실제 이미지 읽기로 한정하고, 원본 geometry/capture는 직접 대조 증거로 보존한다. 악마 이미지도 고정 68px 상한 대신 카드/dialog 내 포함을 기능 경계로 검사한다.
- 초안의 버튼 이름(`다음으로`/`다음 단계`) 및 Spy 외곽 접근자 오류는 테스트 설정 오류로 수정한 후 재실행했다. 이를 제품 실패로 집계하지 않는다.
- 현재 앞선 Red에 막혀 아직 실행되지 않는 후속 assertion이 있다. 복수 소유자 두 번째 공개 완료, 취급 선택 뒤 결과·확정/등록 witness 등이 해당한다. 구현 후 이 assertion까지 도달해 통과해야 하며 현재 통과했다고 보고하지 않는다.

## 실행 및 CI

workdir: `.worktrees/issue-220`, `codex/issue-220`. 사용자 인수용 manager 소유 review server의 기존 T9 build를 사용했다. 이 단계는 테스트/문서 변경이므로 제품 build를 다시 만들지 않았다. CI 및 구현 후 검증에서는 새 제품 build를 사용해야 한다.

```sh
pnpm --dir web exec vitest run \
  test/issue220T10SetupContract.test.tsx \
  test/issue220T10RegistrationContract.test.tsx \
  test/issue220T10Acceptance.test.tsx \
  test/issue220T10RecoveryContract.test.tsx \
  test/issue220InformationUi.test.tsx \
  test/issue220T9RevealMatrix.test.tsx \
  test/issue85FortuneTellerRecluseRegistration.test.tsx

pnpm --dir web exec vitest run --config vitest.custom.config.ts \
  test/custom/issue220V3Flows.test.ts \
  test/custom/issue220ScenarioOrder.test.ts \
  test/custom/issue209Provenance.test.ts \
  test/custom/issue209RoundTrip.test.ts

PLAYWRIGHT_BASE_URL=http://127.0.0.1:10220/clocktower/ \
  pnpm --dir web exec playwright test \
  test/browser/issue220-t9-reveal.spec.ts \
  test/browser/issue220-t10-demon-reveal.spec.ts --workers=2

pnpm --dir web exec tsc -p tsconfig.integration.json --noEmit
pnpm --dir web exec tsc -p tsconfig.browser.json --noEmit
git -c core.fsmonitor=false diff --check
```

최종 [integration 로그](issue-220-t10-evidence/pretest-integration.log), [Core/session 로그](issue-220-t10-evidence/pretest-contracts.log), [직업 공개 browser 로그](issue-220-t10-evidence/pretest-browser.log), [최종 악마 공개 로그](issue-220-t10-evidence/pretest-demon.log). 직업 공개 로그에 포함된 이전 고정 크기 악마 검사는 최종 악마 로그로 대체한다. 중복 실행은 결과 건수에 더하지 않는다.

`.github/workflows/validate.yml`의 `web test`→`test:integration:run`→`vitest.config.ts`가 새 `.test.tsx`를 수집한다. `test:custom`이 기존 순서/출처/복원 회귀를 실행한다. `pnpm test:browser`는 제품 build 후 `test:browser:run`의 `.spec.ts`를 수집한다. 별도 CI 우회나 skip은 추가하지 않았다. 필요한 동작이 아직 미구현이므로 현재 CI에 실행하면 선행 Red가 실패하는 것이 의도한 상태다.

## 구현 후 반드시 확인할 부분

1. 첫 대상/완성/선택 해제의 실제 강조 강도와 흐림, 데스크톱 선택 패널 위치 및 자동 진행 복귀를 BMR과 직접 대조한다. 상태 클래스 검사는 실제 색·명암·위치를 보장하지 않는다.
2. 320/390/820/1366px에서 모든 공개의 내용/닫기 접근을 확인한다. 현재 320px 세레노버스·정체 변경 good/evil은 viewport 밖으로 나가고, 1366px 쌍둥이는 제목·오른쪽 카드가 dialog를 넘친다. 모바일 악마 공개는 카드/이미지뿐 아니라 제목·첫 bluff·닫기의 스크롤 접근까지 직접 본다.
3. 붉은 청어 지정과 실제 점쟁이 대상 선택을 나눠 TB의 제목/좌석 표식/결과 표시/판정 변경/취소를 대조한다. 새 문구나 UI를 임의 추가하지 않는다.
4. 첩자의 실제/표시 정체, 사망·유령 투표·토큰 표시, 좌석 배치·외곽 폭·중앙 닫기를 TB와 직접 대조한다. 이번 renderer 검사는 canonical 생성 전체나 모든 상태의 시각 동등성을 뜻하지 않는다. 과거 payload의 현재 상태/비공개 출처 누출은 기존 round-trip 회귀로 보호한다.
5. [29행 원본 대응표](../plans/issue-220-ui-parity-audit.md)에 따라 관련 정보 역할 전체를 직접 확인한다. TB setup/scalar/점쟁이, SnV 시계공·꿈꾸는 자·재봉사·수학자 등의 서로 다른 결과·취급 형태를 구별한다. 27 공개 fixture는 role별 실제 Core 진입 E2E를 대신하지 않는다.
6. 복수 소유자 flow 수정 후 실제+주정뱅이 외 획득 능력도 이어서 실행하고, 준비/공개/확정 사이 JSON·자동 저장·Undo를 확인한다. 새 아키텍처나 사용자 동작 결정이 필요하면 기존 승인 범위로 간주하지 말고 구현 전에 질문한다.

이미 충족하는 저장/순서/출처 검사를 Red로 만들지 않았다. 이번 결과는 수정할 동작을 구현 전에 고정한 것이며, 구현 이후 예상 실패가 모두 통과하고 위 직접 확인까지 마쳐야 인수 통과를 판단한다.
