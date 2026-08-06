import fs from "node:fs";
import { resolve } from "node:path";
import { initSync, propose, replay } from "../web/src/generated/clocktower_wasm/clocktower_wasm.js";

const root = resolve(import.meta.dirname, "..");
initSync({ module: fs.readFileSync(resolve(root, "web/src/generated/clocktower_wasm/clocktower_wasm_bg.wasm")) });
const output = resolve(root, "fixtures/acceptance/sects-and-violets");

function setup() {
  return { id: "setup-98", type: "setupConfirmed", phase: "setup", payload: { players: [
    ["player-1", 1, "Dreamer", "dreamer"], ["player-2", 2, "Seamstress", "seamstress"],
    ["player-3", 3, "Sage", "sage"], ["player-4", 4, "Clockmaker", "clockmaker"],
    ["player-5", 5, "Oracle", "oracle"], ["player-6", 6, "Evil Twin", "evilTwin"],
    ["player-7", 7, "Fang Gu", "fangGu"],
  ].map(([id, seat, name, actualCharacter]) => ({ id, seat, name, actualCharacter, shownCharacter: actualCharacter })) }, summary: "초기 설정 확정: 7명", createdAt: "2026-07-25T00:00:00.000Z" };
}

function game(events) {
  return { schemaVersion: 3, game: { id: "game-issue-98", name: "Issue 98 targeted information", scriptId: "sectsAndViolets", createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", events } };
}

function state(events) {
  const result = JSON.parse(replay(JSON.stringify(game(events))));
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value;
}

function append(events, command) {
  const result = JSON.parse(propose(JSON.stringify(game(events)), JSON.stringify(command)));
  if (!result.ok) throw new Error(JSON.stringify({ command, result }));
  events.push(result.value.event);
  return result.value;
}

function commandFor(step) {
  if (step.requiredInput.kind === "nomination") return { type: "skipStep", payload: { stepId: step.id } };
  if (step.requiredInput.kind === "executionDecision") return { type: "confirmStep", payload: { stepId: step.id, input: { execute: false } } };
  if (step.id.includes(":demon:")) return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: ["player-3"] } } };
  if (step.character === "dreamer") { const check = step.informationPrompt.targetChecks[0]; return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: check.targetPlayerIds }, deliveredResult: check.choices[0].result } }; }
  if (step.character === "seamstress") return { type: "skipStep", payload: { stepId: step.id } };
  if (step.support === "manual") return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

function advance(events, id) {
  for (let attempts = 0; attempts < 128; attempts += 1) {
    const step = state(events).currentStep;
    if (step?.id === id) return step;
    if (!step) throw new Error(`No current step before ${id}`);
    append(events, commandFor(step));
  }
  throw new Error(`Did not reach ${id}`);
}

const dreamerEvents = [setup()];
advance(dreamerEvents, "firstNight:dreamer");
append(dreamerEvents, { type: "confirmStep", payload: { stepId: "firstNight:dreamer", input: { playerIds: ["player-2"] }, deliveredResult: { kind: "characterPair", characterIds: ["seamstress", "evilTwin"] } } });

const seamstressEvents = structuredClone(dreamerEvents);
append(seamstressEvents, { type: "confirmStep", payload: { stepId: "firstNight:seamstress", input: { playerIds: ["player-1", "player-6"] } } });

const sageEvents = [setup()];
advance(sageEvents, "night:sage");
append(sageEvents, { type: "confirmStep", payload: { stepId: "night:sage", input: null, deliveredResult: { kind: "playerPair", playerIds: ["player-1", "player-7"] } } });

for (const [file, events] of [["issue-98-dreamer.json", dreamerEvents], ["issue-98-seamstress.json", seamstressEvents], ["issue-98-sage.json", sageEvents]]) {
  fs.writeFileSync(resolve(output, file), `${JSON.stringify(game(events), null, 2)}\n`);
}

const manifest = { schemaVersion: 1, script: "sectsAndViolets", issue: 98, cases: [
  { id: "issue-98-dreamer", characterId: "dreamer", file: "issue-98-dreamer.json", phaseBoundary: "firstNight:dreamer", deliveredResult: { kind: "characterPair", characterIds: ["seamstress", "evilTwin"] } },
  { id: "issue-98-seamstress", characterId: "seamstress", file: "issue-98-seamstress.json", phaseBoundary: "firstNight:seamstress", deliveredResult: { kind: "boolean", value: false } },
  { id: "issue-98-sage", characterId: "sage", file: "issue-98-sage.json", phaseBoundary: "night:sage", deliveredResult: { kind: "playerPair", playerIds: ["player-1", "player-7"] } },
] };
fs.writeFileSync(resolve(output, "issue-98-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
