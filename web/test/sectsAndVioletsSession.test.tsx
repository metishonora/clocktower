import { expect, test } from "vitest";
import type { GameEvent, GameFile, SectsAndVioletsSessionState } from "../src/core/types";
import {
  exportLatestSectsAndVioletsCheckpoint,
  removeLatestSectsAndVioletsPhaseCheckpoint,
  withSectsAndVioletsSession,
} from "../src/sectsAndVioletsSession";

test("exports only through the latest completed S&V phase checkpoint", () => {
  const game = sessionGame([event("setup", "setupConfirmed"), event("one"), event("draft")], [
    checkpoint("setup", "setup", 1),
    checkpoint("one", "phase", 2),
  ]);

  const exported = exportLatestSectsAndVioletsCheckpoint(game);

  expect(exported.game.events.map((candidate) => candidate.id)).toEqual(["setup", "one"]);
  expect(exported.ui?.sectsAndVioletsSession?.activeTab).toBe("play");
  expect(exported.ui?.sectsAndVioletsSession?.phaseCheckpoints).toHaveLength(2);
});

test("undo removes every event in the latest completed S&V phase group", () => {
  const game = sessionGame(
    [event("setup", "setupConfirmed"), event("a-1"), event("a-2"), event("b-1"), event("b-2")],
    [
      checkpoint("setup", "setup", 1),
      checkpoint("a", "phase", 3),
      checkpoint("b", "phase", 5),
    ],
  );

  const undone = removeLatestSectsAndVioletsPhaseCheckpoint(game);

  expect(undone?.removed.id).toBe("b");
  expect(undone?.gameFile.game.events.map((candidate) => candidate.id)).toEqual(["setup", "a-1", "a-2"]);
  expect(undone?.gameFile.ui?.sectsAndVioletsSession?.phaseCheckpoints.map((candidate) => candidate.id))
    .toEqual(["setup", "a"]);
});

function sessionGame(events: GameEvent[], phaseCheckpoints: SectsAndVioletsSessionState["phaseCheckpoints"]): GameFile {
  const gameFile: GameFile = {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "sv-test",
      name: "Sects & Violets",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      events,
    },
  };
  return withSectsAndVioletsSession(gameFile, {
    version: 1,
    activeTab: "storage",
    savedAt: "2026-07-22T00:00:00.000Z",
    setup: {
      playerCount: 7,
      demon: "fangGu",
      selectedIds: ["fangGu"],
      seatAssignments: {},
      seatAlignments: {},
      seatNames: {},
      rosterConfirmed: true,
      seatingConfirmed: true,
    },
    phaseCheckpoints,
  });
}

function checkpoint(id: string, kind: "setup" | "phase", eventCount: number) {
  return { id, kind, eventCount, summary: id, activeTab: kind === "setup" ? "seating" as const : "play" as const };
}

function event(id: string, type: "setupConfirmed" | "phaseStepConfirmed" = "phaseStepConfirmed"): GameEvent {
  return type === "setupConfirmed"
    ? {
        id,
        type,
        phase: "setup",
        payload: { players: [] },
        summary: id,
        createdAt: "2026-07-22T00:00:00.000Z",
      }
    : {
        id,
        type,
        phase: "firstNight",
        payload: { stepId: id, input: null },
        summary: id,
        createdAt: "2026-07-22T00:00:00.000Z",
      };
}
