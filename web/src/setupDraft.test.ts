import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import {
  assignActualCharacter,
  createSetupDraft,
  drunkShownCharacterOptions,
  resetActualCharacters,
  selectSeat,
  setDrunkShownCharacter,
  toCreateGamePlayers,
  unassignActualCharacter,
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
