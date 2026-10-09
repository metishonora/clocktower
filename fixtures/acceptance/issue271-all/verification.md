# 인수 자료 검증 기록

수정 검증일: 2026-10-10. 자동 검증과 브라우저 확인 범위를 기록한다. 사용자·실기기 및 최종 통합 빌드 인수는 아직 남아 있다.

## 실행 결과

| 확인 | 결과 | 범위 |
| --- | --- | --- |
| 파일 생성·Core 재생·JSON 왕복 | 35/35 PASS | 각 그룹의 실제 WASM으로 체크포인트와 직렬화 왕복 상태 확인 |
| 실제 앱 불러오기·저장 복원 | 35/35 PASS | BMR 20, 귀족 6, 골렘 9. 실제 파서·ApplicationController·IndexedDB 드라이버와 fake-indexeddb 사용 |
| 후속 행동 규칙 검증 | 24/24 PASS | manifest.json의 scriptedChecks. B20 확정·원인 보존·재생·Undo, B18·B19 회귀 포함 |
| B20 UI 회귀 | PASS | 화면 확정 한 번 → 1번 생존·새벽 → 저장 복원·JSON 재불러오기·Undo |
| BMR Rust domain / WASM | 328 / 6 PASS | 현재 밤 중독과 사망 원인 보존 회귀 추가 |
| BMR custom web | 381/381 PASS | 기존 체크포인트·파일·컨트롤러 회귀 포함 |
| BMR 웹 통합 | 955/955 PASS | 타입 검사와 전체 통합 테스트 |
| 골렘 웹 통합 | 948/948 PASS | 수정한 행동 계약 테스트 포함 |
| 귀족 관련 UI | 46/46 PASS | 행동 계약 43 + 귀족 프로덕션 3. 전체 통합 재실행은 아님 |
| 웹 빌드 | BMR·골렘 PASS | 이번 수정 후 pnpm --dir web build. 귀족은 제품 소스 변경 없이 10/09 빌드 유지 |
| 새 규칙 카드 브라우저 확인 | 7/7 PASS | BMR 6종·골렘의 열기, 핵심 판정·진행 방법·예시 개수·공식 링크. Codex 브라우저에서 확인 |
| 검토 서버 | 3개 모두 HTTP 200 | 수명주기 관리자가 loopback·Tailscale 주소 확인. preview / keep=true 유지 |
| 사용자·실기기·최종 통합 빌드 | NOT_RUN | results.csv의 인수 칸 사용 |

10/09 Claude의 390px 브라우저 인수는 BMR 19/20·귀족 6/6·골렘 9/9였고 유일한 실패가 B20이었다. 이번에는 B20과 규칙 카드 변경을 위 범위로 재검증했다. 모든 UI 분기나 실제 Safari·모바일 인수가 완료된 것으로 표시하지 않는다.

## 빌드 식별

세 작업트리 모두 기본 커밋은 6c171f46c087e45d22a2e904b9c2a17e31cf9d5f이며, 기능 구현과 후속 수정을 포함한 미커밋 변경이 있다. 기본 커밋만 체크아웃해서는 같은 기능을 재현할 수 없다.

| 그룹 | 구현 브랜치 | WASM SHA-256 |
| --- | --- | --- |
| BMR | codex/issue-271 | e2624f085c04bf26e6a65c348e9eb5b57af63d9e92d78b6875f128288c56e797 |
| 귀족 | codex/noble-production | c86a65c185eb7e953ae31cd8dd1d07e5f5c8ddd70b0766933a9c39df538e05e2 |
| 골렘 | codex/golem-production | 20f88cc17c90afe9e32232dc6631b7ddaae53d04f186d1125908aa3f5aa5c449 |

인수 자료 브랜치 codex/issue-271-acceptance에는 파일·문서·생성기만 담았다. 구현이 바뀌면 생성기와 관련 검증을 다시 실행한다.

## 파일과 규칙 검사 재생성

리포지터리의 scripts/generate-issue271-acceptance.mjs를 사용한다. 세 구현 작업트리의 WASM 빌드가 필요하다. 경로는 실제 위치로 바꾼다.

    node scripts/generate-issue271-acceptance.mjs \
      --bmr /path/to/bmr/clocktower \
      --noble /path/to/noble/clocktower \
      --golem /path/to/golem/clocktower \
      --output /tmp/issue271-all

생성기는 기존 20개 파일을 재생·복사하고 추가 15개를 공개 명령으로 생성한다. 파생 상태를 직접 주입하지 않는다. B20의 옛 오류를 허용하던 예외는 제거했다. 이제 B20을 포함한 24개 규칙 검사 중 하나라도 실패하면 실행도 실패한다. 생성기 성공은 사용자 인수 완료를 뜻하지 않는다.

## 실제 앱 불러오기와 시작 화면 재검증

[검증용 테스트](verification/issue271BundleImport.test.ts)는 제품 테스트 디렉터리의 상대 import를 사용한다. 각 구현 작업트리에 해당 파일을 web/test/custom/issue271BundleImport.test.ts로 복사한 뒤 실행한다. 기존 동명 파일은 덮어쓰지 않는다.

    ISSUE271_GROUP=bmr ISSUE271_BUNDLE=/absolute/path/issue271-all \
      ISSUE271_START_REPORT=/tmp/issue271-start-bmr.json \
      pnpm --dir web exec vitest run --config vitest.custom.config.ts \
      test/custom/issue271BundleImport.test.ts

귀족은 ISSUE271_GROUP=noble, 골렘은 ISSUE271_GROUP=golem으로 바꾸고 보고서 경로도 구분한다. 테스트 후 본인이 복사한 임시 테스트만 삭제한다. 선택적인 ISSUE271_START_REPORT는 앱이 복원한 처음 화면을 JSON 배열로 기록한다. 세 결과를 [initial-ui.json](initial-ui.json)에 모았다.

B01·B03·B07은 악마의 변호사 결과, B13·B14·B20은 임프 결과가 먼저 열린다. 모두 ‘진행으로 →’로 닫는다. 다른 29개 파일에는 초기 결과 패널이 없다.

## 결과 기록

- manifest.json: 파일별 Core 시작 상태·명단·해시, 자동 규칙 검사, WASM 빌드 식별.
- initial-ui.json: 실제 앱의 초기 결과 패널·현재 행동·낮 단계.
- results.csv: 파일 재생·왕복 결과, 알려진 동작 실패, 사용자·실기기 기록 칸.
- known-issues.md: B20 수정 근거와 재검증, 남은 인수·UX 항목.
- bmr.md / noble.md / golem.md: 사람이 실행할 시작 화면·입력·기대 결과.
