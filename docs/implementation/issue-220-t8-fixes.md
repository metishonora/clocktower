# #220 T8 미통과 수정 구현

2026-09-11 · [계획 T8](../plans/issue-220-custom-grimoire-plan-v3.md) · 사용자 승인 후 구현.

- F1: 공개 문구 상수를 모듈에서 먼저 초기화한다. original/custom 공개 내용과 문구는 유지한다.
- F2: Rust 이벤트 허용 목록에 기존 mutantJudgment를 연결한다. 타입·출처·replay 검증과 기존 저장/Undo 계약은 유지한다.
- F3: shared scalar helper import에 NodeNext용 .js 확장자를 추가한다.
- F4: 속임수 이미지에 BMR compact 기준 34×34 크기를 적용하고 custom 모바일 grid/버튼 override를 제거한다. BMR 원본에 없는 custom 무작위 추천 연결을 제거하여 원본 공개/다음 버튼을 사용한다.

진단: cargo check --workspace --all-targets, frontend unit/custom/integration/browser TS 컴파일, architecture, pnpm --dir web build, git diff --check 통과. 기존 Rust warning은 남아 있다.

테스트는 이번 implement 단계에서 실행하지 않았다. 이전 검증 결과의 미통과 기록은 이력으로 보존한다. 다음 test에서 F1 공개/공식 회귀, F2 판단 저장·JSON·Undo/격리, F3 unit 실행, F4 4개 viewport의 실제 클릭·화면 배치를 재검증한다. T7 전체 직업별 UI 동등성 공백도 남아 있다.

사용자 요청에 따라 [인수 항목표를 #220에 게시](https://github.com/metishonora/clocktower/issues/220#issuecomment-5630220907)했다.
