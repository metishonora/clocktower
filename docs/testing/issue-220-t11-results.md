# #220 T11 구현 후 검증

2026-09-11. [구현 기록](../implementation/issue-220-t11-fixes.md), [승인 계획](../plans/issue-220-t11-plan-draft.md), [수정 전 Red](issue-220-t11-test-preparation.md).

보정 표시 및 중복 사망 칩 제거를 구현했다. 실행한 검사는 통과했으며 아래 직접 확인 범위 밖까지 전체 인수 통과로 확대하지 않는다.

## 실행 결과

| 경계 | 결과 | 명령/증거 |
| --- | --- | --- |
| Rust workspace | 532 통과 | cargo test --workspace / implemented-rust.log |
| frontend unit | 166 통과 | pnpm --dir web test:unit |
| custom Core/controller | 197 통과 | pnpm --dir web test:custom / implemented-custom.log |
| integration | 719 통과 | pnpm --dir web test:integration:run / implemented-integration.log |
| 실제 production + BMR reference | 12 통과 | 두 issue220-t11 browser spec / implemented-browser.log |
| build, PWA, architecture, custom 경계, browser types, diff | 통과 | build/architecture/PWA 로그 및 최종 작업 트리 검사 |

선행 25개 예상 실패의 후속 assertion까지 통과했다. 새 dawn UI 회귀 및 철학자 획득/취함 보호 검사를 추가했다. Chromium 샌드박스 실행 실패는 권한 있는 동일 로컬 검사로 재실행했으며 제품 결함으로 집계하지 않았다.

## 수용 조건별 증거

| 조건 | 확인 결과 |
| --- | --- |
| M01–M05 | 실제 WASM으로 세 직업 각각·무보정·혼합 합산·0명 제한·순서 독립성·후보 부족을 검사. 실제 설정 UI 선택/해제와 원인/최종 수/정적 표시를 확인 |
| M06 | 실제 계산 응답의 지연·역순·실패·재시도, 최신 수와 원인의 동시 반영을 검사 |
| M07 | 실제 설정 확정·JSON 왕복·IndexedDB 복원·배치 복귀·정체 교환 후 원래 setup 조회, 사건 보존 검사. production 새 설정→확정→낮→reload로 보정 유지 확인 |
| M08 | 320/390/820/1366px에서 긴 이름·복수 보정·0명 제한·확정 전후·밤낮 화면 검사. 실제 BMR 대부 ±1 조작 4건과 screenshot 대조. 낮 제목 대비 보완 |
| D01–D02 | 실제 변종 처형 및 취소/중독 상태, 사망 사실·묘비·기록과 상세 칩 부재를 함께 검사 |
| D03 | 사망의 live/JSON/autosave와 각 Undo 복귀 검사. production 실제 처형→상세→Undo를 네 너비에서 실행. 다른 사망 원인은 공통 alive renderer에 원인별 분기가 없음을 코드 확인했으며 별도 실제 처형 외 흐름 재현은 하지 않음 |
| D04 | 실제 사서 정보 토큰을 붙인 뒤 변종 처형해 토큰 보존 확인. 실제 중독 표시와 철학자 능력 획득/원래 시장의 취함 상세를 검사. 모든 효과가 동시에 존재하는 죽은 좌석의 시각 조합까지 검사한 것은 아님 |

## 직접 화면 대조

증거는 [final-browser](issue-220-t11-evidence/final-browser)에 있다. 검증용 시나리오는 실제 Core로 검증했으며 배역 확정이나 진행 사건을 미리 주입하지 않았다. landing→시나리오 JSON→새 마도서→인원/직업 선택→확정→배치→진행을 실제 UI로 수행했다.

원본 BMR은 desktop에서 악마 선택 아래의 보정 영역, compact에서 하단 직업 상세 위의 보정 행을 사용한다. custom도 같은 공유 frame/CSS를 사용한다. 자동 보정에는 대부의 양자 선택 버튼 대신 승인된 정적 값이 표시된다. 최종 모바일 낮 screenshot에서 두 원인과 적용값의 가독성을 직접 확인했다. 무작위 배치/확정 버튼은 실제 클릭해 접근 가능함을 확인했다.

남은 인수 범위: 물리 모바일의 터치·브라우저 크롬/키보드, 모든 직업 조합의 키보드 단독 조작, 다른 사망 원인과 모든 효과의 동시 시각 조합. T7 전체 71개 조건·29행과 사용자 인수 승인은 별도 상태다. 이 잔여 범위를 완료로 표시하지 않는다.

## 사용자 확인 항목

1. 8명에서 비고르모르티스를 선택해 ‘외지인 −1’을 확인하고, 7명에서는 실제 적용 0의 제한 표시 확인.
2. 남작/팡 구 및 복수 보정 선택·해제 때 원인과 인원 구성이 함께 바뀌는지 확인.
3. 확정 후 직업 탭, 첫날 낮, 새로고침/JSON 복원에서도 원래 보정 유지 확인.
4. 변종 처형 뒤 사망 칩은 없고 묘비·토큰은 유지되는지, Undo로 생존 복귀하는지 확인.

리뷰 서버: 리뷰 서버(검증 당시) (preview, keep:true). 최종 JS fzY5RQBZ / CSS DLn6aszf를 operator가 local/user HTTP 200 및 dist 바이트 일치로 검증했다. 병합·이슈 종료는 수행하지 않았다.
