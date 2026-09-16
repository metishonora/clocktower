# #220 T8 재검증 — 네 결함 수정 통과

2026-09-11. [T8 계획](../plans/issue-220-custom-grimoire-plan-v3.md)의 F1–F4를 [직전 실패 사례](issue-220-v3-test-results.md)와 동일한 기대 결과로 다시 검사했다. 제품 코드는 변경하지 않았다. 미커밋 상태를 보존하고 [검사 대상 hash](issue-220-t8-evidence/tested-state.json)를 기록했다.

## 검증 설계 보완

- custom 세탁부 공개 테스트의 잘못된 직업명 ‘수도승’을 프로젝트의 원래 카탈로그 명칭 ‘수도사’로 교정했다. 공개 성공, 대화상자, 닫기, 역할 내용 검사는 유지한다. 초기 F1 실행 오류가 가렸던 테스트 오타이며 제품 문구를 변경하지 않았다.
- 변종 검사를 clear/violation 두 분기로 확장하고, 실제 자동 저장 완료→저장 슬롯 재접속→JSON 왕복→Undo를 모두 검사한다. regular step과 canonical 사건 수 보호도 유지한다.
- 브라우저 검사에 악마 속임수 선택 직전 전체 화면 캡처를 추가했다. 실제 pointer click을 사용하며 force click으로 클릭 가림을 우회하지 않는다.
- 직전 실제 결함 상태에서 공개·판단·모바일 클릭 검사가 실패한 증거가 있으므로 검출력 확인용 임의 mutation은 추가하지 않았다.

## T8 수용 결과

| 조건 | 관찰 결과 |
|---|---|
| F1 공개 실행 | 원본 TB 공개 10건과 custom 세탁부 공개 통과. 기존 화면 오류 재현 안 됨 |
| F2 판단 기록 | 정상/위반 판단의 저장·재접속·JSON·Undo 통과. unrelated role 입력 거부도 유지 |
| F3 unit 실행 | TS 컴파일 및 unit 166건 통과 |
| F4 모바일 | 320/390/820/1366px 새 배치→하수인→악마 속임수 선택→독살범 경로 4건 통과. 320px 캡처에서 이미지 겹침/버튼 세로 줄바꿈 해소 확인 |

## 범위 제한

이 결과는 T8의 네 결함 수정 수용이다. T7의 71개 조건/29개 action 전체 UI 동등성, 모든 공개·통지·선택 상태의 원본 시각 대조와 물리 모바일 기기 인수가 완료된 것은 아니다. 기존 browser 파일의 구 UI locator 이전 작업도 여전히 별도 공백이다. 전체 수용 완료로 확대하지 않는다.

## CI와 증거

기존 validate workflow의 unit/custom/integration/browser glob이 변경한 테스트를 수집한다. 별도 CI 연결 추가는 필요하지 않다. [증거 디렉터리](issue-220-t8-evidence/), [320px 악마 정보](issue-220-t8-evidence/browser/issue220-v3-acceptance-V01-8a51a--demon-information-at-320px/demon-bluff-selection.png).

초기 integration의 BMR timeout 및 중독 Chef 초기값 불일치는 실패 파일 재실행 24/24에서 재현되지 않았다. 최초 로그를 보존하고 제한 병렬 전체 재실행 결과로 판단한다.

## 최종 실행 결과

| 명령 | 결과 |
|---|---|
| `cargo test --workspace` | 532 통과 |
| `pnpm --dir web test:custom` | 178 통과(보강 전 전체) |
| `vitest --config vitest.custom.config.ts test/custom/issue220V3Flows.test.ts` | 보강한 정상/위반·실제 autosave 포함 6 통과 |
| `pnpm --dir web test:unit` | 166 통과 |
| `pnpm --dir web exec vitest run --maxWorkers=2` | integration 전체 88파일/616 통과 |
| `PLAYWRIGHT_BASE_URL=... playwright test test/browser/issue220-v3-acceptance.spec.ts --workers=2` | 네 viewport 4 통과 |
| `node scripts/verify-custom-runtime-isolation.mjs` | 격리 Rust/WASM/Production custom/fixture 검사 전부 통과 |
| custom boundary + detector, architecture, PWA | 통과, detector 10건 |
| custom/integration/browser TypeScript, diff check | 통과 |

이번 단계 제품 소스 변경은 없으므로 직전 T8 필수 web build의 결과물을 그대로 검사했다. 관련 회귀 실패는 최종 실행에서 남지 않았다. 테스트 서버는 종료하지 않았다.
