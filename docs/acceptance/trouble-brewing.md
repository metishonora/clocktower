# Trouble Brewing 전체 인수 테스트 체크리스트

## 목적과 판정 기준

이 체크리스트는 Clocktower 앱이 공식 Trouble Brewing 규칙을 Storyteller 보조 도구로 올바르게 표현하는지 직접 확인하기 위한 것이다. 범위는 5~15명, Trouble Brewing 22직업, 기본 지명·투표·처형·밤 진행·승리 조건이다. Travellers, Fabled, 커스텀 스크립트와 전략 팁만으로 파생되는 조합은 제외한다.

규칙 판정은 [공식 Trouble Brewing Wiki](https://wiki.bloodontheclocktower.com/Trouble_Brewing), 각 직업 페이지의 `How to Run`, [공식 Glossary](https://wiki.bloodontheclocktower.com/Glossary) 순서로 확인한다. 공식 결과가 승리라 하더라도 앱은 자동으로 게임을 끝내지 않는다. 올바른 승리 경고를 표시한 뒤 Storyteller가 승리 팀을 명시적으로 확정하면 통과다.

재현 파일 55개는 모두 앱의 `schemaVersion: 2` import 형식을 통과하고 실제 Rust 코어로 replay되는지 자동 검증된다. 각 파일은 결정적인 행동 직전 상태다. 자동 검증은 파일 무결성과 시작 상태를 보장할 뿐, 아래의 수동 UI 결과를 대신하지 않는다.

## 사용 방법

1. 현재 진행 중인 게임이 필요하면 먼저 export한다.
2. 아래 사례의 JSON 링크를 내려받아 앱의 `불러오기`로 import한다. 기존 이벤트가 있으면 교체 확인을 승인한다.
3. 각 사례에 적힌 행동만 수행하고 기대 결과와 비교한다.
4. 분기 결과가 둘 이상이면 같은 JSON을 다시 import해 다른 선택을 시험한다.
5. 통과한 항목의 체크박스를 표시한다. 실패하면 `FAIL — 실제 결과`를 덧붙이고 export한 JSON도 보관한다.

전체 기계 판독용 목록과 시작 체크포인트는 [manifest.json](../../fixtures/acceptance/trouble-brewing/manifest.json)에 있다.

## 공식 세부 규칙 요약

### Townsfolk

- **Washerwoman**: 첫날 밤에 두 플레이어 중 한 명이 특정 Townsfolk임을 안다. Spy는 검사별로 특정 Townsfolk로 등록할 수 있다.
- **Librarian**: 특정 Outsider 후보 둘 또는 Outsider 0명을 안다. Drunk를 볼 때는 보여 준 Townsfolk가 아니라 실제 Drunk를 본다. Spy는 Outsider로 등록할 수 있다.
- **Investigator**: 특정 Minion 후보 둘을 안다. Recluse는 특정 Minion으로 등록할 수 있다.
- **Chef**: 원형 좌석에서 evil-evil 인접 경계 수를 센다. 세 명이 연속 evil이면 두 쌍이며 한 플레이어가 두 쌍에 포함될 수 있다. Recluse의 등록은 같은 밤에도 경계별로 달라질 수 있다.
- **Empath**: 매일 밤 현재 살아 있는 좌우 이웃 둘 중 evil 수를 안다. 죽은 이웃은 건너뛰며 Demon 행동 후 상태를 본다.
- **Fortune Teller**: 살아 있거나 죽은 플레이어 둘을 고른다. 실제 Demon, 고정 Red Herring, Demon으로 등록한 Recluse가 포함되면 yes다. Red Herring은 good 플레이어이며 자신도 가능하다.
- **Undertaker**: 전날 `처형되어 실제로 죽은` 플레이어의 실제 직업을 본다. 처형 없이 죽었거나 처형에서 살아남으면 정보가 없다.
- **Monk**: 첫날 밤을 제외한 매일 밤 자신 이외 한 명을 Demon으로부터 보호한다. Demon은 보호된 대상을 공격한 뒤 다른 대상을 다시 고르지 못한다.
- **Ravenkeeper**: 밤에 죽은 그 밤에 한 명을 골라 실제 직업을 안다. 죽은 대상도 고를 수 있고 Spy/Recluse 등록 판정이 적용될 수 있다.
- **Virgin**: 실제 Virgin이 처음 지명될 때 능력이 소비된다. sober/healthy 상태에서 실제 Townsfolk 또는 Townsfolk로 등록한 Spy가 지명하면 지명자가 즉시 처형된다. 다른 직업의 지명이나 poisoned 상태에서도 능력은 소비된다.
- **Slayer**: 낮에 한 번 공개 사용한다. 살아 있는 Demon을 지목하면 죽는다. poisoned 상태에서 사용하거나 실패해도 소비된다. Recluse는 Demon으로 등록해 죽일 수 있다.
- **Soldier**: sober/healthy 실제 Soldier는 Demon 능력의 피해로부터 안전하다. 처형은 막지 않으며 poisoned 또는 Drunk-shown-Soldier는 죽을 수 있다.
- **Mayor**: 밤에 죽게 되면 Storyteller가 Mayor 사망 또는 다른 roster 플레이어로 bounce를 고른다. dead, Soldier, Monk-protected 대상으로 bounce하면 결과적으로 아무도 죽지 않을 수 있다. 정확히 3명이 살고 그날 처형이 없으면 good 승리다.

### Outsiders

- **Butler**: 매일 밤 자신 이외 Master를 고르고 다음 날 Master가 투표 중이거나 이미 집계되었을 때만 투표할 수 있다. 공식 룰상 고의 위반은 부정행위이며 Storyteller가 자동으로 무효표 처리하지 않는다.
- **Drunk**: 실제 능력이 없고 Townsfolk라고 생각한다. 해당 Townsfolk처럼 깨우고 행동시키지만 효과는 없으며 정보는 거짓일 수 있다.
- **Recluse**: 죽어 있어도 검사별로 evil 및 특정 Minion/Demon으로 등록할 수 있다. 등록된 직업의 능력을 얻지는 않는다.
- **Saint**: sober/healthy actual Saint가 처형으로 죽으면 그 팀이 패배한다. 다른 원인의 사망이나 poisoned 상태에서는 발동하지 않는다.

### Minions와 Demon

- **Poisoner**: 매일 밤 한 명을 고르고 그 밤과 다음 낮 동안 poisoned 상태로 만든다. 대상은 정상적으로 깨어 행동하는 척하며 once-per-game 능력은 실패해도 소비된다. 기존 독은 다음 dusk에 끝난다.
- **Spy**: 매일 밤 Grimoire를 보고, 죽어 있어도 검사별로 good 및 특정 Townsfolk/Outsider로 등록할 수 있다. 등록 직업의 능력을 얻지는 않는다.
- **Scarlet Woman**: Demon이 죽기 직전 Travellers를 제외한 생존자가 5명 이상이고 자신이 살아 있고 sober/healthy이면 즉시 Demon이 된다.
- **Baron**: setup에서 Townsfolk 둘을 Outsider 둘로 교체한다. Baron이 나중에 죽어도 되돌아가지 않는다.
- **Imp**: 첫날 밤을 제외한 매일 밤 한 명을 죽인다. 자신을 죽이면 살아 있는 Minion 한 명이 새 Imp가 된다. poisoned Imp의 공격은 아무도 죽이지 않는다.

## 1. Setup과 공통 계약

- [ ] `SET-01` [setup-standard-distribution.json](../../fixtures/acceptance/trouble-brewing/setup-standard-distribution.json) — 7명 분포가 5 Townsfolk / 0 Outsider / 1 Minion / 1 Demon이며 설정 경고가 없는지 확인한다.
- [ ] `SET-02` [setup-baron-outsiders.json](../../fixtures/acceptance/trouble-brewing/setup-baron-outsiders.json) — Baron 설정이 3/2/1/1 분포를 만들고 지속되는지 확인한다.
- [ ] `SET-03` [setup-drunk-shown-townsfolk.json](../../fixtures/acceptance/trouble-brewing/setup-drunk-shown-townsfolk.json) — 6번의 actual Drunk와 shown Slayer가 분리되는지 확인한다.
- [ ] `SET-04` [setup-duplicate-character-warning.json](../../fixtures/acceptance/trouble-brewing/setup-duplicate-character-warning.json) — 중복 실제 직업을 막지 않고 `DUPLICATE_ACTUAL_CHARACTER` 경고로 알리는지 확인한다.
- [x] **KNOWN FAIL `SET-05`** [small-game-evil-info-known-deviation.json](../../fixtures/acceptance/trouble-brewing/small-game-evil-info-known-deviation.json) — 공식 룰은 5~6명에게 Minion/Demon 정보와 Demon 블러프를 주지 않지만 현재 앱은 `firstNight:minionInfo`와 `firstNight:demonInfo`를 생성한다.

## 2. 첫날 밤과 정보 직업

- [ ] `INF-01` [washerwoman-normal-information.json](../../fixtures/acceptance/trouble-brewing/washerwoman-normal-information.json) — Chef와 다른 후보를 골라 실제 Chef 한 명이 포함된 고정 정보가 나오는지 확인한다.
- [ ] `REG-01` [washerwoman-spy-registration.json](../../fixtures/acceptance/trouble-brewing/washerwoman-spy-registration.json) — Spy를 특정 Townsfolk로 등록한 Washerwoman 정보가 선택 가능한지 확인한다.
- [ ] `INF-02` [librarian-zero-outsiders.json](../../fixtures/acceptance/trouble-brewing/librarian-zero-outsiders.json) — Outsider가 없을 때 `0` 정보가 가능한지 확인한다.
- [ ] `REG-02` [librarian-spy-registration.json](../../fixtures/acceptance/trouble-brewing/librarian-spy-registration.json) — Spy를 특정 Outsider로 등록하는 정보와 `0` 정보가 함께 선택 가능한지 확인한다.
- [ ] `REG-03` [investigator-recluse-registration.json](../../fixtures/acceptance/trouble-brewing/investigator-recluse-registration.json) — 실제 Poisoner 정보와 Recluse를 특정 Minion으로 등록한 정보를 각각 시험한다.
- [ ] `REG-04` [chef-evil-pairs-and-recluse.json](../../fixtures/acceptance/trouble-brewing/chef-evil-pairs-and-recluse.json) — 원형 끝-시작 경계와 Recluse 등록별 Chef 수치를 비교한다.
- [ ] `INF-03` [empath-alive-neighbors.json](../../fixtures/acceptance/trouble-brewing/empath-alive-neighbors.json) — 1번 Empath의 살아 있는 좌우 이웃 중 8번 Imp 한 명을 세어 `1`이 나오는지 확인한다.
- [ ] `INF-03B` [empath-skips-dead-neighbors.json](../../fixtures/acceptance/trouble-brewing/empath-skips-dead-neighbors.json) — 양옆 dead 플레이어를 건너뛰어 다음 살아 있는 이웃인 Imp와 Poisoner를 세어 `2`가 나오는지 확인한다.
- [ ] `INF-04` [fortune-teller-red-herring.json](../../fixtures/acceptance/trouble-brewing/fortune-teller-red-herring.json) — good 플레이어 또는 자신을 Red Herring으로 지정할 수 있는지 확인한다.
- [ ] `REG-05` [fortune-teller-recluse-registration.json](../../fixtures/acceptance/trouble-brewing/fortune-teller-recluse-registration.json) — 실제 Imp, Red Herring, Demon 등록 Recluse가 각각 yes 사유로 구분되는지 확인한다.
- [ ] `INF-04B` [fortune-teller-detects-dead-demon.json](../../fixtures/acceptance/trouble-brewing/fortune-teller-detects-dead-demon.json) — 이미 죽은 Imp를 선택해도 yes가 나오는지 확인한다.
- [ ] `IMP-01` [poisoner-false-empath-information.json](../../fixtures/acceptance/trouble-brewing/poisoner-false-empath-information.json) — poisoned Empath에게 거짓 수치를 전달하고 poison 사유가 기록되는지 확인한다.
- [ ] `IMP-02` [poisoner-expiry-at-next-dusk.json](../../fixtures/acceptance/trouble-brewing/poisoner-expiry-at-next-dusk.json) — 다음 밤 시작 때 이전 독이 해제되어 있는지 확인한다.
- [ ] `IMP-02B` [poisoner-death-ends-poison.json](../../fixtures/acceptance/trouble-brewing/poisoner-death-ends-poison.json) — Poisoner 처형 사망을 확정하면 지속 중이던 Empath 독이 즉시 끝나는지 확인한다.
- [ ] `INF-05` [spy-grimoire-reveal.json](../../fixtures/acceptance/trouble-brewing/spy-grimoire-reveal.json) — Spy reveal에 실제 직업과 필요한 상태만 표시되고 Storyteller 조작 화면 비밀이 새지 않는지 확인한다.
- [ ] `VOT-01` [butler-master-selection.json](../../fixtures/acceptance/trouble-brewing/butler-master-selection.json) — Butler 자신은 Master로 선택할 수 없고, 투표 규칙은 경고·운영 보조이며 강제 무효화하지 않는지 확인한다.

## 3. 밤 행동과 사망 후속 처리

- [ ] `NGT-01` [monk-protection-before-imp.json](../../fixtures/acceptance/trouble-brewing/monk-protection-before-imp.json) — 보호 후 같은 대상을 Imp로 공격해 사망이 없고 재공격도 없는지 확인한다.
- [ ] `NEG-01` [monk-cannot-protect-self.json](../../fixtures/acceptance/trouble-brewing/monk-cannot-protect-self.json) — Monk 자신을 선택할 수 없고 다른 플레이어만 확정 가능한지 확인한다.
- [ ] `NGT-02` [soldier-safe-from-imp.json](../../fixtures/acceptance/trouble-brewing/soldier-safe-from-imp.json) — sober/healthy actual Soldier 공격이 사망 없음으로 끝나는지 확인한다.
- [ ] `IMP-03` [soldier-poisoned-dies.json](../../fixtures/acceptance/trouble-brewing/soldier-poisoned-dies.json) — poisoned Soldier가 Imp 공격으로 죽는지 확인한다.
- [ ] `ST-01` [mayor-dies-or-bounces.json](../../fixtures/acceptance/trouble-brewing/mayor-dies-or-bounces.json) — 재import하며 Mayor 사망과 다른 대상 bounce 두 분기를 시험하고 독립적인 `아무도 죽지 않음` 선택지가 없는지 확인한다.
- [ ] `ST-02` [mayor-bounce-dead-or-protected.json](../../fixtures/acceptance/trouble-brewing/mayor-bounce-dead-or-protected.json) — dead 5번과 Monk-protected Soldier 2번으로 각각 bounce해 결과적 사망 없음이 되는지 확인한다.
- [ ] `IMP-03B` [mayor-poisoned-has-no-bounce.json](../../fixtures/acceptance/trouble-brewing/mayor-poisoned-has-no-bounce.json) — poisoned Mayor 공격에서 결정 UI 없이 Mayor가 죽고 bounce가 적용되지 않는지 확인한다.
- [ ] `TRG-01` [ravenkeeper-night-death-trigger.json](../../fixtures/acceptance/trouble-brewing/ravenkeeper-night-death-trigger.json) — 밤에 죽은 Ravenkeeper 후속 단계에서 살아 있거나 죽은 대상을 확인할 수 있는지 확인한다.
- [ ] `REG-06` [ravenkeeper-spy-recluse-registration.json](../../fixtures/acceptance/trouble-brewing/ravenkeeper-spy-recluse-registration.json) — 이미 죽은 Spy를 good 직업, 죽은 Recluse를 evil 직업으로 보는 등록 선택지를 각각 확인한다.
- [ ] `SUC-01` [imp-self-kill-minion-successor.json](../../fixtures/acceptance/trouble-brewing/imp-self-kill-minion-successor.json) — Imp 자살 후 살아 있는 Minion 중 새 Imp를 고르고 같은 밤 다시 행동하지 않는지 확인한다.
- [ ] `IMP-04` [imp-poisoned-no-kill.json](../../fixtures/acceptance/trouble-brewing/imp-poisoned-no-kill.json) — poisoned Imp 공격이 `NIGHT_ACTION_NO_EFFECT`와 사망 없음으로 끝나는지 확인한다.
- [ ] `NGT-03` [imp-attacks-dead-player.json](../../fixtures/acceptance/trouble-brewing/imp-attacks-dead-player.json) — dead 대상을 공격할 수 있지만 추가 사망이 없고 already-dead 경고가 나오는지 확인한다.

## 4. 낮 능력, 지명과 처형

- [ ] `TRG-02` [virgin-townsfolk-nomination.json](../../fixtures/acceptance/trouble-brewing/virgin-townsfolk-nomination.json) — actual Townsfolk 지명자가 즉시 처형되고 Virgin 능력이 소비되며 그날 지명이 끝나는지 확인한다.
- [ ] `TRG-03` [virgin-outsider-spends-without-execution.json](../../fixtures/acceptance/trouble-brewing/virgin-outsider-spends-without-execution.json) — Outsider 지명에서는 Virgin만 소비되고 정상 투표로 이어지는지 확인한다.
- [ ] `IMP-05` [virgin-poisoned-spends-without-execution.json](../../fixtures/acceptance/trouble-brewing/virgin-poisoned-spends-without-execution.json) — poisoned Virgin이 소비되지만 Townsfolk 지명자가 처형되지 않는지 확인한다.
- [ ] `REG-07` [virgin-spy-registers-townsfolk.json](../../fixtures/acceptance/trouble-brewing/virgin-spy-registers-townsfolk.json) — Spy Townsfolk 등록 사용 시 즉시 처형되고 등록하지 않으면 정상 투표로 이어지는지 재import해 비교한다.
- [ ] `PUB-01` [slayer-shoots-imp.json](../../fixtures/acceptance/trouble-brewing/slayer-shoots-imp.json) — actual Slayer가 살아 있는 Imp를 죽이고 능력 소비 및 good 승리 경고까지 이어지는지 확인한다.
- [ ] `REG-08` [slayer-recluse-as-demon.json](../../fixtures/acceptance/trouble-brewing/slayer-recluse-as-demon.json) — Recluse를 Imp로 등록하면 죽고 canonical로 처리하면 아무 일도 없는지 비교한다.
- [ ] `IMP-06` [slayer-poisoned-spends-no-effect.json](../../fixtures/acceptance/trouble-brewing/slayer-poisoned-spends-no-effect.json) — poisoned Slayer가 Imp를 죽이지 못하지만 다시 사용할 수도 없는지 확인한다.
- [ ] `PUB-01B` [slayer-shoots-dead-imp.json](../../fixtures/acceptance/trouble-brewing/slayer-shoots-dead-imp.json) — 이미 죽은 Imp를 지목하면 추가 사망 없이 Slayer 능력만 소비되는지 확인한다.
- [ ] `IMP-07` [drunk-shown-slayer-has-no-ability.json](../../fixtures/acceptance/trouble-brewing/drunk-shown-slayer-has-no-ability.json) — shown Slayer인 actual Drunk에게 추적되는 Slayer 능력이 없는지 확인한다.
- [ ] `INF-06` [undertaker-learns-executed-drunk.json](../../fixtures/acceptance/trouble-brewing/undertaker-learns-executed-drunk.json) — 전날 처형되어 죽은 플레이어가 shown Slayer가 아니라 actual Drunk로 공개되는지 확인한다.
- [ ] `INF-06B` [undertaker-omitted-without-executed-death.json](../../fixtures/acceptance/trouble-brewing/undertaker-omitted-without-executed-death.json) — 전날 처형 사망이 없으면 밤 overview에 Undertaker 단계가 생성되지 않는지 확인한다.

## 5. 승계와 승리 조건

- [ ] `WIN-01` [saint-execution-evil-win-warning.json](../../fixtures/acceptance/trouble-brewing/saint-execution-evil-win-warning.json) — Saint 처형 사망 후 `SAINT_EXECUTED_EVIL_WIN` 경고와 수동 악팀 승리 확정을 확인한다.
- [ ] `IMP-08` [saint-poisoned-no-win-warning.json](../../fixtures/acceptance/trouble-brewing/saint-poisoned-no-win-warning.json) — poisoned Saint 처형 사망 후 승리 경고 없이 계속되는지 확인한다.
- [ ] `SUC-02` [scarlet-woman-succeeds-at-five-plus.json](../../fixtures/acceptance/trouble-brewing/scarlet-woman-succeeds-at-five-plus.json) — Imp 사망 직전 7명 생존에서 고정 Scarlet Woman 승계가 생기는지 확인한다.
- [ ] `SUC-03` [scarlet-woman-no-succession-below-five.json](../../fixtures/acceptance/trouble-brewing/scarlet-woman-no-succession-below-five.json) — Imp 사망 직전 4명 생존에서는 승계 없이 good 승리 경고가 생기는지 확인한다.
- [ ] `IMP-08B` [scarlet-woman-poisoned-no-succession.json](../../fixtures/acceptance/trouble-brewing/scarlet-woman-poisoned-no-succession.json) — 10명 생존이어도 poisoned Scarlet Woman은 승계하지 않고 good 승리 경고가 생기는지 확인한다.
- [ ] `WIN-02` [mayor-three-alive-no-execution.json](../../fixtures/acceptance/trouble-brewing/mayor-three-alive-no-execution.json) — 정확히 3명 생존에서 지명 종료·처형 없음 후 `MAYOR_GOOD_WIN` 경고와 수동 선팀 승리 확정을 확인한다.
- [ ] `WIN-03` [demon-dead-good-win-warning.json](../../fixtures/acceptance/trouble-brewing/demon-dead-good-win-warning.json) — Demon 사망 시 `DEMON_DEAD_GOOD_WIN` 경고가 나오는지 확인한다.
- [ ] `WIN-04` [two-alive-evil-win-warning.json](../../fixtures/acceptance/trouble-brewing/two-alive-evil-win-warning.json) — 생존자 2명에서 `TWO_LIVING_PLAYERS_EVIL_WIN` 경고가 나오는지 확인한다.

## 6. 투표, 공개 발표와 복구

- [ ] `VOT-02` [ghost-vote-spending.json](../../fixtures/acceptance/trouble-brewing/ghost-vote-spending.json) — dead 2번의 투표가 ghost vote를 한 번 소비하고 이후 다시 쓸 수 없는지 확인한다.
- [ ] `VOT-03` [tied-votes-no-execution-candidate.json](../../fixtures/acceptance/trouble-brewing/tied-votes-no-execution-candidate.json) — 4대4 최고 득표 동률 뒤 처형 후보가 없고 처형 없음만 가능한지 확인한다.
- [ ] `FLOW-01` [night-death-public-announcement.json](../../fixtures/acceptance/trouble-brewing/night-death-public-announcement.json) — 밤 사망이 dawn 발표 전까지 미공개 상태이며 발표 확정 후 경고가 사라지는지 확인한다.
- [ ] `FLOW-02` 아무 사례에서 행동 하나를 확정한 뒤 Undo하고, 현재 단계·능력 소비·독·보호·생사·유령 투표가 import 직후 상태로 돌아가는지 확인한다.
- [ ] `FLOW-03` 행동 하나를 확정한 뒤 export하고 같은 파일을 다시 import해 이벤트 로그, 현재 단계, 경고와 규칙 상태가 동일한지 확인한다.
- [ ] `FLOW-04` 기존 이벤트가 있는 상태에서 다른 fixture를 import할 때 교체 확인을 취소하면 현재 게임이 보존되고, 승인하면 fixture로 교체되는지 확인한다.

## 알려진 불일치

### `SET-05`: 5~6명 Evil 정보

공식 Glossary는 Minion info와 Demon info를 7명 이상에서만 제공한다고 정의한다. 현재 앱은 플레이어 수와 관계없이 실제 Minion 또는 Demon이 있으면 해당 첫날 밤 단계를 생성한다. 이번 인수 테스트 작업에서는 코드를 수정하지 않고 known failure로 기록한다.

- 공식 기대: 5~6명은 Minion/Demon 상호 정보와 Demon 블러프 3개 없음.
- 현재 관찰: 5명 fixture의 현재 단계가 `firstNight:minionInfo`이며 그 뒤 `firstNight:demonInfo`도 생성됨.
- 권장 후속: 별도 결함 티켓에서 5~6명 첫날 밤 순서와 Reveal UI를 함께 수정하고 회귀 테스트 추가.

## 완료 기준

- 55개 fixture가 모두 import되고 manifest 체크포인트에서 replay된다.
- `KNOWN FAIL SET-05`를 제외한 수동 항목이 모두 통과한다.
- 실패 항목은 fixture ID, 실제 화면 결과, export JSON, 재현 기기·브라우저를 함께 기록한다.
- 승리 조건은 공식 승리 팀과 경고 코드가 맞고 Storyteller의 명시적 종료 확정이 undo·export/import 후에도 유지된다.
