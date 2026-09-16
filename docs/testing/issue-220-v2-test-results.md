# #220 수정 v2 검증 결과

2026-09-11 · **검증 미통과** · 테스트 작성·실행 결과이며 사용자 인수 완료가 아니다.

기준: [승인 spec](../specs/issue-220-custom-grimoire.md), [승인 plan v2](../plans/issue-220-custom-grimoire-plan-v2.md), [57개 기대 결과](../plans/issue-220-reuse-traceability.md), [테스트 설계](issue-220-v2-test-design.md), [#209 독립 기대 결과](../acceptance/issue-209-mixed-first-night.md).

검증 대상은 `.worktrees/issue-220`, `codex/issue-220`, HEAD `e7d7c0f5568db54d29eb49aa897bfd4dc3c18ff9` 위의 미커밋 작업 상태다. 기존 구현과 이번 테스트 변경을 포함한다. 실제 소스 목록·해시는 [증거 디렉터리](issue-220-v2-evidence/source-manifest.sha256)에 보존한다. 커밋·병합·이슈 종료는 하지 않았다.

## 미해결 구현 결함

| ID | 재현 / 기대 / 실제 | 영향 및 근거 |
| --- | --- | --- |
| F1 | 숫자 입력 min=0, max=15, 제외 값=[1]에서 `12`를 타이핑. 기대 12, 실제 2 | `InformationNumberInput`이 유효하지 않은 중간 문자열 1을 즉시 지운다. custom/공유 TB 입력 영향. `issue220InformationUi.test.tsx`의 실제 controlled input + userEvent 회귀 실패. 0 허용, 제외값·소수 거부 검사는 통과. |
| F2 | 320px 첫날 밤 진행 헤더. 뒤로 버튼 오른쪽 96.984375px, 제목 왼쪽 90.703125px | 약 6.28px 겹침. 브라우저 bounding-box 검사와 실패 화면으로 확인. C21/U11 미충족. |
| F3 | fixture의 Clockmaker 출처 impairment가 있는 replay 응답 | 새 automaticReminders projection이 fixture 출처를 포함하지만 TS validator는 production character/token 조합만 허용하여 `WASM_LOAD_FAILED: 코어 응답 형식이 올바르지 않습니다.` 발생. runtime fixture 2건과 독립 격리 명령 실패. production 허용 목록을 넓혀 통과시키지 않았다. |
| F4 | 정상 Dreamer가 실제 Artist 대상을 선택 | 실제 캐릭터 후보 값은 맞고 Artist/Witch 공개 payload도 맞지만, 기존 SnV처럼 실제 후보 컨트롤이 잠기지 않는다. 공개 전 disabled 상태를 캡처해 검사하므로 제안 후 전체 disabled로 인한 거짓 통과를 방지했다. 현재 코드가 computedResult의 characterPair에서 actual을 찾지 못함. U07 세부 UI 계약 실패이며 잘못된 결과 전달까지 관찰한 것은 아니다. |

이번 단계에서 고친 구현 문제는 공식 unit 실행을 막던 공유 컴포넌트/phaseRuntime import의 `.js` 확장자 누락 3곳이다. 위 네 결함은 수정하지 않고 회귀 테스트와 재현 근거로 남겼다.

## 실행 결과

명령은 해당 worktree에서 실행했다. 로그는 `issue-220-v2-evidence/`에 보존했다.

| 명령 | 결과 |
| --- | --- |
| `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm` | domain 141 + WASM 6 통과 |
| `pnpm --dir web test:custom` | 36 files / 168 통과 |
| `pnpm --dir web test:unit` | import 수정 후 166 통과 |
| `pnpm --dir web test:integration:run` | 최종 87 files / 607 통과, 2 실패(F1/F4), 총 609 |
| `pnpm --dir web test:custom-runtime` | fixture 11 통과, 2 실패(F3); 선행 Rust/build 실행됨 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 공식 소스 없는 복사본의 production 검사는 통과, fixture 2건(F3) 때문에 명령 실패 |
| `pnpm --dir web exec playwright test` | 전체 실행 시 30 통과, 1 실패(F2). 이후 추가한 R0는 아래 집중 실행에서 통과 |
| `pnpm --dir web exec playwright test custom-grimoire.spec.ts -g "R0 full\|320px progress navigation" --workers=1` | R0 전체 15인 준비·전달·0 선택·첩자 payload 보드·Day 도달 통과, 320px 1건 실패(F2) |
| `pnpm --dir web build` | official/custom WASM, TypeScript, Vite, PWA 통과 |
| `node scripts/check-custom-boundaries.mjs` | 통과 |
| `pnpm --dir web check:architecture` | 통과 |
| `pnpm --dir web verify:pwa` | 통과 |
| `pnpm --dir web exec tsc -p tsconfig.browser.json --noEmit` | 통과 |
| `pnpm --dir web exec tsc -p tsconfig.integration.json --noEmit` | 통과 |
| `git -c core.fsmonitor=false diff --check` | 통과 |

브라우저 서버 바인딩과 WASM 빌드의 샌드박스 제한은 허용된 재실행으로 처리했다. 이는 제품 결함 건수에 포함하지 않는다. 원격 CI는 실행하지 않았다.

## 테스트 보강과 기존 검사 정리

- `issue220V2Contracts.test.ts`: 명시적 직업 확정과 잠금, 원래 Setup으로 배치 복귀, 저장 실패/재시도 시 이전 슬롯 및 단일 이벤트, 현재 제안 중 과거 공개/통지 보존, 대상 선택 최소·최대·취소·직접 행동의 확정 경계, 실제 SnakeCharmer 교환 뒤 원래 배역 복귀를 actual WASM + IndexedDB에서 검사한다. 5건 통과.
- `issue220InformationUi.test.tsx`: 실제 Dreamer 세션과 controlled 숫자 UI 검사. 통합 suite에 배치해 custom 도메인 격리 허용 목록을 확대하지 않았다.
- 브라우저 기존 저장/공개/왕복 보호를 유지하면서 명시적 직업 확정, 실제 마도서 대상 선택, 저장 유틸리티 기록, 확인 대화상자로 경로를 갱신했다. native disabled 기대는 설명 조회가 가능한 `data-selection-disabled` 계약으로 바꿨다. 이는 승인 U02/U03/U05/U10에 따른 갱신이다.
- 320/390/820/1366px에서 직업 조회·잠금·상세, 새 게임 취소, 불필요한 생존 표식 없음, 배치 복귀 취소·확인·reload를 추가했다. 공유 공식 TB/SnV/BMR 브라우저 회귀도 전체 실행에 포함했다.
- R0 새 테스트의 한국어 캐릭터 이름과 요리사의 등록 후보 선택 누락은 테스트 오류로 수정했다. Drunk 시계공의 열거형 숫자 입력은 실제 dropdown으로 선택하도록 수정했다. Core 독립 기대 숫자 3과 0을 바꾸지 않았다. 최종 R0 브라우저 검사는 첩자 15좌석·중독 표시·이야기꾼 shell 은닉 및 Day 도달까지 통과했다.

### 검출력 확인

저장소가 아닌 임시 복사본에서 두 mutant를 실행했다. (1) 확정 전 seating 차단을 제거하면 U02가 roles/seating 차이를 검출한다. (2) 과거 payload 공개 시 pending proposal을 지우면 U06/U08이 제안 소실을 검출한다. 둘 다 assertion failure로 종료했다. production 소스는 mutation하지 않았다. `220-mutation-roster.log`, `220-mutation-proposal.log`를 보존했다.

## 57개 수용 조건별 판정

통과는 표의 자동 검증 경계에서 기대 결과를 확인했다는 뜻이다. 부분은 일부 경계만 확인했으며 전체 조건 완료로 계산하지 않는다. 물리 기기/모든 상태 조합의 인수를 대체하지 않는다.

| 조건 | 판정 | 실행 근거 / 남은 경계 |
| --- | --- | --- |
| C01 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C02 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C03 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C04 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C05 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C06 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C07 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C08 | 부분 | 후보 수 경고와 유효 Setup 조합의 별도 끝단 증거 부족 |
| C09 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C10 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C11 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C12 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C13 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C14 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C15 | 부분 | #209 R0–R11/Core와 대표 UI 확인; 29개 전체 브라우저 경로는 미완료 |
| C16 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C17 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C18 | 부분 | 저장/읽기 실패 controller 검사 통과; 모든 실패 복구 UI 미실행 |
| C19 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C20 | 부분 | 공식 unit/integration/browser 통과; 모든 공식 저장/복원 조합 미실행 |
| C21 | 실패 | F2: 320px 헤더 겹침 |
| C22 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C23 | 부분 | 빈 roster와 인원 제한 확인; 명시적 25명 pool 끝단 조합 미실행 |
| C24 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C25 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C26 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C27 | 통과 | custom-grimoire 브라우저 + firstNight/controller; 공개/기록/Undo/종료 경계 |
| C28 | 통과 | custom-grimoire 브라우저 + firstNight/controller; 공개/기록/Undo/종료 경계 |
| C29 | 부분 | R1/R2 Core 및 획득 세탁부 UI 통과; 동시 여러 소유자 전체 UI 미실행 |
| C30 | 부분 | R4/R5 provenance/roundtrip 통과; 재준비·재통지 전체 브라우저 미실행 |
| C31 | 통과 | custom-grimoire 브라우저 + firstNight/controller; 공개/기록/Undo/종료 경계 |
| C32 | 부분 | stale controller 계약 통과; 같은 사건 수의 다른 prefix UI 조합 미실행 |
| C33 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C34 | 부분 | 파일 왕복 검사 통과; 모든 사용자 좌석 배치 UI 왕복 미실행 |
| C35 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C36 | 통과 | authoring/setup/application/custom WASM 회귀 및 관련 브라우저 |
| C37 | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| C38 | 통과 | custom-grimoire 브라우저 + firstNight/controller; 공개/기록/Undo/종료 경계 |
| S1-a | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| S1-b | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| S1-c | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| S1-d | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| S1-e | 부분 | 손상 슬롯/원자 대체 모델 확인; 복구 전체 UI 미실행 |
| S1-f | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| S1-g | 통과 | application/firstNight/writer/roundtrip 및 관련 브라우저; 저장·복원 경계 |
| U01 | 부분 | 취소/새 설정/슬롯 보존 확인; 모든 입력 타입의 취소 보존 미실행 |
| U02 | 통과 | issue220V2Contracts + 4 viewport 브라우저; 잠금/배치 복귀/저장 실패/교환 후 원래 Setup |
| U03 | 부분 | 비활성/확정 후 상세 대표 viewport 확인; 확정 전 모든 악마 상태 조합 미실행 |
| U04 | 부분 | 원래 Setup 및 실제 교환 controller 확인; 교환 후 전체 live UI 비교 미실행 |
| U05 | 부분 | 실제 보드 선택 및 controller 한계 확인; 모든 입력 타입 끝단 조합 미실행 |
| U06 | 부분 | 제안/과거 공개와 선택 controller 통과; 모든 입력/탭/상세 조합 미실행 |
| U07 | 실패 | F1/F4: 숫자 타이핑·실제 Dreamer 후보 잠금 |
| U08 | 부분 | prefix payload/공개 은닉 확인; 과거 첩자 전체 브라우저 재조회 미실행 |
| U09 | 부분 | 정상 생존 칩 제거 확인; 모든 자동 표식/출처/상태 UI 조합 미실행 |
| U10 | 통과 | custom-grimoire 브라우저 + firstNight/controller; 공개/기록/Undo/종료 경계 |
| U11 | 실패 | F2: 세부 배치 불일치; 전체 테마 상태 및 물리 Safari 미검증 |
| U12 | 통과 | issue220V2Contracts + 4 viewport 브라우저; 잠금/배치 복귀/저장 실패/교환 후 원래 Setup |

## 등록 행동 29개 추적

Core 열은 실제 custom production WASM의 snvRuntime / #209 mixed·provenance·roundtrip 회귀를 뜻한다. UI는 전체 행동 목록의 통과를 추론하지 않고 실제 조작 범위만 기록한다.

| 행동 | Core | UI 실행 범위 |
| --- | --- | --- |
| `system.dusk` | 통과 | Setup 진입으로 간접 실행 |
| `system.minionInfo` | 통과 | 브라우저 공개/가리기/확정 |
| `system.demonInfo` | 통과 | 브라우저 bluff/공개/확정 |
| `system.dawn` | 통과 | 기존 기본 시나리오 Day 전환 |
| `fortuneTeller.assignRedHerring` | 통과 | R0 브라우저 통과 |
| `washerwoman.prepareInformation` | 통과 | R0 및 R2 획득 능력 브라우저 |
| `librarian.prepareInformation` | 통과 | R0 브라우저 통과 |
| `investigator.prepareInformation` | 통과 | R0 브라우저 통과 |
| `drunk.assignShownCharacter` | 통과 | 설정/파일 재개; 독립 입력 UI 전체 미실행 |
| `washerwoman.learnTownsfolk` | 통과 | R0 및 R2 획득 능력 브라우저 |
| `librarian.learnOutsider` | 통과 | R0 브라우저 통과 |
| `investigator.learnMinion` | 통과 | R0 브라우저 통과 |
| `chef.learnEvilPairs` | 통과 | 기본 시나리오 및 R0 후보 선택 |
| `empath.learnEvilNeighbors` | 통과 | 기본 시나리오 및 R0 브라우저 통과 |
| `fortuneTeller.checkDemon` | 통과 | R0 브라우저 통과 |
| `poisoner.choosePoisonTarget` | 통과 | 기본 시나리오 및 보드/controller 확정 경계 |
| `butler.chooseMaster` | 통과 | R0 브라우저 통과 |
| `spy.inspectGrimoire` | 통과 | R0 브라우저 통과; 과거 Spy 브라우저 미실행 |
| `philosopher.chooseAbility` | 통과 | R2 능력 획득 브라우저 |
| `snakeCharmer.choosePlayer` | 통과 | 실제 교환 후 배치 복귀 controller; 브라우저 미실행 |
| `clockmaker.learnSteps` | 통과 | 기본 시나리오; Drunk R0 브라우저 통과 |
| `dreamer.learnCharacters` | 통과 | 실제 세션 React 통합 검사; 후보 잠금 F4 실패 |
| `seamstress.compareAlignments` | 통과 | 전용 브라우저 미실행 |
| `mathematician.learnCount` | 통과 | R0 브라우저 통과 |
| `evilTwin.learnTwin` | 통과 | controller 통지/제안 보존; 전체 브라우저 미실행 |
| `evilTwin.assignTwin` | 통과 | R11 브라우저 |
| `mutant.resolveMadnessExecution` | 통과 | R11 종료/Undo 브라우저 |
| `witch.chooseCursedPlayer` | 통과 | 전용 브라우저 미실행 |
| `cerenovus.assignMadness` | 통과 | 전용 브라우저 미실행 |

## CI와 남은 검증

`.github/workflows/validate.yml`은 custom-runtime, custom, web unit/integration, 격리 검사, browser를 실행한다. 신규 controller는 custom glob, 신규 React 검사는 기본 integration glob, 브라우저는 기존 browser glob에 수집된다. CI 연결 변경은 불필요하다. 현재 상태는 F1–F4 때문에 CI 통과를 기대할 수 없다.

전체 workspace의 공식 Rust test, 물리 iPad/iPhone Safari와 실제 터치/키보드, 모든 공개·기록·낮·상세의 viewport/theme 조합은 이번 실행에서 완료하지 않았다. 위 부분 판정은 수정 후에도 별도 검증이 필요하다. 서버 manager 자체 변경은 이번 test 범위에 없으며 manager 전용 수명주기 검사는 실행하지 않았다.

검토 서버는 운영자가 running/verified/keep 상태와 최종 dist의 JS/CSS HTTP 200 및 본문 일치를 확인했다. [검토 서버](리뷰 서버(검증 당시))를 유지한다. 제공 상태 확인은 사용자 인수 통과가 아니다.

## 실행 후 사용자 실제 진행 제보

사용자가 15인 배치 직후 하수인 정보 대신 세탁부 준비가 뜬다고 확인했다. 위 R0 검사는 초기 준비를 먼저 처리한 경로이며 이 첫 화면 기대를 검증하지 않았다. 첨부 화면에는 기존 TB와 다른 정답 플레이어/등록 폼도 남아 있다. 이 제보를 이유로 당시 실행 로그를 고치지는 않으며, [plan v2 9절](../plans/issue-220-custom-grimoire-plan-v2.md#9-2026-09-11-실제-진행-피드백과-test-이후-후속-계획)에 수정/재검증 범위를 추가했다. S3는 사용자 첨부 JSON의 명시 순서 이행으로 정정했다. 해당 파일의 하수인→악마→독살범→세레노버스→세탁부 순서로 실제 새 게임을 시작해 C06/C15/C27/U07/U11을 다시 확인해야 한다.
