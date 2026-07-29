# Issue 112: Fang Gu First Outsider Jump

## Workflow checkpoint

- Phase: accept
- Status: waiting-for-user
- Approved: D1 공식 Fang Gu `한 번` 토큰 표현 재사용; D2 UI prototype 필요; S1 분석 범위 승인; P1 B 새 Fang Gu 귀속 표시; P2 공격 확정 → 공개 안내 → evil Fang Gu 역할 공개 → 완료 흐름; I1 production architecture/implementation plan
- Open questions: none
- Branch: codex/issue-112
- Worktree: /private/tmp/clocktower-issue-112
- Test server: PID 33968; state `/var/folders/cc/6cn4twr55vz_zlmcglnl2pn80000gn/T/clocktower-test-server-112`; `http://100.91.205.43:4173/`
- Next action: 사용자가 live acceptance checklist를 확인하고 승인 또는 수정 피드백을 준다.

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
- ONCE가 소비된 동안 공식 Fang Gu 도상과 공식 라벨 `한 번`을 사용하는 read-only token을
  B안대로 jump 대상 Player의 기존 token count/detail presentation에 표시한다. 표시 위치만
  jump 대상에 귀속하며 source of truth는 Player ability instance가 아니라 canonical game-wide
  소비 상태이다. Undo로 소비 전으로 돌아가면 제거한다.

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
   token이 jump 대상 Player의 token count/detail에 보이며 canonical source는 game-wide
   상태이다.
10. Undo는 기존 Fang Gu 생존, 대상 identity/alignment와 생존, pending Reveal, 공개 사망 목록과
    ONCE token을 모두 소비 전 상태로 되돌린다.
11. replay, reload와 export/import는 jump target, old Demon death, new Fang Gu identity,
    game-wide ONCE, pending Reveal과 announcement state를 동일하게 복원한다. jump 직후
    Reveal 확인만 하고 다음 canonical event를 확정하기 전에 reload하면 안전하게 다시
    공개 안내를 표시한다.
12. 공식 `fangGu-example-1`은 Artist 정상 사망, Sweetheart jump와 능력 미발동, 다음 밤 새
    Fang Gu의 Klutz 정상 사망까지 하나의 재현 가능한 acceptance 흐름으로 성립한다.

## UI prototype requirement

- UI prototype은 필수로 승인됐다.
- 기존 S&V 공격 선택과 CharacterChange Reveal 표현을 유지하면서 공식 Fang Gu `한 번`
  reminder의 A/B 표시 위치, jump 완료 후 Reveal 진입, iPad/mobile 가독성을 검토한다.
- prototype은 presentation과 interaction만 결정하며 위 domain requirements를 다시 열지 않는다.

## Prototype plan

### 검토할 결정

- canonical jump 직후 공식 Fang Gu `한 번` reminder를 공식 중앙에 직접 표시할지, 앱이
  새 Fang Gu Player에 귀속해 표시할지
- old Fang Gu death와 new Fang Gu identity가 반영된 마도서에서 기존 CharacterChange Reveal
  안내·공개·복귀 흐름이 자연스러운지
- 두 표시안 모두 Player와 독립적인 canonical game-wide 소비 상태를 정확히 전달하는지

### 표시 variant

- A `공식 중앙`: 현재 phase clock/Reveal 안내 바로 아래에 실제 reminder에
  가까운 작은 원형 token을 배치한다. #121의 approved token primitive, 공식 Fang Gu 도상과
  공식 `한 번` 라벨을 사용하되 Player token보다 작게 표현하고 비공식 `게임 전역` 라벨은
  표시하지 않는다.
- B `새 팡 구 귀속`: 앱이 game-wide 소비 상태와 reminder 수명을 자동 관리하므로 새 Fang Gu
  Player의 기존 token count/detail presentation에 공식 `한 번` reminder를 귀속한다. 자리에는
  `+1` badge가 보이고 Player 상세에서 `한 번 · 출처 팡 구`를 확인한다. 실제 상태의 source of
  truth는 Player가 아니라 canonical game-wide state이며, Undo나 후속 Character 변경에도
  앱이 올바른 표시 대상과 수명을 계산한다는 production 전제를 둔다.
- 폐기안 A `중앙 대형`: Player-pinned token 크기라 별도 Character token처럼 보일 수 있어
  2026-07-29 사용자 피드백으로 폐기했다.
- 폐기안 B `안쪽 가장자리`: 공식 중앙 배치와 다르고 Player 귀속으로 오해될 수 있어
  2026-07-29 사용자 피드백으로 폐기했다.

### Fixture states

- `공격 선택`: 살아 있는 Sweetheart가 선택된 첫 jump 직전이며 아직 ONCE token은 없다.
- `공개 안내`: confirm 직후 old Fang Gu는 dead, Sweetheart는 살아 있는 evil Fang Gu이며
  선택한 A/B ONCE presentation과 CharacterChange Reveal 안내가 함께 적용된다.
- `역할 공개`: 기존 player-facing evil Fang Gu CharacterChange Reveal을 사용한다.
- `완료`: Reveal을 닫고 다음 Night step으로 돌아와도 선택한 A/B ONCE presentation이 유지된다.

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
  Fang Gu asset, player token count/detail presentation을 그대로 조합했다. fixture 외
  domain/store/WASM 경로는 연결하지 않았다.
- 실제 상호작용으로 공격 확정 → Player 3 공개 안내 → evil Fang Gu 역할 공개 → 확인 → 다음
  Night step 복귀를 끝까지 통과했다. jump 후 old Fang Gu만 사망하고 Player 3은 살아 있는 evil
  Fang Gu이며, 선택한 A/B presentation은 canonical ONCE 소비 fixture에서 파생된다.
- A는 Player seat 밖의 read-only `status`이며 `팡 구 한 번 표식 · 그리모어 중앙 · 자동 ·
  편집 불가`로 식별된다. Player token보다 작은 원형 reminder이고 비공식 `게임 전역` 문구는
  없다. wide와 tablet에서는 중앙 phase/Reveal 바로 아래에 놓이고, mobile에서는 phase card와
  아래 좌석 사이의 제한된 중앙 공간을 차지한다.
- B는 새 Fang Gu인 Player 3에 token 1개와 `+1` badge를 표시한다. 일반 Grimoire에서 Player 3을
  열면 `한 번 · 출처 팡 구` official asset token을 read-only 상세로 확인한다. production의
  player-safe Reveal prompt 동안에는 token count badge가 숨고, Reveal 완료 후 정상 Grimoire로
  돌아오면 다시 나타난다.
- 1180×820, 820×1180, 390×844에서 A/B DOM, 시각 배치와 B Player 상세를 확인했다. A는 공식
  물리 위치를 직접 보존하지만 mobile 중앙 작업 영역이 더 조밀하다. B는 중앙 작업을 전혀
  가리지 않고 현재 새 Demon과 소비 상태를 한 곳에서 보지만, official 중앙 배치와는 다르다.
  브라우저 warning/error는 없었다.
- `pnpm --dir web build`가 wasm, TypeScript, Vite/PWA build를 포함해 통과했다.

### Prototype feedback: ONCE reminder placement (2026-07-29)

- 사용자 피드백: ONCE token이 전역 중앙이 아니라 old/new Fang Gu Player 중 하나에 놓이는
  표식인지 공식 규칙을 다시 확인해야 한다.
- 현재 공식 Wiki `Fang Gu` How to Run은 jump 전에는 ONCE reminder가 Grimoire 중앙에 있는지로
  이미 사용됐는지 판정하고, 첫 jump 후 ONCE reminder를 Grimoire 중앙에 놓으라고 명시한다.
  Fang Gu가 죽거나 Character가 바뀌어도 게임 끝까지 제거하지 않는다는 주석도 있다.
  (`https://wiki.bloodontheclocktower.com/Fang_Gu`, 2025-11-19 revision)
- 따라서 canonical 소비 상태와 물리적 reminder 위치 모두 Player 귀속이 아니라 중앙 유지가
  공식 정답이다. old Fang Gu에는 DEAD reminder만, new Fang Gu 자리에는 교체된 Fang Gu
  Character token과 evil alignment가 남는다.
- 저장소 `sectsAndVioletsCharacterRules.ts`의 한국어 How to Run은 현재 “기존 팡 구에
  사망·한 번 표식”이라고 되어 있어 공식 최신 문구와 충돌한다. production 구현 계획에 이
  규칙 데이터 교정을 포함한다.
- 기존 prototype의 중앙 의미는 맞지만, 104px Player-pinned token primitive가 실제 ONCE
  reminder보다 커서 별도 전역 Character token처럼 보일 수 있다. 공식 중앙 배치를 유지하며
  작은 reminder형 표현으로 고치는 안을 권고한다.
- 사용자 결정: 2026-07-29 승인. 공식 중앙의 작은 ONCE reminder로 다시 만들고 비공식
  `게임 전역` 라벨과 위치 variant를 제거한다.
- 추가 사용자 결정: 앱이 물리 토큰 이동을 자동 처리하므로 새 Fang Gu Player에게 existing
  reminder presentation으로 귀속하는 안도 고려안에 복원한다. 공식 중앙 소형안과 새 Fang Gu
  귀속안을 함께 prototype에서 비교한다.
- 최종 prototype 결정: 2026-07-29 B `새 팡 구 귀속` 표시와 공격 확정 → 공개 안내 → evil
  Fang Gu 역할 공개 → 완료 흐름을 승인하고 plan 단계 진행을 요청했다. production UI는
  canonical game-wide ONCE 상태에서 jump 대상 Player의 read-only `한 번 · 출처 팡 구`
  token count/detail 표시를 파생한다.
- 공식 순서 재확인: ONCE reminder는 첫 jump 전에는 없고, Outsider가 새 Fang Gu로 바뀐 뒤
  Grimoire 중앙에 놓으며 이후 제거하지 않는다. old Fang Gu에 교환 전 잠시 붙였다가 치우는
  C안은 공식 How to Run을 반대로 읽은 안이므로 comparison에서 제외했다. 앱 전용으로 의도적
  이탈하려면 별도 제품 결정을 다시 받아야 한다.

## Production architecture and implementation plan

### 승인된 제품 계약

- 2026-07-29 사용자 결정으로 B `새 팡 구 귀속` 표시와 기존 CharacterChange Reveal 흐름을
  production 기준으로 확정했다.
- Storyteller는 기존 Demon 공격 입력에서 대상을 고르고 확정한다. 별도 jump 확인이나
  Outsider 전용 입력은 추가하지 않는다.
- jump 직후 기존 Fang Gu만 dead, 대상은 살아 있는 evil Fang Gu가 되며 기존
  `CharacterChangeRevealPrompt` → `CharacterChangeReveal`을 그대로 사용한다.
- 공식 Fang Gu asset과 `한 번` 라벨은 jump 대상 Player의 기존 `+1` badge와 상세 token으로
  표시한다. 새로운 중앙 chip, 수동 ONCE toggle 또는 편집 가능한 Player annotation은 만들지
  않는다.
- B안의 표시 anchor는 jump를 받은 Player ID로 고정한다. 그 Player가 이후 죽거나 다른
  Character로 바뀌어도 ONCE의 역사적 소비 표시는 사라지거나 임의의 새 Fang Gu에게 이동하지
  않는다. 이 위치는 presentation anchor일 뿐, 게임 전역 ONCE의 소유권이나 재충전을 뜻하지
  않는다.

### Canonical event와 상태 소유권

- 기존 `nightActionResolved / demonAttack` 한 건을 jump의 atomic transaction으로 유지한다.
  새 top-level event나 UI-only boolean을 만들지 않는다.
- `DemonAttackOutcome`에 새 `fangGuJump` variant를 추가한다. 기존 `deaths`와 `noEffect`
  variant는 바꾸지 않는다. 새 jump event의 wire shape는 다음 의미를 가진다.

```json
{
  "kind": "fangGuJump",
  "death": {
    "playerId": "<old-fang-gu>",
    "cause": {
      "kind": "demonAttack",
      "actorPlayerId": "<old-fang-gu>",
      "actorCharacterId": "fangGu",
      "targetPlayerId": "<outsider>"
    }
  },
  "sourceAbilityInstanceId": "<old-fang-gu ability instance>",
  "identityTransition": {
    "playerId": "<outsider>",
    "before": {
      "actualCharacter": "<actual outsider>",
      "shownCharacter": "<shown character>",
      "alignment": "<current alignment>"
    },
    "after": {
      "actualCharacter": "fangGu",
      "shownCharacter": "fangGu",
      "alignment": "evil"
    }
  }
}
```

- `fangGuJump` outcome이 game-wide ONCE 소비의 persisted witness다. replay는 전체 stream에서
  이 witness가 이미 있었는지 계산하며 Player ability instance의 사용 여부를 ONCE source로
  사용하지 않는다.
- proposal은 현재 step의 actor가 살아 있는 Actual Fang Gu이고 정상 작동하며, 대상이 살아
  있는 Actual Outsider이고 이전 witness가 없을 때만 위 결과를 만든다. `shownCharacter`,
  alignment와 annotation은 eligibility에 관여하지 않는다.
- `pitHagCreatedDemon`, actor impairment와 dead target no-effect를 먼저 보존한다. 정상 사망
  결과가 가능한 살아 있는 target에만 jump를 적용한다. 이미 소비됐거나 non-Outsider이면
  기존 target death 결과를 그대로 만든다.
- replay는 소비 후 중복된 `fangGuJump`, 잘못된 source ability instance/death/transition
  snapshot을 거부한다. jump 결과에서는 death가 old Fang Gu인지, 대상의 before state가 현재
  truth인지, after state가 alive evil Fang Gu인지 함께 검증한다. 기능 배포 전 schema-3
  `deaths` event는 legacy normal attack으로 계속 허용하되 새 proposal은 eligible한 첫 attack에
  항상 `fangGuJump`를 생성한다.
- event 적용은 old Fang Gu를 dead로 만들고 대상의 actual/shown Character와 alignment,
  fresh ability instance, identity history를 같은 pass에서 갱신한다. 대상은 어느 중간
  state에서도 dead가 되지 않는다.

### Replay 파생값과 Night 흐름

- `unannouncedNightDeathPlayerIds`는 `deaths`와 `fangGuJump.death`를 함께 수집해 old Fang
  Gu만 얻는다.
  dawn `nightDeathsAnnounced` payload와 공개 summary에는 그 Player만 포함하고 jump 원인이나
  새 Demon identity는 추가하지 않는다.
- death consequence 수집은 같은 event의 실제 deaths만 본다. jump target이 Sweetheart,
  Barber 또는 Klutz여도 target trigger는 생성하지 않는다.
- `pending_identity_reveals`가 마지막 confirmed event의 `fangGuJump.identityTransition`을
  기존 `characterChange` payload로 투영한다. 앱의 기존 공개 안내, player-facing evil Fang
  Gu 공개와 확인 UI 외 새 Reveal contract는 만들지 않는다.
- Reveal 확인은 현재 #129 UI-session 동작을 재사용한다. jump event가 마지막 canonical
  event인 채 reload/import되면 다시 안내하는 안전한 recovery를 택하고, 다음 canonical
  event가 확정된 stream에서는 pending Reveal이 다시 생기지 않는다.
- `transition_source`가 jump 대상의 새 ability instance를 `nightActionResolved` source로
  인식하게 한다. acquisition source와 Fang Gu wake rank가 같으므로 jump가 발생한 밤에는
  새 Demon step을 삽입하지 않고, 다음 later Night부터 정상 Fang Gu step을 만든다.
- `automatic_fang_gu_reminder`는 최초 `fangGuJump` outcome의 transition Player ID를
  anchor로 사용해 `AutomaticReminder { characterId: "fangGu", tokenId: "once",
  label: "한 번" }`을 한 개만 파생한다. Undo로 witness가 제거되면 reminder도 제거되고,
  replay/reload/export/import에서는 같은 Player에 복원된다.

### TypeScript와 UI 연결

- `web/src/core/types.ts`와 `validation.ts`가 `fangGuJump` outcome wire contract와
  `characterId: "fangGu"` automatic reminder를 strict하게 검증한다. unknown/malformed
  transition은 import 전에 거부한다.
- `sectsAndVioletsGame.tsx`의 generic `automaticReminders` → `PlayerTokensByPlayerId`
  projection과 `SectsAndVioletsLiveGrimoire`의 badge/detail UI를 그대로 사용한다. React는
  jump eligibility, ONCE lifetime 또는 anchor를 계산하지 않는다.
- token은 official Fang Gu asset, `한 번`, `출처 팡 구`, usage visual kind와
  `첫 외지인 이동이 사용되었습니다.` 설명을 사용한다. prototype 전용 컴포넌트나 CSS는
  production import에 연결하지 않는다.
- `sectsAndVioletsCharacterRules.ts`의 오래된 “기존 팡 구에 사망·한 번 표식” How to Run을
  jump 뒤 중앙 ONCE reminder를 놓는 공식 순서에 맞게 교정한다. 앱의 승인된 B presentation은
  규칙 번역이 아니라 자동 UI 선택이므로 공식 문구와 구분한다.

### 호환성, 오류와 복구

- schema version은 3을 유지한다. 새 outcome variant를 추가하고 기존 `deaths` shape를 바꾸지
  않으므로 모든 기존 S&V 저장 파일과 fixture는 변경 없이 replay한다.
- 기능 배포 전 normal `deaths` event는 legacy history로 보존한다. 이미 확정된 Outsider
  death를 소급 jump로 바꾸거나 ONCE를 소비시키지 않는다. 새 proposal이 만드는
  `fangGuJump`부터 새 canonical semantics를 적용하며 별도 migration이나 silent correction은
  만들지 않는다.
- proposal/replay 실패는 기존 `INVALID_STEP_INPUT`, `STALE_STEP`, `REPLAY_FAILED` envelope를
  재사용한다. UI에서 규칙을 보정하거나 partial jump를 append하지 않는다.
- Undo는 canonical controller가 마지막 event를 제거한 뒤 replay하므로 old Fang Gu 생존,
  대상 원래 identity/alignment, fresh ability instance, pending Reveal, dawn death와 ONCE
  reminder가 한꺼번에 원복된다.

### Behavioral test map과 TDD 순서

1. 새 `issue112_fang_gu_scenarios` black-box test에서 첫 살아 있는 Actual Outsider 공격을
   먼저 작성한다. 현재 baseline target death가 발생해 실패하는 것을 확인한 뒤 atomic event,
   replay transition, old Fang Gu death, pending evil Fang Gu Reveal과 ONCE reminder까지
   최소 구현한다. (criteria 1, 2, 3, 9)
2. 같은 test module에서 같은 밤 새 Fang Gu step 부재, 다음 later Night의 새 actor,
   이후 Outsider 정상 사망과 ONCE 유지, 새 ability instance에도 재충전되지 않음을 검증한다.
   (criteria 5, 6, 7)
3. dead Outsider, impaired actor, `pitHagCreatedDemon`, non-Outsider와 already-consumed
   경계를 public propose/replay로 검증한다. 기존 baseline Demon attack regression도 유지한다.
   (criteria 6, 8)
4. 중복 jump, 잘못된 source ability instance, old Demon death와 target transition 변조를
   각각 replay가 거부하는 regression을 추가하고 기존 legacy `deaths` event replay도
   고정한다. event 하나 제거 Undo와 JSON serialize/replay equality도 함께 검증한다.
   (criteria 10, 11)
5. dawn까지 진행해 unannounced/announced death가 old Fang Gu 한 명뿐이고 공개 summary에
   `fangGu`, `팡 구`, `jump`, target identity가 없음을 검증한다. jump target Sweetheart의
   pending death consequence가 없는 것도 확인한다. (criteria 3, 4)
6. `fixtures/acceptance/sects-and-violets/fang-gu-example-1.json`과 issue-112 manifest/test를
   추가해 Artist 정상 사망 → Sweetheart jump/능력 미발동 → 다음 밤 Klutz 정상 사망을 한
   연속 stream으로 replay한다. (criterion 12)
7. Web test는 valid/malformed `fangGuJump`, Fang Gu automatic reminder의 strict validation과
   공식 How to Run 문구 회귀를 추가한다. 실제 badge/detail, Reveal과 wide/iPad/mobile
   interaction은 승인된 prototype 계약을 acceptance 서버에서 다시 확인한다. (criteria 2, 9)

### 예상 변경 파일

- Rust contracts/rules:
  `crates/domain/src/contracts.rs`,
  `crates/domain/src/characters/sects_and_violets.rs`
- Rust regression:
  `crates/domain/src/tests.rs`,
  `crates/domain/src/tests/issue112_fang_gu_scenarios.rs`
- 공식 JSON acceptance:
  `fixtures/acceptance/sects-and-violets/fang-gu-example-1.json`,
  `fixtures/acceptance/sects-and-violets/issue-112-manifest.json`
- Web wire/rules:
  `web/src/core/types.ts`,
  `web/src/core/validation.ts`,
  `web/src/core/validation.test.ts`,
  `web/src/sectsAndVioletsCharacterRules.ts`,
  `web/src/sectsAndVioletsCharacterRules.test.ts`
- 기존 generic token projection에 결함이 발견될 때만
  `web/src/sectsAndVioletsGame.tsx` 또는 별도 pure projection test를 최소 수정한다.
  prototype 파일은 production dependency가 아니다.
- 완료 전 `cargo test --workspace`, `pnpm --dir web test`,
  `pnpm --dir web build`, fixture replay, full diff correctness review를 실행한다.

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
- 공식 ONCE는 어느 Player에도 귀속되지 않고 게임 끝까지 남는다. B안의 Player 귀속
  automatic reminder가 ownership처럼 보이지 않도록 canonical source는 game-wide witness로
  유지하고, jump target은 presentation anchor로만 기록해야 한다.

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

## 구현 및 검증 결과 (2026-07-29)

- `demonAttack / fangGuJump` 원자 결과가 기존 팡 구 사망, 대상의 evil Fang Gu 전환,
  새 ability instance와 identity history를 한 confirmed event로 저장한다. replay는 actor,
  실제 Outsider, 생존, impairment, Pit-Hag Demon 생성, game-wide 선행 사용과 모든 witness를
  다시 검증한다.
- game-wide 사용 여부는 event stream의 첫 `fangGuJump`에서 파생하며, jump 대상 Player를
  고정 presentation anchor로 하는 공식 Fang Gu `한 번` automatic reminder를 만든다.
  Character나 ability instance 변경으로 재충전되지 않고 Undo 시 함께 사라진다.
- 기존 CharacterChange Reveal, Player `+1` token badge/detail UI, dawn announcement와
  저장·import/export 경로를 재사용한다. 공개 사망에는 기존 Fang Gu만 포함되고 jump 대상의
  death consequence는 생성되지 않는다.
- TDD Red는 기존 Fang Gu가 Sweetheart를 일반 `deaths`로 죽이는 결과와 웹 계약이
  `fangGuJump`를 거부하는 결과로 확인했다. 최소 구현 후 focused Rust 6개, Rust workspace
  288개, web unit 118개, web integration 408개가 통과했다.
- `pnpm --dir web build`가 wasm-opt, TypeScript와 Vite/PWA production build를 포함해
  통과했다. `git diff --check`, 전체 diff 및 atomicity/replay/legacy/privacy 중심 추가
  correctness review도 완료했다.
- `fixtures/issue-112-fang-gu-example-1.json`은 화가 정상 사망 → 사랑꾼 jump → 다음 밤
  얼뜨기 정상 사망을 한 JSON acceptance 시나리오로 재생한다.
- live production-shaped flow에서 B안 공격 확정 → 공개 안내 → evil Fang Gu 역할 공개 →
  완료를 통과했다. 1180×820과 390×844에서 새 Fang Gu의 `+1`, 상세의 공식 Fang Gu 도상과
  `한 번`, 기존 Fang Gu만 사망한 상태를 확인했고 browser warning/error는 없었다.
