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
  const outOfOrder = structuredClone(replay);
  outOfOrder.pendingIdentityReveals[0].sequence = 2;
  throws(() => parseReplayState(outOfOrder), /코어 응답 형식/);
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
      record: { kind: "artist", question: "악마가 홀수 좌석에 있나요?", answer: "no" },
    },
    summary: "화가: 2번 Ada · 질문과 답변 기록",
    createdAt: "2026-07-25T00:00:00.000Z",
  };

  equal(parseGameEvent(event).type, "dayActionRecorded");
  const invalid = structuredClone(event);
  invalid.payload.record.answer = "maybe";
  throws(() => parseGameEvent(invalid), /이벤트 형식/);
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
    availableDayActions: [{ actorPlayerId: "player-1", characterId: "juggler", dayId: "day" }],
    dayActionRecords: [{
      eventId: "day-action-6",
      actorPlayerId: "player-1",
      characterId: "juggler",
      dayId: "day",
      record: { kind: "juggler", correctCount: 3 },
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
