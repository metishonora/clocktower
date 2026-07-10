import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import {
  assignActualCharacter,
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  drunkShownCharacterOptions,
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
