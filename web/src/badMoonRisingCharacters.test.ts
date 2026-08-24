import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import { badMoonRisingCharacters } from "./badMoonRisingCharacters.js";

test("registers the exact Bad Moon Rising character catalog", () => {
  deepEqual(
    badMoonRisingCharacters.map(({ id }) => id),
    [
      "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler",
      "gossip", "courtier", "professor", "minstrel", "teaLady", "pacifist", "fool",
      "tinker", "moonchild", "goon", "lunatic",
      "godfather", "devilsAdvocate", "assassin", "mastermind",
      "zombuul", "pukka", "shabaloth", "po",
    ],
  );
  equal(new Set(badMoonRisingCharacters.map(({ id }) => id)).size, 25);
  deepEqual(
    Object.fromEntries(
      ["townsfolk", "outsider", "minion", "demon"].map((kind) => [
        kind,
        badMoonRisingCharacters.filter((character) => character.kind === kind).length,
      ]),
    ),
    { townsfolk: 13, outsider: 4, minion: 4, demon: 4 },
  );
  equal(badMoonRisingCharacters.find(({ id }) => id === "lunatic")?.name, "미치광이");
});
