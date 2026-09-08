
import { IDBFactory } from "fake-indexeddb";
import { expect, it } from "vitest";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { createCustomGameFile, IndexedDbCustomWebSessionStorageDriver } from "../../src/custom/storage/sessionStorage.js";
import type { Command, CoreResult, CustomScriptDefinition, FirstNightOrderPlan, GameEvent, GameFile, GameFileV4, PhaseStepInput, SetupPlayerInput, SystemFirstNightActionId } from "../../src/custom/core/types.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";

it("creates, saves, reloads, confirms, and event-undos with one persisted definition order", async () => {
  const core = realWasmCore();
  const idb = new IDBFactory();
  const storage = new IndexedDbCustomWebSessionStorageDriver(
    DEFINITION.id,
    idb,
  );
  const session = CustomCanonicalSession.create({
    definition: DEFINITION,
    core,
    storage,
    setupDraft: { players: PLAYERS },
    presentation: { activeTab: "setup" },
    gameId: "issue-198-session",
    now: new Date("2026-09-07T00:00:00.000Z"),
  });

  const setup = await session.confirmSetup({
    type: "createGame",
    payload: { players: PLAYERS },
  });
  expect(setup.ok).toBe(true);
  if (!setup.ok) return;

  expect(setup.value.proposal.event.type).toBe("setupConfirmed");
  expect(setup.value.proposal.event.payload).toEqual({ players: PLAYERS });
  expect(setup.value.proposal.event.payload).not.toHaveProperty("firstNightOrderPlan");
  expect(serializedOccurrences(session.snapshot, "firstNightOrder")).toBe(1);
  expect(serializedOccurrences(session.snapshot, "firstNightOrderPlan")).toBe(0);

  const loaded = await CustomCanonicalSession.load({ core, storage });
  expect(loaded.status).toBe("loaded");
  if (loaded.status !== "loaded") return;

  const beforeAction = loaded.session.snapshot;
  expect(beforeAction.canonical.game.script).toEqual({
    type: "custom",
    definition: DEFINITION,
  });
  expect(beforeAction.canonical.game.events).toHaveLength(1);
  expect(beforeAction.canonical.game.events[0]?.payload).toEqual({ players: PLAYERS });
  expect(serializedOccurrences(beforeAction, "firstNightOrder")).toBe(1);
  expect(serializedOccurrences(beforeAction, "firstNightOrderPlan")).toBe(0);
  expect(beforeAction).not.toHaveProperty("replayState");
  expect(beforeAction).not.toHaveProperty("phaseOverview");

  const setupState = await replayOrThrow(beforeAction.canonical);
  expect(setupState.script).toEqual({ type: "custom", definition: DEFINITION });
  expect(setupState.phaseOverview.map(({ id }) => id)).toEqual([
    "firstNight:system:demonInfo",
    "firstNight:system:minionInfo",
    "firstNight:system:dawn",
  ]);
  expect(setupState.currentStep?.id).toBe("firstNight:system:demonInfo");
  expect(setupState.phaseOverview.some(({ character }) => character !== undefined)).toBe(false);

  const confirmed = await loaded.session.execute({
    type: "confirmStep",
    payload: {
      stepId: "firstNight:system:demonInfo",
      input: { characterIds: DEMON_BLUFFS },
    },
  });
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) return;
  expect(await confirmed.value.autosave).toBe(true);

  const confirmedEvent = confirmed.value.proposal.event;
  expect(confirmedEvent.payload).toEqual({
    stepId: "firstNight:system:demonInfo",
    actionRef: { kind: "system", actionId: "demonInfo" },
    input: { characterIds: DEMON_BLUFFS },
  });
  expect(confirmedEvent.payload).not.toHaveProperty("firstNightOrderPlan");
  expect(serializedOccurrences(loaded.session.snapshot, "firstNightOrder")).toBe(1);

  const reloadedAfterAction = await CustomCanonicalSession.load({ core, storage });
  expect(reloadedAfterAction.status).toBe("loaded");
  if (reloadedAfterAction.status !== "loaded") return;
  const persistedState = await replayOrThrow(reloadedAfterAction.session.snapshot.canonical);
  expect(persistedState.phaseOverview.map(({ id }) => id)).toEqual([
    "firstNight:system:demonInfo",
    "firstNight:system:minionInfo",
    "firstNight:system:dawn",
  ]);
  expect(persistedState.currentStep?.id).toBe("firstNight:system:minionInfo");

  const undone = await reloadedAfterAction.session.undo(confirmedEvent.id);
  expect(undone.ok).toBe(true);
  if (!undone.ok) return;
  expect(undone.value.removed.id).toBe(confirmedEvent.id);
  expect(await undone.value.autosave).toBe(true);
  expect(reloadedAfterAction.session.snapshot.canonical.game.events.map(({ id }) => id)).toEqual([
    setup.value.proposal.event.id,
  ]);
  expect(serializedOccurrences(reloadedAfterAction.session.snapshot, "firstNightOrder")).toBe(1);

  const restored = await CustomCanonicalSession.load({ core, storage });
  expect(restored.status).toBe("loaded");
  if (restored.status === "loaded") {
    const restoredState = await replayOrThrow(restored.session.snapshot.canonical);
    expect(restoredState.currentStep?.id).toBe("firstNight:system:demonInfo");
    expect(restored.session.snapshot.canonical.game.script).toEqual({
      type: "custom",
      definition: DEFINITION,
    });
  }
});


it("rejects missing, duplicate, unknown, mismatched, or absent definition actions", async () => {
  const core = realWasmCore();
  const invalidPlans: FirstNightOrderPlan[] = [
    FIRST_NIGHT_ORDER.filter(
      (action) => !(action.kind === "character" && action.characterId === "chef"),
    ),
    [FIRST_NIGHT_ORDER[0]!, ...FIRST_NIGHT_ORDER],
    [
      FIRST_NIGHT_ORDER[0]!,
      { kind: "character", characterId: "notACharacter", actionId: "doSomething" },
      ...FIRST_NIGHT_ORDER.slice(1),
    ],
    FIRST_NIGHT_ORDER.map((action) =>
      action.kind === "character" && action.characterId === "philosopher"
        ? { ...action, actionId: "wrongAction" }
        : action,
    ),
  ];
  for (const firstNightOrder of invalidPlans) {
    const result = await core.replay(rawCustomGame({ ...DEFINITION, firstNightOrder }));
    expectCoreError(result, "INVALID_FIRST_NIGHT_ORDER_PLAN");
  }

  const { firstNightOrder: _firstNightOrder, ...missingOrder } = DEFINITION;
  const missingResult = await core.replay(rawCustomGame(missingOrder));
  expectCoreError(missingResult, "MALFORMED_CUSTOM_SCRIPT_DEFINITION");

  const outOfPoolPlayers = PLAYERS.map((player) =>
    player.actualCharacter === "slayer"
      ? { ...player, actualCharacter: "soldier", shownCharacter: "soldier" }
      : player,
  );
  const outOfPoolResult = await core.propose(
    createCustomGameFile(DEFINITION, "issue-198-out-of-pool", new Date("2026-09-07T00:00:00.000Z")),
    { type: "createGame", payload: { players: outOfPoolPlayers } },
  );
  expectCoreError(outOfPoolResult, "CHARACTER_NOT_IN_SCRIPT");
});


it("rejects the removed create/setup order field, including null", async () => {
  const core = realWasmCore();
  const empty = createCustomGameFile(DEFINITION, "issue-198-legacy-field", new Date("2026-09-07T00:00:00.000Z"));
  for (const firstNightOrderPlan of [FIRST_NIGHT_ORDER, null]) {
    const oldCreateCommand = {
      type: "createGame",
      payload: { players: PLAYERS, firstNightOrderPlan },
    } as unknown as Command;
    const commandResult = await core.propose(empty, oldCreateCommand);
    expectCoreError(commandResult, "MALFORMED_COMMAND");

    const setupEvent = {
      id: "setup-1",
      type: "setupConfirmed",
      phase: "setup",
      payload: { players: PLAYERS, firstNightOrderPlan },
      summary: "setup",
      createdAt: "2026-09-07T00:00:00.000Z",
    };
    const eventResult = await core.replay(rawCustomGame(DEFINITION, [setupEvent]));
    expectCoreError(eventResult, "MALFORMED_EVENT");
  }
});


it("rejects wrong action provenance and out-of-order confirmed events", async () => {
  const core = realWasmCore();
  const empty = createCustomGameFile(DEFINITION, "issue-198-provenance", new Date("2026-09-07T00:00:00.000Z"));
  const setupProposal = await core.propose(empty, {
    type: "createGame",
    payload: { players: PLAYERS },
  });
  expect(setupProposal.ok).toBe(true);
  if (!setupProposal.ok) return;
  const setupGame = rawCustomGame(DEFINITION, [setupProposal.value.event]);
  const setupState = await replayOrThrow(setupGame);
  const currentStepId = setupState.currentStep?.id;
  const nextStepId = setupState.phaseOverview[1]?.id;
  if (!currentStepId || !nextStepId) throw new Error("expected first-night system steps");

  const wrongProvenance = firstNightEvent(
    "phase-step-2",
    currentStepId,
    "minionInfo",
    { characterIds: DEMON_BLUFFS },
  );
  const provenanceResult = await core.replay(rawCustomGame(DEFINITION, [setupProposal.value.event, wrongProvenance]));
  expectCoreError(provenanceResult, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");

  const wrongOrder = firstNightEvent("phase-step-2", nextStepId, "minionInfo", null);
  const orderResult = await core.replay(rawCustomGame(DEFINITION, [setupProposal.value.event, wrongOrder]));
  expectCoreError(orderResult, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");
});


it("reports an explicit unavailable handler when a planned character action is active", async () => {
  const core = realWasmCore();
  const definition: CustomScriptDefinition = {
    id: "issue-198-active-handler",
    name: "Issue 198 active handler",
    characterIds: ["undertaker", "monk", "ravenkeeper", "virgin", "washerwoman", "scarletWoman", "imp"],
    firstNightOrder: [
      { kind: "system", actionId: "dusk" },
      { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
      { kind: "system", actionId: "minionInfo" },
      { kind: "system", actionId: "demonInfo" },
      { kind: "system", actionId: "dawn" },
    ],
  };
  const players = PLAYERS.map((player) =>
    player.actualCharacter === "slayer"
      ? { ...player, name: "Washerwoman", actualCharacter: "washerwoman", shownCharacter: "washerwoman" }
      : player,
  );
  const empty = createCustomGameFile(definition, "issue-198-active-handler", new Date("2026-09-07T00:00:00.000Z"));
  const setup = await core.propose(empty, { type: "createGame", payload: { players } });
  expect(setup.ok).toBe(true);
  if (!setup.ok) return;
  const result = await core.replay(rawCustomGame(definition, [setup.value.event]));
  expectCoreError(result, "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE");
});


const FIRST_NIGHT_ORDER: FirstNightOrderPlan = [
  { kind: "system", actionId: "dusk" },
  { kind: "system", actionId: "demonInfo" },
  { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
  { kind: "system", actionId: "minionInfo" },
  { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
  { kind: "character", characterId: "librarian", actionId: "learnOutsider" },
  { kind: "character", characterId: "chef", actionId: "learnEvilPairs" },
  { kind: "system", actionId: "dawn" },
];


const DEFINITION: CustomScriptDefinition = {
  id: "issue-198-definition",
  name: "Issue 198 definition",
  characterIds: [
    "undertaker",
    "monk",
    "ravenkeeper",
    "virgin",
    "slayer",
    "scarletWoman",
    "imp",
    "philosopher",
    "washerwoman",
    "librarian",
    "chef",
  ],
  firstNightOrder: FIRST_NIGHT_ORDER,
};


const PLAYERS: SetupPlayerInput[] = [
  { id: "p1", seat: 1, name: "Undertaker", actualCharacter: "undertaker", shownCharacter: "undertaker" },
  { id: "p2", seat: 2, name: "Monk", actualCharacter: "monk", shownCharacter: "monk" },
  { id: "p3", seat: 3, name: "Ravenkeeper", actualCharacter: "ravenkeeper", shownCharacter: "ravenkeeper" },
  { id: "p4", seat: 4, name: "Virgin", actualCharacter: "virgin", shownCharacter: "virgin" },
  { id: "p5", seat: 5, name: "Slayer", actualCharacter: "slayer", shownCharacter: "slayer" },
  { id: "p6", seat: 6, name: "Scarlet Woman", actualCharacter: "scarletWoman", shownCharacter: "scarletWoman" },
  { id: "p7", seat: 7, name: "Imp", actualCharacter: "imp", shownCharacter: "imp" },
];


const DEMON_BLUFFS = ["washerwoman", "librarian", "chef"];


function rawCustomGame(definition: unknown, events: unknown[] = []): GameFile {
  return {
    schemaVersion: 4,
    game: {
      script: { type: "custom", definition } as GameFileV4["game"]["script"],
      id: "issue-198-raw-game",
      name: "Issue 198 raw game",
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      events: events as GameEvent[],
    },
  } as GameFile;
}


function firstNightEvent(
  id: string,
  stepId: string,
  actionId: SystemFirstNightActionId,
  input: PhaseStepInput,
): GameEvent {
  return {
    id,
    type: "phaseStepConfirmed",
    phase: "firstNight",
    payload: {
      stepId,
      actionRef: { kind: "system", actionId },
      input,
    },
    summary: id,
    createdAt: "2026-09-07T00:00:01.000Z",
  };
}


function expectCoreError<T>(result: CoreResult<T>, code: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}


function serializedOccurrences(value: unknown, needle: string): number {
  return JSON.stringify(value).split(needle).length - 1;
}
