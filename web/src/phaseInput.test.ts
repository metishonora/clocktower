import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { PhaseStep, Player } from "./core/types.js";
import {
  setupInfoCharacterOptions,
  setupInfoZeroOutsidersAvailable,
  stepInputReady,
} from "./features/phase-control/phaseInput.js";

test("setup information options use candidate Actual Characters in catalog order", () => {
  const roster = [
    player("saint", "saint"),
    player("drunk", "drunk", "chef"),
    player("drunk-copy", "drunk", "washerwoman"),
    player("chef", "chef"),
  ];

  deepEqual(
    setupInfoCharacterOptions("Outsider", ["saint", "drunk", "drunk-copy", "chef"], roster).map(
      (character) => character.id,
    ),
    ["drunk", "saint"],
  );
  deepEqual(
    setupInfoCharacterOptions("Townsfolk", ["drunk", "chef"], roster).map(
      (character) => character.id,
    ),
    ["chef"],
  );
});

test("zero Outsiders availability uses Actual Character and counts Drunk", () => {
  equal(setupInfoZeroOutsidersAvailable([player("chef", "chef")]), true);
  equal(setupInfoZeroOutsidersAvailable([player("drunk", "drunk", "librarian")]), false);
});

test("setup information readiness rejects stale zero-Outsider state", () => {
  const step: PhaseStep = {
    id: "firstNight:librarian",
    phase: "firstNight",
    stepType: "character",
    character: "librarian",
    playerId: "librarian",
    requiredInput: {
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      optional: false,
    },
    canSkip: false,
  };
  const nominationDraft = { nominatorId: "", nomineeId: "", voterIds: [] };

  equal(stepInputReady(step, 0, 0, "", nominationDraft, true, "", true), true);
  equal(stepInputReady(step, 0, 0, "", nominationDraft, true, "", false), false);
});

function player(id: string, actualCharacter: string, shownCharacter = actualCharacter): Player {
  return {
    id,
    seat: 1,
    name: id,
    actualCharacter,
    shownCharacter,
    alignment: "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    notes: "",
  };
}
