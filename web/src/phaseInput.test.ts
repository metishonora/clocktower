import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { PhaseStep, Player } from "./core/types.js";
import {
  characterInputOptions,
  phaseStepConfirmation,
  setupInfoCharacterOptions,
  setupInfoRegistrationJudgments,
  setupInfoZeroOutsidersAvailable,
  stepInputPayload,
  stepInputReady,
} from "./features/phase-control/phaseInput.js";

test("issue 11 phase inputs keep nomination, vote, Mayor, and succession contracts separate", () => {
  const nominationDraft = { nominatorId: "spy", nomineeId: "virgin", voterIds: ["chef"] };
  const nominationStep: PhaseStep = {
    id: "day1:nomination:1",
    phase: "day",
    stepType: "nomination",
    requiredInput: { kind: "nomination", target: "nomination", optional: false },
    canSkip: false,
  };
  const voteStep: PhaseStep = {
    ...nominationStep,
    id: "day1:nomination:1:vote",
    requiredInput: { kind: "nominationVote", target: "nomination", optional: false },
  };
  const mayorStep: PhaseStep = {
    id: "night1:imp",
    phase: "night",
    stepType: "character",
    character: "imp",
    playerId: "imp",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      mayorDecision: { mayorPlayerId: "mayor", bounceTargetPlayerIds: ["chef", "dead"] },
      optional: false,
    },
    canSkip: false,
  };
  const successionStep: PhaseStep = {
    id: "day1:demonSuccession:event-1",
    phase: "day",
    stepType: "demonSuccession",
    requiredInput: {
      kind: "demonSuccession",
      demonSuccession: {
        kind: "selectable",
        triggerEventId: "event-1",
        allowedPlayerIds: ["poisoner", "baron"],
      },
      optional: false,
    },
    canSkip: false,
  };

  deepEqual(stepInputPayload(nominationStep, [], "", [], nominationDraft, false), {
    nominatorId: "spy",
    nomineeId: "virgin",
  });
  deepEqual(stepInputPayload(voteStep, [], "", [], nominationDraft, false), {
    voterIds: ["chef"],
  });
  deepEqual(
    stepInputPayload(mayorStep, ["mayor"], "", [], nominationDraft, false, {
      kind: "bounce",
      targetPlayerId: "dead",
    }),
    {
      playerIds: ["mayor"],
      mayorDecision: { kind: "bounce", targetPlayerId: "dead" },
    },
  );
  deepEqual(
    stepInputPayload(successionStep, ["baron"], "", [], nominationDraft, false),
    { successorPlayerId: "baron" },
  );
});

test("Mayor decision is required only when the Imp actually selects the Mayor", () => {
  const step: PhaseStep = {
    id: "night1:imp",
    phase: "night",
    stepType: "character",
    character: "imp",
    playerId: "imp",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      mayorDecision: { mayorPlayerId: "mayor", bounceTargetPlayerIds: ["chef"] },
      optional: false,
    },
    canSkip: false,
  };
  const nominationDraft = { nominatorId: "", nomineeId: "", voterIds: [] };

  equal(stepInputReady(step, 1, 0, "", nominationDraft, false, undefined, true, undefined, ["chef"]), true);
  equal(stepInputReady(step, 1, 0, "", nominationDraft, false, undefined, true, undefined, ["mayor"]), false);
  equal(stepInputReady(step, 1, 0, "", nominationDraft, false, undefined, true, { kind: "mayorDies" }, ["mayor"]), true);
});

test("character input options honor an explicit allowlist in catalog order", () => {
  deepEqual(
    characterInputOptions(["saint", "librarian", "poisoner"]).map((character) => character.id),
    ["librarian", "saint", "poisoner"],
  );
  deepEqual(characterInputOptions([]), []);
});

test("setup information options use candidate Actual Characters in catalog order", () => {
  const roster = [
    player("saint", "saint"),
    player("drunk", "drunk", "chef"),
    player("drunk-copy", "drunk", "washerwoman"),
    player("chef", "chef"),
  ];

  deepEqual(
    setupInfoCharacterOptions("Outsider", ["saint", "drunk", "drunk-copy", "chef"], roster).map(
      (character) => character.id,
    ),
    ["drunk", "saint"],
  );
  deepEqual(
    setupInfoCharacterOptions("Townsfolk", ["drunk", "chef"], roster).map(
      (character) => character.id,
    ),
    ["chef"],
  );
});

test("zero Outsiders availability uses Actual Character and counts Drunk", () => {
  equal(setupInfoZeroOutsidersAvailable([player("chef", "chef")]), true);
  equal(setupInfoZeroOutsidersAvailable([player("drunk", "drunk", "librarian")]), false);
});

test("setup information readiness rejects stale zero-Outsider state", () => {
  const step: PhaseStep = {
    id: "firstNight:librarian",
    phase: "firstNight",
    stepType: "character",
    character: "librarian",
    playerId: "librarian",
    requiredInput: {
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      optional: false,
    },
    canSkip: false,
  };
  const nominationDraft = { nominatorId: "", nomineeId: "", voterIds: [] };

  equal(stepInputReady(step, 0, 0, "", nominationDraft, true, undefined, true), true);
  equal(stepInputReady(step, 0, 0, "", nominationDraft, true, undefined, false), false);
});

test("impaired setup information exposes every ability-shaped Character and zero", () => {
  const step: PhaseStep = {
    id: "firstNight:librarian",
    phase: "firstNight",
    stepType: "character",
    character: "librarian",
    playerId: "librarian",
    requiredInput: {
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      optional: false,
    },
    canSkip: false,
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [{ type: "drunk" }],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
    },
  };
  const roster = [player("chef", "chef"), player("imp", "imp")];
  deepEqual(
    setupInfoCharacterOptions("Outsider", ["chef", "imp"], roster, step).map(
      (character) => character.id,
    ),
    ["butler", "drunk", "recluse", "saint"],
  );
  equal(setupInfoZeroOutsidersAvailable([player("drunk", "drunk")], step), true);
});

test("setup registration expands one editor and builds a concrete judgment", () => {
  const step: PhaseStep = {
    id: "firstNight:investigator",
    phase: "firstNight",
    stepType: "character",
    character: "investigator",
    playerId: "investigator",
    requiredInput: {
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "investigator",
      characterKind: "Minion",
      optional: false,
    },
    canSkip: false,
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: ["recluse"],
      numberChoices: [],
      setupInfoRegistrationOptions: [
        {
          playerId: "recluse",
          registeredAs: "minion",
          characterIds: ["poisoner", "spy"],
        },
      ],
    },
  };
  const roster = [player("chef", "chef"), player("recluse", "recluse")];
  deepEqual(
    setupInfoCharacterOptions("Minion", ["chef", "recluse"], roster, step).map(
      (character) => character.id,
    ),
    ["poisoner", "spy"],
  );
  deepEqual(
    setupInfoRegistrationJudgments(step, ["chef", "recluse"], "poisoner", roster),
    [{ playerId: "recluse", registeredAs: "minion", characterId: "poisoner" }],
  );
});

test("numeric confirmation submits Rust witness only for an alternate choice", () => {
  const step: PhaseStep = {
    id: "firstNight:empath",
    phase: "firstNight",
    stepType: "character",
    character: "empath",
    playerId: "empath",
    requiredInput: { kind: "number", target: "number", optional: false },
    canSkip: false,
    informationPrompt: {
      computedResult: { kind: "number", value: 2 },
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: ["recluse"],
      numberChoices: [
        { value: 1, isComputed: false, registrationJudgments: [{ playerId: "recluse", registeredAs: "evil" }] },
        { value: 2, isComputed: true, registrationJudgments: [] },
      ],
      setupInfoRegistrationOptions: [],
    },
  };
  const nominationDraft = { nominatorId: "", nomineeId: "", voterIds: [] };
  const baseDraft = {
    selectedPlayerIds: [],
    selectedCharacterId: "",
    selectedCharacterIds: [],
    zeroOutsiders: false,
    registrationJudgments: [],
  };
  deepEqual(
    phaseStepConfirmation(
      step,
      { ...baseDraft, selectedNumberChoice: step.informationPrompt?.numberChoices[1] },
      nominationDraft,
    ),
    { input: null },
  );
  deepEqual(
    phaseStepConfirmation(
      step,
      { ...baseDraft, selectedNumberChoice: step.informationPrompt?.numberChoices[0] },
      nominationDraft,
    ),
    {
      input: null,
      deliveredResult: { kind: "number", value: 1 },
      registrationJudgments: [{ playerId: "recluse", registeredAs: "evil" }],
    },
  );

  const impairedStep: PhaseStep = {
    ...step,
    informationPrompt: step.informationPrompt
      ? { ...step.informationPrompt, activeReasons: [{ type: "drunk" }] }
      : undefined,
  };
  deepEqual(
    phaseStepConfirmation(
      impairedStep,
      { ...baseDraft, selectedNumberChoice: impairedStep.informationPrompt?.numberChoices[0] },
      nominationDraft,
    ),
    { input: null, deliveredResult: { kind: "number", value: 1 } },
  );
});

test("target-check confirmation persists the selected typed result and its exact witness", () => {
  const witness = [{ playerId: "recluse", registeredAs: "demon" as const }];
  const alternate = {
    result: { kind: "boolean" as const, value: true },
    isComputed: false,
    registrationJudgments: witness,
  };
  const step: PhaseStep = {
    id: "night1:fortuneTeller",
    phase: "night",
    stepType: "character",
    character: "fortuneTeller",
    playerId: "fortuneTeller",
    requiredInput: { kind: "playerIds", target: "players", minSelections: 2, maxSelections: 2, optional: false },
    canSkip: false,
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: ["recluse"],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: ["chef", "recluse"],
        computedResult: { kind: "boolean", value: false },
        choices: [
          { result: { kind: "boolean", value: false }, isComputed: true, registrationJudgments: [] },
          alternate,
        ],
      }],
    },
  };

  deepEqual(
    phaseStepConfirmation(
      step,
      {
        selectedPlayerIds: ["recluse", "chef"],
        selectedCharacterId: "",
        selectedCharacterIds: [],
        zeroOutsiders: false,
        registrationJudgments: [],
        selectedTargetChoice: alternate,
      },
      { nominatorId: "", nomineeId: "", voterIds: [] },
    ),
    {
      input: { playerIds: ["recluse", "chef"] },
      deliveredResult: { kind: "boolean", value: true },
      registrationJudgments: witness,
    },
  );
});

test("a single derived target-check confirms without Player input or a delivered override", () => {
  const step: PhaseStep = {
    id: "night1:undertaker",
    phase: "night",
    stepType: "character",
    character: "undertaker",
    playerId: "undertaker",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    informationPrompt: {
      deliveryMode: "fixed",
      activeReasons: [],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: ["executed"],
        computedResult: { kind: "character", characterId: "chef" },
        choices: [{
          result: { kind: "character", characterId: "chef" },
          isComputed: true,
          registrationJudgments: [],
        }],
      }],
    },
  };

  deepEqual(
    phaseStepConfirmation(
      step,
      {
        selectedPlayerIds: [],
        selectedCharacterId: "",
        selectedCharacterIds: [],
        zeroOutsiders: false,
        registrationJudgments: [],
      },
      { nominatorId: "", nomineeId: "", voterIds: [] },
    ),
    { input: null },
  );
});

function player(id: string, actualCharacter: string, shownCharacter = actualCharacter): Player {
  return {
    id,
    seat: 1,
    name: id,
    actualCharacter,
    shownCharacter,
    alignment: "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    notes: "",
  };
}
