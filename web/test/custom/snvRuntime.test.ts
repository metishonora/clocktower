import { expect, it } from "vitest";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { parseGameEvent } from "../../src/custom/core/validation.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";
import { createSession, take } from "./snvSupport.js";

it("runs all nine Production handlers and simulation through real WASM, parser, session and IndexedDB", async () => {
  const { session, storage } = await createSession(["philosopher", "snakeCharmer", "clockmaker", "dreamer", "seamstress", "mathematician", "artist", "savant", "juggler", "recluse", "mutant", "evilTwin", "witch", "cerenovus", "noDashii"], undefined, "p2");
  const events = [];
  events.push((await take(session, "philosopher", { characterIds: ["seamstress"] })).proposal.event);
  events.push((await take(session, "evilTwin", null)).proposal.event);
  events.push((await take(session, "witch", { playerIds: ["p4"] })).proposal.event);
  const madness = await take(session, "cerenovus", { playerIds: ["p7"], characterId: "sage" }); events.push(madness.proposal.event);
  expect(madness.proposal.revealPayload).toEqual({ kind: "madnessAssignment", playerId: "p7", characterId: "sage" });
  events.push((await take(session, "snakeCharmer", { playerIds: ["p8"] })).proposal.event);
  const clock = await take(session, "clockmaker", null); events.push(clock.proposal.event);
  expect(clock.proposal.revealPayload).toEqual({ kind: "numericInformation", characterId: "clockmaker", value: 1 });
  const dream = await take(session, "dreamer", { playerIds: ["p7"] }, { kind: "characterPair", characterIds: ["artist", "witch"] }); events.push(dream.proposal.event);
  expect(dream.proposal.revealPayload).toEqual({ kind: "dreamerInformation", characterIds: ["artist", "witch"] });
  let state = await replayOrThrow(session.snapshot.canonical);
  expect(state.currentStep?.playerId).toBe("p1"); expect(state.currentStep?.abilityUse).toBeUndefined();
  events.push((await take(session, "seamstress", { playerIds: ["p3", "p4"] }, { kind: "boolean", value: false })).proposal.event);
  expect((await replayOrThrow(session.snapshot.canonical)).currentStep?.playerId).toBe("p5");
  events.push((await take(session, "seamstress", { playerIds: ["p3", "p4"] })).proposal.event);
  state = await replayOrThrow(session.snapshot.canonical);
  expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 1 });
  expect(state.currentStep?.informationPrompt?.mathematicianAudit?.records[0]).toMatchObject({ subjectPlayerId: "p1", characterId: "philosopher", abilityInstanceId: "setup:p1" });
  const math = await take(session, "mathematician", null); events.push(math.proposal.event);
  expect(math.proposal.revealPayload).toEqual({ kind: "numericInformation", characterId: "mathematician", value: 1 });
  for (const event of events) expect(parseGameEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  expect(new Set(events.flatMap(e => e.type === "customActionConfirmed" ? [e.payload.actionRef.characterId] : [])).size).toBe(9);
  await take(session, "dawn", null);
  const completed = await replayOrThrow(session.snapshot.canonical);
  expect(completed.phase).toBe("day"); expect(completed.ruleState.abilityGrants).toBeUndefined();
  expect(completed.ruleState.witchCurses).toHaveLength(1); expect(completed.madnessAssignments).toHaveLength(1);
  const loaded = await CustomCanonicalSession.load({ core: realWasmCore(), storage });
  if (loaded.status !== "loaded") throw new Error(loaded.status);
  expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(completed);
});

it("enforces the approved actual-truth Vortox policy through the TypeScript boundary", async () => {
  const { session } = await createSession(["seamstress", "artist", "savant", "juggler", "sage", "recluse", "scarletWoman", "vortox"]);
  const before = await replayOrThrow(session.snapshot.canonical);
  const payload = { stepId: before.currentStep!.id, input: { playerIds: ["p2", "p6"] }, registrationJudgments: [{ playerId: "p6", registeredAs: "evil" as const }] };
  expect((await session.execute({ type: "confirmStep", payload: { ...payload, deliveredResult: { kind: "boolean", value: true } } })).ok).toBe(false);
  expect(await replayOrThrow(session.snapshot.canonical)).toEqual(before);
  await take(session, "seamstress", payload.input, { kind: "boolean", value: false }, payload.registrationJudgments);
  expect((await replayOrThrow(session.snapshot.canonical)).players).toEqual(before.players);
});
