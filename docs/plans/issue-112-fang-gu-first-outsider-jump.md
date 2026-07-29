# Issue 112: Fang Gu First Outsider Jump

## Workflow checkpoint

- Phase: prototype
- Status: waiting-for-user
- Approved: D1 공식 Fang Gu `한 번` 토큰 표현 재사용; D2 UI prototype 필요; S1 분석 범위 승인
- Open questions: P1 global token 위치 A `중앙 인접` 또는 B `안쪽 가장자리`; P2 공격 확정 → 공개 안내 → evil Fang Gu 역할 공개 → 완료 흐름 승인 여부
- Branch: codex/issue-112
- Worktree: /private/tmp/clocktower-issue-112
- Test server: PID 22348; /var/folders/cc/6cn4twr55vz_zlmcglnl2pn80000gn/T/clocktower-test-server-112
- Next action: 사용자가 prototype의 token 위치와 Reveal 흐름을 검토·승인하면 plan phase로 전환한다.

## 분석 근거

- GitHub Issue #112 본문과 2026-07-21~22 댓글
- 의존 Issue #97, #100, #111, #119, #121, #129의 본문·댓글과 현재 `develop`
- 2026-07-22 기준으로 저장소에 보존된 공식 Fang Gu 규칙 revision 2974 및 공식 예시
- 현재 `ARCHITECTURE.md`, S&V setup, Demon attack, identity transition, death consequence,
  replay, Reveal, token presentation 구현과 관련 회귀
- 공식 Wiki `Fang Gu` 페이지의 Summary, How to Run, Examples 원문을 2026-07-29에 재확인

## 현재 동작과 문제

### 이미 제공되는 기반

- Issue #97이 Fang Gu의 setup 분포 `-1 Townsfolk, +1 Outsider`와 setup 화면의 유효 인원
  표시를 구현했다. Issue #112 댓글은 이 baseline setup 계약과 회귀의 소유권을 #97로
  명시적으로 이관했다.
- Issue #100이 네 S&V Demon의 공통 later-Night 행동을 구현했다. 현재 Fang Gu는 Player 한
  명을 선택하며, 살아 있는 대상은 Character 종류와 무관하게 즉시 사망한다. canonical
  `nightActionResolved / demonAttack` 이벤트는 actor, actor Character snapshot, target, typed
  death 또는 no-effect를 기록하고 replay, Undo와 다음 날 사망 발표를 복원한다.
- 공통 공격은 이미 죽은 대상에는 `targetAlreadyDead`, 취함/중독된 Demon에는
  `actorImpaired`, 그 밤 Pit-Hag가 Demon을 만들었으면 `pitHagCreatedDemon` no-effect를
  기록한다. 일반 대상, 죽은 대상, 자기 공격의 baseline 정답은 #100이 소유한다.
- Issue #129가 actual/shown Character, alignment와 생존 상태의 typed identity transition,
  새 ability instance, pending identity Reveal과 동적 Night 순서를 제공한다. 정상 wake
  order가 남은 새 능력은 그 순서에 한 번 실행되고, 같은 rank이거나 이미 지난 능력은
  다음 밤까지 기다린다.
- Issue #121의 UI는 Rust가 계산한 canonical automatic reminder를 읽기 전용으로 표시할 수
  있지만 현재 계약은 Player 귀속 상태이다. 공식 Fang Gu `ONCE`처럼 Grimoire 중앙에 남는
  게임 전역 상태 surface는 아직 production에 없으며, D1이 공식 token presentation을
  사용하는 전역 reminder로 제품 방향을 확정했다.

### 잘못되거나 누락된 동작

- 아직 첫 살아 있는 Actual Outsider를 공격해도 일반 대상처럼 그 Outsider가 죽는다.
  따라서 기존 Fang Gu의 대신 사망, 대상의 evil Fang Gu 전환, 대상 생존, identity Reveal과
  game-wide ONCE 소비가 없다.
- jump 소비 상태가 canonical state에 없어서 이후 Fang Gu가 Outsider를 공격할 때 정상
  사망으로 되돌아가는 조건을 replay할 수 없다.
- 대상 Outsider가 살아남아야 하므로 Sweetheart 등 대상의 death-trigger ability가
  발동하면 안 되지만, 현재 baseline death 결과는 후속 death consequence를 만들 수 있다.
- 현재의 일반 ability-instance 원칙은 새 once-per-game 능력 획득 시 사용 기회를
  초기화한다. 공식 Fang Gu ONCE는 Player나 ability instance가 아니라 게임 전체에서 단
  한 번이며, Fang Gu가 죽거나 Character가 바뀌어도 절대 초기화하지 않는 명시적 예외가
  필요하다.
- 기존 Character-change Reveal과 공격 선택 UI는 재사용한다. jump 결과의 영구 ONCE 소비는
  별도 일반 텍스트 상태칩이 아니라 기존 공식 Fang Gu 도상과 공식 reminder 라벨 `한 번`을
  결합한 token presentation으로 계속 표시한다.

## 최종 요구사항

### 규칙 계약

- Fang Gu의 현재 살아 있는 Actual Character가 실제 Outsider인 살아 있는 대상을 정상적으로
  죽이려 하고, 아직 game-wide jump가 소비되지 않았다면 첫 jump를 적용한다.
- `shownCharacter`, 현재 alignment와 Player의 주장/등록은 Outsider 판정에 사용하지 않는다.
  기본 S&V의 rules truth인 replayed Actual Character kind를 사용한다. 이미 evil인 Outsider도
  Character kind가 Outsider이면 같은 규칙을 적용하고 결과 alignment는 evil이다.
- jump는 한 canonical 결과로 다음 상태를 함께 확정한다.
  - 공격 대상은 죽지 않고 현재 생존 상태를 유지한다.
  - 기존 Fang Gu만 사망한다.
  - 공격 대상의 actual/shown Character가 Fang Gu로 바뀌고 alignment가 evil이 된다.
  - 새 Fang Gu의 ability instance와 identity history가 그 전환에서 시작된다.
  - game-wide ONCE가 소비된다.
- 새 Fang Gu에게 Character와 evil alignment를 비공개 Reveal한다. 첫날 밤 Demon/Minion 정보는
  다시 주지 않는다.
- jump 대상이 죽지 않았으므로 그 Outsider의 death-trigger ability와 사망 표식, ghost vote,
  다음 날 사망 발표가 생기지 않는다.
- 기존 Fang Gu의 실제 Night death만 다음 날 공개 사망 목록에 포함한다. 공개 발표와 요약은
  Fang Gu jump라는 원인이나 새 Demon의 identity를 노출하지 않는다.
- 기존 Fang Gu 행동 단계가 이미 완료됐으므로 새 Fang Gu는 같은 밤 다시 행동하지 않는다.
  다음 later Night부터 현재 Fang Gu로 정상 행동한다.
- 소비 후에는 어떤 Player가 Fang Gu 능력을 새로 얻더라도 ONCE가 복구되지 않는다. 이후
  살아 있는 Outsider 공격은 #100의 일반 사망 계약을 따른다.
- Undo로 jump 이벤트를 제거하면 기존 Fang Gu의 생존, 대상 identity/alignment, 대상 생존,
  ONCE 사용 가능, Reveal task와 발표 대기 목록이 모두 함께 복원된다. replay, reload,
  export/import도 동일한 상태를 재현한다.
- ONCE가 소비된 동안 Grimoire의 게임 전역 reminder 영역에 공식 Fang Gu 도상과 공식 라벨
  `한 번`을 사용하는 read-only token을 표시한다. 어느 Player에게도 귀속하지 않으며 old
  Fang Gu가 죽거나 Character가 바뀌어도 유지한다. Undo로 소비 전으로 돌아가면 제거한다.

### jump가 일어나지 않는 조건

- 이미 사망한 Outsider를 선택하면 #100의 `targetAlreadyDead` no-effect이며 ONCE를 소비하지
  않는다.
- Fang Gu actor가 취함/중독되어 능력이 정상 작동하지 않으면 아무도 죽지 않고 jump도
  소비하지 않는다.
- 행동자가 그 이벤트 경계에서 살아 있는 Actual Fang Gu가 아니면 jump를 만들 수 없다.
- 그 밤 Pit-Hag Demon 생성 때문에 Demon 공격이 사망 대상 후보 기록으로 처리되면 jump도
  소비하지 않는다.
- 현재 또는 향후 다른 규칙 때문에 공격 대상이 실제로 죽지 않는 결과라면 공식 규칙대로
  jump도 일어나지 않고 ONCE도 남는다.
- 살아 있는 non-Outsider는 #100의 일반 사망 계약을 따른다. 공격 대상 선택 자체는
  Outsider 여부로 제한하지 않는다.

### 공식 예시와 edge-case 소유

- 공식 `fangGu-example-1`의 단일 연속 시나리오를 #119가 지정한 `json-acceptance`로 유지한다:
  Artist 정상 사망 → 첫 Sweetheart jump와 기존 Fang Gu 대신 사망 → Sweetheart 능력
  미발동 → 다음 밤 새 Fang Gu의 Klutz 정상 사망.
- #112는 이 공식 예시와 jump 자체의 focused regression을 소유한다. #111은 여러 Character가
  결합된 최종 fixture, 저장·재생 equivalence와 전체 S&V 누락 점검을 소유하며 #112의 최소
  회귀를 대신하지 않는다.

## Behavioral acceptance criteria

1. 아직 ONCE가 소비되지 않은 정상 Fang Gu가 살아 있는 Actual Outsider를 공격하면 대상은
   생존한 evil Fang Gu가 되고 기존 Fang Gu만 사망한다.
2. jump 대상의 actual/shown Character, alignment와 ability instance가 동일한 confirmed
   결과에서 갱신되고 새 Fang Gu에게 비공개 CharacterChange Reveal이 제공된다.
3. jump 대상은 canonical하게 한 번도 죽지 않으므로 death-trigger ability, ghost vote,
   사망 표식과 다음 날 사망 발표가 생기지 않는다.
4. 다음 날 공개 사망 목록에는 기존 Fang Gu만 포함되며 announcement와 공개 요약은 jump
   원인과 새 Demon identity를 노출하지 않는다.
5. 새 Fang Gu는 jump가 일어난 같은 밤 다시 행동하지 않고 다음 later Night부터 정상
   Demon 행동을 한다. 새 Minion/Demon setup 정보도 받지 않는다.
6. jump와 동시에 game-wide ONCE가 소비되고, 이후 Fang Gu가 살아 있는 Outsider를 공격하면
   #100의 일반 사망 계약을 따른다.
7. Fang Gu가 죽거나 Character가 바뀌고 다른 Player가 Fang Gu 능력을 새로 얻어도 ONCE는
   재충전되지 않는다.
8. 이미 죽은 Outsider, impaired actor, non-Actual Fang Gu 또는 `pitHagCreatedDemon` no-effect처럼
   공격이 실제 사망을 만들지 못하는 경우 jump와 ONCE 소비가 모두 발생하지 않는다.
9. ONCE가 소비된 동안 공식 Fang Gu 도상과 공식 `한 번` reminder 라벨을 사용하는 read-only
   global token이 Grimoire에 보이고 어느 Player에게도 귀속되지 않는다.
10. Undo는 기존 Fang Gu 생존, 대상 identity/alignment와 생존, pending Reveal, 공개 사망 목록과
    ONCE token을 모두 소비 전 상태로 되돌린다.
11. replay, reload와 export/import는 jump target, old Demon death, new Fang Gu identity,
    game-wide ONCE, pending/acknowledged Reveal과 announcement state를 동일하게 복원한다.
12. 공식 `fangGu-example-1`은 Artist 정상 사망, Sweetheart jump와 능력 미발동, 다음 밤 새
    Fang Gu의 Klutz 정상 사망까지 하나의 재현 가능한 acceptance 흐름으로 성립한다.

## UI prototype requirement

- UI prototype은 필수로 승인됐다.
- 기존 S&V 공격 선택과 CharacterChange Reveal 표현을 유지하면서 공식 Fang Gu `한 번`
  global token의 Grimoire 위치, jump 완료 후 Reveal 진입, iPad/mobile 가독성을 검토한다.
- prototype은 presentation과 interaction만 결정하며 위 domain requirements를 다시 열지 않는다.

## Prototype plan

### 검토할 결정

- canonical jump 직후 공식 Fang Gu `한 번` global reminder를 Grimoire 안에서 지속적으로
  알아볼 수 있는 위치
- old Fang Gu death와 new Fang Gu identity가 반영된 마도서에서 기존 CharacterChange Reveal
  안내·공개·복귀 흐름이 자연스러운지
- global reminder가 어느 Player에게도 귀속된 것처럼 보이지 않고, Reveal 중에도 Storyteller가
  jump 소비를 확인할 수 있는지

### 표시 variant

- A `중앙 인접`: 현재 phase clock/Reveal 안내 바로 아래에 global token을 배치한다. 공식
  Grimoire 중앙 reminder 의미와 가장 가깝지만 중앙 작업과의 밀도를 검토한다.
- B `안쪽 가장자리`: Grimoire 우측 아래 안쪽에 global token을 고정한다. 중앙 작업을 덜
  방해하지만 작은 화면에서 Player seat와 혼동되는지 검토한다.
- 두 variant 모두 #121의 approved token primitive, 공식 Fang Gu 도상과 공식 `한 번` 라벨을
  사용한다. 일반 텍스트 상태칩 variant는 분석에서 제외됐다.

### Fixture states

- `공격 선택`: 살아 있는 Sweetheart가 선택된 첫 jump 직전이며 아직 ONCE token은 없다.
- `공개 안내`: confirm 직후 old Fang Gu는 dead, Sweetheart는 살아 있는 evil Fang Gu이며
  global ONCE token과 CharacterChange Reveal 안내가 동시에 보인다.
- `역할 공개`: 기존 player-facing evil Fang Gu CharacterChange Reveal을 사용한다.
- `완료`: Reveal을 닫고 다음 Night step으로 돌아와도 global ONCE token이 유지된다.

### Target viewports

- wide desktop/tablet: 1180×820 이상
- iPad portrait/compact tablet: 820×1180 전후
- mobile: 390×844 전후

Prototype은 hard-coded fixture만 사용하며 WASM, store, persistence, command 또는 실제 domain
resolution을 연결하지 않는다.

### Prototype verification (2026-07-29)

- 검토 URL:
  `http://100.91.205.43:4173/clocktower/sects-and-violets/?prototype=issue-112-fang-gu-jump`
- production의 Demon 공격 선택, `CharacterChangeRevealPrompt`, `CharacterChangeReveal`, 공식
  Fang Gu asset과 approved token primitive를 그대로 조합했다. fixture 외 domain/store/WASM
  경로는 연결하지 않았다.
- 실제 상호작용으로 공격 확정 → Player 3 공개 안내 → evil Fang Gu 역할 공개 → 확인 → 다음
  Night step 복귀를 끝까지 통과했다. jump 후 old Fang Gu만 사망하고 Player 3은 살아 있는 evil
  Fang Gu이며, global `한 번` token은 안내·공개·완료 상태에 모두 유지됐다.
- DOM 접근성 구조에서 token은 Player seat 밖의 read-only `status`이며 `게임 전역 표식 · 팡 구
  한 번 · 자동 · 편집 불가`로 식별된다. 어느 Player token에도 귀속되지 않는다.
- 1180×820, 820×1180, 390×844에서 DOM과 시각 배치를 확인했고 브라우저 warning/error는
  없었다. A는 wide/tablet에서 중앙 reminder 의미가 가장 명확하고 mobile에서도 `게임 전역`
  라벨로 Player 귀속과 구분된다. B는 특히 portrait에서 아래 공간이 커지고 우측 Player seat에
  가까워 귀속 상태처럼 읽힐 위험이 있어 A를 권고한다.
- `pnpm --dir web build`가 wasm, TypeScript, Vite/PWA build를 포함해 통과했다.

## 명시적 비범위

- Fang Gu의 baseline setup 분포, setup 경고와 setup UI/count regression은 #97 계약을
  그대로 소비하며 #112에서 중복 구현하지 않는다.
- 일반 Player, 이미 죽은 Player, 자기 자신에 대한 S&V Demon baseline attack은 #100의
  기존 계약을 재사용한다.
- Sweetheart, Barber, Klutz의 일반 death consequence 자체는 #103 소유이다. #112는 jump
  대상이 죽지 않아 그 consequence가 생기지 않는 경계만 소유한다.
- Pit-Hag가 Demon을 만들 때의 arbitrary deaths와 다중 Demon 전체 규칙은 #104 및 #111의
  소유권을 바꾸지 않는다. 다만 기존 `pitHagCreatedDemon` no-effect가 Fang Gu ONCE를
  소비하지 않는 회귀는 #112 범위이다.
- 모든 S&V reminder의 수동 배치 UI나 공용 token interface를 다시 설계하지 않는다.
  #121 계약을 재사용하고 Fang Gu 특화 canonical 상태와 표시 의미만 #112가 정한다.
- off-script Characters, Travellers, jinx와 custom-script registration은 다루지 않는다.
- jump 원인을 낮 공개 정보나 announcement에 추가하지 않는다.

## 영향 경계, 의존성과 위험

### 소유 경계

- Rust domain은 canonical 공격 결과, game-wide 소비 상태, atomic death/identity transition,
  replay 검증, Night ordering, death consequence 입력과 공개 사망 목록을 소유한다.
- S&V 전용 Fang Gu 판정은 `ARCHITECTURE.md`에 따라 S&V Character rules 경계에 남아야 한다.
  공통 event/replay 계층은 atomic confirmed state와 script dispatch만 담당한다.
- TypeScript는 Rust 결과를 검증하고 기존 공격 선택, canonical append/Undo, identity Reveal,
  event history와 token/status presentation을 연결한다. React가 Outsider, jump 가능 여부,
  ONCE 소비 또는 같은 밤 재행동 여부를 추론하지 않는다.
- 저장된 confirmed event stream이 source of truth이며 별도 UI boolean으로 jump 상태를
  유지하지 않는다.

### 의존성

- #97: baseline Fang Gu setup modifier와 setup UX
- #100: S&V Demon baseline attack, typed death/no-effect와 dawn announcement
- #103: Outsider death consequence
- #115: S&V persistence, import/export와 Undo lifecycle
- #119: 공식 한국어 문구, ruling, How to Run, example inventory
- #121: read-only canonical token presentation
- #129: identity transition, ability instance, pending Reveal와 dynamic Night scheduling
- #111: cross-Character acceptance 및 전체 persistence equivalence

### 주요 위험

- death, identity 변경과 ONCE 소비가 분리된 이벤트/상태가 되면 중간 저장, Undo 또는 변조된
  import에서 불가능한 반쪽 jump가 생길 수 있다.
- Fang Gu ONCE를 일반 once-per-ability-instance와 공유하면 Character 변경이나 새 Fang Gu
  획득 때 잘못 재충전된다.
- target을 먼저 dead로 처리했다가 되살리는 식의 결과는 Sweetheart/Barber/Klutz trigger,
  ghost vote와 dawn announcement를 오염시킬 수 있다. 대상은 한 번도 죽지 않은 canonical
  결과여야 한다.
- 새 Fang Gu를 일반 동적 능력 획득으로만 스케줄링하면 같은 rank 처리 실수로 같은 밤 두
  번째 Demon action이 생길 수 있다.
- 원인 비공개 발표와 Storyteller-only identity Reveal의 경계가 무너지면 새 Demon identity가
  공개 UI나 event summary에 노출될 수 있다.
- 기존 baseline `demonAttack` event 및 과거 S&V 저장 파일의 replay/import 호환성을 유지해야
  한다.
- 공식 ONCE는 어느 Player에도 귀속되지 않고 게임 끝까지 남는다. 승인된 공식 Fang Gu token
  presentation은 재사용하되 Player 귀속 automatic reminder로 옮기면 old Fang Gu의 Character
  변경/사망 후 오해를 만든다.

## 필요한 결정

### D1. game-wide ONCE 상태를 어디에 표시할 것인가?

- 영향: Storyteller가 이후 Outsider 공격이 jump인지 일반 사망인지 즉시 판별할 수 있는지,
  그리고 Fang Gu가 죽거나 Character가 바뀐 뒤에도 상태의 소유권이 오해 없이 남는지를
  결정한다.
- 권고: 공식 reminder 위치와 lifetime에 맞춰 어느 Player에도 귀속하지 않은 read-only 전역
  reminder를 Grimoire의 지속 상태 영역에 표시한다. #121의 token presentation과 공식 Fang Gu
  도상, 공식 라벨 `한 번`을 그대로 활용하고 별도 일반 텍스트 상태칩을 만들지 않는다. event
  history만으로 확인하게 하거나 old Fang Gu Player token으로 붙이는 방식은 피한다.
- 사용자 결정: 2026-07-29 승인. “공식 팡구 토큰 표시가 있을 건데, 그걸 활용”한다.

### D2. #112에 UI prototype gate가 필요한가?

- 영향: 새 전역 상태의 iPad/mobile 위치와 jump 직후 기존 identity Reveal handoff가 실제
  Storyteller 흐름에서 충분히 명확한지 구현 전에 검토할지 결정한다.
- 권고: 필요. 공격 대상 선택과 CharacterChange Reveal 자체는 기존 컴포넌트를 재사용하되,
  D1의 전역 ONCE 표시, jump 완료 후 Reveal 진입, event/announcement 비공개 경계를 하나의
  작은 production-shaped specimen에서 승인한다. 규칙 계약은 다시 열지 않는다.
- 사용자 결정: 2026-07-29 승인.

### S1. 위 분석 범위를 승인하는가?

- 영향: 승인되면 다음 분석 호출에서 finalized requirements와 behavioral acceptance criteria를
  고정하고 `analysis-approved / complete`로 전환할 수 있다.
- 권고: 승인. D1과 D2 반영 후 다른 material product ambiguity는 없다.
- 사용자 결정: 2026-07-29 승인.

## 현재 분석 결론

- 공식 규칙과 이슈 이력으로 jump의 domain behavior, 실패 조건, 대상 생존, death-trigger
  억제, 같은 밤 재행동 금지, 원인 비공개 발표와 game-wide ONCE lifetime은 확정적으로
  해석할 수 있다.
- D1은 공식 Fang Gu `한 번` token presentation 재사용, D2는 작은 UI prototype 필요로
  승인됐다. 다른 material product ambiguity는 없다.
- 사용자가 전체 분석 범위를 승인했으며 finalized requirements, behavioral acceptance
  criteria와 UI prototype 필요 여부가 확정됐다. 분석 checkpoint는
  `analysis-approved / complete`이다.
