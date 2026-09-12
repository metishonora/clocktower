# #220 v2 테스트 설계

2026-09-11. 정답은 승인 spec C01–C38/S1-a–g/U01–U12 및 #209 R0–R11이다. 구현 출력은 기대값을 정하는 근거로 사용하지 않는다.

| 보호할 계약 | 검출해야 할 결함 | 경계와 추가 보호 |
|---|---|---|
| U02 확정 전 진입 금지, 확정 후 roster 잠금 | 꽉 찬 roster만으로 진입, 탭 복귀 후 변경 | 실제 WASM Setup controller에서 명령 전후 draft/저장 비교. 기존 arrange helper는 명시적 confirmRoster로 갱신하되 별도 미확정 거부 테스트 추가 |
| U12 원래 Setup 복귀와 저장 지연 | 현재 진행의 이름/정체 복사, 복귀 시 슬롯 선삭제, 중복 Setup | 실제 application+IndexedDB, 진행 후 원래 setupConfirmed 비교와 실패/재시도/restore |
| U05/U06 대상 선택과 입력 수명 | 선택만으로 준비 확정, 취소 잔류, 탭 재진입 실패 | controller handoff + Production 브라우저 좌석 선택. 단순 prepare 호출만으로 UI 연결을 통과 처리하지 않음 |
| U06/U08 공개 문맥 분리 | 과거/통지 조회가 pending proposal 제거 또는 다른 정보 확정 | 실제 WASM 현재 제안 중 과거 조회 후 제안/파일 동일성 및 다음 확정 내용 확인 |
| U07 모든 정보 입력 | 0/false 소실, 제한 초과, Dreamer 후보 조합 불가, 등록 근거 소실 | 기존 R0–R11 실행 + UI 입력별 보강. 전달값/근거는 Core fixture와 독립 기대값으로 비교 |
| U03/U09 상세 접근/토큰 | disabled로 설명 차단, 생존 chip 재도입 | 실제 UI에서 과다·악마·미선택 직업 상세 접근, 자리 토큰 확인 |
| U10/U11 저장/기록/Undo/화면 | 진행에 로그 재생성, 취소 시 게임 변경, 작은 화면 잘림 | Production 320/390/820/1366, 실제 JSON/IndexedDB와 접근성 역할, 스크린샷 확인 |
| P1 공식 공용 부품 | custom 변경이 공식 입력/기록/시간/확인에 영향 | 공식 unit/integration 및 기존 Production browser suite |

기존 테스트 중 navigate만으로 확정을 대신한 helper, 비활성 직업의 native disabled 기대, 진행의 inline player grid 및 기록 버튼 경로는 승인 R1/U03/U05/U10과 충돌한다. 기존 보호(저장 시점/후보 제한/공개/왕복)는 유지하면서 경로를 고친다. 동작 결함이 드러나면 기대값을 완화하지 않고 실패를 기록한다.

CI: `.github/workflows/validate.yml`은 `test:custom`, 공식 web test, `test:browser`, Rust 및 custom-runtime을 실행한다. 추가 테스트는 기존 수집 glob 아래에 두고 수집을 확인한다.

## Q0–Q5 후속 검증 설계

승인 A01–A06/Q1을 기준으로 새 Setup의 첫 행동을 직접 확인한다. 기존 선행 준비 helper를 그대로 쓰면 이번 사용자 결함을 또 놓치므로 사용자 JSON + 새 15인 roster를 독립 구성한다. 순서 변경은 실제 confirm 경계에서 검사하며 목록 비교만으로 통과시키지 않는다.

- A04: 비선택 Spy 좌석이 있는 상태에서 두 일반 대상을 고르고, 단일 정답 자동 연결·실제 reminder·공개 payload를 검사한다. 별도의 모호한/취한 준비는 명시 선택이 없으면 확인 불가여야 한다.
- A05: Setup 출처이고 중간 사건에서 배우/대상 상태가 바뀌지 않은 준비 사건으로 구 선행 prefix를 구성한다. replay/JSON 보존 및 새 proposal 거부를 함께 검사해 단순 out-of-order 허용이 통과하지 못하게 한다. 실제 사용자의 GameFile 증거와 구분한다.
- A06: 입력 후보 누락 응답을 UI 경계에 주고 확인 경로가 없으며 canonical이 유지되는지 검사한다.
- 기존 SnV 공통 helper는 시스템 정보 뒤, 실제 `assignTwin` 단계에서 배정을 실행하도록 변경한다. 기존 관계/공개 payload 기대값은 유지한다. 새로운 순서 검사는 이 helper를 쓰지 않는다.
- F1/F4 UI 회귀를 재실행하고 F2 실제 Chromium 좌표, F3 fixture 응답 및 격리 명령을 확인한다. CI의 기존 custom/integration/browser glob에 새 검사를 배치한다.
