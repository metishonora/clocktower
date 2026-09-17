# 실제 확인 사례

각 행은 해당 분기의 기대와 실제 검증 사건을 연결한다. 관찰 상세는 manifest의 같은 사례 ID에서 확인한다.

| 사례 | 캐릭터·공통 항목 | 기대 결과 | 수행 | 시작 파일 | 자동 | 사용자 | 실기기 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G01-C01 | shared-setup | 15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다. | [G01 절차 0](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C02 | character-baron | 15인 남작 배정은 마을주민 7·외지인 4·하수인 3·악마 1이다. | [G01 절차 0](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C03 | character-washerwoman | 1번과 7번 중 7번을 근거로 mathematician 정보를 공개한다. | [G01 절차 5](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C04 | character-librarian | 1번과 10번 중 10번을 근거로 butler 정보를 공개한다. | [G01 절차 7](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C05 | character-investigator | 1번과 12번 중 12번을 근거로 poisoner 정보를 공개한다. | [G01 절차 9](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C06 | character-chef | 악한 이웃 쌍은 12–13, 13–14, 14–15의 3쌍이다. | [G01 절차 10](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C07 | character-empath | 5번의 살아 있는 양옆 4번·6번은 모두 선하므로 0이다. | [G01 절차 11](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C08 | character-fortuneTeller | 6번·7번은 악마가 없지만 7번 빨간 청어 때문에 예를 전달한다. | [G01 절차 13](G01.md) | [G01-start](G01-start.game.json) | 통과 | 미확인 | 미확인 |
| G01-C09 | character-drunk | 8번은 실제 주정뱅이·Shown 시계공이며 0 전달이 실제 시계공 능력을 부여하지 않는다. | [G01 절차 15](G01.md) | [G01-drunk-information](G01-drunk-information.game.json) | 통과 | 미확인 | 미확인 |
| G01-C10 | character-spy | 첩자가 현재 실제 배역과 상태를 포함한 마도서를 공개한다. | [G01 절차 16](G01.md) | [G01-drunk-information](G01-drunk-information.game.json) | 통과 | 미확인 | 미확인 |
| G01-C11 | character-mathematician, shared-jinx-drunk-math | 주정뱅이의 실제 거리 1과 다른 0 전달은 수학자 1명에 포함한다. | [G01 절차 17](G01.md) | [G01-drunk-information](G01-drunk-information.game.json) | 통과 | 미확인 | 미확인 |
| G01-C12 | shared-jinx-drunk-math | 주정뱅이가 실제 거리와 같은 1을 전달하면 수학자 수는 0이다. | [G01 절차 23](G01.md) | [G01-drunk-information](G01-drunk-information.game.json) | 통과 | 미확인 | 미확인 |
| G01-C13 | character-butler | 주인 7번 없이 집사 10번이 낸 표는 제외해 7표로 센다. | [G01 절차 29](G01.md) | [G01-day-one](G01-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G01-C14 | character-butler, shared-day-votes | 주인 7번과 집사 10번이 함께 낸 8표를 모두 센다. | [G01 절차 31](G01.md) | [G01-day-one](G01-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G01-C15 | character-poisoner, character-empath | 5번이 중독되어 실제 이웃 수 0과 다른 2를 전달할 수 있다. | [G01 절차 38](G01.md) | [G01-night-two](G01-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G01-C16 | character-recluse | 9번 은둔자를 악마로 등록한 판단에서만 같은 두 후보에 예를 전달한다. | [G01 절차 41](G01.md) | [G01-night-two](G01-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G01-C17 | character-mathematician | 중독된 초공감자의 거짓 정보와 은둔자 등록으로 달라진 점쟁이 정보는 서로 다른 2명의 오작동이다. | [G01 절차 43](G01.md) | [G01-night-two](G01-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G01-C18 | shared-frozen-reveal | 첩자 사망과 중독 대상 변경 후에도 첫날 밤 첩자의 확정 공개는 바뀌지 않는다. | [G01 절차 43](G01.md) | [G01-night-two](G01-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G01-C19 | shared-day-votes | 죽은 13번 첩자가 찬성표를 내면 유령표가 소진된다. | [G01 절차 49](G01.md) | [G01-saint-ending](G01-saint-ending.game.json) | 통과 | 미확인 | 미확인 |
| G01-C20 | character-saint | 중독되지 않은 11번 성자의 처형은 악의 승리를 요구한다. | [G01 절차 52](G01.md) | [G01-saint-ending](G01-saint-ending.game.json) | 통과 | 미확인 | 미확인 |
| G01-C21 | shared-end-game | 악 승리가 확정되고 이후 밤 진행을 거부한다. | [G01 절차 53](G01.md) | [G01-saint-ending](G01-saint-ending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C01 | shared-setup | 15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다. | [G02 절차 0](G02.md) | [G02-start](G02-start.game.json) | 통과 | 미확인 | 미확인 |
| G02-C02 | character-clockmaker | 15번 악마와 14번 하수인의 가장 가까운 거리는 1이다. | [G02 절차 5](G02.md) | [G02-start](G02-start.game.json) | 통과 | 미확인 | 미확인 |
| G02-C03 | character-cerenovus | 집착 위반 처형은 7번의 사망과 낮 처형 기록을 남긴다. | [G02 절차 9](G02.md) | [G02-virgin-day](G02-virgin-day.game.json) | 통과 | 미확인 | 미확인 |
| G02-C04 | character-cerenovus | 7번의 수도사 광기 지정과 비위반 판단이 기록되고 생존한다. | [G02 절차 11](G02.md) | [G02-virgin-day](G02-virgin-day.game.json) | 통과 | 미확인 | 미확인 |
| G02-C05 | character-virgin | 마을주민인 지명자 9번이 즉시 처형되어 투표 없이 밤 준비로 간다. | [G02 절차 16](G02.md) | [G02-virgin-day](G02-virgin-day.game.json) | 통과 | 미확인 | 미확인 |
| G02-C06 | character-soldier | 정상 군인 6번을 공격해도 죽지 않는다. | [G02 절차 21](G02.md) | [G02-attack-branches](G02-attack-branches.game.json) | 통과 | 미확인 | 미확인 |
| G02-C07 | character-mayor | 시장 공격을 보호된 1번으로 돌려도 둘 다 죽지 않는다. | [G02 절차 23](G02.md) | [G02-attack-branches](G02-attack-branches.game.json) | 통과 | 미확인 | 미확인 |
| G02-C08 | character-monk | 수도사가 보호한 1번은 악마 공격을 받아도 생존한다. | [G02 절차 25](G02.md) | [G02-attack-branches](G02-attack-branches.game.json) | 통과 | 미확인 | 미확인 |
| G02-C09 | character-imp, character-scarletWoman | 임프 자살 시 조건을 만족하는 12번 탕녀가 우선 승계한다. | [G02 절차 27](G02.md) | [G02-attack-branches](G02-attack-branches.game.json) | 통과 | 미확인 | 미확인 |
| G02-C10 | shared-pending-restore | 까마귀지기 사망 직후 새 저장소·파일 복원에도 대상 선택이 남는다. | [G02 절차 29](G02.md) | [G02-ravenkeeper-pending](G02-ravenkeeper-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C11 | character-ravenkeeper | 죽은 까마귀지기가 4번의 성결자 정보를 공개한다. | [G02 절차 30](G02.md) | [G02-ravenkeeper-pending](G02-ravenkeeper-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C12 | shared-causal-undo | 공격과 까마귀지기 후속을 함께 되돌리면 3번이 살아나고 임프 공격으로 돌아온다. | [G02 절차 31](G02.md) | [G02-ravenkeeper-pending](G02-ravenkeeper-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C13 | character-undertaker | 첫날 낮 성결자에 의해 처형된 9번은 시계공으로 공개된다. | [G02 절차 34](G02.md) | [G02-ravenkeeper-pending](G02-ravenkeeper-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C14 | character-slayer, character-scarletWoman | 처단자가 15번 악마를 죽이고 12번 탕녀가 임프로 승계한다. 처단자 재사용은 없다. | [G02 절차 37](G02.md) | [G02-slayer-succession](G02-slayer-succession.game.json) | 통과 | 미확인 | 미확인 |
| G02-C15 | character-witch | 저주받은 지명자가 죽어도 같은 지명의 투표로 이어진다. | [G02 절차 42](G02.md) | [G02-slayer-succession](G02-slayer-succession.game.json) | 통과 | 미확인 | 미확인 |
| G02-C16 | character-sweetheart | 죽은 10번 사랑꾼의 능력 출처로 7번의 취함을 유지한다. | [G02 절차 47](G02.md) | [G02-slayer-succession](G02-slayer-succession.game.json) | 통과 | 미확인 | 미확인 |
| G02-C17 | shared-three-nights | 같은 게임의 셋째 밤으로 진행했고 현재 행동은 수도사다. | [G02 절차 48](G02.md) | [G02-night-three](G02-night-three.game.json) | 통과 | 미확인 | 미확인 |
| G02-C18 | character-barber | 이발사 순서가 지난 뒤 사망해도 즉시 교환하며 4번 군인·6번 성결자로 바뀐다. | [G02 절차 53](G02.md) | [G02-barber-pending](G02-barber-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C19 | shared-frozen-reveal | 4번이 군인으로 바뀌어도 까마귀지기가 과거 공개한 성결자 정보는 유지한다. | [G02 절차 53](G02.md) | [G02-barber-pending](G02-barber-pending.game.json) | 통과 | 미확인 | 미확인 |
| G02-C20 | shared-end-game | 선 승리가 확정되고 이후 밤 진행을 거부한다. | [G02 절차 64](G02.md) | [G02-good-ending](G02-good-ending.game.json) | 통과 | 미확인 | 미확인 |
| G03-C01 | shared-setup | 15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다. | [G03 절차 0](G03.md) | [G03-start](G03-start.game.json) | 통과 | 미확인 | 미확인 |
| G03-C02 | character-dreamer, character-vortox | 실제 사악한 쌍둥이인 12번에게 요리사·독살범이라는 거짓 쌍을 전달한다. | [G03 절차 7](G03.md) | [G03-start](G03-start.game.json) | 통과 | 미확인 | 미확인 |
| G03-C03 | character-seamstress | 서로 다른 진영인 1번·12번에게 같은 진영이라는 거짓 정보를 주고 사용을 소진한다. | [G03 절차 8](G03.md) | [G03-start](G03-start.game.json) | 통과 | 미확인 | 미확인 |
| G03-C04 | character-mutant | 변종의 광기 처형은 낮을 마치며 보르톡스 무처형 패배를 만들지 않는다. | [G03 절차 13](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C05 | character-evilTwin | 살아 있는 사악한 쌍둥이의 좋은 쌍 6번이 처형되면 악의 승리다. | [G03 절차 22](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C06 | shared-end-game | 악 승리가 확정되고 이후 밤 진행을 거부한다. | [G03 절차 23](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C07 | character-artist | 화가는 실제 참인 질문에 아니오를 전달하고 사용을 소진한다. | [G03 절차 25](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C08 | character-savant | 보르톡스 아래에서 백치천재의 두 거짓 진술이 낮 기록에 남는다. | [G03 절차 26](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C09 | character-flowergirl, character-townCrier, character-oracle, character-juggler | 전날 악마 투표·하수인 지명은 모두 예, 죽은 악인은 1, 곡예 정답은 2지만 각각 아니오·아니오·0·0을 전달한다. | [G03 절차 43](G03.md) | [G03-night-two](G03-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G03-C10 | character-evilTwin, character-vortox | 악마가 처형되어도 6번·12번 쌍둥이가 모두 살아 있어 선의 승리를 보류한다. | [G03 절차 53](G03.md) | [G03-demon-with-twins](G03-demon-with-twins.game.json) | 통과 | 미확인 | 미확인 |
| G03-C11 | character-dreamer, character-flowergirl, character-townCrier, character-oracle | 보르톡스 사망 후 꿈꾸는 자에 실제 쌍둥이가 포함되고, 지난 낮 투표·지명은 예·예, 죽은 악인은 2이다. | [G03 절차 59](G03.md) | [G03-demon-with-twins](G03-demon-with-twins.game.json) | 통과 | 미확인 | 미확인 |
| G03-C12 | character-savant | 보르톡스 사망 후 백치천재는 참 한 개·거짓 한 개를 기록한다. | [G03 절차 62](G03.md) | [G03-day-three](G03-day-three.game.json) | 통과 | 미확인 | 미확인 |
| G03-C13 | character-klutz | 정상 얼뜨기가 악한 대상을 선택하면 악의 승리 확인이 필요하다. | [G03 절차 71](G03.md) | [G03-day-three](G03-day-three.game.json) | 통과 | 미확인 | 미확인 |
| G03-C14 | character-klutz | 선한 대상 선택은 패배 없이 다음 밤을 허용한다. | [G03 절차 82](G03.md) | [G03-day-three](G03-day-three.game.json) | 통과 | 미확인 | 미확인 |
| G03-C15 | shared-end-game | 선 승리가 확정되고 이후 밤 진행을 거부한다. | [G03 절차 92](G03.md) | [G03-day-three](G03-day-three.game.json) | 통과 | 미확인 | 미확인 |
| G03-C16 | character-vortox | 첫날 처형을 하지 않으면 보르톡스의 악 승리 조건이 생긴다. | [G03 절차 98](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G03-C17 | shared-end-game | 악 승리가 확정되고 이후 밤 진행을 거부한다. | [G03 절차 99](G03.md) | [G03-day-one](G03-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G04-C01 | shared-setup | 15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다. | [G04 절차 0](G04.md) | [G04-start](G04-start.game.json) | 통과 | 미확인 | 미확인 |
| G04-C02 | character-philosopher | 4번은 철학자 정체를 유지하면서 실제 재봉사 능력을 획득한다. | [G04 절차 3](G04.md) | [G04-start](G04-start.game.json) | 통과 | 미확인 | 미확인 |
| G04-C03 | character-seamstress, character-philosopher | 철학자가 획득한 재봉사로 선한 6번·악한 12번의 다른 진영을 정확히 공개한다. | [G04 절차 10](G04.md) | [G04-start](G04-start.game.json) | 통과 | 미확인 | 미확인 |
| G04-C04 | character-pitHag, character-librarian | 4번은 선한 사서로 바뀌고 이후 밤 순서 밖의 시작 정보를 즉시 전달한다. | [G04 절차 24](G04.md) | [G04-night-two](G04-night-two.game.json) | 통과 | 미확인 | 미확인 |
| G04-C05 | character-scarletWoman, shared-jinx-scarlet-fang | 외지인 이동이 아닌 팡 구 자신의 일반 사망에서는 12번 탕녀가 팡 구로 승계한다. | [G04 절차 25](G04.md) | [G04-sage-or-jump](G04-sage-or-jump.game.json) | 통과 | 미확인 | 미확인 |
| G04-C06 | character-sage, character-recluse, shared-jinx-recluse-sage | 실제 살해자 15번 없이도 은둔자 9번을 악마로 판단한 근거를 저장해 9번·12번을 공개한다. | [G04 절차 28](G04.md) | [G04-sage-pending](G04-sage-pending.game.json) | 통과 | 미확인 | 미확인 |
| G04-C07 | character-fangGu, shared-jinx-scarlet-fang | 첫 외지인 공격은 9번을 악한 팡 구로 바꾸고 15번을 죽이며 12번 탕녀는 그대로 둔다. | [G04 절차 30](G04.md) | [G04-sage-pending](G04-sage-pending.game.json) | 통과 | 미확인 | 미확인 |
| G04-C08 | character-snakeCharmer | 3번은 악한 팡 구, 이전 악마 9번은 선한 뱀 조련사가 되고 중독된다. | [G04 절차 45](G04.md) | [G04-snake-swap](G04-snake-swap.game.json) | 통과 | 미확인 | 미확인 |
| G04-C09 | character-fangGu, character-sweetheart | 뱀 조련사 교환 뒤 새 팡 구도 아직 남은 밤 순서에서 행동한다. 이동은 이미 소진되어 10번 사랑꾼이 죽고 팡 구는 3번에 남는다. | [G04 절차 50](G04.md) | [G04-snake-swap](G04-snake-swap.game.json) | 통과 | 미확인 | 미확인 |
| G04-C10 | character-snakeCharmer | 중독된 9번이 악마 3번을 선택해도 두 정체·진영은 바뀌지 않는다. | [G04 절차 61](G04.md) | [G04-spent-jump](G04-spent-jump.game.json) | 통과 | 미확인 | 미확인 |
| G04-C11 | shared-end-game | 선 승리가 확정되고 이후 밤 진행을 거부한다. | [G04 절차 77](G04.md) | [G04-spent-jump](G04-spent-jump.game.json) | 통과 | 미확인 | 미확인 |
| G05-C01 | shared-setup | 15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다. | [G05 절차 0](G05.md) | [G05-start](G05-start.game.json) | 통과 | 미확인 | 미확인 |
| G05-C02 | character-vigormortis | 비고르모르티스의 Setup 보정으로 15인 외지인은 1명, 마을주민은 10명이다. | [G05 절차 0](G05.md) | [G05-start](G05-start.game.json) | 통과 | 미확인 | 미확인 |
| G05-C03 | character-artist, character-philosopher | 철학자가 획득한 화가로 참인 예를 전달하고 획득 출처의 1회 사용을 소진한다. | [G05 절차 13](G05.md) | [G05-day-one](G05-day-one.game.json) | 통과 | 미확인 | 미확인 |
| G05-C04 | character-vigormortis, shared-pending-restore | 12번 독살범을 살해한 후 미완료 중독 선택을 복원해 이웃 마을주민 10번을 중독시킨다. | [G05 절차 27](G05.md) | [G05-vigor-poison-pending](G05-vigor-poison-pending.game.json) | 통과 | 미확인 | 미확인 |
| G05-C05 | character-juggler | 전날 기록한 정답 2개가 정상 곡예사 정보 2로 전달된다. | [G05 절차 32](G05.md) | [G05-vigor-poison-pending](G05-vigor-poison-pending.game.json) | 통과 | 미확인 | 미확인 |
| G05-C06 | character-vigormortis, character-poisoner | 죽은 12번 독살범이 기존 능력 instance로 다음 밤에도 5번을 중독시킨다. | [G05 절차 41](G05.md) | [G05-retained-minion](G05-retained-minion.game.json) | 통과 | 미확인 | 미확인 |
| G05-C07 | character-pitHag, character-noDashii | 노 다시 변경 후 공격 대상을 먼저 고른다. 외지인·하수인을 건너뛴 1번과 10번만 노 다시 중독이다. | [G05 절차 45](G05.md) | [G05-new-demon](G05-new-demon.game.json) | 통과 | 미확인 | 미확인 |
| G05-C08 | character-pitHag | 예측불허의 죽음에서 앞선 15번→8번 공격을 확인하고 사망 없음을 확정한다. 8번은 생존하며 이 사망 판단은 별도로 되돌릴 수 있다. | [G05 절차 47](G05.md) | [G05-arbitrary-deaths-pending](G05-arbitrary-deaths-pending.game.json) | 통과 | 미확인 | 미확인 |
| G05-C09 | character-sage, shared-jinx-recluse-sage | 은둔자가 후보 풀에만 있으면 현자는 실제 살해자 15번이 포함된 정보를 받는다. | [G05 절차 64](G05.md) | [G05-pool-only-sage](G05-pool-only-sage.game.json) | 통과 | 미확인 | 미확인 |
| G05-C10 | character-noDashii | 노 다시가 죽으면 그 출처의 이웃 중독은 사라진다. | [G05 절차 77](G05.md) | [G05-pool-only-sage](G05-pool-only-sage.game.json) | 통과 | 미확인 | 미확인 |
| G05-C11 | shared-end-game | 선 승리가 확정되고 이후 밤 진행을 거부한다. | [G05 절차 78](G05.md) | [G05-pool-only-sage](G05-pool-only-sage.game.json) | 통과 | 미확인 | 미확인 |
