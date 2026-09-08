import { deepEqual, equal, throws } from "node:assert/strict";

import { test } from "vitest";

import {
  exportGameFileJson,
  parseGameFileJson,
} from "../../src/custom/storage/gameFile.js";


function customV4(characterIds: unknown = ["washerwoman", "clockmaker", "imp"]) {
  const ids = Array.isArray(characterIds)
    ? characterIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    schemaVersion: 4,
    game: {
      script: {
        type: "custom",
        definition: {
          id: "custom-stable-id",
          name: "Mixed roster",
          characterIds,
          firstNightOrder: firstNightOrderFor(ids),
        },
      },
      id: "custom-game",
      name: "Friday game",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      events: [],
    },
  };
}


test("round-trips the complete custom definition without reordering Characters", () => {
  const first = parseGameFileJson(JSON.stringify(customV4()));
  const exported = exportGameFileJson(first, new Date("2026-09-02T01:00:00.000Z"));
  const second = parseGameFileJson(exported);

  deepEqual(second.game.script, {
    type: "custom",
    definition: {
      id: "custom-stable-id",
      name: "Mixed roster",
      characterIds: ["washerwoman", "clockmaker", "imp"],
      firstNightOrder: firstNightOrderFor(["washerwoman", "clockmaker", "imp"]),
    },
  });
  equal(JSON.parse(exported).exportedAt, "2026-09-02T01:00:00.000Z");
});


test("accepts an empty custom Character list as a structural contract", () => {
  const parsed = parseGameFileJson(JSON.stringify(customV4([])));

  deepEqual(parsed.game.script, {
    type: "custom",
    definition: {
      id: "custom-stable-id",
      name: "Mixed roster",
      characterIds: [],
      firstNightOrder: firstNightOrderFor([]),
    },
  });
});


test("rejects unknown, case-different, and BMR Character IDs at Registry resolution", () => {
  for (const characterIds of [
    ["washerwoman", "futureCharacter", "imp"],
    ["imp", "Imp"],
    ["imp", "grandmother"],
  ]) {
    throws(() => parseGameFileJson(JSON.stringify(customV4(characterIds))));
  }
});


test("rejects malformed and versioned custom definitions", () => {
  const candidates = [
    customV4(["washerwoman", ""]),
    customV4(["washerwoman", 1]),
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: {
          type: "custom",
          definition: { id: " ", name: "Mixed roster", characterIds: [] },
        },
      },
    },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: {
          type: "custom",
          definition: { id: "custom-stable-id", name: "\n", characterIds: [] },
        },
      },
    },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: {
          type: "custom",
          definition: {
            id: "custom-stable-id",
            name: "Mixed roster",
            characterIds: [],
            revision: 1,
          },
        },
      },
    },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: {
          type: "custom",
          definition: {
            id: "custom-stable-id",
            name: "Mixed roster",
            characterIds: [],
            customScriptSchemaVersion: 1,
          },
        },
      },
    },
  ];

  for (const candidate of candidates) {
    throws(() => parseGameFileJson(JSON.stringify(candidate)));
  }
});


test("rejects duplicate custom Character IDs atomically", () => {
  throws(() => parseGameFileJson(JSON.stringify(customV4(["imp", "clockmaker", "imp"]))));
});


function firstNightOrderFor(characterIds: string[]) {
  const characterActions = [
    { characterId: "washerwoman", actionId: "learnTownsfolk" },
    { characterId: "clockmaker", actionId: "learnSteps" },
  ] as const;
  return [
    { kind: "system" as const, actionId: "dusk" as const },
    ...characterActions
      .filter(({ characterId }) => characterIds.includes(characterId))
      .map(({ characterId, actionId }) => ({ kind: "character" as const, characterId, actionId })),
    { kind: "system" as const, actionId: "minionInfo" as const },
    { kind: "system" as const, actionId: "demonInfo" as const },
    { kind: "system" as const, actionId: "dawn" as const },
  ];
}
