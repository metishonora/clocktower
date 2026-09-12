# #220 구현 계획 — 기존 SnV 형태의 커스텀 마도서

> 2026-09-11 후속 기준: [수정 계획 v2](issue-220-custom-grimoire-plan-v2.md). 아래 문서는 9월 10일 승인 당시 기록으로 보존하며, UI 연결·보완 결정·검증 범위는 v2를 우선한다.

상태: **전체 계획 사용자 승인 완료** · 2026-09-10. 이 문서는 승인된 구현 기준이며, 구현 완료 기록이 아니다.

게시된 기준 기록: [#220 승인된 구현 계획](https://github.com/metishonora/clocktower/issues/220#issuecomment-5620712125).

기준: [승인된 Spec v3](../specs/issue-220-custom-grimoire.md), [GitHub 기준 Spec](https://github.com/metishonora/clocktower/issues/220#issuecomment-5620580626), `ARCHITECTURE.md`.

## 1. 목표와 현재 출발점

승인된 #205 편집 화면을 Production에 옮기고, 최종 검토에서 기존 SnV 형태의 게임 설정과 실제 커스텀 첫날 밤으로 연결한다. 새 게임 시작과 파일 이어 쓰기는 해당 시나리오의 자동 저장을 확인 없이 대체한다. #205 원본과 #218 이야기형 UI는 이 작업에서 변경하지 않는다.

작업 위치는 `.worktrees/issue-220`, 브랜치는 `codex/issue-220`이다. 현재 편집기 handoff, custom Setup controller, SnV 공용 화면 조합, 브라우저 ID 보완은 부분 구현이다. 기존 변경을 이어서 사용하되, 같은 ID의 저장이 있으면 시작을 거부하는 부분은 Spec v3에 맞게 교체한다.

`docs/plans/issue-220-grimoire-connection.md`는 이전 부분 작업 기록으로 보존한다. 그 문서의 과거 저장 정책과 테스트 통과가 이번 전체 구현의 완료를 뜻하지 않는다. `web/src/prototypes/issue220`은 승인된 표현·상호작용의 참고 자료다. 고정 배역·분포·숫자·필터·메모리 상태를 Production 규칙으로 복사하지 않는다.

현재 코드와 Spec 사이에 별도 제품 결정을 요구하는 차이는 없다. **Spec revision request 없음.** 아래 내부 연결과 읽기 전용 조회 확장은 기존 책임 경계 안에서 Spec을 구현한다. 파일 스키마, 규칙, 공식/커스텀 경계 변경이 필요해지면 이 계획의 재량으로 확대하지 않고 Spec에 다시 올린다.

## 2. 공유 책임과 인터페이스

| 구성 요소 | 소유하는 상태·판단 | 연결 계약 |
| --- | --- | --- |
| `custom/authoring/scenarioEditorController.ts` | 편집 draft, 최신 검증, import 요청, 원본 게임 후보 | 현재 검증된 definition만 새 마도서에 전달. 읽은 게임은 불변으로 보관하고 `scriptIdentity`의 exact 비교를 사용 |
| 신규 `custom/grimoire/applicationController.ts` | editor/setup/play 전환, 활성 세션 하나, 전환 요청 세대 | `startSetup(validated)`, `resumeImported(candidate)`, `restore(customScriptId)`, `retrySave()`, `dispose()`; 화면에는 구독 가능한 상태와 명령만 제공 |
| `custom/grimoire/setupController.ts` | 인원·실제 배역·좌석 draft, 최신 분포 요청 | 검증된 설정을 세션 소유자에게 전달. 독립적인 두 번째 저장 세션을 만들지 않음 |
| `custom/session.ts`와 저장 계층 | canonical, full replay, command/Undo, 저장 수락 상태 | 새 Setup 또는 검증된 파일을 채택하는 경로와 진행 중 저장을 구분. 저장 재시도는 이미 수락한 snapshot만 저장 |
| 신규 `custom/grimoire/firstNightController.ts` | 현재 입력, 제안, 공개/가리기 상태, 진행 요청 | Core의 step/availableActions/pending reveals를 사용. 제안에 stream·event count·occurrence를 결속하고 오래된 결과 폐기 |
| `custom/core`와 `crates/custom-domain` | 허용 후보, 준비·실행 순서, 판정, 과거 정보 projection | 기존 replay/propose/apply/Undo 경로. 재공개는 저장된 사건과 그 사건 당시 prefix에서 조회 |
| `grimoire-custom/*` | React 화면 조합, 포커스·스크롤·공개 차단 | custom-owned view data와 명령을 기존 `shared-ui` 표현에 전달. 게임 규칙·저장을 소유하지 않음 |

`src/custom` 안에서는 공식 Core·공식 컨트롤러·소유권 밖 UI를 import하지 않는다. 공용 shell/catalog/board/play 표현은 바깥 `src/grimoire-custom`에서 조합한다. 공식 런타임에 결합된 `StepInputs`, 정보 task, EventLog를 그대로 연결하지 않고 커스텀 데이터용 얇은 화면을 둔다. 경계 검사 allowlist를 늘리지 않는다.

게임 채택 흐름은 **전체 검증 → 기존 writer 정리 → 새 snapshot 원자적 저장 → 활성 게임·저장 성공 상태 공개**다. 진행 중 명령은 **propose → canonical 적용·full replay → 현재 상태 반영 → 자동 저장**이며, 저장 실패 시 현재 상태와 마지막 저장 상태를 분리한다.

저장 상태는 `saving / saved / failed`와 저장 요청 식별자, 마지막으로 확인된 snapshot을 가진다. 교체되거나 취소된 요청은 실제 저장 실패와 구별한다. UI가 queue의 단순 boolean 결과로 오래된 실패를 다시 표시하지 않게 한다.

## 3. 개발 단위와 순서

### A. 자동 저장·게임 채택의 단일 경로

**파일:** `web/src/custom/session.ts`, `storage/sessionStorage.ts`, `core/canonicalSessionController.ts`, 신규 `custom/grimoire/applicationController.ts`, 신규 `custom/storage/sessionWriter.ts`.

1. 세션 생성, 파일 채택, 저장 복원을 application controller의 한 경로로 모은다. 파일 채택은 full replay 성공 결과와 원본 canonical을 사용하며 새 이벤트나 definition ID를 만들지 않는다.
2. 저장 driver에 검증된 새 Setup/파일을 활성화하는 명시적 저장 연산을 추가한다. 해당 키를 한 IndexedDB read-write transaction에서 `put`하여 정상·손상 슬롯 모두 확인 없이 대체한다. 사전 삭제와 빈 세션 저장은 하지 않는다. 일반 autosave의 오류 검사를 무조건 해제하지 않는다.
3. 시나리오 키별 writer가 세션의 소유권과 저장 순서를 관리한다. 전환 시 이전 소유자의 pending 저장을 버리고 새 요청을 차단한다. 이미 실행 중인 write는 완료 또는 실패가 정리된 뒤 새 snapshot을 저장한다. 늦은 callback도 현재 활성 세대와 일치할 때만 상태에 반영한다.
4. 동일 슬롯의 일반 저장은 transaction 안에서 기존 canonical의 게임 identity와 자신이 마지막으로 채택·저장한 기록을 대조한다. 다른 활성화로 교체된 기록에 낡은 writer가 덮어쓰지 않게 한다. 이 비교는 기존 저장 데이터로 수행하고 파일/DB 스키마를 추가하지 않는다.
5. 첫 저장 실패 시 Setup/파일의 수락 snapshot을 보존하고 성공한 게임 화면으로 전환하지 않는다. 재시도는 동일 snapshot 저장만 수행한다. 진행 중 실패는 이미 확정된 현재 게임을 유지하고 마지막 저장과 구분한다.

**의존:** 첫 단위. B의 import 결과 및 C/D의 게임 명령이 이 계약을 사용한다.

**위험·제약:** 현재 queue는 세션 간 순서를 보장하지 않는다. queue와 채택을 분리해서 구현하면 S1-g를 놓치므로 같은 단위에서 변경한다. 실제 IO 실패를 손상 데이터로 취급하지 않는다. 기존 시나리오 보관 데이터·공식 슬롯은 건드리지 않는다.

**검증 경계·완료 조건:** test 단계에서 실제 IndexedDB 경계와 세션 관찰 상태로 C18/C25/C26 및 S1-a–g를 확인한다. 자동 저장 확인창 없이 대체되고, 실패·재시도로 기존 저장 손실이나 이벤트 중복이 없어야 한다.

### B. 승인된 편집 화면과 단일 JSON 진입

**파일:** `custom/authoring/CustomScenarioEditor.tsx`, `ScenarioReviewSheet.tsx`, `scenarioEditorState.ts`, `scenarioEditorController.ts`, `useScenarioEditor.ts`, 해당 authoring 하위 화면·CSS, `storage/scenarioFile.ts`, `storage/gameFile.ts`, 신규 `custom/authoring/importScenarioSource.ts`.

1. #205 최종본과 #220 승인 prototype의 표현을 현재 Production authoring에 이식한다. 시작의 두 선택, 간결한 하단 패널, 최종 검토의 이름·구성·아이콘·주요 행동을 맞추고 기존 검색/순서 조작/접근성을 유지한다.
2. import helper는 파일 discriminator로 scenario v1과 custom GameFile v4만 분리한다. scenario는 기존 parser와 새로운 작성 ID를 사용하고, 게임은 기존 ID를 보존하여 전체 replay까지 검증한다. 공식 파일을 별도 runtime으로 우회하지 않는다.
3. 성공 결과를 한 번에 채택하고 바로 review로 이동한다. 취소·읽기/검증 실패·늦은 요청은 현재 draft와 게임을 부분 변경하지 않는다. 원본 게임 후보와 그 definition을 편집본과 별도로 보관한다.
4. 이어 쓰기 자격은 `sameCustomScriptDefinition`/`customGameCanResumeWithDefinition`으로 매번 계산한다. 배열 순서까지 비교하며 변경 후 원복하면 다시 활성화한다. 내용이 비슷한 브라우저 저장을 탐색하지 않는다.
5. 시나리오 저장은 현재 validated snapshot을 기존 다운로드 경로에 전달한다. 새 마도서와 이어 쓰기도 현재 검증·요청 세대를 확인한 뒤 A로 전달한다. import/review 자체는 자동 저장하지 않는다.

**의존:** A의 handoff 계약. authoring 표현 이식은 A와 독립적으로 작성할 수 있으나 통합은 A 뒤에 한다.

**위험·제약:** prototype 전체 컴포넌트나 fixture controller를 Production에서 import하지 않는다. 기존 #197의 검증·상대 순서 보존 기능을 화면 교체 과정에서 잃지 않는다.

**검증 경계·완료 조건:** editor controller 및 실제 파일 선택·다운로드 UI에서 C01–C04/C08–C14/C17/C19/C22/C33–C36, S1-f를 확인한다. valid import는 review로 직행하고 exact resume 외 재개 경로가 없어야 한다.

### C. 실제 게임 설정과 SnV 마도서 진입

**파일:** `custom/grimoire/setupController.ts`, `grimoire-custom/CustomGrimoireSetup.tsx`, `customGrimoireSetup.css`, A의 application controller.

1. 현재 부분 Setup 연결을 A의 활성 세션 소유권에 맞춘다. 기존 저장 존재만으로 거부하는 분기를 제거한다. 게임 설정 진입·편집은 저장하지 않는다.
2. 유효한 definition을 고정하고 빈 actual roster에서 시작한다. 5–15인·이름·Actual/Shown·좌석을 입력하고 custom setupDistribution으로 현재 구성만 검증한다. stale 분포 응답으로 시작할 수 없게 한다.
3. core가 소유하는 후보와 분포 규칙을 사용한다. 첫날 밤 악마 정보 단계의 bluff 입력과 Setup에서 필요한 검증을 각각 기존 runtime 계약에 맞는 시점에 연결한다. 별도의 Setup 행동 목록·순서 편집은 만들지 않는다.
4. `createGame`을 한 번 확정하고 A의 활성화 저장이 성공하면 replay를 D에 넘긴다. 실패는 수정 가능한 설정 또는 수락 후 저장 실패 상태로 구별한다.

**의존:** A+B. **위험·제약:** 후보 풀과 참가 배역 혼동, 중복 세션 생성, 저장 실패 시 재확정이 주요 위험이다. SnV 공용 표현을 재사용해도 분포와 Shown 규칙은 공식 controller에서 가져오지 않는다.

**검증 경계·완료 조건:** real custom WASM와 실제 설정 화면에서 C05–C09/C23–C25, S1-a–e. 승인된 로딩 이후 빈 배역 설정이 나타나고 유효한 Setup만 한 번 첫날 밤으로 연결되어야 한다.

### D. 첫날 밤 실행·공개·과거 기록·Undo

**파일:** 신규 `custom/grimoire/firstNightController.ts`, `stepInputModel.ts`, `historyModel.ts`; 신규 `grimoire-custom/CustomGrimoirePlay.tsx`, `CustomStepInputs.tsx`, `CustomReveal.tsx`, `CustomEventLog.tsx` 및 관련 CSS; `custom/core/coreAdapter.ts`, `types.ts`, `validation.ts`, `wasmClient.ts`, `revealPayload.ts`; `crates/custom-domain/src/game.rs`, `projection.rs`, `lib.rs`와 `crates/custom-wasm/src/lib.rs`의 읽기 전용 조회 연결.

1. `currentStep`, `availableActions`, required preparation, pending identity reveals를 구독하여 현재 입력을 구성한다. actionRef만으로 행동을 합치지 않고 owner/source/ability instance/occurrence를 유지한다. scheduler를 웹에서 재구현하거나 참가 배역으로 순서를 필터하지 않는다.
2. `requiredInput`과 `informationPrompt`의 허용 대상·선택 수·숫자/진영/등록 판단·setup information을 input model로 변환한다. 선택적 행동과 필수 준비를 Core가 제공한 구분대로 제시하고 confirmStep에 그대로 전달한다.
3. 공개가 필요한 명령은 현재 prefix에 대한 proposal을 만든 뒤 검증된 reveal payload만 렌더링한다. 공개 중에는 배경을 숨기고 inert/focus 차단한다. 가리기는 공개 화면만 닫고, 다음 확정은 같은 proposal의 version을 확인해 한 번 적용한다. 재공개는 명령을 실행하지 않는다.
4. 이미 확정된 사건 재공개를 위한 `confirmedEventReveal(gameFile, eventId)` 읽기 전용 custom 조회를 연결한다. 전체 파일 유효성을 확인하고 해당 사건 전 prefix의 facts와 저장된 사건 결과를 기존 `projection::event_reveal`에 전달한다. 현재 상태로 새 판정을 제안하지 않는다. payload 없는 사건은 공개 없음으로 반환한다. WASM/parser/adapter를 함께 연결하며 파일·이벤트 스키마는 유지한다.
5. 기록은 canonical event ID로 조회하고 pending identity의 source event/sequence를 보존한다. Undo는 기존 canonical Undo 단위를 호출한다. 확정·Undo·세션 전환 때 이전 입력과 proposal을 무효화하고 full replay 결과에서 화면을 다시 만든다.
6. 게임 종료가 나타나면 일반 진행을 막고 기존 허용 Undo만 제공한다. Day 도달과 지원되는 Day 파일 복원은 표시하되 낮 능력과 다음 밤 조작을 추가하지 않는다.

**의존:** A+C. 공개·확정·저장·Undo는 하나의 상태 흐름이므로 함께 통합한다.

**위험·제약:** 공식 정보 task/EventLog의 숨은 runtime 의존성, 능력 출처를 잃는 key, 과거 정보 재계산, 공개 중 조작 가능 상태가 주요 위험이다. Rust 변경은 기존 projection 노출에 한정하며 캐릭터 규칙 수정이 발견되면 해당 script 모듈 책임과 Spec 적합성을 별도 확인한다.

**검증 경계·완료 조건:** 기존 #209 독립 기대값 및 실제 웹 조작으로 C15/C16/C26–C32/C38을 확인한다. 준비·획득·다중 출처·재통지·종료·Undo를 포함해 Day 또는 종료까지 누락 없이 진행하고, 과거 공개가 당시 값으로 유지되어야 한다.

### E. Production 진입·파일 내보내기·새로고침 복원

**파일:** `web/src/customScenarioLanding.tsx`, 신규 `grimoire-custom/CustomGrimoireApplication.tsx`, 신규 `custom/grimoire/browserSessionNavigation.ts`, `custom/storage/gameFile.ts`, `custom/authoring/browserScenarioFiles.ts`, A/D의 controller.

1. 기존 landing의 custom lazy 진입을 application composition으로 연결한다. 승인된 TB/SnV 계열 로딩을 적용하고 WASM/화면 초기화 실패는 현재 작업을 보존한 오류·재시도로 처리한다. 공식·프로모션 진입은 유지한다.
2. 현재 브라우저 history entry의 namespaced state에 활성 `customScriptId`를 기록하여 같은 화면의 refresh 복원 주소로 사용한다. 기존 history state를 병합하며 새 게임 채택 저장 성공 전에는 활성 게임 표시자를 바꾸지 않는다. 이는 내부 게임 목록이나 파일 identity 변경이 아니다.
3. 복원은 해당 슬롯 load와 full replay로 수행한다. missing/unreadable/IO/replay 실패를 구분하고 오류만으로 게임을 생성하지 않는다. 복원 시 공개 overlay는 항상 닫힌 상태이며 canonical에 해당하는 진행 위치와 지원 좌석 정보를 복구한다.
4. 게임 JSON은 세션의 현재 canonical과 지원 UI seatLayout을 기존 v4 serializer로 내보낸다. 정의 ID·순서·기록을 그대로 보존한다. 저장 실패 중에도 현재 메모리 상태와 마지막 저장을 혼동하지 않는다.
5. prototype 및 memory review entry는 검토 근거로 보존하되 Production 연결에서는 사용하지 않는다. 검토 서버의 단계 전환·교체·종료는 designated operator/manager만 수행한다.

**의존:** A–D. **위험·제약:** reload가 공식 게임이나 새 게임으로 잘못 연결되는 것, 공개 자동 복원, lazy 오류의 무한 로딩을 방지한다. 복원 표시자는 선택한 슬롯을 가리킬 뿐 자동 저장 대체를 실행하지 않는다.

**검증 경계·완료 조건:** 실제 Production URL, 브라우저 저장 및 다운로드 파일에서 C10/C14/C16–C21/C34–C38과 S1-f/g를 확인한다. 처음부터 끝까지 review fixture 없이 동작해야 한다.

### F. 구현 후 test 단계와 완료 기록

구체적인 테스트 코드 설계·작성·실행과 내부 위험 보강 사례는 A–E 구현 후 test 단계에서 수행한다. 지금 테스트를 추가하거나 기존 부분 통과 결과로 전체 완료를 판정하지 않는다.

| 수용 조건 | 검증 경계·방법 | 주 담당 단위 |
| --- | --- | --- |
| C01–C04, C08–C14, C19, C22, C35 | Production 편집 UI, 실제 JSON 선택/다운로드, exact identity | B/E |
| C05–C07, C09, C23–C25 | 빈 roster부터 real WASM Setup, 분포·후보·최초 저장 | A/C |
| C15–C16, C27–C32, C38 | #209 R0–R11 승인 입력·기대값에 기반한 실제 첫날 밤 입력/공개/Undo/종료 | D/E |
| C17–C18, C26, C33–C34, C36–C37 | 전체 replay, 저장 실패/복원, 파일 왕복, runtime 로딩 경계 | A/B/D/E |
| C14, C20 | 기존 공식 TB·SnV 진입/저장/복원 및 strict custom boundary 회귀 | E |
| C21, C27, C37 | 데스크톱·모바일·iPad 크기, 스크롤·키보드·터치·reduced motion·공개 포커스 | B/C/D/E |
| S1-a–S1-g | IndexedDB 실제 transaction과 새 Setup/파일 채택 UI를 함께 관찰 | A/C/E |

수용 조건의 정확한 상황·조작·기대 결과는 Spec v3의 C01–C38와 S1-a–g 전체를 사용한다. 이 표는 45개 사례를 축약하거나 대표 5인 게임으로 대체하지 않는다. #209의 기대값은 승인된 `docs/acceptance/issue-209-mixed-first-night.md`와 참조 Spec에서 가져오며 구현 결과로 새 정답을 만들지 않는다.

test 단계의 파일 경계는 `web/test/custom/`의 authoring/session/storage/setup/first-night contract와 `web/test/browser/`의 Production 사용자 흐름이다. `test/custom`에 outer composition을 import하여 경계 검사 예외를 만들지 않는다. Rust 읽기 전용 조회는 custom domain/WASM 테스트에서 다룬다.

예정 검증 명령:

- `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`
- `pnpm --dir web build` — 실제 custom/official WASM 생성, 타입 검사와 Production build. 이후 검증은 이 산출물을 사용한다.
- `pnpm --dir web test:custom`, `pnpm test:custom-runtime`
- `node scripts/check-custom-boundaries.mjs`, `pnpm --dir web check:architecture`, `pnpm --dir web verify:pwa`
- `pnpm --dir web test:browser:run` — 기존 scenario authoring/Production 및 새 커스텀 연결 수용 범위. 자동 테스트의 ephemeral server는 기존 runner를 사용한다.
- 영향받는 기존 공식 web unit/integration 회귀. 공용 표현 변경이 있으면 해당 공식 사용자 흐름까지 확인한다.

명령 통과 외에 Production 실사용 경로, 다운로드 후 재입력, 새로고침, 공개 중 입력 차단을 관찰한다. 외부 HTTP origin의 브라우저 ID fallback을 유지한다. 실제 기기 미검증과 viewport 검증을 구별해서 기록한다. 새롭거나 크게 달라진 prototype을 추가로 만들 때만 AGENTS의 prototype reviewer 절차를 적용한다.

**완료 조건:** 45개 사례와 관련 회귀의 결과·증거·남은 제약을 기록하고, 타입/build/PWA/경계 검사를 통과하며, 승인 UI와 실제 runtime이 연결되어야 한다. #220의 완료를 #205/#218 완료로 확대하지 않는다. 이 계획 승인은 구현 계획의 기준 기록에 대한 승인이고 merge/이슈 종료 승인이 아니다.

## 4. 승인 기록과 다음 단계

2026-09-10 사용자가 전체 계획을 승인했다. 승인된 계획을 #220의 기준 기록으로 게시한다. 구현은 A → B → C → D → E, 이후 F(test)의 순서로 진행한다. 이번 승인 기록 작업에서는 Production 코드와 테스트를 변경하지 않는다.

구현 인계: [2026-09-11 implementation 결과와 test 단계 미확인 사항](../implementation/issue-220-custom-grimoire.md). 구현 결과는 수용 검증 완료를 뜻하지 않는다.
