import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { IndexedDbCustomWebSessionStorageDriver } from "../../src/custom/storage/sessionStorage.js";
import { CanonicalSessionController } from "../../src/custom/core/canonicalSessionController.js";
import { exportGameFileJson, parseGameFileJson } from "../../src/custom/storage/gameFile.js";
import type { CustomScriptDefinition, SetupPlayerInput, PhaseStepInput, InformationResult, RegistrationJudgment, Command, GameEvent } from "../../src/custom/core/types.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";
export { realWasmCore, replayOrThrow };
const inputs = JSON.parse(readFileSync(new URL("../../../fixtures/acceptance/custom-first-night/issue209/inputs.json", import.meta.url), "utf8")) as {
    definition: CustomScriptDefinition;
    rosters: string[][];
};
export const definition = inputs.definition;
export const rosters = inputs.rosters;
const stores = new WeakMap<Session, IndexedDbCustomWebSessionStorageDriver<unknown, unknown>>();
export type Session = CustomCanonicalSession<unknown, unknown>;
export function moveBefore(script: CustomScriptDefinition, action: string, before: string) {
    const entry = script.firstNightOrder.splice(script.firstNightOrder.findIndex(a => a.actionId === action), 1)[0]!;
    script.firstNightOrder.splice(script.firstNightOrder.findIndex(a => a.actionId === before), 0, entry);
}
export async function start(roster: number, change?: (d: CustomScriptDefinition, p: SetupPlayerInput[]) => void) {
    const script = structuredClone(definition);
    const players: SetupPlayerInput[] = rosters[roster]!.map((actualCharacter, i) => ({ id: `p${i + 1}`, seat: i + 1, name: `P${i + 1}`, actualCharacter, ...(actualCharacter === "drunk" ? { shownCharacter: roster === 0 ? "clockmaker" : "empath" } : {}) }));
    change?.(script, players);
    const storage = new IndexedDbCustomWebSessionStorageDriver(script.id, new IDBFactory());
    const session: Session = CustomCanonicalSession.create({ definition: script, core: realWasmCore(), storage, setupDraft: { players }, presentation: {}, gameId: `issue209-R${roster}`, now: new Date("2026-09-09T00:00:00Z") });
    const setup = await session.confirmSetup({ type: "createGame", payload: { players } });
    if (!setup.ok)
        throw Error(JSON.stringify(setup.error));
    stores.set(session, storage);
    return { session, storage };
}
// Full public composition at every prefix, including the explicitly required C19 checkpoints.
// Independent assertions in scenarios remain essential: equality alone cannot prove correctness.
export async function roundTrip(session: Session) {
    const canonical = session.snapshot.canonical;
    const parsed = parseGameFileJson(exportGameFileJson(canonical, new Date("2026-09-09T01:00:00Z")));
    expect(parsed).toEqual(canonical);
    const controller = new CanonicalSessionController(parsed.game.script, realWasmCore());
    const replayed = await controller.replay(parsed);
    if (!replayed.ok)
        throw Error(JSON.stringify(replayed.error));
    const storage = new IndexedDbCustomWebSessionStorageDriver(definition.id, new IDBFactory());
    await storage.saveSession({ ...session.snapshot, canonical: parsed });
    const loaded = await CustomCanonicalSession.load({ core: realWasmCore(), storage });
    if (loaded.status !== "loaded")
        throw Error(loaded.status);
    expect(loaded.session.snapshot.canonical).toEqual(canonical);
    expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(await replayOrThrow(canonical));
}
export async function take(session: Session, action: string, input: PhaseStepInput, deliveredResult?: InformationResult, registrationJudgments?: RegistrationJudgment[], owner?: string, optional = false) {
    const state = await replayOrThrow(session.snapshot.canonical);
    const step = optional ? state.availableActions?.find(s => s.actionRef?.actionId === action) : state.currentStep;
    expect(step?.actionRef?.actionId).toBe(action);
    if (owner)
        expect(step?.abilityUse?.ownerPlayerId ?? step?.simulationSource?.sourceAbilityUse.ownerPlayerId).toBe(owner);
    const command: Command = { type: "confirmStep", payload: { stepId: step!.id, input, ...(deliveredResult ? { deliveredResult } : {}), ...(registrationJudgments ? { registrationJudgments } : {}) } };
    const result = await session.execute(command);
    if (!result.ok)
        throw Error(`${action}: ${JSON.stringify(result.error)}`);
    expect(await result.value.autosave).toBe(true);
    await roundTrip(session);
    return result.value;
}
export async function system(session: Session) {
    const state = await replayOrThrow(session.snapshot.canonical);
    const primary = ["artist", "savant", "juggler"];
    const bluff = state.players.some(p => primary.includes(p.actualCharacter)) ? ["soldier", "mayor", "virgin"] : primary;
    await take(session, "minionInfo", null);
    await take(session, "demonInfo", { characterIds: bluff });
}
export async function rejectCommand(session: Session, command: Command) {
    const before = session.snapshot;
    const saved = await stores.get(session)!.loadSession();
    expect((await session.execute(command)).ok).toBe(false);
    expect(session.snapshot).toEqual(before);
    expect(await stores.get(session)!.loadSession()).toEqual(saved);
}
export async function rejectEvent(session: Session, event: GameEvent) {
    const canonical = session.snapshot.canonical;
    const saved = await stores.get(session)!.loadSession();
    const controller = new CanonicalSessionController(canonical.game.script, realWasmCore());
    const before = await controller.replay(canonical);
    if (!before.ok)
        throw Error(before.error.code);
    expect((await controller.apply(canonical, before.value, event)).ok).toBe(false);
    const forged = structuredClone(canonical);
    forged.game.events.push(event);
    expect((await realWasmCore().replay(forged)).ok).toBe(false);
    let parsed;
    try {
        parsed = parseGameFileJson(JSON.stringify(forged));
    }
    catch { /* structural rejection */ }
    if (parsed)
        expect((await controller.replay(parsed)).ok).toBe(false);
    expect(session.snapshot.canonical).toEqual(canonical);
    expect(await stores.get(session)!.loadSession()).toEqual(saved);
}
export async function dawnRejected(session: Session) {
    await rejectCommand(session, { type: "confirmStep", payload: { stepId: "firstNight:system:dawn", input: null } });
}
export function custom(event: GameEvent) { if (event.type !== "customActionConfirmed")
    throw Error(event.type); return event.payload; }
