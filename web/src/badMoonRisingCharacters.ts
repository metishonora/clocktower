export type BadMoonRisingCharacterKind = "townsfolk" | "outsider" | "minion" | "demon";

export type BadMoonRisingCharacter = {
  id: string;
  kind: BadMoonRisingCharacterKind;
  name: string;
  ability: string;
};

export const badMoonRisingCharacters: BadMoonRisingCharacter[] = [
  { id: "grandmother", kind: "townsfolk", name: "할머니", ability: "게임 시작 시, 선한 플레이어 1명과 그의 캐릭터를 알게 됩니다. 악마가 그 플레이어를 죽이면 당신도 사망합니다." },
  { id: "sailor", kind: "townsfolk", name: "선원", ability: "매일 밤, 생존한 플레이어 1명을 선택합니다: 당신과 그중 1명은 황혼까지 취합니다. 당신은 사망할 수 없습니다." },
  { id: "chambermaid", kind: "townsfolk", name: "객실 청소부", ability: "매일 밤, (당신을 제외하고) 생존한 플레이어 2명을 선택합니다: 그중 몇 명이 오늘 밤 자기 능력으로 인해 자신이 깨어났는지 알게 됩니다." },
  { id: "exorcist", kind: "townsfolk", name: "구마사제", ability: "매일 밤*, (지난밤에 선택하지 않은) 플레이어 1명을 선택합니다: 악마를 선택한다면 그 악마는 당신의 정체를 알게 되지만 오늘 밤 깨지 않습니다." },
  { id: "innkeeper", kind: "townsfolk", name: "여관 주인", ability: "매일 밤*, 플레이어 2명을 선택합니다: 이들은 오늘 밤 사망할 수 없으나, 그중 1명은 황혼까지 취합니다." },
  { id: "gambler", kind: "townsfolk", name: "도박사", ability: "매일 밤*, 플레이어 1명을 선택하고 그의 캐릭터를 추측합니다: 추측이 틀리면, 당신은 사망합니다." },
  { id: "gossip", kind: "townsfolk", name: "험담꾼", ability: "매일 낮, 당신은 공개 발언을 할 수 있습니다. 오늘 밤, 그 발언이 사실이었다면 플레이어 1명이 사망합니다." },
  { id: "courtier", kind: "townsfolk", name: "궁정대신", ability: "게임당 1번, 밤에 캐릭터 1명을 선택합니다: 그 플레이어는 3일 밤낮 동안 취합니다." },
  { id: "professor", kind: "townsfolk", name: "교수", ability: "게임당 1번, 밤*에, 사망한 플레이어 1명을 선택합니다: 그 플레이어가 주민이라면, 그 플레이어는 부활합니다." },
  { id: "minstrel", kind: "townsfolk", name: "음유시인", ability: "하수인 1명이 처형으로 사망하면, (여행자를 제외하고) 다른 모든 플레이어는 다음 날 황혼까지 취합니다." },
  { id: "teaLady", kind: "townsfolk", name: "찻집 여인", ability: "이웃 생존자 2명이 모두 선한 플레이어라면, 이들은 사망할 수 없습니다." },
  { id: "pacifist", kind: "townsfolk", name: "평화주의자", ability: "선한 플레이어가 처형당하면, 그는 사망하지 않을 수도 있습니다." },
  { id: "fool", kind: "townsfolk", name: "어릿광대", ability: "당신이 처음으로 사망할 때, 사망하지 않습니다." },
  { id: "tinker", kind: "outsider", name: "땜장이", ability: "당신은 언제든지 돌연 사망할 수도 있습니다." },
  { id: "moonchild", kind: "outsider", name: "달의 자손", ability: "당신이 사망했음을 알게 될 때, 생존한 플레이어 1명을 공개적으로 선택합니다. 그가 선한 플레이어라면, 오늘 밤 그는 사망합니다." },
  { id: "goon", kind: "outsider", name: "건달", ability: "매일 밤, 자기 능력으로 당신을 선택하는 첫 플레이어는 황혼까지 취합니다. 당신은 그 플레이어가 소속된 팀이 됩니다." },
  { id: "lunatic", kind: "outsider", name: "미치광이", ability: "당신은 악마가 아니지만, 악마라고 착각합니다. 악마는 당신이 누구인지 알고, 밤에 당신이 누구를 선택하는지 알게 됩니다." },
  { id: "godfather", kind: "minion", name: "대부", ability: "게임 시작 시, 어느 외지인이 게임에 참여하는지 알게 됩니다. 낮에 외지인 1명이 사망하면, 그날 밤 플레이어 1명을 선택합니다: 그는 사망합니다. [외지인 -1명 또는 +1명]" },
  { id: "devilsAdvocate", kind: "minion", name: "악마의 변호사", ability: "매일 밤, (지난밤에 선택하지 않은) 생존한 플레이어 1명을 선택합니다: 그 플레이어가 내일 처형당하면, 그는 사망하지 않습니다." },
  { id: "assassin", kind: "minion", name: "암살자", ability: "게임당 1번, 밤*에, 플레이어 1명을 선택합니다: 그 플레이어는 이유불문 사망합니다." },
  { id: "mastermind", kind: "minion", name: "주모자", ability: "악마가 처형으로 사망하면(게임 종료 조건), 하루 더 게임을 진행합니다. 그런 다음, 플레이어 1명이 처형당하면, 그 플레이어가 소속된 팀이 패배합니다." },
  { id: "zombuul", kind: "demon", name: "좀버얼", ability: "매일 밤*, 오늘 낮에 누구도 사망하지 않았다면, 플레이어 1명을 선택합니다: 그는 사망합니다. 당신이 처음으로 사망할 때, 실제로는 생존해 있지만 사망한 상태로 위장합니다." },
  { id: "pukka", kind: "demon", name: "푸카", ability: "매일 밤, 플레이어 1명을 선택합니다: 그는 중독됩니다. 이전에 당신이 중독시켰던 플레이어는 사망하고, 건강한 상태가 됩니다." },
  { id: "shabaloth", kind: "demon", name: "샤발로스", ability: "매일 밤*, 플레이어 2명을 선택합니다: 그들은 사망합니다. 지난밤에 당신이 선택했던 사망한 플레이어를 다시 토해낼 수도 있습니다(살아납니다)." },
  { id: "po", kind: "demon", name: "포", ability: "매일 밤*, 플레이어 1명을 선택할 수 있습니다: 그는 사망합니다. 이전에 누구도 선택하지 않았다면, 오늘 밤에는 사망할 플레이어 3명을 선택합니다." },
];
