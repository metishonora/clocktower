# #220 T10 구현 후 검증

2026-09-11. 이번 T10 수정과 T9 공개 넘침 수정의 검사 결과다. #220 전체 71개 조건·29개 행동의 모든 조합을 새로 인수 완료한 것으로 해석하지 않는다. [구현 기록](../implementation/issue-220-t10-fixes.md), [수정 전 테스트](issue-220-t10-test-preparation.md), [plan](../plans/issue-220-custom-grimoire-plan-v3.md)을 함께 따른다.

## 실행 결과

| 명령·범위 | 결과 | 근거 |
| --- | --- | --- |
| `cargo test --workspace` | 532 통과 | [Rust 로그](issue-220-t10-evidence/implemented-rust.log) |
| `pnpm --dir web test:unit` | 166 통과 | [unit 로그](issue-220-t10-evidence/implemented-unit.log) |
| `pnpm --dir web test:custom` | 181 통과 / 39파일 | [custom 로그](issue-220-t10-evidence/implemented-custom.log) |
| `pnpm --dir web test:integration:run` | 698 통과 / 94파일 | [integration 로그](issue-220-t10-evidence/implemented-integration.log) |
| Playwright 아래 6개 파일 | 41 통과 | [browser 로그](issue-220-t10-evidence/implemented-browser.log) |
| `pnpm --dir web build` | 통과 | [build 로그](issue-220-t10-evidence/implemented-build.log) |
| architecture, custom 격리 및 격리 검사 10개, browser TypeScript, PWA, diff check | 통과 | 실행 결과 및 build 산출물 확인 |

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:10220/clocktower/ pnpm --dir web exec playwright test \
  test/browser/issue220-t10-production.spec.ts \
  test/browser/issue220-t10-reference.spec.ts \
  test/browser/production.spec.ts \
  test/browser/issue220-t10-demon-reveal.spec.ts \
  test/browser/issue220-t9-acceptance.spec.ts \
  test/browser/issue220-t9-reveal.spec.ts --workers=2
```

최종 캡처에서 첩자 최대 폭을 원본보다 넓히던 override도 제거했다. 새 build 후 custom/TB 첩자 공개 390/1366px **4건 재통과**: [집중 로그](issue-220-t10-evidence/implemented-spy-width.log), [최종 첩자 캡처](issue-220-t10-evidence/spy-final-width). 이 재실행은 위 41개와 중복되므로 별도 45개 통과로 계산하지 않는다.

최신 Core 변경 후 Rust/custom을 실행했고 이후 표현만 바뀐 부분에 그 결과를 재사용했다. 통합 698건 이후의 수정은 첩자 공개 CSS에 한정하며 브라우저 검사를 다시 실행했다. 중복 실행 수를 더해 통과 건수를 부풀리지 않는다.

## 수용 경로와 보강

- T10 실제 production 20건: 390/1366px에서 세탁부·사서·수사관 선택→정보 공개→다음, 실제+주정뱅이 사서 두 소유자의 연속 공개, 요리사 등록→결과→공개, 착각 지정→점쟁이 두 대상 판정, 첩자 공개→토큰 상세→닫기, 혼합 시계공·꿈꾸는 자·재봉사·수학자 입력→공개→다음. 유효한 WASM canonical checkpoint를 JSON 업로드로 읽은 뒤 실제 application/controller/Core 경로를 조작했다. 페이지 상태를 직접 주입해 단계를 건너뛰지 않았다.
- 원본 TB production 6건: 390/1366px 요리사·점쟁이·첩자. 저장 JSON으로 원본 경로에 진입해 기존 입력·공개를 직접 열었다. 원본 첩자에서는 사망 좌석과 복수 토큰도 확인했다.
- 원본 production 회귀 5건: TB/SnV/BMR 진입, TB/SnV canonical checkpoint 재개.
- T9 production 4건: 320/390/820/1366px 역할 설명, 마도서 선택·복귀, 세탁부 공개·통지.
- 악마 공개 2건: 320/390px 새 작성→배치→하수인→악마 공개. bluff 이미지와 카드 포함 여부 확인.
- 직업 공개 matrix 4건: 27개 allowlisted payload × 4폭의 원본/custom 가용 폭과 닫기 접근. **이 부분은 fixture 렌더 검사이며 27직업의 Core 진입 E2E라는 뜻이 아니다.**
- integration 보강: 정상/중독/주정뱅이 × 준비 정보 3직업, 불가 조합·취소·재선택, 실제/주정뱅이/획득 owner 유지와 공개·JSON·Undo, 등록 근거별 동일 결과 보존, Chef/Empath/FT/Seamstress/Clockmaker 판단 조합, 토큰 개수·읽기 전용 상세·포커스.
- Core 보강: 중독 정보의 임의 정답 표식 금지, 기존 ‘모든 소유자 먼저 준비’ 사건의 JSON replay 호환과 새 명령 우회 거부. 기존 출처/왕복/복원 회귀를 함께 실행했다.

## 직접 본 화면과 테스트 기준 정정

[최종 캡처 폴더](issue-220-t10-evidence/final-verified-browser)에 실제 경로의 선택 중/완료/진행 복귀/공개를 남겼다. 데스크톱 선택 패널이 오른쪽에 있고 두 대상에 강한 강조가 적용되는지, 재봉사 선/악과 시계공 실제 직업 분류가 결과와 연결되는지, 모바일 악마의 bluff·닫기, 첩자 좌석·토큰 상세, 좁은 통지·정체 변경과 쌍둥이 공개를 직접 보았다.

준비 단계의 첩자 `revealMode` 기준은 실제 production 호출 경로와 달랐다. 실제 TB는 잠긴 일반 마도서이며 좌석 클릭으로 토큰을 읽을 수 있었다. 이를 ‘좌석은 클릭 불가’ 또는 ‘SPY · ACTUAL GRIMOIRE 전용 헤더’로 검사한 기대값을 원본 호출자와 실제 캡처에 근거해 정정했다. 읽기 전용의 의미는 편집 불가이며 토큰 조회 금지가 아니다.

첫 최종 browser에서 40통과/1실패였다. 실제 데스크톱 첩자 좌석이 겹쳐 클릭이 막혔고 CSS 우선순위를 수정했다. [실패 로그](issue-220-t10-evidence/browser-before-spy-layout-fix.log)를 보존하고 15개 모든 좌석에 click trial을 추가했다. 재실행 41건이 통과했다. 기준을 완화하거나 force click으로 우회하지 않았다.

## 사용자 인수 항목

리뷰: 리뷰 서버(검증 당시) → Custom Scenario → 시나리오 JSON 또는 기존 게임 이어 쓰기. 서버는 keep:true로 유지한다. 아래 표는 직접 확인할 항목이며 사용자 인수 승인을 대신하지 않는다.

| 항목 | 조작 | 기대 |
| --- | --- | --- |
| 중독/취함 정보 | 세탁부·사서·수사관으로 대상 선택 후 진행 복귀 | 정답 플레이어 질문 없이 전달 캐릭터 선택·공개 |
| 두 대상·유효 조합 | 한 명 선택, 두 번째 선택, 해제·재선택 | 완성 전 나머지 자리 유지, 불가 조합 확정 불가, 확정 후 바로 진행 복귀 |
| 같은 역할 두 소유자 | 사서+주정뱅이 사서 | 첫 소유자의 공개를 마친 뒤 두 번째 소유자 선택·공개 |
| 취급 표기 | 요리사·공감능력자·재봉사 / 시계공 | ‘이번 판정의 XXX 취급’, 선/악 또는 실제 직업 분류, 불필요한 직업 전체 목록 없음 |
| 착각·점쟁이 | 착각 대상 지정 후 실제 두 대상 선택 | 별도 착각 표식, 마도서에서 은둔자 악마 여부 결정, 복귀 후 결과 |
| 공개 | 모바일 악마, 직업 정보·통지 | 이미지 과대 표시·가로 잘림 없이 내용과 닫기 접근 |
| 첩자 | 공개→좌석 클릭→토큰 상세→닫기 | 일반 마도서 형태, 원본 토큰 badge와 조회, 편집 불가, 중앙 확인 완료 |
| Undo/복원 | 정보 공개 후 기록·Undo·JSON 재개 | 사용자용 직업/행동 요약, 동일 소유자·기록 구간 복원 |

물리 모바일 기기 테스트와 사용자 인수는 미완료다. T7 전체 상태별 시각 인수, 29행 전체 행동의 모든 획득/모의/재준비 조합을 이번 20개 실제 경로로 대체하지 않는다. 이번 승인된 결함 범위의 자동 검증과 원본 대조를 수행했으며 이슈 병합·종료는 하지 않았다.

최종 리뷰 자산 확인: `CustomGrimoireApplication-CQrVDped.js` (198,702 bytes), `CustomGrimoireApplication-CannkxOz.css` (124,894 bytes). Manager가 로컬/사용자 HTTP 200과 디스크 바이트 일치를 확인했다. 프로필 preview, 포트 10220, keep:true.
