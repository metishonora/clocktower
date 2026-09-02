import { deepEqual, equal, throws } from "node:assert/strict";
import test from "node:test";
import {
  exportGameFileJson,
  parseGameFileJson,
} from "../gameStorage.js";

function officialV3(scriptId = "sectsAndViolets") {
  return {
    schemaVersion: 3,
    game: {
      scriptId,
      id: "official-game",
      name: "Official game",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      events: [],
    },
  };
}

function officialV4(scriptId: unknown) {
  return {
    schemaVersion: 4,
    game: {
      script: { type: "official", scriptId },
      id: "official-game",
      name: "Official game",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      events: [],
    },
  };
}

function customV4(characterIds: unknown = ["washerwoman", "clockmaker", "imp"]) {
  return {
    schemaVersion: 4,
    game: {
      script: {
        type: "custom",
        definition: {
          id: "custom-stable-id",
          name: "Mixed roster",
          characterIds,
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

test("normalizes script-less schema-v2 Trouble Brewing to the canonical schema-v4 reference", () => {
  const legacy = structuredClone(officialV3("troubleBrewing")) as unknown as {
    schemaVersion: number;
    game: Record<string, unknown>;
  };
  legacy.schemaVersion = 2;
  delete legacy.game.scriptId;

  const parsed = parseGameFileJson(JSON.stringify(legacy));

  equal(parsed.schemaVersion, 4);
  deepEqual(parsed.game.script, {
    type: "official",
    scriptId: "troubleBrewing",
  });
});

test("normalizes every schema-v3 official identity to the canonical schema-v4 reference", () => {
  for (const scriptId of ["troubleBrewing", "sectsAndViolets", "badMoonRising"] as const) {
    const parsed = parseGameFileJson(JSON.stringify(officialV3(scriptId)));

    equal(parsed.schemaVersion, 4);
    deepEqual(parsed.game.script, { type: "official", scriptId });
    equal("scriptId" in parsed.game, false);
  }
});

test("parses every raw schema-v4 official reference and rejects an unknown official ID", () => {
  for (const scriptId of ["troubleBrewing", "sectsAndViolets", "badMoonRising"] as const) {
    const parsed = parseGameFileJson(JSON.stringify(officialV4(scriptId)));
    deepEqual(parsed.game.script, { type: "official", scriptId });
  }

  throws(() => parseGameFileJson(JSON.stringify(officialV4("notOfficial"))));
});

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

test("rejects mixed, incomplete, and unknown schema-v4 script-reference arms", () => {
  const mixed = customV4() as ReturnType<typeof customV4> & {
    game: ReturnType<typeof customV4>["game"] & { scriptId: string };
  };
  mixed.game.scriptId = "troubleBrewing";

  const definition = customV4().game.script.definition;
  const candidates = [
    mixed,
    { ...customV4(), game: { ...customV4().game, script: { type: "official" } } },
    { ...customV4(), game: { ...customV4().game, script: { type: "custom" } } },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: { type: "official", scriptId: "troubleBrewing", definition },
      },
    },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: { type: "custom", scriptId: "troubleBrewing", definition },
      },
    },
    {
      ...customV4(),
      game: {
        ...customV4().game,
        script: { type: "unknown", scriptId: "troubleBrewing" },
      },
    },
  ];

  for (const candidate of candidates) {
    throws(() => parseGameFileJson(JSON.stringify(candidate)));
  }
});
