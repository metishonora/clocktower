import { expect, it } from "vitest";
import { start, system, take, replayOrThrow, moveBefore, custom, rejectCommand, rejectEvent, realWasmCore, definition } from "./issue209Support.js";
import { CanonicalSessionController } from "../../src/custom/core/canonicalSessionController.js";
import { customFirstNightPlan } from "../../src/custom/core/wasmClient.js";
import { parseGameEvent } from "../../src/custom/core/validation.js";
import type { RegistrationJudgment, CustomScriptDefinition } from "../../src/custom/core/types.js";
it("C21-a/d C22 C26-a: current acquired occurrence rejects real but wrong identities and duplicate completion", async () => {
    const { session, storage } = await start(1);
    await take(session, "assignRedHerring", { playerIds: ["p4"] });
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["fortuneTeller"] });
    await take(session, "assignRedHerring", { playerIds: ["p4"] });
    const original = await take(session, "checkDemon", { playerIds: ["p2", "p4"] }, { kind: "boolean", value: true });
    const state = await replayOrThrow(session.snapshot.canonical);
    const command = { type: "confirmStep" as const, payload: { stepId: state.currentStep!.id, input: { playerIds: ["p1", "p4"] } } };
    const proposed = await realWasmCore().propose(session.snapshot.canonical, command);
    if (!proposed.ok)
        throw Error(proposed.error.code);
    for (const mutate of [
        (p: ReturnType<typeof custom>) => { p.actionRef = { kind: "character", characterId: "empath", actionId: "learnEvilNeighbors" }; },
        (p: ReturnType<typeof custom>) => { p.abilityUse!.ownerPlayerId = "p2"; },
        (p: ReturnType<typeof custom>) => { p.abilityUse!.abilityInstanceId = custom(original.proposal.event).abilityUse!.abilityInstanceId; },
        (p: ReturnType<typeof custom>) => { p.input = { playerIds: ["p1", "p1"] }; },
        (p: ReturnType<typeof custom>) => { if ("information" in p.result && p.result.information)
            p.result.information.deliveredResult = { kind: "boolean", value: false }; },
    ]) {
        const event = structuredClone(proposed.value.event);
        mutate(custom(event));
        expect(event).not.toEqual(proposed.value.event);
        await rejectEvent(session, event);
    }
    await rejectCommand(session, { ...command, payload: { ...command.payload, input: { playerIds: ["p1", "p1"] } } });
    const saved = await storage.loadSession();
    const canonical = session.snapshot.canonical;
    const failing = { ...realWasmCore(), replay: async () => { throw Error("injected custom load failure"); }, propose: async () => { throw Error("injected custom load failure"); } };
    const controller = new CanonicalSessionController(canonical.game.script, failing);
    const healthy = new CanonicalSessionController(canonical.game.script, realWasmCore());
    const replay = await healthy.replay(canonical);
    if (!replay.ok)
        throw Error(replay.error.code);
    expect(await controller.propose(canonical, replay.value, command)).toMatchObject({ ok: false, error: { code: "WASM_LOAD_FAILED" } });
    expect(await storage.loadSession()).toEqual(saved);
    const fixture = structuredClone(proposed.value.event);
    Object.assign(custom(fixture).result, { kind: "fixtureAbilityGranted" });
    expect(() => parseGameEvent(fixture)).toThrow();
    await rejectEvent(session, fixture);
    const done = await take(session, "checkDemon", command.payload.input);
    await rejectCommand(session, command);
    await rejectEvent(session, done.proposal.event);
    const duplicate = structuredClone(done.proposal.event);
    duplicate.id = "new-id-same-occurrence";
    await rejectEvent(session, duplicate);
});
it("C21-b: simulated guidance rejects unrelated, future and simultaneous actual sources", async () => {
    const { session } = await start(3, d => moveBefore(d, "compareAlignments", "choosePlayer"));
    await system(session);
    await take(session, "chooseAbility", { characterIds: ["seamstress"] });
    const state = await replayOrThrow(session.snapshot.canonical);
    const proposal = await realWasmCore().propose(session.snapshot.canonical, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: { playerIds: ["p2", "p3"] }, deliveredResult: { kind: "boolean", value: false } } });
    if (!proposal.ok)
        throw Error(proposal.error.code);
    for (const mutate of [
        (p: ReturnType<typeof custom>) => { p.simulationSource!.sourceAbilityUse.ownerPlayerId = "p1"; },
        (p: ReturnType<typeof custom>) => { p.simulationSource!.selectionEventId = "future"; },
        (p: ReturnType<typeof custom>) => { p.abilityUse = structuredClone(p.simulationSource!.sourceAbilityUse); },
    ]) {
        const e = structuredClone(proposal.value.event);
        mutate(custom(e));
        await rejectEvent(session, e);
    }
    await take(session, "compareAlignments", { playerIds: ["p2", "p3"] }, { kind: "boolean", value: false });
});
it("C13-b C21-d: independent Chef edge registrations produce one and reject nonadjacent scopes", async () => {
    const { session } = await start(9);
    await system(session);
    await take(session, "choosePoisonTarget", { playerIds: ["p5"] });
    // The second edge uses actual good alignment: normal identity is represented by no override.
    const judgments: RegistrationJudgment[] = [{ playerId: "p2", registeredAs: "evil", scope: { kind: "adjacentPair", playerIds: ["p1", "p2"] } }];
    const state = await replayOrThrow(session.snapshot.canonical);
    const bad = structuredClone(judgments);
    bad[0]!.scope!.playerIds = ["p4", "p1"];
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: null, deliveredResult: { kind: "number", value: 1 }, registrationJudgments: bad } });
    const proposal = await realWasmCore().propose(session.snapshot.canonical, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: null, deliveredResult: { kind: "number", value: 1 }, registrationJudgments: judgments } });
    if (!proposal.ok)
        throw Error(proposal.error.code);
    const forged = structuredClone(proposal.value.event);
    custom(forged).registrationJudgments = bad;
    await rejectEvent(session, forged);
    expect((await take(session, "learnEvilPairs", null, { kind: "number", value: 1 }, judgments)).proposal.revealPayload).toMatchObject({ value: 1 });
    expect((await replayOrThrow(session.snapshot.canonical)).players[1]).toMatchObject({ actualCharacter: "recluse", alignment: "good" });
});
it("C13-c: Vortox compares actual alignment rather than inverting registration", async () => {
    const { session } = await start(7);
    await system(session);
    const state = await replayOrThrow(session.snapshot.canonical);
    const registrationJudgments: RegistrationJudgment[] = [{ playerId: "p6", registeredAs: "evil" }];
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: state.currentStep!.id, input: { playerIds: ["p2", "p6"] }, deliveredResult: { kind: "boolean", value: true }, registrationJudgments } });
    await take(session, "compareAlignments", { playerIds: ["p2", "p6"] }, { kind: "boolean", value: false }, registrationJudgments);
    expect((await replayOrThrow(session.snapshot.canonical)).players[5]).toMatchObject({ actualCharacter: "recluse", alignment: "good" });
});
it("C02-a C03: each invalid explicit order is rejected on both creation and replay", async () => {
    const { session, storage } = await start(2);
    const canonical = session.snapshot.canonical;
    const saved = await storage.loadSession();
    const setup = canonical.game.events[0]!;
    if (setup.type !== "setupConfirmed")
        throw Error(setup.type);
    const alterations: ((d: CustomScriptDefinition) => void)[] = [
        d => { Reflect.deleteProperty(d, "firstNightOrder"); },
        d => { d.firstNightOrder = d.firstNightOrder.filter(a => a.actionId !== "learnEvilNeighbors"); },
        d => { d.firstNightOrder.splice(1, 0, d.firstNightOrder.find(a => a.actionId === "learnEvilNeighbors")!); },
        d => { d.firstNightOrder.find(a => a.actionId === "learnEvilNeighbors")!.actionId = "checkDemon"; },
        d => { d.firstNightOrder.splice(1, 0, { kind: "character", characterId: "empath", actionId: "unknown" }); },
        d => { const x = d.firstNightOrder.shift()!; d.firstNightOrder.splice(1, 0, x); },
        d => { const x = d.firstNightOrder.pop()!; d.firstNightOrder.splice(1, 0, x); },
    ];
    for (const [characterId, actionId] of [["fortuneTeller", "assignRedHerring"], ["washerwoman", "prepareInformation"], ["librarian", "prepareInformation"], ["investigator", "prepareInformation"], ["evilTwin", "assignTwin"], ["drunk", "assignShownCharacter"], ["mutant", "resolveMadnessExecution"]])
        alterations.push(d => { d.firstNightOrder.splice(1, 0, { kind: "character", characterId: characterId!, actionId: actionId! }); });
    for (const alter of alterations) {
        const d = structuredClone(definition);
        alter(d);
        const empty = structuredClone(canonical);
        empty.game.events = [];
        empty.game.script = { type: "custom", definition: d };
        expect((await realWasmCore().propose(empty, { type: "createGame", payload: setup.payload })).ok).toBe(false);
        const file = structuredClone(canonical);
        file.game.script = { type: "custom", definition: d };
        expect((await realWasmCore().replay(file)).ok).toBe(false);
        expect(session.snapshot.canonical).toEqual(canonical);
        expect(await storage.loadSession()).toEqual(saved);
    }
});
it("C02-b: authoring defaults do not depend on pool order and explicit order stays explicit", async () => {
    const { firstNightOrder: _, ...draft } = definition;
    const forward = await customFirstNightPlan(draft);
    const reversed = await customFirstNightPlan({ ...draft, characterIds: [...draft.characterIds].reverse() });
    expect(forward.ok).toBe(true);
    expect(reversed).toEqual(forward);
    const explicit = structuredClone(definition);
    moveBefore(explicit, "chooseAbility", "minionInfo");
    expect(await customFirstNightPlan(explicit)).toMatchObject({ ok: true, value: { source: "definition", plan: explicit.firstNightOrder } });
});
