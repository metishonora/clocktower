# #220 T13 구현 기록

> 최신 승인·구현·인수 상태는 [최종 상태](../testing/issue-220-final-validation.md)를 따른다. 아래 과거 단계의 native confirm/배치 복귀 전체 제거/인수 대기 표현은 최신 기준으로 대체되었다.


2026-09-12. 승인된 [spec](../specs/issue-220-t13-action-contracts-draft.md), [plan P1–P6](../plans/issue-220-t13-action-contracts-plan-draft.md), [29개 action 계약](../plans/issue-220-action-contract-matrix.md)에 따른 구현이다. 검증 명령·결과·직접 인수 항목은 [T13 결과](../testing/issue-220-t13-results.md)에 분리했다. 사용자 인수 승인은 별도다.

## P1 — action 의존성과 실행 단위

- `ActionSpec.prerequisites/continuation_sources`를 29개 등록에 연결했다. TB 준비 정보/붉은 청어는 TB handler, 쌍둥이 관계는 SnV handler가 실제 source event를 반환한다. registry는 누락·자기 참조·모호한 선행 선언을 검증한다.
- 새 `first_night/execution.rs`가 정확한 occurrence/능력 instance/모의 source와 실제 사건으로 의존성을 해석한다. scheduler의 기존 `RunImmediately` 결과만 `immediate_origins`에 기록한다. 준비가 필요한 즉시 획득 능력은 소비 action 선언을 따라 준비의 생성 부모도 조회한다. 캐릭터 조합 whitelist는 없다.
- 완료 snapshot은 확정 당시 실행 소속을 고정한다. 현재 연속 suffix 안의 의존은 continuation, 독립 사건을 사이에 둔 과거 출처는 reference다. 다른 소유자·자유 행동을 건너뛰는 Undo는 금지한다.
- `PhaseStep.execution`, `ReplayState.actionExecutions/latestUndoUnit`을 Rust와 TypeScript 경계에 함께 추가했다. 구 응답의 필수 DTO 누락은 연결 오류다. GameFile/schemaVersion 4/canonical 사건은 변경하지 않았다. JSON frozen baseline은 새 read-only 응답 필드만 제외하고 기존 데이터의 동일성을 계속 검사한다.
- catalog의 추가 action은 등록 키 목록으로 유지하고 linked action은 선언에서 조회한다. 주정뱅이 준비도 고정 철학자 위치 대신 실제 생성/모의 source로 배치한다. 기존 시나리오 순서와 activation 규칙은 유지한다.
- 확정 snapshot용 실행 계산에는 해당 prefix의 실제 pending occurrence만 사용한다. 매 사건마다 전체 공개 projection을 다시 만드는 불필요한 연산을 제거했다.

## P2/P3 — 공통 controller와 29개 원본 UI 연결

- `grimoire-custom/actions/{registry,system,troubleBrewing,sectsAndViolets}.ts`에 29개 action을 명시 등록했다. 입력 종류만 보고 확정·공개 동선을 추측하던 분기를 action의 selection/completion/reveal/cancellation 계약으로 교체했다. 누락 action에는 임시 범용 UI를 제공하지 않는다.
- 진행 목록은 Core의 execution membership/displayStepId와 중단 상태를 표시한다. 독립 자유 행동으로 끊긴 실행을 완료로 표시하지 않으며 그 자유 행동 Undo 후에는 원래 진행 행으로 복원한다. 세탁부·사서·수사관의 준비와 전달을 별도 행으로 만들지 않는다. 기존 `informationFlow`는 준비 결과 조회의 호환 자료로 남아 있지만 새 UI 실행 연결·그룹·Undo의 근거로 쓰지 않는다.
- 같은 실행의 다음 action으로 넘어가면 새 draft를 만든다. 붉은 청어 1명 확정 후 점쟁이의 두 대상 선택에 앞선 선택값을 넘기지 않는다. 쌍둥이 지정 후에는 진행 탭을 끼우지 않고 원본 마도서 공개 안내로 이어진다. 공개 자체는 사용자가 눌러야 한다.
- 모든 확정 사건은 저장 완료 후에 후속 action/비공개 통지 안내로 연결한다. 저장 실패 시 성공한 prefix를 유지한다. 통지 저장 실패 후 재시도는 같은 사건을 반복하지 않고 비공개 안내를 복원한다. 공개를 자동으로 열지 않는다.
- 독살범·집사·마녀의 직접 확정/복귀, 세레노버스와 정체 교환의 순차 안내/공개/마도서 복귀는 원본 계약을 사용한다. 변종 자유 행동은 기존 정규 action을 임시 교체하지 않고 명시한 available action을 확정한다.
- 기존 공유 RoleInformationTaskView, TB 정보 편집/공개, SnV 획득 능력/통지, BMR EvilInformationTask/확인창, 잠긴 TB 첩자 마도서를 사용한다. 선택 강조·결과 위치·중복 태그 제거·진행 중 배치 복귀 제거·인원 보정 강조를 유지한다.
- 실제 화면 검사에서 발견한 쌍둥이 중앙 안내의 `evilTwinCenterPrompt` class 누락을 원본과 동일하게 연결했다. 토큰 badge보다 위에 표시되는 것을 브라우저에서 검증한다. 마녀/쌍둥이 진입 버튼도 원본의 ‘저주 대상 선택’/‘쌍둥이 선택’으로 맞췄다.

## P4 — 새 시나리오

새 게임 바로 옆에 새 시나리오를 추가했다. 승인된 BMR 확인창을 거쳐 빈 작성 첫 화면으로 돌아간다. editor instance, sourceFile, starting, restoreId, 요청 세대와 navigation marker를 초기화하고 이전 setup/play/writer의 수명을 종료한다. 이동 자체로 기존 저장 슬롯을 삭제하거나 덮어쓰지 않는다. 저장 중/실패 상태에서는 기존 복구 경로를 유지한다. 새 게임은 기존처럼 같은 시나리오를 유지한다. 320px utility는 기존 버튼을 줄바꿈하되 버튼 안의 단어가 분리되지 않게 했다.

## P5 — Undo

BMR의 `snvGlobalUndo` 버튼을 `shared-ui/UndoButton.tsx`로 공유하고 empty/disabled/SVG/접근성 이름을 함께 사용한다. Custom 전용 Undo modal을 제거하고 BMR과 같은 native confirm을 사용한다. 확인에는 한국어 행동 요약을 표시한다.

session은 Core의 최신 Undo 단위 하나와 실제 연속 suffix를 대조한다. 같은 사건 ID라도 payload가 바뀐 stale replay를 거부하도록 전체 사건 fingerprint를 확인한다. 부분 실행은 확정된 부분만, 완료된 의존 실행은 해당 suffix 전체를 한 번에 되돌린다. 새 실행의 과거 source까지 지우지 않는다.

## 테스트 기대값 정정 근거

테스트 준비 때 TB activation을 함께 읽지 않아 획득한 시작 정보 직업의 Undo root를 좁게 잡은 기대값이 있었다. 기존 TB `activation`은 세탁부·사서·수사관·요리사를 `RunImmediately`로 분류한다. 승인된 공통 source 원칙에 따라 획득→준비→전달을 한 실행으로 검증하도록 정정했다. 중첩 모의 철학자가 얻은 요리사는 그 실제 선택에만 연결하며 과거 주정뱅이 획득까지 합치지 않는다. 제품 규칙을 테스트에 맞춰 변경하지 않았다.

실제 확정보다 저장/UI 인계가 늦는 검사들은 사건 개수만 기다리지 않고 저장·busy·최종 화면을 기다리도록 했다. native dialog를 기다리는 테스트의 클릭/대화상자 대기 순서도 고쳤다. 테스트 오류와 제품 결함 수정은 결과 기록에서 구분한다.
