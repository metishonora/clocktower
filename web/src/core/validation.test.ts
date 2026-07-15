import { deepEqual, equal, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { importGameFileJson } from "../gameStorage.js";
import { parseCoreResult, parsePhaseInputSuggestion, parseProposal, parseReplayState } from "./validation.js";

test("imports the canonical schema-v1 fixture as typed GameEvent values", () => {
  const fixture = readFileSync("../fixtures/schema-v1-game.json", "utf8");
  const gameFile = importGameFileJson(fixture);

  equal(gameFile.schemaVersion, 1);
  equal(gameFile.game.events.length, 8);
  equal(gameFile.game.events[0]?.type, "setupConfirmed");
  equal(gameFile.game.events[7]?.type, "phaseStepConfirmed");
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
  const fixture = JSON.parse(readFileSync("../fixtures/schema-v1-game.json", "utf8"));
  const unsupported = structuredClone(fixture);
  unsupported.game.events[0].type = "notAnEvent";
  const malformed = structuredClone(fixture);
  delete malformed.game.events[0].payload.players;

  throws(() => importGameFileJson(JSON.stringify(unsupported)), /지원하지 않는 이벤트/);
  throws(() => importGameFileJson(JSON.stringify(malformed)), /이벤트 형식/);
});

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
    schemaVersion: 1,
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

test("allows computedResult omission only at setup prompt or impaired setup audit boundaries", () => {
  const setupPromptReplay = {
    schemaVersion: 1,
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
