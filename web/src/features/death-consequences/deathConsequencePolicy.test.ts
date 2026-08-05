import { equal } from "node:assert/strict";
import test from "node:test";
import type { PendingDeathConsequence } from "../../core/types.js";
import { deathConsequenceCommand, deathConsequenceIsNoEffect } from "./deathConsequencePolicy.js";

function pending(overrides: Partial<PendingDeathConsequence>): PendingDeathConsequence {
  return {
    stepId: "night:death:death-1:1:barber",
    kind: "barber",
    sourceEventId: "death-1",
    deathSequence: 1,
    actorPlayerId: "player-2",
    sourceAbilityInstanceId: "setup:player-2",
    abilityUse: {
      ownerPlayerId: "player-2",
      characterId: "barber",
      abilityInstanceId: "setup:player-2",
    },
    abilityOrigin: { kind: "identityBound" },
    actorImpairedAtTrigger: false,
    allowedPlayerIds: ["player-1", "player-2"],
    eligibleChooserPlayerIds: ["player-7"],
    ...overrides,
  };
}

test("a healthy Barber trigger remains effective without resolution-time actor checks", () => {
  equal(deathConsequenceIsNoEffect(pending({})), false);
});

test("trigger impairment and Barber's missing living Demon are canonical no-effect cases", () => {
  equal(deathConsequenceIsNoEffect(pending({ kind: "klutz", actorImpairedAtTrigger: true })), true);
  equal(deathConsequenceIsNoEffect(pending({ eligibleChooserPlayerIds: [] })), true);
});

test("no-effect confirmations do not invent target, chooser, or decision data", () => {
  const sweetheart = deathConsequenceCommand(
    pending({ kind: "sweetheart", actorImpairedAtTrigger: true }), {}, 8,
  );
  const barber = deathConsequenceCommand(pending({ actorImpairedAtTrigger: true }), {}, 8);
  const klutz = deathConsequenceCommand(
    pending({ kind: "klutz", actorImpairedAtTrigger: true }), {}, 8,
  );
  equal(JSON.stringify(sweetheart), JSON.stringify({
    type: "resolveSweetheartConsequence",
    payload: { stepId: "night:death:death-1:1:barber", expectedEventCount: 8 },
  }));
  equal(JSON.stringify(barber), JSON.stringify({
    type: "resolveBarberConsequence",
    payload: { stepId: "night:death:death-1:1:barber", expectedEventCount: 8 },
  }));
  equal(JSON.stringify(klutz), JSON.stringify({
    type: "resolveKlutzConsequence",
    payload: { stepId: "night:death:death-1:1:barber", expectedEventCount: 8 },
  }));
});
