import { expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { IndexedDbCustomWebSessionStorageDriver } from "../../src/custom/storage/sessionStorage.js";
import type { CustomScriptDefinition, SetupPlayerInput, PhaseStepInput, InformationResult, RegistrationJudgment, Command } from "../../src/custom/core/types.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";
export const definition: CustomScriptDefinition = {
  id: "snv-207-production", name: "SnV Production",
  characterIds: ["philosopher", "snakeCharmer", "evilTwin", "witch", "cerenovus", "clockmaker", "dreamer", "seamstress", "mathematician", "artist", "savant", "juggler", "sage", "recluse", "mutant", "scarletWoman", "imp", "noDashii", "vortox", "soldier", "mayor", "virgin"],
  firstNightOrder: [
    { kind: "system", actionId: "dusk" }, { kind: "system", actionId: "minionInfo" }, { kind: "system", actionId: "demonInfo" },
    { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
    { kind: "character", characterId: "evilTwin", actionId: "learnTwin" },
    { kind: "character", characterId: "witch", actionId: "chooseCursedPlayer" },
    { kind: "character", characterId: "cerenovus", actionId: "assignMadness" },
    { kind: "character", characterId: "snakeCharmer", actionId: "choosePlayer" },
    { kind: "character", characterId: "clockmaker", actionId: "learnSteps" },
    { kind: "character", characterId: "dreamer", actionId: "learnCharacters" },
    { kind: "character", characterId: "seamstress", actionId: "compareAlignments" },
    { kind: "character", characterId: "mathematician", actionId: "learnCount" },
    { kind: "system", actionId: "dawn" },
  ],
};
export async function createSession(roster: string[], script = definition, initialTwinTarget = "p1") {
  const players: SetupPlayerInput[] = roster.map((actualCharacter, i) => ({ id: `p${i + 1}`, seat: i + 1, name: `P${i + 1}`, actualCharacter }));
  const storage = new IndexedDbCustomWebSessionStorageDriver(script.id, new IDBFactory());
  const session = CustomCanonicalSession.create({ definition: script, core: realWasmCore(), storage, setupDraft: { players }, presentation: { activeTab: "play" }, gameId: script.id, now: new Date("2026-09-08T00:00:00.000Z") });
  const setup = await session.confirmSetup({ type: "createGame", payload: { players } });
  if (!setup.ok) throw new Error(`${setup.error.code}: ${setup.error.messageKo}`);
  if (roster.includes("evilTwin")) await take(session, "evilTwin", { playerIds: [initialTwinTarget] });
  await take(session, "minionInfo", null);
  await take(session, "demonInfo", { characterIds: ["soldier", "mayor", "virgin"] });
  return { session, storage };
}
export async function take(session: CustomCanonicalSession<unknown, unknown>, expected: string, input: PhaseStepInput, deliveredResult?: InformationResult, registrationJudgments?: RegistrationJudgment[]) {
  const state = await replayOrThrow(session.snapshot.canonical);
  const step = state.currentStep;
  if (!step) throw new Error(`Expected ${expected}, no step`);
  expect(step.character ?? step.actionRef?.actionId).toBe(expected);
  const command: Command = { type: "confirmStep", payload: { stepId: step.id, input, ...(deliveredResult ? { deliveredResult } : {}), ...(registrationJudgments ? { registrationJudgments } : {}) } };
  const executed = await session.execute(command);
  if (!executed.ok) throw new Error(`${executed.error.code}: ${executed.error.messageKo}`);
  expect(await executed.value.autosave).toBe(true);
  return executed.value;
}
