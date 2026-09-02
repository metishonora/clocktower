import { deepEqual, equal, throws } from "node:assert/strict";
import test from "node:test";
import { badMoonRisingCharacters } from "./badMoonRisingCharacters.js";
import {
  customScriptCharacters,
  customScriptCharacterKind,
  isCustomScriptCharacter,
  resolveCustomScriptDefinition,
} from "./customScriptRegistry.js";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters.js";
import { characters } from "./setupDraft.js";

test("builds the exact unique TB and S&V custom allowlist with canonical kinds", () => {
  equal(customScriptCharacters.length, 47);
  equal(new Set(customScriptCharacters.map(({ id }) => id)).size, 47);
  deepEqual(
    customScriptCharacters.map(({ id }) => id),
    [
      ...characters.map(({ id }) => id),
      ...sectsAndVioletsCharacters.map(({ id }) => id),
    ],
  );
  equal(customScriptCharacterKind("imp"), "Demon");
  equal(customScriptCharacterKind("clockmaker"), "Townsfolk");
});

test("keeps non-canonical and BMR IDs outside the custom allowlist", () => {
  equal(isCustomScriptCharacter("imp"), true);
  equal(isCustomScriptCharacter("Imp"), false);
  equal(isCustomScriptCharacter("futureCharacter"), false);
  for (const { id } of badMoonRisingCharacters) {
    equal(isCustomScriptCharacter(id), false, id);
  }
});

test("resolves supported definitions without changing order and rejects unsupported IDs", () => {
  const definition = {
    id: "custom-registry-contract",
    name: "Registry contract",
    characterIds: ["imp", "clockmaker", "washerwoman"],
  };

  deepEqual(resolveCustomScriptDefinition(definition), definition);
  deepEqual(resolveCustomScriptDefinition({ ...definition, characterIds: [] }), {
    ...definition,
    characterIds: [],
  });
  for (const characterId of ["Imp", "futureCharacter", "grandmother"]) {
    throws(
      () => resolveCustomScriptDefinition({ ...definition, characterIds: ["imp", characterId] }),
    );
  }
});
