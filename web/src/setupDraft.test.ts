import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import {
  assignActualCharacter,
  characters,
  characterLabel,
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  drunkShownCharacterOptions,
  findOverlappingSeats,
  kindLabels,
  resetActualCharacters,
  resetSeatLayout,
  resizeSetupDraft,
  selectSeat,
  setSeatLayoutPreset,
  setDrunkShownCharacter,
  seatLayoutPositions,
  syncSetupDraftWithConfirmedPlayers,
  toCreateGamePlayers,
  unassignActualCharacter,
  updateSeatPosition,
} from "./setupDraft.js";

test("Trouble Brewing catalog uses the exact official Korean-edition character copy", () => {
  deepEqual(
    characters.map(({ id, label, kind, abilitySummary }) => ({ id, label, kind, abilitySummary })),
    [
      { id: "washerwoman", label: "세탁부", kind: "Townsfolk", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 주민임을 알게 됩니다." },
      { id: "librarian", label: "사서", kind: "Townsfolk", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 외지인임을 (또는 게임에 참여하는 외지인이 없음을) 알게 됩니다." },
      { id: "investigator", label: "수사관", kind: "Townsfolk", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 하수인임을 알게 됩니다." },
      { id: "chef", label: "요리사", kind: "Townsfolk", abilitySummary: "게임 시작 시, 서로 이웃하게 앉은 악한 플레이어가 몇 쌍 있는지 알게 됩니다." },
      { id: "empath", label: "초공감자", kind: "Townsfolk", abilitySummary: "매일 밤, 이웃 생존자 2명 중 몇 명이나 악한지를 알게 됩니다." },
      { id: "fortuneTeller", label: "점쟁이", kind: "Townsfolk", abilitySummary: "매일 밤, 플레이어 2명을 선택합니다: 그중 악마가 있는지 알게 됩니다. 단, 선한 플레이어 중 1명이 당신에게는 악마로 위장되어 보입니다." },
      { id: "undertaker", label: "장의사", kind: "Townsfolk", abilitySummary: "매일 밤*, 오늘 낮에 처형으로 사망한 플레이어의 캐릭터를 알게 됩니다." },
      { id: "monk", label: "수도사", kind: "Townsfolk", abilitySummary: "매일 밤*, (당신을 제외하고) 플레이어 1명을 선택합니다: 그는 오늘 밤 악마로부터 안전합니다." },
      { id: "ravenkeeper", label: "까마귀지기", kind: "Townsfolk", abilitySummary: "밤에 사망하면, 깨어나서 플레이어 1명을 선택합니다: 그의 캐릭터를 알게 됩니다." },
      { id: "virgin", label: "성결자", kind: "Townsfolk", abilitySummary: "처음으로 지목당했을 때, 당신을 지목한 플레이어가 주민이라면, 그는 즉시 처형당합니다." },
      { id: "slayer", label: "처단자", kind: "Townsfolk", abilitySummary: "게임당 1번, 낮 동안, 공개적으로 플레이어 1명을 선택합니다: 그가 악마면 그는 사망합니다." },
      { id: "soldier", label: "군인", kind: "Townsfolk", abilitySummary: "악마로부터 안전합니다." },
      { id: "mayor", label: "시장", kind: "Townsfolk", abilitySummary: "3명만 생존한 상황에서 처형이 일어나지 않았다면, 당신이 속한 팀이 승리합니다. 밤에 사망한다면, 그 대신 다른 플레이어 1명이 사망할 수도 있습니다." },
      { id: "butler", label: "집사", kind: "Outsider", abilitySummary: "매일 밤, (당신을 제외하고) 플레이어 1명을 선택합니다: 다음 날, 그가 투표에 참여한 경우에만 당신도 투표에 참여할 수 있습니다." },
      { id: "drunk", label: "주정뱅이", kind: "Outsider", abilitySummary: "당신은 자신이 주정뱅이라는 사실을 모릅니다. 대신 다른 주민 캐릭터라고 착각하지만, 실제로는 주정뱅이입니다." },
      { id: "recluse", label: "은둔자", kind: "Outsider", abilitySummary: "당신은 악한 팀 소속의 특정 하수인 또는 악마로 위장될 수도 있습니다(사망한 상태에서도)." },
      { id: "saint", label: "성자", kind: "Outsider", abilitySummary: "당신이 처형으로 사망하면, 당신이 속한 팀이 패배합니다." },
      { id: "poisoner", label: "독살범", kind: "Minion", abilitySummary: "매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다." },
      { id: "spy", label: "첩자", kind: "Minion", abilitySummary: "매일 밤, 마도서를 확인해 봅니다. 당신은 선한 팀 소속의 특정 주민 또는 외지인으로 위장될 수도 있습니다(사망한 상태에서도)." },
      { id: "scarletWoman", label: "탕녀", kind: "Minion", abilitySummary: "플레이어가 5명 이상(여행자는 세지 않음) 생존해 있는 상황에서 악마가 사망하면, 당신이 악마가 됩니다." },
      { id: "baron", label: "남작", kind: "Minion", abilitySummary: "외지인이 추가로 게임에 참여합니다. [외지인 +2명]" },
      { id: "imp", label: "임프", kind: "Demon", abilitySummary: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 이 방법으로 자결하면, 하수인 1명이 임프가 됩니다." },
    ],
  );
  deepEqual(kindLabels, {
    Townsfolk: "주민",
    Outsider: "외지인",
    Minion: "하수인",
    Demon: "악마",
  });
  equal(characterLabel("scarletWoman"), "탕녀");
});

test("assigning an unused Actual Character updates only the selected Player", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "washerwoman", 1);
  draft = assignActualCharacter(selectSeat(draft, 2), "librarian");

  equal(draft.selectedSeat, 2);
  equal(draft.players[0].actualCharacter, "washerwoman");
  equal(draft.players[1].actualCharacter, "librarian");
  equal(draft.players[2].actualCharacter, undefined);
});

test("assigning a used Actual Character unassigns the previous Player", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "washerwoman", 1);
  draft = assignActualCharacter(draft, "washerwoman", 2);

  equal(draft.players[0].actualCharacter, undefined);
  equal(draft.players[0].shownCharacter, undefined);
  equal(draft.players[1].actualCharacter, "washerwoman");
});

test("unassigned Players prevent createGame payload creation", () => {
  const draft = assignActualCharacter(createSetupDraft(), "washerwoman", 1);

  equal(toCreateGamePlayers(draft.players), undefined);
});

test("non-Drunk Players omit Shown Character from draft createGame input", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "washerwoman", 1);
  draft = assignActualCharacter(draft, "librarian", 2);
  draft = assignActualCharacter(draft, "investigator", 3);
  draft = assignActualCharacter(draft, "poisoner", 4);
  draft = assignActualCharacter(draft, "imp", 5);

  const players = toCreateGamePlayers(draft.players);

  equal(players?.[0].actualCharacter, "washerwoman");
  equal(players?.[0].shownCharacter, undefined);
});

test("Drunk can store a Townsfolk Shown Character different from Actual Character", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "drunk", 1);
  draft = setDrunkShownCharacter(draft, "chef", 1);

  equal(draft.players[0].actualCharacter, "drunk");
  equal(draft.players[0].shownCharacter, "chef");
});

test("Drunk Shown Character choices are constrained to Townsfolk", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "drunk", 1);
  draft = setDrunkShownCharacter(draft, "imp", 1);

  deepEqual(
    drunkShownCharacterOptions().map((character) => character.id),
    [
      "washerwoman",
      "librarian",
      "investigator",
      "chef",
      "empath",
      "fortuneTeller",
      "undertaker",
      "monk",
      "ravenkeeper",
      "virgin",
      "slayer",
      "soldier",
      "mayor",
    ],
  );
  equal(draft.players[0].shownCharacter, undefined);
  equal(toCreateGamePlayers(draft.players), undefined);
});

test("confirmed setup Players can be restored into an editable setup draft", () => {
  const draft = createSetupDraftFromConfirmedPlayers([
    {
      seat: 2,
      name: "Bert",
      actualCharacter: "washerwoman",
      shownCharacter: "washerwoman",
    },
    {
      seat: 1,
      name: "Ada",
      actualCharacter: "drunk",
      shownCharacter: "chef",
    },
  ]);

  equal(draft.selectedSeat, 1);
  equal(draft.players[0].name, "Ada");
  equal(draft.players[0].actualCharacter, "drunk");
  equal(draft.players[0].shownCharacter, "chef");
  equal(draft.players[1].actualCharacter, "washerwoman");
  equal(draft.players[1].shownCharacter, undefined);
  deepEqual(draft.seatPositions, seatLayoutPositions(2, "circle"));
});

test("confirmed Players sync into the seating draft after load or import", () => {
  let draft = createSetupDraft(5);
  draft = setSeatLayoutPreset(draft, "longTable");
  draft = updateSeatPosition(draft, 2, { x: 44, y: 55 });

  const synced = syncSetupDraftWithConfirmedPlayers(draft, [
    {
      seat: 1,
      name: "Ada",
      actualCharacter: "washerwoman",
      shownCharacter: "washerwoman",
    },
    {
      seat: 2,
      name: "Bert",
      actualCharacter: "drunk",
      shownCharacter: "chef",
    },
    {
      seat: 3,
      name: "Cy",
      actualCharacter: "imp",
      shownCharacter: "imp",
    },
  ]);

  equal(synced.players.length, 3);
  equal(synced.players[1].name, "Bert");
  equal(synced.players[1].shownCharacter, "chef");
  equal(synced.seatLayoutPreset, "longTable");
  deepEqual(synced.seatPositions, seatLayoutPositions(3, "longTable"));
});

test("confirmed Player sync preserves manually adjusted matching seats", () => {
  let draft = createSetupDraft(5);
  draft = updateSeatPosition(draft, 2, { x: 44, y: 55 });

  const synced = syncSetupDraftWithConfirmedPlayers(draft, [
    {
      seat: 1,
      name: "Ada",
      actualCharacter: "washerwoman",
      shownCharacter: "washerwoman",
    },
    {
      seat: 2,
      name: "Bert",
      actualCharacter: "librarian",
      shownCharacter: "librarian",
    },
    {
      seat: 3,
      name: "Cy",
      actualCharacter: "poisoner",
      shownCharacter: "poisoner",
    },
    {
      seat: 4,
      name: "Dee",
      actualCharacter: "baron",
      shownCharacter: "baron",
    },
    {
      seat: 5,
      name: "Eli",
      actualCharacter: "imp",
      shownCharacter: "imp",
    },
  ]);

  deepEqual(synced.seatPositions[2], { x: 44, y: 55 });
});

test("unassigning clears Actual and Drunk Shown Character together", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "drunk", 1);
  draft = setDrunkShownCharacter(draft, "chef", 1);
  draft = unassignActualCharacter(draft, 1);

  equal(draft.players[0].actualCharacter, undefined);
  equal(draft.players[0].shownCharacter, undefined);
});

test("resetting assignments preserves names and selected seat", () => {
  let draft = createSetupDraft();
  draft = assignActualCharacter(draft, "drunk", 1);
  draft = setDrunkShownCharacter(draft, "chef", 1);
  draft = assignActualCharacter(draft, "imp", 2);
  draft = selectSeat(draft, 2);

  const reset = resetActualCharacters(draft);

  equal(reset.selectedSeat, 2);
  equal(reset.players[0].name, "플레이어 1");
  equal(reset.players[0].actualCharacter, undefined);
  equal(reset.players[0].shownCharacter, undefined);
  equal(reset.players[1].actualCharacter, undefined);
});

test("default seat layout starts at upper right and proceeds clockwise", () => {
  const positions = createSetupDraft(7).seatPositions;

  equal(positions[1].x > 50, true);
  equal(positions[1].y < 50, true);
  equal(positions[2].x > positions[1].x, true);
  equal(positions[2].y > positions[1].y, true);
});

test("seat layout presets keep clockwise seat order from upper right", () => {
  const longTable = seatLayoutPositions(7, "longTable");
  const horseshoe = seatLayoutPositions(7, "horseshoe");

  deepEqual(longTable[1], { x: 82, y: 18 });
  equal(longTable[2].x, 82);
  equal(longTable[2].y > longTable[1].y, true);
  equal(longTable[5].x, 18);
  equal(longTable[5].y > longTable[6].y, true);

  deepEqual(horseshoe[1], { x: 82, y: 18 });
  equal(horseshoe[2].x, 82);
  equal(horseshoe[2].y > horseshoe[1].y, true);
  equal(horseshoe[4].y, 82);
});

test("Storyteller can choose a preset and manually adjust a seat position", () => {
  let draft = createSetupDraft(7);
  draft = setSeatLayoutPreset(draft, "longTable");
  draft = updateSeatPosition(draft, 2, { x: 200, y: -10 });

  equal(draft.seatLayoutPreset, "longTable");
  deepEqual(draft.seatPositions[1], { x: 82, y: 18 });
  deepEqual(draft.seatPositions[2], { x: 92, y: 12 });
});

test("resetting seat layout restores automatic circle positions", () => {
  let draft = createSetupDraft(7);
  draft = setSeatLayoutPreset(draft, "horseshoe");
  draft = updateSeatPosition(draft, 1, { x: 40, y: 40 });

  const reset = resetSeatLayout(draft);

  equal(reset.seatLayoutPreset, "circle");
  deepEqual(reset.seatPositions, seatLayoutPositions(7, "circle"));
});

test("automatic 11 Player circle layout does not report overlapping seats", () => {
  deepEqual(Array.from(findOverlappingSeats(seatLayoutPositions(11, "circle"))), []);
});

test("seat overlap detection still flags manually crowded seats", () => {
  deepEqual(
    Array.from(
      findOverlappingSeats({
        1: { x: 50, y: 50 },
        2: { x: 58, y: 58 },
        3: { x: 82, y: 18 },
      }),
    ),
    [1, 2],
  );
});

test("resizing preserves manually adjusted existing seat positions", () => {
  let draft = createSetupDraft(7);
  draft = setSeatLayoutPreset(draft, "longTable");
  draft = updateSeatPosition(draft, 2, { x: 44, y: 55 });

  const resized = resizeSetupDraft(draft, 8);

  equal(resized.seatLayoutPreset, "longTable");
  deepEqual(resized.seatPositions[1], draft.seatPositions[1]);
  deepEqual(resized.seatPositions[2], { x: 44, y: 55 });
  deepEqual(resized.seatPositions[8], seatLayoutPositions(8, "longTable")[8]);
});
