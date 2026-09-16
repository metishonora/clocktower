# #197 시나리오 JSON 저장·불러오기 — test 기록

## 기준과 판정

- 실행일: 2026-09-09
- 기준: [Intent](https://github.com/metishonora/clocktower/issues/197#issuecomment-5572531579), [Spec](https://github.com/metishonora/clocktower/issues/197#issuecomment-5594316985), [Plan](https://github.com/metishonora/clocktower/issues/197#issuecomment-5594817052).
- 승인 UI: `web/src/issue200FlowConcepts.NOTES.md`, `web/src/issue202Gate{1,3,4}Prototype.NOTES.md`.
- 검증 대상: `codex/issue-197`, 기준 HEAD `38a12cb23a4a1cbbe685930516a80a8c0502d31c` 위의 미커밋 구현과 아래 테스트.
- **최신 수용 판정: 통과(아래 보완 test 결과 기준).** 최초 test에서 발견한 UI 결함 2건은 보완 후 재검증으로 해소했다. 다음의 최초 실패 기록은 이력으로 보존하며, 기대값을 구현에 맞추거나 테스트를 skip하지 않았다.
- test 단계에서 Production 코드를 수정하지 않았다. 이 기록은 로컬 실행 결과이며 원격 CI 성공이나 PR 병합을 의미하지 않는다.

## 구현 결함

### 1. 기본 화면이 1440px로 강제됨

재현: 1366×900, 820×1180, 390×844에서 Production landing → `Custom Scenario 선택`.

기대: 화면이 해당 viewport에 맞고 페이지 수준 가로 넘침이 없다. #200 NOTES의 `넓게 보기`는 선택적인 프로토타입 검토 기능이다. Plan §5·§8은 승인된 모바일·iPad 동작을 유지하도록 한다.

실제: 세 크기 모두 `document.documentElement.scrollWidth`와 `.customScenarioSurface` 폭이 **1440**이다. 좁은 화면에서는 화면과 주요 조작이 가로 화면 밖으로 밀려난다. Playwright가 자동으로 스크롤해 버튼을 클릭할 수 있다는 것만으로 반응형 수용을 판단할 수 없다.

원인: `CustomScenarioEditor.tsx`가 루트에 `issue200JourneyWide`를 항상 지정한다. `scenarioEditor.css`의 `.issue200JourneyWide { min-width: 1440px; overflow-x: visible; }`가 실제 화면에 적용된다.

회귀 보호: `scenario-authoring.spec.ts`의 viewport별 `approved responsive editor fits …` 3개 검사. 각 실패에 screenshot·trace·실측 폭을 보존한다. 진입 화면에서 실패하므로 그 뒤 캐릭터 화면의 반응형 assertion까지는 실행되지 않았다.

### 2. 검색과 종류·출처 필터의 승인된 상호 배제 동작이 누락됨

재현: 새 시나리오 → 기본 `마을 주민` 탭 → 출처 `S&V` → 검색에 `imp` 입력.

기대: 검색이 종류·출처 필터를 해제해 TB의 악마 임프가 나온다. 다시 종류 또는 출처를 고르면 검색어가 지워진다. 근거는 #200 NOTES의 search/filter exclusivity 검증 기록과 Plan의 승인 캐릭터 선택 화면 유지 조건이다.

실제: 결과가 비어 임프를 선택할 수 없다. `CustomScenarioEditor.tsx`는 검색과 두 필터를 AND로 적용하고 각 setter만 전달한다. 필터 변경 시 검색을 지우는 처리도 없다.

회귀 보호: `scenario-authoring.spec.ts`의 `approved cross-kind search …`. 임프 표시 assertion에서 실제 실패한다. 뒤의 필터 선택·검색어 제거 assertion은 앞 실패로 미실행이며, 콜백의 누락은 코드에서도 확인했다.

## 테스트 설계와 수용 사례 연결

새 테스트는 실제 controller, 기존 definition parser, Production custom WASM validator를 사용한다. 첫날 밤 경계·행동 집합 등 도메인 규칙 행렬을 복제하지 않고 기존 도메인 검사를 재사용한다. 명시적으로 지정한 비기본 순서와 내보낼 JSON 전체가 독립적인 기대값이다.

| 수용 조건 또는 위험 | 검증 경계 | 결과 |
| --- | --- | --- |
| 새 작성·이름·선택 순서·행동 재배치·저장 | Production Chromium + 실제 다운로드 파일 전체 비교 | 통과 |
| IndexedDB가 없는 새 앱에서 같은 파일 복원 | 별도 browser context에서 다운로드한 bytes 입력, 전체 JSON 비교 | 통과 |
| 불러온 이름·풀·순서 수정 후 재저장 | controller + WASM, 브라우저 이름 수정·재다운로드 | 통과 |
| 풀 변경 시 살아남은 행동의 상대 순서 유지 | controller + WASM, 명시 순서와 비교 | 통과 |
| 권장 수 부족은 저장 허용, 잘못된 이름은 저장 차단 | 실제 validator를 쓰는 React 화면 및 Chromium | 통과 |
| 파일 kind·version·지원 필드·구조 오류 | controller 입력, 기존 draft의 객체 identity와 재저장 결과 | 통과 |
| 기존 validator가 거부한 행동 순서를 자동 보완하지 않음 | 누락 순서 import, 기존 성공 draft 보존 | 통과 |
| 저장은 현재 검증 성공 snapshot만 사용하고 재검증하지 않음 | validator 호출 수, 편집 직후 다운로드 금지, stale 성공 거부 | 통과 |
| 선택 취소·같은 파일 재선택·읽기 오류 | React file input 및 controller | 통과 |
| validator 초기화·기본안 조회·다운로드 실패와 재시도 | 실패 의존성 주입, 성공 피드백과 draft 상태 확인 | 통과 |
| 늦은 읽기·validator·기본안 결과가 최신 대상을 덮어쓰지 않음 | 제어 가능한 Promise + 실제 validator | 통과 |
| 반복 import는 새 identity, 기존 repository record·metadata 불변 | 실제 IndexedDB repository 전후 비교 | 통과 |
| 파일 작업이 기존 게임을 변경하지 않음 | TB checkpoint 로드 후 모든 IndexedDB store의 record 전후 비교; 실패·성공 import와 다운로드 포함 | 통과 |
| 파일 종류 혼동 | GameFile → scenario 거부, scenario → custom GameFile 거부 | 통과 |
| 다운로드 임시 요소·URL 정리 | 브라우저 어댑터 dispatch 예외와 timer 후 정리 | 통과 |
| 공식 TB·SnV·BMR 비회귀 | 기존 단위·통합·브라우저 검사 | 통과 |
| 반응형·승인 검색 UX | 실측 폭 및 사용자 검색 조작 | 미통과: 위 2건 |

추가 파일:

- `web/test/custom/scenarioAuthoring.integration.test.ts`: 파일·편집·검증·비동기·repository 계약.
- `web/test/custom/scenarioEditor.test.tsx`: 실제 controller와 UI의 저장 가능 여부, file input, 다운로드 cleanup.
- `web/test/browser/scenario-authoring.spec.ts`: Production 파일 왕복·게임 보존·승인 UI 회귀.

기존 테스트는 삭제하거나 기대값을 바꾸지 않았다. 초기 브라우저 검사에서 테스트 작성자가 영문 종류 탭 이름을 사용한 오류는 실제 한국어 접근성 이름으로 수정했다. 이 선택자 수정은 수용 기대값 변경이 아니다.

## 실행 결과

| 명령 | 결과 |
| --- | --- |
| `pnpm --dir web test:custom` | **28 files / 131 tests 통과** |
| `pnpm --dir web test:unit` | 166 tests 통과 |
| `pnpm --dir web test:integration:run` | 85 files / 605 tests 통과 |
| `pnpm --dir web check:architecture` | 통과 |
| `node scripts/check-custom-boundaries.mjs` | 통과 |
| `node --test scripts/check-custom-boundaries.test.mjs` | 10 tests 통과 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 공식 소스·artifact 없는 격리 환경의 custom Rust·WASM·TypeScript·UI·fixture 검사 통과 |
| `pnpm --dir web build` | 공식·custom WASM, TypeScript, Vite, PWA 생성 통과 |
| `pnpm --dir web verify:pwa` | 통과 |
| `pnpm --dir web test:browser:run` | **7 통과 / 4 실패**: 같은 폭 결함의 viewport 3개 + 검색 결함 1개 |
| `git diff --check` | 통과 |

`web test`의 단위·통합·architecture 구성 검사는 각각 실행했고 공식 WASM 생성은 build로 실행했다. 중복 실행을 위해 동일한 전체 wrapper를 다시 돌리지는 않았다. 격리 검사는 최초 127개 custom 검사 상태에서 실행했고, 이후 추가한 비동기·cleanup·repository 사례까지 최종 custom 131개 검사에서 확인했다. 격리 검사 이후 Production 소스 변경은 없다.

## 중요한 검사의 검출력

작업 소스를 변경하지 않는 별도 임시 복사본에서 baseline 통과 후 다음 결함을 주입했다.

- 성공 검증 결과의 최신 요청 확인 제거: `invalidates save immediately …`가 `expected invalid / received valid`로 실패.
- import의 최신 요청 확인 제거: `late import cannot replace …`가 최신 이름 `newer` 대신 오래된 파일 이름으로 덮어쓴 것을 검출해 실패.

둘 다 타입 오류·환경 오류가 아닌 지정한 사용자 데이터 계약 위반으로 실패했다. 임시 복사본은 검사 후 삭제했다.

## CI와 남은 공백

`.github/workflows/validate.yml`은 `pnpm --dir web test:custom`으로 Node·TSX 두 project를 수집한다. 새 TSX 검사가 최종 131개 안에 포함되는 것을 확인했다. 브라우저는 workflow의 `pnpm test:browser` → Production build → `web test:browser:run` → `test/browser/` 경로로 새 spec까지 수집한다. 누락된 CI 명령은 없어 workflow 변경이 필요하지 않았다. 현재 실패 4개를 그대로 유지했으므로 CI도 이 상태를 실패로 보고해야 한다.

실제 Chromium으로 검증했다. Safari/iOS 실기기, OS 파일 선택 대화상자 자체, 사용자의 디스크 저장 확정은 검사하지 않았다. 선택 취소는 파일 입력에 새 File이 전달되지 않는 경계에서 검증했다. 페이지 폭 결함을 수정한 뒤 모바일·iPad의 후속 캐릭터·순서·검토 화면의 스크롤 및 터치 동작을 다시 확인해야 한다.

서버는 Playwright가 소유한 명령 내 임시 preview만 사용했으며 실행 종료와 함께 정리됐다. 병합·이슈 종료·외부 게시·원격 CI 실행은 하지 않았다.

## 보완 implement 인계 — 2026-09-09

[Plan §10](https://github.com/metishonora/clocktower/issues/197#issuecomment-5594817052)에 따라 두 결함의 보완 코드를 반영했다. 위 test 결과는 보완 전 이력이며, 현재 코드의 수용 판정은 후속 test 대기 상태다.

- `CustomScenarioEditor.tsx`에서 항상 적용하던 `issue200JourneyWide`를 제거하고 Production CSS의 강제 폭·넓게 보기 전용 override를 삭제했다. 기존 모바일 검토의 단일 세로 스크롤 규칙은 유지한다.
- 좁은 화면 또는 coarse pointer에서 버튼·입력의 44px 최소 조작 영역을 적용했다. 캐릭터 요약 닫기 버튼의 grid 영역도 맞췄다.
- 같은 editor에 검색·종류·출처 전환 handler를 두었다. 비어 있지 않은 검색어는 종류·출처를 `all`로 바꾸고, 종류·출처 선택은 검색어를 비운다. 각 전환은 열린 요약을 닫는다.
- 화면의 표현 상태만 변경하며 파일 형식·controller·도메인 검증과 선택된 캐릭터 상태는 수정하지 않았다. 테스트 코드도 변경하지 않았다.

후속 test에서는 기존 실패 4개와 함께 전체 작성 흐름의 모바일·iPad 스크롤, 44px 조작 영역에 따른 목패 행 배치, 검색 양방향 전환·요약 닫힘·선택 유지, 파일 왕복을 확인한다. 보완 implement 단계에서는 테스트를 실행하지 않았다.

보완 후 `pnpm --dir web build`, `pnpm --dir web exec tsc -p tsconfig.custom.json --noEmit`, `node scripts/check-custom-boundaries.mjs`, `git diff --check`가 통과했다. 구현 완료이며 브라우저·회귀 테스트를 통한 수용 확인은 아직 수행하지 않았다.


## 보완 test 최종 결과 — 2026-09-09

**수용 판정: 통과.** Plan §10의 F·G를 반영한 미커밋 구현을 대상으로 기존 실패 4개를 동일한 기대값으로 재실행했다. 강제 폭·검색 동작 결함이 모두 해소되었고 아래 후속 화면 검증도 통과했다. Production 코드는 이번 test에서 수정하지 않았다.

### 보강한 회귀 보호

변경 파일은 `web/test/browser/scenario-authoring.spec.ts`다. 기존 검사를 삭제하거나 완화하지 않았다.

- 기존 1366×900·820×1180·390×844에 iPad 가로 1180×820을 추가했다. 진입 폭만 확인하던 검사를 캐릭터 선택 → 키보드 Enter로 행동 이동 → 검토 → 실제 다운로드 → 이전 단계 복귀까지 확장했다. 내보낸 순서를 독립적인 기대 배열과 비교한다.
- 1180px 이하의 이동 버튼에서 실제 bounds가 최소 44×44인지 확인한다. reduced motion을 적용한 경로도 사용하며 기존 일반 모션 파일 왕복 검사도 유지한다.
- 검색·종류·출처 양방향 전환, 열린 요약 닫힘, 선택 캐릭터 유지와 필터 조작 전후 다운로드 JSON의 일치를 확인한다. 표현 조작이 선택이나 행동 순서를 변형하는 결함을 보호한다.
- 390×844·820×1180에서 실제 화면으로 47개 캐릭터를 모두 선택한다. 마지막 밤 행동과 마지막 검토 캐릭터가 내부 스크롤로 접근 가능하며, 장 제목 위치가 유지되는지 확인한다. 전체 47개가 다운로드에 남는 것과 저장·이전 단계 버튼 접근도 확인한다.
- 모바일 밤 순서·최종 검토, iPad 검토 및 47개 목록의 저장 화면 screenshot을 직접 확인했다. 페이지 가로 넘침이 없고 조작이 화면 안에 배치된다.

기존 결함 검사는 보완 전 실제 구현에서 실패한 기록과 보완 후 통과를 모두 확보했다. 이번 UI 보완의 검출력 확인에는 그 재현을 사용했으며 동일 결함을 다시 주입하지 않았다. 파일·비동기 검사는 앞서 기록한 격리 mutation 결과를 유지한다.

### 실행 결과와 수용 조건

| 실행·조건 | 결과 |
| --- | --- |
| `pnpm --dir web test:browser:run` | **15/15 통과** — 공식 Production 5개와 시나리오 10개 |
| `pnpm --dir web test:custom` | **131/131 통과** — 파일 왕복·원자적 거부·stale 결과·저장 snapshot·repository·UI |
| `pnpm --dir web verify:pwa` | 통과 |
| `node scripts/check-custom-boundaries.mjs` | 통과 |
| `git diff --check` | 통과 |
| Production build·custom TypeScript | 직전 보완 implement에서 통과. 이후 Production 소스 변경 없음 |
| 반응형과 44px 이동 조작 | 네 viewport의 후속 작성·검토·저장·복귀 통과 |
| 검색 상호 배제·요약 닫힘·선택과 순서 보존 | 통과 |
| 새 앱 파일 복원·수정 재저장·기존 게임 보존 | 실제 Chromium 재검증 통과 |
| 긴 목록 스크롤·고정 제목·저장 접근 | 모바일·iPad 47개 전체 구성 통과 |

첫 custom 실행은 브라우저 검사와 동시에 수행했고 기존 `snvRuntime.test.ts` 한 건이 기본 5초 제한을 넘어 timeout됐다(나머지 130개 통과). assertion 실패는 없었다. 브라우저 종료 후 설정·코드·기대값·timeout을 바꾸지 않고 같은 전체 명령을 단독 재실행하여 131개 모두 통과했다. 부하에 따른 시간 제한 가능성은 있지만 단일 재실행만으로 원인을 확정하지 않는다.

`.github/workflows/validate.yml`의 `test:custom`, `pnpm test:browser` 수집 연결을 재확인했다. 추가 사례는 기존 `test/browser/`에 있어 별도 CI 변경이 필요 없다. 원격 CI 실행 결과를 주장하지 않는다.

이번 보완 범위는 UI 표현 상태와 CSS이므로 앞 단계에서 통과한 공식 단위 166개·통합 605개 및 Rust/WASM 격리 검사는 반복하지 않았다. 영향을 받는 custom 검사와 실제 공식·커스텀 브라우저 경로는 다시 실행했다.

남은 플랫폼 공백: Chromium의 viewport·키보드·reduced motion 및 DOM 조작으로 검증했으며 Safari/iOS 실기기 터치, OS 파일 선택창 자체와 실제 디스크 저장 확정은 미실행이다. Playwright의 임시 preview는 실행 종료 후 정리됐다. 현재 재현된 미해결 구현 결함은 없다.
