# Issue 179: Bad Moon Rising Production UI shell prototype plan

## 상태

Prototype review complete on 2026-08-27. Character-specific screens and behavior are handed off to
their Character implementation work.

2026-08-24 검토 기준 문서다. Stage 1 Setup 프로토타입은 같은 날 승인되었다. Stage 2A의
Grimoire 기본 배치 프로토타입은 2026-08-26 승인되었다. Stage 2B의 확정된 읽기 전용 마도서와
배치 복귀 확인 프로토타입은 같은 날 승인되었다. Stage 2C의 미치광이 Actual/Shown identity
프로토타입은 세부 표현을 Character 구현 단계로 넘겼다. Stage 2D의 좀버얼 공개상 사망 / 실제
생존은 전용 reminder token 패턴을 승인하고 정확한 token 내용은 Character 구현 단계로 넘겼다.
Stage 3A의 첫날 밤 current task / 공식 순서 /
manual 처리 프로토타입은 수정 후 2026-08-27 승인되었다. Stage 3B의 별도 처형 성립 / 대상 생존 결과
프로토타입은 2026-08-27 반려되었다. 기존 투표·결과 UI에서 executee와 실제 생존 상태를 함께
표시하고, Execution과 Death의 규칙상 구분을 별도 화면이나 phase로 확장하지 않는다. Stage 3C의
복수 공격 순서 결과는 같은 마도서의 `completedSelection` 패턴으로 2026-08-27 승인되었다. Stage 4A의
미치광이/실제 악마 상세 Reveal은 Character 구현 범위를 침범해 같은 날 반려되었다. BMR Reveal은
기존 S&V 전체화면 구조와 수신자별 정보 경계만 재사용하며 구체 내용은 미치광이 구현 단계로 넘긴다.
Resurrection, Zombuul의 실제 사망 전환, Mastermind 추가 Day처럼 Character 규칙에 종속되는 나머지
scenario도 Character 구현 단계로 넘긴다. Issue #179에서는 더 이상 Character별 prototype stage를
추가하지 않고, 검토 결과를 후속 Production 통합의 요구사항과 참고 자료로 남긴다.

Issue #174, #175, #177에서 확정된 Domain 계약을 변경하지 않는다. 현재 합의된 제품 방향은 다음과
같다.

- BMR은 붉은 계열의 독립 테마를 사용하며, 핵심 인상은 **혈월**이다.
- player-facing private Reveal은 기존 Sects & Violets의 full-screen Reveal 구조와 handoff 흐름을
  재사용하고 BMR 색상만 적용한다.
- 복수 결과는 기존 Grimoire의 `completedSelection` 흐름에서 처리 순서를 읽을 수 있어야 한다.
- Zombuul의 공개상 사망과 실제 상태는 별도 상태 카드가 아니라 기존 reminder-token 영역을 사용한다.
- Setup 확정 후 Grimoire는 읽기 전용이며, 수정은 명시적인 파괴적 확인을 거쳐 배치 단계로
  돌아간 뒤 수행한다.
- Setup에서 합의한 요구사항은 조건부 Godfather 보정, 단일 option 자동 선택, mobile 상세 영역의
  정확한 보정 label, 평면 천체와 가시적인 2단 확산광이다.

## 목적

현재 Production 앱 셸을 사용해 BMR의 `직업 → 마도서 → 진행` 흐름을 재현하는 development-only
프로토타입을 만든다. 이 프로토타입은 다음 제품 요구사항을 검토하기 위한 예시다.

1. BMR Setup과 Godfather 분포 선택을 Storyteller가 혼동 없이 확정할 수 있다.
2. 확정된 좌석과 복합 Player 상태를 Grimoire에서 빠르게 읽을 수 있다.
3. 공식 first/later-night 순서 안에서 현재 단계, 입력, manual 상태와 다음 행동이 구분된다.
4. 생존 결과와 ordered Death가 기존 공용 결과 흐름에서 표현 가능한지 검토한다.
5. Storyteller 전용 정보가 player-facing Reveal에 노출되지 않는다.
6. 후속 Character vertical implementation이 연결할 입력, preview, Reveal, 결과와 후속 처리에
   필요한 공용 UI 경계를 확인한다.

프로토타입은 Character 자동화를 흉내 내지 않는다. 아직 producer가 없는 결과는 fixture이며,
자동화되지 않은 단계에도 실제 제품에서 쓰이지 않는 별도 상태 표식을 추가하지 않는다.

## 제외 범위

- BMR Character 능력의 Production 자동화 또는 새 Character command
- protection candidate discovery, impairment, scheduled effect, Resurrection, public-life 또는
  game-end Domain 계약 추가
- fixture를 canonical event나 실제 저장 데이터 대신 사용하는 Production 코드
- BMR Production route, landing 공개, IndexedDB session 또는 실제 import/export 연결
- 최종 Character icon, logo, PWA asset 확정
- Trouble Brewing 또는 Sects & Violets의 화면·규칙 변경
- Traveller, Fabled, Custom Script, Jinx와 house rule

## 기반 계약과 재사용 경계

### Domain에서 가져오는 사실

- 7–15명 지원과 기본 Setup 분포
- 공식 25 Character와 13/4/4/4 kind 구성
- Godfather가 있을 때 가능한 모든 `addOutsider` / `removeOutsider` option과 명시적 choice ID
- Lunatic의 Actual `lunatic` / Shown BMR Demon identity
- roster-filtered first/later-night typed step과 공식 순서
- 모든 미자동화 BMR Character step의 `manual` support
- `orderedDeathResolved`가 보존하는 source, target sequence, bypass, prevention audit와 tagged
  outcome의 의미

프로토타입 fixture는 이 계약의 명칭과 순서를 그대로 사용한다. 다만 실제 Rust/WASM session을
열거나 Character 결과를 생성하지 않는다.

### UI에서 재사용하는 구조

- `ProductionApplicationShell`: 공용 header, utility navigation, `직업 / 마도서 / 진행`, Day/Night
  theme boundary
- `SetupPresentation`과 `RoleCatalog`: Setup control, 고정된 Character catalog와 selection state
- `GrimoirePresentation`과 `RectangularGrimoireBoard`: 7–15명 rectangular perimeter, inspector,
  read-only seat
- `PlayPresentation`: phase header, dominant current task, secondary phase order와 auxiliary state
- `SectsAndVioletsReveal`: full-screen modal, player-safe content와 명시적 close/return

공용 component는 BMR Character ID나 규칙을 추론하지 않는다. BMR adapter가 fixture state,
presentation label, class와 theme token을 제공한다. 프로토타입에 꼭 필요한 일반화가 아니라면
shared component를 변경하지 않는다.

### development-only entry

- 기존 `import.meta.env.DEV` lazy prototype entry pattern을 사용한다.
- Retained Setup entry는 `/clocktower/trouble-brewing/?prototype=issue-179-bmr-shell`이다.
- Stage 2A Grimoire 기본 배치 entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-grimoire`이다.
- Stage 2B 확정 마도서 entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-grimoire-confirmed`이다.
- Stage 2C 미치광이 identity entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-lunatic-identity`이다.
- Stage 2D 좀버얼 state entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-zombuul-state`이다.
- Stage 3A 첫날 밤 progress entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-first-night`이다.
- Stage 3C 복수 공격 순서 결과 entry는
  `/clocktower/trouble-brewing/?prototype=issue-179-bmr-ordered-death`이다.
- 반려된 Stage 3B 생존 화면과 Stage 4A 상세 Reveal에는 실행 가능한 entry를 남기지 않는다.
- review scenario control은 Production-like 화면 바깥의 별도 review toolbar에 둔다.
- Production build와 landing에는 BMR route나 prototype control이 노출되지 않는다.

## 시각 방향

### 혈월 테마

- Night는 near-black burgundy surface, 짙은 crimson/oxblood panel과 혈월 형태의 diffuse glow를
  사용한다.
- Day는 bone/parchment surface와 낮은 채도의 burgundy accent를 사용해 가독성을 유지한다.
- 선택과 현재 focus는 muted gold를 유지해 붉은 brand surface 위에서 구분한다.
- brand red는 넓은 surface와 장식에 낮은 채도로 사용한다. 오류·파괴 행동은 더 밝고 선명한
  semantic red와 icon/label을 함께 사용해 색만으로 의미를 전달하지 않는다.
- Setup header의 천체는 icon이 아닌 평면 원이며 Night의 혈월색과 Day의 해 색만 전환한다.
  실제 phase 의미는 후속 Play 화면의 `낮`/`밤` label과 문구로 구분한다.
- desktop-site viewport에서도 천체는 header undo 왼쪽에 독립된 공간을 확보하고 서로 겹치지 않는다.
  mobile과 pad 전용 위치 보정은 유지한다.
- Prototype의 hex 값은 BMR 방향을 검토하기 위한 로컬 값이며 shared-shell 상수로 승격하지 않는다.

### 정보 위계

- 현재 Storyteller 작업과 Confirm이 화면의 첫 번째 시각 우선순위다.
- phase 순서, 상태 요약과 감사 정보는 보조 영역에 둔다.
- live-play copy는 짧고 행동 지향적으로 유지한다.
- fixture 상태는 review toolbar에만 설명하고, Production-like 화면에는 실제 제품에서 필요한
  label만 둔다.

## 화면 및 상호작용 계약

### 1. Setup

- Player 수와 유효 분포를 함께 표시한다.
- 25 Character를 kind별로 고정된 위치에 보여주고 선택으로 인해 card나 summary가 움직이지
  않게 한다.
- Godfather가 선택되면 가능한 분포 option을 Character 선택과 분리된 명시적 control로 보여준다.
- Godfather가 선택되지 않았으면 보정 control 전체를 숨기고, 선택 시 높이가 펼쳐지면서 아래의
  인원 구성 영역을 자연스럽게 밀어내게 한다.
- mobile에서는 상단의 큰 보정 control을 숨기고 고정 직업 설명 surface 위쪽에 간소화한 보정
  선택을 붙인다. 직업군 heading 자체에는 script 전용 control을 추가하지 않는다.
- 기본 Outsider가 0명인 7/10/13인에서는 가능한 `외지인 +1 / 주민 -1`을 처음부터 선택한다.
  양방향 option이 유효할 때만 Storyteller의 명시적 선택을 요구한다.
- 양방향 option이 유효한 경우 둘의 최종 Townsfolk/Outsider/Minion/Demon count를 즉시 비교할
  수 있게 한다.
- roster가 불완전하거나 Godfather choice가 없으면 Confirm을 비활성화하고 누락된 행동만 짧게
  표시한다.
- effective distribution 아래에는 선택한 보정 내용을 다시 반복하지 않는다.
- 확정된 Setup은 read-only summary로 다시 볼 수 있다.

### 2. Grimoire

- role-first와 seat-first 배치, Player 이름, 무작위 배치, 초기화와 명시적 Confirm은 기존 공용
  Grimoire 흐름을 따른다.
- Lunatic 좌석 inspector에서 Actual `미치광이`와 Shown Demon을 별도 identity card로 표시한다.
- 배치 Confirm 이후에는 seat 선택으로 Player detail을 볼 수 있지만 canonical-looking fixture
  상태를 수정할 수 없다.
- 확정 후 Player detail은 기존 Sects & Violets의 우측 slide-over / mobile bottom-sheet dialog 구조와
  정보 위계를 재사용한다. 2026-08-26에 제안했던 Grimoire 내부 고정 inspector는 기존 제품과 달라
  반려되었다.
- Player detail에 일반적인 `현재 상태 · 생존` summary를 추가하지 않는다. 하단은 기존 S&V의 부착
  토큰 영역으로 유지하고, BMR Character token 구현 전 프로토타입에서는 placeholder를 사용한다.
  중독·취함·능력 사용 등 실제 상태는 후속 Production에서 기존 원형 상태 token 형태로 표시한다.
- `배치로 돌아가기`는 데이터 손실 가능성을 설명하는 확인 dialog를 거친다.
- Zombuul apparent Death 좌석은 공개상 dead presentation을 유지하되 공식 진행처럼 일반
  funeral/shroud marker를 쓰지 않는다. Storyteller detail에는 좀버얼 `사망` reminder token을
  표시하며, 별도의 공개/실제 상태 card는 반복하지 않는다. ghost vote와 공개 등록은 dead로 보인다.
- protection 후보, 선택 중인 target, 실제 생존/사망은 서로 다른 shape, label과 state treatment를
  사용한다.

### 3. Play

- phase header에 `1일차 밤`, `2일차`, `2일차 밤` 같은 cycle과 Day/Night 상태를 표시한다.
- 현재 Character/Player, 필요한 입력과 primary action을 dominant current-task card에 둔다.
- official roster-filtered order를 complete/current/waiting/skipped 상태로 보여준다.
- 미자동화 Character step은 `처리 완료` / `해당 없음`만 제공한다. `수동 처리` 같은 prototype-only
  badge, 자동 결과, 추천 target이나 성공 추정 표현을 제공하지 않는다.
- current-task card는 Sects & Violets처럼 `현재 할 일 → Character identity → 능력 → 행동` 순서를
  사용한다. phase 순서와 중복되는 `N / total` badge를 추가하거나 행동을 과도하게 높은 card 바닥에
  고정하지 않는다.
- current Character identity는 표시만 하며 기존 S&V 진행 화면에 없는 click hint나 상세 action을
  추가하지 않는다.
- desktop-site의 Play panel은 제한된 최대 폭에 도달한 뒤 남는 공간을 좌우에 동일하게 배분해
  viewport 중앙을 유지한다. pad와 mobile에서 승인된 내부 여백은 별도로 유지한다.
- target 선택처럼 Grimoire가 필요한 작업은 기존 handoff를 따른다. 선택 확정 직후 결과는 같은
  Grimoire의 `completedSelection`에서 확인하고, `다음` 이후 진행 단계로 복귀한다.
- Mastermind extra Day의 trigger, label, 승리 조건과 진행 표현은 Character 구현에서 함께 결정한다.

### 4. ordered Death와 survival

- 한 action의 복수 결과는 같은 Grimoire의 기존 결과 영역에서 처리 순서를 구분할 수 있어야 한다.
- 각 결과는 target과 실제 `사망` / `생존` outcome을 우선 전달한다.
- Execution 후 생존은 별도 phase나 결과 화면을 추가하지 않고 기존 투표·결과 UI에서 표현한다.
- protection source, candidate audit, Resurrection과 dawn/public announcement의 내용은 관련
  Domain·Character 구현에서 결정한다.

### 5. private Reveal

- Reveal은 S&V와 같은 full-screen modal을 사용해 Grimoire, phase order, state, log와 review control을
  모두 가린다.
- BMR 색상 경계를 적용하되 player-facing 화면에는 해당 recipient의 정보만 전달한다.
- preview, payload, recipient 순서, close 이후 진행과 문구는 Reveal을 생산하는 Character 구현에서
  기존 S&V 흐름에 맞춰 결정한다.

## Review scenario

| ID | 화면/상태 | 검토 목적 |
| --- | --- | --- |
| `SET-01` | 7명, Godfather 없음 | 기본 분포, 25 Character catalog, 불완전/완전 roster와 Confirm |
| `SET-02` | 7명, Godfather 포함 | 유일한 `addOutsider` option의 자동 선택과 최종 분포 검토 |
| `SET-03` | 9명, Godfather 포함 | 양방향 option 비교와 `removeOutsider` 확정 결과 검토 |
| `GRI-00` | 7명/15명 기본 배치 | role-first/seat-first, 이름 편집, 최대 좌석 밀도와 Confirm 위치 검토 |
| `GRI-00B` | 확정된 7명/15명 마도서 | 읽기 전용 상세, 편집 도구 제거와 배치 복귀 확인 검토 |
| `GRI-01` | 15명 배치, Lunatic Actual/Shown identity | 최대 좌석, mobile inspector와 read-only 확정 상태 검토 |
| `NIT-01` | first night manual step | 공식 순서, 현재 단계, display-only Character identity 검토 |
| `SUR-01` | Execution 성립, executee 생존 | 별도 화면 반려; 기존 투표·결과 UI 재사용 |
| `ORD-01A` | Shabaloth 복수 공격의 mixed outcome | 마도서 `completedSelection` 안의 번호 순서와 결과 위계 검토 |
| `ORD-01B` | Resurrection 결과 | Character 구현으로 이관 |
| `REV-01` | Character별 private Reveal | 기존 S&V 전체화면 재사용만 결정; payload는 Character 구현으로 이관 |
| `ZOM-01/02` | Zombuul apparent/actual Death | reminder-token 영역 사용만 결정; 동작은 Character 구현으로 이관 |
| `MAS-01` | Mastermind extra Day | Character 구현으로 이관 |

Scenario 전환은 state를 직접 fixture로 교체해도 된다. Production-like control은 canonical command가
존재하는 것처럼 동작하지 않으며, fixture임을 review toolbar에서 명시한다.

## Viewport 검토 매트릭스

| 분류 | 기준 viewport | 필수 specimen |
| --- | --- | --- |
| 작은 mobile | 360 × 800 | `SET-02`, `NIT-01` |
| 일반 mobile | 390 × 844 | `GRI-01`, `ORD-01A` |
| iPad portrait | 768 × 1024 | `SET-03`, `GRI-01`, `ZOM-01` |
| iPad landscape | 1024 × 768 | `NIT-01`, `ORD-01A` |
| desktop | 1440 × 900 | 전체 scenario, 특히 7/9/15명 비교 |

모든 기준에서 핵심 정보, target 상태와 primary Confirm이 viewport 밖으로 잘리거나 fixed control에
가려지지 않아야 한다. mobile sheet/dialog는 safe-area를 존중하고 keyboard focus, screen-reader,
reduced-motion 상태를 함께 확인한다.

## Acceptance invariants와 증거

| 불변조건 | 가장 강한 증거 |
| --- | --- |
| Setup, 현재 단계, 입력과 다음 행동이 구분된다 | 360/768/1440 visual review와 실제 interaction walkthrough |
| 단일 Godfather option은 자동 선택되고 양방향 option은 명시 선택한다 | `SET-02/03` 선택 상태 walkthrough |
| 미자동화 단계가 자동 성공처럼 보이지 않는다 | manual badge/button와 자동 결과 control 부재 검토 |
| 확정 Grimoire는 읽기 전용이며 수정은 확인을 요구한다 | seat/detail/return dialog walkthrough |
| ordered outcome의 sequence와 결과가 보존된다 | `ORD-01` 표시 순서와 Storyteller detail 검토 |
| player-facing Reveal은 Storyteller shell과 정보를 가린다 | 기존 S&V full-screen Reveal 경계 검토 |
| Character별 상태가 공용 shell에 별도 임시 UI를 만들지 않는다 | 이관 목록과 retained example diff 검토 |
| mobile/iPad에서 primary Confirm과 핵심 상태가 잘리지 않는다 | target viewport screenshots와 실제 pointer/keyboard walkthrough |
| prototype은 development-only이고 TB/S&V를 변경하지 않는다 | production build, DEV guard와 diff review |

격리된 UI prototype 단계에서는 자동화 테스트를 선행하지 않는다. prototype test server를 프로젝트
lifecycle manager를 통해 실행하고 실제 interaction과 target viewport를 검토해 참고 화면을
캡처한다. shared Production component 또는 실제 runtime behavior가 바뀌는 경우에만 역할,
accessible name, 단계 전환과 정보 경계에 대한 focused test를 추가한다.

## 예상 파일 경계

- `web/src/issue179BadMoonRisingShellPrototype.tsx`: fixture model, review scenario와 화면 조합
- `web/src/issue179BadMoonRisingShellPrototype.css`: BMR adapter theme와 prototype-only layout
- `web/src/issue179BadMoonRisingShellPrototype.NOTES.md`: review 중 승인·반려 결정 기록
- `web/src/issue179BadMoonRisingGrimoirePrototype.tsx`: Stage 2A 기본 배치 fixture와 상호작용
- `web/src/issue179BadMoonRisingGrimoirePrototype.css`: 승인된 BMR theme의 Grimoire 적용
- `web/src/issue179BadMoonRisingGrimoirePrototype.NOTES.md`: Stage 2A 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingConfirmedGrimoirePrototype.tsx`: Stage 2B 읽기 전용 상세와 복귀 확인
- `web/src/issue179BadMoonRisingConfirmedGrimoirePrototype.css`: Stage 2B 상세·dialog 반응형 표현
- `web/src/issue179BadMoonRisingConfirmedGrimoirePrototype.NOTES.md`: Stage 2B 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingLunaticIdentityPrototype.tsx`: Stage 2C 전용 entry wrapper
- `web/src/issue179BadMoonRisingLunaticIdentityPrototype.NOTES.md`: Stage 2C 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingZombuulStatePrototype.tsx`: Stage 2D 전용 entry wrapper
- `web/src/issue179BadMoonRisingZombuulStatePrototype.NOTES.md`: Stage 2D 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingFirstNightPrototype.tsx`: Stage 3A official order와 manual task 예시
- `web/src/issue179BadMoonRisingFirstNightPrototype.css`: Stage 3A BMR Play theme와 반응형 표현
- `web/src/issue179BadMoonRisingFirstNightPrototype.NOTES.md`: Stage 3A 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingOrderedDeathPrototype.tsx`: Stage 3C 기존 Grimoire 결과 흐름 예시
- `web/src/issue179BadMoonRisingOrderedDeathPrototype.css`: ordered-result review styling
- `web/src/issue179BadMoonRisingOrderedDeathPrototype.NOTES.md`: Stage 3C 검토 범위와 결정 기록
- `web/src/issue179BadMoonRisingSurvivalPrototype.NOTES.md`: 반려된 Stage 3B 결정 기록
- `web/src/issue179BadMoonRisingPrivateRevealPrototype.NOTES.md`: 반려된 Stage 4A 결정 기록
- `web/src/main.tsx`: development-only lazy entry
- `docs/prototypes/issue-179-final-prototype.md`: 검토 결과, 유지할 요구사항과 후속 구현 경계

공용 component 변경이 필요해지면 BMR 요구가 아니라 script-neutral presentation 계약인지 먼저
확인한다. shared 변경은 TB/S&V consumer와 회귀 증거를 별도로 검토한다.

## 구현 및 검토 순서

1. fixture와 review toolbar를 만들되 Production-like 화면 밖에 둔다.
2. shared Production shell을 조합해 Setup과 Godfather option을 구현한다.
3. lifecycle-managed review server에서 Setup viewport와 interaction을 검토하고 승인을 받는다.
4. 승인 후 별도 entry에서 7/15명 Grimoire 기본 배치와 이름·Confirm 위치를 먼저 검토한다.
5. 기본 배치 승인 후 Lunatic identity와 확정/read-only·복귀 흐름을 검토한다.
6. 공식 phase order와 explicit manual task를 Play surface에 구현한다.
7. 별도 survival 화면은 반려하고 ordered outcome은 기존 Grimoire 결과 흐름에서 검토한다.
8. Character별 Resurrection, Reveal, Zombuul actual Death와 Mastermind extra Day는 후속 구현으로
   이관한다.
9. 검토한 slice에서 혈월 Day/Night theme, contrast와 motion 요구사항을 기록한다.
10. TypeScript 검사와 Production build를 실행한다. shared Production code나 실제 behavior가 바뀌면
   focused test와 필요한 전체 web test도 실행한다.
11. 승인·반려 결정을 NOTES와 이 계획에 반영하고 final prototype archive를 만든다.

## 완료 시 기록할 결정

- Blood Moon Day/Night 방향과 contrast 요구사항
- Setup summary와 Godfather option에서 유지할 동작
- 15명 Grimoire에서 확인한 정보 위계와 Lunatic/Zombuul 후속 구현 경계
- manual step과 ordered outcome에서 유지할 정보 경계
- private Reveal의 공용 full-screen 경계와 Character 구현으로 이관한 내용
- 후속 Production 인수 시 확인할 target viewport와 interaction
- 후속 Production adapter가 제공해야 할 input, preview, Reveal, result와 follow-up data
