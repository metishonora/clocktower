# 화단에 꽃피운 이단 통합 인수 테스트

이 문서는 Issue #111의 사용자 직접 검증 목록이다. 각 JSON은 아래 행동을 시작하기 직전의
canonical 게임이며, 실제 Sects & Violets production 화면에서 import해 사용한다. 자동 테스트는
모든 파일의 schema-v3 import와 Rust WASM replay checkpoint를 검증하지만, 역할 공개의 가독성,
후속 처리의 조작감과 실제 iPad Safari 흐름은 이 체크리스트로 확인한다.

## 공통 준비와 결과 기록

1. production 앱에서 `Sects & Violets`를 선택한다.
2. `저장 / 불러오기` → `import JSON`을 누르고 각 항목의 파일을 선택한다.
3. 현재 게임 교체 확인이 나오면 승인한다.
4. 항목에 적힌 행동만 수행하고 기대 결과를 확인한다.
5. 다른 분기를 확인할 때는 같은 JSON을 다시 import한다.
6. 통과하면 체크박스를 표시한다. 실패하면 다음 형식으로 남긴다.

   `FAIL — 실제 결과 / 기기·OS·브라우저 / 마지막 이벤트 / export JSON 파일명`

기존 진행 중인 게임이 있다면 먼저 `export JSON`으로 보관한다. 테스트 fixture는 모두 현재 게임을
교체한다. 전체 기계 판독용 목록은
[manifest.json](../../fixtures/acceptance/sects-and-violets/manifest.json)에 있다.

## 1. Setup과 첫날 밤

- [ ] `SET-01` [setup-fang-gu-plus-outsider.json](../../fixtures/acceptance/sects-and-violets/setup-fang-gu-plus-outsider.json)
  - 재현: import 후 직업 구성과 마도서를 확인하고 `진행`을 연다.
  - 기대: 8명이 주민 4 / 외지인 2 / 하수인 1 / 악마 1이며 설정 경고가 없다. 팡 구의
    `[외지인 +1명]`이 적용된 구성이고 첫날 밤 `하수인 정보`부터 진행할 수 있다.

- [ ] `SET-02` [setup-vigormortis-no-outsider.json](../../fixtures/acceptance/sects-and-violets/setup-vigormortis-no-outsider.json)
  - 재현: import 후 직업 구성과 설정 경고를 확인한다.
  - 기대: 8명이 주민 6 / 외지인 0 / 하수인 1 / 악마 1이며 설정 경고가 없다.
    비고르모르티스의 `[외지인 -1명]`이 반영된다.

## 2. 광기 지정과 낮 판정

- [ ] `MAD-01` [cerenovus-madness-assignment.json](../../fixtures/acceptance/sects-and-violets/cerenovus-madness-assignment.json)
  - 재현: `집착 지정` → `2번 현우` → 집착할 캐릭터 `시계공` → `2번 현우 집착 지정`을
    누른다. `공개`로 플레이어 안내를 마친 뒤 첫날 밤을 완료한다. 낮에 `세레노버스 집착 확인`을
    열어 `충분히 집착함`과 위반 판정을 차례로 기록한다.
  - 기대: 공개 화면에는 대상과 “내일 시계공이라고 집착해야 합니다”만 보인다. 낮 판정은 마지막
    선택이 활성 상태가 되고 이벤트 로그와 자동 저장에 각각 기록된다. 판정을 바꿔도 중복 토큰이
    생기지 않는다.

## 3. 캐릭터·진영 변경과 영구 중독

- [ ] `CHG-01` [snake-charmer-vigormortis-swap.json](../../fixtures/acceptance/sects-and-violets/snake-charmer-vigormortis-swap.json)
  - 재현: 뱀 조련사 대상으로 `7번 비고르모르티스`를 선택한다. 두 역할 공개를 순서대로 완료하고
    마도서의 1번과 7번을 확인한다. `export JSON` 후 같은 파일을 재import하고 최근 행동을 Undo한다.
  - 기대: 1번은 악한 비고르모르티스, 7번은 선한 뱀 조련사가 되며 7번에는 뱀 조련사 출처의
    영구 중독이 생긴다. 역할 공개는 1번 다음 7번이고 새 뱀 조련사는 같은 밤에 재행동하지 않는다.
    재import 결과가 동일하며 Undo 한 번으로 두 역할·진영·중독이 함께 원복된다.

## 4. 겹치는 취함·중독과 복원

- [ ] `IMP-01` [overlapping-no-dashii-sweetheart.json](../../fixtures/acceptance/sects-and-violets/overlapping-no-dashii-sweetheart.json)
  - 재현: 마도서에서 `1번 시계공` 상세를 열어 상태 토큰을 확인한다. 닫은 뒤 최근 행동을 Undo하고
    다시 확인한다. Undo 전 상태도 export한 뒤 재import한다.
  - 기대: 처음에는 노 다시 출처 `중독`과 사랑꾼 출처 `취함`이 동시에 존재한다. Undo하면 사랑꾼
    취함만 사라지고 노 다시 중독은 유지된다. export/import 후에는 두 원인과 활성 상태가 정확히
    복원된다.

## 5. 보르톡스 거짓 정보와 수학자 계산

- [ ] `INF-01` [vortox-mathematician-false-number.json](../../fixtures/acceptance/sects-and-violets/vortox-mathematician-false-number.json)
  - 재현: 현재 수학자 단계에서 감사 내역을 펼친다. 계산값과 다른 `0`을 전달하고 플레이어 공개를
    완료한다.
  - 기대: 시계공의 보르톡스 거짓 정보가 감사 근거 한 건으로 표시되고 실제 수학자 계산값은 `1`이다.
    플레이어에게는 거짓 값 `0`만 공개되며 확정 이벤트에는 계산값 1과 전달값 0이 구분되어 남는다.

## 6. 동시에 생긴 사망 후속 처리 순서

- [ ] `ORD-01` [sweetheart-barber-follow-up-order.json](../../fixtures/acceptance/sects-and-violets/sweetheart-barber-follow-up-order.json)
  - 재현: 첫 후속 처리에서 사랑꾼의 취함 대상을 `2번 이발사`로 지정한다. 이어지는 이발사 후속
    처리에서 선택 가능한 악마와 교환 대상을 확인한 뒤 `교환하지 않음`을 선택한다.
  - 기대: 사랑꾼이 먼저, 이발사가 두 번째로 처리된다. 이발사는 사망 순간 정상 상태였으므로
    이후 사랑꾼에게 취해도 이미 발생한 후속 능력이 취소되지 않는다. 둘을 끝내기 전에는 일반 밤
    진행으로 돌아가지 않는다.

## 7. 악마 특수 상호작용

- [ ] `DEM-01` [fang-gu-first-outsider-jump.json](../../fixtures/acceptance/sects-and-violets/fang-gu-first-outsider-jump.json)
  - 재현: 공격 대상으로 살아 있는 외지인 `5번 사랑꾼`을 선택한다. 공개 안내와 새 팡 구 역할
    공개를 완료하고 마도서를 확인한다. 결과를 export/import한 뒤 Undo한다.
  - 기대: 5번은 죽지 않고 악한 팡 구가 되며 기존 7번 팡 구가 대신 죽는다. 5번에 `한 번` 토큰이
    생기고 사랑꾼 사망 후속 처리는 없다. 재import 결과가 같고 Undo하면 두 플레이어가 함께 원복된다.

- [ ] `DEM-02` [vigormortis-kills-minion.json](../../fixtures/acceptance/sects-and-violets/vigormortis-kills-minion.json)
  - 재현: 공격 대상으로 `6번 마귀할멈`을 선택하고 연동 선택에서 `5번 화가`를 중독 대상으로
    선택해 확정한다. 마도서에서 두 플레이어를 확인한다.
  - 기대: 6번은 죽지만 `능력 있음` 토큰을 유지한다. 5번에는 비고르모르티스 출처 중독이 생긴다.
    양옆 주민 중 하나만 고를 수 있으며 두 중독 대상을 동시에 확정할 수 없다.

## 8. 철학자 × 수학자 능력 인스턴스

- [ ] `PHI-01` [philosopher-mathematician-duplicate.json](../../fixtures/acceptance/sects-and-violets/philosopher-mathematician-duplicate.json)
  - 재현: 현재 원래 수학자에게 계산값과 다른 `1`을 전달한다. 다음 철학자 소유 수학자 단계에서
    감사 내역과 계산값을 확인한다. 현재 상태를 export/import한다.
  - 기대: 6번 원래 수학자는 철학자 중복 때문에 취해 있고 거짓 1을 받을 수 있다. 이어지는 1번
    철학자의 수학자 능력은 원래 수학자의 비정상 작동을 정확히 한 번 세어 계산값 1을 표시한다.
    재import 후 두 능력 인스턴스, 취함 출처와 감사 근거가 동일하다.

## 9. 승리 조건과 Undo

- [ ] `WIN-01` [vortox-no-execution-win.json](../../fixtures/acceptance/sects-and-violets/vortox-no-execution-win.json)
  - 재현: `지명 종료` 후 `처형 없음`을 확정한다. 악 진영 승리 확인에서 사유를 확인하고 게임 종료를
    확정한다. 이후 최근 행동을 Undo한다.
  - 기대: “보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다” 사유가 표시된다. 종료 후
    마도서는 읽기 전용이며 Undo하면 종료 확정 전 낮 상태로 복원된다.

## 10. 공통 저장·재생 검증

`CHG-01`, `IMP-01`, `DEM-01`, `PHI-01`에서 각각 다음을 추가 확인한다.

- [ ] `PST-01` 행동 확정 직후 `export JSON`하고 같은 파일을 import하면 플레이어 정체·진영·생사,
  취함·중독 출처, 능력 인스턴스, 자동 토큰, 미완료 역할 공개와 후속 처리가 동일하다.
- [ ] `PST-02` 최근 행동 Undo 후 새로고침해도 Undo된 상태가 자동 저장되어 다시 나타난다.
- [ ] `PST-03` 잘못된 JSON import와 현재 게임 교체 취소는 현재 게임과 이벤트 로그를 변경하지 않는다.
- [ ] `PST-04` S&V 저장이 존재해도 Trouble Brewing을 열었을 때 해당 게임으로 잘못 복원되지 않는다.

## 11. iPad production workflow

실제 iPad Safari 또는 iPad 크기인 1366×1024와 820×1180에서 `MAD-01`, `CHG-01`, `DEM-01`,
`ORD-01`을 반복한다.

- [ ] `IPAD-01` 마도서와 현재 행동 영역이 동시에 읽히며 현재 대상과 확정 버튼이 화면 밖으로
  잘리지 않는다.
- [ ] `IPAD-02` 역할 공개·집착 공개 중 Storyteller 조작 정보, 감사 근거와 다음 후속 대상이
  플레이어 화면에 노출되지 않는다.
- [ ] `IPAD-03` 회전, Safari 뒤로가기, 탭 전환 후에도 현재 단계와 선택 초안이 잘못 확정되지 않는다.
- [ ] `IPAD-04` Undo, export와 import 버튼을 터치로 사용할 수 있고 확인 창의 취소·확정이 명확히
  구분된다.

## 완료 기준

- 11개 JSON이 모두 production import되고 문서의 기대 결과와 일치한다.
- Setup, 첫날 밤, 낮, 이후 밤, 정보, 광기, 캐릭터·진영 변경, 취함·중독, 사망, 승리와 저장·재생
  범주가 모두 통과한다.
- fixture manifest가 25개 S&V 캐릭터를 모두 포함한다.
- 기존 Trouble Brewing 55개 acceptance fixture와 전체 Rust/Web 회귀가 함께 통과한다.
- 실패 항목에는 fixture ID, 실제 결과, export JSON과 재현 환경이 기록된다.
