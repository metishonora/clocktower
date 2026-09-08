import { deepEqual } from "node:assert/strict"; import test from "node:test"; import type { ReplayState } from "./types.js"; import { replayStateScriptReference } from "./scriptIdentity.js";


function replayState(scriptId: "troubleBrewing"): ReplayState {
  return {
    schemaVersion: 4,
    scriptId,
    eventCount: 0,
    phase: "setup",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
}
test("official replay identity retains its script", () => { deepEqual(replayStateScriptReference(replayState("troubleBrewing")), { type: "official", scriptId: "troubleBrewing" }); });
