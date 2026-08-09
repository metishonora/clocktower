import assert from "node:assert/strict";
import test from "node:test";
import { characters } from "./setupDraft.js";
import { troubleBrewingCharacterDetail } from "./characterDetails.js";
import { scriptTokens } from "./features/grimoire/playerAnnotations.js";
import {
  TROUBLE_BREWING_COLLECTION_SOURCE_URL,
  troubleBrewingCharacterMatrix,
  troubleBrewingCharacterMatrixFor,
  troubleBrewingReminderInventory,
} from "./troubleBrewingCharacterMatrix.js";

const expectedReminderInventory = [
  ["butler", "master", "주인"],
  ["drunk", "isTheDrunk", "주정뱅이임"],
  ["fortuneTeller", "redHerring", "오답 대상"],
  ["imp", "dead", "사망"],
  ["investigator", "minion", "하수인"],
  ["investigator", "wrong", "오답"],
  ["librarian", "outsider", "외지인"],
  ["librarian", "wrong", "오답"],
  ["monk", "safe", "안전"],
  ["poisoner", "poisoned", "중독"],
  ["scarletWoman", "isTheDemon", "악마임"],
  ["slayer", "noAbility", "능력 없음"],
  ["undertaker", "diedToday", "오늘 사망"],
  ["virgin", "noAbility", "능력 없음"],
  ["washerwoman", "townsfolk", "주민"],
  ["washerwoman", "wrong", "오답"],
];

test("Trouble Brewing matrix covers the complete official character set", () => {
  assert.deepEqual(
    troubleBrewingCharacterMatrix.map((entry) => entry.id),
    characters.map((character) => character.id),
  );

  for (const character of characters) {
    const entry = troubleBrewingCharacterMatrixFor(character.id);
    assert.ok(entry, `${character.id} matrix entry missing`);
    for (const field of ["input", "result", "duration", "removal", "lifecycle"] as const) {
      assert.ok(entry[field].trim(), `${character.id} ${field} missing`);
    }
    assert.ok(Array.isArray(entry.reminders), `${character.id} reminder inventory missing`);
    assert.equal(entry.source.checkedAt, "2026-08-09");
    assert.equal(entry.source.collectionUrl, TROUBLE_BREWING_COLLECTION_SOURCE_URL);
    assert.match(entry.source.url, /^https:\/\/wiki\.bloodontheclocktower\.com\//);
  }
});

test("Trouble Brewing reminder inventory records the official collection source", () => {
  assert.equal(
    TROUBLE_BREWING_COLLECTION_SOURCE_URL,
    "https://bloodontheclocktower.com/collections/trouble-brewing-reminder-tokens",
  );
});

test("Trouble Brewing reminder inventory has exactly the official physical tokens", () => {
  assert.deepEqual(
    troubleBrewingReminderInventory.map(({ characterId, tokenId, label }) => [characterId, tokenId, label]),
    expectedReminderInventory,
  );
  assert.ok(troubleBrewingReminderInventory.every((reminder) => reminder.count === 1));
  assert.equal(
    troubleBrewingReminderInventory.reduce((total, reminder) => total + reminder.count, 0),
    16,
  );

  const matrixInventory = troubleBrewingCharacterMatrix
    .flatMap((entry) => entry.reminders)
    .map(({ characterId, tokenId, label, count }) => `${characterId}:${tokenId}:${label}:${count}`)
    .sort();
  const catalogInventory = troubleBrewingReminderInventory
    .map(({ characterId, tokenId, label, count }) => `${characterId}:${tokenId}:${label}:${count}`)
    .sort();
  assert.deepEqual(matrixInventory, catalogInventory);

  for (const entry of troubleBrewingCharacterMatrix) {
    if (!troubleBrewingReminderInventory.some((reminder) => reminder.characterId === entry.id)) {
      assert.deepEqual(entry.reminders, [], `${entry.id} must not invent a physical reminder`);
    }
  }
});

test("details and manual script tokens expose the same canonical reminder inventory", () => {
  for (const [characterId, tokenId, label] of expectedReminderInventory) {
    const detail = troubleBrewingCharacterDetail(characterId);
    assert.ok(detail, `${characterId} detail missing`);
    assert.ok(detail.reminders.some((reminder) => reminder.label === label));
    assert.ok(scriptTokens.some((token) => (
      token.characterId === characterId && token.tokenId === tokenId && token.label === label
    )));
  }

  assert.deepEqual(
    scriptTokens.map(({ characterId, tokenId, label }) => [characterId, tokenId, label]),
    expectedReminderInventory,
  );
});
