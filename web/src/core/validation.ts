import type {
  ConfirmedInformation,
  CoreResult,
  DayActionRecordInput,
  DeliveryReason,
  GameEvent,
  InformationPrompt,
  InformationResult,
  Phase,
  PhaseInputSuggestion,
  PhaseStep,
  PhaseStepInput,
  Proposal,
  ReplayState,
  SetupDistribution,
} from "./types.js";
import { isCharacterChangeRevealPayload, isRevealPayload } from "./revealPayload.js";
import { characters } from "../setupDraft.js";
import { sectsAndVioletsCharacters } from "../sectsAndVioletsCharacters.js";
import { isScriptId } from "./scripts.js";

const phases = new Set<Phase>(["setup", "firstNight", "day", "night"]);
const stepTypes = new Set<PhaseStep["stepType"]>([
  "evilInfo",
  "character",
  "phaseTransition",
  "announcement",
  "whisper",
  "discussion",
  "nomination",
  "execution",
  "executionDeath",
  "slayerDeath",
  "demonSuccession",
  "redHerringAssignment",
  "pitHagArbitraryDeaths",
]);
const inputKinds = new Set([
  "none",
  "playerIds",
  "characterIds",
  "characterTransformation",
  "setupInfo",
  "number",
  "nominationVote",
  "nomination",
  "executionDecision",
  "executionDeathDecision",
  "slayerDeathDecision",
  "demonSuccession",
  "day",
  "night",
]);
const inputTargets = new Set([
  "player",
  "players",
  "characters",
  "setupInfo",
  "number",
  "nomination",
  "execution",
  "phase",
]);
const characterIds = new Set([
  ...characters.map((character) => character.id),
  ...sectsAndVioletsCharacters.map((character) => character.id),
]);
const systemTokenIds = new Set(["drunk", "poisoned", "protected", "noAbility", "abilitySpent", "needsFollowUp"]);
const scriptTokenKeys = new Set([
  "butler:master",
  "drunk:isTheDrunk",
  "fortuneTeller:redHerring",
  "imp:dead",
  "investigator:minion",
  "investigator:wrong",
  "librarian:outsider",
  "librarian:wrong",
  "monk:safe",
  "poisoner:poisoned",
  "scarletWoman:isTheDemon",
  "slayer:noAbility",
  "undertaker:diedToday",
  "virgin:noAbility",
  "washerwoman:townsfolk",
  "washerwoman:wrong",
]);

export function parseCoreResult<T>(
  value: unknown,
  parseValue: (value: unknown) => T,
): CoreResult<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") throw invalidCoreResponse();
  if (value.ok) return { ok: true, value: parseValue(value.value) };
  if (
    !isRecord(value.error) ||
    typeof value.error.code !== "string" ||
    typeof value.error.messageKo !== "string"
  ) {
    throw invalidCoreResponse();
  }
  return { ok: false, error: { code: value.error.code, messageKo: value.error.messageKo } };
}

export function parseGameEvent(value: unknown): GameEvent {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.type !== "string" ||
    !isPhase(value.phase) ||
    !isRecord(value.payload) ||
    typeof value.summary !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("이벤트 형식이 올바르지 않습니다.");
  }

  const payload = value.payload;
  switch (value.type) {
    case "smokeConfirmed":
      if (typeof payload.source !== "string") throw invalidEvent();
      break;
    case "setupConfirmed":
      if (!Array.isArray(payload.players) || !payload.players.every(isSetupPlayer)) throw invalidEvent();
      break;
    case "phaseStepConfirmed":
      if (
        typeof payload.stepId !== "string" ||
        !isPhaseStepInput(payload.input) ||
        (payload.information !== undefined && !isConfirmedInformation(payload.information))
      ) {
        throw invalidEvent();
      }
      break;
    case "phaseStepSkipped":
    case "phaseStepNeedsFollowUp":
      if (typeof payload.stepId !== "string") throw invalidEvent();
      break;
    case "manualPhaseStepResolved":
      if (
        !hasExactKeys(payload, ["stepId", "outcome"]) ||
        typeof payload.stepId !== "string" ||
        (payload.outcome !== "handled" && payload.outcome !== "notApplicable")
      ) {
        throw invalidEvent();
      }
      break;
    case "nominationVoteConfirmed":
      if (!isNominationVotePayload(payload)) throw invalidEvent();
      break;
    case "nominationStarted":
      if (
        !hasExactKeys(payload, ["stepId", "nominatorId", "nomineeId", "registrationJudgments", "virginResolution"]) ||
        typeof payload.stepId !== "string" ||
        typeof payload.nominatorId !== "string" ||
        typeof payload.nomineeId !== "string" ||
        !Array.isArray(payload.registrationJudgments) ||
        !payload.registrationJudgments.every(isRegistrationJudgment) ||
        !isVirginResolution(payload.virginResolution)
      ) {
        throw invalidEvent();
      }
      break;
    case "executionConfirmed":
    case "noExecutionConfirmed":
      if (
        typeof payload.stepId !== "string" ||
        !isRecord(payload.input) ||
        typeof payload.input.execute !== "boolean" ||
        !isOptionalNullableString(payload.input.playerId)
      ) {
        throw invalidEvent();
      }
      break;
    case "deathConfirmed":
      if (
        !hasOnlyKeys(payload, ["playerId", "stepId"]) ||
        typeof payload.playerId !== "string" ||
        (payload.stepId !== undefined && typeof payload.stepId !== "string")
      ) {
        throw invalidEvent();
      }
      break;
    case "executionSurvivalConfirmed":
      if (
        !hasExactKeys(payload, ["stepId", "playerId"]) ||
        typeof payload.stepId !== "string" ||
        typeof payload.playerId !== "string"
      ) {
        throw invalidEvent();
      }
      break;
    case "redHerringAssigned":
      if (
        !hasExactKeys(payload, ["stepId", "playerId", "registrationJudgments"]) ||
        typeof payload.stepId !== "string" ||
        typeof payload.playerId !== "string" ||
        !Array.isArray(payload.registrationJudgments) ||
        !payload.registrationJudgments.every(isRegistrationJudgment)
      ) throw invalidEvent();
      break;
    case "nightActionResolved":
      const isDemonAttack = isRecord(payload.resolution) && payload.resolution.kind === "demonAttack";
      if (
        !(isDemonAttack
          ? hasExactKeys(payload, ["stepId", "actorPlayerId", "actorCharacterId", "resolution"])
          : hasExactKeys(payload, ["stepId", "actorPlayerId", "resolution"])) ||
        typeof payload.stepId !== "string" ||
        typeof payload.actorPlayerId !== "string" ||
        (isDemonAttack && typeof payload.actorCharacterId !== "string") ||
        !isNightActionResolution(payload.resolution)
      ) throw invalidEvent();
      break;
    case "nightDeathsAnnounced":
      if (
        !hasExactKeys(payload, ["stepId", "playerIds"]) ||
        typeof payload.stepId !== "string" ||
        !Array.isArray(payload.playerIds) ||
        !payload.playerIds.every(isString)
      ) throw invalidEvent();
      break;
    case "slayerAbilityUsed":
      if (!isSlayerAbilityPayload(payload)) throw invalidEvent();
      break;
    case "dayActionRecorded":
      if (!isDayActionRecordedPayload(payload)) throw invalidEvent();
      break;
    case "demonSuccessionConfirmed":
      if (!isDemonSuccessionPayload(payload)) throw invalidEvent();
      break;
    case "snakeCharmerActionResolved":
      if (!isSnakeCharmerActionPayload(payload)) throw invalidEvent();
      break;
    case "pitHagTransformationResolved":
      if (!isPitHagTransformationPayload(payload)) throw invalidEvent();
      break;
    case "pitHagArbitraryDeathsConfirmed":
      if (!isPitHagArbitraryDeathsPayload(payload)) throw invalidEvent();
      break;
    case "playerAnnotationsUpdated":
      if (!isPlayerAnnotationsPayload(payload)) throw invalidEvent();
      break;
    case "gameEnded":
      if (
        !hasExactKeys(payload, ["winningTeam"]) ||
        (payload.winningTeam !== "good" && payload.winningTeam !== "evil")
      ) throw invalidEvent();
      break;
    default:
      throw new Error("지원하지 않는 이벤트입니다.");
  }

  return value as GameEvent;
}

function isDayActionRecordedPayload(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["dayId", "actorPlayerId", "characterId", "record"]) ||
    typeof value.dayId !== "string" ||
    typeof value.actorPlayerId !== "string" ||
    !isDayActionRecord(value.record)
  ) return false;
  return value.characterId === value.record.kind;
}

function isDayActionRecord(value: unknown): value is DayActionRecordInput {
  if (!isRecord(value)) return false;
  if (value.kind === "artist") {
    return hasExactKeys(value, ["kind", "question", "answer"])
      && typeof value.question === "string"
      && ["yes", "no", "unknown"].includes(String(value.answer));
  }
  if (value.kind === "savant") {
    return hasExactKeys(value, ["kind", "referenceSentences"])
      && Array.isArray(value.referenceSentences)
      && value.referenceSentences.length <= 2
      && value.referenceSentences.every(isString);
  }
  if (value.kind === "juggler") {
    return hasExactKeys(value, ["kind", "correctCount"])
      && Number.isInteger(value.correctCount)
      && Number(value.correctCount) >= 0
      && Number(value.correctCount) <= 5;
  }
  return false;
}

function isAvailableDayAction(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["actorPlayerId", "characterId", "dayId"])
    && typeof value.actorPlayerId === "string"
    && ["artist", "savant", "juggler"].includes(String(value.characterId))
    && typeof value.dayId === "string";
}

function isConfirmedDayActionRecord(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["eventId", "actorPlayerId", "characterId", "dayId", "record"])
    && typeof value.eventId === "string"
    && typeof value.actorPlayerId === "string"
    && typeof value.dayId === "string"
    && isDayActionRecord(value.record)
    && value.characterId === value.record.kind;
}

export function parseReplayState(value: unknown): ReplayState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 3 ||
    !isScriptId(value.scriptId) ||
    typeof value.eventCount !== "number" ||
    !isPhase(value.phase) ||
    !Array.isArray(value.players) ||
    !value.players.every(isPlayer) ||
    !(value.currentStep === null || isPhaseStep(value.currentStep)) ||
    !Array.isArray(value.phaseOverview) ||
    !value.phaseOverview.every(isPhaseOverviewItem) ||
    (value.dayState !== undefined && !isDayState(value.dayState)) ||
    !isRuleState(value.ruleState) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(isWarning) ||
    (value.pendingIdentityReveals !== undefined &&
      !isPendingIdentityRevealList(value.pendingIdentityReveals)) ||
    (value.availableDayActions !== undefined &&
      (!Array.isArray(value.availableDayActions) || !value.availableDayActions.every(isAvailableDayAction))) ||
    (value.dayActionRecords !== undefined &&
      (!Array.isArray(value.dayActionRecords) || !value.dayActionRecords.every(isConfirmedDayActionRecord))) ||
    !(
      value.gameEnd === undefined ||
      value.gameEnd === null ||
      isGameEndState(value.gameEnd)
    )
  ) {
    throw invalidCoreResponse();
  }
  return value as ReplayState;
}

export function parseProposal(value: unknown): Proposal {
  if (
    !isRecord(value) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(isWarning) ||
    !Array.isArray(value.followUpSteps)
  ) {
    throw invalidCoreResponse();
  }
  const event = parseGameEvent(value.event);
  if (value.revealPayload !== undefined && !isRevealPayload(value.revealPayload)) {
    throw invalidCoreResponse();
  }
  return { ...value, event } as Proposal;
}

export function parseSetupDistribution(value: unknown): SetupDistribution {
  if (
    !isRecord(value) ||
    ![value.Townsfolk, value.Outsider, value.Minion, value.Demon].every(
      (count) => typeof count === "number" && Number.isInteger(count),
    )
  ) {
    throw invalidCoreResponse();
  }
  return value as SetupDistribution;
}

export function parsePhaseInputSuggestion(value: unknown): PhaseInputSuggestion {
  if (
    !isRecord(value) ||
    typeof value.stepId !== "string" ||
    !isCompleteSuggestedInput(value.input)
  ) {
    throw invalidCoreResponse();
  }
  return value as PhaseInputSuggestion;
}

function isCompleteSuggestedInput(value: unknown): value is PhaseInputSuggestion["input"] {
  if (!isRecord(value)) return false;
  if (value.zeroOutsiders === true) {
    return (
      (value.playerIds === undefined || (Array.isArray(value.playerIds) && value.playerIds.length === 0)) &&
      value.characterId === undefined &&
      value.characterIds === undefined
    );
  }
  if (Array.isArray(value.playerIds)) {
    return (
      value.playerIds.length === 2 &&
      value.playerIds.every(isString) &&
      new Set(value.playerIds).size === 2 &&
      typeof value.characterId === "string" &&
      characterIds.has(value.characterId) &&
      value.characterIds === undefined &&
      value.zeroOutsiders !== true
    );
  }
  return (
    Array.isArray(value.characterIds) &&
    value.characterIds.length === 3 &&
    value.characterIds.every(isKnownCharacter) &&
    new Set(value.characterIds).size === 3 &&
    value.playerIds === undefined &&
    value.characterId === undefined &&
    value.zeroOutsiders !== true
  );
}

function isPhaseStep(value: unknown): value is PhaseStep {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isPhase(value.phase) &&
    typeof value.stepType === "string" &&
    stepTypes.has(value.stepType as PhaseStep["stepType"]) &&
    isOptionalString(value.character) &&
    isOptionalString(value.playerId) &&
    isRequiredInput(value.requiredInput) &&
    typeof value.canSkip === "boolean" &&
    (value.support === undefined || value.support === "automated" || value.support === "manual") &&
    (value.preActionReveal === undefined || isPreActionReveal(value.preActionReveal)) &&
    (value.informationPrompt === undefined ||
      isInformationPrompt(value.informationPrompt, value.requiredInput.kind))
  );
}

function isPreActionReveal(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.kind === "characterChange" &&
    typeof value.sourceEventId === "string" &&
    typeof value.playerId === "string" &&
    value.alignment === "evil" &&
    value.characterId === "imp"
  );
}

function isInformationPrompt(value: unknown, inputKind: unknown): value is InformationPrompt {
  if (
    !isRecord(value) ||
    (value.deliveryMode !== "fixed" && value.deliveryMode !== "selectable") ||
    !Array.isArray(value.activeReasons) ||
    !value.activeReasons.every(isDeliveryReason) ||
    !Array.isArray(value.registrationCandidatePlayerIds) ||
    !value.registrationCandidatePlayerIds.every(isString) ||
    !Array.isArray(value.numberChoices) ||
    !value.numberChoices.every(isNumberChoice) ||
    (value.booleanChoices !== undefined &&
      (!Array.isArray(value.booleanChoices) || !value.booleanChoices.every(isBooleanChoice))) ||
    !Array.isArray(value.setupInfoRegistrationOptions) ||
    !value.setupInfoRegistrationOptions.every(isSetupInfoRegistrationOption) ||
    (value.targetChecks !== undefined &&
      (!Array.isArray(value.targetChecks) || !value.targetChecks.every(isTargetCheck)))
  ) {
    return false;
  }

  const impaired = value.activeReasons.some(
    (reason) => isRecord(reason) && (reason.type === "drunk" || reason.type === "poisoned"),
  );
  if (
    impaired &&
    value.numberChoices.some(
      (choice) =>
        isRecord(choice) &&
        Array.isArray(choice.registrationJudgments) &&
        choice.registrationJudgments.length > 0,
    )
  ) {
    return false;
  }

  if (value.targetChecks && value.targetChecks.length > 0) {
    return (value.computedResult === undefined || isInformationResult(value.computedResult))
      && value.numberChoices.length === 0 && (value.booleanChoices?.length ?? 0) === 0;
  }
  if (value.computedResult === undefined) {
    return inputKind === "setupInfo" && value.numberChoices.length === 0 && (value.booleanChoices?.length ?? 0) === 0;
  }
  if (!isInformationResult(value.computedResult)) return false;
  if (value.computedResult.kind === "boolean") {
    const choices = value.booleanChoices ?? [];
    const computedChoices = choices.filter((choice) => choice.isComputed);
    return value.numberChoices.length === 0 && computedChoices.length === 1 &&
      computedChoices[0]?.value === value.computedResult.value &&
      new Set(choices.map((choice) => choice.value)).size === choices.length;
  }
  if (value.computedResult.kind !== "number") {
    return value.numberChoices.length === 0 && (value.booleanChoices?.length ?? 0) === 0;
  }

  const computedChoices = value.numberChoices.filter((choice) => choice.isComputed);
  const uniqueValues = new Set(value.numberChoices.map((choice) => choice.value));
  return (
    computedChoices.length === 1 &&
    computedChoices[0]?.value === value.computedResult.value &&
    uniqueValues.size === value.numberChoices.length &&
    (value.booleanChoices?.length ?? 0) === 0
  );
}

function isConfirmedInformation(value: unknown): value is ConfirmedInformation {
  return (
    isRecord(value) &&
    (value.actor === undefined || isInformationActor(value.actor)) &&
    Array.isArray(value.targetPlayerIds) &&
    value.targetPlayerIds.every(isString) &&
    isOptionalImpairedComputedResult(value.computedResult, value.deliveredResult, value.deliveryContext) &&
    isInformationResult(value.deliveredResult) &&
    isDeliveryContext(value.deliveryContext)
  );
}

function isOptionalImpairedComputedResult(
  computedResult: unknown,
  deliveredResult: unknown,
  deliveryContext: unknown,
): boolean {
  if (computedResult !== undefined) return isInformationResult(computedResult);
  if (!isRecord(deliveredResult) || deliveredResult.kind !== "setupInfo") return false;
  if (!isRecord(deliveryContext) || deliveryContext.type !== "discretionary") return false;
  return (
    Array.isArray(deliveryContext.reasons) &&
    deliveryContext.reasons.some(
      (reason) => isRecord(reason) && (reason.type === "drunk" || reason.type === "poisoned"),
    )
  );
}

function isInformationActor(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.playerId === "string" &&
    typeof value.characterId === "string" &&
    characterIds.has(value.characterId)
  );
}

function isInformationResult(value: unknown): value is InformationResult {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "number":
      return (
        typeof value.value === "number" &&
        Number.isInteger(value.value) &&
        value.value >= 0 &&
        value.value <= 15
      );
    case "boolean":
      return typeof value.value === "boolean";
    case "character":
      return isKnownCharacter(value.characterId);
    case "characterPair":
      return Array.isArray(value.characterIds) && value.characterIds.length === 2
        && value.characterIds.every(isKnownCharacter);
    case "player":
      return typeof value.playerId === "string";
    case "playerPair":
      return Array.isArray(value.playerIds) && value.playerIds.length === 2
        && value.playerIds.every(isString) && new Set(value.playerIds).size === 2;
    case "setupInfo":
      return (
        Array.isArray(value.playerIds) &&
        value.playerIds.every(isString) &&
        isOptionalKnownCharacter(value.characterId) &&
        typeof value.zeroOutsiders === "boolean"
      );
    case "teamInfo":
      return (
        Array.isArray(value.demonPlayerIds) &&
        value.demonPlayerIds.every(isString) &&
        Array.isArray(value.minionPlayerIds) &&
        value.minionPlayerIds.every(isString) &&
        Array.isArray(value.bluffCharacterIds) &&
        value.bluffCharacterIds.every(isKnownCharacter)
      );
    case "spyGrimoire":
      return Array.isArray(value.players) && value.players.every(isSpyGrimoirePlayer);
    default:
      return false;
  }
}

function isSpyGrimoirePlayer(value: unknown): boolean {
  if (
    !(
      isRecord(value) &&
      typeof value.playerId === "string" &&
      typeof value.seat === "number" &&
      Number.isInteger(value.seat) &&
      typeof value.name === "string" &&
      typeof value.characterId === "string" &&
      characterIds.has(value.characterId)
    )
  ) {
    return false;
  }
  const hasSnapshotFields =
    typeof value.alive === "boolean" &&
    typeof value.ghostVoteUsed === "boolean" &&
    Array.isArray(value.reminderTokens) &&
    value.reminderTokens.every((token) => token === "poisoned" || token === "protected");
  const isLegacy =
    value.alive === undefined &&
    value.ghostVoteUsed === undefined &&
    value.reminderTokens === undefined;
  return hasSnapshotFields || isLegacy;
}

function isDeliveryContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.type === "fixed") return true;
  return (
    value.type === "discretionary" &&
    Array.isArray(value.reasons) &&
    value.reasons.every(isDeliveryReason)
  );
}

function isDeliveryReason(value: unknown): value is DeliveryReason {
  if (!isRecord(value)) return false;
  if (value.type === "abilityChoice") return true;
  if (value.type === "drunk") return true;
  if (value.type === "poisoned") {
    return typeof value.poisonerPlayerId === "string" && typeof value.poisonEventId === "string";
  }
  if (value.type === "vortox") return typeof value.demonPlayerId === "string";
  return (
    value.type === "registrationJudgment" &&
    Array.isArray(value.judgments) &&
    value.judgments.every(isRegistrationJudgment)
  );
}

function isRegistrationJudgment(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.playerId === "string" &&
    ["good", "evil", "townsfolk", "outsider", "minion", "demon"].includes(
      String(value.registeredAs),
    ) &&
    isOptionalKnownCharacter(value.characterId)
  );
}

function isNumberChoice(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.value === "number" &&
    Number.isInteger(value.value) &&
    value.value >= 0 &&
    value.value <= 15 &&
    typeof value.isComputed === "boolean" &&
    Array.isArray(value.registrationJudgments) &&
    value.registrationJudgments.every(isRegistrationJudgment)
  );
}

function isBooleanChoice(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.value === "boolean" &&
    typeof value.isComputed === "boolean" &&
    Array.isArray(value.registrationJudgments) &&
    value.registrationJudgments.every(isRegistrationJudgment)
  );
}

function isSetupInfoRegistrationOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.playerId === "string" &&
    ["good", "evil", "townsfolk", "outsider", "minion", "demon"].includes(
      String(value.registeredAs),
    ) &&
    Array.isArray(value.characterIds) &&
    value.characterIds.length > 0 &&
    value.characterIds.every(isKnownCharacter)
  );
}

function isPhaseOverviewItem(value: unknown): boolean {
  return (
    isPhaseStep(value) &&
    isRecord(value) &&
    ["waiting", "current", "complete", "skipped", "needsFollowUp", "manualComplete", "notApplicable"].includes(
      String((value as unknown as Record<string, unknown>).status),
    )
  );
}

function isRequiredInput(value: unknown): value is PhaseStep["requiredInput"] {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    inputKinds.has(value.kind) &&
    (value.target === undefined || (typeof value.target === "string" && inputTargets.has(value.target))) &&
    (value.minSelections === undefined || typeof value.minSelections === "number") &&
    (value.maxSelections === undefined || typeof value.maxSelections === "number") &&
    (value.setupInfo === undefined ||
      ["washerwoman", "librarian", "investigator"].includes(String(value.setupInfo))) &&
    (value.characterKind === undefined ||
      ["Townsfolk", "Outsider", "Minion", "Demon"].includes(String(value.characterKind))) &&
    (value.allowedCharacterIds === undefined ||
      (Array.isArray(value.allowedCharacterIds) && value.allowedCharacterIds.every(isKnownCharacter))) &&
    (value.allowedPlayerIds === undefined ||
      (Array.isArray(value.allowedPlayerIds) && value.allowedPlayerIds.every(isString))) &&
    (value.playerRegistrationOptions === undefined ||
      (Array.isArray(value.playerRegistrationOptions) &&
        value.playerRegistrationOptions.every(isRegistrationJudgment))) &&
    (value.zeroAllowed === undefined || typeof value.zeroAllowed === "boolean") &&
    (value.supportsRandomSuggestion === undefined || typeof value.supportsRandomSuggestion === "boolean") &&
    (value.executionSurvivalAllowed === undefined || typeof value.executionSurvivalAllowed === "boolean") &&
    (value.playerId === undefined || typeof value.playerId === "string") &&
    (value.survivalAllowed === undefined || typeof value.survivalAllowed === "boolean") &&
    (value.mayorDecision === undefined || isMayorDecisionPrompt(value.mayorDecision)) &&
    (value.demonSuccession === undefined || isDemonSuccessionPrompt(value.demonSuccession)) &&
    typeof value.optional === "boolean"
  );
}

function isTargetCheck(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["targetPlayerIds", "computedResult", "choices"]) &&
    Array.isArray(value.targetPlayerIds) &&
    value.targetPlayerIds.every(isString) &&
    isInformationResult(value.computedResult) &&
    Array.isArray(value.choices) &&
    value.choices.length > 0 &&
    value.choices.every((choice) =>
      isRecord(choice) &&
      hasExactKeys(choice, ["result", "isComputed", "registrationJudgments"]) &&
      isInformationResult(choice.result) &&
      typeof choice.isComputed === "boolean" &&
      Array.isArray(choice.registrationJudgments) &&
      choice.registrationJudgments.every(isRegistrationJudgment)
    )
  );
}

function isRuleState(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "redHerringPlayerId",
      "activePoison",
      "activeProtection",
      "unannouncedNightDeathPlayerIds",
      "slayerAbility",
      "virginAbility",
      "butlerVote",
      "activeImpairments",
      "automaticReminders",
    ]) &&
    isOptionalString(value.redHerringPlayerId) &&
    (value.activePoison === undefined || isActiveRuleEffect(value.activePoison)) &&
    (value.activeProtection === undefined || isActiveRuleEffect(value.activeProtection)) &&
    Array.isArray(value.unannouncedNightDeathPlayerIds) &&
    value.unannouncedNightDeathPlayerIds.every(isString) &&
    (value.slayerAbility === undefined ||
      (isRecord(value.slayerAbility) &&
        hasExactKeys(value.slayerAbility, ["actorPlayerId", "spent", "canUseNow"]) &&
        typeof value.slayerAbility.actorPlayerId === "string" &&
        typeof value.slayerAbility.spent === "boolean" &&
        typeof value.slayerAbility.canUseNow === "boolean")) &&
    (value.virginAbility === undefined ||
      (isRecord(value.virginAbility) &&
        hasOnlyKeys(value.virginAbility, ["actorPlayerId", "spent", "spentByNominationEventId"]) &&
        typeof value.virginAbility.actorPlayerId === "string" &&
        typeof value.virginAbility.spent === "boolean" &&
        isOptionalString(value.virginAbility.spentByNominationEventId))) &&
    (value.butlerVote === undefined ||
      (isRecord(value.butlerVote) &&
        hasOnlyKeys(value.butlerVote, ["butlerPlayerId", "masterPlayerId", "restrictionApplies"]) &&
        typeof value.butlerVote.butlerPlayerId === "string" &&
        isOptionalString(value.butlerVote.masterPlayerId) &&
        typeof value.butlerVote.restrictionApplies === "boolean")) &&
    (value.activeImpairments === undefined ||
      (Array.isArray(value.activeImpairments) && value.activeImpairments.every(isActiveImpairment))) &&
    (value.automaticReminders === undefined ||
      (Array.isArray(value.automaticReminders) && value.automaticReminders.every(isAutomaticReminder)))
  );
}

function isAutomaticReminder(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["playerId", "characterId", "tokenId", "label", "description"]) &&
    typeof value.playerId === "string" &&
    (value.characterId === "flowergirl" || value.characterId === "townCrier") &&
    typeof value.tokenId === "string" &&
    typeof value.label === "string" &&
    typeof value.description === "string";
}

function isActiveRuleEffect(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["playerId", "sourcePlayerId", "sourceEventId"]) &&
    typeof value.playerId === "string" && typeof value.sourcePlayerId === "string" &&
    typeof value.sourceEventId === "string";
}

function isSlayerAbilityPayload(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "discussionStepId",
      "actorPlayerId",
      "targetPlayerId",
      "impairmentContext",
      "registrationContext",
      "outcome",
    ]) ||
    typeof value.discussionStepId !== "string" ||
    typeof value.actorPlayerId !== "string" ||
    typeof value.targetPlayerId !== "string" ||
    !isRecord(value.impairmentContext) ||
    !isRecord(value.registrationContext) ||
    !isRecord(value.outcome)
  ) return false;
  const impairment = value.impairmentContext;
  const impairmentValid = impairment.kind === "healthy"
    ? hasExactKeys(impairment, ["kind"])
    : impairment.kind === "poisoned" &&
      hasExactKeys(impairment, ["kind", "sourcePlayerId", "sourceEventId"]) &&
      typeof impairment.sourcePlayerId === "string" &&
      typeof impairment.sourceEventId === "string";
  const registration = value.registrationContext;
  const registrationValid = registration.kind === "canonical"
    ? hasExactKeys(registration, ["kind", "registeredAsDemon"]) &&
      typeof registration.registeredAsDemon === "boolean"
    : registration.kind === "recluseDecision" &&
      hasOnlyKeys(registration, ["kind", "registeredAsDemon", "registeredCharacterId"]) &&
      typeof registration.registeredAsDemon === "boolean" &&
      (registration.registeredCharacterId === undefined || registration.registeredCharacterId === "imp");
  const outcome = value.outcome;
  const outcomeValid = outcome.kind === "deathPending"
    ? hasExactKeys(outcome, ["kind", "playerId"]) && typeof outcome.playerId === "string"
    : outcome.kind === "noEffect" &&
      hasExactKeys(outcome, ["kind", "reason"]) &&
      ["actorPoisoned", "targetNotDemon", "targetAlreadyDead"].includes(String(outcome.reason));
  return impairmentValid && registrationValid && outcomeValid;
}

function isNightActionResolution(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "poison" || value.kind === "monkProtection") {
    return hasOnlyKeys(value, ["kind", "targetPlayerId", "applied", "noEffectReason"]) &&
      typeof value.targetPlayerId === "string" && typeof value.applied === "boolean" &&
      (value.noEffectReason === undefined || value.noEffectReason === "actorImpaired" || value.noEffectReason === "notActualCharacter");
  }
  if (value.kind === "demonAttack") {
    if (!hasExactKeys(value, ["kind", "targetPlayerId", "outcome"]) ||
        typeof value.targetPlayerId !== "string" || !isRecord(value.outcome)) return false;
    const outcome = value.outcome;
    if (outcome.kind === "noEffect") {
      return hasExactKeys(outcome, ["kind", "reason"]) &&
        ["targetAlreadyDead", "actorImpaired", "notActualCharacter", "pitHagCreatedDemon"].includes(String(outcome.reason));
    }
    return outcome.kind === "deaths" && hasExactKeys(outcome, ["kind", "deaths"]) &&
      Array.isArray(outcome.deaths) && outcome.deaths.length > 0 && outcome.deaths.every((death) => (
        isRecord(death) && hasExactKeys(death, ["playerId", "cause"]) &&
        typeof death.playerId === "string" && isRecord(death.cause) &&
        hasExactKeys(death.cause, ["kind", "actorPlayerId", "actorCharacterId", "targetPlayerId"]) &&
        death.cause.kind === "demonAttack" && typeof death.cause.actorPlayerId === "string" &&
        typeof death.cause.actorCharacterId === "string" && typeof death.cause.targetPlayerId === "string"
      ));
  }
  if (value.kind !== "impAttack" || !hasOnlyKeys(value, ["kind", "targetPlayerId", "mayorContext", "outcome"]) ||
      typeof value.targetPlayerId !== "string" ||
      (value.mayorContext !== undefined && !isMayorAttackContext(value.mayorContext)) ||
      !isRecord(value.outcome)) return false;
  const outcome = value.outcome;
  if (outcome.kind === "death") return hasExactKeys(outcome, ["kind", "playerId"]) && typeof outcome.playerId === "string";
  if (outcome.kind === "prevented") return hasExactKeys(outcome, ["kind", "reason", "sourceEventId"]) &&
    outcome.reason === "monkProtection" && typeof outcome.sourceEventId === "string";
  if (outcome.kind === "soldierProtected") return hasExactKeys(outcome, ["kind", "playerId"]) && typeof outcome.playerId === "string";
  return outcome.kind === "noDeath" && hasExactKeys(outcome, ["kind", "reason"]) &&
    ["alreadyDead", "actorImpaired", "notActualCharacter"].includes(String(outcome.reason));
}

function isPhaseStepInput(value: unknown): value is PhaseStepInput {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if (Array.isArray(value.playerIds) && value.playerIds.every(isString)) {
    return value.mayorDecision === undefined || isMayorDecisionInput(value.mayorDecision);
  }
  if (Array.isArray(value.characterIds) && value.characterIds.every(isString)) return true;
  if (typeof value.nominatorId === "string" && typeof value.nomineeId === "string") {
    return value.voterIds === undefined || (Array.isArray(value.voterIds) && value.voterIds.every(isString));
  }
  if (Array.isArray(value.voterIds) && value.voterIds.every(isString)) return true;
  if (typeof value.successorPlayerId === "string") return true;
  if (typeof value.execute === "boolean") return true;
  if (typeof value.died === "boolean") return true;
  if (value.zeroOutsiders === true) return true;
  return [value.value, value.trueValue, value.displayedValue].some((item) => typeof item === "number");
}

function isSetupPlayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOptionalString(value.id) &&
    typeof value.seat === "number" &&
    typeof value.name === "string" &&
    typeof value.actualCharacter === "string" &&
    isOptionalString(value.shownCharacter)
  );
}

function isNominationRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "stepId",
      "nominatorId",
      "nomineeId",
      "voterIds",
      "voteCount",
      "ghostVoteSpentPlayerIds",
    ]) &&
    typeof value.stepId === "string" &&
    typeof value.nominatorId === "string" &&
    typeof value.nomineeId === "string" &&
    Array.isArray(value.voterIds) &&
    value.voterIds.every(isString) &&
    typeof value.voteCount === "number" &&
    Array.isArray(value.ghostVoteSpentPlayerIds) &&
    value.ghostVoteSpentPlayerIds.every(isString)
  );
}

function isNominationVotePayload(payload: Record<string, unknown>): boolean {
  const sharedValid = typeof payload.stepId === "string" &&
    Array.isArray(payload.voterIds) && payload.voterIds.every(isString) &&
    Array.isArray(payload.ghostVoteSpentPlayerIds) && payload.ghostVoteSpentPlayerIds.every(isString);
  if (!sharedValid) return false;
  const legacy = hasExactKeys(payload, ["stepId", "nominatorId", "nomineeId", "voterIds", "ghostVoteSpentPlayerIds"])
    && typeof payload.nominatorId === "string" && typeof payload.nomineeId === "string";
  const linked = hasExactKeys(payload, ["stepId", "nominationEventId", "voterIds", "ghostVoteSpentPlayerIds"])
    && typeof payload.nominationEventId === "string";
  return legacy || linked;
}

function isVirginResolution(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "notApplicable") return hasExactKeys(value, ["kind"]);
  return (value.kind === "spentNoExecution" || value.kind === "spentAndNominatorExecuted") &&
    hasExactKeys(value, ["kind", "virginPlayerId", "impairmentContext"]) &&
    typeof value.virginPlayerId === "string" && isVirginImpairmentContext(value.impairmentContext);
}

function isVirginImpairmentContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.kind === "healthy"
    ? hasExactKeys(value, ["kind"])
    : value.kind === "poisoned" && hasExactKeys(value, ["kind", "sourcePlayerId", "sourceEventId"])
      && typeof value.sourcePlayerId === "string" && typeof value.sourceEventId === "string";
}

function isDemonSuccessionPayload(value: Record<string, unknown>): boolean {
  return hasExactKeys(value, [
    "triggerImpDeathEventId", "deathCause", "previousImpPlayerId", "successorPlayerId",
    "successorPreviousActualCharacter", "newCharacter", "source",
  ]) && [value.triggerImpDeathEventId, value.previousImpPlayerId, value.successorPlayerId,
    value.successorPreviousActualCharacter, value.newCharacter].every(isString)
    && ["execution", "slayer", "impSelfKill"].includes(String(value.deathCause))
    && ["scarletWoman", "impSelfKill"].includes(String(value.source));
}

function isMayorDecisionPrompt(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["mayorPlayerId", "bounceTargetPlayerIds"])
    && typeof value.mayorPlayerId === "string" && Array.isArray(value.bounceTargetPlayerIds)
    && value.bounceTargetPlayerIds.every(isString);
}

function isDemonSuccessionPrompt(value: unknown): boolean {
  if (!isRecord(value) || typeof value.triggerEventId !== "string") return false;
  if (value.kind === "fixed") return hasExactKeys(value, ["kind", "triggerEventId", "successorPlayerId"])
    && typeof value.successorPlayerId === "string";
  return value.kind === "selectable" && hasExactKeys(value, ["kind", "triggerEventId", "allowedPlayerIds"])
    && Array.isArray(value.allowedPlayerIds) && value.allowedPlayerIds.every(isString);
}

function isMayorDecisionInput(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.kind === "mayorDies"
    ? hasExactKeys(value, ["kind"])
    : value.kind === "bounce" && hasExactKeys(value, ["kind", "targetPlayerId"])
      && typeof value.targetPlayerId === "string";
}

function isMayorAttackContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "notApplicable") return hasExactKeys(value, ["kind"]);
  if (value.kind === "mayorDies") return hasExactKeys(value, ["kind", "mayorPlayerId"])
    && typeof value.mayorPlayerId === "string";
  return value.kind === "bounced" && hasExactKeys(value, ["kind", "mayorPlayerId", "bounceTargetPlayerId"])
    && typeof value.mayorPlayerId === "string" && typeof value.bounceTargetPlayerId === "string";
}

function isDayState(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "nominations",
      "eligibleNominatorIds",
      "eligibleNomineeIds",
      "executionVoteThreshold",
      "highestVoteCount",
      "executionCandidate",
      "confirmedExecution",
      "activeNomination",
    ]) &&
    Array.isArray(value.nominations) &&
    value.nominations.every(isNominationRecord) &&
    Array.isArray(value.eligibleNominatorIds) &&
    value.eligibleNominatorIds.every(isString) &&
    Array.isArray(value.eligibleNomineeIds) &&
    value.eligibleNomineeIds.every(isString) &&
    typeof value.executionVoteThreshold === "number" &&
    Number.isInteger(value.executionVoteThreshold) &&
    value.executionVoteThreshold >= 1 &&
    typeof value.highestVoteCount === "number" &&
    Number.isInteger(value.highestVoteCount) &&
    value.highestVoteCount >= 0 &&
    (value.executionCandidate === undefined ||
      (isRecord(value.executionCandidate) &&
        hasExactKeys(value.executionCandidate, ["nomineeId", "voteCount"]) &&
        typeof value.executionCandidate.nomineeId === "string" &&
        typeof value.executionCandidate.voteCount === "number")) &&
    (value.confirmedExecution === undefined ||
      (isRecord(value.confirmedExecution) &&
        hasOnlyKeys(value.confirmedExecution, ["playerId"]) &&
        isOptionalNullableString(value.confirmedExecution.playerId)))
    && (value.activeNomination === undefined ||
      (isRecord(value.activeNomination) &&
        hasExactKeys(value.activeNomination, ["eventId", "stepId", "nominatorId", "nomineeId"]) &&
        [value.activeNomination.eventId, value.activeNomination.stepId, value.activeNomination.nominatorId, value.activeNomination.nomineeId].every(isString)))
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isPlayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.seat === "number" &&
    typeof value.name === "string" &&
    typeof value.actualCharacter === "string" &&
    typeof value.shownCharacter === "string" &&
    (value.alignment === "good" || value.alignment === "evil") &&
    typeof value.alive === "boolean" &&
    typeof value.ghostVoteUsed === "boolean" &&
    typeof value.deathAnnounced === "boolean" &&
    isSystemTokenList(value.systemTokenIds) &&
    isScriptTokenList(value.scriptTokens) &&
    typeof value.notes === "string" &&
    (value.identityHistory === undefined ||
      (Array.isArray(value.identityHistory) && value.identityHistory.every(isIdentityHistoryEntry)))
  );
}

function isIdentityState(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["actualCharacter", "shownCharacter", "alignment"]) &&
    typeof value.actualCharacter === "string" &&
    typeof value.shownCharacter === "string" &&
    (value.alignment === "good" || value.alignment === "evil");
}

function isIdentityHistoryEntry(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "phase", "before", "after"]) &&
    typeof value.sourceEventId === "string" &&
    isPhase(value.phase) &&
    isIdentityState(value.before) &&
    isIdentityState(value.after);
}

function isPlayerIdentityTransition(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["playerId", "before", "after"]) &&
    typeof value.playerId === "string" &&
    isIdentityState(value.before) &&
    isIdentityState(value.after);
}

function isActiveImpairment(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["kind", "playerId", "sourceEventId", "sourceCharacterId", "expires"]) &&
    value.kind === "poisoned" &&
    typeof value.playerId === "string" &&
    typeof value.sourceEventId === "string" &&
    typeof value.sourceCharacterId === "string" &&
    value.expires === "never";
}

function isPendingIdentityReveal(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "sequence", "payload"]) &&
    typeof value.sourceEventId === "string" &&
    Number.isInteger(value.sequence) &&
    (value.sequence as number) > 0 &&
    isCharacterChangeRevealPayload(value.payload);
}

function isPendingIdentityRevealList(value: unknown): boolean {
  if (!Array.isArray(value) || !value.every(isPendingIdentityReveal)) return false;
  const sourceEventId = value[0]?.sourceEventId;
  return value.every((reveal, index) =>
    reveal.sourceEventId === sourceEventId && reveal.sequence === index + 1);
}

function isSnakeCharmerActionPayload(value: unknown): boolean {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["stepId", "actorPlayerId", "targetPlayerId", "outcome"]) ||
    typeof value.stepId !== "string" ||
    typeof value.actorPlayerId !== "string" ||
    typeof value.targetPlayerId !== "string" ||
    !isRecord(value.outcome)) return false;
  if (value.outcome.kind === "noSwap") {
    return hasExactKeys(value.outcome, ["kind", "reason"]) &&
      (value.outcome.reason === "targetNotDemon" || value.outcome.reason === "actorImpaired");
  }
  return value.outcome.kind === "swap" &&
    hasExactKeys(value.outcome, ["kind", "identityTransitions", "impairment"]) &&
    Array.isArray(value.outcome.identityTransitions) &&
    value.outcome.identityTransitions.length === 2 &&
    value.outcome.identityTransitions.every(isPlayerIdentityTransition) &&
    isActiveImpairment(value.outcome.impairment);
}

function isPitHagTransformationPayload(value: unknown): boolean {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["stepId", "actorPlayerId", "targetPlayerId", "characterId", "outcome"]) ||
    typeof value.stepId !== "string" ||
    typeof value.actorPlayerId !== "string" ||
    typeof value.targetPlayerId !== "string" ||
    !isKnownCharacter(value.characterId) ||
    !isRecord(value.outcome)) return false;
  if (value.outcome.kind === "noChange") {
    return hasExactKeys(value.outcome, ["kind", "reason"]) &&
      ["characterAlreadyInPlay", "actorImpaired", "notActualCharacter"].includes(String(value.outcome.reason));
  }
  return value.outcome.kind === "changed" &&
    hasExactKeys(value.outcome, ["kind", "identityTransition", "createdDemon"]) &&
    isPlayerIdentityTransition(value.outcome.identityTransition) &&
    typeof value.outcome.createdDemon === "boolean";
}

function isPitHagArbitraryDeathsPayload(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["stepId", "sourceTransformationEventId", "deaths"]) &&
    typeof value.stepId === "string" &&
    typeof value.sourceTransformationEventId === "string" &&
    Array.isArray(value.deaths) && value.deaths.every(isNightDeath);
}

function isNightDeath(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["playerId", "cause"]) ||
    typeof value.playerId !== "string" || !isRecord(value.cause)) return false;
  if (value.cause.kind === "demonAttack") {
    return hasExactKeys(value.cause, ["kind", "actorPlayerId", "actorCharacterId", "targetPlayerId"]) &&
      typeof value.cause.actorPlayerId === "string" &&
      typeof value.cause.actorCharacterId === "string" &&
      typeof value.cause.targetPlayerId === "string";
  }
  return value.cause.kind === "pitHagArbitraryDeath" &&
    hasExactKeys(value.cause, ["kind", "actorPlayerId", "sourceTransformationEventId"]) &&
    typeof value.cause.actorPlayerId === "string" &&
    typeof value.cause.sourceTransformationEventId === "string";
}

function isPlayerAnnotationsPayload(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["playerId", "systemTokenIds", "scriptTokens", "notes"]) &&
    typeof value.playerId === "string" &&
    isSystemTokenList(value.systemTokenIds) &&
    isScriptTokenList(value.scriptTokens) &&
    typeof value.notes === "string" &&
    [...value.notes].length <= 1_000;
}

function isSystemTokenList(value: unknown): boolean {
  return Array.isArray(value) &&
    value.every((token) => typeof token === "string" && systemTokenIds.has(token)) &&
    new Set(value).size === value.length;
}

function isScriptTokenList(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const keys = value.map((token) => isRecord(token) &&
    hasExactKeys(token, ["characterId", "tokenId"]) &&
    typeof token.characterId === "string" &&
    typeof token.tokenId === "string"
      ? `${token.characterId}:${token.tokenId}`
      : undefined);
  return keys.every((key) => typeof key === "string" && scriptTokenKeys.has(key)) &&
    new Set(keys).size === keys.length;
}

function isWarning(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    (value.severity === "warning" || value.severity === "info") &&
    typeof value.messageKo === "string" &&
    (value.winningTeam === undefined || value.winningTeam === "good" || value.winningTeam === "evil")
  );
}

function isGameEndState(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["eventId", "winningTeam"]) &&
    typeof value.eventId === "string" &&
    (value.winningTeam === "good" || value.winningTeam === "evil");
}

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && phases.has(value as Phase);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isKnownCharacter(value: unknown): value is string {
  return typeof value === "string" && characterIds.has(value);
}

function isOptionalKnownCharacter(value: unknown): boolean {
  return value === undefined || isKnownCharacter(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function invalidEvent(): Error {
  return new Error("이벤트 형식이 올바르지 않습니다.");
}

function invalidCoreResponse(): Error {
  return new Error("코어 응답 형식이 올바르지 않습니다.");
}
