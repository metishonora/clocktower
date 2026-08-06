import assert from "node:assert/strict";
import test from "node:test";
import { withExpectedEventCount } from "./streamVersion.js";
import type { GameFile } from "./types.js";

const gameFile = {
  schemaVersion: 3,
  game: {
    id: "game",
    name: "S&V",
    scriptId: "sectsAndViolets",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    events: [{ id: "one" }, { id: "two" }],
  },
} as GameFile;

test("phase mutations receive the current stream version at the core boundary", () => {
  for (const command of [
    { type: "confirmStep", payload: { stepId: "night:start", input: null } },
    { type: "skipStep", payload: { stepId: "day:nomination:1" } },
    {
      type: "resolveManualStep",
      payload: { stepId: "firstNight:snakeCharmer", outcome: "handled" },
    },
  ] as const) {
    const versioned = withExpectedEventCount(gameFile, command);
    assert.ok(
      versioned.type === "confirmStep" ||
        versioned.type === "skipStep" ||
        versioned.type === "resolveManualStep",
    );
    assert.equal(versioned.payload.expectedEventCount, 2);
  }
});

test("an explicitly captured stream version is not replaced", () => {
  const command = {
    type: "confirmStep" as const,
    payload: { stepId: "night:start", input: null, expectedEventCount: 1 },
  };
  assert.equal(withExpectedEventCount(gameFile, command), command);
});
