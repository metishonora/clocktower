import {
  sectsAndVioletsCharacters,
  sectsAndVioletsWikiSlugs,
} from "./sectsAndVioletsCharacters.js";

export type OfficialExampleDisposition =
  | { kind: "rust-regression" }
  | { kind: "web-regression" }
  | { kind: "json-acceptance" }
  | { kind: "manual-acceptance" }
  | { kind: "out-of-scope"; reason: string };

export type SectsAndVioletsOfficialExample = {
  id: string;
  text: string;
  ownerIssue: number;
  disposition: OfficialExampleDisposition;
  crossCharacterIssue?: 111;
};

export type SectsAndVioletsReminder = {
  label: string;
  count: number;
  scope: "character" | "global";
  description: string;
};

export type SectsAndVioletsCharacterRules = {
  id: string;
  label: string;
  ability: string;
  rulings: string[];
  howToRun: string[];
  examples: SectsAndVioletsOfficialExample[];
  reminders: SectsAndVioletsReminder[];
  setup: boolean;
  source: {
    url: string;
    revision: number;
    checkedAt: "2026-07-22";
  };
};

type ExampleDraft = readonly [
  text: string,
  kind: OfficialExampleDisposition["kind"],
  crossCharacter?: boolean,
  outOfScopeReason?: string,
];

type RuleDraft = {
  id: string;
  ownerIssue: number;
  revision: number;
  rulings: string[];
  howToRun: string[];
  examples: ExampleDraft[];
  reminders?: SectsAndVioletsReminder[];
  setup?: boolean;
};

const travelerScopeReason = "여행자 추방과 여행자 판정은 현재 S&V 기본 캐릭터 구현 범위 밖입니다.";

function characterRules(draft: RuleDraft): SectsAndVioletsCharacterRules {
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === draft.id);
  if (!character) throw new Error(`Unknown Sects & Violets character: ${draft.id}`);

  return {
    id: draft.id,
    label: character.name,
    ability: character.ability,
    rulings: draft.rulings,
    howToRun: draft.howToRun,
    examples: draft.examples.map(([text, kind, crossCharacter, outOfScopeReason], index) => ({
      id: `${draft.id}-example-${index + 1}`,
      text,
      ownerIssue: draft.ownerIssue,
      disposition: kind === "out-of-scope"
        ? { kind, reason: outOfScopeReason ?? travelerScopeReason }
        : { kind },
      ...(crossCharacter ? { crossCharacterIssue: 111 as const } : {}),
    })),
    reminders: draft.reminders ?? [],
    setup: draft.setup ?? false,
    source: {
      url: `https://wiki.bloodontheclocktower.com/${sectsAndVioletsWikiSlugs[draft.id]}`,
      revision: draft.revision,
      checkedAt: "2026-07-22",
    },
  };
}

const reminder = (
  label: string,
  count: number,
  description: string,
  scope: SectsAndVioletsReminder["scope"] = "character",
): SectsAndVioletsReminder => ({ label, count, scope, description });

export const sectsAndVioletsCharacterRules: SectsAndVioletsCharacterRules[] = [
  characterRules({
    id: "clockmaker", ownerIssue: 96, revision: 2967,
    rulings: [
      "첫째 밤에만, 악마에서 가장 가까운 하수인까지 시계 방향 또는 반시계 방향으로 건너는 플레이어 수를 압니다.",
      "악한 여행자는 하수인이 아니므로 거리를 정할 때 하수인으로 세지 않습니다.",
    ],
    howToRun: ["첫째 밤에 악마와 가장 가까운 하수인 사이의 거리를 계산해 손가락으로 알려줍니다."],
    examples: [
      ["팡 구가 마귀할멈 바로 옆에 앉아 있습니다. 첫째 밤에 시계공은 \"1\"을 알게 됩니다.", "rust-regression"],
      ["노 다시에서 시계 방향으로 꿈꾸는 자, 뱀 조련사, 사악한 쌍둥이가 앉아 있습니다. 반시계 방향으로는 변종, 사랑꾼, 철학자, 현자, 마녀가 앉아 있습니다. 마녀는 악마에서 5칸, 사악한 쌍둥이는 3칸 떨어져 있으므로, 시계공은 첫째 밤에 \"3\"을 알게 됩니다.", "rust-regression"],
      ["팡 구 옆에 선한 여행자와 악한 여행자가 앉아 있습니다. 여행자 중 한 명 옆에 세레노버스가 있습니다. 첫째 밤에 시계공은 \"2\"를 알게 됩니다. 악한 여행자는 하수인이 아니기 때문입니다.", "out-of-scope", true],
    ],
  }),
  characterRules({
    id: "dreamer", ownerIssue: 98, revision: 2904,
    rulings: [
      "자신과 여행자를 제외한 플레이어를 고르고, 실제 캐릭터 하나와 반대 진영 쪽 캐릭터 하나를 봅니다.",
      "보르톡스의 영향을 받으면 두 캐릭터 모두 선택한 플레이어의 실제 캐릭터가 아니어야 합니다.",
    ],
    howToRun: ["선택한 플레이어의 실제 캐릭터와, 그가 선하면 악한 캐릭터 하나를 또는 악하면 선한 캐릭터 하나를 함께 보여줍니다."],
    examples: [
      ["꿈꾸는 자가 변종인 플레이어를 선택합니다. 꿈꾸는 자는 이 플레이어가 변종이거나 세레노버스라고 알게 됩니다.", "rust-regression"],
      ["꿈꾸는 자가 철학자였지만 그날 밤 일찍 꽃팔이 소녀 능력을 얻은 플레이어를 선택합니다. 꿈꾸는 자는 이 플레이어가 철학자이거나 비고르모르티스라고 알게 됩니다.", "json-acceptance", true],
      ["오늘 사악한 쌍둥이와 화가 모두 자신이 화가라고 주장했습니다. 그날 밤, 꿈꾸는 자가 사악한 쌍둥이인 플레이어를 선택합니다. 이야기꾼이 선한 팀을 돕고 싶다면 사악한 쌍둥이와 사랑꾼을 보여줄 수 있습니다. 하지만 이야기꾼은 악을 돕기로 결정하고 꿈꾸는 자에게 사악한 쌍둥이와 화가를 보여줍니다.", "manual-acceptance", true],
      ["꿈꾸는 자가 보르톡스인 플레이어를 선택합니다. 보르톡스가 게임에 있기 때문에 꿈꾸는 자의 정보는 거짓이어야 하므로, 꿈꾸는 자는 이 플레이어가 예언자이거나 노 다시라고 알게 됩니다.", "json-acceptance", true],
    ],
  }),
  characterRules({
    id: "snakeCharmer", ownerIssue: 101, revision: 2905,
    rulings: [
      "악마가 아닌 생존자를 고르면 아무 일도 없고, 악마를 고르면 두 플레이어가 캐릭터와 진영을 교환합니다.",
      "기존 악마가 된 새 뱀 조련사는 영구 중독되며, 특수한 진영 상태에서도 현재 진영을 서로 교환합니다.",
    ],
    howToRun: ["악마를 골랐다면 두 캐릭터 토큰을 교환하고 새 뱀 조련사에 중독 표식을 놓은 뒤, 두 플레이어에게 새 캐릭터와 진영을 각각 알립니다."],
    examples: [
      ["뱀 조련사가 마귀할멈인 플레이어를 선택해서 아무 일도 일어나지 않습니다. 뱀 조련사는 그냥 잠이 듭니다. 다음 날 밤, 뱀 조련사가 자기 자신을 선택해서 아무 일도 일어나지 않습니다.", "rust-regression"],
      ["뱀 조련사가 비고르모르티스인 플레이어를 선택합니다. 뱀 조련사는 즉시 악한 비고르모르티스가 되고, 비고르모르티스는 선한 뱀 조련사가 되어 중독됩니다.", "json-acceptance", true],
      ["마귀할멈이 자기 자신을 뱀 조련사로 바꿉니다. 그런 다음 뱀 조련사가 팡 구인 플레이어를 선택합니다. 뱀 조련사는 팡 구가 되고 팡 구는 뱀 조련사가 되어 중독됩니다. 둘 다 악한 진영으로 남습니다.", "json-acceptance", true],
    ],
    reminders: [reminder("중독됨", 1, "악마와 교환한 새 뱀 조련사의 중독을 표시합니다.")],
  }),
  characterRules({
    id: "mathematician", ownerIssue: 108, revision: 3109,
    rulings: [
      "새벽 이후 다른 캐릭터의 영향 때문에 정상과 다르게 작동한 플레이어 능력의 수를 셉니다.",
      "취함·중독 자체가 아니라 그 결과 실제로 능력이 비정상 작동한 경우만 세고, 자신의 오작동은 세지 않습니다.",
    ],
    howToRun: ["비정상 작동한 각 플레이어의 능력에 표식을 놓고, 수학자에게 그 표식 수를 알려준 뒤 모두 제거합니다."],
    examples: [
      ["중독된 예언자가 실제로 죽은 악한 플레이어가 3명인데 2명이라고 알게 됩니다. 다른 모든 캐릭터 능력은 정상적으로 작동합니다. 그날 밤 늦게 수학자는 \"1\"을 알게 됩니다.", "rust-regression", true],
      ["중독된 뱀 조련사가 주민을 선택해 정상적으로 아무 일도 일어나지 않고, 취한 곡예사도 우연히 올바른 정보를 얻습니다. 백치천재는 하나는 참이고 하나는 거짓이어야 하지만 두 가지 참 정보를 얻습니다. 비정상 작동은 백치천재 하나뿐이므로 수학자는 \"1\"을 알게 됩니다.", "json-acceptance", true],
      ["보르톡스가 게임에 있습니다. 선한 플레이어 5명이 거짓 정보를 받았습니다. 마녀가 취해서 저주받은 플레이어가 지목했을 때 아무 일도 일어나지 않았습니다. 6개의 능력이 비정상적으로 작동했지만, 수학자는 보르톡스의 능력 때문에 \"4\"를 알게 됩니다.", "json-acceptance", true],
    ],
    reminders: [reminder("비정상", 5, "비정상적으로 작동한 플레이어 능력을 표시합니다.")],
  }),
  characterRules({
    id: "flowergirl", ownerIssue: 96, revision: 2907,
    rulings: [
      "처형 여부와 무관하게 악마가 처형 투표에 참여했는지를 알며, 여행자 추방 투표는 세지 않습니다.",
      "정보를 받기 전에 악마가 바뀌어도 그 낮에 투표했던 당시 악마를 감지합니다.",
    ],
    howToRun: ["새벽에 미투표 표식을 놓고, 낮에 악마가 투표하면 투표함 표식으로 바꾼 뒤 그날 밤 예 또는 아니오를 알려줍니다."],
    examples: [
      ["지목이 한 번 있었습니다. 많은 플레이어가 투표했고 처형이 이루어졌지만 악마는 기권했습니다. 그 밤, 꽃팔이 소녀는 악마가 투표하지 않았음을 알게 됩니다.", "rust-regression"],
      ["지목이 세 번 있었습니다. 악마가 두 번째 지목에서 투표했습니다. 아무도 처형되지 않았습니다. 그 밤, 꽃팔이 소녀는 악마가 투표했음을 알게 됩니다.", "rust-regression"],
      ["지목이 없었습니다. 여행자가 추방되었고 모든 플레이어가 손을 들었습니다. 그 밤, 꽃팔이 소녀는 악마가 투표하지 않았음을 알게 됩니다. 추방은 능력의 영향을 받지 않습니다.", "out-of-scope", true],
    ],
    reminders: [
      reminder("악마 투표함", 1, "그날 악마가 처형 투표에 참여했음을 표시합니다."),
      reminder("악마 투표 안 함", 1, "그날 악마가 아직 처형 투표에 참여하지 않았음을 표시합니다."),
    ],
  }),
  characterRules({
    id: "townCrier", ownerIssue: 96, revision: 2908,
    rulings: ["하수인이 그날 처형 지목을 했는지만 알며, 누가 또는 몇 명이 지목했는지는 알지 못합니다.", "여행자 추방 요청은 지목이 아닙니다."],
    howToRun: ["새벽에 미지목 표식을 놓고, 낮에 하수인이 지목하면 지목함 표식으로 바꾼 뒤 그날 밤 예 또는 아니오를 알려줍니다."],
    examples: [
      ["오늘 네 명이 지목했습니다. 그 중 두 명이 하수인이었습니다. 많은 플레이어가 투표했지만 처형은 없었습니다. 그 밤, 포고꾼은 \"예\"를 알게 됩니다.", "rust-regression"],
      ["하수인이 여행자 추방을 요청했고 여행자는 추방되었습니다. 그 밤, 포고꾼은 \"아니오\"를 알게 됩니다. 추방은 캐릭터 능력의 영향을 받지 않습니다.", "out-of-scope", true],
    ],
    reminders: [
      reminder("하수인 지목함", 1, "그날 하수인이 처형 지목을 했음을 표시합니다."),
      reminder("하수인 지목 안 함", 1, "그날 하수인이 아직 처형 지목을 하지 않았음을 표시합니다."),
    ],
  }),
  characterRules({
    id: "oracle", ownerIssue: 96, revision: 2909,
    rulings: ["악마의 밤 행동 뒤에, 현재 사망한 모든 악한 플레이어를 셉니다.", "하수인·악마뿐 아니라 악한 여행자와 진영이 바뀐 선한 캐릭터도 셉니다."],
    howToRun: ["첫째 밤을 제외한 매일 밤 사망한 악한 플레이어 수를 손가락으로 알려줍니다."],
    examples: [
      ["첫째 날 꽃팔이 소녀가 처형됩니다. 그 밤 악마가 곡예사를 죽입니다. 예언자가 깨어나 \"0\"을 알게 됩니다. 모든 사망자가 선하기 때문입니다.", "rust-regression"],
      ["게임 중반에 7명이 사망했습니다. 5명은 선하고 2명은 악합니다. 낮에 악한 여행자가 추방됩니다. 그 밤 악마가 자신의 하수인 중 한 명을 죽입니다. 예언자가 깨어나 \"4\"를 알게 됩니다.", "out-of-scope", true],
    ],
  }),
  characterRules({
    id: "savant", ownerIssue: 102, revision: 2910,
    rulings: ["매일 비공개로 두 정보를 받을 수 있고, 정상 상태에서는 정확히 하나가 참이고 하나가 거짓이어야 합니다.", "백치천재가 먼저 대화를 요청하며, 원하면 그날 정보를 받지 않아도 됩니다."],
    howToRun: ["요청받으면 게임에 도움이 되는 서로 구별 가능한 정보 두 개를 비공개로 전달하고, 하나만 참이 되게 합니다."],
    examples: [
      ["백치천재는 \"안경 쓴 플레이어는 모두 선하다\"와 \"검은 소파에 앉은 플레이어 중 한 명이 하수인이다\"를 알게 됩니다.", "manual-acceptance"],
      ["백치천재는 \"뱀 조련사가 게임에 있다\"와 \"어젯밤 모두가 참 정보를 받았다\"를 알게 됩니다.", "manual-acceptance"],
      ["백치천재는 \"악마는 여성이다\"와 \"벤자민은 악이다\"를 알게 됩니다.", "manual-acceptance"],
      ["백치천재는 \"에빈과 에이미는 같은 진영이다\"와 \"외지인이 1명 있다\"를 알게 됩니다.", "manual-acceptance"],
    ],
  }),
  characterRules({
    id: "seamstress", ownerIssue: 98, revision: 1999,
    rulings: ["자신을 제외한 생존자·사망자·여행자 중 두 명을 골라 같은 진영인지 한 번만 확인합니다."],
    howToRun: ["매일 밤 사용할지 확인하고, 두 명을 고르면 같은 진영은 예, 다른 진영은 아니오를 알려준 뒤 능력 없음 표식을 놓습니다."],
    examples: [
      ["첫째 밤에 재봉사가 이발사와 시계공인 두 플레이어를 선택합니다. 둘 다 선하기 때문에 재봉사는 '예'를 알게 됩니다.", "rust-regression"],
      ["첫 세 밤 동안 재봉사는 능력을 사용하지 않기로 선택합니다. 넷째 밤에 팡 구와 사랑꾼인 두 플레이어를 선택합니다. 재봉사는 '아니오'를 알게 됩니다.", "rust-regression"],
      ["마귀할멈이 수학자를 마녀로 바꾸지만 마녀는 선한 상태를 유지합니다. 그날 밤 늦게 재봉사가 마녀와 포고꾼 두 플레이어를 선택합니다. 재봉사는 둘 다 선하기 때문에 '예'를 알게 됩니다.", "json-acceptance", true],
    ],
    reminders: [reminder("능력 없음", 1, "재봉사가 게임당 한 번인 능력을 사용했음을 표시합니다.")],
  }),
  characterRules({
    id: "philosopher", ownerIssue: 107, revision: 2421,
    rulings: [
      "게임당 한 번 선한 캐릭터의 능력을 얻지만 그 캐릭터 자체로 바뀌지는 않습니다.",
      "선택한 캐릭터가 게임에 있거나 이후 생기면 그 플레이어는 철학자가 죽거나 취하거나 중독될 때까지 취합니다.",
    ],
    howToRun: ["매일 밤 사용할지 확인하고, 선택한 능력의 캐릭터가 게임에 있으면 그 플레이어에 취함 표식을, 철학자에는 철학자임 표식을 놓습니다."],
    examples: [
      ["첫째 밤에 철학자가 꿈꾸는 자의 능력을 얻기로 합니다. 이제부터 꿈꾸는 자의 능력을 얻고 꿈꾸는 자가 일반적으로 행동할 때 행동합니다.", "json-acceptance", true],
      ["셋째 밤에 철학자가 시계공의 능력을 얻기로 합니다. 그 밤 악마에서 가장 가까운 하수인까지의 거리를 알게 됩니다.", "json-acceptance", true],
      ["화가가 게임에 있습니다. 철학자가 화가의 능력을 얻기로 합니다. 원래 화가는 취한 상태가 됩니다. 이후 철학자가 죽어서 원래 화가는 다시 맑아집니다. 철학자가 취해도 원래 화가는 맑아집니다.", "json-acceptance", true],
    ],
    reminders: [
      reminder("취함", 1, "철학자가 능력을 복제해 취한 원래 캐릭터를 표시합니다."),
      reminder("철학자임", 1, "철학자의 능력을 가진 플레이어를 표시합니다.", "global"),
    ],
  }),
  characterRules({
    id: "artist", ownerIssue: 102, revision: 1752,
    rulings: ["게임당 한 번 어떤 주제든 질문할 수 있으며, 이야기꾼은 예·아니오·모르겠습니다 중 정직한 답을 합니다."],
    howToRun: ["화가가 비공개 대화를 요청하면 질문을 받고 답한 뒤 능력 없음 표식을 놓습니다."],
    examples: [
      ["화가가 \"악마가 갈색 의자에 앉아 있나요?\"라고 묻습니다. 이야기꾼이 \"아니오\"라고 답합니다. 악마는 검은 의자에 앉아 있기 때문입니다.", "manual-acceptance"],
      ["화가가 \"데이비드가 사악한 쌍둥이인가요?\"라고 묻습니다. 이야기꾼이 \"예\"라고 답합니다. 데이비드가 맞기 때문입니다.", "manual-acceptance"],
      ["화가가 \"살아있는 하수인이 몇 명인가요?\"라고 묻습니다. 이야기꾼이 \"다른 질문을 해주세요. 예, 아니오, 또는 모르겠습니다로 답할 수 없습니다\"라고 합니다.", "manual-acceptance"],
      ["화가가 \"우리가 이기고 있나요?\"라고 묻습니다. 이야기꾼이 \"모르겠습니다\"라고 답합니다. 모든 하수인이 죽었지만 많은 선한 플레이어가 악마를 신뢰하기 때문입니다.", "manual-acceptance"],
    ],
    reminders: [reminder("능력 없음", 1, "화가가 게임당 한 번인 질문을 사용했음을 표시합니다.")],
  }),
  characterRules({
    id: "juggler", ownerIssue: 102, revision: 2401,
    rulings: ["자신의 첫 낮에만 공개 추측할 수 있고, 한 플레이어를 여러 캐릭터로 추측해도 각각 한 번으로 세며 최대 다섯 번입니다."],
    howToRun: ["첫 낮의 공개 추측을 기록하고 정답마다 표식을 놓은 뒤, 그날 밤 정답 수를 알려주고 표식을 제거합니다."],
    examples: [
      ["첫 번째 낮에 곡예사가 알렉스는 포고꾼, 미아는 노 다시, 줄리안은 현자라고 추측합니다. 그 밤, 곡예사는 \"2\"를 알게 되며, 그 추측 중 두 개가 맞았다는 의미입니다.", "web-regression"],
      ["넷째 밤에 백치천재가 곡예사로 바뀝니다. 다음 날, 새 곡예사가 벤자민은 마귀할멈, 벤자민은 마녀, 에이미는 마귀할멈이라고 추측합니다. 그 밤, 곡예사는 \"1\"을 알게 됩니다.", "json-acceptance", true],
    ],
    reminders: [reminder("정답", 5, "곡예사의 올바른 공개 추측을 표시합니다.")],
  }),
  characterRules({
    id: "sage", ownerIssue: 98, revision: 3009,
    rulings: ["악마의 능력 때문에 죽은 그 밤에 두 플레이어를 보고, 정상 상태에서는 그중 정확히 한 명이 악마입니다."],
    howToRun: ["악마가 현자를 죽였다면 현자를 깨워 악마와 악마가 아닌 플레이어 한 명을 가리킵니다."],
    examples: [
      ["둘째 밤에 악마가 현자를 죽입니다. 이야기꾼이 두 플레이어를 가리키며, 그 중 한 명이 악마입니다.", "rust-regression"],
      ["마지막 밤에 악마가 사랑꾼 때문에 취한 현자를 죽입니다. 이야기꾼이 죽은 플레이어 한 명과 남은 세 명의 살아있는 플레이어 중 한 명을 가리킵니다. 이 정보는 틀립니다.", "json-acceptance", true],
      ["마귀할멈이 악마를 만듭니다. 마귀할멈 능력이 오늘 밤 모든 사망은 임의적이라고 하므로, 이야기꾼은 기존 악마와 현자가 죽는다고 결정합니다. 현자가 악마가 아닌 마귀할멈 때문에 죽었으므로, 현자는 오늘 밤 정보를 얻지 못합니다.", "json-acceptance", true],
    ],
  }),
  characterRules({
    id: "mutant", ownerIssue: 105, revision: 1755,
    rulings: [
      "자신이 외지인이라고 다른 플레이어를 설득하려는 집착을 보이면 이야기꾼이 즉시 처형할 수 있습니다.",
      "처형은 선택 사항이며 하루의 처형으로 계산되고, 주민이라고 설득하는 식의 반대 집착은 요구되지 않습니다.",
    ],
    howToRun: ["변종이 외지인임을 드러내려 집착한다고 판단하면 즉시 처형을 선언하고 낮을 끝낼 수 있습니다."],
    examples: [
      ["첫째 날 10초 만에 변종이 그룹에게 자신이 변종이라고 말합니다. 이야기꾼이 변종이 즉시 처형된다고 선언합니다. 하루에 처형은 최대 하나이므로 오늘 처형을 위한 지목은 없습니다.", "manual-acceptance"],
      ["마녀가 이야기꾼에게 개인적으로 말해서, 변종을 맡은 에빈이 자신이 얼뜨기라고 말했다고 합니다. 이야기꾼이 변종을 즉시 처형하기로 합니다.", "manual-acceptance"],
      ["변종이 그룹에게 자신이 주민이라고 말하지만 어떤 주민인지는 말하지 않습니다. 변종인지 질문받자 침묵합니다. 약 1분간 침묵 후 이야기꾼이 변종을 처형합니다.", "manual-acceptance"],
      ["변종이 자신이 예언자라고 말하고 거짓 예언자 정보를 주다가, 미묘하게 윙크하며 \"참고로 저는 절대 변종이 아닙니다\"라고 말합니다. 이야기꾼이 변종을 즉시 처형하기로 합니다.", "manual-acceptance"],
    ],
  }),
  characterRules({
    id: "sweetheart", ownerIssue: 103, revision: 2704,
    rulings: ["어떤 이유로든 사랑꾼이 죽는 즉시 이야기꾼이 생존·사망 여부와 관계없이 한 플레이어를 골라 영구 취하게 합니다."],
    howToRun: ["사랑꾼이 죽으면 한 플레이어를 선택해 취함 표식을 놓습니다."],
    examples: [
      ["사랑꾼이 죽습니다. 수학자가 이제 취한 상태이고 밤에 거짓 정보를 받을 수 있습니다.", "json-acceptance", true],
      ["사랑꾼이 죽습니다. 변종이 이제 취한 상태입니다. 변종은 안전하게 변종이라고 밝힐 수 있지만, 그것을 모릅니다.", "json-acceptance", true],
      ["사랑꾼이 죽습니다. 악마가 이제 취한 상태이므로, 밤 공격이 아무도 죽이지 않습니다.", "json-acceptance", true],
    ],
    reminders: [reminder("취함", 1, "사랑꾼의 죽음으로 취한 플레이어를 표시합니다.")],
  }),
  characterRules({
    id: "barber", ownerIssue: 103, revision: 1757,
    rulings: [
      "이발사가 낮 또는 밤에 죽으면 그날 밤 악마가 다른 악마를 제외한 두 플레이어의 캐릭터를 교환하거나 거절할 수 있습니다.",
      "진영과 플레이어 위치는 바뀌지 않으며, 교환 결과의 능력·표식·밤 행동은 즉시 새 캐릭터를 따릅니다.",
    ],
    howToRun: ["이발사가 그날 죽었다면 밤에 악마에게 이발 토큰을 보여주고, 원하면 서로 다른 두 플레이어를 골라 캐릭터 토큰을 교환하게 합니다."],
    examples: [
      ["이발사가 죽습니다. 악마가 시계공과 곡예사를 교환할지 고려하지만 아무것도 하지 않습니다.", "web-regression"],
      ["이발사가 죽습니다. 악마가 살아있는 뱀 조련사와 죽은 이발사를 교환합니다. 이제 살아있는 이발사와 죽은 뱀 조련사가 있습니다.", "json-acceptance", true],
      ["이발사가 죽습니다. 보르톡스가 자신과 살아있는 마녀를 교환합니다.", "json-acceptance", true],
      ["이발사가 죽습니다. 비고르모르티스가 자신과 죽은 사랑꾼을 교환합니다. 기존 비고르모르티스는 이제 악한 사랑꾼입니다. 마귀할멈이 전날 밤 선한 악마를 만들었으므로 게임이 계속됩니다.", "json-acceptance", true],
    ],
    reminders: [reminder("오늘 밤 이발", 1, "그날 밤 악마에게 캐릭터 교환 기회가 있음을 표시합니다.")],
  }),
  characterRules({
    id: "klutz", ownerIssue: 103, revision: 1758,
    rulings: ["자신이 죽었다는 사실을 알게 되는 즉시 생존자 한 명을 공개적으로 고르며, 고른 플레이어가 악하면 얼뜨기의 팀이 패배합니다."],
    howToRun: ["얼뜨기가 자신의 죽음을 알면 생존자 한 명을 공개 선택하게 하고, 악한 플레이어라면 즉시 얼뜨기의 반대 팀 승리를 선언합니다."],
    examples: [
      ["얼뜨기가 처형으로 죽습니다. 많은 소리치기와 혼란 끝에, 얼뜨기가 플레이어를 선택합니다. 그 플레이어는 비밀리에 재봉사입니다. 밤이 되고 게임이 계속됩니다.", "manual-acceptance"],
      ["악마가 얼뜨기인 데이브를 죽입니다. 아침에 데이브가 자신의 죽음을 알게 된 뒤 논의하고 공개적으로 악마인 플레이어를 선택합니다. 게임이 즉시 끝나고 악이 승리합니다.", "json-acceptance", true],
    ],
  }),
  characterRules({
    id: "evilTwin", ownerIssue: 106, revision: 3101,
    rulings: [
      "준비 때 선한 쌍둥이를 정하고 첫째 밤에 두 쌍둥이가 서로와 상대 캐릭터를 확인합니다.",
      "선한 쌍둥이가 처형되면 악이 승리하고, 둘 다 살아 있는 동안 선은 승리할 수 없습니다. 죽은 사악한 쌍둥이는 이 능력을 잃습니다.",
      "두 쌍둥이가 같은 진영이 되면 이야기꾼이 새 반대 진영 쌍둥이를 정합니다.",
    ],
    howToRun: ["선한 캐릭터에 쌍둥이 표식을 놓고 첫째 밤에 두 플레이어를 함께 깨워 서로를 확인시킨 뒤 상대 캐릭터를 각각 보여줍니다."],
    examples: [
      ["두 쌍둥이가 모두 예언자라고 주장합니다. 사악한 쌍둥이가 처형됩니다. 게임이 계속됩니다.", "rust-regression"],
      ["마귀할멈이 선한 쌍둥이이기도 한 선한 현자를 변종으로 바꿉니다. 두 쌍둥이가 모두 자신이 변종이라고 그룹을 설득하려 합니다. 이야기꾼이 선한 쌍둥이이기도 한 변종을 즉시 처형합니다. 게임이 끝나고 악이 승리합니다.", "json-acceptance", true],
      ["선한 쌍둥이와 사악한 쌍둥이가 둘 다 자신이 화가라고 주장합니다. 선한 플레이어들이 악마를 처형하지만 두 쌍둥이가 살아 있어 게임은 계속되고, 이제부터 밤에 사망자가 없습니다.", "json-acceptance", true],
      ["마귀할멈이 선한 플레이어를 사악한 쌍둥이로 바꾸고, 그 플레이어는 선한 상태로 남습니다. 그룹이 선한 진영의 사악한 쌍둥이를 처형합니다. 악이 승리합니다.", "json-acceptance", true],
    ],
    reminders: [reminder("쌍둥이", 1, "사악한 쌍둥이와 짝인 선한 플레이어를 표시합니다.")],
  }),
  characterRules({
    id: "witch", ownerIssue: 106, revision: 2682,
    rulings: [
      "저주받은 플레이어가 다음 낮 누군가를 지목하면 즉시 죽지만 그 지목과 투표는 계속됩니다.",
      "저주는 하루만 지속되고 생존자가 정확히 세 명이 되는 즉시 해제되며, 여행자 추방 요청은 지목이 아닙니다.",
    ],
    howToRun: ["매일 밤 한 플레이어에 저주 표식을 놓고, 다음 낮 그가 지목하면 사망을 선언합니다."],
    examples: [
      ["마녀가 현자를 저주합니다. 다음 날 현자가 꿈꾸는 자를 지목하면 죽습니다. 꿈꾸는 자에 대한 투표는 여전히 진행됩니다.", "rust-regression"],
      ["마녀가 자신을 저주하고 다음 날 악마를 지목하면 죽습니다. 처형 투표는 일어나지 않습니다.", "rust-regression"],
      ["마녀가 얼뜨기를 저주합니다. 그날 밤 팡 구가 얼뜨기를 공격합니다. 새로운 팡 구는 저주 상태로 남아 지목하면 죽습니다.", "json-acceptance", true],
      ["마녀가 백치천재를 저주합니다. 그날 밤 늦게 악마가 죽인 후 3명의 플레이어만 남습니다. 저주가 해제됩니다.", "rust-regression"],
      ["마녀가 곡예사를 저주합니다. 곡예사가 여행자 추방을 요청합니다. 곡예사는 살아남고 다시 지목할 수 있습니다. 추방은 지목이 아닙니다.", "out-of-scope", true],
    ],
    reminders: [reminder("저주", 1, "다음 낮 지목하면 죽는 플레이어를 표시합니다.")],
  }),
  characterRules({
    id: "cerenovus", ownerIssue: 105, revision: 3048,
    rulings: [
      "매일 밤 플레이어와 주민·외지인 하나를 골라, 다음 낮 실제로 그 캐릭터라고 그룹을 설득하도록 집착시킵니다.",
      "충분히 노력하지 않으면 이야기꾼이 처형할 수 있지만 의무는 아니며, 이 처형은 하루의 처형으로 계산됩니다.",
    ],
    howToRun: ["선택한 플레이어에 집착 표식을 놓고 그를 깨워 세레노버스와 집착해야 할 캐릭터를 보여준 뒤, 다음 날 노력하지 않으면 처형할 수 있습니다."],
    examples: [
      ["세레노버스가 이발사에게 백치천재인 척 집착하게 합니다. 다음 날 이발사는 백치천재라고 주장하고, 이야기꾼과 대화하고, 지어낸 두 가지 사실을 그룹에 말합니다. 집착하느냐고 물으면 이발사는 강하게 \"아니오\"라고 말하여 처형을 피합니다.", "manual-acceptance"],
      ["죽은 화가가 현자인 척 집착하게 됩니다. 다음 날 현자에 대해 아무 말도 하지 않습니다. 화가가 처형됩니다.", "manual-acceptance"],
      ["세레노버스가 꽃팔이 소녀에게 시계공인 척 집착하게 합니다. 꽃팔이 소녀는 그룹에 시계공이며 \"2\"를 알았다고 말하지만, 다른 플레이어들에게 비밀리에 집착 중이라고 암시합니다. 이야기꾼이 이를 듣고 꽃팔이 소녀를 처형합니다.", "manual-acceptance"],
    ],
    reminders: [reminder("집착", 1, "세레노버스가 특정 선한 캐릭터라고 집착시킨 플레이어를 표시합니다.")],
  }),
  characterRules({
    id: "pitHag", ownerIssue: 104, revision: 2998,
    rulings: [
      "첫째 밤 이후 플레이어와 현재 게임에 없는 캐릭터를 골라 그 플레이어의 캐릭터만 바꾸며 진영은 유지합니다.",
      "악마를 만들면 그 밤의 사망은 이야기꾼이 임의로 정하고, 선이 이기려면 모든 살아 있는 악마가 죽어야 합니다.",
    ],
    howToRun: ["선택한 캐릭터가 게임에 없으면 대상의 토큰을 교체하고 새 캐릭터를 알립니다. 악마가 생기면 그 밤의 사망 또는 생존을 균형에 맞게 임의로 결정합니다."],
    examples: [
      ["마귀할멈이 시계공을 변종으로 변신시킵니다.", "rust-regression"],
      ["마귀할멈이 백치천재를 현자로 변신시키려 하지만 현자가 이미 게임에 있어서 아무 일도 일어나지 않습니다.", "rust-regression"],
      ["마귀할멈이 꽃팔이 소녀를 사악한 쌍둥이로 변신시킵니다. 이제 선한 사악한 쌍둥이가 있으므로, 사악한 쌍둥이와 악한 플레이어가 깨어나 서로의 캐릭터를 알게 됩니다.", "json-acceptance", true],
      ["마지막 밤에 마귀할멈이 예언자를 선한 노 다시로 변신시킵니다. 이야기꾼은 악한 악마만 죽여서 마지막 날에 악마가 한 명만 살아있게 합니다.", "json-acceptance", true],
    ],
  }),
  characterRules({
    id: "fangGu", ownerIssue: 112, revision: 2974, setup: true,
    rulings: [
      "처음 공격으로 외지인을 실제 죽이려 할 때 기존 팡 구가 대신 죽고, 외지인이 살아 있는 악한 팡 구가 됩니다.",
      "이 교환은 게임당 한 번뿐이며 새 팡 구는 하수인 정보를 받지 않습니다. 외지인이 죽지 않으면 교환도 일어나지 않습니다.",
    ],
    howToRun: ["준비 때 주민 하나를 외지인으로 바꿉니다. 첫 살아 있는 외지인이 이 능력으로 죽으려 하면 그 외지인을 악한 팡 구로 바꾸고 기존 팡 구를 대신 사망시킨 뒤, 마도서 중앙에 한 번 표식을 놓습니다."],
    examples: [
      ["팡 구가 화가를 공격하고 화가가 죽습니다. 다음 밤 팡 구가 사랑꾼을 공격하고 사랑꾼이 팡 구가 되면서 기존 팡 구가 죽습니다. 사랑꾼이 죽지 않았으므로 플레이어를 취하게 만들지 않습니다. 다음 밤 새 팡 구가 얼뜨기를 공격하고 얼뜨기가 죽습니다.", "json-acceptance", true],
    ],
    reminders: [
      reminder("사망", 1, "팡 구의 공격으로 죽은 플레이어를 표시합니다."),
      reminder("한 번", 1, "외지인에게 팡 구가 이전한 게임당 한 번 효과를 표시합니다."),
    ],
  }),
  characterRules({
    id: "vigormortis", ownerIssue: 110, revision: 3015, setup: true,
    rulings: [
      "비고르모르티스가 직접 죽인 하수인은 비고르모르티스가 능력을 가진 동안 죽어 있어도 능력을 유지합니다.",
      "그 하수인 양쪽에서 가장 가까운 주민 중 이야기꾼이 고른 한 명은 생사와 무관하게 중독되며, 중간의 비주민은 건너뜁니다.",
    ],
    howToRun: ["준비 때 가능한 경우 외지인 하나를 주민으로 바꿉니다. 하수인을 공격하면 사망·능력 있음 표식을 놓고 양쪽 최근접 주민 중 하나에 중독 표식을 놓습니다."],
    examples: [
      ["비고르모르티스가 마녀를 죽입니다. 마녀가 오늘 밤 저주한 플레이어는 저주 상태로 남습니다. 다음 날 저주받은 플레이어가 지목하면 죽습니다.", "json-acceptance", true],
      ["비고르모르티스가 사악한 쌍둥이를 죽입니다. 사악한 쌍둥이의 이웃은 얼뜨기와 꽃팔이 소녀이고, 현자는 얼뜨기 너머의 다음 주민입니다. 이야기꾼이 현자가 중독된다고 선택합니다.", "json-acceptance", true],
      ["비고르모르티스가 마귀할멈을 죽입니다. 마귀할멈이 백치천재를 마녀로 바꿉니다. 비고르모르티스가 마녀를 죽이고, 마녀는 플레이어를 저주하여 죽입니다. 마귀할멈이 죽은 마녀를 예언자로 바꾸면 이제 능력이 없습니다. 마귀할멈이 비고르모르티스를 보르톡스로 바꾸면 마귀할멈도 이제 능력이 없습니다.", "json-acceptance", true],
    ],
    reminders: [
      reminder("사망", 1, "비고르모르티스의 공격으로 죽은 플레이어를 표시합니다."),
      reminder("능력 있음", 3, "비고르모르티스가 죽여도 능력을 유지하는 하수인을 표시합니다."),
      reminder("중독", 3, "능력을 유지하는 죽은 하수인 때문에 중독된 주민을 표시합니다."),
    ],
  }),
  characterRules({
    id: "noDashii", ownerIssue: 110, revision: 2950,
    rulings: [
      "노 다시 양쪽에서 가장 가까운 주민 한 명씩은 생사와 무관하게 중독되고, 중간의 외지인·하수인·여행자는 건너뜁니다.",
      "노 다시 또는 주변 캐릭터가 바뀌면 새 최근접 주민에게 중독 표식을 즉시 옮깁니다.",
    ],
    howToRun: ["준비 때 양쪽 최근접 주민에 중독 표식을 놓고, 관계가 바뀔 때 표식을 이동합니다. 첫째 밤 이후 선택한 플레이어를 죽입니다."],
    examples: [
      ["게임 시작 시 노 다시의 이웃은 포고꾼과 뱀 조련사입니다. 둘 다 중독됩니다. 며칠 후 둘 다 죽어도, 노 다시에게 가장 가까운 살아있는 이웃인 시계공과 이발사는 중독되지 않습니다.", "rust-regression"],
      ["노 다시의 시계 방향으로 철학자, 수학자, 현자가 앉아 있습니다. 반시계 방향으로 마녀, 변종, 재봉사가 앉아 있습니다. 철학자와 재봉사가 중독됩니다.", "rust-regression"],
    ],
    reminders: [
      reminder("사망", 1, "노 다시의 공격으로 죽은 플레이어를 표시합니다."),
      reminder("중독", 2, "노 다시 양쪽의 가장 가까운 주민을 표시합니다."),
    ],
  }),
  characterRules({
    id: "vortox", ownerIssue: 109, revision: 3017,
    rulings: [
      "보르톡스가 능력을 가진 동안 주민 능력으로 얻는 모든 정보는, 주민이 취하거나 중독되어도 반드시 거짓이어야 합니다.",
      "규칙 설명이나 캐릭터·진영 변경처럼 다른 출처의 정보에는 영향을 주지 않고, 황혼까지 아무도 처형되지 않으면 악이 승리합니다. 추방은 처형이 아닙니다.",
    ],
    howToRun: ["모든 주민 능력 정보가 거짓이 되게 처리하고, 첫째 밤 이후 대상을 죽입니다. 매 황혼 그날 처형이 없으면 악의 승리를 선언합니다."],
    examples: [
      ["보르톡스가 현자를 죽입니다. 현자는 두 플레이어를 알게 되지만 둘 다 악마가 아닙니다.", "json-acceptance", true],
      ["오늘 아무도 투표하거나 지목하지 않았지만 변종이 처형됩니다. 그 밤 꽃팔이 소녀와 포고꾼 둘 다 \"예\"를 알게 됩니다.", "json-acceptance", true],
      ["백치천재가 게임에 있고 매일 두 가지 정보를 얻습니다. 둘 다 거짓입니다. 그 밤 꿈꾸는 자가 백치천재인 플레이어를 선택하고, 그 플레이어가 철학자이거나 노 다시라고 알게 됩니다.", "json-acceptance", true],
      ["마귀할멈이 곡예사를 마녀로 변신시킵니다. 곡예사는 이제 선한 마녀라는 것을 알게 됩니다. 이 정보는 주민 능력이 아니라 마귀할멈의 능력에서 오기 때문입니다.", "json-acceptance", true],
      ["오늘 마녀로 인해 플레이어가 죽었고, 여행자 2명이 추방되었으며, 지목이 5번 있었지만 아무도 처형되지 않았습니다. 악이 승리합니다.", "out-of-scope", true, travelerScopeReason],
    ],
    reminders: [reminder("사망", 1, "보르톡스의 공격으로 죽은 플레이어를 표시합니다.")],
  }),
];

export function sectsAndVioletsRulesFor(characterId: string) {
  return sectsAndVioletsCharacterRules.find((rules) => rules.id === characterId);
}
