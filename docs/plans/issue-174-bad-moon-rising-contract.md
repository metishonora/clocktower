# Issue 174: Bad Moon Rising 규칙과 구현 계약

## Status

공식 규칙 조사 초안. 2026-08-21에 공식 BMR Wiki 25개 Character, 공식 Glossary/Abilities/
States, 공식 제품 및 reminder collection, 한국어 BMR 자료를 확인했다.

이 문서는 Production 구현을 승인하지 않는다. 아래 `결정 필요` 항목을 검토한 뒤 BMR foundation과
Character 구현 이슈를 만든다.

- 사실 기준: [BMR 공식 규칙](../references/bad-moon-rising-official-rules.md)
- 한국어 기준: [BMR 한국어 용어](../references/bad-moon-rising-korean-terms.md)
- Issue: [#174](https://github.com/metishonora/clocktower/issues/174)

## Acceptance invariants

| Invariant | 가장 강한 증거 |
| --- | --- |
| 13 Townsfolk, 4 Outsiders, 4 Minions, 4 Demons가 안정 ID와 공식 source를 가진다 | reference catalog의 25개 행과 Character별 Wiki 링크 |
| Setup, first night, Day, later night, Execution, Death, Announcement, survival, Resurrection, game end가 누락되지 않는다 | 공식 규칙 문서의 setup/order/matrix와 아래 lifecycle mapping |
| 각 능력의 자동 계산, ST 선택, 수동 입력 경계가 명시된다 | Character matrix `처리` 열 |
| Actual outcome, Delivered Information, public Announcement가 섞이지 않는다 | matrix의 결과/Reveal 열과 privacy 계약 후보 |
| 현재 공용 모델의 재사용 지점과 확장 후보가 구분된다 | 아래 domain gap matrix |
| 구현자가 공식 규칙 밖의 결정을 추측하지 않는다 | 결정 목록의 질문, 선택지, 권장안, 승인 상태 |
| 후속 이슈가 TB/S&V 동작을 변경하지 않는다 | script-owned rule seam과 회귀 acceptance 의존 관계 |

## Lifecycle mapping

```text
Setup
  -> First Night information and effects
  -> Day public actions
  -> Nomination / Execution
  -> ordered Death attempts and survival resolution
  -> immediate death consequences / pending night effects
  -> Later Night ordered actions and scheduled effects
  -> Dawn Death and Resurrection announcement
  -> game-end evaluation or Mastermind deferral
  -> next Day
```

### Setup

- Actual Character, Shown Character, Alignment를 독립적으로 저장한다.
- 기본 Character kind는 Alignment의 초기값일 뿐이다. Goon은 Character를 유지한 채 Alignment가
  바뀐다.
- Lunatic은 Actual Character가 `lunatic`이고 Shown Character는 Storyteller가 정한 Demon이다.
- Godfather는 `+1 Outsider/-1 Townsfolk` 또는 `-1 Outsider/+1 Townsfolk` 중 유효한 분포를
  Storyteller가 명시적으로 선택한다.
- 7명 이상에서 일반 Minion/Demon info와 Lunatic용 가짜 정보는 서로 다른 private delivery다.

### Day and Execution

- Gossip statement, Tinker Death, Moonchild 공개 선택은 phase step만으로 자동 추론하지 않는다.
  Storyteller가 명시적으로 기록한다.
- Execution은 성공 여부와 Death 여부를 분리한다. Devil's Advocate, Tea Lady, Pacifist, Sailor,
  Fool 때문에 executee가 살아도 그날의 처형은 끝난다.
- Minion이 execution으로 실제 사망한 경우에만 Minstrel이 trigger한다.
- Mastermind extra Day에서는 executee의 Death 여부와 무관하게 executed Player의 team으로
  승패를 판정한다.

### Death and survival

모든 Death 원인은 같은 pipeline을 통과해야 한다.

```text
DeathAttempt(source, target, phase, sequence, bypass)
  -> source ability validity
  -> target registration / eligibility snapshot
  -> applicable prevention candidates
  -> Storyteller decision where allowed
  -> DeathPrevented(reason) or DeathOccurred(cause, sequence)
  -> ability-spent / status changes
  -> immediate triggers
  -> pending consequences
  -> game-end evaluation
```

- Assassin은 source가 유효하면 모든 target-side protection을 우회한다.
- deterministic protection이 Death를 막았다면 Fool은 소비하지 않는다.
- Pacifist는 eligible good executee에 대해 Storyteller가 적용 여부를 선택한다.
- 같은 action의 여러 target은 선택 순서대로 판정한다. 앞선 target이 Goon이면 actor가 즉시 drunk가
  되어 현재 및 뒤 attack에 영향을 줄 수 있다.
- Death event는 원인 Character, actor ability instance, target, phase와 sequence를 보존한다.
  Grandmother, Gossip, Gambler, Tinker, Moonchild, Godfather, Assassin의 추가 Death를 generic
  `DeathConfirmed`만으로 잃지 않는다.

### Resurrection

- Professor와 Shabaloth resurrection은 Actual/Shown Character와 Alignment를 유지한다.
- Resurrection은 새 base ability instance를 만든다. 이전 once-per-game spent 상태를 상속하지
  않는다.
- first-night/start-knowing 능력은 resurrection 직후 처리하고, 일반 night ability는 현재 night
  order에서 아직 지나지 않았으면 그 밤에 동작한다.
- dawn Announcement에는 resurrected Player만 포함하고 source는 Storyteller 전용으로 남긴다.

### Impairment and duration

각 impairment는 최소 다음 값을 가진다.

- target Player
- source Character와 source ability instance
- kind: drunk 또는 poisoned
- 시작 event/phase boundary
- 종료 boundary 또는 source-active 조건
- trigger 당시 active 여부

BMR에 필요한 duration은 `untilDusk`, `untilNextDusk`, `threeNightsAndDays`,
`untilPukkaResolution`, `whileSourceAbilityActive`다. source가 잠시 비활성화될 때 효과가
사라졌다가 원래 기간 안에 복원되는 경우와, trigger 당시 무효여서 영구적으로 생성되지 않은 경우를
구분한다.

### Announcement and information

- 밤 Death/Resurrection은 dawn에 대상만 공개하고 원인과 처리 순서는 공개하지 않는다.
- execution survival은 공개하되 어떤 Character가 막았는지는 공개하지 않는다.
- Goon Alignment 변경은 Goon에게만 Reveal한다.
- Exorcist 성공은 실제 Demon에게 Exorcist Character와 Player만 Reveal한다.
- Lunatic은 fake Demon info와 fake action UI만 보고, actual state와 실제 Demon의 선택은 볼 수
  없다. 실제 Demon은 Lunatic identity와 ordered fake targets를 본다.
- Chambermaid는 computed count와 delivered count를 분리한다. impaired information은 허용 범위
  안에서 Storyteller가 전달값을 선택한다.

### Game end

- 일반 good win은 실제 Demon Death 기준이며 Zombuul의 apparent Death에는 발생하지 않는다.
- apparent-dead Zombuul은 공개/등록/투표/지목/neighbor 계산에는 dead지만 actual Demon 및 ability
  validity에는 alive다.
- Mastermind가 유효한 상태에서 Demon이 execution으로 죽어 game end 조건을 만들면 즉시 종료를
  보류하고 정확히 one night + one day를 진행한다.
- extra Day의 good execution은 evil win, evil execution 또는 no execution은 good win이다.
- two-alive evil win은 Mastermind extra cycle과 apparent-dead Zombuul 예외를 먼저 판정한다.

## 현재 공용 모델 대응

| 규칙 요구 | 현재 근거 | 판정 |
| --- | --- | --- |
| Actual/Shown Character, Alignment, alive, ability instance | [`Player`](../../crates/domain/src/model.rs), `IdentityState`, `AbilityInstance` | 재사용 가능 |
| Character change와 Resurrection snapshot | `PlayerTransition` | 재사용 가능, resurrection timing 보강 |
| computed/delivered information과 registration judgment | `InformationResult`, `ConfirmedInformation`, `RegistrationJudgment` | 재사용 가능 |
| execution과 execution survival 분리 | `ExecutionConfirmed`, `ExecutionSurvivalConfirmed` | 기초 재사용 가능 |
| ordered death consequence | `PendingDeathConsequence.deathSequence` | 개념 재사용 가능, BMR 공용화 필요 |
| night Death와 Resurrection Announcement | `NightDeathsAnnouncedPayload` | 재사용 가능 |
| 복수 impairment와 source | `ActiveImpairment` | 기초 재사용 가능 |
| script-owned dispatch | [`ScriptRules`](../../crates/domain/src/characters/mod.rs) | `BadMoonRising` variant/file 추가 필요 |
| Godfather 가변 Setup | `setupDistribution`은 Character 목록으로 단일 결과 반환 | 새 선택 계약 필요 |
| BMR impairment expiry | `ImpairmentExpiry`는 `Never`, `WhileSourceAbilityActive`뿐 | semantic phase expiry 필요 |
| 복수/중첩 protection | `RuleState.activeProtection`은 단일 effect이며 다른 보호는 character-specific | 공용 protection candidate 필요 |
| ordered multi-target action | `DemonAttackOutcome::Deaths`는 복수 Death 가능하나 action payload는 단일 target 중심 | ordered target/action state 필요 |
| generic Death provenance | `NightDeathCause`는 Demon/Pit-Hag, `DeathEventPayload`는 Player/step 중심 | source/cause/sequence 계약 필요 |
| apparent-dead actual-alive | `Player.alive`와 `deathAnnounced`만으로 registration과 public life를 동시에 표현하기 어려움 | public/registered life projection 필요 |
| scheduled delayed effect | Pukka poison-to-Death, Moonchild tonight Death를 표현하는 공용 pending effect 없음 | pending effect 또는 script-owned state 필요 |
| action interruption | Goon이 chooser를 즉시 drunk하게 해 현재 multi-target action을 바꿈 | target-by-target resolution 필요 |
| game-end deferral | `PendingGameEnd`는 즉시 승인 흐름이고 Mastermind extra cycle 없음 | deferral window/state 필요 |
| recipient-scoped Reveal | Reveal payload는 존재하나 Lunatic/real Demon/Exorcist 다중 recipient workflow 없음 | typed private reveal queue 필요 |

공용 계약은 실제로 TB/S&V도 의미가 같은 경우에만 확장한다. Character-specific 상태 machine은
`characters/bad_moon_rising.rs`와 그 하위 typed step key가 소유한다. 기존 TB/S&V event를 새 BMR
의미로 재해석하지 않는다.

## 결정 필요

아래 권장안은 review 승인 전까지 확정 계약이 아니다.

### D1. 지원 Player 수

- 선택 A: 공식 권장과 S&V precedent에 맞춰 7–15명만 지원한다. **권장**
- 선택 B: 5–6명도 경고와 함께 지원한다.

5–6명은 공식적으로 가능하지만 권장되지 않고 BMR의 Shabaloth/Goon 등이 불공정할 수 있다.

### D2. Godfather Setup 선택 API

- 선택 A: `setupDistribution`이 가능한 분포 options와 stable choice ID를 반환하고, Storyteller가
  하나를 선택해 `createGame`에 확정한다. **권장**
- 선택 B: roster를 기준으로 Core가 임의의 유효 방향을 자동 선택한다.

자동 선택은 Storyteller 재량을 잃고 draft와 confirmed Setup이 달라질 수 있다.

### D3. Death 계약의 범위

- 선택 A: source/sequence/bypass/prevention을 가진 script-neutral DeathAttempt/Resolution을 만든다.
  **권장**
- 선택 B: BMR Character별 event와 reducer로 각각 구현한다.

BMR Character 14개 이상이 Death 또는 survival에 관여하므로 Character별 중복은 우선순위 오류를
만들 가능성이 높다.

### D4. Zombuul public life

- 선택 A: actual `alive`와 별도인 derived `publicLifeState`/registration을 둔다. **권장**
- 선택 B: actual alive를 false로 저장하고 Demon ability 예외에서만 alive처럼 취급한다.

선택 B는 good win, two-alive, nomination, ghost vote, Tea Lady neighbor가 한 boolean을 서로 다르게
해석하게 만든다.

### D5. Manual public action 기록

- 선택 A: Gossip statement, Moonchild choice, Tinker decision을 typed confirmed event로 기록한다.
  statement 원문은 optional, Storyteller truth judgment는 canonical로 둔다. **권장**
- 선택 B: generic manual step과 notes로만 남긴다.

선택 B는 replay가 tonight trigger와 target eligibility를 재구성할 수 없다.

### D6. Mastermind extra cycle 중 source loss

공식 Character 페이지는 extra cycle이 시작된 뒤 Mastermind가 죽거나 impaired되는 경우를 명시하지
않는다.

- 선택 A: Demon Death 순간에 trigger가 확정되면 extra cycle은 끝까지 지속한다.
- 선택 B: extra cycle 중 source ability가 사라지면 일반 good win을 즉시 재평가한다.

실물 Almanac/공식 ruling 확인 전에는 자동화하지 않고 explicit manual decision으로 남긴다.

### D7. Impaired Lunatic presentation

공식 Character 페이지는 Lunatic이 drunk/poisoned일 때 가짜 Demon presentation을 중단하라고 하지
않는다.

- 선택 A: Actual state와 무관하게 플레이어가 계속 Demon이라고 생각하도록 presentation을 유지하되,
  ability-derived real Demon notification만 validity로 제어한다. **권장**
- 선택 B: impaired 동안 fake night action을 생략한다.

선택 B는 impairment를 Lunatic에게 사실상 공개할 수 있다. 공식 ruling 확인 전 최종 확정하지 않는다.

### D8. Reminder inventory 실물 대조

공식 총수량 42와 unique product 34종은 확인했다. 중복 수량은 규칙상 동시 배치로 합계 42를
재구성했다.

- 선택 A: 현재 inventory를 foundation 기준으로 쓰고 실물 확인 시 수정한다. **권장**
- 선택 B: 실물 punchboard 확인 전 foundation을 보류한다.

## 후속 이슈 분할과 의존 관계

```text
#174 rules and contracts
  ├─ BMR foundation
  │    ├─ catalog / IDs / Korean copy
  │    ├─ 7–15 setup and Godfather choice
  │    ├─ first/later night skeleton
  │    └─ explicit manual fallback
  ├─ shared death / survival / public-life contracts
  │    ├─ impairment duration and protection resolution
  │    └─ resurrection and game-end deferral
  ├─ BMR information and identity characters
  ├─ BMR public actions and extra deaths
  ├─ BMR Minion and Demon state machines
  ├─ UI prototype and Reveal privacy review
  ├─ production UI / assets / route
  └─ cross-character acceptance and TB/S&V regression
```

### 권장 구현 이슈

1. **BMR foundation** — `badMoonRising` script ID, 25 Character catalog, Setup options, night
   order, reminder inventory, manual phase event compatibility. Character 자동화 없음.
2. **Ordered Death and survival foundation** — generic DeathAttempt/Resolution, source provenance,
   prevention candidates, unstoppable Death, execution survival, public/private outcome.
3. **Impairment and scheduled effects** — phase-bound expiry, source validity, delayed trigger,
   multi-source tokens.
4. **Public life and game-end exceptions** — Zombuul apparent Death, Mastermind deferral, two-alive
   and Demon-absent precedence.
5. **Information and identity** — Grandmother, Chambermaid, Lunatic, Goon, Exorcist private Reveal.
6. **Protection and resurrection** — Sailor, Innkeeper, Courtier, Professor, Minstrel, Tea Lady,
   Pacifist, Fool, Devil's Advocate.
7. **Additional Deaths and public actions** — Gambler, Gossip, Tinker, Moonchild, Godfather,
   Assassin, Grandmother consequence.
8. **Demon state machines** — Pukka, Shabaloth, Po, Zombuul attack behavior.
9. **BMR UI prototype** — Setup choice, public actions, ordered Death resolution, private Reveal,
   apparent Death and extra Day states.
10. **Production integration and assets** — approved prototype only; route, catalog cards, icons,
    local assets, persistence.
11. **Cross-character acceptance** — real WASM/production fixtures, import/export/undo, iPad workflow,
    TB/S&V regression.

이슈 2–4가 공용 계약을 고정한 뒤 5–8을 병렬화할 수 있다. UI prototype은 domain 결과 형태가
고정된 뒤 시작하고, assets는 stable IDs와 한국어 표기 승인 뒤 진행한다.

## 대표 JSON acceptance 시나리오 목록

이 이슈에서는 아직 존재하지 않는 event schema를 추측해 실행 가능한 fixture를 만들지 않는다.
아래 이름과 invariant를 동결하고, 각 구현 이슈가 schema-v3 JSON을 추가한다.

| ID / 권장 파일명 | Character | 핵심 invariant |
| --- | --- | --- |
| `SET-01 godfather-add-outsider.json` | Godfather | base Outsider 0에서 +1만 유효하고 final roster가 정확함 |
| `SET-02 godfather-remove-outsider.json` | Godfather | -1 선택이 Townsfolk +1과 원자적으로 확정됨 |
| `INF-01 grandmother-demon-grandchild.json` | Grandmother, Demon | private start info와 Demon-kill 추가 Death가 source/sequence를 보존 |
| `INF-02 chambermaid-impaired-wake-count.json` | Chambermaid, Sailor/Goon | computed count와 delivered count, own-ability wake 기준이 분리됨 |
| `REV-01 exorcist-pukka-delay.json` | Exorcist, Pukka | Pukka wake/새 poison은 차단하지만 이전 poison Death는 처리됨 |
| `REV-02 lunatic-po-three-targets.json` | Lunatic, Po | fake targets 3명의 순서가 실제 Demon에게만 전달되고 실제 state는 변하지 않음 |
| `IMP-01 courtier-source-disabled-resumes.json` | Courtier | source impairment 동안 drunk가 inactive이고 원래 expiry 안에서 복원됨 |
| `IMP-02 minstrel-whole-town.json` | Minstrel, Demon | Minion execution Death 뒤 Demon 포함 전원이 next dusk까지 drunk |
| `SUR-01 protection-priority-fool.json` | Fool, Tea Lady, Innkeeper | 다른 보호가 막은 Death에는 Fool ability가 소비되지 않음 |
| `SUR-02 assassin-bypasses-all.json` | Assassin, Fool, Tea Lady, Innkeeper | 유효 Assassin Death가 모든 target protection을 우회 |
| `SUR-03 pacifist-execution-survival.json` | Pacifist | good executee가 살아도 execution/day 종료가 확정됨 |
| `RES-01 professor-new-ability-instance.json` | Professor, Courtier | 부활 Player가 새 instance와 once-per-game ability를 가짐 |
| `RES-02 shabaloth-resurrection-order.json` | Shabaloth, Exorcist | 전날 target만 부활 가능하고 이미 지난 wake order는 재행동하지 않음 |
| `ACT-01 gossip-true-statement.json` | Gossip, protection | statement truth와 ST target 선택을 분리하고, 보호된 target이면 실제 Death가 0명일 수 있음 |
| `ACT-02 moonchild-alignment-snapshot.json` | Moonchild, Goon | 선택 당시 good Goon이 이후 evil이어도 tonight Death 조건 유지 |
| `ACT-03 goon-first-chooser.json` | Goon, Sailor, Demon | 첫 chooser만 drunk/무효, Goon Alignment 변경, 뒤 chooser는 정상 |
| `DEM-01 pukka-protected-target-recovers.json` | Pukka, Innkeeper | delayed Death가 보호로 막혀도 Pukka poison은 제거됨 |
| `DEM-02 pukka-source-disabled-delay.json` | Pukka, Courtier | source impaired 동안 Death가 미뤄지고 회복 후 poison이 다시 trigger 가능 |
| `DEM-03 shabaloth-ordered-deaths.json` | Shabaloth, Grandmother | 두 attack과 Grandmother 추가 Death의 순서/원인이 안정적 |
| `DEM-04 po-charge-exorcist.json` | Po, Exorcist | no-one만 charge를 만들고 Exorcist skip은 charge 생성/소비를 하지 않음 |
| `DEM-05 po-goon-interruption.json` | Po, Goon | 3 attacks 중 Goon 선택이 Po를 drunk하게 해 해당/후속 Death를 막음 |
| `DEM-06 zombuul-first-death.json` | Zombuul, Tea Lady | actual alive/public dead/registered dead와 ghost vote 상태가 동시에 정확함 |
| `WIN-01 mastermind-extra-day-good-executed.json` | Mastermind | Demon execution 뒤 good executee가 살아도 evil win |
| `WIN-02 mastermind-no-execution.json` | Mastermind | extra Day no execution에서 good win |
| `PST-01 bmr-cross-character-replay.json` | 복합 | ordered Death, impairment, public life, pending Reveal가 export/import/undo 후 동일 |

## Review checklist

- [x] 공식 스토어 night sheet 양면 사진을 확보하고 전사 순서를 대조했다. 제품 페이지에는 revision
  메타데이터가 없다.
- [ ] 실물 Almanac의 판본/사진을 확보해 Wiki 차이를 기록했다.
- [ ] reminder token 중복 수량을 실물 42개와 대조했다.
- [ ] D1–D8을 승인 또는 명시적으로 deferred 처리했다.
- [ ] 25개 Character source 링크와 한국어 명칭을 검토했다.
- [ ] Character matrix의 자동/ST 선택/수동 분류를 검토했다.
- [ ] Reveal payload에 Player용 정보만 남는지 privacy 관점에서 검토했다.
- [ ] 공용 계약 후보가 기존 TB/S&V persisted event 의미를 바꾸지 않는지 검토했다.
- [ ] 후속 foundation과 Character 이슈가 이 문서를 규칙 기준으로 링크한다.
