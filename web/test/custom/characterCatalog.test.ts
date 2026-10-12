import { otherOrderFor } from './otherNightFixture.js';
import baseline from "../../../fixtures/acceptance/custom-first-night/compatibility/catalog.json" with {type: "json"};
import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "vitest";
import {
  customScriptCharacters,
  customScriptCharacterKind,
  isCustomScriptCharacter,
  resolveCustomScriptDefinition,
} from "../../src/custom/characterCatalog.js";

const SYSTEM_ONLY_FIRST_NIGHT_ORDER = [
  { kind: "system" as const, actionId: "dusk" as const },
  { kind: "system" as const, actionId: "minionInfo" as const },
  { kind: "system" as const, actionId: "demonInfo" as const },
  { kind: "system" as const, actionId: "dawn" as const },
];

test("builds the exact supported custom allowlist with canonical kinds", () => {
  equal(customScriptCharacters.length, 63);
  equal(new Set(customScriptCharacters.map(({ id }) => id)).size, 63);
  deepEqual(
    customScriptCharacters.map(({ id }) => id),
    [...baseline.map(({ id }) => id), 'noble', 'preacher', 'zealot', 'golem', 'nightwatchman', 'pixie', 'balloonist', 'boffin', 'marionette', 'chambermaid', 'fool', 'gambler', 'devilsAdvocate', 'assassin', 'grandmother', 'moonchild'],
  );
  equal(customScriptCharacterKind("imp"), "Demon");
  equal(customScriptCharacterKind("clockmaker"), "Townsfolk");
  equal(customScriptCharacterKind("zealot"), "Outsider");
});

test("keeps non-canonical and unsupported BMR IDs outside the custom allowlist", () => {
  equal(isCustomScriptCharacter('chambermaid'), true);
  equal(isCustomScriptCharacter("imp"), true);
  equal(isCustomScriptCharacter("Imp"), false);
  equal(isCustomScriptCharacter("futureCharacter"), false);
  for (const id of ["sailor", "exorcist", "innkeeper", "gossip", "courtier", "professor", "minstrel", "teaLady", "pacifist", "tinker", "goon", "lunatic", "godfather", "mastermind", "zombuul", "pukka", "shabaloth", "po"]) {
    equal(isCustomScriptCharacter(id), false, id);
  }
});

test("resolves supported definitions without changing order and rejects unsupported IDs", () => {
  const definition = { otherNightOrder: otherOrderFor(["imp", "clockmaker", "washerwoman"]),
    id: "custom-registry-contract",
    name: "Registry contract",
    characterIds: ["imp", "clockmaker", "washerwoman"],
    firstNightOrder: [
      SYSTEM_ONLY_FIRST_NIGHT_ORDER[0],
      { kind: "character" as const, characterId: "clockmaker", actionId: "learnSteps" },
      { kind: "character" as const, characterId: "washerwoman", actionId: "learnTownsfolk" },
      SYSTEM_ONLY_FIRST_NIGHT_ORDER[1],
      SYSTEM_ONLY_FIRST_NIGHT_ORDER[2],
      SYSTEM_ONLY_FIRST_NIGHT_ORDER[3],
    ],
  };

  deepEqual(resolveCustomScriptDefinition(definition), definition);
  deepEqual(resolveCustomScriptDefinition({
    ...definition, otherNightOrder: otherOrderFor([]),
    characterIds: [],
    firstNightOrder: SYSTEM_ONLY_FIRST_NIGHT_ORDER,
  }), {
    ...definition, otherNightOrder: otherOrderFor([]),
    characterIds: [],
    firstNightOrder: SYSTEM_ONLY_FIRST_NIGHT_ORDER,
  });
  for (const characterId of ["Imp", "futureCharacter", "sailor"]) {
    throws(
      () => resolveCustomScriptDefinition({ ...definition, characterIds: ["imp", characterId] }),
    );
  }
});
