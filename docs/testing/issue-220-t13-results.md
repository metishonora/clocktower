# #220 T13 구현·검증 결과

> 최신 승인·구현·인수 상태는 [최종 상태](issue-220-final-validation.md)를 따른다. 아래 과거 단계의 native confirm/배치 복귀 전체 제거/인수 대기 표현은 최신 기준으로 대체되었다.


2026-09-12. 승인된 action 의존 실행, 29개 action adapter, 새 시나리오, BMR Undo를 구현했다. [구현 기록](../implementation/issue-220-t13-implementation.md), [승인 plan](../plans/issue-220-t13-action-contracts-plan-draft.md), [계약표](../plans/issue-220-action-contract-matrix.md). 사용자 인수 승인은 별도다.

이슈 기록: [구현·검증 결과와 인수 항목](https://github.com/metishonora/clocktower/issues/220#issuecomment-5643342065).

## 실행 결과

| 명령 / 검사 | 결과 |
| --- | --- |
| `cargo test --workspace` | 538 통과: custom-domain147, custom-wasm6, domain381, wasm4 |
| `cargo test -p clocktower-custom-domain --features custom-runtime-fixtures` | 102 통과 |
| `pnpm build:wasm:custom-runtime` + `pnpm --dir web test:custom:fixtures` | fixture WASM 빌드 및 13 통과 |
| `pnpm --dir web test:custom` | 298 통과 / 43 파일 |
| `pnpm --dir web test:unit` | 166 통과 |
| `pnpm --dir web test:integration:run` | 780 통과 / 103 파일. 최종 재실행 37.36초 |
| 실제 production/reference Playwright, 320/390/820/1366px | 184개 서로 다른 검사 통과. 아래 파일별 내역 참조 |
| `pnpm --dir web exec tsc -p tsconfig.browser.json --noEmit` | 통과 |
| `pnpm --dir web check:architecture` | 통과 |
| `pnpm --dir web build` | official/custom WASM, TypeScript, Vite, PWA 생성 통과 |
| `pnpm --dir web verify:pwa` | 통과 |
| `git diff --check` | 통과 |

browser 명령은 `pnpm --dir web exec playwright test <아래 파일들> --workers=4`로 분리 실행했고 마지막 수학자/낮 전환 8개는 `--grep 'mathematician|R04 dawn' --workers=2`로 검사했다. Playwright가 한 명령 안에서 임시 preview를 관리했다. prototype DOM 주입으로 실행 흐름을 대체하지 않았다. 검증용 JSON은 실제 Core로 만든 확정 prefix이고 선택·입력·공개·Undo는 production 화면에서 실행했다. 원본 fixture도 canonical event prefix만 사용했다.

| browser 파일 (`web/test/browser/`) | 통과 수 | 실제 관찰 |
| --- | ---: | --- |
| `issue220-t13-production.spec.ts` | 16 | 쌍둥이 안내/공개/Undo, 붉은 청어→새 두 대상, 새 시나리오 취소/확정/저장, native Undo |
| `issue220-t13-action-inputs.spec.ts` | 36 | 낮 전환/Undo, 독살범·집사·마녀 직접 복귀, 뱀 조련사 두 정체 통지, 세레노버스 지정/안내/공개, 획득 주정뱅이/철학자·초공감자 |
| `issue220-t13-reference.spec.ts` | 60 | 실제 TB6/SnV9 직업의 입력/선택/숫자 공개 원본. 수학자 앞의 쌍둥이 안내도 실제 공개/닫기 후 진행 |
| `issue220-t10-production.spec.ts` | 40 | 세 정보 직업의 부분/전체 선택·공개, 중독 세탁부, 두 사서 소유자, 요리사 취급, 착각/점쟁이, 잠긴 첩자, SnV4 정보 직업 |
| `issue220-t10-reference.spec.ts` | 12 | 실제 TB 요리사·점쟁이·첩자 원본 |
| `issue220-t11-production.spec.ts` | 8 | 인원 보정 선택 강조/확정 로스터, 자유 변종 실제 처형/Undo/태그 |
| `issue220-t11-reference.spec.ts` | 4 | 실제 BMR 인원 보정 원본 |
| `issue220-t9-acceptance.spec.ts` | 4 | 직업 설명, 선택 위치/강조, 세레노버스 통지, 세탁부 실제 공개 |
| `issue220-v3-acceptance.spec.ts` | 4 | 빈 게임의 15명 설정/배치→하수인→악마. 사용자 시나리오 순서 유지 |

## P1–P6와 action별 근거

전수 공통 검사: `issue220T13Reachability` 29개 실제 도달성, `issue220T13Core` 43개 실행/source/호환 경계, `issue220T13ActionContracts` 43개 action별 공개·완료·선택·진행 행·등록 exact-set, `issue220T13Undo` 29개 suffix/저장/소유자/중간 사건 경계. 수용 조건 A01–A12는 위 공통 검사와 아래 해당 변형으로 추적한다. 각 R행을 하나의 UI 대표 검사로 대신하지 않는다.

| R | 구현 / 실제 UI 경로 | 적용 변형·추가 근거 / N/A |
| --- | --- | --- |
| R01 | system.dusk, 별도 UI 없음 | setup→하수인 직접 진입. 개별 선택·공개·Undo N/A: 자동 경계이며 독립 확인 사건 없음 |
| R02 | BMR 하수인 task/reveal | V3 새 게임 전체 동선·네 너비 수신자/닫기. 캐릭터 중독·취함/획득 N/A: system |
| R03 | BMR 악마 bluff/task/reveal | V3 후보/3개·모바일 공개. system 영향/획득 N/A |
| R04 | 낮 시작→day→native Undo | T13 action-inputs R04 네 너비. 공개/타깃 N/A, 다음 날 확장은 범위 밖 |
| R05 | TB 착각→점쟁이 새 마도서 선택 | T13 production, T10. 대상 혼용·부분 선택·Spy 합법성·과거 준비/재지정/Core Undo |
| R06 | TB 세탁부 2명→진행 정보 입력 | T10 중독 실제 browser, setup contract 정상/중독/주정뱅이/복수소유자, T13 저장 실패 |
| R07 | TB 사서 0명/2명→진행 정보 입력 | T10 두 사서 실제 browser; 0명·불법 조합·영향은 setup contract/Core. 원본 TB0명 화면도 비교 |
| R08 | TB 수사관 2명→진행 정보 입력 | T10 actual browser. setup contract 정상/영향/등록/불필요한 정답 입력 차단 |
| R09 | 원본 ShownCharacterField/AbilityIdentity | T13 R09 네 너비 실제 획득 후 선택. 원본에 획득한 주정뱅이 전용 runtime 없음: TB 표시 배역 view를 재사용하고 새 초기 배치 화면을 만들지 않음 |
| R10 | TB 독살범 마도서 확정→진행 | T13 R10 네 너비, 원본 TB 선택. 중독 effect/Core 회귀, 독자 다음 없음 |
| R11 | TB 집사 마도서 확정→진행 | T13 R11 네 너비, 원본 TB. 자기 자신 금지/Core 후보·취소 |
| R12 | SnV 뱀 조련사 선택/정체 변경 통지 | T13 R12 네 너비 교환2명 안내/공개/마도서, action contract 비교환/Core 정체·source |
| R13 | SnV 저주 대상 선택/저주 확정 | T13 R13 네 너비·원본 SnV, direct return·effect/취소 |
| R14 | SnV 쌍둥이 선택→마도서 안내 | T13 production 네 너비, 원본 중앙 prompt/CSS. 준비 저장/후속 실패·재지정·부분Undo |
| R15 | TB 세탁부 정보 공개 | R06+T10 공개 네 너비, T13 준비/전달1Undo·모든 prefix JSON·즉시 획득 |
| R16 | TB 사서 0명/2명 공개 | R07+T10 실제/주정뱅이 순차 공개, T13 소유자·옛 교차 준비/Undo |
| R17 | TB 수사관 정보 공개 | R08+T10 공개 네 너비, 영향/등록·저장실패·Undo |
| R18 | TB 요리사 취급/쌍 공개 | T10 browser/reference 네 너비. registration contract 선/악 조합, 실제/전달 값 |
| R19 | TB 초공감자 취급/명 공개 | T13 R19/reference 네 너비. 이웃/취급, 획득 지연은 독립 Undo |
| R20 | SnV 시계공 입력/칸 공개 | T10 mixed/reference 네 너비. 즉시 획득·원래 순서 전/후·source root Undo |
| R21 | SnV 수학자 감사/숫자 공개 | T10 mixed/reference 네 너비. 기존 감사 원인/시점 및 영향 규칙 회귀 |
| R22 | TB 두 대상/악마 취급/진행 공개 | T10 production/reference, T13 fresh selection 네 너비. 현재 준비/과거 참조·불법 조합·Undo |
| R23 | SnV 꿈꾸는 자 대상/선악 쌍/공개 | T10 mixed/reference 네 너비. 실제 직업 잠금·Core 후보·취소 |
| R24 | SnV 재봉사 사용/보류·두 대상·진영 공개 | T10 mixed/reference 네 너비. registration contract 취급조합·소모/보류 |
| R25 | SnV 철학자 선택/획득 능력 UI | T13 R25/reference 네 너비. 즉시·지연·미실행, 실패/보류, 모의 철학자→Chef 실제 부모 |
| R26 | SnV 세레노버스 마도서 지정→안내/공개 | T13 R26+T9 네 너비, 원본 SnV. 마지막 닫기 후 마도서, 독자 결과 화면 없음 |
| R27 | SnV 쌍둥이 실제 관계 공개 | T13 production 네 너비. source 검증·한Undo·JSON, 저장 재시도 후 비공개 안내, 과거 관계 참조 |
| R28 | SnV 자유 dock/첫 문장 확인/처형 | T11 production 네 너비. 독립 Undo·진행 중단·사망/토큰·정규 탭/행 없음 |
| R29 | TB 잠긴 마도서/좌석 토큰 상세/확인 완료 | T10 production/reference 네 너비. 15자리/utility 잠금·payload allowlist. 일반 숫자·대상 공개 N/A |

P4의 editor/sourceFile/starting/restoreId/요청 세대 및 저장 수명은 NewScenario7개, 기존 Application/Writer의 지연·실패 검사와 actual browser를 함께 사용한다. P5는 공유 BMR 버튼과 UndoUI4개, 실제 native dialog 취소/확정, 같은 event ID의 다른 내용 및 오래된 확인 거부를 검사한다. 개별 action에 의미 없는 중독/취함·선택·공개 화면은 새로 만들어 검사하지 않았다.

## 직접 화면 비교와 발견한 수정

실제 원본 route와 Custom route에서 캡처한 입력/선택/공개/복귀 화면을 열어 비교했다. 320/390/820/1366px의 기록을 보존한다. 정상 화면 외 규칙 조합 전체를 모든 실기기에서 실행했다는 의미는 아니다. Core/DOM 변형 검증과 네 viewport의 브라우저 검사, 시각 대조의 범위를 구분한다.

- 원본 SnV의 쌍둥이 중앙 `evilTwinCenterPrompt` 적용 누락으로 토큰이 안내를 덮는 문제를 고쳤다. 최신 320/1366 화면을 원본과 직접 대조하고 네 너비 class/z-index를 검사했다.
- 마녀/쌍둥이 진입 문구를 실제 원본과 동일하게 맞췄다. 320px 새 utility는 줄을 바꾸되 단어를 자르지 않는다.
- TB/SnV는 view/동선 기준, BMR은 theme/utility/Undo 기준이다. 원본의 script 경고와 다른 roster, 기존 원본의 모바일 overflow를 Custom에 복제하는 픽셀 동일성 검사가 아니다.
- 공개 카드는 좌석·캐릭터·숫자 단위/진영·닫기 버튼을 확인했다. 첩자는 단순 축소 그림 대신 실제 잠긴 마도서와 상세 열람을 검사했다. 전체 페이지 캡처의 viewport 바깥 배경은 실제 공개 카드 영역과 구분한다.

[실행 로그·화면 증거](issue-220-t13-evidence/implemented/)에 최종 결과를 보존했다. 과거 test 준비 Red는 상위 evidence에 그대로 남겼다. 재현에 필요한 테스트명/fixture 생성은 위 browser 파일에 있다.

최종 상태 대조에서 발견한 A05 표시 누락도 수정했다. Core가 interrupted로 구분한 이전 준비 실행을 진행 목록이 완료로 표시하던 부분이며, 실제 사건/Undo 범위에는 문제가 없었다. 실제 Core로 준비→독립 변종 판단→목록 중단→Undo 후 원래 행 복원을 검사하는 회귀를 추가해 Red를 확인하고 수정했다.

## 실패 분류와 정정

제품 결함은 의존 DTO/Undo/후속 저장 잠금/쌍둥이 CSS/원본 버튼 문구 등을 수정하고 동일 검사를 재실행했다. 준비 당시 TB의 즉시 획득 규칙을 놓친 기대값은 [근거 정정](issue-220-t13-test-preparation.md#구현-중-근거-정정--2026-09-12)을 따른다.

비동기 저장/화면 인계 전 assertion, native confirm 대기 순서, 원본 전용 접근성 이름, 수학자 앞에 남은 실제 쌍둥이 공개 안내 등 테스트 경로 오류를 정정했다. 원본 앞 단계를 우회하거나 결과값을 주입하지 않았다. 무거운 browser와 전체 integration 동시 실행 중 제한 시간에 걸린 검사는 시간 제한을 늘리지 않고 독립 실행으로 재검증했다.

## 사용자 인수 항목

리뷰: 리뷰 서버(검증 당시) → **Custom Scenario**. 기존 JSON 이어 쓰기와 새 작성 모두 가능하다. manager가 10220 preview를 유지하며 최신 index/JS/CSS가 디스크와 HTTP에서 바이트 일치함을 확인했다.

| 항목 | 해볼 행동 | 기대 결과 |
| --- | --- | --- |
| 첫 순서 | 작성에서 하수인/악마를 먼저 두고 배치 확정 | 해당 순서대로 시작, 준비 직업을 앞당기지 않음 |
| 쌍둥이 | 쌍둥이 선택→확정→공개→닫기→Undo | 중간 진행 왕복 없이 마도서 안내, 직접 공개, 마도서 복귀, Undo1회로 지정 전 |
| 점쟁이 | 착각 1명 지정→능력 두 대상 선택 | 자동으로 새 선택에 연결, 이전1명 미선택, 2명/취급 충족 전 확정 불가 |
| 세 정보 직업 | 세탁부/사서/수사관을 각각 대상 선택→공개/다음 | 준비/전달 별도 행 없음, 완료 후 Undo1회, 중독 시 불필요한 정답 입력 없음 |
| 두 사서 | 실제/주정뱅이 사서를 함께 진행 | 각 소유자의 선택→공개를 차례대로 완료 |
| 획득/중단 | 철학자로 즉시 능력 획득 또는 준비 중 자유 행동 | Core 의존 실행만 묶고 독립 자유 행동/다른 소유자는 묶지 않음 |
| 직접 선택/통지 | 독살범·집사·마녀, 세레노버스·정체 교환 | 전자는 직접 진행 복귀, 후자는 원본 마도서 안내/공개/마도서 복귀 |
| 새 시나리오 | 새 게임 옆 새 시나리오 취소/확정 | 취소 무변경, 확정은 빈 작성 첫 화면, 기존 저장 불러오기 가능 |
| Undo | 버튼 상태/한국어 요약·확인 취소/확정 | BMR 버튼/브라우저 확인창, 표시한 실행만 되돌림 |
| 모바일 회귀 | 보정 선택, 좌석 상세, 선택/공개 | 적용 보정 강조, 중복 상태 태그/배치복귀 없음, 선택 강조·팝업 위치·닫기 정상 |

인수 승인·병합·이슈 종료는 이 구현 기록에 포함하지 않는다.
