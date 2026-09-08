import { expect, it } from "vitest";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { CanonicalSessionController } from "../../src/custom/core/canonicalSessionController.js";
import { parseGameFileJson } from "../../src/custom/storage/gameFile.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";
import { createSession, take } from "./snvSupport.js";
import type { GameEvent } from "../../src/custom/core/types.js";

it("reloads a causal twin repair and undoes repair then swap through durable sessions", async () => {
  const { session, storage } = await createSession(["snakeCharmer", "artist", "savant", "juggler", "sage", "evilTwin", "imp"]);
  const first = await take(session, "evilTwin", null);
  const beforeSwap = await replayOrThrow(session.snapshot.canonical);
  const swap = await take(session, "snakeCharmer", { playerIds: ["p7"] });
  const pending = await replayOrThrow(session.snapshot.canonical);
  expect(pending.currentStep?.actionCause).toEqual({ kind: "requiredPreparation", triggerEventId: swap.proposal.event.id, previousPreparationEventId: beforeSwap.ruleState.twinRelationships![0]!.sourceEventId });
  const reloaded = await CustomCanonicalSession.load({ core: realWasmCore(), storage }); if (reloaded.status !== "loaded") throw new Error(reloaded.status);
  expect(await replayOrThrow(reloaded.session.snapshot.canonical)).toEqual(pending);
  const repair = await take(reloaded.session, "evilTwin", { playerIds: ["p2"] });
  const undone = await reloaded.session.undo(repair.proposal.event.id); if (!undone.ok) throw new Error(undone.error.code);
  expect(await undone.value.autosave).toBe(true);
  const afterUndo = await CustomCanonicalSession.load({ core: realWasmCore(), storage }); if (afterUndo.status !== "loaded") throw new Error(afterUndo.status);
  expect(await replayOrThrow(afterUndo.session.snapshot.canonical)).toEqual(pending);
  const undoSwap = await afterUndo.session.undo(swap.proposal.event.id); if (!undoSwap.ok) throw new Error(undoSwap.error.code);
  expect(await undoSwap.value.autosave).toBe(true);
  expect(await replayOrThrow(afterUndo.session.snapshot.canonical)).toEqual(beforeSwap);
  expect(beforeSwap.currentStep?.character).toBe("snakeCharmer");
});

it("rejects forged incoming source/cause/result and stale commands without replacing saved state", async () => {
  const { session, storage } = await createSession(["snakeCharmer", "artist", "savant", "juggler", "sage", "evilTwin", "imp"]);
  await take(session, "evilTwin", null); await take(session, "snakeCharmer", { playerIds: ["p7"] });
  const canonical = structuredClone(session.snapshot.canonical);
  const state = await replayOrThrow(canonical); const saved = await storage.loadSession();
  const command = { type: "confirmStep" as const, payload: { stepId: state.currentStep!.id, input: { playerIds: ["p2"] } } };
  const proposal = await realWasmCore().propose(canonical, command); if (!proposal.ok) throw new Error(proposal.error.code);
  expect(await realWasmCore().propose(canonical, command)).toEqual(proposal);
  const controller = new CanonicalSessionController(canonical.game.script, realWasmCore());
  const replay = await controller.replay(canonical); if (!replay.ok) throw new Error(replay.error.code);
  for (const mutate of [
    (event: GameEvent) => { if (event.type === "customActionConfirmed") event.payload.abilityUse!.abilityInstanceId = "not-an-instance"; },
    (event: GameEvent) => { if (event.type === "customActionConfirmed") if (event.payload.actionCause?.kind === "requiredPreparation") event.payload.actionCause.triggerEventId = "future-event"; },
    (event: GameEvent) => { if (event.type === "customActionConfirmed" && event.payload.result.kind === "twinAssigned") event.payload.result.targetPlayerId = "p3"; },
  ]) {
    const event = structuredClone(proposal.value.event); mutate(event);
    expect((await controller.apply(canonical, replay.value, event)).ok).toBe(false);
    const imported = parseGameFileJson(JSON.stringify({ ...canonical, game: { ...canonical.game, events: [...canonical.game.events, event] } }));
    expect((await controller.replay(imported)).ok).toBe(false);
    expect(session.snapshot.canonical).toEqual(canonical); expect(await storage.loadSession()).toEqual(saved);
  }
  expect((await session.execute({ ...command, payload: { ...command.payload, expectedEventCount: 0 } })).ok).toBe(false);
  expect(await storage.loadSession()).toEqual(saved);
});

it("preserves completed simulation and its real source across recovery, reload and Undo", async () => {
  const { definition } = await import("./snvSupport.js");
  const order = structuredClone(definition.firstNightOrder);
  const seam = order.findIndex(r => r.kind === "character" && r.characterId === "seamstress");
  const entry = order.splice(seam, 1)[0]!;
  order.splice(order.findIndex(r => r.kind === "character" && r.characterId === "snakeCharmer"), 0, entry);
  const { session, storage } = await createSession(["snakeCharmer", "artist", "mathematician", "philosopher", "noDashii", "scarletWoman", "savant"], { ...definition, firstNightOrder: order });
  const choice = await take(session, "philosopher", { characterIds: ["seamstress"] });
  const beforeSimulation = await replayOrThrow(session.snapshot.canonical);
  const simulation = await take(session, "seamstress", { playerIds: ["p2", "p3"] }, { kind: "boolean", value: false });
  const beforeRecovery = await replayOrThrow(session.snapshot.canonical);
  const swap = await take(session, "snakeCharmer", { playerIds: ["p5"] });
  const recovered = await replayOrThrow(session.snapshot.canonical);
  expect(recovered.currentStep?.character).toBe("mathematician");
  expect(recovered.ruleState.abilityGrants).toBeUndefined();
  expect(recovered.phaseOverview.find(r => r.character === "seamstress")).toMatchObject({ status: "complete", simulationSource: { selectionEventId: choice.proposal.event.id } });
  expect(recovered.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 1 });
  const loaded = await CustomCanonicalSession.load({ core: realWasmCore(), storage }); if (loaded.status !== "loaded") throw new Error(loaded.status);
  expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(recovered);
  const undoSwap = await loaded.session.undo(swap.proposal.event.id); if (!undoSwap.ok) throw new Error(undoSwap.error.code); expect(await undoSwap.value.autosave).toBe(true);
  expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(beforeRecovery);
  const undoSimulation = await loaded.session.undo(simulation.proposal.event.id); if (!undoSimulation.ok) throw new Error(undoSimulation.error.code); expect(await undoSimulation.value.autosave).toBe(true);
  expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(beforeSimulation);
});
