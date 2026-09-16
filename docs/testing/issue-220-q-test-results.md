# #220 Q0–Q5 후속 검증 결과

2026-09-11 · **검증 미통과**. 테스트 작성·갱신·실행을 완료했으며 제품 인수 완료는 아니다.

대상: `.worktrees/issue-220`, `codex/issue-220`, HEAD `e7d7c0f5568db54d29eb49aa897bfd4dc3c18ff9` 위의 미커밋 구현. 이 test 단계에서 production 코드는 수정하지 않았다. 실제 소스/테스트 및 생성 WASM 해시는 [manifest](issue-220-q-evidence/source-manifest.sha256)에 보존한다. 커밋·병합·이슈 종료는 하지 않았다.

기준: [spec](../specs/issue-220-custom-grimoire.md), [plan Q0–Q6](../plans/issue-220-custom-grimoire-plan-v2.md), [63개 조건](../plans/issue-220-reuse-traceability.md), [테스트 설계](issue-220-v2-test-design.md). 이전 [v2 실패 기록](issue-220-v2-test-results.md)은 당시 증거로 유지한다.

## 남은 구현 결함 QF1 — 준비형 정보 전달 UI 차단

**재현:** 세탁부·사서·수사관의 `prepareInformation`을 정상 확정한다. 정상 세탁부, 중독 세탁부, 철학자 획득 세탁부에서도 재현된다. Core의 다음 행동은 `learnTownsfolk`/`learnOutsider`/`learnMinion`이며 해당 전달 proposal은 성공한다. 그러나 `CustomNightTask`는 “전달 정보가 연결되지 않았습니다.”를 표시하고 공개 버튼이 없다.

**원인:** `taskPresentationModel`은 `actionCause.kind === 'delivery'`의 `preparationEventId`로만 준비된 결과를 찾는다. 현재 실제 정규 전달 occurrence에는 이 전제가 성립하지 않아 result가 없고, 새 필수 계약 차단 분기로 들어간다. handler의 준비/전달 사실과 UI 어댑터의 입력 계약을 맞춰야 한다. 단순히 오류/차단을 제거해 통과시킬 문제가 아니다.

**영향:** 사용자는 준비를 완료해도 첫날 밤 진행을 이어갈 수 없다. 정상/중독/획득 세탁부 및 사서/수사관의 React 회귀 5건 실패. R0, R2, 사용자 시나리오 320/820px 브라우저 4건에서 같은 결함을 확인했다. Core 검사 통과를 UI 통과로 대체하지 않았다.

증거: [React 전체 로그](issue-220-q-evidence/integration-final.log), [사용자 경로 로그](issue-220-q-evidence/browser-user-final.log), [320px 최종 화면](issue-220-q-evidence/browser-user/custom-grimoire-A01-A04-up-c07a7-es-board-preparation-at-320/test-failed-1.png), [trace](issue-220-q-evidence/browser-user/custom-grimoire-A01-A04-up-c07a7-es-board-preparation-at-320/trace.zip). 구현 결함은 수정하지 않고 다음 구현 대상으로 남긴다.

## 이전 결함 재검증

| 항목 | 결과 |
| --- | --- |
| 사용자 최초 순서 | 실제 JSON 업로드→새 마도서→15인 배역·좌석 확정→하수인→악마→독살범 통과. 단순 준비 prefix 가져오기만으로 판정하지 않았다. |
| F1 숫자 편집 | 제외값 1을 거쳐 12 입력, 0 허용, 제외값/소수 미전달 통과. |
| F2 320px 헤더 | 실제 Chromium 뒤로/제목/시간 좌표 비교 통과. 최종 실패 화면에서도 헤더 겹침 없음. |
| F3 fixture 표식 | fixture Rust 102건, WASM/TS 13건 및 공식 소스 없는 격리 실행 통과. |
| F4 Dreamer 잠금 | 정상 Artist 후보가 공개 전 잠기고 Artist/Witch payload가 전달되는 실제 세션 UI 검사 통과. 모든 재량/등록 조합까지 확인한 것은 아님. |

## 실행 명령과 결과

작업 디렉터리는 해당 worktree다. [로그 디렉터리](issue-220-q-evidence/).

| 명령 | 결과 |
| --- | --- |
| `cargo test --workspace` | custom domain 141 + custom WASM 6 + official domain 381 + official WASM 4 = 532 통과 |
| `pnpm --dir web test:custom` | 37 files / 173 통과 |
| `pnpm --dir web exec vitest run --config vitest.custom.config.ts test/custom/issue220ScenarioOrder.test.ts` | 최종 보강 5건 통과; A02의 시스템 상대 순서 변경 포함 |
| `pnpm --dir web test:unit` | 166 통과 |
| `pnpm --dir web test:integration:run` | 87 files / 615건 중 610 통과, 5 실패(QF1) |
| `pnpm test:custom-runtime` | fixture Rust 102 + TS/WASM 13 통과 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 공식 소스·WASM 부재에서 custom Rust/WASM/카탈로그/설정/저장/fixture 회귀 통과 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:10220/clocktower/ pnpm --dir web exec playwright test --workers=3` | 초기 전체 34건: 30 통과, 4 실패. 2개 신규 사용자 경로의 광기 공개 조작 누락을 고친 후 같은 2건이 실제 QF1에서 실패함을 재확인 |
| 같은 브라우저 명령의 `-g 'fresh 15-player'` | 실제 새 15인 설정 1건 통과. 총 실행한 서로 다른 35건의 최종 판정: 31 통과 / 4 실패 |
| `pnpm --dir web build` | official/custom WASM, TypeScript, Vite, PWA 통과 |
| custom boundary, web architecture, PWA, browser/integration TypeScript, `git diff --check` | 통과 |

공식 Rust의 최초 컴파일, wasm-opt와 Chromium 실행의 환경 제한은 허용된 실행으로 처리했다. 원격 CI는 실행하지 않았다. fixture/격리 실행은 해당 호출 시작 시점의 테스트 복사본을 사용했고 이후 추가한 모호한 정답 검사는 최종 custom 173건과 격리 mutation에서 별도로 확인했다.

## 테스트 정리·보강 근거

- **새 순서와 옛 파일 분리:** 기존 새 게임의 전역 초기 준비 기대를 각 linked action 시점으로 옮겼다. 하수인/악마, 초기·획득 점쟁이, 쌍둥이, 사서 0명/보르톡스, TB 전체 진행의 실제 규칙 기대값과 출처 검사는 유지했다.
- **구 파일 회귀 보호 유지:** 이전 Spy 공개 전에 준비를 한 회복 사례는 구 선행 준비 saved-prefix fixture로 명시했다. 당시 No Dashii로 중독된 세탁부의 거짓 준비가 유효하다는 기존 독립 규칙을 유지하며 새 명령으로 조기 준비를 허용하지 않는다. 오래된 테스트를 삭제하거나 현재 결과에 맞춰 참/거짓 기대를 바꾸지 않았다.
- **순서만 검사하던 허점 보강:** 사용자 JSON의 실제 15인 Setup과 공개·확정, 마도서에서 두 자리 선택, 고유/모호 정답 표식, 준비 후 실제 전달 화면까지 검사한다. 준비된 다음 step 이름만 맞아도 통과하던 검사에 버튼/오류 상태를 추가해 QF1을 검출했다.
- **누락 계약:** 필수 준비 후보를 제거한 입력은 명시 오류와 확인 차단, canonical 보존을 검사한다. valid projection 복구 후 미완성 입력은 여전히 확인 불가여야 한다.
- **테스트 자체 수정:** RTL에 없는 `exact`, jest-dom matcher 사용과 jsdom의 URL 변환을 바로잡았다. 세레노버스의 정상 공개·가리기·확정 조작을 추가했다. 이들은 제품 결함으로 세지 않는다.
- **격리/CI 데이터:** 사용자 JSON 복사본을 `fixtures/acceptance/custom-first-night/issue220/user-scenario.json`에 두어 기존 격리 스크립트의 복사 경계에 포함했다. 원본 첨부 증거와 내용이 같다.

### 검출력

임시 복사본에서 `normalizeSetupDraft`가 모호한 정답의 첫 후보를 자동 선택하도록 변이시켰다. 정상 소스의 “A04 ambiguity” 검사는 통과하고 변이에서는 `expected '' / received p6`로 실패했다. 원본 production은 변경하지 않았다. [mutation 로그](issue-220-q-evidence/mutation-correct-marker.log). QF1은 실제 잘못된 구현이 React·브라우저 양쪽에서 이미 실패하므로 별도 가짜 결함으로 대체하지 않았다.

## 63개 수용 조건별 판정

통과는 명시된 자동 검사 경계 내 판정이다. 부분은 전 범위 수용 완료가 아니다. 이전 공백을 이번 대표 사례로 자동 해소하지 않았다.

| 조건 | 판정 | 근거/남은 경계 |
| --- | --- | --- |
| C01 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C02 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C03 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C04 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C05 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C06 | 통과 | 실제 사용자 JSON으로 15인 역할/무작위 배치/Setup 확정 후 시스템 정보 순서 통과. |
| C07 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C08 | 부분 | 기존 부분 범위 유지. 후보 수 경고와 유효 Setup 조합의 별도 끝단 증거 부족 |
| C09 | 통과 | authoring 회귀 및 같은 pool/roster의 독살범→악마→하수인 순서 실행 통과. |
| C10 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C11 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C12 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C13 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C14 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C15 | 실패 | QF1: 세탁부/사서/수사관 준비 후 UI 전달 차단. Core 실행 성공만으로 전체 연결 통과 불가. |
| C16 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C17 | 부분 | 누락 계약 UI 차단·canonical 보존과 Core 응답 실패 회귀 통과. 모든 복구 UI 조합은 미실행. |
| C18 | 부분 | 기존 부분 범위 유지.  모든 실패 복구 UI 미실행 |
| C19 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C20 | 부분 | 기존 부분 범위 유지.  모든 공식 저장/복원 조합 미실행 |
| C21 | 통과 | 320/390/820/1366 기존 브라우저 회귀와 320 헤더 좌표 검사 통과. 물리 Safari 미실행. |
| C22 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C23 | 부분 | 기존 부분 범위 유지.  명시적 25명 pool 끝단 조합 미실행 |
| C24 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C25 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C26 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C27 | 실패 | 시스템 공개·가리기·확정은 통과. 준비형 정보에서 QF1로 전체 첫날 밤 진행 불가. |
| C28 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C29 | 실패 | 다중/획득 출처 Core·저장 검사는 통과하지만 획득 세탁부 UI 전달은 QF1로 실패. |
| C30 | 부분 | 구 선행 준비 prefix의 회복·Spy 당시 공개·인과적 Undo Core 검사 통과. 재준비 전체 UI는 미완료. |
| C31 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C32 | 부분 | 기존 부분 범위 유지.  같은 사건 수의 다른 prefix UI 조합 미실행 |
| C33 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C34 | 부분 | 기존 부분 범위 유지.  모든 사용자 좌석 배치 UI 왕복 미실행 |
| C35 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C36 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C37 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| C38 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-a | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-b | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-c | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-d | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-e | 부분 | 기존 부분 범위 유지.  복구 전체 UI 미실행 |
| S1-f | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| S1-g | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| U01 | 부분 | 기존 부분 범위 유지.  모든 입력 타입의 취소 보존 미실행 |
| U02 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| U03 | 부분 | 기존 부분 범위 유지.  확정 전 모든 악마 상태 조합 미실행 |
| U04 | 부분 | 기존 부분 범위 유지.  교환 후 전체 live UI 비교 미실행 |
| U05 | 실패 | 실제 보드 대상/캐릭터/유일·모호 정답 선택은 통과하나 준비→전달 전체 연결 QF1 실패. |
| U06 | 부분 | 기존 부분 범위 유지.  모든 입력/탭/상세 조합 미실행 |
| U07 | 실패 | F1/F4 해결 확인. 세탁부 정상/중독·획득 및 사서/수사관 전달 연결 QF1 실패. |
| U08 | 부분 | 기존 부분 범위 유지.  과거 첩자 전체 브라우저 재조회 미실행 |
| U09 | 부분 | 기존 부분 범위 유지.  모든 자동 표식/출처/상태 UI 조합 미실행 |
| U10 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| U11 | 실패 | F2 헤더 겹침은 해결. 준비 후 기존 정보 화면 자체가 나오지 않아 전체 세부 UI 충족 실패. |
| U12 | 통과 | 이번 custom/Rust/공식 unit·integration/브라우저 관련 회귀 통과. 자동 검사 경계 내 판정. |
| A01 | 통과 | 사용자 JSON으로 실제 새 15인 설정→하수인→악마 공개·확정→독살범 브라우저 통과. |
| A02 | 부분 | 동일 pool/roster에서 독살범·악마·하수인 상대 순서 변경을 실제 WASM 명령으로 확인. 변경 순서의 전체 브라우저는 미실행. |
| A03 | 실패 | Core 획득/다중 출처·저장 회귀 통과, 획득 세탁부 UI 전달 QF1 실패. |
| A04 | 실패 | 관련 두 자리·유일 정답 자동 연결·중독 명시 정답·표식까지 통과. 준비된 정보 공개 UI QF1 실패. |
| A05 | 통과 | 새 prefix 저장/reload/Undo/JSON 및 구 유효 초기 준비 prefix·이전 Spy payload·잘못된 출처 거부 확인. 실제 사용자 GameFile은 제공되지 않음. |
| A06 | 부분 | 누락 입력 계약 UI 차단/canonical 보존/유효 계약 복구, 기존 WASM 로드 실패 재시도 통과. 모든 잘못된 응답/현재 제안 조합 미실행. |

## 등록 행동 29개

Core는 현재 custom production 회귀 및 29개 registry 계약이 통과했다. UI는 실제 실행 범위만 기록한다.

| 행동 | Core | 현재 UI 경계 |
| --- | --- | --- |
| `system.dusk` | 통과 | 새 Setup 진입으로 간접 확인 |
| `system.minionInfo` | 통과 | 실제 새 15인/대표 viewport 공개·가리기·확정 통과 |
| `system.demonInfo` | 통과 | bluff 선택·공개·확정 통과 |
| `system.dawn` | 통과 | 새 R0 UI 도달은 QF1에 막힘. Day 저장 파일 재개 통과 |
| `fortuneTeller.assignRedHerring` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `washerwoman.prepareInformation` | 통과 | 원래 정상/중독·획득 준비와 정답 표식까지 통과 |
| `librarian.prepareInformation` | 통과 | Core/React fixture의 준비 확정 통과; 브라우저 전체 미완료 |
| `investigator.prepareInformation` | 통과 | Core/React fixture의 준비 확정 통과; 브라우저 전체 미완료 |
| `drunk.assignShownCharacter` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `washerwoman.learnTownsfolk` | 통과 | QF1 실패 |
| `librarian.learnOutsider` | 통과 | QF1 실패 |
| `investigator.learnMinion` | 통과 | QF1 실패 |
| `chef.learnEvilPairs` | 통과 | 기본 5인 공개·reload·확정 통과 |
| `empath.learnEvilNeighbors` | 통과 | 기본 5인 화면 및 Core; 전체 상태 조합 미완료 |
| `fortuneTeller.checkDemon` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `poisoner.choosePoisonTarget` | 통과 | 실제 보드 선택·확정 통과 |
| `butler.chooseMaster` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `spy.inspectGrimoire` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `philosopher.chooseAbility` | 통과 | R2 획득까지 통과, 후속 전달은 QF1 |
| `snakeCharmer.choosePlayer` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `clockmaker.learnSteps` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `dreamer.learnCharacters` | 통과 | 정상 실제 세션 후보 잠금·payload 통과 |
| `seamstress.compareAlignments` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `mathematician.learnCount` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `evilTwin.learnTwin` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `evilTwin.assignTwin` | 통과 | R11 배정과 optional 승리/Undo 브라우저 통과 |
| `mutant.resolveMadnessExecution` | 통과 | R11 종료/Undo 브라우저 통과 |
| `witch.chooseCursedPlayer` | 통과 | Core/저장 회귀 통과. 이번 최종 UI 전체 경로는 미완료 |
| `cerenovus.assignMadness` | 통과 | 사용자 시나리오 보드·캐릭터·공개·확정 통과 |

## CI 연결·남은 공백

`.github/workflows/validate.yml`의 Rust workspace, custom-runtime, custom, web unit/integration, 격리, browser 명령이 갱신/추가한 테스트를 수집한다. 신규 custom 검사와 실제 React/browser 검사를 기존 glob에 넣었다. 별도 CI workflow 수정은 필요하지 않았다. 현재 CI에서도 integration/browser의 QF1 실패가 예상된다.

물리 iPad/iPhone Safari, 모든 BMR 밤/낮·상세·공개 상태 조합, 29개 행동 전체의 UI, 모든 등록 조합의 UI와 장시간 모바일 성능은 완료하지 않았다. 특히 QF1 수정 후 정상/중독/획득·모의·재준비의 동일 전달 경로, R0 Day 완주, 과거 Spy 재공개를 다시 실행해야 한다. 서버 manager 변경은 없어 lifecycle 전용 테스트는 범위 밖이다.

[검토 서버](리뷰 서버(검증 당시))는 유지했다. 이 단계의 서버 사용은 기존 관리 서버를 대상으로 했으며 별도 수동 서버 프로세스를 만들거나 종료하지 않았다.


## 후속 사용자 UI 인수 피드백 — 2026-09-11

이 보고서 이후 사용자가 공개 형식·자유 행동·선택 강조/결과·복귀·직업별 진행 차이와 독립 준비 행을 지적했다. [전면 조사](../plans/issue-220-ui-parity-audit.md)와 [계획 v3](../plans/issue-220-custom-grimoire-plan-v3.md)에 반영했다. 위 자동 검사 통과를 원본 UI parity 통과로 확대 해석하지 않는다. QF1 미통과는 유지하며, spec V01–V08 추가 조건은 미실행이다. 이번 문서 보완에서 제품 코드나 테스트를 변경하지 않았다.
