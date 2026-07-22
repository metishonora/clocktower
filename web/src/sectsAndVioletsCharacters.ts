export type SectsAndVioletsCharacterKind = "townsfolk" | "outsider" | "minion" | "demon";

export type SectsAndVioletsCharacter = {
  id: string;
  kind: SectsAndVioletsCharacterKind;
  name: string;
  ability: string;
};

export const sectsAndVioletsCharacters: SectsAndVioletsCharacter[] = [
  { id: "clockmaker", kind: "townsfolk", name: "시계공", ability: "게임 시작 시, 악마와 가장 가까운 하수인 사이의 거리를 알게 됩니다." },
  { id: "dreamer", kind: "townsfolk", name: "꿈꾸는 자", ability: "매일 밤, (당신과 여행자를 제외하고) 플레이어 1명을 선택합니다: 선한 캐릭터 하나와 악한 캐릭터 하나를 알게 됩니다. 둘 중 하나가 그의 정체입니다." },
  { id: "snakeCharmer", kind: "townsfolk", name: "뱀 조련사", ability: "매일 밤, 생존한 플레이어 1명을 선택합니다: 악마를 선택한다면, 악마는 당신과 소속 및 캐릭터를 맞바꾼 다음 중독됩니다." },
  { id: "mathematician", kind: "townsfolk", name: "수학자", ability: "매일 밤, (새벽부터 지금까지) 다른 플레이어의 능력으로 인해 비정상적으로 작동한 플레이어 능력이 몇 개나 되는지를 알게 됩니다." },
  { id: "flowergirl", kind: "townsfolk", name: "꽃팔이 소녀", ability: "매일 밤*, 오늘 낮에 악마가 투표했는지를 알게 됩니다." },
  { id: "townCrier", kind: "townsfolk", name: "포고꾼", ability: "매일 밤*, 오늘 낮에 하수인이 지목에 나섰는지를 알게 됩니다." },
  { id: "oracle", kind: "townsfolk", name: "예언자", ability: "매일 밤*, 사망한 플레이어 가운데 몇 명이나 악한 팀인지를 알게 됩니다." },
  { id: "savant", kind: "townsfolk", name: "백치천재", ability: "매일 낮, 개인적으로 이야기꾼에게 방문해 두 가지 정보를 알게 됩니다: 그중 하나는 진실이고 다른 하나는 거짓입니다." },
  { id: "seamstress", kind: "townsfolk", name: "재봉사", ability: "게임당 1번, 밤에, (당신을 제외하고) 플레이어 2명을 선택합니다: 그들이 같은 소속인지 아닌지를 알게 됩니다." },
  { id: "philosopher", kind: "townsfolk", name: "철학자", ability: "게임당 1번, 밤에, 선한 캐릭터 1명을 선택합니다: 그의 능력을 얻습니다. 그 캐릭터가 이미 게임에 참여하고 있다면, 그는 취합니다." },
  { id: "artist", kind: "townsfolk", name: "화가", ability: "게임당 1번, 낮에, 개인적으로 이야기꾼에게 예/아니오로 답할 수 있는 질문을 합니다." },
  { id: "juggler", kind: "townsfolk", name: "곡예사", ability: "첫 번째 낮에, 공개적으로 플레이어들의 캐릭터를 최대 5번까지 추측할 수 있습니다. 그날 밤, 그중 몇 개나 맞혔는지를 알게 됩니다." },
  { id: "sage", kind: "townsfolk", name: "현자", ability: "악마가 당신을 죽이면, 플레이어 2명을 알게 됩니다. 그중 1명이 악마입니다." },
  { id: "mutant", kind: "outsider", name: "변종", ability: "당신이 \"외지인\"이라는 사실에 집착한다면, 당신은 처형당할 수도 있습니다." },
  { id: "sweetheart", kind: "outsider", name: "사랑꾼", ability: "당신이 사망할 때, 지금부터 플레이어 1명은 취함 상태가 됩니다." },
  { id: "barber", kind: "outsider", name: "이발사", ability: "오늘 낮 또는 오늘 밤에 사망했다면, 악마는 플레이어 2명(다른 악마는 제외)을 선택하여 그 두 명의 캐릭터를 맞바꿀 수 있습니다." },
  { id: "klutz", kind: "outsider", name: "얼뜨기", ability: "당신이 사망했다는 사실을 알게 될 때, 생존한 플레이어 1명을 공개적으로 선택합니다: 그가 악한 플레이어라면, 당신이 속한 팀이 패배합니다." },
  { id: "evilTwin", kind: "minion", name: "사악한 쌍둥이", ability: "당신과 선한 쌍둥이는 서로를 알아봅니다. 선한 쌍둥이가 처형당하면, 악한 팀이 승리합니다. 쌍둥이가 둘 다 살아있는 한, 선한 팀은 승리할 수 없습니다." },
  { id: "witch", kind: "minion", name: "마녀", ability: "매일 밤, 플레이어 1명을 선택합니다: 그가 다음 날 누군가를 지목한다면, 그는 사망합니다. 플레이어가 3명만 남았다면, 이 능력을 잃습니다." },
  { id: "cerenovus", kind: "minion", name: "세레노버스", ability: "매일 밤, 플레이어 1명과 선한 캐릭터 하나를 선택합니다: 선택된 플레이어는 다음 날 자신이 해당 캐릭터라고 집착해야 합니다. 그렇지 않으면, 처형당할 수도 있습니다." },
  { id: "pitHag", kind: "minion", name: "마귀할멈", ability: "매일 밤*, 플레이어 1명과 캐릭터 하나를 선택하고, (그 캐릭터가 게임에 참여하지 않았을 경우) 그를 선택한 캐릭터로 바꿉니다. 이 능력으로 악마를 만든다면, 오늘 밤 예측불허의 죽음이 찾아옵니다." },
  { id: "fangGu", kind: "demon", name: "팡 구", ability: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 이 능력으로 사망한 첫 외지인만이 악한 팡 구가 되고 당신이 대신 사망합니다. [외지인 +1명]" },
  { id: "vigormortis", kind: "demon", name: "비고르모르티스", ability: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 당신이 죽인 하수인은 능력을 유지하며, 그와 가까운 양쪽 이웃 주민 중 1명이 중독됩니다. [외지인 -1명]" },
  { id: "noDashii", kind: "demon", name: "노 다시", ability: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 당신의 이웃 주민 2명은 중독됩니다." },
  { id: "vortox", kind: "demon", name: "보르톡스", ability: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 주민의 능력은 거짓 정보만 제공합니다. 매일 낮, 누구도 처형되지 않으면 악한 팀이 승리합니다." },
];

export const sectsAndVioletsWikiSlugs: Record<string, string> = {
  clockmaker: "Clockmaker", dreamer: "Dreamer", snakeCharmer: "Snake_Charmer", mathematician: "Mathematician",
  flowergirl: "Flowergirl", townCrier: "Town_Crier", oracle: "Oracle", savant: "Savant", seamstress: "Seamstress",
  philosopher: "Philosopher", artist: "Artist", juggler: "Juggler", sage: "Sage", mutant: "Mutant",
  sweetheart: "Sweetheart", barber: "Barber", klutz: "Klutz", evilTwin: "Evil_Twin", witch: "Witch",
  cerenovus: "Cerenovus", pitHag: "Pit-Hag", fangGu: "Fang_Gu", vigormortis: "Vigormortis",
  noDashii: "No_Dashii", vortox: "Vortox",
};
