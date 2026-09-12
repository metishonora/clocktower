import { expect, it } from "vitest";
import { start, system, take, replayOrThrow, moveBefore, dawnRejected, custom, roundTrip } from "./issue209Support.js";
it("C01-a C08-a C19 C27-a: fixed R0 information and all TB actions reach Day", async () => {
    const { session } = await start(0);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: ["p11"] });
    for (const [action, characterId, correctPlayerId] of [["learnTownsfolk","monk","p8"],["learnOutsider","butler","p10"],["learnMinion","poisoner","p12"]]) {
        await take(session,"prepareInformation",{playerIds:["p1",correctPlayerId!],characterId,correctPlayerId});
        expect((await take(session,action!,null)).proposal.revealPayload).toMatchObject({kind:'setupInformation',revealedCharacterId:characterId});
    }
    for (const [action, value] of [["learnEvilPairs", 3], ["learnEvilNeighbors", 0]] as const) {
        expect((await take(session, action, null)).proposal.revealPayload).toEqual({ kind: "numericInformation", characterId: action === "learnEvilPairs" ? "chef" : "empath", value });
    }
    await take(session,"assignRedHerring",{playerIds:["p8"]});
    const ft = await take(session, "checkDemon", { playerIds: ["p6", "p15"] });
    expect(custom(ft.proposal.event).result).toMatchObject({ information: { deliveredResult: { kind: "boolean", value: true } } });
    await take(session, "chooseMaster", { playerIds: ["p8"] });
    const clock = await take(session, "learnSteps", null, { kind: "number", value: 0 }, undefined, "p11");
    expect(custom(clock.proposal.event).simulationSource?.sourceAbilityUse.characterId).toBe("drunk");
    await take(session, "inspectGrimoire", null);
    expect((await take(session, "learnCount", null)).proposal.revealPayload).toEqual({ kind: "numericInformation", characterId: "mathematician", value: 1 });
    await take(session, "dawn", null);
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.phase).toBe("day");
    expect(state.ruleState.poisonerChoices).toEqual(expect.arrayContaining([expect.objectContaining({ targetPlayerId: "p11", effective: true })]));
    expect(state.ruleState.masterChoices).toEqual(expect.arrayContaining([expect.objectContaining({ targetPlayerId: "p8" })]));
    const actions = session.snapshot.canonical.game.events.filter(e => e.type === "customActionConfirmed").map(e => custom(e).actionRef.actionId);
    for (const action of ["choosePoisonTarget", "learnTownsfolk", "learnOutsider", "learnMinion", "learnEvilPairs", "learnEvilNeighbors", "checkDemon", "chooseMaster", "inspectGrimoire", "learnSteps", "learnCount"])
        expect(actions.filter(a => a === action)).toHaveLength(1);
});
it("C03 C05 C24: original and acquired Fortune Tellers have independent preparation and completion", async () => {
    const { session } = await start(1);
    await dawnRejected(session);
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["fortuneTeller"] });
    await take(session, "assignRedHerring", { playerIds: ["p4"] }, undefined, undefined, "p1");
    await take(session, "assignRedHerring", { playerIds: ["p4"] }, undefined, undefined, "p2");
    await take(session, "checkDemon", { playerIds: ["p2", "p4"] }, { kind: "boolean", value: true }, undefined, "p2");
    const before = session.snapshot;
    const state = await replayOrThrow(before.canonical);
    const preparations = state.ruleState.preparations!.filter(p => p.actionRef.actionId === "assignRedHerring");
    expect(preparations).toHaveLength(2);
    expect(preparations.map(p => p.abilityUse!.ownerPlayerId).sort()).toEqual(["p1", "p2"]);
    const command = { type: "confirmStep" as const, payload: { stepId: state.currentStep!.id, input: { playerIds: ["p1", "p4"] } } };
    const { realWasmCore } = await import("./issue209Support.js");
    const first = await realWasmCore().propose(before.canonical, command);
    expect(first.ok).toBe(true);
    expect(await realWasmCore().propose(before.canonical, command)).toEqual(first);
    expect(await replayOrThrow(before.canonical)).toEqual(state);
    expect(session.snapshot).toEqual(before);
    const ft = await take(session, "checkDemon", command.payload.input, undefined, undefined, "p1");
    expect(custom(ft.proposal.event).result).toMatchObject({ information: { deliveredResult: { kind: "boolean", value: true } } });
    expect((await replayOrThrow(session.snapshot.canonical)).currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 0 });
    expect((await replayOrThrow(session.snapshot.canonical)).players[0]).toMatchObject({ actualCharacter: "philosopher", alignment: "good" });
});
it.each([false, true])("C06 C18-a C20-b C27-a: acquired Washerwoman before/past order %s", async (past) => {
    const { session } = await start(2, d => { if (past)
        moveBefore(d, "learnTownsfolk", "chooseAbility"); });
    await system(session);
    const before = await replayOrThrow(session.snapshot.canonical);
    const choice = await take(session, "chooseAbility", { characterIds: ["washerwoman"] });
    const afterChoice = await replayOrThrow(session.snapshot.canonical);
    await dawnRejected(session);
    const prep = await take(session, "prepareInformation", { playerIds: ["p1", "p3"], characterId: "monk", correctPlayerId: "p3" });
    const afterPrep = await replayOrThrow(session.snapshot.canonical);
    await dawnRejected(session);
    const delivery = await take(session, "learnTownsfolk", null);
    expect(delivery.proposal.revealPayload).toEqual({ kind: "setupInformation", characterId: "washerwoman", candidatePlayers: [{ playerId: "p1", name: "P1", seat: 1 }, { playerId: "p3", name: "P3", seat: 3 }], revealedCharacterId: "monk", zeroOutsiders: false });
    expect((await replayOrThrow(session.snapshot.canonical)).currentStep?.character).toBe("mathematician");
    for (const [event, state] of [[delivery.proposal.event, before]] as const) {
        const r = await session.undo(event.id);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(await r.value.autosave).toBe(true);
        expect(await replayOrThrow(session.snapshot.canonical)).toEqual(state);
        await roundTrip(session);
    }
});
it.each([false, true])("C07: acquired Empath joins remaining but not passed order %s", async (past) => {
    const { session } = await start(2, d => { if (past)
        moveBefore(d, "learnEvilNeighbors", "chooseAbility"); });
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["empath"] });
    if (!past)
        expect((await take(session, "learnEvilNeighbors", null)).proposal.revealPayload).toMatchObject({ value: 1 });
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("mathematician");
    expect(state.ruleState.abilityGrants).toHaveLength(1);
});
it("C01-b C04: explicit system order and deferred acquisition", async () => {
    const { session } = await start(2, d => { moveBefore(d, "chooseAbility", "minionInfo"); });
    await take(session, "chooseAbility", { characterIds: ["empath"] });
    await system(session);
    await take(session, "learnEvilNeighbors", null);
    await take(session, "learnCount", null);
    await take(session, "dawn", null);
    const second = await start(2);
    await system(second.session);
    await take(second.session, "chooseAbility", null);
    expect((await replayOrThrow(second.session.snapshot.canonical)).currentStep?.character).toBe("mathematician");
    await take(second.session, "learnCount", null);
    await take(second.session, "dawn", null);
});
it.each([2, 0])("C08-a C14-a: Drunk Empath delivery %i counts only misinformation", async (value) => {
    const { session } = await start(8);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: ["p4"] });
    const r = await take(session, "learnEvilNeighbors", null, { kind: "number", value });
    expect(custom(r.proposal.event).simulationSource?.sourceAbilityUse.characterId).toBe("drunk");
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: value === 2 ? 0 : 1 });
    expect(state.ruleState.abilityGrants ?? []).toEqual([]);
    expect(state.players[0]?.actualCharacter).toBe("drunk");
});
it("C15-b: later acquired Mathematician counts earlier misinformation without rewriting it", async () => {
    const { session } = await start(2);
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["mathematician"] });
    const first = await take(session, "learnCount", null, { kind: "number", value: 2 }, undefined, "p2");
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 1 });
    await take(session, "learnCount", null, undefined, undefined, "p1");
    expect(session.snapshot.canonical.game.events.find(e => e.id === first.proposal.event.id)).toEqual(first.proposal.event);
});
it.each([false, true])("C09-a/b C15-a: failed selection recovers with completed guidance preserved %s", async (deliver) => {
    const { session } = await start(3, d => { if (deliver)
        moveBefore(d, "compareAlignments", "choosePlayer"); });
    await system(session);
    const choice = await take(session, "chooseAbility", { characterIds: ["seamstress"] });
    let guidance;
    if (deliver)
        guidance = await take(session, "compareAlignments", { playerIds: ["p2", "p3"] }, { kind: "boolean", value: false });
    await take(session, "choosePlayer", { playerIds: ["p5"] });
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("mathematician");
    expect(state.ruleState.abilityGrants ?? []).toEqual([]);
    if (guidance) {
        expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 1 });
        expect(session.snapshot.canonical.game.events.find(e => e.id === guidance!.proposal.event.id)).toEqual(guidance.proposal.event);
        expect(custom(guidance.proposal.event).simulationSource?.selectionEventId).toBe(choice.proposal.event.id);
    }
});
it("C08-b: acquired Drunk guidance does not grant the simulated selection", async () => {
    const { session } = await start(2);
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["drunk"] });
    await take(session, "assignShownCharacter", { characterIds: ["philosopher"] });
    await take(session, "chooseAbility", { characterIds: ["chef"] });
    await take(session, "learnEvilPairs", null, { kind: "number", value: 1 });
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.ruleState.abilityGrants).toHaveLength(1);
    expect(JSON.stringify(state.ruleState.abilityGrants)).toContain('"drunk"');
    expect(JSON.stringify(state.ruleState.abilityGrants)).not.toContain('"chef"');
    expect(state.players[0]).toMatchObject({ actualCharacter: "philosopher", shownCharacter: "philosopher" });
    expect(state.ruleState.abilityUses?.filter(use => use.abilityUse.characterId === "philosopher")).toHaveLength(1);
});
it("C14-b: initial Drunk philosopher/snake guidance does not grant or swap", async () => {
    const { session } = await start(8, (_d, p) => { p[0]!.shownCharacter = "philosopher"; });
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["snakeCharmer"] });
    await take(session, "choosePoisonTarget", { playerIds: ["p4"] });
    await take(session, "choosePlayer", { playerIds: ["p2"] });
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.players[0]?.actualCharacter).toBe("drunk");
    expect(state.players[1]?.actualCharacter).toBe("imp");
    expect(state.ruleState.abilityGrants ?? []).toEqual([]);
    expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: 1 });
});
it.each(["p3", "p2"])("C12-a/b: No Dashii protection retains source-specific targets %s", async (target) => {
    const { session } = await start(10);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: [target] });
    const effects = (await replayOrThrow(session.snapshot.canonical)).ruleState.activeImpairments ?? [];
    expect(effects).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: target, sourceCharacterId: "poisoner" }), expect.objectContaining({ playerId: "p4", sourceCharacterId: "noDashii" })]));
    expect(effects.filter(e => e.playerId === "p2").map(e => e.sourceCharacterId).sort()).toEqual(target === "p2" ? ["noDashii", "poisoner"] : []);
    expect(effects.some(e => e.playerId === "p3" && e.sourceCharacterId === "noDashii")).toBe(false);
});
it.each([false, true])("C13-a: mixed starting information validates the actual pair %s", async (valid) => {
    const { session } = await start(2, (_d, p) => { p[0]!.actualCharacter = "washerwoman"; });
    await system(session);
    const state = await replayOrThrow(session.snapshot.canonical);
    const input = valid ? { playerIds: ["p1", "p2"], characterId: "mathematician", correctPlayerId: "p2" } : { playerIds: ["p4", "p5"], characterId: "mathematician", correctPlayerId: "p4" };
    if (valid) {
        await take(session, "prepareInformation", input);
        expect((await take(session, "learnTownsfolk", null)).proposal.revealPayload).toMatchObject({ revealedCharacterId: "mathematician" });
    }
    else {
        const { rejectCommand } = await import("./issue209Support.js");
        await rejectCommand(session, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input } });
    }
});
it.each([false, true])("C16-a/b C18-b: optional Mutant decision preserves required Math %s", async (poisonMutant) => {
    const { session } = await start(6);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: [poisonMutant ? "p6" : "p2"] });
    const before = await replayOrThrow(session.snapshot.canonical);
    expect(before.currentStep?.character).toBe("mathematician");
    const optional = before.availableActions!.find(s => s.character === "mutant")!;
    await take(session, "resolveMadnessExecution", { execute: false }, undefined, undefined, "p6", true);
    const { rejectCommand } = await import("./issue209Support.js");
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: optional.id, input: { execute: false } } });
    expect((await replayOrThrow(session.snapshot.canonical)).currentStep?.id).toBe(before.currentStep!.id);
    await take(session, "resolveMadnessExecution", { execute: true }, undefined, undefined, "p6", true);
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.players[5]?.alive).toBe(poisonMutant);
    expect(state.gameEnd).toBeNull();
    expect(state.currentStep?.id).toBe(before.currentStep!.id);
    expect(state.currentStep?.informationPrompt?.computedResult).toEqual({ kind: "number", value: poisonMutant ? 1 : 0 });
    await take(session, "learnCount", null);
    await take(session, "dawn", null);
    expect((await replayOrThrow(session.snapshot.canonical)).phase).toBe("day");
});
it("C17 C20-b C27-a: good twin execution terminates FirstNight and Undo restores it", async () => {
    const { session } = await start(11);
    await system(session);
    await take(session, "assignTwin", { playerIds: ["p2"] });
    const before = await replayOrThrow(session.snapshot.canonical);
    const r = await take(session, "resolveMadnessExecution", { execute: true }, undefined, undefined, "p2", true);
    const state = await replayOrThrow(session.snapshot.canonical);
    expect(state.gameEnd).toMatchObject({ winningAlignment: "evil", reason: "goodTwinExecuted", sourceEventId: r.proposal.event.id });
    expect(state.phase).toBe("firstNight");
    expect(state.currentStep).toBeNull();
    expect(state.availableActions ?? []).toEqual([]);
    await dawnRejected(session);
    expect(r.proposal.revealPayload).not.toHaveProperty("winningAlignment");
    expect(r.proposal.revealPayload).not.toHaveProperty("sourceEventId");
    const undo = await session.undo(r.proposal.event.id);
    expect(undo.ok).toBe(true);
    if (undo.ok)
        await undo.value.autosave;
    expect(await replayOrThrow(session.snapshot.canonical)).toEqual(before);
    await roundTrip(session);
});
it("C18-b: unexecuted optional candidate does not block Dawn and becomes stale", async () => {
    const { session } = await start(6);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: ["p2"] });
    await take(session, "resolveMadnessExecution", { execute: false }, undefined, undefined, "p6", true);
    await take(session, "learnCount", null);
    const before = await replayOrThrow(session.snapshot.canonical);
    const optional = before.availableActions!.find(s => s.character === "mutant")!;
    expect(optional).toBeDefined();
    await take(session, "dawn", null);
    const { rejectCommand } = await import("./issue209Support.js");
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: optional.id, input: { execute: true } } });
    expect((await replayOrThrow(session.snapshot.canonical)).phase).toBe("day");
});
