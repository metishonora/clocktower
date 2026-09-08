import { expect, it } from "vitest";
import { isSpyGrimoireRevealPayload } from "../../src/custom/core/revealPayload.js";
import { start, system, take, replayOrThrow, moveBefore, dawnRejected, custom, roundTrip, rejectCommand, rejectEvent, realWasmCore } from "./issue209Support.js";
it("C10 C19 C21-c C27-b: recovery requires a new preparation while old Spy delivery stays fixed", async () => {
    const { session } = await start(4, d => moveBefore(d, "inspectGrimoire", "chooseAbility"));
    const initial = await take(session, "prepareInformation", { playerIds: ["p7", "p8"], characterId: "monk", correctPlayerId: "p7" });
    await system(session);
    const spy = await take(session, "inspectGrimoire", null);
    expect(spy.proposal.revealPayload).toMatchObject({ kind: "spyGrimoire", players: expect.arrayContaining([expect.objectContaining({ playerId: "p7", automaticReminders: expect.arrayContaining([expect.objectContaining({ tokenId: "townsfolk" })]) })]) });
    const spyRow = (await replayOrThrow(session.snapshot.canonical)).phaseOverview.find(row => row.character === "spy");
    await take(session, "choosePoisonTarget", { playerIds: ["p8"] });
    await take(session, "choosePlayer", { playerIds: ["p2"] });
    let state = await replayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.actionRef?.actionId).toBe("prepareInformation");
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: { playerIds: ["p7", "p8"], characterId: "monk", correctPlayerId: "p7" } } });
    const prep = await take(session, "prepareInformation", { playerIds: ["p1", "p4"], characterId: "mathematician", correctPlayerId: "p4" });
    state = await replayOrThrow(session.snapshot.canonical);
    const candidate = await realWasmCore().propose(session.snapshot.canonical, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: null } });
    if (!candidate.ok)
        throw Error(candidate.error.code);
    const forged = structuredClone(candidate.value.event);
    const result = custom(forged).result;
    if (result.kind !== "preparedInformationDelivered")
        throw Error(result.kind);
    result.preparationEventId = initial.proposal.event.id;
    await rejectEvent(session, forged);
    const delivery = await take(session, "learnTownsfolk", null);
    expect(custom(delivery.proposal.event).result).toMatchObject({ preparationEventId: prep.proposal.event.id });
    expect(delivery.proposal.revealPayload).toMatchObject({ revealedCharacterId: "mathematician" });
    expect(session.snapshot.canonical.game.events.find(e => e.id === spy.proposal.event.id)).toEqual(spy.proposal.event);
    const completed = (await replayOrThrow(session.snapshot.canonical)).phaseOverview.find(row => row.character === "spy");
    expect(completed).toMatchObject({ status: "complete" });
    expect(completed).toEqual(spyRow);
    expect(isSpyGrimoireRevealPayload(spy.proposal.revealPayload)).toBe(true);
    const leaked = structuredClone(spy.proposal.revealPayload);
    if (!leaked || !("kind" in leaked) || leaked.kind !== "spyGrimoire")
        throw Error("spy");
    Object.assign(leaked.players[6]!.automaticReminders![0]!, { sourceEventId: initial.proposal.event.id });
    expect(isSpyGrimoireRevealPayload(leaked)).toBe(false);
    expect(JSON.stringify(custom(spy.proposal.event).result)).toContain(initial.proposal.event.id);
    expect(JSON.stringify(spy.proposal.revealPayload)).not.toContain("sourceEventId");
    expect(JSON.stringify(spy.proposal.revealPayload)).not.toContain("notes");
});
it("C11 C18-a C19 C20-a C21-c C23 C25: causal twin repair, whole-file rejection and event Undo", async () => {
    const { session } = await start(5, d => moveBefore(d, "learnTwin", "choosePlayer"));
    const assign = await take(session, "assignTwin", { playerIds: ["p1"] });
    await system(session);
    const first = await take(session, "learnTwin", null);
    const beforeSwap = await replayOrThrow(session.snapshot.canonical);
    const swap = await take(session, "choosePlayer", { playerIds: ["p7"] });
    const beforeRepair = await replayOrThrow(session.snapshot.canonical);
    await dawnRejected(session);
    expect(beforeRepair.players[0]).toMatchObject({ actualCharacter: "imp", alignment: "evil" });
    expect(beforeRepair.players[6]).toMatchObject({ actualCharacter: "snakeCharmer", alignment: "good" });
    expect(beforeRepair.currentStep?.actionCause).toEqual({ kind: "requiredPreparation", triggerEventId: swap.proposal.event.id, previousPreparationEventId: assign.proposal.event.id });
    const candidate = await realWasmCore().propose(session.snapshot.canonical, { type: "confirmStep", payload: { stepId: beforeRepair.currentStep!.id, input: { playerIds: ["p2"] } } });
    if (!candidate.ok)
        throw Error(candidate.error.code);
    for (const [field, value] of [["triggerEventId", first.proposal.event.id], ["triggerEventId", "future"], ["previousPreparationEventId", first.proposal.event.id]]) {
        const event = structuredClone(candidate.value.event);
        Object.assign(custom(event).actionCause!, { [field!]: value });
        await rejectEvent(session, event);
    }
    const repair = await take(session, "assignTwin", { playerIds: ["p2"] });
    const beforeNotice = await replayOrThrow(session.snapshot.canonical);
    await dawnRejected(session);
    expect(beforeNotice.ruleState.twinRelationships).toEqual(expect.arrayContaining([expect.objectContaining({targetPlayerId: "p2", sourceEventId: repair.proposal.event.id})]));
    const notice = await realWasmCore().propose(session.snapshot.canonical, { type: "confirmStep", payload: { stepId: beforeNotice.currentStep!.id, input: null } });
    if (!notice.ok)
        throw Error(notice.error.code);
    const bad = structuredClone(notice.value.event);
    custom(bad).abilityUse!.abilityInstanceId = "future";
    await rejectEvent(session, bad);
    const final = await take(session, "learnTwin", null);
    expect((await replayOrThrow(session.snapshot.canonical)).currentStep?.actionRef?.actionId).toBe("dawn");
    const missing = structuredClone(session.snapshot.canonical);
    missing.game.events = missing.game.events.filter(e => e.id !== assign.proposal.event.id);
    expect((await realWasmCore().replay(missing)).ok).toBe(false);
    for (const [event, state] of [[final.proposal.event, beforeNotice], [repair.proposal.event, beforeRepair], [swap.proposal.event, beforeSwap]] as const) {
        const undo = await session.undo(event.id);
        expect(undo.ok).toBe(true);
        if (undo.ok)
            expect(await undo.value.autosave).toBe(true);
        expect(await replayOrThrow(session.snapshot.canonical)).toEqual(state);
        await roundTrip(session);
    }
    expect(session.snapshot.canonical.game.events.find(e => e.id === first.proposal.event.id)).toEqual(first.proposal.event);
});
