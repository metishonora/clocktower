import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { CustomCanonicalSession } from "../src/customCanonicalSession.js";
import { CanonicalSessionController } from "../src/core/canonicalSessionController.js";
import {
  createCustomGameFile,
  createCustomWebSessionSnapshot,
  IndexedDbCustomWebSessionStorageDriver,
} from "../src/customWebSession.js";
import { parseGameEvent } from "../src/core/validation.js";
import type {
  Command,
  CustomScriptDefinition,
  FirstNightActionRef,
  GameEvent,
  GameFileV4,
  PhaseStepInput,
  ReplayState,
  SetupPlayerInput,
} from "../src/core/types.js";
import {
  fixtureProposeOrThrow,
  fixtureReplayOrThrow,
  issue206FixtureWasmCore,
} from "./issue206FixtureWasmHarness.js";

const ACTIONS: Record<string, string> = {
  philosopher: "chooseAbility",
  washerwoman: "learnTownsfolk",
  librarian: "learnOutsider",
  investigator: "learnMinion",
  chef: "learnEvilPairs",
  empath: "learnEvilNeighbors",
  mathematician: "learnCount",
  clockmaker: "learnSteps",
  spy: "inspectGrimoire",
  dreamer: "learnCharacters",
  seamstress: "compareAlignments",
  butler: "chooseMaster",
};

// These roles have no first-night action in the fixture catalog. Keeping them in the definition
// but out of the setup roster leaves stable, legal demon-bluff candidates for every scenario.
const BLUFF_CANDIDATES = [
  "ravenkeeper",
  "mayor",
  "undertaker",
  "monk",
  "soldier",
  "slayer",
  "virgin",
  "saint",
];

type ActionToken = keyof typeof ACTIONS;
type SystemToken = "minionInfo" | "demonInfo";

describe("Issue #206 generated custom-runtime fixture", () => {
  it("uses the generated fixture WASM through wasmClient, parser, session, IndexedDB, and undo", async () => {
    const definition = fixtureDefinition(
      "issue-206-happy-path",
      ["philosopher", "washerwoman", "librarian"],
      ["demonInfo", "philosopher", "washerwoman", "librarian", "minionInfo"],
    );
    const players = fixturePlayers(["philosopher", "washerwoman", "librarian"]);
    const { session, storage } = await createFixtureSession(definition, players);
    const prefixes: Array<{ canonical: GameFileV4; state: ReplayState }> = [];
    const recordPrefix = async () => {
      const canonical = session.snapshot.canonical;
      prefixes.push({ canonical, state: await fixtureReplayOrThrow(canonical) });
    };

    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await recordPrefix();
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "demonInfo" });
    const bluffs = state.currentStep?.requiredInput.kind === "characterIds"
      ? state.currentStep.requiredInput.allowedCharacterIds?.slice(0, 3)
      : undefined;
    expect(bluffs).toEqual(["undertaker", "monk", "soldier"]);

    await executeCurrent(session, { characterIds: bluffs! });
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await recordPrefix();
    expect(state.currentStep?.actionRef).toEqual({
      kind: "character",
      characterId: "philosopher",
      actionId: "chooseAbility",
    });

    const grant = await executeCurrent(session, { characterIds: ["washerwoman"] });
    expect(grant.proposal.event.type).toBe("customActionConfirmed");
    if (grant.proposal.event.type !== "customActionConfirmed") return;
    expect(grant.proposal.event.payload.result).toEqual({
      kind: "fixtureAbilityGranted",
      targetCharacterId: "washerwoman",
    });
    // This call crosses parseGameEvent in the shared adapter path. The production parser rejects
    // this discriminator; the dedicated Vitest alias accepts only the bounded fixture extension.
    expect(parseGameEvent(JSON.parse(JSON.stringify(grant.proposal.event)))).toEqual(grant.proposal.event);

    const afterGrant = await fixtureReplayOrThrow(session.snapshot.canonical);
    await recordPrefix();
    expect(afterGrant.currentStep?.character).toBe("washerwoman");
    const washerwomanRows = afterGrant.phaseOverview.filter((row) => row.character === "washerwoman");
    expect(washerwomanRows.map((row) => row.playerId)).toEqual(["p2", "p1"]);
    expect(washerwomanRows.map((row) => row.abilityOrigin?.kind)).toEqual([
      "identityBound",
      "acquired",
    ]);
    expect(afterGrant.ruleState.abilityGrants).toHaveLength(1);
    expect(afterGrant.ruleState.abilityGrants?.[0]).toMatchObject({
      ownerPlayerId: "p1",
      characterId: "washerwoman",
      sourceEventId: grant.proposal.event.id,
      sourceAbilityInstanceId: "setup:p1",
    });

    const baseWasherwoman = await executeCurrent(session, null);
    expect(baseWasherwoman.proposal.event.type).toBe("customActionConfirmed");
    const afterBaseWasherwoman = await fixtureReplayOrThrow(session.snapshot.canonical);
    await recordPrefix();
    expect(afterBaseWasherwoman.currentStep?.playerId).toBe("p1");
    const acquiredWasherwoman = await executeCurrent(session, null);
    const afterAcquiredWasherwoman = await fixtureReplayOrThrow(session.snapshot.canonical);
    await recordPrefix();
    expect(afterAcquiredWasherwoman.phaseOverview.filter((row) => row.character === "washerwoman")
      .every((row) => row.status === "complete")).toBe(true);

    const loaded = await CustomCanonicalSession.load({ core: issue206FixtureWasmCore(), storage });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") return;
    expect((await fixtureReplayOrThrow(loaded.session.snapshot.canonical)).eventCount)
      .toBe(afterAcquiredWasherwoman.eventCount);

    for (const prefix of prefixes) {
      expect(await fixtureReplayOrThrow(prefix.canonical)).toEqual(prefix.state);
      const reloadedPrefix = await reloadFixturePrefix(definition, players, prefix.canonical);
      expect(reloadedPrefix).toEqual(prefix.state);
    }

    const undone = await loaded.session.undo(acquiredWasherwoman.proposal.event.id);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    await undone.value.autosave;
    expect(await fixtureReplayOrThrow(loaded.session.snapshot.canonical)).toEqual(afterBaseWasherwoman);

    const reloaded = await CustomCanonicalSession.load({
      core: issue206FixtureWasmCore(),
      storage,
    });
    expect(reloaded.status).toBe("loaded");
    if (reloaded.status !== "loaded") return;
    expect(await fixtureReplayOrThrow(reloaded.session.snapshot.canonical)).toEqual(afterBaseWasherwoman);
  });

  it("keeps proposal pure and rejects feature results at the production parser boundary", async () => {
    const definition = fixtureDefinition(
      "issue-206-proposal-purity",
      ["philosopher", "washerwoman"],
      ["demonInfo", "philosopher", "washerwoman", "minionInfo"],
    );
    const players = fixturePlayers(["philosopher"]);
    const { session } = await createFixtureSession(definition, players);
    const before = session.snapshot;
    const state = await fixtureReplayOrThrow(before.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "demonInfo" });
    if (!state.currentStep) throw new Error("fixture setup should expose demon info");

    const validInput = chooseRequiredCharacters(state);
    const validCommand: Command = {
      type: "confirmStep",
      payload: { stepId: state.currentStep.id, input: validInput },
    };
    const firstProposal = await issue206FixtureWasmCore().propose(before.canonical, validCommand);
    const repeatedProposal = await issue206FixtureWasmCore().propose(before.canonical, validCommand);
    expect(firstProposal.ok).toBe(true);
    expect(repeatedProposal).toEqual(firstProposal);
    expect(session.snapshot).toEqual(before);
    if (!firstProposal.ok) return;
    const afterDemon = withGameEvent(before.canonical, firstProposal.value.event);
    const afterDemonState = await fixtureReplayOrThrow(afterDemon);
    if (!afterDemonState.currentStep) throw new Error("fixture should expose the philosopher step");
    const customCommand: Command = {
      type: "confirmStep",
      payload: {
        stepId: afterDemonState.currentStep.id,
        input: { characterIds: ["washerwoman"] },
      },
    };
    const firstCustomProposal = await issue206FixtureWasmCore().propose(afterDemon, customCommand);
    const repeatedCustomProposal = await issue206FixtureWasmCore().propose(afterDemon, customCommand);
    expect(firstCustomProposal.ok).toBe(true);
    expect(repeatedCustomProposal).toEqual(firstCustomProposal);
    if (!firstCustomProposal.ok) return;
    expect(firstCustomProposal.value.event.type).toBe("customActionConfirmed");
    if (firstCustomProposal.value.event.type !== "customActionConfirmed") return;
    expect(firstCustomProposal.value.event.payload.result).toEqual({
      kind: "fixtureAbilityGranted",
      targetCharacterId: "washerwoman",
    });
    expect(session.snapshot).toEqual(before);

    const invalid = await issue206FixtureWasmCore().propose(before.canonical, {
      type: "confirmStep",
      payload: {
        stepId: state.currentStep.id,
        input: { characterIds: ["ravenkeeper"] },
      },
    });
    expectCoreError(invalid, "INVALID_STEP_INPUT");
    expect(session.snapshot).toEqual(before);

    const baseProductionValidator = await import("../src/core/customActionResultValidationBase.js");
    expect(baseProductionValidator.isCustomActionResult(
      { kind: "fixtureAbilityGranted", targetCharacterId: "washerwoman" },
      (value): value is string => typeof value === "string",
      () => false,
    )).toBe(false);
  });

  it("changes identity and instance atomically, and system information observes the new minion", async () => {
    const definition = fixtureDefinition(
      "issue-206-identity-info",
      ["librarian", "spy"],
      ["demonInfo", "librarian", "minionInfo", "spy"],
    );
    const { session } = await createFixtureSession(definition, fixturePlayers(["librarian"]));
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    const initialDemonInfo = await executeCurrent(session, chooseRequiredCharacters(state));
    const historicalDemonReveal = structuredClone(initialDemonInfo.proposal.revealPayload);
    expect(initialDemonInfo.proposal.revealPayload).toMatchObject({
      kind: "demonInformation",
      minionPlayers: [{ seat: 3, name: "scarletWoman" }],
    });

    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("librarian");
    const beforeIdentity = state.players.find((player) => player.id === "p1");
    expect(beforeIdentity).toMatchObject({
      actualCharacter: "librarian",
      shownCharacter: "librarian",
      alignment: "good",
      abilityInstance: { id: "setup:p1", characterId: "librarian" },
    });
    const identity = await executeCurrent(session, null);
    expect(identity.proposal.event.type).toBe("customActionConfirmed");
    if (identity.proposal.event.type !== "customActionConfirmed") return;
    expect(identity.proposal.event.payload.result).toEqual({
      kind: "fixtureIdentityChanged",
      playerId: "p1",
      targetCharacterId: "spy",
    });

    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    const afterIdentity = state.players.find((player) => player.id === "p1");
    expect(afterIdentity).toMatchObject({
      actualCharacter: "spy",
      shownCharacter: "spy",
      alignment: "evil",
      abilityInstance: {
        id: identity.proposal.event.id + ":p1",
        characterId: "spy",
        sourceEventId: identity.proposal.event.id,
      },
      identityHistory: [{
        sourceEventId: identity.proposal.event.id,
        phase: "firstNight",
        before: { actualCharacter: "librarian", shownCharacter: "librarian", alignment: "good" },
        after: { actualCharacter: "spy", shownCharacter: "spy", alignment: "evil" },
      }],
    });
    expect(afterIdentity?.abilityInstance?.id).not.toBe(beforeIdentity?.abilityInstance?.id);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.filter((row) => row.character === "librarian")).toEqual([
      expect.objectContaining({
        status: "complete",
        actionRef: { kind: "character", characterId: "librarian", actionId: "learnOutsider" },
        abilityUse: { ownerPlayerId: "p1", characterId: "librarian", abilityInstanceId: "setup:p1" },
      }),
    ]);

    const minionInfo = await executeCurrent(session, null);
    expect(minionInfo.proposal.revealPayload).toMatchObject({
      kind: "minionInformation",
      demonPlayers: [{ seat: 4, name: "imp" }],
      minionPlayers: [
        { seat: 1, name: "librarian" },
        { seat: 3, name: "scarletWoman" },
      ],
    });
    expect(historicalDemonReveal).toEqual(initialDemonInfo.proposal.revealPayload);
    const historicalEvent = session.snapshot.canonical.game.events.find(
      (event) => event.id === initialDemonInfo.proposal.event.id,
    );
    expect(historicalEvent).toMatchObject({
      type: "phaseStepConfirmed",
      payload: { stepId: "firstNight:system:demonInfo" },
    });
  });

  it("projects typed information generically and retains its historical result across a later change", async () => {
    const definition = fixtureDefinition(
      "issue-206-information-history",
      ["dreamer", "librarian", "spy"],
      ["demonInfo", "dreamer", "librarian", "minionInfo", "spy"],
    );
    const { session, storage } = await createFixtureSession(
      definition,
      fixturePlayers(["dreamer", "librarian"]),
    );
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("dreamer");

    const information = await executeCurrent(session, null);
    expect(information.proposal.event.type).toBe("customActionConfirmed");
    if (information.proposal.event.type !== "customActionConfirmed") return;
    expect(information.proposal.event.payload.result).toEqual({
      kind: "information",
      value: { kind: "characterPair", characterIds: ["dreamer", "dreamer"] },
    });
    expect(information.proposal.revealPayload).toEqual({
      kind: "dreamerInformation",
      characterIds: ["dreamer", "dreamer"],
    });
    expect(parseGameEvent(JSON.parse(JSON.stringify(information.proposal.event))))
      .toEqual(information.proposal.event);

    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("librarian");
    const identity = await executeCurrent(session, null);
    expect(identity.proposal.event.type).toBe("customActionConfirmed");
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.filter((row) => row.character === "dreamer")).toEqual([
      expect.objectContaining({
        status: "complete",
        abilityUse: { ownerPlayerId: "p1", characterId: "dreamer", abilityInstanceId: "setup:p1" },
      }),
    ]);

    const informationEvent = session.snapshot.canonical.game.events.find(
      (event) => event.id === information.proposal.event.id,
    );
    expect(informationEvent).toMatchObject({
      type: "customActionConfirmed",
      payload: { result: { kind: "information" } },
    });
    const loaded = await CustomCanonicalSession.load({ core: issue206FixtureWasmCore(), storage });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") return;
    expect(await fixtureReplayOrThrow(loaded.session.snapshot.canonical)).toEqual(state);
  });

  it("exercises JoinPending, RunImmediately, Defer, and NoAction with stable occurrence order", async () => {
    const cases: Array<{
      id: string;
      source: ActionToken;
      target: ActionToken;
      sequence: Array<ActionToken | SystemToken>;
      intermediate?: ActionToken;
      intermediateBeforeTarget?: boolean;
      expectedCurrent: "target" | "afterSource";
    }> = [
      {
        id: "join-pending",
        source: "philosopher",
        target: "washerwoman",
        sequence: ["demonInfo", "philosopher", "dreamer", "washerwoman", "minionInfo"],
        intermediate: "dreamer",
        intermediateBeforeTarget: true,
        expectedCurrent: "target",
      },
      {
        id: "run-immediately",
        source: "investigator",
        target: "spy",
        sequence: ["demonInfo", "investigator", "dreamer", "spy", "minionInfo"],
        intermediate: "dreamer",
        intermediateBeforeTarget: false,
        expectedCurrent: "target",
      },
      {
        id: "defer",
        source: "seamstress",
        target: "dreamer",
        sequence: ["demonInfo", "seamstress", "dreamer", "minionInfo"],
        expectedCurrent: "afterSource",
      },
      {
        id: "no-action",
        source: "empath",
        target: "mathematician",
        sequence: ["demonInfo", "empath", "mathematician", "minionInfo"],
        expectedCurrent: "afterSource",
      },
      {
        id: "join-past",
        source: "philosopher",
        target: "washerwoman",
        sequence: ["demonInfo", "washerwoman", "philosopher", "minionInfo"],
        expectedCurrent: "afterSource",
      },
    ];

    for (const scenario of cases) {
      const definition = fixtureDefinition(
        `issue-206-activation-${scenario.id}`,
        [scenario.source, scenario.target, ...(scenario.intermediate ? [scenario.intermediate] : [])],
        scenario.sequence,
      );
      const { session } = await createFixtureSession(
        definition,
        fixturePlayers([scenario.source, ...(scenario.intermediate ? [scenario.intermediate] : [])]),
      );
      await advanceToAction(session, scenario.source);
      const source = await executeCurrent(session, grantInput(scenario.target));
      expect(source.proposal.event.type).toBe("customActionConfirmed");
      if (source.proposal.event.type !== "customActionConfirmed") continue;
      expect(source.proposal.event.payload.result).toEqual({
        kind: "fixtureAbilityGranted",
        targetCharacterId: scenario.target === "spy"
          ? "spy"
          : scenario.target,
      });

      let state = await fixtureReplayOrThrow(session.snapshot.canonical);
      if (scenario.intermediate && scenario.intermediateBeforeTarget) {
        expect(state.currentStep?.character).toBe(scenario.intermediate);
        await executeCurrent(session, null);
        state = await fixtureReplayOrThrow(session.snapshot.canonical);
      }
      if (scenario.expectedCurrent === "target") {
        expect(state.currentStep?.character).toBe(scenario.target);
        const rows = state.phaseOverview.filter((row) => row.character === scenario.target);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ playerId: "p1" });
        await executeCurrent(session, null);
        state = await fixtureReplayOrThrow(session.snapshot.canonical);
        if (scenario.intermediate && !scenario.intermediateBeforeTarget) {
          expect(state.currentStep?.character).toBe(scenario.intermediate);
          await executeCurrent(session, null);
          state = await fixtureReplayOrThrow(session.snapshot.canonical);
        }
        expect(state.phaseOverview.filter((row) => row.character === scenario.target)
          .every((row) => row.status === "complete")).toBe(true);
      } else {
        expect(state.currentStep?.character).not.toBe(scenario.target);
        expect(state.phaseOverview.some((row) => row.character === scenario.target && row.status === "current"))
          .toBe(false);
      }
      expect(state.ruleState.abilityGrants?.filter((grant) => grant.characterId === scenario.target))
        .toHaveLength(1);
    }
  });

  it("undoes a pending acquisition and restores the original ordered prefix", async () => {
    const definition = fixtureDefinition(
      "issue-206-pending-undo",
      ["philosopher", "washerwoman"],
      ["demonInfo", "philosopher", "washerwoman", "minionInfo"],
    );
    const { session, storage } = await createFixtureSession(
      definition,
      fixturePlayers(["philosopher"]),
    );
    await advanceToAction(session, "philosopher");
    const grant = await executeCurrent(session, { characterIds: ["washerwoman"] });
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep).toMatchObject({ character: "washerwoman", playerId: "p1" });
    expect(state.ruleState.abilityGrants).toHaveLength(1);

    const undone = await session.undo(grant.proposal.event.id);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    await undone.value.autosave;
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep).toMatchObject({ character: "philosopher", playerId: "p1" });
    expect(state.ruleState.abilityGrants ?? []).toHaveLength(0);
    expect(state.phaseOverview.filter((row) => row.character === "washerwoman")).toEqual([]);

    const loaded = await CustomCanonicalSession.load({ core: issue206FixtureWasmCore(), storage });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") return;
    expect(await fixtureReplayOrThrow(loaded.session.snapshot.canonical)).toEqual(state);
  });

  it("removes a dead participating owner before its pending occurrence is projected", async () => {
    const definition = fixtureDefinition(
      "issue-206-life-pending",
      ["mathematician", "dreamer"],
      ["demonInfo", "mathematician", "dreamer", "minionInfo"],
    );
    const { session } = await createFixtureSession(
      definition,
      fixturePlayers(["mathematician", "dreamer"]),
    );
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep).toMatchObject({ character: "mathematician", playerId: "p1" });

    const beforeInvalidLife = session.snapshot;
    const invalidLife = await issue206FixtureWasmCore().propose(beforeInvalidLife.canonical, {
      type: "confirmStep",
      payload: {
        stepId: state.currentStep!.id,
        input: { playerIds: ["p2"], value: 7 } as unknown as PhaseStepInput,
      },
    });
    expectCoreError(invalidLife, "INVALID_STEP_INPUT");
    expect(session.snapshot).toEqual(beforeInvalidLife);

    const life = await executeCurrent(session, { playerIds: ["p2"] });
    expect(life.proposal.event.type).toBe("customActionConfirmed");
    if (life.proposal.event.type !== "customActionConfirmed") return;
    expect(life.proposal.event.payload.result).toEqual({
      kind: "fixtureLifeChanged",
      playerId: "p2",
      alive: false,
    });

    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.players.find((player) => player.id === "p2")).toMatchObject({ alive: false });
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.filter((row) => row.character === "mathematician")).toEqual([
      expect.objectContaining({ playerId: "p1", status: "complete" }),
    ]);
    expect(state.phaseOverview.filter((row) => row.character === "dreamer")).toEqual([]);
  });

  it("keeps an impaired Washerwoman occurrence while suppressing an impaired Mathematician", async () => {
    const washerwomanDefinition = fixtureDefinition(
      "issue-206-impairment-participation-washerwoman",
      ["clockmaker", "washerwoman"],
      ["demonInfo", "clockmaker", "washerwoman", "minionInfo"],
    );
    const washerwomanSession = await createFixtureSession(
      washerwomanDefinition,
      fixturePlayers(["clockmaker", "washerwoman"]),
    );
    let state = await fixtureReplayOrThrow(washerwomanSession.session.snapshot.canonical);
    await executeCurrent(washerwomanSession.session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(washerwomanSession.session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("clockmaker");

    const beforeInvalidImpairment = washerwomanSession.session.snapshot;
    const invalidImpairment = await issue206FixtureWasmCore().propose(
      beforeInvalidImpairment.canonical,
      {
        type: "confirmStep",
        payload: {
          stepId: state.currentStep!.id,
          input: { playerIds: ["p2"], value: 7 } as unknown as PhaseStepInput,
        },
      },
    );
    expectCoreError(invalidImpairment, "INVALID_STEP_INPUT");
    expect(washerwomanSession.session.snapshot).toEqual(beforeInvalidImpairment);

    const add = await executeCurrent(washerwomanSession.session, { playerIds: ["p2"] });
    expect(add.proposal.event.type).toBe("customActionConfirmed");
    if (add.proposal.event.type !== "customActionConfirmed") return;
    expect(add.proposal.event.payload.result).toEqual({
      kind: "fixtureImpairmentAdded",
      playerId: "p2",
      impairmentKind: "poisoned",
    });
    state = await fixtureReplayOrThrow(washerwomanSession.session.snapshot.canonical);
    expect(state.currentStep).toMatchObject({ character: "washerwoman", playerId: "p2" });
    expect(state.ruleState.activeImpairments).toEqual([{
      kind: "poisoned",
      playerId: "p2",
      sourceEventId: add.proposal.event.id,
      sourceCharacterId: "clockmaker",
      expires: "never",
    }]);
    await executeCurrent(washerwomanSession.session, null);
    state = await fixtureReplayOrThrow(washerwomanSession.session.snapshot.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.filter((row) => row.character === "washerwoman")).toEqual([
      expect.objectContaining({ playerId: "p2", status: "complete" }),
    ]);

    const mathematicianDefinition = fixtureDefinition(
      "issue-206-impairment-participation-mathematician",
      ["clockmaker", "mathematician"],
      ["demonInfo", "clockmaker", "mathematician", "minionInfo"],
    );
    const mathematicianSession = await createFixtureSession(
      mathematicianDefinition,
      fixturePlayers(["clockmaker", "mathematician"]),
    );
    state = await fixtureReplayOrThrow(mathematicianSession.session.snapshot.canonical);
    await executeCurrent(mathematicianSession.session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(mathematicianSession.session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("clockmaker");
    await executeCurrent(mathematicianSession.session, { playerIds: ["p2"] });
    state = await fixtureReplayOrThrow(mathematicianSession.session.snapshot.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.some((row) => row.character === "mathematician" && row.status === "current"))
      .toBe(false);
  });

  it("removes an impairment with the exact source provenance through the shared envelope", async () => {
    const definition = fixtureDefinition(
      "issue-206-impairment-removal",
      ["clockmaker", "spy"],
      ["demonInfo", "clockmaker", "spy", "minionInfo"],
    );
    const { session } = await createFixtureSession(definition, fixturePlayers(["clockmaker", "spy"]));
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    const add = await executeCurrent(session, { playerIds: ["p2"] });
    expect(add.proposal.event.type).toBe("customActionConfirmed");
    if (add.proposal.event.type !== "customActionConfirmed") return;
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep).toMatchObject({ character: "spy", playerId: "p2" });
    const remove = await executeCurrent(session, null);
    expect(remove.proposal.event.type).toBe("customActionConfirmed");
    if (remove.proposal.event.type !== "customActionConfirmed") return;
    expect(remove.proposal.event.payload.result).toEqual({
      kind: "fixtureImpairmentRemoved",
      playerId: "p2",
      impairmentKind: "poisoned",
      sourceEventId: add.proposal.event.id,
      sourceCharacterId: "clockmaker",
      expires: "never",
    });
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.ruleState.activeImpairments ?? []).toHaveLength(0);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
  });

  it("retains a completed acquired row after the source removes the ability", async () => {
    const definition = fixtureDefinition(
      "issue-206-loss-history",
      ["philosopher", "washerwoman", "chef"],
      ["demonInfo", "philosopher", "washerwoman", "chef", "minionInfo"],
    );
    const { session, storage } = await createFixtureSession(
      definition,
      fixturePlayers(["philosopher", "chef"]),
    );
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    const grant = await executeCurrent(session, { characterIds: ["washerwoman"] });
    expect(grant.proposal.event.type).toBe("customActionConfirmed");
    if (grant.proposal.event.type !== "customActionConfirmed") return;
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("washerwoman");
    const acquired = await executeCurrent(session, null);
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.character).toBe("chef");
    const acquiredInstanceId = state.phaseOverview.find((row) => row.character === "washerwoman")
      ?.abilityUse?.abilityInstanceId;
    const loss = await executeCurrent(session, null);
    expect(loss.proposal.event.type).toBe("customActionConfirmed");
    if (loss.proposal.event.type !== "customActionConfirmed") return;
    expect(loss.proposal.event.payload.result).toEqual({
      kind: "fixtureAbilityRemoved",
      ownerPlayerId: "p1",
      characterId: "washerwoman",
      abilityInstanceId: acquiredInstanceId,
    });
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.ruleState.abilityGrants ?? []).toHaveLength(0);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    expect(state.phaseOverview.filter((row) => row.character === "washerwoman")).toEqual([
      expect.objectContaining({
        status: "complete",
        playerId: "p1",
        abilityOrigin: expect.objectContaining({ kind: "acquired", acquisitionEventId: grant.proposal.event.id }),
      }),
    ]);
    const loaded = await CustomCanonicalSession.load({ core: issue206FixtureWasmCore(), storage });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") return;
    expect(await fixtureReplayOrThrow(loaded.session.snapshot.canonical)).toEqual(state);
  });

  it("rejects setup, identity, and grant membership outside the custom definition", async () => {
    const setupDefinition = fixtureDefinition(
      "issue-206-setup-membership",
      ["philosopher"],
      ["demonInfo", "philosopher", "minionInfo"],
    );
    const empty = createCustomGameFile(
      setupDefinition,
      "issue-206-setup-membership-game",
      new Date("2026-09-07T00:00:00.000Z"),
    );
    const setupResult = await issue206FixtureWasmCore().propose(empty, {
      type: "createGame",
      payload: { players: fixturePlayers(["librarian"]) },
    });
    expectCoreError(setupResult, "CHARACTER_NOT_IN_SCRIPT");

    const grantSourceDefinition = fixtureDefinition(
      "issue-206-grant-membership-source",
      ["philosopher", "washerwoman"],
      ["demonInfo", "philosopher", "washerwoman", "minionInfo"],
    );
    const grantSource = await createFixtureSession(
      grantSourceDefinition,
      fixturePlayers(["philosopher"]),
    );
    let state = await fixtureReplayOrThrow(grantSource.session.snapshot.canonical);
    await executeCurrent(grantSource.session, chooseRequiredCharacters(state));
    const sourcePrefix = grantSource.session.snapshot.canonical;
    state = await fixtureReplayOrThrow(sourcePrefix);
    if (!state.currentStep) throw new Error("fixture should expose the philosopher step");
    const validGrant = await fixtureProposeOrThrow(sourcePrefix, {
      type: "confirmStep",
      payload: { stepId: state.currentStep.id, input: { characterIds: ["washerwoman"] } },
    });

    const missingGrantDefinition = fixtureDefinition(
      "issue-206-grant-membership-missing",
      ["philosopher"],
      ["demonInfo", "philosopher", "minionInfo"],
    );
    const missingGrant = await createFixtureSession(
      missingGrantDefinition,
      fixturePlayers(["philosopher"]),
    );
    state = await fixtureReplayOrThrow(missingGrant.session.snapshot.canonical);
    await executeCurrent(missingGrant.session, chooseRequiredCharacters(state));
    const missingGrantPrefix = missingGrant.session.snapshot.canonical;
    state = await fixtureReplayOrThrow(missingGrantPrefix);
    if (!state.currentStep) throw new Error("fixture should expose the missing grant step");
    const grantProposal = await issue206FixtureWasmCore().propose(missingGrantPrefix, {
      type: "confirmStep",
      payload: { stepId: state.currentStep.id, input: { characterIds: ["washerwoman"] } },
    });
    expectCoreError(grantProposal, "CHARACTER_NOT_IN_SCRIPT");
    expectCoreError(
      await issue206FixtureWasmCore().replay(withEvent(missingGrantPrefix, cloneMutableEvent(validGrant.event))),
      "CHARACTER_NOT_IN_SCRIPT",
    );

    const identitySourceDefinition = fixtureDefinition(
      "issue-206-identity-membership-source",
      ["librarian", "spy"],
      ["demonInfo", "librarian", "minionInfo", "spy"],
    );
    const identitySource = await createFixtureSession(
      identitySourceDefinition,
      fixturePlayers(["librarian"]),
    );
    state = await fixtureReplayOrThrow(identitySource.session.snapshot.canonical);
    await executeCurrent(identitySource.session, chooseRequiredCharacters(state));
    const identityPrefix = identitySource.session.snapshot.canonical;
    state = await fixtureReplayOrThrow(identityPrefix);
    if (!state.currentStep) throw new Error("fixture should expose the librarian step");
    const validIdentity = await fixtureProposeOrThrow(identityPrefix, {
      type: "confirmStep",
      payload: { stepId: state.currentStep.id, input: null },
    });

    const missingIdentityDefinition = fixtureDefinition(
      "issue-206-identity-membership-missing",
      ["librarian"],
      ["demonInfo", "librarian", "minionInfo"],
    );
    const missingIdentity = await createFixtureSession(
      missingIdentityDefinition,
      fixturePlayers(["librarian"]),
    );
    state = await fixtureReplayOrThrow(missingIdentity.session.snapshot.canonical);
    await executeCurrent(missingIdentity.session, chooseRequiredCharacters(state));
    const missingIdentityPrefix = missingIdentity.session.snapshot.canonical;
    state = await fixtureReplayOrThrow(missingIdentityPrefix);
    if (!state.currentStep) throw new Error("fixture should expose the missing identity step");
    const identityProposal = await issue206FixtureWasmCore().propose(missingIdentityPrefix, {
      type: "confirmStep",
      payload: { stepId: state.currentStep.id, input: null },
    });
    expectCoreError(identityProposal, "CHARACTER_NOT_IN_SCRIPT");
    expectCoreError(
      await issue206FixtureWasmCore().replay(
        withEvent(missingIdentityPrefix, cloneMutableEvent(validIdentity.event)),
      ),
      "CHARACTER_NOT_IN_SCRIPT",
    );
  });

  it("rejects events before setup and after dawn without adopting a partial session", async () => {
    const definition = fixtureDefinition(
      "issue-206-lifecycle-boundary",
      ["philosopher", "washerwoman", "librarian"],
      ["demonInfo", "philosopher", "washerwoman", "librarian", "minionInfo"],
    );
    const { session, storage } = await createFixtureSession(definition, fixturePlayers([]));
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "minionInfo" });
    await executeCurrent(session, null);
    state = await fixtureReplayOrThrow(session.snapshot.canonical);
    expect(state.currentStep?.actionRef).toEqual({ kind: "system", actionId: "dawn" });
    const dawn = await executeCurrent(session, null);
    const dayCanonical = session.snapshot.canonical;
    const dayState = await fixtureReplayOrThrow(dayCanonical);
    expect(dayState.phase).toBe("day");
    expect(dayState.currentStep).toBeNull();

    const postDawn = structuredClone(dawn.proposal.event) as GameEvent;
    postDawn.id = "phase-step-post-dawn";
    expectCoreError(
      await issue206FixtureWasmCore().replay(withGameEvent(dayCanonical, postDawn)),
      "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
    );
    const customBoundaryEvent = {
      id: "custom-action-post-dawn",
      type: "customActionConfirmed",
      phase: "firstNight",
      payload: {
        stepId: "firstNight:philosopher:chooseAbility:owner2:p1:instance8:setup:p1",
        actionRef: {
          kind: "character",
          characterId: "philosopher",
          actionId: "chooseAbility",
        },
        abilityUse: {
          ownerPlayerId: "p1",
          characterId: "philosopher",
          abilityInstanceId: "setup:p1",
        },
        input: { characterIds: ["washerwoman"] },
        result: { kind: "fixtureAbilityGranted", targetCharacterId: "washerwoman" },
      },
      summary: "custom post-dawn event",
      createdAt: "2026-09-07T00:00:00.000Z",
    } as unknown as GameEvent;
    expect(parseGameEvent(customBoundaryEvent)).toEqual(customBoundaryEvent);
    expectCoreError(
      await issue206FixtureWasmCore().replay(withGameEvent(dayCanonical, customBoundaryEvent)),
      "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
    );

    const beforeRejectedExecute = session.snapshot;
    const beforeStored = await storage.loadSession();
    expect(beforeStored.status).toBe("loaded");
    const rejectedExecute = await session.execute({
      type: "confirmStep",
      payload: { stepId: "firstNight:system:dawn", input: null },
    });
    expectCoreError(rejectedExecute, "NO_CURRENT_STEP");
    expect(session.snapshot).toEqual(beforeRejectedExecute);
    const afterStored = await storage.loadSession();
    expect(afterStored).toEqual(beforeStored);

    const controller = new CanonicalSessionController(
      dayCanonical.game.script,
      issue206FixtureWasmCore(),
    );
    const replayedDay = await controller.replay(dayCanonical);
    expect(replayedDay.ok).toBe(true);
    if (!replayedDay.ok) return;
    const failedApply = await controller.apply(dayCanonical, replayedDay.value, postDawn);
    expectCoreError(failedApply, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");
    expect(dayCanonical).toEqual(beforeRejectedExecute.canonical);

    const setupOnly = createCustomGameFile(
      definition,
      "issue-206-before-setup",
      new Date("2026-09-07T00:00:00.000Z"),
    );
    expectCoreError(
      await issue206FixtureWasmCore().replay(withGameEvent(setupOnly, postDawn)),
      "REPLAY_FAILED",
    );
    expectCoreError(
      await issue206FixtureWasmCore().replay(withGameEvent(setupOnly, customBoundaryEvent)),
      "REPLAY_FAILED",
    );
  });

  it("rejects envelope tampering and keeps the session prefix after a failed apply", async () => {
    const definition = fixtureDefinition(
      "issue-206-envelope-boundary",
      ["philosopher", "washerwoman"],
      ["demonInfo", "philosopher", "washerwoman", "minionInfo"],
    );
    const { session } = await createFixtureSession(definition, fixturePlayers(["philosopher"]));
    let state = await fixtureReplayOrThrow(session.snapshot.canonical);
    await executeCurrent(session, chooseRequiredCharacters(state));
    const prefix = session.snapshot.canonical;
    state = await fixtureReplayOrThrow(prefix);
    if (!state.currentStep) throw new Error("fixture should expose the philosopher step");
    const validProposal = await fixtureProposeOrThrow(prefix, {
      type: "confirmStep",
      payload: {
        stepId: state.currentStep.id,
        input: { characterIds: ["washerwoman"] },
      },
    });
    const validEvent = validProposal.event;

    const semanticMutations: Array<{
      name: string;
      code: string;
      mutate: (event: MutableEvent) => void;
    }> = [
      {
        name: "stepId",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => { event.payload.stepId = `${event.payload.stepId}:forged`; },
      },
      {
        name: "actionRef",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => {
          event.payload.actionRef = {
            kind: "character",
            characterId: "philosopher",
            actionId: "differentAction",
          };
        },
      },
      {
        name: "actor",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => { event.payload.abilityUse.ownerPlayerId = "p2"; },
      },
      {
        name: "instance",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => { event.payload.abilityUse.abilityInstanceId = "forged:p2"; },
      },
      {
        name: "input",
        code: "INVALID_STEP_INPUT",
        mutate: (event) => { event.payload.input = { characterIds: ["ravenkeeper"] }; },
      },
      {
        name: "result-discriminant",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => { event.payload.result = { kind: "noEffect" }; },
      },
      {
        name: "result-value",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => {
          event.payload.result = { kind: "fixtureAbilityGranted", targetCharacterId: "librarian" };
        },
      },
      {
        name: "different-registered-result",
        code: "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        mutate: (event) => {
          event.payload.result = {
            kind: "fixtureIdentityChanged",
            playerId: "p1",
            targetCharacterId: "spy",
          };
        },
      },
    ];
    for (const mutation of semanticMutations) {
      const tampered = cloneMutableEvent(validEvent);
      mutation.mutate(tampered);
      expect(parseGameEvent(tampered)).toEqual(tampered);
      const replayed = await issue206FixtureWasmCore().replay(withEvent(prefix, tampered));
      expectCoreError(replayed, mutation.code);
    }

    const structuralMutations: Array<{
      name: string;
      mutate: (event: MutableEvent) => void;
    }> = [
      {
        name: "common event field",
        mutate: (event) => { event.unexpected = true; },
      },
      {
        name: "payload field",
        mutate: (event) => { event.payload.unexpected = true; },
      },
      {
        name: "missing required result",
        mutate: (event) => { delete event.payload.result; },
      },
      {
        name: "missing required abilityUse",
        mutate: (event) => { delete (event.payload as Record<string, unknown>).abilityUse; },
      },
      {
        name: "missing required actionRef",
        mutate: (event) => { delete (event.payload as Record<string, unknown>).actionRef; },
      },
      {
        name: "missing required input",
        mutate: (event) => { delete (event.payload as Record<string, unknown>).input; },
      },
      {
        name: "arbitrary state patch input",
        mutate: (event) => { event.payload.input = { patch: { alive: false } }; },
      },
      {
        name: "negative information value",
        mutate: (event) => {
          event.payload.result = { kind: "information", value: { kind: "number", value: -1 } };
        },
      },
    ];
    for (const mutation of structuralMutations) {
      const tampered = cloneMutableEvent(validEvent);
      mutation.mutate(tampered);
      expect(() => parseGameEvent(tampered), mutation.name).toThrow();
      const replayed = await issue206FixtureWasmCore().replay(withEvent(prefix, tampered));
      expectCoreError(replayed, "MALFORMED_EVENT");
    }

    const wrongPhase = cloneMutableEvent(validEvent);
    wrongPhase.phase = "setup";
    expect(parseGameEvent(wrongPhase)).toEqual(wrongPhase);
    expectCoreError(
      await issue206FixtureWasmCore().replay(withEvent(prefix, wrongPhase)),
      "MALFORMED_EVENT",
    );

    const controller = new CanonicalSessionController(prefix.game.script, issue206FixtureWasmCore());
    const replayedPrefix = await controller.replay(prefix);
    expect(replayedPrefix.ok).toBe(true);
    if (!replayedPrefix.ok) return;
    const prefixBeforeApply = structuredClone(prefix);
    const replayBeforeApply = structuredClone(replayedPrefix.value);
    const lateFailure = cloneMutableEvent(validEvent);
    lateFailure.payload.result = { kind: "noEffect" };
    const failedApply = await controller.apply(
      prefix,
      replayedPrefix.value,
      lateFailure as unknown as GameEvent,
    );
    expectCoreError(failedApply, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");
    expect(prefix).toEqual(prefixBeforeApply);
    expect(replayedPrefix.value).toEqual(replayBeforeApply);
    expect(session.snapshot.canonical).toEqual(prefix);
    expect(await fixtureReplayOrThrow(session.snapshot.canonical)).toEqual(
      await fixtureReplayOrThrow(prefix),
    );
  });
});

type MutableEvent = {
  id: string;
  type: string;
  phase: string;
  payload: {
    stepId: string;
    actionRef: Record<string, string>;
    abilityUse: { ownerPlayerId: string; characterId: string; abilityInstanceId: string };
    input?: unknown;
    result?: unknown;
    [key: string]: unknown;
  };
  summary: string;
  createdAt: string;
  [key: string]: unknown;
};

function cloneMutableEvent(event: GameEvent): MutableEvent {
  return structuredClone(event) as unknown as MutableEvent;
}

function withEvent(prefix: GameFileV4, event: MutableEvent): GameFileV4 {
  return withGameEvent(prefix, event as unknown as GameEvent);
}

function withGameEvent(prefix: GameFileV4, event: GameEvent): GameFileV4 {
  return {
    ...prefix,
    game: {
      ...prefix.game,
      events: [...prefix.game.events, event],
    },
  };
}

async function createFixtureSession(
  definition: CustomScriptDefinition,
  players: SetupPlayerInput[],
) {
  const storage = new IndexedDbCustomWebSessionStorageDriver<
    { players: SetupPlayerInput[] },
    { activeTab: string }
  >(
    definition.id,
    new IDBFactory(),
  );
  const session = CustomCanonicalSession.create<
    { players: SetupPlayerInput[] },
    { activeTab: string }
  >({
    definition,
    core: issue206FixtureWasmCore(),
    storage,
    setupDraft: { players },
    presentation: { activeTab: "setup" },
    gameId: definition.id,
    now: new Date("2026-09-07T00:00:00.000Z"),
  });
  const setup = await session.confirmSetup({
    type: "createGame",
    payload: { players },
  });
  if (!setup.ok) throw new Error(`${setup.error.code}: ${setup.error.messageKo}`);
  return { session, storage, setup };
}

async function reloadFixturePrefix(
  definition: CustomScriptDefinition,
  players: SetupPlayerInput[],
  canonical: GameFileV4,
): Promise<ReplayState> {
  const storage = new IndexedDbCustomWebSessionStorageDriver<
    { players: SetupPlayerInput[] },
    { activeTab: string }
  >(definition.id, new IDBFactory());
  const snapshot = createCustomWebSessionSnapshot(
    canonical,
    { players },
    { activeTab: "play" },
    "2026-09-07T00:00:00.000Z",
  );
  await storage.saveSession(snapshot);
  const loaded = await CustomCanonicalSession.load({ core: issue206FixtureWasmCore(), storage });
  if (loaded.status !== "loaded") {
    throw new Error(`fixture prefix reload failed: ${loaded.status}`);
  }
  return fixtureReplayOrThrow(loaded.session.snapshot.canonical);
}

async function executeCurrent(
  session: CustomCanonicalSession<{ players: SetupPlayerInput[] }, { activeTab: string }>,
  input: PhaseStepInput,
) {
  const state = await fixtureReplayOrThrow(session.snapshot.canonical);
  if (!state.currentStep) throw new Error("fixture scenario reached the end unexpectedly");
  const command: Command = {
    type: "confirmStep",
    payload: { stepId: state.currentStep.id, input },
  };
  const executed = await session.execute(command);
  if (!executed.ok) throw new Error(`${executed.error.code}: ${executed.error.messageKo}`);
  if (!await executed.value.autosave) throw new Error("fixture session autosave failed");
  return executed.value;
}

function fixtureDefinition(
  id: string,
  actionCharacters: ActionToken[],
  sequence: Array<ActionToken | SystemToken>,
): CustomScriptDefinition {
  // Keep the custom setup distribution valid with no-owner roles that have no first-night action.
  // Scenario-specific action refs stay literal so an unrelated handler never changes the current
  // step sequence.
  const requiredActionCharacters = [...new Set(actionCharacters)] as ActionToken[];
  const characterIds = [...requiredActionCharacters, "imp", "saint", "scarletWoman", ...BLUFF_CANDIDATES];
  const uniqueCharacterIds = [...new Set(characterIds)];
  const expectedActions = new Set(requiredActionCharacters);
  if (sequence.filter(isActionToken).some((token) => !expectedActions.has(token)) ||
      new Set(sequence.filter(isActionToken)).size !== expectedActions.size) {
    throw new Error("fixture order references an action outside the definition");
  }
  const firstNightOrder = [
    system("dusk"),
    ...sequence.map((token) => isActionToken(token)
      ? character(token, ACTIONS[token])
      : system(token)),
    system("dawn"),
  ];
  return {
    id,
    name: id,
    characterIds: uniqueCharacterIds,
    firstNightOrder,
  };
}

function fixturePlayers(actualCharacters: string[]): SetupPlayerInput[] {
  const roster = [...actualCharacters];
  // Use an ordinary eight-player distribution (five Townsfolk, one Outsider, one Minion, one
  // Demon). This keeps every generated fixture setup valid while leaving the remaining catalog
  // roles available as demon bluffs.
  if (!roster.some((characterId) => ["butler", "saint"].includes(characterId))) roster.push("saint");
  if (!roster.some((characterId) => ["spy", "scarletWoman"].includes(characterId))) {
    roster.push("scarletWoman");
  }
  if (!roster.includes("imp")) roster.push("imp");
  const fillers = BLUFF_CANDIDATES.filter((characterId) =>
    !["saint"].includes(characterId) && !roster.includes(characterId));
  const townsfolkCount = () => roster.filter((characterId) =>
    !["butler", "saint", "spy", "scarletWoman", "imp"].includes(characterId)).length;
  for (const filler of fillers) {
    if (townsfolkCount() >= 5) break;
    roster.push(filler);
  }
  if (townsfolkCount() < 5) throw new Error("fixture setup must contain five Townsfolk");
  return roster.map((actualCharacter, index) => ({
    id: `p${index + 1}`,
    seat: index + 1,
    name: actualCharacter,
    actualCharacter,
    shownCharacter: actualCharacter,
  }));
}

function expectCoreError<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; messageKo: string } },
  code: string,
): asserts result is { ok: false; error: { code: string; messageKo: string } } {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
}

function system(actionId: "dusk" | "minionInfo" | "demonInfo" | "dawn"): FirstNightActionRef {
  return { kind: "system", actionId };
}

function isActionToken(token: ActionToken | SystemToken): token is ActionToken {
  return Object.hasOwn(ACTIONS, token);
}

function chooseRequiredCharacters(state: ReplayState): PhaseStepInput {
  if (state.currentStep?.requiredInput.kind !== "characterIds") {
    throw new Error("fixture system step should request character IDs");
  }
  const allowed = state.currentStep.requiredInput.allowedCharacterIds ?? [];
  if (allowed.length < 3) throw new Error("fixture requires three literal demon bluffs");
  return { characterIds: allowed.slice(0, 3) };
}

function grantInput(target: ActionToken): PhaseStepInput {
  const targetCharacterId = target === "spy" ? "spy" : target;
  return { characterIds: [targetCharacterId] };
}

async function advanceToAction(
  session: CustomCanonicalSession<{ players: SetupPlayerInput[] }, { activeTab: string }>,
  characterId: ActionToken,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await fixtureReplayOrThrow(session.snapshot.canonical);
    const step = state.currentStep;
    if (!step) throw new Error(`could not reach ${characterId}`);
    if (step.character === characterId) return;
    const input = step.requiredInput.kind === "characterIds"
      ? chooseRequiredCharacters(state)
      : null;
    await executeCurrent(session, input);
  }
  throw new Error(`fixture action ${characterId} did not become current`);
}

function character(characterId: string, actionId: string): FirstNightActionRef {
  return { kind: "character", characterId, actionId };
}
