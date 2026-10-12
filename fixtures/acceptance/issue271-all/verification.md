# 통합 빌드 검증 기록

검증일: 2026-10-10. BMR 6종·귀족·골렘을 `codex/issue-271-integration`에 합쳐 같은 Rust/WASM/웹 빌드로 검증했다. 사용자·실기기 인수는 별도다.

| 확인 | 결과 | 범위 |
| --- | --- | --- |
| Rust workspace | 745 PASS | custom-domain 349, custom-wasm 6, official domain 386, official wasm 4 |
| fixture runtime | Rust 111 / 웹 13 PASS | `custom-runtime-fixtures` 빌드 포함 |
| custom web | 423 PASS | 실제 앱으로 인수 파일 36개 불러오기·IndexedDB 저장 복원 포함 |
| 웹 통합 UI | 963 PASS | 귀족·BMR·골렘과 교차 흐름, 저장·재공개·Undo |
| 웹 단위 | 166 PASS | 기존 공식 런타임·저장·진행 회귀 |
| Chromium | 28 PASS | BMR 18, 통합 6, 프로덕션 시작 4. 390px·1280px |
| 인수 파일 재생·JSON 왕복 | 36/36 PASS | BMR 20, 귀족 6, 골렘 9, 8종 통합 1 |
| 후속 행동 규칙 검증 | 27/27 PASS | B20 원인 보존, 골렘→어릿광대·귀족인 손주·달의 자손 포함 |
| 경계·아키텍처 | PASS | Rust/TypeScript 경계 및 경계 검사 회귀 10개 |
| 웹 타입·빌드·PWA | PASS | `pnpm --dir web build`, PWA 산출물 검사 |
| 사용자·실기기 | NOT_RUN | Safari·휴대전화·오프라인·모든 수동 분기 |

## 통합 경계에서 확인한 동작

- 골렘 지명의 사망도 공통 사망 판정·방지 소모·후속 선택·오작동 근거를 사용한다.
- 골렘→어릿광대는 미리보기와 확정 모두 사망 없음이다. 두 능력의 사용을 기록하고, Undo는 둘 다 복원한다. 그다음 임프 공격은 어릿광대를 죽인다.
- 중독된 골렘이 정상 어릿광대를 지명하면 어릿광대의 방지는 소모되지 않는다. 골렘이 정상이었어도 생존하므로 이 건을 수학자의 추가 오작동으로 세지 않는다.
- 골렘→달의 자손은 공개 선택을 먼저 기록한 뒤 같은 투표로 복귀한다. 저장 복원과 지명·선택을 묶은 Undo가 유지된다.
- 골렘이 귀족인 손주를 죽이거나 달의 자손이 손주를 죽여도 할머니는 생존한다. 악마가 실제로 죽인 경우에만 할머니의 연쇄 사망이 생긴다.
- 할머니·귀족 정보 형식, 선악 취급 입력, 골렘 지명 기록은 함께 검증한다. 골렘 결과에 `protected` 변형을 추가했으며 GameFile v5를 유지한다.

할머니 UI 회귀는 자동 저장 완료 후 Undo를 요청하도록 보완했다. 기존 BMR 브라우저 검사는 ‘최초 사망 방지 · 유지’ 문구와 결과 패널 복원 시점에 맞췄다. 제품에 추가 확인 단계를 넣지는 않았다.

## 재현

통합 브랜치에서 의존성과 WASM을 준비한 뒤 실행한다.

    pnpm install --frozen-lockfile
    cargo test --workspace
    pnpm --dir web build
    pnpm test:custom-runtime
    pnpm --dir web test:custom
    pnpm --dir web test:integration:run
    pnpm --dir web test:unit
    pnpm --dir web check:architecture
    node scripts/check-custom-boundaries.mjs
    node --test scripts/check-custom-boundaries.test.mjs
    pnpm --dir web verify:pwa
    pnpm --dir web exec tsc -p tsconfig.browser.json --noEmit
    pnpm --dir web exec playwright test issue271-bmr.spec.ts issue271-integrated.spec.ts production-smoke.spec.ts --workers=2

공개 WASM 명령으로 인수 파일과 규칙 검사 결과를 다시 만든다. 생성기는 현재 통합 작업트리를 기본으로 사용한다. 다른 빌드는 `--bmr`, `--noble`, `--golem`, `--integrated` 경로로 명시할 수 있다.

    node scripts/generate-issue271-acceptance.mjs
    ISSUE271_START_REPORT=/tmp/issue271-initial-ui.json \
      pnpm --dir web exec vitest run --config vitest.custom.config.ts \
      test/custom/issue271BundleImport.test.ts

영역별 검증은 `ISSUE271_GROUP=bmr`/`noble`/`golem`/`integrated`, 외부 자료는 `ISSUE271_BUNDLE=/absolute/path`로 지정한다. 선택적인 `ISSUE271_START_REPORT`는 실제 앱이 복원한 처음 화면을 기록한다. 현재 36개 결과는 [initial-ui.json](initial-ui.json)에 있다.

B01·B03·B07·B13·B14·B20은 직전 결과 패널을 **진행으로 →**로 닫고 시작한다. 다른 30개 파일에는 초기 결과 패널이 없다.

## 빌드와 결과 식별

검증한 제품 소스는 `840759378c9651d64fc5adac4149b5ea12addc6d`이다. 이후 인수 패키지 커밋은 제품 동작을 바꾸지 않는다.

[manifest.json](manifest.json)에 소스 커밋·브랜치·WASM SHA-256과 36개 파일 해시, 27개 규칙 검사 결과가 있다. 모든 그룹은 같은 통합 WASM을 사용한다. `results.csv`의 사용자·실기기 칸은 NOT_RUN으로 남겨 둔다.

[통합 검토 서버](http://100.91.205.43:10274/clocktower/)는 lifecycle manager의 preview/keep=true 세션이다. 이전 3개 검토 서버는 교체 종료했고, 원래 작업트리의 변경 내용은 그대로 보존했다.
