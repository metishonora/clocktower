# #220 테스트 결과

> 2026-09-11 후속 상태: 아래 결과는 당시 실행 경계에 한정한다. 이후 확인된 직업 확정·대상 선택·기록·공개 등 UI 결함과 추가 수용 조건은 [수정 계획 v2](../plans/issue-220-custom-grimoire-plan-v2.md)에서 추적한다. 이전의 “미해결 구현 결함 없음”은 현재 상태의 판정이 아니다.

후속 인수 피드백에 따른 UI 수정과 최신 집중 검증은 [UI 보정 기록](issue-220-ui-corrections.md)을 참조한다. 아래는 그 이전 테스트 단계의 기록이다.

2026-09-11. 승인된 Spec v3와 계획을 기준으로 테스트 작성·보강 및 실행을 완료했다. 이번 test 단계에서 Production 코드는 수정하지 않았다. 발견된 미해결 구현 결함은 없지만, 아래의 부분 검증 때문에 **45개 수용 조건 전체 완료로 판정하지 않는다**.

검증 상태: `codex/issue-220`, HEAD `e7d7c0f5568db54d29eb49aa897bfd4dc3c18ff9` 위의 미커밋 구현·테스트. 파일별 SHA-256은 [검증 상태 기록](issue-220-tested-files.json)에 보관한다. 기준은 [Spec v3](../specs/issue-220-custom-grimoire.md), 기대값과 위험 분석은 [테스트 설계](issue-220-test-design.md)를 참조한다.

원본 명령 출력은 `issue-220-logs/`에 보관했다.

## 실행 결과

| 명령 | 결과 |
| --- | --- |
| `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm` | domain 141 + WASM 6 통과 |
| `pnpm test:custom-runtime` | fixture Rust 102 + web 13 통과 |
| `pnpm --dir web test:custom` | 34 파일, 158개 통과 |
| `pnpm --dir web test:unit` | 166개 통과 |
| `pnpm --dir web test:integration:run` | 605개 중 603 통과, 2개 5초 시간 초과 |
| `pnpm --dir web exec vitest run test/sectsAndVioletsApp.test.tsx test/issue123NominationUndoWasm.test.tsx --maxWorkers=1` | 위 시간 초과가 발생한 두 파일 재실행: 36개 모두 통과 |
| `pnpm --dir web test:browser:run` | Production Chromium 23개 모두 통과 |
| `pnpm --dir web verify:pwa` | 통과 |
| `node scripts/check-custom-boundaries.mjs` / `pnpm --dir web check:architecture` / `git diff --check` | 통과 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 공식 소스/아티팩트 없는 Rust·WASM·custom·fixture 검사 모두 통과 |

공식 통합 검사 첫 실행은 브라우저/WASM 컴파일과 병행 중 두 시간 초과가 발생했다. 같은 테스트의 입력·기대값·제한 시간 변경 없이 단독 재실행이 통과했으며, 전체 605개를 한 번에 통과한 것으로 기록하지 않는다. Rust 전체 workspace 및 서버 관리자 테스트는 이번 변경의 집중 검사 대상이 아니므로 별도 실행하지 않았다. 웹 전체 build는 implement 단계에서 통과했으며 이번 단계에서는 Production 변경이 없다.

브라우저 포트 바인딩 및 격리 WASM 최적화가 샌드박스에서 제한되어 허용된 권한으로 재실행했다. 테스트 서버는 Playwright가 한 명령 안에서 생성·정리하는 임시 서버를 사용했다.

## 수용 조건별 판정

`통과`는 적힌 경계에서 기대 동작을 확인했다는 뜻이며 모든 조건을 실제 기기에서 검증했다는 뜻은 아니다. `부분`의 남은 조합/화면 경로를 생략하여 이슈 전체 완료를 선언하지 않는다.

| 조건 | 판정 | 증거 및 남은 공백 |
| --- | --- | --- |
| C01 | 통과 | 기존 authoring/browser: 새 작성·JSON 진입 |
| C02 | 통과 | authoring/browser + issue220Application: 직접 검토 이동 |
| C03 | 통과 | scenarioAuthoring.integration / scenarioEditor: 취소·읽기/검증 실패 보존 |
| C04 | 통과 | scenario-authoring browser: 실제 다운로드/재수입 및 저장 불변 |
| C05 | 통과 | 신규 browser 4개 너비 + Application: 빈 설정 진입, 기존 슬롯 보존 |
| C06 | 통과 | 신규 browser + Application/Setup: 실제 WASM Setup 확정 |
| C07 | 통과 | grimoireSetup + FirstNight + 기존 계약 검사: 후보·shown·분포·bluff 거부 |
| C08 | 부분 | 부족 경고에도 시나리오 저장 가능은 기존 editor 검사. 부족한 후보 시나리오의 실제 Setup 완료를 별도 종단 검사하지 않음 |
| C09 | 통과 | scenarioAuthoring.integration + Setup: 상대 순서 편집/확정 snapshot |
| C10 | 통과 | 신규 browser + Application: 실제 파일 재개/동일 사건 |
| C11 | 통과 | scriptIdentity의 전체 순서 포함 동일성 + Application/browser 이름 변경 재개 차단 |
| C12 | 통과 | Application/browser: 정확히 원복하면 재개 복구 |
| C13 | 통과 | Application + 기존 identity: 시나리오만 가져오면 재개 연결 없음 |
| C14 | 통과 | 기존 authoring 거부 검사 + 공식 production browser 복원 |
| C15 | 부분 | 5인 첫날 밤→Day 및 R11 종료, 기존 #209 전체 Core 규칙 통과. 모든 행동 입력 종류의 실제 화면 종단 조작은 미완료 |
| C16 | 통과 | FirstNight/Application/browser + 기존 roundTrip: 저장/reload/Undo/파일/과거 정보 |
| C17 | 통과 | Application + 기존 file/authoring: 잘못된 suffix·판독·검증 실패 전체 거부 |
| C18 | 통과 | Application/FirstNight: 손상·IO 실패 구분, 기존 저장 보존/재시도 |
| C19 | 통과 | Application + scenarioAuthoring.integration: 늦은 import/취소 결과 무시 |
| C20 | 부분 | 공식 browser 5개 경로 및 공식 슬롯 sentinel 불변, 격리 검사. 동일 브라우저에서 custom 전후 TB/SnV 전환 전체 순환은 별도 미실행 |
| C21 | 부분 | Chromium 320/390/820/1366px 실제 진행/공개 및 기존 편집 반응형 통과. 물리 iPad·모바일 터치·Safari와 전체 키보드 동선은 미검증 |
| C22 | 통과 | scenarioAuthoring.integration: 편집 직후 무효화/이전 검증 결과 거부 |
| C23 | 부분 | Setup/Application/browser 빈 actual roster와 인원 범위 검사. 정확히 25명 후보 입력의 전체 화면 경로는 미실행 |
| C24 | 통과 | grimoireSetup: 늦은 분포 결과 무시 |
| C25 | 통과 | Application: 첫 저장 실패→같은 수락 Setup 1건 재시도 |
| C26 | 통과 | FirstNight: 현재 진행/마지막 저장 분리, 같은 canonical 재저장 |
| C27 | 통과 | FirstNight/browser: 공개 중 확정 차단·배경 격리·가리기·동일 정보 다시 보기 |
| C28 | 통과 | FirstNight + 기존 Core 계약 + browser: 2개 거부/허용 3개 공개 |
| C29 | 부분 | R1 복수 소유자 및 R2 앞/뒤 순서 Controller 검사; R2 준비→전달→Undo 실제 browser 통과. R1 전체 실제 화면 조작 미실행 |
| C30 | 부분 | R4 재준비/Spy 과거 snapshot, R5 재지정/재통지 Controller 통과. 실제 화면의 각 입력 동선 및 옛 후보 선택 유지 후 거부는 별도 미실행 |
| C31 | 통과 | R11 Controller/browser: 선택 행동 종료→진행 차단→Undo |
| C32 | 부분 | Session의 오래된 제안 적용 거부 통과. 화면에서 선택을 유지한 채 외부 진행/Undo 후 확정하는 경로는 별도 미실행 |
| C33 | 통과 | Application/FirstNight: 정상 prefix 뒤 잘못된 사건 전체 거부/저장 보존 |
| C34 | 부분 | Application/browser/gameFileContract: ID·definition·사건·순서 왕복 통과. 사용자 지정 UI 좌석 배치의 실제 화면 왕복은 미실행 |
| C35 | 통과 | Application/scenarioEditor: 반복 시나리오 수입 새 identity |
| C36 | 통과 | 격리된 browser context의 실제 WASM 요청 차단/재시도 + Application 실패/늦은 import 검사 |
| C37 | 통과 | browser: 공개 중 reload 후 비공개 복원, Application/FirstNight 과거 snapshot |
| C38 | 통과 | FirstNight Day 정지 + browser 기존 Day 호환 파일 재개, 범위 밖 진행 입력 없음 |
| S1-a | 통과 | Application/Setup: 설정 편집 중 기존 슬롯 불변 |
| S1-b | 통과 | Application/browser: 유효 Setup 직접 확정/저장 |
| S1-c | 통과 | Application/Writer: 실패 시 기존 슬롯 보존, 동일 사건 재시도 |
| S1-d | 통과 | Application/Writer: 해당 슬롯 대체, 별도 공식 sentinel 유지 |
| S1-e | 부분 | 손상 슬롯 새 Setup 대체와 읽기 실패 보존 통과. 손상 슬롯에 유효 JSON 재개로 대체하는 조합은 별도 미실행 |
| S1-f | 통과 | Application: import 검토 불변→명시적 재개 시 가져온 기록으로 대체 |
| S1-g | 통과 | Writer: 지연된 이전 소유자/대기 요청/외부 기록 충돌 방지 + 결함 주입 검출 |

## 보강한 보호와 테스트 정리

- 새 Application 검사: 실제 custom WASM + IndexedDB API(fake-indexeddb)를 통과해 유효 Setup/명시적 재개 시에만 슬롯을 대체하고, 실패/검토 단계는 기존 저장을 보존한다.
- Writer 검사: 이전 owner의 실행 중/대기/늦은 저장과 다른 writer가 쓴 DB 상태를 구별한다. 메모리 화면만 검사하면 놓치는 실제 저장 기록을 관찰한다.
- FirstNight/MixedController 검사: 전달 전 공개·가리기·확정, 재시도 중복 방지, 당시 공개 snapshot, 폐기된 제안, 준비/능력 획득/복수 출처/종료/Undo를 검증한다. 기대값은 승인된 #209 입력과 명시적 좌석 배치에서 가져왔다.
- 브라우저 8개 추가: 4개 너비의 작성→설정→실제 첫날 밤→JSON 재개, WASM 실패/재시도, R2 획득 능력의 준비/전달, R11 종료/Undo, Day 호환 파일 경계. 기존 공식/편집 경로도 함께 실행했다.
- 기존 source 성공 중간 화면 및 기존 게임 교체 거부 검사는 Spec v3에서 폐기된 기대였다. 직접 검토 이동과 유효 확정 전 보존/확정 후 대체로 수정했다. 파일 취소·동일 파일 재선택 보호는 유지했다.
- 신규 테스트 작성 중 잘못된 R5 순서/대상, R11 한국어 이름, 전달 정보 locator를 독립 입력과 실제 접근성 이름으로 수정했다. WASM 실패 주입은 service worker가 요청을 우회하지 않도록 별도 context에서 차단하고 차단 요청 수를 확인한다. Production 결과에 맞추어 승인된 게임 기대값을 바꾸지 않았다.

## 검출력과 CI

별도 임시 복사본에서 저장 시 DB snapshot 비교를 제거했다. 외부 writer 충돌 검사가 “거부되어야 할 저장이 성공함”으로 실패했다. 원본 구현은 변경하지 않았다. [결함 주입 실행 기록](issue-220-writer-mutation.log).

`.github/workflows/validate.yml`은 custom-runtime, custom Vitest, 전체 web test, 경계 검사, 공식 아티팩트 없는 격리 검사, production browser를 이미 실행한다. 신규 파일은 `test/custom/**/*.test.ts` 및 browser testDir의 수집 대상에 포함된다. CI 연결 수정은 필요하지 않았다. 원격 CI 실행 성공을 뜻하지는 않는다.

## 남은 검증

표의 부분 조건(전체 행동 UI 종류, 복합 사례의 실제 화면 경로, 부족 후보/25명 후보/손상 슬롯 JSON 재개 조합, 사용자 지정 좌석 왕복)과 물리 iPad·모바일/Safari·전체 키보드 조작은 추가 수용 검증 대상이다. 자동화 결과만으로 #220 전체 완료 또는 병합 승인을 선언하지 않는다.

320px 첫날 밤, 공개 화면, R2 준비 후 공개, R11 종료의 최종 실행 화면은 `issue-220-evidence/`에 보관했다. 과거 prototype 서버의 소유권 미확인 상태는 implement 인계 기록 그대로이며 이번 임시 테스트 서버와 무관하다.
