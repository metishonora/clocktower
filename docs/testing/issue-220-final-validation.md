# #220 최종 상태

사용자는 2026-09-12 직접 인수 후 눈에 보이는 문제가 없음을 확인하고 finalize를 요청했다. 승인 범위는 커스텀 시나리오 작성에서 기존 마도서 설정·첫날 밤으로 연결하는 흐름이다. 이야기형 UI(#218)와 후속 페이즈의 신규 기능은 이 이슈의 종료 조건이 아니다.

## 최신 동작 기준

- 작성한 시나리오 순서는 Core가 실행하며, 목록도 Core overview 순서를 보존한다.
- action 의존 선언과 실제 source가 연속 실행·Undo 경계를 결정한다. UI의 특정 직업 조합 예외로 묶지 않는다.
- 기존 TB/SnV 직업별 입력·선택·공개 레이아웃과 BMR 테마를 사용한다.
- 정보 영향 배지 및 중독/취함/보르톡스 공개 강조를 연결한다. 숫자 후보/범위는 공통 입력 검증을 거친다.
- 일반 마도서에는 배치 복귀 버튼이 있다. 대상 선택 및 이어지는 결과/통지 중에만 숨긴다. 복귀는 기존 확인창과 원래 Setup 복원 계약을 따른다.
- Undo는 OS confirm이 아닌 기존 앱 내 LiveUndoDialog를 사용한다. 취소될 사건을 사람용 요약으로 표시하고 현재 게임과 동일한 요청만 실행한다.
- 이벤트 로그는 읽기 전용이며 항목별 다시 보기 버튼은 없다.
- 새 시나리오는 확인 후 빈 작성으로 돌아가되 새 유효 게임 저장 전까지 기존 저장을 보존한다.

위 기준은 과거 문서의 native confirm, 배치 복귀 전체 제거, 구현 전 실패/인수 대기 기록보다 우선한다. 과거 문서는 변경 이유를 설명하는 이력으로 보존한다.

## 검증 근거

- 최종 제품 변경 후 TypeScript 포함 통합 테스트 793개 통과.
- Undo 최종 브라우저 18개 고유 사례 통과. 취소/Escape, OS dialog 미호출, 묶음 실행 되돌리기 및 저장 결과 검사 포함.
- 숫자 입력 공통화: 철학자로 인해 취한 시계공 원본 게임 및 중독 요리사·공감 능력자·시계공·수학자의 실제 Core 진행 검증. 관련 브라우저 10개 통과.
- 마지막 제품 빌드, PWA, architecture, diff 검사 통과.
- Rust/custom 계약·이전 전체 브라우저 결과는 각 구현/검증 기록을 따른다. 최종 커밋의 필수 CI가 Rust workspace, custom runtime/session, web unit/integration, architecture/isolation, 서버 관리, 전체 production browser를 다시 실행한다.
- 리뷰 서버 최신 자산과 빌드 산출물의 일치 확인.

## 증거 보존

과거 실패·중간 실행의 대형 trace/이미지/로그는 저장소 외부의 프로젝트 로컬 보존본으로 이동했다. 삭제하지 않았고 원래 상대 경로와 크기를 manifest에 기록했다. 과거 문서의 상세 evidence 경로는 이 보존본 기준이다. 저장소에는 재현 가능한 테스트와 fixture, 검증 요약, 최근 대표 화면을 남긴다. 테스트가 직접 읽는 원본 시나리오 JSON은 보존한다.

[Undo 모바일](issue-220-undo-dialog-evidence/390.png) · [숫자 입력 모바일](issue-220-numeric-evidence/clockmaker-390.png) · [시작 목록](issue-220-order-poison-evidence/order-390.png)

최종 PR/CI/병합 결과는 GitHub #220 및 PR 기록을 따른다.

## Finalize 경계 검사 보완

첫 PR CI에서 `custom/grimoire/actionPresentation`과 controller가 UI 폴더의 action metadata를 참조하는 소유권 위반을 발견했다. metadata 4개 파일을 `web/src/custom/grimoire/actions`로 옮겨 custom 계층과 UI가 같은 소유 모듈을 참조하도록 정리했다. 기존 경계 검사와 검사 회귀 10개, action UI 계약 43개, 웹 production 빌드가 통과했다. 경계 검사 기준이나 action 데이터는 변경하지 않았다. 공식 소스 없는 격리 실행과 최종 CI 결과는 PR에 기록한다.

## Finalize 초기 브라우저 회귀 갱신

두 번째 PR CI는 경계 검사와 공식 코드 없는 격리 실행까지 통과했으며, production 브라우저에서 226개 통과/16개 실패를 보고했다. 실패는 초기 `custom-grimoire.spec.ts`에 남은 구 UI 기대였다. 최신 V/T13 및 사용자 정정과 대조해 악마 선택·저장 버튼 이름, 공개 닫기, 단일 준비/전달, 점쟁이 연속 선택, 자유 행동 dock, 첩자 전체 마도서와 앱 내 Undo 조작을 갱신했다. 테스트 제외나 제품 동작 변경은 없다.

`pnpm --dir web run test:browser:run custom-grimoire.spec.ts --workers=2`: TypeScript 및 18개 브라우저 사례 모두 통과(47.2초). 화면별 설정·파일 왕복/저장 보존·공개 포커스/비밀 화면 격리·전체 첫날 밤→Day·변종 처형/Undo를 유지했다. 철학자의 즉시 능력 선택→준비→전달은 승인된 D2–D4에 따라 한 실행이며, 한 번의 Undo 후 능력 선택 화면과 이전 canonical 사건 목록이 정확히 복원되는 검증을 추가했다. 최종 CI는 새 커밋 전체를 다시 검증한다.
