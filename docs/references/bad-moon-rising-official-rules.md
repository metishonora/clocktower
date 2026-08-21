# Bad Moon Rising 공식 규칙 기준

이 문서는 Issue #174에서 Bad Moon Rising(BMR) 구현의 사실 기준을 고정한다. Production
계약과 후속 이슈 분할은
[`issue-174-bad-moon-rising-contract.md`](../plans/issue-174-bad-moon-rising-contract.md)에
기록한다.

- 확인일: 2026-08-21 KST
- 대상: 기본 BMR 25개 캐릭터, 7–15인 표준 게임
- 제외: Traveller, Fabled, Custom Script, Jinx, house rule

## 출처와 우선순위

| 우선순위 | 자료 | 사용 범위 | 확인 결과 |
| --- | --- | --- | --- |
| 1 | [공식 Character Wiki](https://wiki.bloodontheclocktower.com/Bad_Moon_Rising) 및 각 Character의 Summary/How to Run | 능력 의미, 실제 처리, timing, 취함·중독, 예외 | 25개 페이지와 revision 확인 |
| 2 | [공식 Glossary](https://wiki.bloodontheclocktower.com/Glossary), [Abilities](https://wiki.bloodontheclocktower.com/Abilities), [States](https://wiki.bloodontheclocktower.com/States) | 공통 용어, ability validity, registration, resurrection, 처리 순서 | 2026-08-21 확인 |
| 3 | [공식 BMR 제품 페이지](https://bloodontheclocktower.com/pages/bad-moon-rising), [공식 night sheet](https://bloodontheclocktower.com/products/night-sheet-bad-moon-rising), [공식 reminder collection](https://bloodontheclocktower.com/collections/bad-moon-rising-reminder-tokens) | night order, 구성품 수량, reminder token 이름 | 양면 night sheet, 25 character token, 42 reminder token 확인 |
| 4 | 공식 실물 BMR Almanac | 인쇄판 대조 | 공식 상점은 23쪽 실물 Almanac을 확인하지만 공개 PDF는 확인하지 못함 |
| 번역 | [한국어 BMR 스크립트](https://clocktower.teeroz.net/ko/scripts/bad-moon-rising) | 한국어 표시명과 짧은 능력 문구만 사용 | 별도 [한국어 기준](bad-moon-rising-korean-terms.md)에 전사 |

공식 Wiki와 실물 Almanac의 표현이 다르면 차이를 기록한 뒤 최신 공식 Wiki의 How to Run을
우선한다. 한국어 자료는 규칙 판정의 근거가 아니다. 예를 들어 한국어 자료가 함께 제공하는
영문 Courtier later-night 안내에는 `poisoned`라는 표현이 있으나, 공식 Wiki와 능력 문구는
`drunk`이므로 취함으로 판정한다.

### 확인한 Wiki revision

스크립트 목록은 [Bad Moon Rising revision 2871](https://wiki.bloodontheclocktower.com/index.php?title=Bad_Moon_Rising&oldid=2871),
Character 상세 규칙은 아래 고정 revision을 조사 기준으로 삼았다. 날짜는 Wiki의 UTC 수정일이다.

| Character | Revision | 수정일 |
| --- | ---: | --- |
| [Grandmother](https://wiki.bloodontheclocktower.com/index.php?title=Grandmother&oldid=2978) | 2978 | 2025-11-19 |
| [Sailor](https://wiki.bloodontheclocktower.com/index.php?title=Sailor&oldid=1768) | 1768 | 2024-01-25 |
| [Chambermaid](https://wiki.bloodontheclocktower.com/index.php?title=Chambermaid&oldid=2966) | 2966 | 2025-11-19 |
| [Exorcist](https://wiki.bloodontheclocktower.com/index.php?title=Exorcist&oldid=2973) | 2973 | 2025-11-19 |
| [Innkeeper](https://wiki.bloodontheclocktower.com/index.php?title=Innkeeper&oldid=2982) | 2982 | 2025-11-19 |
| [Gambler](https://wiki.bloodontheclocktower.com/index.php?title=Gambler&oldid=3073) | 3073 | 2026-03-20 |
| [Gossip](https://wiki.bloodontheclocktower.com/index.php?title=Gossip&oldid=1773) | 1773 | 2024-01-25 |
| [Courtier](https://wiki.bloodontheclocktower.com/index.php?title=Courtier&oldid=2968) | 2968 | 2025-11-19 |
| [Professor](https://wiki.bloodontheclocktower.com/index.php?title=Professor&oldid=1775) | 1775 | 2024-01-25 |
| [Minstrel](https://wiki.bloodontheclocktower.com/index.php?title=Minstrel&oldid=2600) | 2600 | 2024-12-06 |
| [Tea Lady](https://wiki.bloodontheclocktower.com/index.php?title=Tea_Lady&oldid=1777) | 1777 | 2024-01-25 |
| [Pacifist](https://wiki.bloodontheclocktower.com/index.php?title=Pacifist&oldid=2601) | 2601 | 2024-12-06 |
| [Fool](https://wiki.bloodontheclocktower.com/index.php?title=Fool&oldid=2636) | 2636 | 2024-12-23 |
| [Tinker](https://wiki.bloodontheclocktower.com/index.php?title=Tinker&oldid=1782) | 1782 | 2024-01-25 |
| [Moonchild](https://wiki.bloodontheclocktower.com/index.php?title=Moonchild&oldid=1783) | 1783 | 2024-01-25 |
| [Goon](https://wiki.bloodontheclocktower.com/index.php?title=Goon&oldid=2977) | 2977 | 2025-11-19 |
| [Lunatic](https://wiki.bloodontheclocktower.com/index.php?title=Lunatic&oldid=3112) | 3112 | 2026-07-08 |
| [Godfather](https://wiki.bloodontheclocktower.com/index.php?title=Godfather&oldid=2394) | 2394 | 2024-10-07 |
| [Devil's Advocate](https://wiki.bloodontheclocktower.com/index.php?title=Devil%27s_Advocate&oldid=2594) | 2594 | 2024-12-06 |
| [Assassin](https://wiki.bloodontheclocktower.com/index.php?title=Assassin&oldid=1786) | 1786 | 2024-01-25 |
| [Mastermind](https://wiki.bloodontheclocktower.com/index.php?title=Mastermind&oldid=2993) | 2993 | 2025-11-19 |
| [Zombuul](https://wiki.bloodontheclocktower.com/index.php?title=Zombuul&oldid=3022) | 3022 | 2025-11-19 |
| [Pukka](https://wiki.bloodontheclocktower.com/index.php?title=Pukka&oldid=3074) | 3074 | 2026-03-20 |
| [Shabaloth](https://wiki.bloodontheclocktower.com/index.php?title=Shabaloth&oldid=1790) | 1790 | 2024-01-25 |
| [Po](https://wiki.bloodontheclocktower.com/index.php?title=Po&oldid=3104) | 3104 | 2026-05-08 |

후속 구현을 시작할 때는 current page의 revision을 다시 확인하고, 변경되었다면 이 기준과의 차이를
먼저 기록한다.

## 공통 해석 규칙

- `choose`가 있으면 해당 Character의 Player가 선택하고, 없으면 Storyteller가 결정한다.
- `might`는 Storyteller가 발생 여부를 선택한다.
- 능력은 별도 문구가 없으면 즉시 처리한다. night sheet 순서보다 능력 문구와 trigger timing이
  우선한다.
- 사망, 취함, 중독 상태의 Character는 능력이 없다. 지속 효과는 source ability가 비활성화된
  동안 적용되지 않으며, 정해진 기간 안에 source가 다시 유효해지면 다시 적용될 수 있다.
- 취하거나 중독된 Player가 능력을 사용하거나 trigger하면 사용은 소비되지만 실제 효과는 없다.
  정보 능력은 허용 범위 안에서 거짓 정보를 받을 수 있다.
- `register as`는 실제 Character, Alignment, 생사 상태를 바꾸지 않는다.
- 부활한 Player는 능력을 되찾고, 사용한 once-per-game 능력도 새로 사용할 수 있다. first-night
  또는 `start knowing` 능력은 부활한 밤에 다시 동작한다.
- Execution과 Death는 별개다. 처형되었지만 생존할 수 있고, 그 처형으로 그날의 처형은 끝난다.
- 밤의 여러 Death는 실제 발생 순서대로 기록한다. 새벽에는 사망자와 부활자를 공개하되 원인은
  공개하지 않는다.

## 스크립트 기본 계약

### Character catalog

| Kind | 안정 ID | 한국어 표시명 | 공식 능력 문구 |
| --- | --- | --- | --- |
| Townsfolk | [`grandmother`](https://wiki.bloodontheclocktower.com/Grandmother) | 할머니 | You start knowing a good player & their character. If the Demon kills them, you die too. |
| Townsfolk | [`sailor`](https://wiki.bloodontheclocktower.com/Sailor) | 선원 | Each night, choose an alive player: either you or they are drunk until dusk. You can't die. |
| Townsfolk | [`chambermaid`](https://wiki.bloodontheclocktower.com/Chambermaid) | 객실 청소부 | Each night, choose 2 alive players (not yourself): you learn how many woke tonight due to their ability. |
| Townsfolk | [`exorcist`](https://wiki.bloodontheclocktower.com/Exorcist) | 구마사제 | Each night*, choose a player (different to last night): the Demon, if chosen, learns who you are then doesn't wake tonight. |
| Townsfolk | [`innkeeper`](https://wiki.bloodontheclocktower.com/Innkeeper) | 여관 주인 | Each night*, choose 2 players: they can't die tonight, but 1 is drunk until dusk. |
| Townsfolk | [`gambler`](https://wiki.bloodontheclocktower.com/Gambler) | 도박사 | Each night*, choose a player & guess their character: if you guess wrong, you die. |
| Townsfolk | [`gossip`](https://wiki.bloodontheclocktower.com/Gossip) | 험담꾼 | Each day, you may make a public statement. Tonight, if it was true, a player dies. |
| Townsfolk | [`courtier`](https://wiki.bloodontheclocktower.com/Courtier) | 궁정대신 | Once per game, at night, choose a character: they are drunk for 3 nights & 3 days. |
| Townsfolk | [`professor`](https://wiki.bloodontheclocktower.com/Professor) | 교수 | Once per game, at night*, choose a dead player: if they are a Townsfolk, they are resurrected. |
| Townsfolk | [`minstrel`](https://wiki.bloodontheclocktower.com/Minstrel) | 음유시인 | When a Minion dies by execution, all other players (except Travellers) are drunk until dusk tomorrow. |
| Townsfolk | [`teaLady`](https://wiki.bloodontheclocktower.com/Tea_Lady) | 찻집 여인 | If both your alive neighbors are good, they can't die. |
| Townsfolk | [`pacifist`](https://wiki.bloodontheclocktower.com/Pacifist) | 평화주의자 | Executed good players might not die. |
| Townsfolk | [`fool`](https://wiki.bloodontheclocktower.com/Fool) | 어릿광대 | The 1st time you die, you don't. |
| Outsider | [`tinker`](https://wiki.bloodontheclocktower.com/Tinker) | 땜장이 | You might die at any time. |
| Outsider | [`moonchild`](https://wiki.bloodontheclocktower.com/Moonchild) | 달의 자손 | When you learn that you died, publicly choose 1 alive player. Tonight, if it was a good player, they die. |
| Outsider | [`goon`](https://wiki.bloodontheclocktower.com/Goon) | 건달 | Each night, the 1st player to choose you with their ability is drunk until dusk. You become their alignment. |
| Outsider | [`lunatic`](https://wiki.bloodontheclocktower.com/Lunatic) | 미치광이 | You think you are a Demon, but you are not. The Demon knows who you are & who you choose at night. |
| Minion | [`godfather`](https://wiki.bloodontheclocktower.com/Godfather) | 대부 | You start knowing which Outsiders are in play. If 1 died today, choose a player tonight: they die. [-1 or +1 Outsider] |
| Minion | [`devilsAdvocate`](https://wiki.bloodontheclocktower.com/Devil%27s_Advocate) | 악마의 변호사 | Each night, choose a living player (different to last night): if executed tomorrow, they don't die. |
| Minion | [`assassin`](https://wiki.bloodontheclocktower.com/Assassin) | 암살자 | Once per game, at night*, choose a player: they die, even if for some reason they could not. |
| Minion | [`mastermind`](https://wiki.bloodontheclocktower.com/Mastermind) | 주모자 | If the Demon dies by execution (ending the game), play for 1 more day. If a player is then executed, their team loses. |
| Demon | [`zombuul`](https://wiki.bloodontheclocktower.com/Zombuul) | 좀버얼 | Each night*, if no-one died today, choose a player: they die. The 1st time you die, you live but register as dead. |
| Demon | [`pukka`](https://wiki.bloodontheclocktower.com/Pukka) | 푸카 | Each night, choose a player: they are poisoned. The previously poisoned player dies then becomes healthy. |
| Demon | [`shabaloth`](https://wiki.bloodontheclocktower.com/Shabaloth) | 샤발로스 | Each night*, choose 2 players: they die. A dead player you chose last night might be regurgitated. |
| Demon | [`po`](https://wiki.bloodontheclocktower.com/Po) | 포 | Each night*, you may choose a player: they die. If your last choice was no-one, choose 3 players tonight. |

Project ID는 기존 camelCase 관례를 따른다. 외부 script JSON의 `tealady`,
`devilsadvocate`를 그대로 저장하지 않는다.

### 지원 Player 수와 Setup 분포

공식 Setup은 BMR과 S&V에 7명 이상을 권장한다. 5–6명도 물리적으로 가능하지만 BMR Character가
한쪽 팀에 불공정한 이점을 줄 수 있어 권장하지 않는다. Traveller를 제외한 표준 지원 범위는
7–15명으로 고정하는 것을 권장한다.

| Players | Townsfolk | Outsider | Minion | Demon |
| ---: | ---: | ---: | ---: | ---: |
| 7 | 5 | 0 | 1 | 1 |
| 8 | 5 | 1 | 1 | 1 |
| 9 | 5 | 2 | 1 | 1 |
| 10 | 7 | 0 | 2 | 1 |
| 11 | 7 | 1 | 2 | 1 |
| 12 | 7 | 2 | 2 | 1 |
| 13 | 9 | 0 | 3 | 1 |
| 14 | 9 | 1 | 3 | 1 |
| 15 | 9 | 2 | 3 | 1 |

Godfather가 있으면 Storyteller는 다음 중 유효한 하나를 선택한다.

- Townsfolk 1명을 빼고 Outsider 1명을 더한다.
- Outsider 1명을 빼고 Townsfolk 1명을 더한다.

Outsider가 0명인 기본 분포에서는 제거할 수 없으므로 `+1 Outsider`만 가능하다. 이 선택은
Character 목록만으로 결정되지 않으므로 현재의 단일 `setupDistribution` 결과보다 넓은 계약이
필요하다.

7명 이상이면 첫날 밤 Minion은 다른 Minion과 Demon을 알고, Demon은 Minion과 게임에 없는 선한
Character 3개를 bluff로 안다. Lunatic은 별도의 가짜 Minion 및 bluff 정보를 받으며, 실제 Demon은
자신의 실제 Demon Character와 Lunatic Player를 추가로 안다.

## 공식 night order

2026-08-21에 공식 스토어가 제공하는 [First Night 원본 이미지](https://bloodontheclocktower.com/cdn/shop/files/BMR_Night_Sheet_-_First_Night.jpg?v=1663659237&width=1445)와
[Other Nights 원본 이미지](https://bloodontheclocktower.com/cdn/shop/files/BMR_Night_Sheet_-_Other_Nights.jpg?v=1663659234&width=1445)를
직접 대조했다. 제품 페이지에는 sheet revision/인쇄일 메타데이터가 없다.

### First night

1. Dusk
2. Minion Info
3. Lunatic
4. Demon Info
5. Sailor
6. Courtier
7. Godfather
8. Devil's Advocate
9. Pukka
10. Grandmother
11. Chambermaid
12. Dawn

### Later night

1. Dusk
2. Sailor
3. Innkeeper
4. Courtier
5. Gambler
6. Devil's Advocate
7. Lunatic
8. Exorcist
9. Zombuul
10. Pukka
11. Shabaloth resurrection, then Shabaloth attack
12. Po
13. Assassin
14. Godfather
15. Professor
16. Gossip
17. Tinker
18. Moonchild
19. Grandmother
20. Chambermaid
21. Dawn and Death/Resurrection announcement

Minstrel, Tea Lady, Pacifist, Fool, Goon, Mastermind은 고정 wake entry보다 trigger에 따라 즉시
처리한다. Exorcist가 Demon을 막아도 Demon의 별도 passive/delayed 효과까지 지우지는 않는다.

## Reminder token inventory

공식 collection은 고유 제품명 34종을 제공하고, 공식 BMR 제품 페이지는 실물 42개를 명시한다.
아래 중복 수량은 동시 배치 요구와 How to Run을 대조해 42개에 맞춘 것이다.

| Character | Token | 수량 | 생성 | 제거/교체 |
| --- | --- | ---: | --- | --- |
| Grandmother | Grandchild | 1 | Setup에서 good Player 지정 | source ability가 영구 소멸할 때 |
| Grandmother | Dead | 1 | Demon이 Grandchild를 죽인 밤 | 새벽 Death 확정 뒤 기록으로 대체 |
| Sailor | Drunk | 1 | 매일 밤 Sailor 또는 선택 대상 | 다음 dusk 또는 다음 선택 교체 시 |
| Exorcist | Chosen | 1 | 매일 밤 선택 | 다음 밤 새 선택 시 교체 |
| Innkeeper | Safe | 2 | later night 선택 2명 | dawn |
| Innkeeper | Drunk | 1 | 선택 2명 중 Storyteller가 결정 | 다음 dusk |
| Gambler | Dead | 1 | 잘못 추측하고 실제 Death 발생 | 새벽 Death 확정 뒤 기록으로 대체 |
| Gossip | Dead | 1 | 참인 공개 발언의 tonight trigger | 처리 완료 시 |
| Courtier | Drunk 1/2/3 | 각 1 | 사용 시 Drunk 1 | 매일 밤 다음 숫자로 교체, 마지막 다음 dusk 제거 |
| Courtier | No Ability | 1 | once-per-game 사용 확정 | 새 ability instance 전까지 |
| Professor | Alive | 1 | Townsfolk 부활 | dawn 공개 후 기록으로 대체 |
| Professor | No Ability | 1 | once-per-game 사용 확정 | 새 ability instance 전까지 |
| Minstrel | Everyone Is Drunk | 1 | Minion이 execution으로 사망 | 다음 dusk |
| Tea Lady | Cannot Die | 2 | 두 alive neighbor가 모두 good | 조건 또는 source ability가 비활성화되면 |
| Fool | No Ability | 1 | 첫 실제 Death를 막음 | 새 ability instance 전까지 |
| Goon | Drunk | 1 | 그 밤 첫 chooser | 다음 dusk |
| Lunatic | Chosen | 3 | 가짜 Demon 선택 순서대로 최대 3명 | 실제 Demon에게 전달한 뒤 제거 |
| Tinker | Dead | 1 | Storyteller가 Death를 선택 | 밤이면 dawn, 낮이면 즉시 기록으로 대체 |
| Moonchild | Dead | 1 | 사망 인지 후 good target 선택 | tonight 처리 후 |
| Godfather | Died Today | 1 | 낮에 Outsider 사망 | Godfather action 뒤/dawn |
| Godfather | Dead | 1 | Godfather target Death | dawn 공개 후 |
| Devil's Advocate | Survives Execution | 1 | 밤에 living Player 선택 | tomorrow 종료 또는 다음 선택 시 |
| Assassin | Dead | 1 | 선택 대상 Death | dawn 공개 후 |
| Assassin | No Ability | 1 | once-per-game 사용 확정 | 새 ability instance 전까지 |
| Zombuul | Died Today | 1 | 낮 Death 또는 첫 apparent Death | 다음 night Zombuul wake 판정 후 |
| Zombuul | Dead | 1 | Zombuul attack target Death | dawn 공개 후 |
| Pukka | Poisoned | 2 | 이번/이전 Pukka target | target Death 뒤 healthy, source 무효 기간에는 inactive |
| Pukka | Dead | 1 | 지연 Death | dawn 공개 후 |
| Shabaloth | Dead | 2 | 순서가 있는 attack 2건 | 다음 밤 resurrection 자격 만료 시 |
| Shabaloth | Alive | 1 | Storyteller가 regurgitate 선택 | dawn 공개 후 |
| Po | 3 Attacks | 1 | Po가 명시적으로 no-one 선택 | 다음 Po action에서 3명 선택 후 |
| Po | Dead | 3 | 선택 순서대로 최대 3건 | dawn 공개 후 |

위 표가 25개 Character의 reminder 연결 기준이다. 표에 없는 Chambermaid, Pacifist,
Mastermind는 공식 collection에 전용 reminder token이 없다. 나머지 22개 Character는 모두 위 표의
한 행 이상에 연결된다.

## Character 규칙 매트릭스

`자동`은 실제 결과를 Core가 결정할 수 있음을, `ST 선택`은 유효 후보와 결과 기록은 자동화하되
Storyteller가 결과를 결정함을, `수동`은 규칙 밖의 발언이나 임의 시점을 UI가 대신 판단하지 않음을
뜻한다. 하나의 Character가 둘 이상을 함께 가질 수 있다.

### Townsfolk

| Character | 입력/trigger | 실제 결과와 기간 | Delivered Information / 공개 | 유효 조건과 취함·중독 | 처리 |
| --- | --- | --- | --- | --- | --- |
| Grandmother | Setup에서 ST가 good Grandchild 지정 | first night에 Player+Character를 알고, Demon이 Grandchild를 죽이면 같은 Death batch에서 Grandmother 추가 Death | Grandmother에게만 초기 정보. Grandchild와 공개판에는 관계 비공개 | 정보 시점 impaired면 허용 범위의 거짓 정보. Grandchild Death trigger 시 source가 impaired면 추가 Death 없음 | ST 선택 + 자동 |
| Sailor | 매일 밤 alive Player 1명 선택 | ST가 Sailor/target 중 1명을 다음 dusk까지 drunk. sober Sailor는 어떤 원인의 Death도 방지 | Player에게 drunk 결과를 알리지 않음. execution survival만 공개 | source가 impaired면 protection과 새 drunk 효과 없음. 다른 보호가 Death를 먼저 막으면 Sailor 능력 소비 개념 없음 | ST 선택 + 자동 |
| Chambermaid | 매일 밤 alive 2명, self 제외 | 그 밤 자신의 능력 때문에 실제로 깬 수 0–2 계산. impaired 상태로 깬 Player도 포함, 타 능력/evil info 때문에 깬 것은 제외 | Chambermaid에게 숫자만 Reveal | impaired Chambermaid에게는 0–2 중 임의 값. 선택 가능 대상이 2명 미만이면 wake하지 않음 | 자동 계산 + ST 전달 |
| Exorcist | later night, 전날과 다른 Player 1명 | Demon이면 그 밤 Demon action wake를 차단. Pukka 지연 Death, Shabaloth resurrection 등 별도 효과는 유지 | 실제 Demon에게 Exorcist Character와 Player를 Reveal | source impaired면 Demon을 선택해도 차단/Reveal 없음 | 자동 + Reveal |
| Innkeeper | later night Player 2명 | 둘은 그 밤 모든 일반 Death로부터 보호, ST가 둘 중 1명을 다음 dusk까지 drunk | 선택 결과는 Innkeeper만 알며 어느 쪽이 drunk인지는 비공개 | source/ability가 비활성화되면 두 protection 모두 inactive. self를 drunk로 선택하면 source도 꺼져 두 대상이 위험해짐 | ST 선택 + 자동 |
| Gambler | later night Player 1명과 Character 1개 | 실제 Character와 다르면 Gambler가 그 자리에서 Death | 정답 여부를 직접 Reveal하지 않음 | source impaired면 잘못 추측해도 능력으로 죽지 않음. 선택은 dead/alive/self 모두 가능 | 자동 |
| Gossip | 낮에 모두가 이해한 공개 statement | 밤 trigger 시 statement가 참이면 ST가 Player 1명 Death | statement와 밤 Death만 공개, 인과는 비공개 | statement 당시 상태가 아니라 밤 trigger 시 source validity 사용 | 수동 statement + ST 선택 |
| Courtier | 매일 밤 optional, game당 1회 Character 선택 | in-play Character의 Player 1명이 즉시 3 nights & 3 days drunk. 정해진 마지막 dusk에 만료 | 성공 여부와 대상 Player를 Reveal하지 않음 | impaired 상태의 사용은 소비되나 효과 없음. 이후 source가 impaired면 남은 기간 동안 효과가 inactive였다가 회복 가능 | 자동 target resolution + 기간 |
| Professor | later night optional, game당 1회 dead Player | Townsfolk면 resurrection과 새 ability instance. first-night/start-knowing은 즉시, 이후 순서면 같은 밤 action | dawn에 부활 Player만 공개, 원인 비공개 | non-Townsfolk 또는 source impaired 선택도 사용 소비, 부활 없음 | 자동 + 공개 |
| Minstrel | Minion이 execution으로 실제 Death | 다른 모든 non-Traveller가 즉시 다음 dusk까지 drunk | drunk 원인/대상은 공개하지 않음 | dead Minion execution, execution survival, impaired source에는 trigger 없음 | 자동 |
| Tea Lady | 양쪽 alive neighbor가 모두 good | 두 neighbor는 조건이 유지되는 동안 Death 불가 | execution survival만 공개, 이유 비공개 | source가 impaired/dead거나 한 neighbor가 evil이면 즉시 inactive. seating/life/alignment 변화마다 재계산. Assassin은 우회 | 자동 |
| Pacifist | good Player execution | ST가 Death를 막을 수 있음. execution 자체는 성공하고 day 종료 | executed-but-alive만 공개 | source가 유효하고 executee가 실제 good일 때만 후보. 사용 횟수 상태 없음 | ST 선택 |
| Fool | 처음 실제로 죽으려는 순간 | Death를 막고 ability spent. 다른 protection이 이미 막은 시도에는 소비하지 않음 | survival만 공개 | impaired source면 보호 없음. Assassin은 우회 | 자동 |

### Outsiders

| Character | 입력/trigger | 실제 결과와 기간 | Delivered Information / 공개 | 유효 조건과 취함·중독 | 처리 |
| --- | --- | --- | --- | --- | --- |
| Tinker | ST가 게임 중 임의 시점에 결정 | 유효한 protection이 없으면 Death | 낮이면 즉시, 밤이면 dawn에 Death만 공개 | source impaired면 ability Death 없음. 게임을 끝내는 임의 Death는 공식 권고상 피함 | 수동 ST 선택 + 자동 Death |
| Moonchild | 자신의 Death를 알게 된 직후 publicly alive Player 1명 | 선택 당시 good이면 tonight Death. Alignment는 선택 시 snapshot | 선택 자체는 공개, 실제 결과 원인은 비공개 | 선택 시 impairment가 아니라 밤 trigger 시 source validity가 결과를 결정 | 공개 수동 선택 + 자동 |
| Goon | 매일 밤 자신을 능력으로 처음 선택한 Player | chooser가 즉시 다음 dusk까지 drunk, 그 action은 무효. Goon은 chooser Alignment로 변경 | Alignment가 바뀌면 Goon에게만 secret Reveal | Goon 자신이 impaired면 새 효과 없음. ST가 대신 고른 대상은 trigger 아님. chooser가 이미 impaired여도 Goon 효과 발생. Assassin은 Goon을 죽이지만 Alignment 변경은 발생 | 자동 interrupt + Reveal |
| Lunatic | Setup Actual=`lunatic`, Shown=Demon. 매일 가짜 Demon action | 선택은 실제 game state에 직접 효과 없음. 실제 Demon에게 전달 | Lunatic에게 가짜 Minion/bluff/Demon workflow. 실제 Demon에게 real Demon identity, Lunatic Player와 매일 선택 전달 | 공식 페이지는 impaired Lunatic의 presentation 중단 여부를 별도로 정하지 않으므로 플레이어 기만 유지 범위를 product 결정으로 남김 | ST 가짜 정보 + Reveal |

### Minions

| Character | 입력/trigger | 실제 결과와 기간 | Delivered Information / 공개 | 유효 조건과 취함·중독 | 처리 |
| --- | --- | --- | --- | --- | --- |
| Godfather | Setup ±1 Outsider 선택. first night Outsider info. 낮 Outsider Death 후 밤 target | 하루 Outsider Death 수와 무관하게 밤에 최대 1명 Death | 실제 in-play Outsider Character를 계산해 Godfather에게만 Reveal. Death 원인은 비공개 | first-night info 시 impaired면 허용 범위의 거짓 정보를 전달할 수 있음. 밤 action 시 source가 유효해야 kill. Setup modifier는 game start 계약 | ST Setup 선택 + 자동 계산/전달 |
| Devil's Advocate | 매일 밤 전날과 다른 living Player | tomorrow execution이면 죽지 않음 | selection 비공개, execution survival만 공개 | source가 protection 판정 때 inactive면 적용 안 됨. apparent-dead Zombuul은 선택 불가 | 자동 |
| Assassin | later night optional, game당 1회 Player | target은 다른 protection/생존 능력을 모두 무시하고 Death | target/원인 비공개 | source impaired면 사용 소비, Death 없음. Goon trigger는 먼저 발생하여 Goon Alignment가 바뀌지만 unstoppable Death는 유지 | 자동 |
| Mastermind | Demon이 execution으로 죽어 즉시 good win 조건 | game end를 보류하고 night+day 1회 추가. 다음 good execution이면 evil win, evil/no execution이면 good win; executee 생존 여부 무관 | Demon Death와 추가 Day 이유 비공개 | Demon Death trigger 시 source가 유효해야 함. extra cycle 중 source loss의 의미는 구현 전 명시 결정 필요 | 자동 game-end gate |

### Demons

| Character | 입력/trigger | 실제 결과와 기간 | Delivered Information / 공개 | 유효 조건과 취함·중독 | 처리 |
| --- | --- | --- | --- | --- | --- |
| Zombuul | later night, 오늘 낮 아무도 죽지 않았으면 Player 1명 | 첫 Death attempt는 실제 생존하되 공개·등록상 dead. 두 번째 실제 Death로 good win. apparent-dead 동안 attack 가능 | 첫 Death는 정상 Death처럼 공개하고 Town Square/ghost vote/nomination은 dead로 처리 | 첫 attempt 때 impaired면 실제 Death. apparent-dead 뒤 impaired여도 alive라고 재공개하지 않음 | 자동 + 이중 생사 모델 |
| Pukka | 매일 밤 새 Player 1명 | 새 target 즉시 poisoned. 이전 target은 poisoned 상태로 Death를 시도한 뒤 healthy | poison 비공개, Death만 dawn 공개 | Exorcist는 새 선택만 막고 이전 지연 Death는 유지. source impaired면 이전 target Death가 미뤄지고 poison 유지. Innkeeper가 막아도 poison은 제거 | 자동 scheduled effect |
| Shabaloth | later night 순서 있는 Player 2명 | 순서대로 Death attempt. 다음 밤 attack 전에 전날 선택되어 현재 dead인 1명을 ST가 부활시킬 수 있음 | dawn에 Death/Resurrection 대상만 공개 | source가 dead/impaired면 resurrection과 attack 없음. resurrection은 새 ability instance이며 night order에 따라 즉시/나중 행동 | ST resurrection + 자동 ordered attacks |
| Po | later night 0명 또는 1명, charged이면 정확히 3명 순서 선택 | 명시적 0명 선택은 다음 실제 Po action을 3 attacks로 예약. 3 attacks는 순서대로 판정 | dawn Death만 공개 | impaired 상태의 명시적 no-one도 charge. Exorcist skip은 선택이 아니며 charge를 만들지 않고 기존 charge를 유지. 중간 Goon trigger로 Po가 drunk가 되면 해당/후속 attack 무효 | 자동 state machine |

## 확인이 필요한 공식 자료 공백

- 공식 사이트에서 BMR 실물 Almanac의 존재와 23쪽 사양은 확인했지만 공개 PDF는 찾지 못했다.
  실물 Almanac을 제공받으면 판본/인쇄일/SHA-256을 기록하고 Wiki와 대조해야 한다.
- official reminder collection은 고유 이름 34종만 노출한다. 위 중복 수량은 공식 총수량 42와
  How to Run의 동시 배치 수를 맞춘 추론이므로 실물 punchboard로 최종 확인한다.
- 기본 BMR 안에서는 Jinx가 필요 없으므로 제외했다. 미래 Custom Script 지원 시 최신 Jinx를 별도
  계약으로 조사한다.
