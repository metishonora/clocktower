import { characterRulesFor } from "./characterRules.js";
import { characters, type Character, type CharacterKind } from "./setupDraft.js";

export const TROUBLE_BREWING_COLLECTION_SOURCE_URL =
  "https://bloodontheclocktower.com/collections/trouble-brewing-reminder-tokens";
export const TROUBLE_BREWING_SOURCE_CHECKED_AT = "2026-08-09" as const;

export type TroubleBrewingReminderAutomation = "canonical" | "manual";

export type TroubleBrewingReminder = Readonly<{
  characterId: string;
  tokenId: string;
  label: string;
  count: 1;
  description: string;
  automation: TroubleBrewingReminderAutomation;
  canonicalState: string;
  manualAttachable: true;
}>;

export type TroubleBrewingCharacterSource = Readonly<{
  url: string;
  collectionUrl: typeof TROUBLE_BREWING_COLLECTION_SOURCE_URL;
  checkedAt: typeof TROUBLE_BREWING_SOURCE_CHECKED_AT;
}>;

export type TroubleBrewingCharacterMatrixEntry = Readonly<{
  id: string;
  label: string;
  kind: CharacterKind;
  ability: string;
  input: string;
  result: string;
  duration: string;
  removal: string;
  lifecycle: string;
  reminders: readonly TroubleBrewingReminder[];
  source: TroubleBrewingCharacterSource;
}>;

type MatrixDraft = Readonly<{
  id: string;
  input: string;
  result: string;
  duration: string;
  removal: string;
  lifecycle: string;
}>;

const reminder = (
  characterId: string,
  tokenId: string,
  label: string,
  description: string,
  canonicalState: string,
): TroubleBrewingReminder => ({
  characterId,
  tokenId,
  label,
  count: 1,
  description,
  automation: "canonical",
  canonicalState,
  manualAttachable: true,
});

const reminderDrafts: Readonly<Record<string, readonly TroubleBrewingReminder[]>> = {
  butler: [
    reminder("butler", "master", "주인", "집사가 다음 날 투표할 수 있는 주인을 표시합니다.", "ruleState.butlerVote.masterPlayerId"),
  ],
  drunk: [
    reminder("drunk", "isTheDrunk", "주정뱅이임", "실제 캐릭터가 주정뱅이인 플레이어를 표시합니다.", "player.actualCharacter"),
  ],
  fortuneTeller: [
    reminder("fortuneTeller", "redHerring", "오답 대상", "점쟁이에게 악마로 보이는 선한 레드 헤링을 표시합니다.", "ruleState.redHerringPlayerId"),
  ],
  imp: [
    reminder(
      "imp",
      "dead",
      "사망",
      "임프가 그 밤에 공격해 사망시킨 대상을, 사망 발표 전까지 표시합니다.",
      "ruleState.unannouncedNightDeathPlayerIds",
    ),
  ],
  investigator: [
    reminder("investigator", "minion", "하수인", "수사관에게 보여준 하수인 종류를 표시합니다.", "confirmed setup information"),
    reminder("investigator", "wrong", "오답", "수사관의 두 후보 중 하수인이 아닌 오답 대상을 표시합니다.", "confirmed setup information"),
  ],
  librarian: [
    reminder("librarian", "outsider", "외지인", "사서에게 보여준 외지인 종류를 표시합니다.", "confirmed setup information"),
    reminder("librarian", "wrong", "오답", "사서의 두 후보 중 외지인이 아닌 오답 대상을 표시합니다.", "confirmed setup information"),
  ],
  monk: [
    reminder("monk", "safe", "안전", "수도사가 오늘 밤 악마로부터 보호한 대상을 표시합니다.", "ruleState.activeProtection"),
  ],
  poisoner: [
    reminder("poisoner", "poisoned", "중독", "독살범의 능력으로 현재 중독된 대상을 표시합니다.", "ruleState.activePoison"),
  ],
  scarletWoman: [
    reminder("scarletWoman", "isTheDemon", "악마임", "탕녀가 악마가 되어 계승한 상태를 표시합니다.", "player.actualCharacter"),
  ],
  slayer: [
    reminder("slayer", "noAbility", "능력 없음", "처단자의 게임당 한 번인 능력이 소모된 상태를 표시합니다.", "ruleState.slayerAbility.spent"),
  ],
  undertaker: [
    reminder("undertaker", "diedToday", "오늘 사망", "오늘 낮 처형으로 사망한 플레이어를 장의사에게 표시합니다.", "execution result"),
  ],
  virgin: [
    reminder("virgin", "noAbility", "능력 없음", "성결자의 첫 유효 지목 판정으로 능력이 소모된 상태를 표시합니다.", "ruleState.virginAbility.spent"),
  ],
  washerwoman: [
    reminder("washerwoman", "townsfolk", "주민", "세탁부에게 보여준 실제 주민 종류를 표시합니다.", "confirmed setup information"),
    reminder("washerwoman", "wrong", "오답", "세탁부의 두 후보 중 주민이 아닌 오답 대상을 표시합니다.", "confirmed setup information"),
  ],
};

const drafts: readonly MatrixDraft[] = [
  {
    id: "washerwoman",
    input: "첫날 밤에 주민 1명과 다른 플레이어 1명을 후보로 표시합니다.",
    result: "두 후보 중 한 명이 특정 주민이라는 정보를 보여줍니다.",
    duration: "첫날 밤 한 번만 정보를 얻습니다.",
    removal: "첩자의 첫날 밤 마도서 열람까지 후보와 주민·오답 표식을 유지하고, 첫 낮으로 전환할 때 정리합니다.",
    lifecycle: "첩자는 주민으로, 은둔자는 해당 주민으로 판정될 수 있으며 주정뱅이는 실제 주정뱅이로 판정됩니다.",
  },
  {
    id: "librarian",
    input: "첫날 밤에 외지인 1명과 다른 플레이어 1명을 후보로 표시하거나, 외지인이 없으면 0명을 준비합니다.",
    result: "두 후보 중 한 명이 특정 외지인이라는 정보를 보여주거나 외지인이 없음을 알려줍니다.",
    duration: "첫날 밤 한 번만 정보를 얻습니다.",
    removal: "첩자의 첫날 밤 마도서 열람까지 후보와 외지인·오답 표식을 유지하고, 첫 낮으로 전환할 때 정리합니다.",
    lifecycle: "주정뱅이는 외지인 주정뱅이로 보여주며, 외지인이 없을 때는 두 후보 대신 0을 알려줍니다.",
  },
  {
    id: "investigator",
    input: "첫날 밤에 실제 하수인 1명과 다른 플레이어 1명을 후보로 표시합니다.",
    result: "두 후보 중 한 명이 특정 하수인이라는 정보를 보여줍니다.",
    duration: "첫날 밤 한 번만 정보를 얻습니다.",
    removal: "첩자의 첫날 밤 마도서 열람까지 후보와 하수인·오답 표식을 유지하고, 첫 낮으로 전환할 때 정리합니다.",
    lifecycle: "첩자와 은둔자는 이야기꾼의 등록 판정에 따라 하수인 후보 또는 오답으로 보일 수 있습니다.",
  },
  {
    id: "chef",
    input: "첫날 밤 좌석 원에서 서로 이웃한 악한 플레이어의 쌍을 셉니다.",
    result: "서로 이웃한 악한 플레이어 쌍의 수를 알려줍니다.",
    duration: "첫날 밤 한 번만 정보를 얻습니다.",
    removal: "수를 전달한 뒤 별도 표식 없이 다음 밤에는 다시 행동하지 않습니다.",
    lifecycle: "원형 좌석의 첫 번째와 마지막도 이웃이며, 첩자·은둔자의 등록 판정이 수에 반영될 수 있습니다.",
  },
  {
    id: "empath",
    input: "매일 밤 자신 양쪽에서 가장 가까운 생존자 두 명을 찾습니다.",
    result: "그 두 생존 이웃 중 악한 플레이어의 수 0, 1 또는 2를 알려줍니다.",
    duration: "매일 밤 반복합니다.",
    removal: "사망하거나 능력이 무효화되면 다음 결과를 만들지 않으며, 이웃 판정에서 사망자를 건너뜁니다.",
    lifecycle: "그날 밤 먼저 사망한 이웃을 건너뛰고 악마 이후 새 생존 이웃을 판정합니다.",
  },
  {
    id: "fortuneTeller",
    input: "준비 때 선한 레드 헤링 1명을 고정하고, 매일 밤 플레이어 2명을 선택합니다.",
    result: "선택한 둘 중 악마 또는 레드 헤링이 있으면 예, 없으면 아니오를 알려줍니다.",
    duration: "레드 헤링은 점쟁이의 캐릭터 상태가 유지되는 동안 남고, 점쟁이는 생존 중 매일 밤 정보를 얻습니다.",
    removal: "점쟁이가 사망하거나 캐릭터 계승으로 점쟁이 능력이 사라지면 레드 헤링 표식을 제거합니다.",
    lifecycle: "자신과 사망자를 포함해 선택할 수 있고, 하수인은 악마가 아니므로 단독으로 예가 되지 않습니다.",
  },
  {
    id: "undertaker",
    input: "오늘 낮 처형으로 실제 사망한 플레이어가 있는지 확인합니다.",
    result: "그 처형 사망자의 실제 캐릭터 토큰을 보여줍니다.",
    duration: "첫날 밤을 제외한 매일 밤, 오늘 처형 사망자가 있을 때만 행동합니다.",
    removal: "캐릭터를 보여준 뒤 오늘 사망 표식을 제거하고 다음 날을 기다립니다.",
    lifecycle: "처형이 없거나 처형으로 사망한 사람이 없으면 깨우지 않으며, 추방은 처형으로 세지 않습니다.",
  },
  {
    id: "monk",
    input: "첫날 밤을 제외한 매일 밤 자신이 아닌 플레이어 1명을 선택합니다.",
    result: "선택한 대상이 그날 밤 악마 능력으로 사망하지 않도록 보호합니다.",
    duration: "선택 시점부터 다음 새벽까지 유지됩니다.",
    removal: "새벽에 보호 표식을 제거하고 다음 밤에 새 대상을 선택합니다.",
    lifecycle: "악마의 공격만 막으며 처형과 다른 능력은 막지 않고, 보호된 대상이 공격받아도 재선택하지 않습니다.",
  },
  {
    id: "ravenkeeper",
    input: "밤에 사망한 경우 즉시 플레이어 1명을 선택합니다.",
    result: "선택한 플레이어의 실제 캐릭터를 보여줍니다.",
    duration: "밤 사망 시 한 번만 즉시 발동합니다.",
    removal: "캐릭터를 보여준 뒤 까마귀지기의 능력 절차를 종료합니다.",
    lifecycle: "낮 처형이 아니라 밤 사망일 때만 발동하며, 생존자·사망자 모두 선택할 수 있습니다.",
  },
  {
    id: "virgin",
    input: "게임에서 처음으로 유효한 지목을 받은 순간 지목자의 진영과 캐릭터를 판정합니다.",
    result: "지목자가 주민이면 즉시 지목자를 처형하고 낮을 끝내며, 아니면 투표를 계속합니다.",
    duration: "게임당 첫 유효 지목 한 번만 판정합니다.",
    removal: "지목 결과와 무관하게 능력 없음 표식을 놓고 다시 발동하지 않습니다.",
    lifecycle: "취하거나 중독된 상태의 첫 지목도 능력을 소모하지만 효과가 없을 수 있고, 무효 지목은 능력을 소모하지 않습니다.",
  },
  {
    id: "slayer",
    input: "낮에 공개적으로 능력 사용을 선언하고 플레이어 1명을 선택합니다.",
    result: "대상이 생존한 악마면 즉시 사망시키고, 그 외에는 아무 일도 일어나지 않습니다.",
    duration: "게임당 한 번만 사용할 수 있습니다.",
    removal: "결과와 무관하게 사용 직후 능력 없음 표식을 놓습니다.",
    lifecycle: "취하거나 중독된 상태에서 사용해도 능력은 소모되며, 은둔자가 악마로 판정되면 사망할 수 있습니다.",
  },
  {
    id: "soldier",
    input: "악마가 군인을 공격하거나 해로운 능력을 적용하려는지 확인합니다.",
    result: "능력이 유효하면 악마 공격으로 사망하지 않습니다.",
    duration: "생존하고 능력이 유효한 동안 계속 적용됩니다.",
    removal: "사망하거나 취함·중독으로 능력이 무효화되면 보호를 제거합니다.",
    lifecycle: "악마가 아닌 처형·지목·다른 캐릭터 능력에는 보호되지 않으며, 악마 공격을 막아도 악마가 대상을 다시 고르지 않습니다.",
  },
  {
    id: "mayor",
    input: "밤에 시장이 사망하려는지, 또는 정확히 세 명이 생존한 날 처형이 없었는지 확인합니다.",
    result: "밤에는 다른 플레이어를 대신 사망시킬 수 있고, 세 명 생존·무처형이면 선한 팀 승리를 제안합니다.",
    duration: "생존하고 능력이 유효한 동안 매일 밤과 황혼에 확인합니다.",
    removal: "사망하거나 중독으로 능력이 무효화되면 대체 사망과 무처형 승리 확인을 제거합니다.",
    lifecycle: "여행자는 생존자 수에 포함되며 추방은 처형이 아니고, 대체 사망 대상이 보호되면 아무도 사망하지 않을 수 있습니다.",
  },
  {
    id: "butler",
    input: "매일 밤 자신 외의 플레이어 1명을 주인으로 선택합니다.",
    result: "다음 날 주인이 투표에 참여한 경우에만 집사가 투표할 수 있습니다.",
    duration: "선택한 주인 표식은 다음 밤까지 다음 날 투표에 적용됩니다.",
    removal: "다음 밤 새 주인을 선택할 때 이전 주인 표식을 제거합니다.",
    lifecycle: "주인이 투표 중이거나 표가 집계된 동안에만 집사의 표를 올릴 수 있고, 사망한 집사는 자유롭게 유령표를 사용합니다.",
  },
  {
    id: "drunk",
    input: "준비 때 주정뱅이 토큰 대신 주민 토큰을 보여주고 실제 주정뱅이로 표시합니다.",
    result: "주정뱅이는 자신이 보여진 주민이라고 믿지만 능력은 임의의 참·거짓 결과를 낼 수 있습니다.",
    duration: "게임 내내 실제 캐릭터는 주정뱅이입니다.",
    removal: "주정뱅이 상태는 제거하지 않으며, 사망해도 실제 캐릭터 판정은 주정뱅이로 유지합니다.",
    lifecycle: "보여준 주민의 밤 행동처럼 깨울 수 있지만 다른 능력이 확인하면 주정뱅이로 판정합니다.",
  },
  {
    id: "recluse",
    input: "정렬·캐릭터를 확인하거나 대상으로 삼는 능력이 은둔자와 상호작용할 때 등록 판정을 선택합니다.",
    result: "선한 은둔자가 악한 팀·특정 하수인·악마로 위장해 판정될 수 있습니다.",
    duration: "각 등록 판정 순간에만 임시로 적용되며 사망 후에도 적용될 수 있습니다.",
    removal: "각 판정이 끝나면 해당 위장 선택을 제거하고 다음 상호작용에서 새로 결정합니다.",
    lifecycle: "위장한 캐릭터의 능력을 얻지는 않으며, 같은 밤의 서로 다른 판정마다 다르게 위장할 수 있습니다.",
  },
  {
    id: "saint",
    input: "성자가 처형으로 실제 사망했는지 확인합니다.",
    result: "성자가 처형으로 사망하면 즉시 성자의 팀이 패배합니다.",
    duration: "생존하는 동안 계속 처형 결과를 확인합니다.",
    removal: "처형 사망으로 게임이 끝나면 능력과 관련 표식을 제거합니다.",
    lifecycle: "악마 공격이나 다른 능력으로 사망하면 게임을 끝내지 않으며, 다른 플레이어가 대신 사망해 생존하면 발동하지 않습니다.",
  },
  {
    id: "poisoner",
    input: "매일 밤 자신을 포함한 플레이어 1명을 선택합니다.",
    result: "선택한 대상은 능력이 작동하지 않고 정보가 참·거짓으로 흔들릴 수 있습니다.",
    duration: "선택한 밤과 다음 낮까지 중독됩니다.",
    removal: "다음 황혼에 중독 표식을 제거합니다.",
    lifecycle: "중독된 플레이어도 평소처럼 깨워 행동시키며, 독살범이 캐릭터를 바꿔 사라지면 기존 중독은 해당 능력 상태에 따라 종료됩니다.",
  },
  {
    id: "spy",
    input: "매일 밤 모든 캐릭터와 상태가 보이는 마도서를 확인합니다.",
    result: "모든 플레이어의 실제 캐릭터와 생존·사망·현재 표식을 볼 수 있습니다.",
    duration: "생존하고 능력이 유효한 동안 매일 밤 반복합니다.",
    removal: "밤 열람이 끝나면 마도서를 닫고 별도 표식을 유지하지 않습니다.",
    lifecycle: "선한 팀의 주민·외지인으로 위장해 판정될 수 있지만 해당 캐릭터 능력을 얻지 않으며 사망 후에도 위장할 수 있습니다.",
  },
  {
    id: "scarletWoman",
    input: "악마가 사망하기 직전 여행자를 제외한 생존자가 다섯 명 이상인지 확인합니다.",
    result: "조건을 만족하면 탕녀의 토큰을 악마 토큰으로 바꾸고 게임을 계속합니다.",
    duration: "악마 사망 순간 한 번만 계승을 판정합니다.",
    removal: "계승하면 탕녀 정체와 악마임 표식을 새 악마 상태로 교체합니다.",
    lifecycle: "생존자가 네 명 이하이거나 조건을 만족하는 하수인이 없으면 계승하지 않고 악마 사망으로 게임이 끝납니다.",
  },
  {
    id: "baron",
    input: "준비 중 남작이 게임에 포함되었는지 확인합니다.",
    result: "주민 토큰 두 개를 제거하고 외지인 토큰 두 개를 추가합니다.",
    duration: "설정 시 한 번 적용되며 게임 내내 유지됩니다.",
    removal: "남작이 사망하거나 캐릭터를 바꿔도 설정 변경을 되돌리지 않습니다.",
    lifecycle: "추가 외지인으로 주정뱅이를 넣으면 주정뱅이의 별도 표시와 진행 절차도 적용합니다.",
  },
  {
    id: "imp",
    input: "첫날 밤을 제외한 매일 밤 생존·사망 여부와 관계없이 플레이어 1명을 선택합니다.",
    result: "선택한 대상이 사망하고, 자신을 선택하면 임프가 사망한 뒤 생존 하수인에게 악마가 계승됩니다.",
    duration: "생존한 임프는 첫날 밤 이후 매일 밤 공격합니다.",
    removal: "공격 대상의 사망은 밤 사망 발표 전까지 표시하고 발표와 함께 정리하며, 자결 시 기존 임프 상태를 후계 악마로 교체합니다.",
    lifecycle: "새 임프는 같은 밤에 다시 공격하지 않으며, 생존 하수인이 없으면 자결 뒤 악마가 사라져 선한 팀이 승리합니다.",
  },
];

function matrixEntry(draft: MatrixDraft): TroubleBrewingCharacterMatrixEntry {
  const character = characters.find((candidate) => candidate.id === draft.id);
  if (!character) throw new Error(`Unknown Trouble Brewing character: ${draft.id}`);
  const rules = characterRulesFor(draft.id);
  if (!rules) throw new Error(`Missing Trouble Brewing rules: ${draft.id}`);

  return {
    ...draft,
    label: character.label,
    kind: character.kind,
    ability: character.abilitySummary,
    reminders: reminderDrafts[draft.id] ?? [],
    source: {
      url: rules.sourceUrl,
      collectionUrl: TROUBLE_BREWING_COLLECTION_SOURCE_URL,
      checkedAt: TROUBLE_BREWING_SOURCE_CHECKED_AT,
    },
  };
}

export const troubleBrewingCharacterMatrix: readonly TroubleBrewingCharacterMatrixEntry[] =
  drafts.map(matrixEntry);

const matrixById = new Map(troubleBrewingCharacterMatrix.map((entry) => [entry.id, entry]));

export function troubleBrewingCharacterMatrixFor(
  characterId?: string,
): TroubleBrewingCharacterMatrixEntry | undefined {
  return characterId ? matrixById.get(characterId) : undefined;
}

export const troubleBrewingReminderInventory: readonly TroubleBrewingReminder[] =
  [
    "butler",
    "drunk",
    "fortuneTeller",
    "imp",
    "investigator",
    "librarian",
    "monk",
    "poisoner",
    "scarletWoman",
    "slayer",
    "undertaker",
    "virgin",
    "washerwoman",
  ].flatMap((characterId) => reminderDrafts[characterId] ?? []);

export const troubleBrewingOfficialReminderInventory = troubleBrewingReminderInventory;

export const troubleBrewingCharacterMatrixById = matrixById;

export function characterForTroubleBrewingMatrix(id: string): Character | undefined {
  return characters.find((character) => character.id === id);
}
