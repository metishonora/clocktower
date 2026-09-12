# #220 T9 구현 기록

2026-09-11. 사용자 implement 승인에 따른 추가 인수 결함 수정. 기준: [plan T9](../plans/issue-220-custom-grimoire-plan-v3.md). 구현 완료와 인수 통과는 구분한다.

| 항목 | 구현 |
|---|---|
| T9-1 설명 조회 | CustomNightTask의 일반/획득 정체를 기존 CharacterDetailButton과 기존 직업 상세 데이터에 연결. BMR theme 사용, draft 변경 없음. |
| T9-2 선택 패널 | 선택 중 workspace에서 confirmed 1열 조건을 제거하여 원본 2열 배치를 사용. 일반 확정 마도서는 기존 1열 유지. |
| T9-3 선택 강조 | TB 원본 대상/중독/actor 효과를 liveTargetStates.css로 추출하여 공식·custom 양쪽이 공유. 실제 대상 class 및 비선택 상태 연결. |
| T9-4 자동 복귀 | 일반 확정 후 result handoff를 생성하지 않음. 선택 종료 시 진행 탭 복귀. 필요한 수신자 notification은 유지하고 닫은 후 복귀. |
| T9-5 입력 시점 | setup 역할도 needsTargets에 포함. 유효 대상 수락 전에는 대상 선택 상태만 표시. |
| T9-6 공개 화면 | BmrRevealSurface의 team/role variant 분리. TB/SnV·광기·정체 변경·쌍둥이의 원본 CSS selector를 BMR role variant와 공유. 복사된 레이아웃 제거, 원본 미디어 조건 유지, 색상만 BMR 적용. 하수인/악마 team 화면 유지. |
| T9-7 불필요한 선택 상자 | 후보 없는 shown-character 입력 숨김. 이미 준비된 전달 정보를 비활성 select로 중복 표시하지 않고 읽기 전용 결과로 표현. Core가 제공하는 실제 중독/취함 전달 후보는 보존. |

Core 규칙·순서·이벤트·저장 버전·복원 구조는 변경하지 않았다. 새 UI 동작을 추가하지 않고 승인된 원본 흐름을 연결했다.

## 구현 진단

- pnpm --dir web exec tsc -b: 통과.
- tsconfig.test/custom-test/integration/browser 타입 검사: 통과.
- cargo check --workspace --all-targets: 통과, 기존 dead_code 경고 존재.
- pnpm --dir web check:architecture: 통과.
- pnpm --dir web build: WASM, TypeScript, Vite/PWA 빌드 통과.
- git diff --check: 통과.

implement 단계에서는 테스트 코드를 작성하거나 테스트를 실행하지 않았다. 기존 review 서버는 중지하지 않았다.

## 다음 test 인계

7개 사용자 재현을 실제 조작으로 검증한다. desktop 선택 panel bounding box, actor/선택/비선택 효과, 즉시 복귀와 필수 통지, 설명 창 닫기 후 draft 유지, 세탁부/사서/수사관 대상 전후·정상/중독/취함 입력을 확인한다. 하수인/악마 외 공개 전체를 원본과 320/390/820/1366 폭에서 비교하고 팀 정보·스파이 공개도 회귀한다. 일반 result 대기를 기대하던 테스트는 승인된 즉시 복귀 계약으로 갱신한다. 원본 CSS를 공유하는 공식 화면도 회귀 대상이다.

빌드 성공은 공개 화면 정상 또는 원본 UI 동등성의 증거가 아니다. T7 전체 인수와 T9 실제 화면 검증은 미완료다.
