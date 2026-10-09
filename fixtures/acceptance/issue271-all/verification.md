# 인수 자료 검증 기록

준비일: 2026-10-09. 이 문서는 자료가 실행 가능한지와 자동 검증 범위를 기록한다. 사용자·실기기 인수 결과는 아직 없다.

## 실행 결과

| 확인 | 결과 | 범위 |
| --- | --- | --- |
| 파일 생성·Core 재생 | 35/35 PASS | 각 그룹의 실제 WASM으로 모든 체크포인트 재생 |
| JSON 직렬화 왕복 | 35/35 PASS | 왕복 전후 Core 상태 일치 |
| 실제 앱 불러오기·저장 복원 | 35/35 PASS | BMR 20, 귀족 6, 골렘 9. 실제 파서·ApplicationController·IndexedDB 저장 드라이버를 사용하고 저장소는 fake-indexeddb로 실행 |
| 후속 행동 규칙 검증 | 22 PASS / 1 FAIL | 상세 결과는 manifest.json의 scriptedChecks. 실패는 B20 |
| 기존 BMR 체크포인트 테스트 | 2/2 PASS | 기존 9개 파일의 생성·검증 테스트 |
| B20 컨트롤러 재현 | 재현됨 | 확정 오류와 이벤트 수 불변을 확인. 오류를 기대하는 진단 테스트의 PASS는 제품 동작 통과를 뜻하지 않음 |
| 웹 빌드 | BMR·귀족 PASS | 이번 자료 준비에서 각 작업트리의 pnpm --dir web build 실행 |
| 골렘 웹 빌드 | 직전 수정 검증 PASS 재사용 | 이후 제품 소스 변경 없음 |
| 서버 | 3개 모두 HTTP 200 | 수명주기 관리자가 loopback·Tailscale 주소를 확인. 인수 검토 중 유지 |
| 사용자·실기기·최종 통합 빌드 | NOT_RUN | results.csv의 인수 칸을 사용 |

규칙 검사 23건이 모든 파일의 모든 UI 분기를 자동 검증한 것은 아니다. 파일별 입력·기대 결과는 수동 인수 시나리오에 따르며, 브라우저 공개 화면·정렬·Safari·오프라인은 별도로 확인한다.

## 빌드 식별

세 작업트리 모두 기본 커밋은 6c171f46c087e45d22a2e904b9c2a17e31cf9d5f이며, 각 기능을 구현한 미커밋 변경을 포함한다. 이 기본 커밋만 체크아웃해서는 같은 기능을 재현할 수 없다.

| 그룹 | 구현 브랜치 | WASM SHA-256 |
| --- | --- | --- |
| BMR | codex/issue-271 | 74be9dc9acc0ea17caf48d8bfbc25dea586e33aa4a1450f1ce5e0bc244e25c59 |
| 귀족 | codex/noble-production | c86a65c185eb7e953ae31cd8dd1d07e5f5c8ddd70b0766933a9c39df538e05e2 |
| 골렘 | codex/golem-production | 20f88cc17c90afe9e32232dc6631b7ddaae53d04f186d1125908aa3f5aa5c449 |

인수 자료 브랜치 codex/issue-271-acceptance에는 파일·문서·생성기만 담았다. 제품 소스 통합·병합·이슈 종료는 수행하지 않았다. 이후 구현이 바뀌면 아래 생성기를 다시 실행하고 실패·통과 상태를 갱신한다.

## 파일과 규칙 검사 재생성

리포지터리의 scripts/generate-issue271-acceptance.mjs를 사용한다. 세 구현 작업트리의 WASM 빌드가 필요하다. 경로는 실제 로컬 위치로 바꾼다.

    node scripts/generate-issue271-acceptance.mjs \
      --bmr /path/to/bmr/clocktower \
      --noble /path/to/noble/clocktower \
      --golem /path/to/golem/clocktower \
      --output /tmp/issue271-all

생성기는 기존 20개 파일을 재생·복사하고 추가 15개를 공개 명령으로 생성한다. 파생 상태를 직접 주입하지 않는다. 예기치 않은 오류는 실행을 실패시키고, 알려진 B20 오류는 파일을 배포할 수 있도록 manifest와 results.csv에 실패로 기록한다. 따라서 생성기 종료 코드 0은 제품의 모든 사례 통과를 뜻하지 않는다.

## 실제 앱 불러오기 재검증

[검증용 테스트](verification/issue271BundleImport.test.ts)는 제품 테스트 디렉터리의 상대 import를 사용한다. 검사할 구현 작업트리마다 해당 파일을 web/test/custom/issue271BundleImport.test.ts로 복사한 뒤 다음을 실행한다. 기존 동명 파일이 있으면 덮어쓰지 않는다.

    ISSUE271_GROUP=bmr ISSUE271_BUNDLE=/absolute/path/issue271-all \
      pnpm --dir web exec vitest run --config vitest.custom.config.ts \
      test/custom/issue271BundleImport.test.ts

귀족 작업트리에서는 ISSUE271_GROUP=noble, 골렘에서는 ISSUE271_GROUP=golem으로 바꾼다. 테스트 후 본인이 복사한 임시 테스트만 삭제한다.

## 결과 기록

- manifest.json: 파일별 시작 상태·명단·해시, 자동 규칙 검사 결과, 빌드 식별.
- results.csv: 파일 재생·왕복 결과, 알려진 동작 실패, 사용자·실기기 기록 칸.
- known-issues.md: B20 실패 재현과 수정 후 재검증 체크리스트.
- bmr.md / noble.md / golem.md: 사람이 실행할 입력과 기대 결과.
