import { deepEqual, equal, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { importGameFileJson } from "../gameStorage.js";
import {
  parseCoreResult,
  parseGameEvent,
  parsePhaseInputSuggestion,
  parseProposal,
  parseReplayState,
} from "./validation.js";

test("imports schema-v2 events as typed GameEvent values", () => {
  const gameFile = importGameFileJson(JSON.stringify(schemaV2Fixture()));

  equal(gameFile.schemaVersion, 2);
  equal(gameFile.game.events.length, 8);
  equal(gameFile.game.events[0]?.type, "setupConfirmed");
  equal(gameFile.game.events[7]?.type, "phaseStepConfirmed");
});

test("rejects the canonical schema-v1 fixture", () => {
  const fixture = readFileSync("../fixtures/schema-v1-game.json", "utf8");

  throws(() => importGameFileJson(fixture), /지원하지 않는 게임 파일 버전/);
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

  throws(() => importGameFileJson(JSON.stringify(unsupported)), /지원하지 않는 이벤트/);
  throws(() => importGameFileJson(JSON.stringify(malformed)), /이벤트 형식/);
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
    summary: "지명 투표 확정",
    createdAt: "2026-07-16T00:00:00.000Z",
  };

  throws(() => parseGameEvent(event), /이벤트 형식/);
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
    summary: "학살자: 1번 Ada → 3번 Cy · 사망 확인 필요",
    createdAt: "2026-07-16T00:00:00.000Z",
  };

  equal(parseGameEvent(event).type, "slayerAbilityUsed");
  const invalid = structuredClone(event);
  invalid.payload.registrationContext.registeredCharacterId = "spy";
  throws(() => parseGameEvent(invalid), /이벤트 형식/);
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
    schemaVersion: 2,
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
    schemaVersion: 2,
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
    schemaVersion: 2,
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

test("allows computedResult omission only at setup prompt or impaired setup audit boundaries", () => {
  const setupPromptReplay = {
    schemaVersion: 2,
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
