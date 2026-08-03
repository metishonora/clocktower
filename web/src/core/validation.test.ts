import { deepEqual, equal, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { importGameFileJson } from "../gameStorage.js";
import { TROUBLE_BREWING } from "./scripts.js";
import {
  parseCoreResult,
  parseGameEvent,
  parsePhaseInputSuggestion,
  parseProposal,
  parseReplayState,
} from "./validation.js";

test("imports schema-v2 events as typed GameEvent values", () => {
  const gameFile = importGameFileJson(JSON.stringify(schemaV2Fixture()), TROUBLE_BREWING);

  equal(gameFile.schemaVersion, 3);
  equal(gameFile.game.scriptId, TROUBLE_BREWING);
  equal(gameFile.game.events.length, 8);
  equal(gameFile.game.events[0]?.type, "setupConfirmed");
  equal(gameFile.game.events[7]?.type, "phaseStepConfirmed");
});

test("accepts the S&V manual phase support and replayable outcomes", () => {
  const manualEvent = {
    id: "phase-2",
    type: "manualPhaseStepResolved",
    phase: "firstNight",
    payload: { stepId: "firstNight:philosopher", outcome: "handled" },
    summary: "수동 단계 처리: firstNight:philosopher",
    createdAt: "2026-07-22T00:00:00.000Z",
  };
  equal(parseGameEvent(manualEvent).type, "manualPhaseStepResolved");

  const manualStep = {
    id: "firstNight:philosopher",
    phase: "firstNight",
    stepType: "character",
    character: "philosopher",
    playerId: "player-1",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    support: "manual",
  };
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "firstNight",
    players: [],
    currentStep: { ...manualStep, id: "firstNight:minionInfo", support: "automated" },
    phaseOverview: [
      { ...manualStep, status: "manualComplete" },
      { ...manualStep, id: "firstNight:minionInfo", support: "automated", status: "current" },
      { ...manualStep, id: "firstNight:snakeCharmer", status: "notApplicable" },
    ],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };

  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("accepts only the canonical Philosopher resolution and grant references", () => {
  const event = {
    id: "phase-2",
    type: "philosopherAbilityResolved",
    phase: "firstNight",
    payload: {
      stepId: "firstNight:philosopher",
      actor: {
        ownerPlayerId: "player-1",
        characterId: "philosopher",
        abilityInstanceId: "setup:player-1",
      },
      selectedCharacterId: "dreamer",
      outcome: { kind: "acquired", grantedAbilityInstanceId: "phase-2:player-1" },
    },
    summary: "철학자 능력 획득: dreamer",
    createdAt: "2026-08-04T00:00:00.000Z",
  };
  equal(parseGameEvent(event).type, "philosopherAbilityResolved");
  throws(() => parseGameEvent({
    ...event,
    payload: { ...event.payload, outcome: { kind: "acquired" } },
  }));
  throws(() => parseGameEvent({
    ...event,
    payload: { ...event.payload, forgedTargetPlayerId: "player-2" },
  }));
});

test("accepts Philosopher grants and automatic reminder tokens in replay state", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "firstNight",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      abilityGrants: [{
        ownerPlayerId: "player-6",
        characterId: "savant",
        sourceEventId: "phase-2",
        sourceAbilityInstanceId: "setup:player-6",
        abilityInstanceId: "phase-2:player-6",
      }],
      automaticReminders: [{
        playerId: "player-9",
        characterId: "philosopher",
        tokenId: "drunk",
        label: "취함",
        description: "철학자의 능력으로 취했습니다.",
      }],
    },
    warnings: [],
    gameEnd: null,
  };

  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("accepts canonical Vortox and impaired numeric constraints", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "firstNight",
    players: [],
    currentStep: {
      id: "firstNight:clockmaker",
      phase: "firstNight",
      stepType: "character",
      character: "clockmaker",
      playerId: "player-1",
      requiredInput: { kind: "none", optional: false },
      canSkip: false,
      support: "automated",
      informationPrompt: {
        computedResult: { kind: "number", value: 2 },
        deliveryMode: "selectable",
        activeReasons: [{ type: "vortox", demonPlayerId: "player-7" }],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        numberConstraint: {
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          excludedValues: [2],
        },
        booleanChoices: [],
        setupInfoRegistrationOptions: [],
        targetChecks: [],
      },
    },
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };
  deepEqual<unknown>(parseReplayState(replay).currentStep, replay.currentStep);

  const poisoned = structuredClone(replay);
  poisoned.currentStep.informationPrompt.activeReasons = [{
    type: "poisoned",
    poisonerPlayerId: "player-4",
    poisonEventId: "poison-1",
  }] as unknown as typeof poisoned.currentStep.informationPrompt.activeReasons;
  poisoned.currentStep.informationPrompt.numberConstraint.excludedValues = [];
  deepEqual<unknown>(parseReplayState(poisoned).currentStep, poisoned.currentStep);

  const unsafeMaximum = structuredClone(replay);
  unsafeMaximum.currentStep.informationPrompt.numberConstraint.max = Number.MAX_SAFE_INTEGER + 1;
  throws(() => parseReplayState(unsafeMaximum), /코어 응답 형식/);

  const truthNotExcluded = structuredClone(replay);
  truthNotExcluded.currentStep.informationPrompt.numberConstraint.excludedValues = [3];
  throws(() => parseReplayState(truthNotExcluded), /코어 응답 형식/);

  const ended = {
    id: "game-ended-3",
    type: "gameEnded",
    phase: "day",
    payload: {
      winningTeam: "evil",
      source: { kind: "vortoxNoExecution", sourceEventId: "execution-2" },
    },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-31T00:00:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(ended), ended);
});

test("accepts the Snake Charmer swap event, identity history, impairment, and pending reveals", () => {
  const beforeSnake = { actualCharacter: "snakeCharmer", shownCharacter: "snakeCharmer", alignment: "good" };
  const afterSnake = { actualCharacter: "vigormortis", shownCharacter: "vigormortis", alignment: "evil" };
  const beforeDemon = { actualCharacter: "vigormortis", shownCharacter: "vigormortis", alignment: "evil" };
  const afterDemon = { actualCharacter: "snakeCharmer", shownCharacter: "snakeCharmer", alignment: "good" };
  const impairment = {
    kind: "poisoned",
    playerId: "player-7",
    sourceEventId: "snake-1",
    sourceCharacterId: "snakeCharmer",
    expires: "never",
  };
  const event = {
    id: "snake-1",
    type: "snakeCharmerActionResolved",
    phase: "night",
    payload: {
      stepId: "night:snakeCharmer:player-1",
      actorPlayerId: "player-1",
      targetPlayerId: "player-7",
      outcome: {
        kind: "swap",
        identityTransitions: [
          { playerId: "player-1", before: beforeSnake, after: afterSnake },
          { playerId: "player-7", before: beforeDemon, after: afterDemon },
        ],
        impairment,
      },
    },
    summary: "뱀 조련사 교환",
    createdAt: "2026-07-23T00:00:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(event), event);

  const player = {
    id: "player-1",
    seat: 1,
    name: "민서",
    ...afterSnake,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
    identityHistory: [{ sourceEventId: "snake-1", phase: "night", before: beforeSnake, after: afterSnake }],
  };
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 3,
    phase: "night",
    players: [player],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [], activeImpairments: [impairment] },
    warnings: [],
    gameEnd: null,
    pendingIdentityReveals: [
      {
        sourceEventId: "snake-1",
        sequence: 1,
        payload: { kind: "characterChange", playerId: "player-1", alignment: "evil", characterId: "vigormortis" },
      },
    ],
  };
  deepEqual<unknown>(parseReplayState(replay), replay);
  const madnessReveal: unknown = {
    ...structuredClone(replay),
    pendingIdentityReveals: [{
      sourceEventId: "cerenovus-1",
      sequence: 1,
      payload: { kind: "madnessAssignment", playerId: "player-1", characterId: "artist" },
    }],
  };
  deepEqual<unknown>(parseReplayState(madnessReveal), madnessReveal);
  const outOfOrder = structuredClone(replay);
  outOfOrder.pendingIdentityReveals[0].sequence = 2;
  throws(() => parseReplayState(outOfOrder), /코어 응답 형식/);
});

test("accepts source-bound S&V impairment projections", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 1,
    phase: "firstNight",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      activeImpairments: [{
        kind: "poisoned",
        playerId: "player-2",
        sourceEventId: "setup-1",
        sourceCharacterId: "noDashii",
        expires: "whileSourceAbilityActive",
      }],
    },
    warnings: [],
    gameEnd: null,
  };

  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("accepts only the atomic Fang Gu jump event and its player-anchored ONCE reminder", () => {
  const event = {
    id: "night-action-12",
    type: "nightActionResolved",
    phase: "night",
    payload: {
      stepId: "night:demon:player-7",
      actorPlayerId: "player-7",
      actorCharacterId: "fangGu",
      resolution: {
        kind: "demonAttack",
        targetPlayerId: "player-5",
        outcome: {
          kind: "fangGuJump",
          death: {
            playerId: "player-7",
            cause: {
              kind: "demonAttack",
              actorPlayerId: "player-7",
              actorCharacterId: "fangGu",
              targetPlayerId: "player-5",
            },
          },
          sourceAbilityInstanceId: "setup-1:player-7",
          identityTransition: {
            playerId: "player-5",
            before: { actualCharacter: "sweetheart", shownCharacter: "sweetheart", alignment: "good" },
            after: { actualCharacter: "fangGu", shownCharacter: "fangGu", alignment: "evil" },
          },
        },
      },
    },
    summary: "팡 구 이동",
    createdAt: "2026-07-29T00:00:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(event), event);

  for (const malformed of [
    (() => { const value = structuredClone(event); value.payload.resolution.outcome.death.playerId = 7 as never; return value; })(),
    (() => { const value = structuredClone(event); delete (value.payload.resolution.outcome as Partial<typeof event.payload.resolution.outcome>).sourceAbilityInstanceId; return value; })(),
    (() => { const value = structuredClone(event); value.payload.resolution.outcome.identityTransition.after.alignment = "good" as "evil"; return value; })(),
  ]) {
    throws(() => parseGameEvent(malformed), /이벤트 형식/);
  }

  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 12,
    phase: "night",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: {
      unannouncedNightDeathPlayerIds: ["player-7"],
      automaticReminders: [{
        playerId: "player-5",
        characterId: "fangGu",
        tokenId: "once",
        label: "한 번",
        description: "첫 외지인 이동이 사용되었습니다.",
      }],
    },
    warnings: [],
    gameEnd: null,
  };
  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("accepts only canonical trigger-impaired death consequence events", () => {
  const trigger = {
    sourceEventId: "death-1",
    deathSequence: 1,
    playerId: "player-2",
    sourceAbilityInstanceId: "setup:player-2",
  };
  const event = (type: string, payload: Record<string, unknown>) => ({
    id: `consequence-${type}`,
    type,
    phase: "night",
    payload: { stepId: "night:death:death-1:1", trigger, ...payload },
    summary: "효과 없음",
    createdAt: "2026-07-29T00:00:00.000Z",
  });
  const sweetheart = event("sweetheartConsequenceResolved", {
    outcome: { kind: "noEffect", reason: "actorImpairedAtDeath" },
  });
  const barber = event("barberConsequenceResolved", {
    outcome: { kind: "noEffect", reason: "actorImpairedAtDeath" },
  });
  const klutz = event("klutzChoiceResolved", { outcome: { kind: "actorImpaired" } });
  const sweetheartEffective = event("sweetheartConsequenceResolved", {
    targetPlayerId: "player-3",
    outcome: {
      kind: "drunkApplied",
      impairment: {
        kind: "drunk",
        playerId: "player-3",
        sourceEventId: "consequence-sweetheartConsequenceResolved",
        sourceCharacterId: "sweetheart",
        expires: "never",
      },
    },
  });
  const barberEffective = event("barberConsequenceResolved", {
    chooserDemonPlayerId: "player-7",
    decision: { kind: "decline" },
    outcome: { kind: "declined" },
  });
  const klutzEffective = event("klutzChoiceResolved", {
    targetPlayerId: "player-3",
    actorAlignment: "good",
    targetAlignment: "good",
    outcome: { kind: "safe" },
  });

  equal(parseGameEvent(sweetheart).type, "sweetheartConsequenceResolved");
  equal(parseGameEvent(barber).type, "barberConsequenceResolved");
  equal(parseGameEvent(klutz).type, "klutzChoiceResolved");
  equal(parseGameEvent(sweetheartEffective).type, "sweetheartConsequenceResolved");
  equal(parseGameEvent(barberEffective).type, "barberConsequenceResolved");
  equal(parseGameEvent(klutzEffective).type, "klutzChoiceResolved");

  throws(
    () => parseGameEvent({ ...sweetheart, payload: { ...sweetheart.payload, targetPlayerId: "player-3" } }),
    /이벤트 형식/,
  );
  throws(
    () => parseGameEvent({ ...sweetheart, payload: {
      ...sweetheart.payload,
      outcome: { kind: "noEffect", reason: "noLivingDemon" },
    } }),
    /이벤트 형식/,
  );
  throws(
    () => parseGameEvent({ ...barber, payload: {
      ...barber.payload,
      chooserDemonPlayerId: "player-7",
      decision: { kind: "decline" },
    } }),
    /이벤트 형식/,
  );
  throws(
    () => parseGameEvent({ ...klutz, payload: {
      ...klutz.payload,
      targetPlayerId: "player-3",
      actorAlignment: "good",
      targetAlignment: "evil",
    } }),
    /이벤트 형식/,
  );
});

test("accepts a pending healthy Barber with no living Demon as an empty chooser list", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 4,
    phase: "night",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
    pendingDeathConsequences: [{
      stepId: "night:death:death-1:1:barber",
      kind: "barber",
      sourceEventId: "death-1",
      deathSequence: 1,
      actorPlayerId: "player-2",
      sourceAbilityInstanceId: "setup:player-2",
      actorImpairedAtTrigger: false,
      allowedPlayerIds: [],
      eligibleChooserPlayerIds: [],
    }],
  };
  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("accepts Pit-Hag transformation and arbitrary death audit events", () => {
  const before = { actualCharacter: "mutant", shownCharacter: "mutant", alignment: "good" };
  const after = { actualCharacter: "noDashii", shownCharacter: "noDashii", alignment: "good" };
  const transformation = {
    id: "pit-hag-1",
    type: "pitHagTransformationResolved",
    phase: "night",
    payload: {
      stepId: "night:pitHag:player-1",
      actorPlayerId: "player-1",
      targetPlayerId: "player-2",
      characterId: "noDashii",
      outcome: {
        kind: "changed",
        identityTransition: { playerId: "player-2", before, after },
        createdDemon: true,
      },
    },
    summary: "마귀할멈 직업 변경 확정",
    createdAt: "2026-07-26T00:00:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(transformation), transformation);

  const deaths = {
    id: "phase-2",
    type: "pitHagArbitraryDeathsConfirmed",
    phase: "night",
    payload: {
      stepId: "night:pitHagArbitraryDeaths",
      sourceTransformationEventId: "pit-hag-1",
      deaths: [{
        playerId: "player-3",
        cause: {
          kind: "pitHagArbitraryDeath",
          actorPlayerId: "player-1",
          sourceTransformationEventId: "pit-hag-1",
        },
      }],
    },
    summary: "마귀할멈 임의 사망 확정 · 1명",
    createdAt: "2026-07-26T00:01:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(deaths), deaths);
});

test("accepts the generic S&V Demon attack while preserving the Imp payload contract", () => {
  const demonAttack = {
    id: "phase-7",
    type: "nightActionResolved",
    phase: "night",
    payload: {
      stepId: "night:demon",
      actorPlayerId: "player-7",
      actorCharacterId: "vortox",
      resolution: {
        kind: "demonAttack",
        targetPlayerId: "player-4",
        outcome: {
          kind: "deaths",
          deaths: [{
            playerId: "player-4",
            cause: {
              kind: "demonAttack",
              actorPlayerId: "player-7",
              actorCharacterId: "vortox",
              targetPlayerId: "player-4",
            },
          }],
        },
      },
    },
    summary: "7번 Demon(vortox) → 4번 Savant 공격 · 사망",
    createdAt: "2026-07-22T00:00:00.000Z",
  };

  deepEqual<unknown>(parseGameEvent(demonAttack), demonAttack);

  const impWithUnexpectedCharacterSnapshot = {
    ...demonAttack,
    payload: {
      stepId: "night:imp",
      actorPlayerId: "player-7",
      actorCharacterId: "imp",
      resolution: {
        kind: "impAttack",
        targetPlayerId: "player-4",
        outcome: { kind: "death", playerId: "player-4" },
      },
    },
  };
  throws(() => parseGameEvent(impWithUnexpectedCharacterSnapshot), /이벤트 형식/);
});

test("accepts the Vigormortis source effect, replacement event, and pending choice projection", () => {
  const effectEvent = {
    id: "attack-1",
    type: "nightActionResolved",
    phase: "night",
    payload: {
      stepId: "night:demon:player-7",
      actorPlayerId: "player-7",
      actorCharacterId: "vigormortis",
      resolution: {
        kind: "demonAttack",
        targetPlayerId: "player-6",
        outcome: {
          kind: "deaths",
          deaths: [{
            playerId: "player-6",
            cause: {
              kind: "demonAttack",
              actorPlayerId: "player-7",
              actorCharacterId: "vigormortis",
              targetPlayerId: "player-6",
            },
          }],
          vigormortisEffect: {
            minionPlayerId: "player-6",
            sourceAbilityInstanceId: "setup-1:player-7",
            poisonTargetPlayerId: "player-5",
          },
        },
      },
    },
    summary: "비고르모르티스 공격",
    createdAt: "2026-07-28T00:00:00.000Z",
  };
  const replacementEvent = {
    id: "vigormortis-poison-2",
    type: "vigormortisPoisonTargetChanged",
    phase: "night",
    payload: {
      sourceEventId: "attack-1",
      previousTargetPlayerId: "player-5",
      targetPlayerId: "player-4",
    },
    summary: "비고르모르티스 중독 이동",
    createdAt: "2026-07-28T00:01:00.000Z",
  };
  deepEqual<unknown>(parseGameEvent(effectEvent), effectEvent);
  deepEqual<unknown>(parseGameEvent(replacementEvent), replacementEvent);

  const currentStep = {
    id: "night:demon:player-7",
    phase: "night",
    stepType: "character",
    character: "vigormortis",
    playerId: "player-7",
    requiredInput: {
      kind: "playerIds",
      optional: false,
      dependentPlayerSelections: [{
        triggerPlayerId: "player-6",
        selectionIndex: 1,
        allowedPlayerIds: ["player-1", "player-5"],
      }],
    },
    canSkip: false,
    support: "automated",
  };
  const replay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 1,
    phase: "night",
    players: [],
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      automaticReminders: [{
        playerId: "player-6",
        characterId: "vigormortis",
        tokenId: "hasAbility",
        label: "능력 있음",
        description: "비고르모르티스에게 죽었지만 하수인 능력을 유지합니다.",
      }, {
        playerId: "player-2",
        characterId: "seamstress",
        tokenId: "noAbility",
        label: "능력 없음",
        description: "재봉사 능력을 이미 사용했습니다.",
      }],
    },
    warnings: [],
    gameEnd: null,
    pendingVigormortisPoisonChoices: [{
      sourceEventId: "attack-1",
      vigormortisPlayerId: "player-7",
      minionPlayerId: "player-6",
      previousTargetPlayerId: "player-5",
      allowedPlayerIds: ["player-1", "player-4"],
      reason: "targetNotTownsfolk",
    }],
  };
  deepEqual<unknown>(parseReplayState(replay), replay);
});

test("rejects the canonical schema-v1 fixture", () => {
  const fixture = readFileSync("../fixtures/schema-v1-game.json", "utf8");

  throws(() => importGameFileJson(fixture, TROUBLE_BREWING), /지원하지 않는 게임 파일 버전/);
});

test("validates complete phase-input suggestion results", () => {
  deepEqual(
    parseCoreResult(
      {
        ok: true,
        value: {
          stepId: "firstNight:washerwoman",
          input: { playerIds: ["player-1", "player-2"], characterId: "chef" },
        },
      },
      parsePhaseInputSuggestion,
    ),
    {
      ok: true,
      value: {
        stepId: "firstNight:washerwoman",
        input: { playerIds: ["player-1", "player-2"], characterId: "chef" },
      },
    },
  );
  throws(
    () => parsePhaseInputSuggestion({ stepId: "firstNight:washerwoman", input: null }),
    /코어 응답 형식/,
  );
  throws(
    () => parsePhaseInputSuggestion({ stepId: "firstNight:washerwoman", input: { playerIds: ["player-1"] } }),
    /코어 응답 형식/,
  );
});

test("rejects unsupported and malformed imported events", () => {
  const fixture = schemaV2Fixture();
  const unsupported = structuredClone(fixture);
  unsupported.game.events[0].type = "notAnEvent";
  const malformed = structuredClone(fixture);
  delete malformed.game.events[0].payload.players;

  throws(() => importGameFileJson(JSON.stringify(unsupported), TROUBLE_BREWING), /지원하지 않는 이벤트/);
  throws(() => importGameFileJson(JSON.stringify(malformed), TROUBLE_BREWING), /이벤트 형식/);
});

test("rejects non-canonical nomination payload fields", () => {
  const event = {
    id: "event-nomination",
    type: "nominationVoteConfirmed",
    phase: "day",
    payload: {
      stepId: "day:nomination:1",
      nominatorId: "player-1",
      nomineeId: "player-5",
      voterIds: ["player-1", "player-3"],
      ghostVoteSpentPlayerIds: [],
      voteCount: 2,
    },
    summary: "지목 투표 확정",
    createdAt: "2026-07-16T00:00:00.000Z",
  };

  throws(() => parseGameEvent(event), /이벤트 형식/);
});

test("accepts issue 11 nomination, attack, and succession audit contracts", () => {
  const common = { phase: "day", summary: "확정", createdAt: "2026-07-16T00:00:00.000Z" };
  const events = [
    {
      ...common,
      id: "nomination-started-1",
      type: "nominationStarted",
      payload: {
        stepId: "day:nomination:1",
        nominatorId: "spy",
        nomineeId: "virgin",
        registrationJudgments: [{ playerId: "spy", registeredAs: "townsfolk" }],
        virginResolution: { kind: "spentAndNominatorExecuted", virginPlayerId: "virgin", impairmentContext: { kind: "healthy" } },
      },
    },
    {
      ...common,
      id: "vote-1",
      type: "nominationVoteConfirmed",
      payload: { stepId: "day:nomination:1:vote", nominationEventId: "nomination-started-1", voterIds: [], ghostVoteSpentPlayerIds: [] },
    },
    {
      ...common,
      id: "succession-1",
      type: "demonSuccessionConfirmed",
      payload: {
        triggerImpDeathEventId: "death-1", deathCause: "impSelfKill", previousImpPlayerId: "imp",
        successorPlayerId: "poisoner", successorPreviousActualCharacter: "poisoner", newCharacter: "imp", source: "impSelfKill",
      },
    },
  ];

  for (const event of events) equal(parseGameEvent(event).type, event.type);
});

test("validates the strict Slayer audit event used by import and export", () => {
  const event = {
    id: "event-slayer",
    type: "slayerAbilityUsed",
    phase: "day",
    payload: {
      discussionStepId: "day:discussion",
      actorPlayerId: "player-1",
      targetPlayerId: "player-3",
      impairmentContext: { kind: "healthy" },
      registrationContext: {
        kind: "recluseDecision",
        registeredAsDemon: true,
        registeredCharacterId: "imp",
      },
      outcome: { kind: "deathPending", playerId: "player-3" },
    },
    summary: "처단자: 1번 Ada → 3번 Cy · 사망 확인 필요",
    createdAt: "2026-07-16T00:00:00.000Z",
  };

  equal(parseGameEvent(event).type, "slayerAbilityUsed");
  const invalid = structuredClone(event);
  invalid.payload.registrationContext.registeredCharacterId = "spy";
  throws(() => parseGameEvent(invalid), /이벤트 형식/);
});

test("validates the strict daytime free-action audit event used by import and export", () => {
  const event = {
    id: "event-day-action",
    type: "dayActionRecorded",
    phase: "day",
    payload: {
      dayId: "day",
      actorPlayerId: "player-2",
      characterId: "artist",
      record: { kind: "artist", question: "악마가 홀수 좌석에 있나요?", answer: "no", truthful: true },
      activeReasons: [],
    },
    summary: "화가: 2번 Ada · 질문과 답변 기록",
    createdAt: "2026-07-25T00:00:00.000Z",
  };

  equal(parseGameEvent(event).type, "dayActionRecorded");
  const invalid = structuredClone(event);
  invalid.payload.record.answer = "maybe";
  throws(() => parseGameEvent(invalid), /이벤트 형식/);

  const savant = {
    ...event,
    id: "event-savant-action",
    payload: {
      ...event.payload,
      actorPlayerId: "player-1",
      characterId: "savant",
      record: {
        kind: "savant",
        statements: [
          { text: "악마는 홀수 좌석에 있습니다.", truthful: true },
          { text: "", truthful: false },
        ],
      },
      activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-7", poisonEventId: "poison-1" }],
    },
  };
  equal(parseGameEvent(savant).type, "dayActionRecorded");
  const legacy = structuredClone(savant) as unknown as { payload: { record: Record<string, unknown> } };
  legacy.payload.record = { kind: "savant", referenceSentences: [] };
  throws(() => parseGameEvent(legacy), /이벤트 형식/);
});

test("validates daytime free-action replay projections at the WASM boundary", () => {
  const state = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 6,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    warnings: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    gameEnd: null,
    availableDayActions: [{ actorPlayerId: "player-1", characterId: "juggler", dayId: "day", activeReasons: [] }],
    dayActionRecords: [{
      eventId: "day-action-6",
      actorPlayerId: "player-1",
      characterId: "juggler",
      dayId: "day",
      record: { kind: "juggler", correctCount: 3 },
      activeReasons: [],
    }],
  };

  equal(parseReplayState(state).dayActionRecords?.[0].record.kind, "juggler");
  const invalid = structuredClone(state);
  invalid.availableDayActions[0].characterId = "clockmaker";
  throws(() => parseReplayState(invalid), /코어 응답/);
});

function schemaV2Fixture(): {
  schemaVersion: number;
  game: { events: Array<{ type: string; payload: Record<string, unknown> }> };
} {
  const fixture = JSON.parse(readFileSync("../fixtures/schema-v1-game.json", "utf8"));
  fixture.schemaVersion = 2;
  return fixture;
}

test("validates Proposal.event at the Wasm JSON boundary", () => {
  const valid = {
    ok: true,
    value: {
      event: {
        id: "smoke-event",
        type: "smokeConfirmed",
        phase: "setup",
        payload: { source: "smoke" },
        summary: "스모크 명령 확인",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
      warnings: [],
      followUpSteps: [],
      preview: { messageKo: "코어 계약 정상" },
      revealPayload: {
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      },
    },
  };

  deepEqual<unknown>(parseCoreResult(valid, parseProposal), valid);
  const malformed = structuredClone(valid);
  delete (malformed.value.event.payload as { source?: string }).source;
  throws(() => parseCoreResult(malformed, parseProposal), /이벤트 형식/);

  const incompleteReveal = structuredClone(valid);
  delete (incompleteReveal.value.revealPayload as { valueKo?: string }).valueKo;
  throws(() => parseCoreResult(incompleteReveal, parseProposal), /코어 응답 형식/);
});

test("validates win warnings and the canonical game-ended contract", () => {
  const event = {
    id: "game-ended-12",
    type: "gameEnded",
    phase: "day",
    payload: { winningTeam: "evil" },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-16T00:00:00.000Z",
  };
  equal(parseGameEvent(event).type, "gameEnded");

  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 12,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [{
      code: "SAINT_EXECUTED_EVIL_WIN",
      severity: "warning",
      messageKo: "성자 처형 사망: 악 승리 확인 필요",
      winningTeam: "evil",
    }],
    gameEnd: { eventId: "game-ended-12", winningTeam: "evil" },
  };
  deepEqual<unknown>(parseReplayState(replay), replay);

  const malformedEvent = structuredClone(event);
  malformedEvent.payload.winningTeam = "neither";
  throws(() => parseGameEvent(malformedEvent), /이벤트 형식/);
  const malformedWarning = structuredClone(replay);
  malformedWarning.warnings[0].winningTeam = "neither";
  throws(() => parseReplayState(malformedWarning), /코어 응답 형식/);
});

test("validates the S&V rules-owned game-end cause and Korean reason", () => {
  const event = {
    id: "game-ended-12",
    type: "gameEnded",
    phase: "day",
    payload: {
      winningTeam: "evil",
      source: { kind: "vortoxNoExecution", sourceEventId: "no-execution-11" },
    },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-16T00:00:00.000Z",
  };
  equal(parseGameEvent(event).type, "gameEnded");

  const pendingReplay = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 11,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
    pendingGameEnd: {
      sourceEventId: "no-execution-11",
      winningTeam: "evil",
      cause: "vortoxNoExecution",
      reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
    },
  };
  deepEqual<unknown>(parseReplayState(pendingReplay), pendingReplay);

  const endedReplay: Record<string, unknown> = structuredClone(pendingReplay);
  delete (endedReplay as { pendingGameEnd?: unknown }).pendingGameEnd;
  endedReplay.gameEnd = {
    eventId: "game-ended-12",
    sourceEventId: "no-execution-11",
    winningTeam: "evil",
    cause: "vortoxNoExecution",
    reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
  };
  deepEqual<unknown>(parseReplayState(endedReplay), endedReplay);
});

test("validates canonical player annotation events and replay projections", () => {
  const event = {
    id: "player-annotations-2",
    type: "playerAnnotationsUpdated",
    phase: "firstNight",
    payload: {
      playerId: "player-2",
      systemTokenIds: ["abilitySpent", "needsFollowUp"],
      scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
      notes: "다음 낮에 개인 확인",
    },
    summary: "플레이어 표시 수정: 2번 Bert",
    createdAt: "2026-07-17T00:00:00.000Z",
  };
  equal(parseGameEvent(event).type, "playerAnnotationsUpdated");

  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 2,
    phase: "firstNight",
    players: [{
      id: "player-2",
      seat: 2,
      name: "Bert",
      actualCharacter: "chef",
      shownCharacter: "chef",
      alignment: "good",
      alive: true,
      ghostVoteUsed: false,
      deathAnnounced: false,
      systemTokenIds: ["abilitySpent"],
      scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
      notes: "다음 낮에 개인 확인",
    }],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };
  deepEqual<unknown>(parseReplayState(replay), replay);

  const unknownScriptToken = structuredClone(event);
  unknownScriptToken.payload.scriptTokens[0].tokenId = "notReal";
  throws(() => parseGameEvent(unknownScriptToken), /이벤트 형식/);
  const duplicateSystemToken = structuredClone(replay);
  duplicateSystemToken.players[0].systemTokenIds = ["abilitySpent", "abilitySpent"];
  throws(() => parseReplayState(duplicateSystemToken), /코어 응답 형식/);
});

test("validates typed confirmed information and derived information prompts", () => {
  const information = {
    actor: { playerId: "player-2", characterId: "chef" },
    targetPlayerIds: [],
    computedResult: { kind: "number", value: 0 },
    deliveredResult: { kind: "number", value: 1 },
    deliveryContext: {
      type: "discretionary",
      reasons: [
        {
          type: "poisoned",
          poisonerPlayerId: "player-4",
          poisonEventId: "event-poisoner",
        },
        {
          type: "registrationJudgment",
          judgments: [{ playerId: "player-5", registeredAs: "evil" }],
        },
      ],
    },
  };
  const event = {
    id: "event-chef",
    type: "phaseStepConfirmed",
    phase: "firstNight",
    payload: { stepId: "firstNight:chef", input: null, information },
    summary: "요리사 정보 확정",
    createdAt: "2026-07-15T00:00:00.000Z",
  };
  const proposal = {
    event,
    warnings: [],
    followUpSteps: [],
    preview: null,
  };

  deepEqual<unknown>(parseProposal(proposal).event, event);

  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 1,
    phase: "firstNight",
    players: [],
    currentStep: {
      id: "firstNight:chef",
      phase: "firstNight",
      stepType: "character",
      requiredInput: {
        kind: "none",
        allowedCharacterIds: ["librarian", "butler"],
        optional: false,
      },
      canSkip: false,
      informationPrompt: {
        computedResult: { kind: "number", value: 0 },
        deliveryMode: "selectable",
        activeReasons: [],
        registrationCandidatePlayerIds: ["player-5"],
        numberChoices: [
          { value: 0, isComputed: true, registrationJudgments: [] },
          {
            value: 1,
            isComputed: false,
            registrationJudgments: [{ playerId: "player-5", registeredAs: "evil" }],
          },
        ],
        setupInfoRegistrationOptions: [],
      },
    },
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
  deepEqual<unknown>(parseReplayState(replay).currentStep, replay.currentStep);

  const invalidNumber = structuredClone(proposal);
  invalidNumber.event.payload.information.deliveredResult.value = -1;
  throws(() => parseProposal(invalidNumber), /이벤트 형식/);

  const invalidReason = structuredClone(proposal);
  delete invalidReason.event.payload.information.deliveryContext.reasons[0].poisonEventId;
  throws(() => parseProposal(invalidReason), /이벤트 형식/);

  const invalidPrompt = structuredClone(replay);
  invalidPrompt.currentStep.informationPrompt.registrationCandidatePlayerIds = [1 as unknown as string];
  throws(() => parseReplayState(invalidPrompt), /코어 응답 형식/);

  const impairedWithRegistrationWitness = {
    ...replay,
    currentStep: {
      ...replay.currentStep,
      informationPrompt: {
        ...replay.currentStep.informationPrompt,
        activeReasons: [{ type: "drunk" }],
      },
    },
  };
  throws(() => parseReplayState(impairedWithRegistrationWitness), /코어 응답 형식/);

  const invalidAllowedCharacters = structuredClone(replay);
  invalidAllowedCharacters.currentStep.requiredInput.allowedCharacterIds = [1 as unknown as string];
  throws(() => parseReplayState(invalidAllowedCharacters), /코어 응답 형식/);
});

test("validates the narrow ongoing-night replay, target-check, and typed-event contracts", () => {
  const player = {
    id: "player-1",
    seat: 1,
    name: "지우",
    actualCharacter: "fortuneTeller",
    shownCharacter: "fortuneTeller",
    alignment: "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
  const fortuneTellerStep = {
    id: "night1:fortuneTeller",
    phase: "night",
    stepType: "character",
    character: "fortuneTeller",
    playerId: "player-1",
    requiredInput: {
      kind: "playerIds",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      allowedPlayerIds: ["player-1", "player-2"],
      playerRegistrationOptions: [],
      optional: false,
    },
    canSkip: false,
    informationPrompt: {
      deliveryMode: "fixed",
      activeReasons: [],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
      targetChecks: [
        {
          targetPlayerIds: ["player-1", "player-2"],
          computedResult: { kind: "boolean", value: true },
          choices: [
            {
              result: { kind: "boolean", value: true },
              isComputed: true,
              registrationJudgments: [],
            },
          ],
        },
      ],
    },
  };
  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 3,
    phase: "night",
    players: [player],
    currentStep: fortuneTellerStep,
    phaseOverview: [{ ...fortuneTellerStep, status: "current" }],
    ruleState: {
      redHerringPlayerId: "player-2",
      activePoison: {
        playerId: "player-1",
        sourcePlayerId: "player-4",
        sourceEventId: "event-poison",
      },
      activeProtection: {
        playerId: "player-2",
        sourcePlayerId: "player-3",
        sourceEventId: "event-protection",
      },
      unannouncedNightDeathPlayerIds: ["player-5"],
    },
    warnings: [],
  };

  deepEqual<unknown>(parseReplayState(replay), replay);

  const vortoxWithTruthfulTargetChoice = structuredClone(replay);
  (vortoxWithTruthfulTargetChoice.currentStep.informationPrompt as { activeReasons: unknown[] }).activeReasons = [
    { type: "vortox", demonPlayerId: "player-7" },
  ];
  throws(() => parseReplayState(vortoxWithTruthfulTargetChoice), /코어 응답 형식/);

  vortoxWithTruthfulTargetChoice.currentStep.informationPrompt.targetChecks[0].choices[0].isComputed = false;
  deepEqual<unknown>(
    parseReplayState(vortoxWithTruthfulTargetChoice),
    vortoxWithTruthfulTargetChoice,
  );

  const missingRuleState = structuredClone(replay);
  delete (missingRuleState as { ruleState?: unknown }).ruleState;
  throws(() => parseReplayState(missingRuleState), /코어 응답 형식/);

  const events = [
    {
      id: "event-red-herring",
      type: "redHerringAssigned",
      phase: "firstNight",
      payload: {
        stepId: "firstNight:fortuneTellerRedHerring",
        playerId: "player-4",
        registrationJudgments: [
          { playerId: "player-4", registeredAs: "good" },
        ],
      },
      summary: "레드 헤링 지정",
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "event-imp",
      type: "nightActionResolved",
      phase: "night",
      payload: {
        stepId: "night1:imp",
        actorPlayerId: "player-5",
        resolution: {
          kind: "impAttack",
          targetPlayerId: "player-3",
          outcome: {
            kind: "prevented",
            reason: "monkProtection",
            sourceEventId: "event-protection",
          },
        },
      },
      summary: "임프 공격: 3번 서연 · 사망 없음 (수도승 보호)",
      createdAt: "2026-07-16T00:01:00.000Z",
    },
    {
      id: "event-announcement",
      type: "nightDeathsAnnounced",
      phase: "day",
      payload: { stepId: "day2:announceDeaths", playerIds: ["player-5"] },
      summary: "밤 사망 발표",
      createdAt: "2026-07-16T00:02:00.000Z",
    },
    {
      id: "event-undertaker",
      type: "phaseStepConfirmed",
      phase: "night",
      payload: {
        stepId: "night1:undertaker",
        input: null,
        information: {
          actor: { playerId: "player-2", characterId: "undertaker" },
          targetPlayerIds: ["player-3"],
          computedResult: { kind: "character", characterId: "librarian" },
          deliveredResult: { kind: "character", characterId: "spy" },
          deliveryContext: {
            type: "discretionary",
            reasons: [
              {
                type: "registrationJudgment",
                judgments: [
                  { playerId: "player-3", registeredAs: "good", characterId: "librarian" },
                ],
              },
            ],
          },
        },
      },
      summary: "장의사 정보 확정",
      createdAt: "2026-07-16T00:03:00.000Z",
    },
  ];

  for (const event of events) deepEqual<unknown>(parseGameEvent(event), event);
});

test("requires canonical nomination eligibility lists in Day replay state", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 12,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    dayState: {
      nominations: [],
      executionVoteThreshold: 1,
      highestVoteCount: 0,
      eligibleNominatorIds: ["player-1", "player-3"],
      eligibleNomineeIds: ["player-1", "player-2"],
    },
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };

  deepEqual<unknown>(parseReplayState(replay).dayState, replay.dayState);

  const missingNominators = structuredClone(replay);
  delete (missingNominators.dayState as { eligibleNominatorIds?: string[] }).eligibleNominatorIds;
  throws(() => parseReplayState(missingNominators), /코어 응답 형식/);

  const malformedNominees = structuredClone(replay);
  malformedNominees.dayState.eligibleNomineeIds = [1 as unknown as string];
  throws(() => parseReplayState(malformedNominees), /코어 응답 형식/);
});

test("validates the optional Butler vote projection in replay state", () => {
  const replay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 12,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      butlerVote: {
        butlerPlayerId: "player-2",
        masterPlayerId: "player-1",
        restrictionApplies: true,
      },
    },
    warnings: [],
  };

  deepEqual<unknown>(parseReplayState(replay).ruleState.butlerVote, replay.ruleState.butlerVote);

  const malformed = structuredClone(replay);
  malformed.ruleState.butlerVote.restrictionApplies = "yes" as unknown as boolean;
  throws(() => parseReplayState(malformed), /코어 응답 형식/);
});

test("allows computedResult omission only at setup prompt or impaired setup audit boundaries", () => {
  const setupPromptReplay = {
    schemaVersion: 3,
    scriptId: "troubleBrewing",
    eventCount: 1,
    phase: "firstNight",
    players: [],
    currentStep: {
      id: "firstNight:librarian",
      phase: "firstNight",
      stepType: "character",
      character: "librarian",
      requiredInput: {
        kind: "setupInfo",
        target: "players",
        minSelections: 2,
        maxSelections: 2,
        characterKind: "Outsider",
        optional: false,
      },
      canSkip: false,
      informationPrompt: {
        deliveryMode: "fixed",
        activeReasons: [],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        setupInfoRegistrationOptions: [],
      },
    },
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
  deepEqual<unknown>(parseReplayState(setupPromptReplay).currentStep, setupPromptReplay.currentStep);

  const impairedEvent = {
    id: "event-librarian",
    type: "phaseStepConfirmed",
    phase: "firstNight",
    payload: {
      stepId: "firstNight:librarian",
      input: { zeroOutsiders: true },
      information: {
        actor: { playerId: "player-1", characterId: "librarian" },
        targetPlayerIds: [],
        deliveredResult: {
          kind: "setupInfo",
          playerIds: [],
          zeroOutsiders: true,
        },
        deliveryContext: { type: "discretionary", reasons: [{ type: "drunk" }] },
      },
    },
    summary: "중독된 사서 정보 확정",
    createdAt: "2026-07-15T00:00:00.000Z",
  };
  const impairedProposal = {
    event: impairedEvent,
    warnings: [],
    followUpSteps: [],
    preview: null,
  };
  deepEqual<unknown>(parseProposal(impairedProposal).event, impairedEvent);

  const fixedMissingComputed = structuredClone(impairedProposal);
  fixedMissingComputed.event.payload.information.deliveryContext = { type: "fixed", reasons: [] };
  throws(() => parseProposal(fixedMissingComputed), /이벤트 형식/);

  const unknownConcreteRegistration = {
    ...impairedProposal,
    event: {
      ...impairedEvent,
      payload: {
        ...impairedEvent.payload,
        information: {
          ...impairedEvent.payload.information,
          computedResult: {
            kind: "setupInfo",
            playerIds: ["player-1", "player-2"],
            characterId: "poisoner",
            zeroOutsiders: false,
          },
          deliveryContext: {
            type: "discretionary",
            reasons: [
              {
                type: "registrationJudgment",
                judgments: [
                  {
                    playerId: "player-2",
                    registeredAs: "minion",
                    characterId: "not-a-character",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  };
  throws(() => parseProposal(unknownConcreteRegistration), /이벤트 형식/);
});
