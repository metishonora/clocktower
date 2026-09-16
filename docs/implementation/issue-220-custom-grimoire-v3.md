# #220 v3 구현 및 테스트 인계

2026-09-11 · [승인 계획](../plans/issue-220-custom-grimoire-plan-v3.md)

## 구현

- 원본 TB/SnV 직업 공개, BMR 악의 진영 공개/저장/악마 선택, 자유 행동 dock·판단·처형창, 선택/결과/수신자 통지, 첩자 마도서, 직업/획득 능력 표시를 presentation으로 추출하고 official/custom 호출자를 연결했다.
- custom 전용 자유 행동 탭과 알림 목록, 분리된 준비 목록 행, 별도 저장 카드, 공개 화면 chrome 등을 원본 공유 경로로 교체했다. BMR 테마 아래 직업별 콘텐츠를 표현한다.
- 정보 대상 수락 후 진행 입력으로 복귀하는 경우와 직접 행동의 마도서 결과 확인/수신자 통지를 분리했다. 준비·전달은 Core의 informationFlow로 연결하고, 관련 확정 이벤트와 Undo 경계는 유지한다.
- 변종 판단은 기존 confirmStep/customActionConfirmed 경로의 madnessCheck/ mutantJudgment로 기록한다. projection에서 상태를 제공하고 기존 자동 저장·JSON·복원 경로를 사용한다. 처형에 판단을 새 필수 조건으로 추가하지 않았다.
- 처형 확인창은 사용자 승인 문구 `처형을 확정하면 현재 진행이 중단됩니다.`를 사용한다.
- 스칼라 입력 오류, 취함/중독/보르톡스 표시, 쌍둥이/세레노버스 공개, 첩자 좌석과 선택 강조, 표시 배역 입력을 원본 표현 경로에 연결했다.

## 진단과 검증 구분

- `cargo check --workspace --all-targets` 통과. 기존 dead-code 등 경고 존재.
- `pnpm --dir web check:architecture` 통과.
- `git diff --check` 통과.
- 최종 `pnpm --dir web build` 통과 (WASM·TypeScript·Vite·PWA).
- implement 스킬에 따라 테스트를 새로 설계하거나 실행하지 않았다. 기존 테스트의 PhaseStep 리터럴에 optional projection 초기값을 보완한 것은 전체 타깃 컴파일 유지 목적이다.

## 다음 test 단계

계획 T7의 71개 조건/29개 action 대응표를 기준으로 실제 official/custom 화면과 상호작용을 비교한다. 특히 배치 완료→하수인/악마 정보→시나리오 첫 직업, 준비/전달 단일 행, 세탁부 대상 선택→진행 정보 입력→공개, 세레노버스 선택 강조→결과→통지→복귀, 첩자 공개, 자유 행동 판단/처형/취소, 새로고침·JSON 왕복·Undo를 확인해야 한다. 모바일 밀도·키보드 포커스·BMR 테마 및 official 회귀도 포함한다.

실제 브라우저 대조와 replay 회귀 테스트는 미실행이다. 빌드 통과만으로 UI/UX 동등성이나 인수 완료를 주장하지 않는다.
