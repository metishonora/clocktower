# #220 T11 구현 기록

2026-09-11. 승인된 [계획](../plans/issue-220-t11-plan-draft.md)의 T11-1–4를 구현했다. [검증 결과](../testing/issue-220-t11-results.md)에 실제 실행과 남은 인수 범위를 구분했다.

- Core의 기존 직업별 보정 규칙을 사용해 기본 분포, 원인별 보정, 합산 요청량, 합산 후 제한한 실제 적용량을 한 projection으로 반환한다. 남작·팡 구·비고르모르티스 규칙을 웹에 복제하지 않았다.
- 조회 응답만 필수 adjustment로 확장했다. count 전용 타입·canonical 사건·JSON/자동 저장 버전은 유지했다. 웹 경계는 필수 metadata와 합계 일관성을 검증한다.
- BMR 대부의 desktop/compact 보정 외곽을 shared-ui/SetupAdjustment로 추출했다. official은 기존 선택 버튼을 유지하고 custom은 정적 적용값을 표시한다. 인원 한계 적용과 복수 원인도 같은 영역에 표시한다.
- 설정 controller는 수와 원인을 같은 최신 응답으로 반영한다. 확정 이후에는 원래 setupConfirmed 배역으로 조회하며 현재 정체 교환에 따라 초기 보정을 바꾸지 않는다. 오류·재시도·폐기된 controller 응답 처리를 포함한다.
- 좌석 상세의 별도 사망 칩과 빈 현재 상태 영역을 제거했다. 묘비·사망 좌석·Core 생사·기록·토큰·중독/취함·획득 능력은 유지한다.

## 검증 중 추가로 확인한 결함

실제 새 게임에서 하수인/악마 공개 후 낮 진입을 시도하자 기존 taskPresentationModel이 system.dawn의 requiredInput=day를 거부했다. Core 단계 및 기존 낮 시작 버튼은 이미 있었으므로 해당 system action의 입력 계약만 정확히 연결했다. 입력 검사를 전체 완화하거나 새 UI/규칙을 만들지 않았다. 실제 UI 회귀 검사의 실패를 먼저 확인한 뒤 수정했다.

낮의 compact 보정 제목은 밤 색상이 남아 흐리게 보였다. 공유 제목에 기존 BMR 낮 색상 #852d40을 적용하고 최종 build의 실제 화면으로 재확인했다.

## 테스트 자체의 정정

- JSON의 0과 JavaScript -0을 구별하던 기대값 helper를 정규화했다. 규칙 기대값은 변경하지 않았다.
- 배치 복귀 뒤 직업 표시는 실제 직업 탭을 연 다음 검사한다.
- 기존 count-only adapter mock은 새 필수 조회 계약으로 갱신했다. 제품에서 누락 metadata를 채우는 fallback은 추가하지 않았다.
- 기존 Rust count 시나리오 검사는 추가 metadata를 제외하고 기존 인원 기대를 보존한다. 새 metadata는 별도 실제 WASM 검사로 검증한다.
- 추가 철학자 검사는 고정된 입력 순서가 실제 시나리오 순서와 달랐다. 현재 Core action에 해당하는 유효 입력으로 진행하고, 획득 능력/원래 소유자의 취함 결과는 고정 기대값으로 검증한다.
- 새 테스트의 Testing Library 옵션 및 프로젝트 process 타입 오류를 정정하고 타입 검사를 재실행했다.
