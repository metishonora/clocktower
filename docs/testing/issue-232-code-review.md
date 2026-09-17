# #232 인수 변경 코드 리뷰

검토일: 2026-09-17. 기준: `codex/issue-232`의 `5e940ff` 이후 작업 트리 변경(추적되지 않은 신규 구현 파일 포함). 제품 코드를 수정하지 않고 변경 검토와 검증을 수행했다.

> 후속 상태: 아래는 수정 전 리뷰 기록이다. 2026-09-17 디자인 승인 후 네 항목을 수정했고, 문서 마지막에 재검증 결과를 기록했다.

## 판정

특정 G01–G05, 사용자 첨부 파일, 좌석 번호, 사건 ID를 인식해 규칙 결과를 우회하는 제품 코드는 발견하지 못했다. 사건 검증·상태 변경·Undo 단위는 계속 Rust가 결정한다. 다만 현재 상태를 아키텍처 관점에서 이상 없음으로 승인하기는 어렵다. 아래 1번은 재현된 검증 실패이고, 2–4번은 현재 잘못된 판정을 재현한 버그와 구분되는 구조 개선점이다.

## 1. [P1] 토큰 표시 테스트가 커스텀 격리 경계를 깨뜨림

위치: `web/test/custom/issue232TokenLabels.test.ts:4`, `scripts/verify-custom-runtime-isolation.mjs:21`.

커스텀 단독 실행 테스트 폴더에서 `grimoire-custom/customPlayerPresentation`을 직접 가져온다. 이 UI는 격리 환경에 복사되지 않으며 타입 의존성을 따라가면 기존 공식 UI/공식 Core 타입에도 닿는다. 일반 작업 트리에서는 의존성이 모두 있어서 354개 테스트가 통과하지만, 커스텀 경계 검사는 실패한다.

재현:

- `node scripts/check-custom-boundaries.mjs`: exit 1. 토큰 테스트 → customPlayerPresentation → playerTokenPresentation → 기존 UI → 공식 core/types 경로를 보고한다.
- 기존 격리 스크립트와 같은 웹 소스·테스트·fixture 경계를 임시 디렉터리에 복사하고 현재 생성된 production/fixture WASM을 제공한 TypeScript 검사: exit 2. 유일한 오류는 `issue232TokenLabels.test.ts(4,34): TS2307`, customPlayerPresentation 모듈 없음이다. 이번 리뷰에서 전체 Rust/WASM 재빌드 격리 스크립트를 다시 실행한 것은 아니다.

권고: 이 테스트를 기존 제품 UI 통합 테스트 영역으로 이동한다. 또는 표시 데이터와 순수 변환 함수만 커스텀 소유 경계로 옮긴다. 검사를 완화하거나 공식 UI 전체를 격리 복사 목록에 추가해 통과시키면 안 된다. 최근 번역 수정 시 일반 테스트·빌드만 확인하고 경계 검사를 빠뜨린 검증 누락이다.

## 2. [P2] 공통 사망 단계에 마귀할멈의 구체 규칙이 결합됨

위치: `crates/custom-domain/src/first_night/night_deaths.rs:19`, `crates/custom-domain/src/first_night/plan.rs:135`, `web/src/custom/authoring/scenarioEditorController.ts:96`.

공통 NightDeathsHandler가 SnV의 pending/resolve 함수를 직접 호출한다. 공통 순서 생성·검증은 `pitHag`와 `changeCharacter`를 직접 검사하고, 작성 UI의 버전 전환 조건도 마귀할멈을 직접 검사한다. 따라서 독립 단계 자체와 Undo 경계는 분리되었지만, 다른 직업이 같은 단계를 유발하도록 확장할 때 캐릭터 모듈 외에 공통 엔진과 작성 UI도 변경해야 한다.

현재 지원하는 마귀할멈의 판정 오류는 재현되지 않았다. 그러나 ‘다른 직업도 사용하는 공통 단계’라는 목적과 기존 캐릭터 등록 기반 설계에 비해 결합이 남는다.

권고: 현재 registry에 필요한 작은 등록 계약을 추가해 유발 능력, 기본 순서 기준, pending source와 해소 효과를 캐릭터 모듈에서 제공한다. 공통 단계는 이 계약을 소비하고, 작성 UI는 Core가 제안한 계약과 순서를 사용한다. 범용 규칙 DSL이나 미구현 직업 자체를 추가할 필요는 없다.

## 3. [P2] UI가 사건을 다시 읽어 사망 대기·유발자를 판단함

위치: `web/src/custom/grimoire/nightDeathResolution.ts:13`, `web/src/grimoire-custom/CustomGrimoireBoard.tsx:44`.

UI는 마지막 beginNight부터 사건을 훑고 `pitHagChange.createdDemon`과 `nightDeathsResolved` 유무로 대기 상태와 유발자를 계산한다. Rust의 `pending_arbitrary_death_sources`와 같은 판단을 두 번째로 구현한 셈이다. 이 값으로 공격 결과를 ‘사망 결정 대기’로 바꾼다. 현재 구현에서 둘의 불일치가 재현되지는 않았지만 유발 조건·횟수·지원 캐릭터를 바꾸면 Core와 UI를 동시에 갱신해야 한다. 표시 행을 찾을 때도 의미 키 대신 한국어 `결과` 문구를 비교한다.

권고: Core의 읽기 전용 projection에 pending 상태와 유발 source 목록을 제공하고 UI는 이름·직업·문구만 조합한다. 공격 결과 행은 표시 문자열 대신 타입이 있는 표시 모델에서 만든다. 이벤트 로그를 표시 목적으로 읽는 것 자체보다, 단계의 규칙 상태를 UI에서 재판단하는 것이 문제다.

## 4. [P3] 빈 선택 확정 처리가 공통 컨트롤러와 화면에 분산됨

위치: `web/src/custom/grimoire/firstNightController.ts:125`, `:170`, `web/src/grimoire-custom/CustomNightTask.tsx:57`, `web/src/grimoire-custom/CustomGrimoireBoard.tsx:47`.

이발사는 정확히 두 명일 때 일반 확정, 새 사망 단계는 한 명 이상일 때 일반 확정이라는 버튼 조건을 공통 컨트롤러에서 action ID로 분기한다. ‘선택하지 않음’과 ‘사망 없음’은 거의 같은 상태 변경/빈 명령 확정 코드를 별도 메서드로 갖는다. 이발사의 기존 skip 버튼을 숨기는 조건과 별도 decline 버튼 표시 조건도 각각 화면에 있다.

이는 사용자에게 명시적인 빈 선택 버튼을 제공하려는 올바른 UX 변경이며 Core 검증을 우회하지 않는다. 다만 기존 action adapter에 있어야 할 표시 정책이 분산되어 이후 유사 행동에서 같은 예외가 늘기 쉽다.

권고: adapter에 빈 선택 버튼의 문구·표시 위치·일반 선택 확정 정책을 두고 공통 confirm-empty 경로를 사용한다. 대상 자격·허용 개수 자체는 Core 계약을 유지한다.

## 문제로 보지 않은 변경

- 장의사: 특정 성결자 사례를 별도 처리하지 않고 공식 처형 기록에 연결된 사망을 공통으로 조회한다. 마녀 사망을 처형으로 바꾸지 않는다.
- 악마 변경: ‘실제 변경 + 새 직업이 악마’라는 판정으로 수정했으며 특정 악마 조합에 한정하지 않았다.
- Undo: 게임 종료의 원인 사건을 기존 실행 단위에 연결한다. 브라우저가 임의 사건 수를 제거하는 패치를 넣지 않았다.
- 재생 캐시: 스키마·전체 정의·전체 사건 prefix를 비교하며 변경·축소 시 재검증한다. 게임명/사례/사건 수 임계값에 따른 우회가 없다. 확정되지 않은 제안은 캐시에 들어가지 않는다. 캐시는 메모리에만 있고 저장 원본은 계속 사건이다.
- 곡예사 순서: 곡예사 ID 예외가 아니라 현재 밤의 실제 계획 위치를 공통으로 사용한다.
- 종료 화면·유령 아이콘: 공유 UI는 표시 값과 callback을 받고 공식/커스텀 Core를 섞지 않는다.
- 한국어 토큰 매핑·죽음 안내 문구: 표시 데이터에 해당한다. 토큰으로 규칙 상태나 능력 소유권을 만들어내지 않는다.
- nightOrderVersion 및 구 방식 유지: 승인된 이전 저장 파일 호환성 계약이다. 특정 인수 파일을 위한 예외로 보지 않았다.

## 이번 검증

- Rust custom-domain 225개, custom-wasm 6개 통과.
- custom web 56개 파일, 354개 테스트 통과.
- 낮 진행·보르톡스 피드백·새 사망 단계·공식 SnV 종료 등 관련 UI 6개 파일, 36개 테스트 통과.
- `pnpm --dir web check:architecture` 통과.
- `node scripts/check-custom-boundaries.mjs` 실패(1번).
- 같은 격리 소스 경계에서 TypeScript 실패(1번).
- 코드 리뷰 중 새 제품 변경이나 수동 인수 항목을 추가하지 않았다. 실기기·전체 브라우저 인수·전체 격리 Rust/WASM 빌드는 이번 리뷰에서 재실행하지 않았다.

권장 순서: 1번을 먼저 해결해 필수 경계 검증을 복구하고, 2·3번을 같은 작은 변경으로 정리한다. 4번은 action adapter 정리로 처리한다. 현재 지원 사례의 동작 통과를 구조적 완결성의 근거로 삼지 않는다.


## 디자인 승인 후 조치 — 완료

2026-09-17 사용자 요청으로 네 항목을 수정했다.

1. 토큰 표시 테스트를 `web/test/issue232TokenLabels.test.tsx`로 이동했다. CI에 제품 UI 회귀와 custom/official 경계 검사 실행을 추가했다. 격리 복사 목록이나 허용 경계를 넓히지 않았다.
2. `night_deaths.rs`가 캐릭터 모듈의 `SourceRule` 등록을 소비한다. 마귀할멈의 유발 조건과 기본 순서 기준은 SnV 모듈이 제공한다. 공통 순서 생성/검증과 시스템 행동은 마귀할멈 이름이나 SnV의 구체 함수를 직접 검사/호출하지 않는다. 기존의 빈 선택·사망 출처·Undo 결과는 유지한다. 작성 UI는 Core의 upgradeNightOrderVersion 권고를 명시적인 이후 밤 기본값 복원 때만 적용한다.
3. Replay의 읽기 전용 nightDeaths projection이 상태·유발자·해소를 기다리는 공격 사건 ID를 제공한다. UI 사건 스캔 모듈을 제거했고, 공격 결과 행을 한국어 문구로 찾아 덮어쓰는 로직도 제거했다. 진행 탭 유발자 표시와 마도서 선택 화면은 기존 UX를 유지한다.
4. 기존 action adapter에 명시적 빈 선택 버튼과 확정 문구를 등록했다. 컨트롤러의 confirmEmptySelection 하나로 처리하며 Core가 빈 선택을 허용할 때만 버튼이 활성화된다. 화면과 컨트롤러의 이발사/사망 단계 전용 skip/decline 분기를 제거했다.

재검증:

- Rust custom-domain 225개 + custom-wasm 6개 통과.
- 커스텀 웹 55개 파일 353개 통과(토큰 2개를 UI로 이동하고 Core의 업그레이드 권고 검사 1개 추가).
- 제품 UI 5개 파일 34개 통과. 토큰·예측불허의 죽음·낮 진행·보르톡스·공식 SnV 종료 포함.
- custom 및 integration TypeScript 검사, 일반 아키텍처 검사, custom/official 경계 검사 통과.
- 웹 빌드 통과.
- `node scripts/verify-custom-runtime-isolation.mjs` 전체 통과: 공식 소스 없이 production/fixture Rust·WASM 빌드, TypeScript, production/fixture 웹 테스트 수행.
- 사망 대기 projection → 확정 → Undo → 저장 재생 상태 검증 통과. 기존 5개 복합 게임과 모든 체크포인트도 재검증했다.
- 게시된 G05 JSON과 안내 파일은 원격 자료 커밋과 바이트 단위로 동일하다. 저장 형식·사건 포맷·수동 인수 항목은 변경하지 않았다.

검토 서버: http://100.91.205.43:10232/clocktower/ (preview, 유지).
