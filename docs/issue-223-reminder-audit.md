# #223 자동 토큰 전수 대조 (2026-09-13)

현재 custom 레지스트리의 TB 22개 + SnV 25개 = 47개를 기존 마도서의 자동 생성 경로와 대조했다. BMR 캐릭터는 현재 custom 레지스트리에 포함되지 않는다. 수동 토큰 등록과 자동 생성을 구별했다.

| 스크립트 | 캐릭터 ID | 자동 토큰 / 대조 결과 |
|---|---|---|
| TB | washerwoman | townsfolk / wrong — 준비 대상 |
| TB | librarian | outsider / wrong — 준비 대상 |
| TB | investigator | minion / wrong — 준비 대상 |
| TB | chef | 기존 자동 생성 없음 |
| TB | empath | 기존 자동 생성 없음 |
| TB | fortuneTeller | redHerring — 오인 대상 |
| TB | undertaker | diedToday — 처형 사망, 능력 출처 필요 |
| TB | monk | safe — 후속 밤 보호 행동 미구현 |
| TB | ravenkeeper | 기존 자동 생성 없음 |
| TB | virgin | noAbility — 사용 |
| TB | slayer | noAbility — 사용 |
| TB | soldier | 기존 자동 생성 없음 |
| TB | mayor | 기존 자동 생성 없음 |
| TB | butler | master — 주인 선택 |
| TB | drunk | isTheDrunk — 정체 |
| TB | recluse | 기존 자동 생성 없음 |
| TB | saint | 기존 자동 생성 없음 |
| TB | poisoner | poisoned — 중독 |
| TB | spy | 기존 자동 생성 없음; 다른 능력의 토큰을 열람 |
| TB | scarletWoman | isTheDemon — **승계 표시 누락 수정** |
| TB | baron | 기존 자동 생성 없음 |
| TB | imp | dead — 후속 밤 공격/미발표 사망 미구현 |
| SnV | clockmaker | 기존 자동 생성 없음 |
| SnV | dreamer | 기존 자동 생성 없음 |
| SnV | snakeCharmer | poisoned — 교환 이후 지속 중독 |
| SnV | mathematician | abnormal — **첫날 밤 증거 표시 누락 수정**; 새벽 이후 낮 기록 |
| SnV | flowergirl | demonVoted / demonDidNotVote — **누락 수정** |
| SnV | townCrier | minionNominated / minionDidNotNominate — **누락 수정** |
| SnV | oracle | 기존 자동 생성 없음 |
| SnV | savant | 기존 자동 생성 없음 |
| SnV | seamstress | noAbility — 사용 |
| SnV | philosopher | drunk / noAbility / isThePhilosopher — **원본 없는 능력 획득 표시 누락 수정** |
| SnV | artist | noAbility — 질문 사용 |
| SnV | juggler | correct — 첫 낮 정답 수 |
| SnV | sage | 기존 자동 생성 없음 |
| SnV | mutant | 기존 자동 생성 없음 |
| SnV | sweetheart | drunk — 사망 결과 |
| SnV | barber | haircutsTonight — 미처리 사망 결과 |
| SnV | klutz | 기존 자동 생성 없음 |
| SnV | evilTwin | twin — 쌍둥이 관계 |
| SnV | witch | cursed — 저주 |
| SnV | cerenovus | mad — 광기 |
| SnV | pitHag | 기존 자동 생성 없음 |
| SnV | fangGu | once — 후속 밤 외지인 이동 미구현 |
| SnV | vigormortis | poisoned 처리 경로 있음; hasAbility는 후속 밤 살해/능력 유지 구현 필요 |
| SnV | noDashii | poisoned — 이웃 중독 |
| SnV | vortox | 기존 자동 생성 없음; 정보 전달 제약으로 처리 |

26개 캐릭터에 출처별 핸들러가 있다. 18개는 기존 자동 생성 없음, 3개는 후속 밤 전용이다. 비고르모르티스의 능력 유지 토큰도 후속 밤 작업에 속한다. 이 미구현 항목들은 완료로 간주하지 않는다.

## 생성·표시 계약 수정

- 포고꾼·꽃팔이 토큰은 보르톡스의 거짓 정보 전달과 별개로 실제 행동 기록을 표시한다. 현재 정체가 아닌 행동 당시 스냅샷을 사용한다. 꽃팔이는 유효 표수와 별개로 실제 투표 참여자를 본다.
- 붉은 여인의 승계 함수가 원래 능력 출처와 승계 이벤트를 재생 사실로 기록하고 해당 캐릭터 핸들러가 표시를 만든다. 저장 파일 형식은 변경하지 않았다.
- 보드 상태, 스파이 정보 스냅샷, 스파이 공개 화면의 허용 토큰 쌍을 공통 계약으로 통합했다. sweetheart:drunk, artist:noAbility, juggler:correct, barber:haircutsTonight, mathematician:abnormal, vigormortis:poisoned 등 검증 누락을 수정했다.
- 이번 전수 대조는 자동 생성 대상·근거·표시 검증의 누락에 대한 조사다. 기존 효과의 모든 유효/무효 표시 방식을 재설계한 작업은 아니다.

## 검증

카탈로그 전수 정책 검사, 보르톡스 아래 실제 지목·투표 및 Undo, 붉은 여인 승계 및 Undo, 철학자 획득 유무, 첫날 밤 수학자 증거, 스파이 공개 토큰 검증을 추가했다. 새 캐릭터가 카탈로그에 추가되면 토큰 정책 검토 없이 검사를 통과할 수 없다.
