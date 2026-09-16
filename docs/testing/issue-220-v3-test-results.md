# #220 v3 검증 결과 — 미통과

2026-09-11. `codex/issue-220`의 기존 미커밋 구현을 검증했다. 기준: spec v4 V01–V08, plan v3 T7, 기존 71개 수용 조건과 29개 action 대응표. 이번 test 단계에서는 제품 코드 결함을 수정하지 않았다. 테스트/검증 문서만 보강했다.

사용자용 [동시 인수 항목](issue-220-v3-acceptance.md). 최신 빌드 review 서버는 유지한다.

## 확정 결함

| ID | 영향·재현 | 원인 | 보호 검사 |
|---|---|---|---|
| V3-F1 | 세탁부/TB 숫자·점쟁이·직업 변경 등의 공개 시 React 실행 오류. official TB도 영향 | `shared-ui/RoleRevealContent.tsx`에서 return 뒤 `const CLOSE_LABEL` 선언이 실행되지 않아 TDZ 접근 | 기존 `troubleBrewingRevealScreen` 10건 및 신규 `issue220V3Reveal`의 실제 custom 공개 모두 실패 |
| V3-F2 | 변종 판단 기록 시 ‘이벤트 형식이 올바르지 않습니다’. 판단 저장/JSON/복원/Undo 후속 검증 불가 | Rust `boundary.rs::validate_custom_action_result_json`의 result whitelist에 `mutantJudgment` 누락 | 실제 Production WASM + app/session 저장 경로의 `V05` 실패. official artifact 제거한 격리 복사본에서도 같은 실패 |
| V3-F3 | web unit 검사가 컴파일에서 차단 | `core/informationPresentation.ts`의 shared helper import에 NodeNext 필수 `.js` 확장자 누락 | `pnpm --dir web test:unit` TS2835 |
| V3-F4 | 320/390px 악마 정보에서 속임수 이미지가 옆 카드를 덮어 선택 클릭 차단, 버튼 글자 세로 줄바꿈 | custom의 raw img에 원본 icon 크기 계약 미적용 및 customBluffGrid 모바일 override 잔존 | 실제 Chromium 두 폭 모두 다른 카드 이미지 pointer interception으로 실패, 화면 확인 |

테스트의 기대 결과를 현재 결함에 맞추어 바꾸지 않았다. 공개 성공과 판단 기록 성공의 assertion을 실패 상태로 유지한다. 기존 공식 공개 테스트만으로도 실제 오류가 검출되므로 별도 인위적 mutation을 추가하지 않았다.

## 테스트 설계와 기존 검사 정리

- V01: UI의 단일 공개 명령을 실제 controller→WASM→canonical 경로로 실행한다. 정상/중독 세탁부 모두 대상 수락 때 이벤트가 늘지 않고, 정보 공개 때 준비·전달이 연결되며, 최종 이벤트 2건과 Undo 후 전달 대기/비공개를 확인한다. Core만 실행하거나 제목만 검사하는 허점을 보완한다.
- V02/V03: 독살범은 result snapshot을 유지하고 다음 확인 전 공개하지 않는다. 세레노버스는 recipient notification을 통해 공개한 뒤 진행으로 돌아온다. 사건 수와 다음 직업도 확인해 ‘전부 진행으로 복귀’하는 잘못된 구현을 검출한다.
- V05: 변종 판단이 regular step을 이동시키지 않고 실제 JSON/reload/Undo를 통과해야 한다. 잘못된 직업에 madnessCheck를 넣으면 거부하며 canonical이 유지되어야 한다. 현재 성공 경로는 F2로 차단된다.
- V04: 실제 CustomReveal에서 세탁부 payload를 렌더링하고 대화상자·닫기·직업 정보를 확인한다. 공유 컴포넌트 import만으로 완료로 간주하지 않는다.
- 기존 `phaseOverviewLabel`의 ‘준비’ 접미사 기대를 승인된 단일 직업 표기로 수정했다. 획득/표시 정체 구분은 유지한다.
- 기존 twin history 검사의 임시 `state.reveal` 참조는 통지 경로 도입 후 undefined였다. 과거 실제 수신자 p1 포함·새 수신자 p2 제외를 검사하도록 바꾸어 원래 역사 불변 보호를 강화했다.
- 기존 React 준비 테스트는 마도서에서 대상 수락→진행에서 캐릭터 입력→정보 공개로 변경했다. 후보 누락 차단과 중독 정답 선택 보호는 유지한다. 수정 후 9/9 통과.
- 기존 fresh browser 사례를 `issue220-v3-acceptance.spec.ts`로 이동했다. 기존 BMR 악마 선택 aria 이름과 승인된 공개 닫기 이름으로 조작한다. 시나리오 신규 작성/배치부터 실제 저장 3개 사건과 다음 직업까지 검사한다.

## 실행 결과

| 검사 | 결과 |
|---|---|
| `cargo test --workspace` | 532 통과 |
| `pnpm --dir web test:custom` 초기 후 보강 전체 `vitest ... --maxWorkers=2` | 176 통과 / 1 실패(F2). 초기 병렬 실행 Spy timeout은 단독 및 제한 병렬 재실행에서 통과 |
| 신규 flow 파일 최종 | 4 통과 / 1 실패(F2). 전체 실행 이후 추가한 unrelated-input 거부 포함 |
| `pnpm --dir web test:unit` | F3으로 실행 차단 |
| `pnpm --dir web test:integration:run` 초기 | 579 통과 / 36 실패, unhandled errors 25. 구 준비 조작 3건 수정 후 전부 통과. 나머지는 공개 실행 오류/그에 따른 화면 부재. 전체 재실행은 결함 수정 후 필요 |
| focused UI 최종 | 정보 UI 9 통과, original reveal 10 및 custom reveal 1 실패(F1) |
| `pnpm test:custom-runtime` | Rust fixture 102, WASM fixture 13 통과 |
| custom dependency boundary + detector | 통과(10개 검출 검사) |
| `node scripts/verify-custom-runtime-isolation.mjs` | 격리 Rust/build 진행 후 custom V05에서 F2 재현, 미통과 |
| architecture / PWA | 통과 |
| integration/browser TypeScript | 최종 통과 |
| 새 배치 browser 320/390/820/1366 | 820/1366 기능 경로 통과, 320/390 F4 실패. 시각 동등성 전체 판정 아님 |
| `pnpm --dir web build` | 직전 implement 단계 동일 제품 코드에서 통과. test 단계 제품 소스 변경 없음 |

## 수용 조건별 범위와 공백

- V01/A01: controller 연결과 실제 새 배치 순서 확인. V01 전체(모든 다중 owner·재준비·중간 저장 실패 포함)는 아직 인수 완료 아님.
- V02/V03: controller 직접 결과·통지 경로 통과. 마도서 전체 상태별 원본 시각 대조는 미완료.
- V04/V06: 정보 입력 및 기존 Core 회귀 일부 통과, 공개 F1으로 미통과. 29개 직업/action 전체 UI 전수 대조 완료 아님.
- V05: F2로 미통과. 효과 불발·복원·Undo 전체 후속 인수 차단.
- V07/V08: BMR 전체 테마·모든 viewport·기기·키보드 상태 전수 인수 미완료. viewport 자동화와 실제 물리 기기를 구분한다.
- 기존 71개 조건을 모두 충족했다고 판정하지 않는다. F1/F2/F3/F4 수정 후 전체 unit/integration/browser 및 역할별 원본 대조를 다시 수행해야 한다. 기존 custom browser 파일의 나머지 구 UI locator 이전도 남아 있다.

## CI 연결

`.github/workflows/validate.yml`의 custom/test:web/browser 단계가 신규 파일을 기존 glob으로 수집한다. test:custom의 TS 컴파일, integration의 `test/**/*.test.tsx`, browser의 `test/browser`에 포함되므로 새 workflow 연결은 불필요하다. F1/F2/F3/F4은 CI 통과를 차단한다.

증거: [로그 디렉터리](issue-220-v3-evidence/). 검토 결과는 미통과이며 테스트 작업 완료와 기능 수용을 구분한다.

브라우저 증거: [320px 실패 화면](issue-220-v3-evidence/browser/issue220-v3-acceptance-V01-8a51a--demon-information-at-320px/test-failed-1.png). 강제 클릭으로 이미지 가림을 우회하지 않았다.
