import { createTestCustomScriptRepository } from "./customScriptRepositoryTestSupport.js";
import { deepEqual, equal, ok } from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { CustomCanonicalSession } from "./customCanonicalSession.js";
import {
  IndexedDbCustomWebSessionStorageDriver,
  type CustomWebSessionSnapshot,
} from "./customWebSession.js";
import type {
  Command,
  CoreResult,
  CustomScriptDefinition,
  GameEvent,
  GameFile,
  Proposal,
  ReplayState,
} from "./core/types.js";
import type { CoreAdapter } from "./core/coreAdapter.js";

const PLAN = [
  { kind: "system" as const, actionId: "dusk" as const },
  { kind: "character" as const, characterId: "philosopher", actionId: "chooseAbility" },
  { kind: "system" as const, actionId: "minionInfo" as const },
  { kind: "system" as const, actionId: "demonInfo" as const },
  { kind: "system" as const, actionId: "dawn" as const },
];

test("failed autosave retains in-memory canonical state and presentation waits for a meaningful save", async () => {
  const definition = customDefinition();
  const durableSnapshots: CustomWebSessionSnapshot<{ roster: string[] }, { activeTab: string }>[] = [];
  let attempts = 0;
  const storage = {
    async loadSession() {
      return { status: "missing" as const };
    },
    async saveSession(
      snapshot: CustomWebSessionSnapshot<{ roster: string[] }, { activeTab: string }>,
    ) {
      attempts += 1;
      if (attempts === 1) throw new Error("storage failure");
      durableSnapshots.push(structuredClone(snapshot));
    },
    async replaceUnreadableSession() {
      throw new Error("unused");
    },
  };
  const session = CustomCanonicalSession.create({
    definition,
    core: adapter(definition, [setupEvent()]),
    storage,
    setupDraft: { roster: [] as string[] },
    presentation: { activeTab: "review" },
    gameId: "autosave-game",
    now: new Date("2026-09-05T00:00:00.000Z"),
  });

  const originalSetTimeout = globalThis.setTimeout;
  let scheduledRetries = 0;
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    scheduledRetries += 1;
    return originalSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;
  try {
    const executed = await session.confirmSetup(createCommand());
    equal(executed.ok, false);
    if (!executed.ok) equal(executed.error.code, "STORAGE_WRITE_FAILED");
    equal(session.snapshot.canonical.game.events.length, 1);
    equal(attempts, 1);

    session.updatePresentation({ activeTab: "setup" });
    await Promise.resolve();
    equal(attempts, 1);
    equal(scheduledRetries, 0);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  equal(await session.saveDraft({ roster: ["imp"] }), true);
  equal(attempts, 2);
  deepEqual(durableSnapshots[0]?.canonical.game.events.map(({ id }: { id: string }) => id), ["setup-1"]);
  deepEqual(durableSnapshots[0]?.setupDraft, { roster: ["imp"] });
  deepEqual(durableSnapshots[0]?.presentation, { activeTab: "setup" });
});

test("setup durability can be awaited before publishing a live transition", async () => {
  const definition = customDefinition();
  let saveStarted: (() => void) | undefined;
  let releaseSave: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { saveStarted = resolve; });
  const storage = {
    async loadSession() {
      return { status: "missing" as const };
    },
    async saveSession() {
      saveStarted?.();
      await new Promise<void>((resolve) => { releaseSave = resolve; });
    },
    async replaceUnreadableSession() {
      throw new Error("unused");
    },
  };
  const session = CustomCanonicalSession.create({
    definition,
    core: adapter(definition, [setupEvent()]),
    storage,
    setupDraft: {},
    presentation: {},
    gameId: "durability-game",
    now: new Date("2026-09-05T00:00:00.000Z"),
  });
  let liveTransitionAllowed = false;
  const durability = session.confirmSetup(createCommand()).then((result: { ok: boolean }) => {
    liveTransitionAllowed = result.ok;
    return result;
  });

  await started;
  equal(liveTransitionAllowed, false);
  releaseSave?.();
  const confirmed = await durability;
  equal(confirmed.ok, true);
  equal(liveTransitionAllowed, true);
});

test("repository edits never overwrite the session; exact revert restores resume, then Undo saves and reloads", async () => {
  const idb = new IDBFactory();
  const definition = customDefinition();
  const edited = { ...definition, characterIds: [...definition.characterIds, "poisoner"] };
  const repository = createTestCustomScriptRepository(idb);
  const storage = new IndexedDbCustomWebSessionStorageDriver<{ roster: string[] }, { activeTab: string }>(
    definition.id,
    idb,
  );
  await repository.save({ version: 1, definition });
  const session = CustomCanonicalSession.create({
    definition,
    core: adapter(definition, [setupEvent(), actionEvent()]),
    storage,
    setupDraft: { roster: [] },
    presentation: { activeTab: "review" },
    gameId: "composed-game",
    now: new Date("2026-09-05T00:00:00.000Z"),
  });
  const setup = await session.confirmSetup(createCommand());
  if (!setup.ok) throw new Error(setup.error.messageKo);
  const action = await session.execute({
    type: "confirmStep",
    payload: {
      stepId: "firstNight:minionInfo",
      input: null,
      deliveredResult: undefined,
      registrationJudgments: [],
    },
  });
  if (!action.ok) throw new Error(action.error.messageKo);
  equal(await action.value.autosave, true);

  await repository.save({ version: 1, definition: edited });
  const loadedWhileEdited = await CustomCanonicalSession.load({ core: adapter(definition), storage });
  equal(loadedWhileEdited.status, "loaded");
  if (loadedWhileEdited.status !== "loaded") return;
  equal(loadedWhileEdited.session.canResumeWith(edited), false);
  deepEqual(loadedWhileEdited.session.snapshot.canonical.game.events.map(({ id }: { id: string }) => id), [
    "setup-1",
    "action-1",
  ]);

  await repository.save({ version: 1, definition });
  equal(loadedWhileEdited.session.canResumeWith(definition), true);
  const undone = await loadedWhileEdited.session.undo("action-1");
  equal(undone.ok, true);
  if (!undone.ok) return;
  equal(await undone.value.autosave, true);

  const reloaded = await CustomCanonicalSession.load({ core: adapter(definition), storage });
  equal(reloaded.status, "loaded");
  if (reloaded.status === "loaded") {
    deepEqual(reloaded.session.snapshot.canonical.game.events.map(({ id }: { id: string }) => id), ["setup-1"]);
    deepEqual(reloaded.session.snapshot.canonical.game.script, {
      type: "custom",
      definition,
    });
  }
});

test("coordinator keeps unreadable load blocked until explicit new-game recovery", async () => {
  const definition = customDefinition();
  let saveCalls = 0;
  let recoveryCalls = 0;
  const storage = {
    async loadSession() {
      return { status: "unreadable" as const, error: new Error("damaged") };
    },
    async saveSession() {
      saveCalls += 1;
    },
    async replaceUnreadableSession() {
      recoveryCalls += 1;
    },
  };

  const loaded = await CustomCanonicalSession.load({ core: adapter(definition), storage });
  equal(loaded.status, "unreadable");
  equal(saveCalls, 0);
  equal(recoveryCalls, 0);

  const recovered = await CustomCanonicalSession.recoverWithNewGame({
    definition,
    core: adapter(definition),
    storage,
    setupDraft: {},
    presentation: {},
    gameId: "recovered-game",
    now: new Date("2026-09-05T00:00:00.000Z"),
  });
  equal(recovered.ok, true);
  equal(saveCalls, 0);
  equal(recoveryCalls, 1);
});

function customDefinition(): CustomScriptDefinition {
  return {
    id: "canonical-session",
    name: "Canonical session",
    characterIds: ["philosopher", "imp"],
    firstNightOrder: PLAN,
  };
}

function setupEvent(): GameEvent {
  return {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players: [] },
    summary: "setup",
    createdAt: "2026-09-05T00:00:00.000Z",
  };
}

function actionEvent(): GameEvent {
  return {
    id: "action-1",
    type: "phaseStepConfirmed",
    phase: "firstNight",
    payload: {
      stepId: "firstNight:minionInfo",
      actionRef: { kind: "system", actionId: "minionInfo" },
      input: null,
    },
    summary: "action",
    createdAt: "2026-09-05T00:00:01.000Z",
  };
}

function createCommand(): Command {
  return { type: "createGame", payload: { players: [] } };
}

function adapter(
  definition: CustomScriptDefinition,
  proposals: GameEvent[] = [],
): CoreAdapter {
  const pending = [...proposals];
  return {
    async replay(gameFile): Promise<CoreResult<ReplayState>> {
      return { ok: true, value: replayState(gameFile, definition) };
    },
    async propose(): Promise<CoreResult<Proposal>> {
      const event = pending.shift();
      if (!event) return { ok: false, error: { code: "NO_PROPOSAL", messageKo: "unused" } };
      return { ok: true, value: { event, warnings: [], followUpSteps: [], preview: {} } };
    },
    async setupDistribution() {
      return { ok: true, value: { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 } };
    },
    setupDistributionSync() {
      return { ok: true, value: { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 } };
    },
    async suggestPhaseInput() {
      return { ok: false, error: { code: "UNUSED", messageKo: "unused" } };
    },
  };
}

function replayState(gameFile: GameFile, definition: CustomScriptDefinition): ReplayState {
  ok(gameFile.schemaVersion === 4 && gameFile.game.script.type === "custom");
  return {
    schemaVersion: 4,
    script: { type: "custom", definition },
    eventCount: gameFile.game.events.length,
    phase: gameFile.game.events.length === 0 ? "setup" : "firstNight",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
}
