import type {
  ActiveImpairment,
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
import { isCharacterChangeRevealPayload, isEvilTwinPairRevealPayload, isMadnessAssignmentRevealPayload, isRevealPayload } from "./revealPayload.js";
import { characters } from "../setupDraft.js";
import { sectsAndVioletsCharacters } from "../sectsAndVioletsCharacters.js";
import { isScriptId } from "./scripts.js";
import { eventDiscriminatorSet } from "./wireDiscriminators.js";

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
  "witchDeath",
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
  "madnessAssignment",
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
  if (!eventDiscriminatorSet.has(value.type)) {
    throw new Error("지원하지 않는 이벤트입니다.");
  }
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
    case "philosopherAbilityResolved":
      if (!isPhilosopherAbilityResolvedPayload(payload)) throw invalidEvent();
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
        !(
          hasExactKeys(payload, ["stepId", "nominatorId", "nomineeId", "registrationJudgments", "virginResolution"]) ||
          hasExactKeys(payload, ["stepId", "nominatorId", "nomineeId", "registrationJudgments", "virginResolution", "witchResolution"])
        ) ||
        typeof payload.stepId !== "string" ||
        typeof payload.nominatorId !== "string" ||
        typeof payload.nomineeId !== "string" ||
        !Array.isArray(payload.registrationJudgments) ||
        !payload.registrationJudgments.every(isRegistrationJudgment) ||
        !isVirginResolution(payload.virginResolution) ||
        (payload.witchResolution !== undefined && !isWitchNominationResolution(payload.witchResolution))
      ) {
        throw invalidEvent();
      }
      break;
    case "witchCurseAssigned":
      if (
        !hasExactKeys(payload, ["stepId", "actorPlayerId", "targetPlayerId", "sourceAbilityInstanceId", "effective"]) ||
        typeof payload.stepId !== "string" || typeof payload.actorPlayerId !== "string" ||
        typeof payload.targetPlayerId !== "string" || typeof payload.sourceAbilityInstanceId !== "string" ||
        typeof payload.effective !== "boolean"
      ) throw invalidEvent();
      break;
    case "evilTwinPairAssigned":
      if (
        !hasExactKeys(payload, ["stepId", "actorPlayerId", "twinPlayerId", "sourceAbilityInstanceId", "actorAlignment", "twinAlignment"]) ||
        typeof payload.stepId !== "string" || typeof payload.actorPlayerId !== "string" ||
        typeof payload.twinPlayerId !== "string" || typeof payload.sourceAbilityInstanceId !== "string" ||
        (payload.actorAlignment !== "good" && payload.actorAlignment !== "evil") ||
        (payload.twinAlignment !== "good" && payload.twinAlignment !== "evil") ||
        payload.actorAlignment === payload.twinAlignment
      ) throw invalidEvent();
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
        !hasOnlyKeys(payload, ["stepId", "playerIds", "resurrectedPlayerIds"]) ||
        typeof payload.stepId !== "string" ||
        !Array.isArray(payload.playerIds) ||
        !payload.playerIds.every(isString) ||
        (payload.resurrectedPlayerIds !== undefined &&
          (!Array.isArray(payload.resurrectedPlayerIds) || !payload.resurrectedPlayerIds.every(isString)))
      ) throw invalidEvent();
      break;
    case "slayerAbilityUsed":
      if (!isSlayerAbilityPayload(payload)) throw invalidEvent();
      break;
    case "dayActionRecorded":
      if (!isDayActionRecordedPayload(payload)) throw invalidEvent();
      break;
    case "madnessAssigned":
      if (
        !hasExactKeys(payload, ["stepId", "sourcePlayerId", "targetPlayerId", "requiredCharacterId"]) ||
        typeof payload.stepId !== "string" ||
        typeof payload.sourcePlayerId !== "string" ||
        typeof payload.targetPlayerId !== "string" ||
        !isKnownCharacter(payload.requiredCharacterId)
      ) throw invalidEvent();
      break;
    case "madnessCheckRecorded":
      if (
        !hasExactKeys(payload, ["assignmentId", "sourcePlayerId", "sourceCharacterId", "targetPlayerId", "result"]) ||
        typeof payload.assignmentId !== "string" ||
        typeof payload.sourcePlayerId !== "string" ||
        !isMadnessSource(payload.sourceCharacterId) ||
        typeof payload.targetPlayerId !== "string" ||
        (payload.result !== "clear" && payload.result !== "violation")
      ) throw invalidEvent();
      break;
    case "madnessExecutionConfirmed":
      if (
        !(
          hasExactKeys(payload, ["assignmentId", "sourcePlayerId", "sourceCharacterId", "targetPlayerId", "interruptedStepId"]) ||
          hasExactKeys(payload, ["assignmentId", "checkEventId", "sourcePlayerId", "sourceCharacterId", "targetPlayerId", "interruptedStepId"])
        ) ||
        typeof payload.assignmentId !== "string" ||
        (payload.checkEventId !== undefined && typeof payload.checkEventId !== "string") ||
        typeof payload.sourcePlayerId !== "string" ||
        !isMadnessSource(payload.sourceCharacterId) ||
        typeof payload.targetPlayerId !== "string" ||
        typeof payload.interruptedStepId !== "string"
      ) throw invalidEvent();
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
    case "playerTransitioned":
      if (!isPlayerTransitionedPayload(payload)) throw invalidEvent();
      break;
    case "playerAnnotationsUpdated":
      if (!isPlayerAnnotationsPayload(payload)) throw invalidEvent();
      break;
    case "vigormortisPoisonTargetChanged":
      if (
        !hasOnlyKeys(payload, ["sourceEventId", "previousTargetPlayerId", "targetPlayerId"]) ||
        typeof payload.sourceEventId !== "string" ||
        (payload.previousTargetPlayerId !== undefined && typeof payload.previousTargetPlayerId !== "string") ||
        typeof payload.targetPlayerId !== "string"
      ) throw invalidEvent();
      break;
    case "sweetheartConsequenceResolved":
      if (!isSweetheartConsequencePayload(payload)) throw invalidEvent();
      break;
    case "barberConsequenceResolved":
      if (!isBarberConsequencePayload(payload)) throw invalidEvent();
      break;
    case "klutzChoiceResolved":
      if (!isKlutzConsequencePayload(payload)) throw invalidEvent();
      break;
    case "gameEnded":
      if (
        !hasOnlyKeys(payload, ["winningTeam", "source"]) ||
        (payload.winningTeam !== "good" && payload.winningTeam !== "evil") ||
        (payload.source !== undefined && !(
          isRecord(payload.source) &&
          hasExactKeys(payload.source, ["kind", "sourceEventId"]) &&
          (["demonAbsent", "twoLivingPlayers", "klutzChoice", "witchCurseDeath", "evilTwinExecution", "vortoxNoExecution"]
            .includes(String(payload.source.kind))) &&
          typeof payload.source.sourceEventId === "string"
        ))
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
    !hasExactKeys(value, ["dayId", "actorPlayerId", "characterId", "record", "activeReasons"]) ||
    typeof value.dayId !== "string" ||
    typeof value.actorPlayerId !== "string" ||
    !Array.isArray(value.activeReasons) ||
    !value.activeReasons.every(isDeliveryReason) ||
    !isDayActionRecord(value.record)
  ) return false;
  return value.characterId === value.record.kind;
}

function isDayActionRecord(value: unknown): value is DayActionRecordInput {
  if (!isRecord(value)) return false;
  if (value.kind === "artist") {
    return hasExactKeys(value, ["kind", "question", "answer", "truthful"])
      && typeof value.question === "string"
      && value.question.length <= 500
      && (value.question.length === 0 || value.question.trim() === value.question)
      && typeof value.truthful === "boolean"
      && ["yes", "no", "unknown"].includes(String(value.answer));
  }
  if (value.kind === "savant") {
    return hasExactKeys(value, ["kind", "statements"])
      && Array.isArray(value.statements)
      && value.statements.length === 2
      && value.statements.every((statement) =>
        isRecord(statement)
        && hasExactKeys(statement, ["text", "truthful"])
        && typeof statement.text === "string"
        && statement.text.length <= 500
        && (statement.text.length === 0 || statement.text.trim() === statement.text)
        && typeof statement.truthful === "boolean"
      );
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
    && hasExactKeys(value, ["actorPlayerId", "characterId", "dayId", "activeReasons"])
    && typeof value.actorPlayerId === "string"
    && ["artist", "savant", "juggler"].includes(String(value.characterId))
    && typeof value.dayId === "string"
    && Array.isArray(value.activeReasons)
    && value.activeReasons.every(isDeliveryReason);
}

function isConfirmedDayActionRecord(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["eventId", "actorPlayerId", "characterId", "dayId", "record", "activeReasons"])
    && typeof value.eventId === "string"
    && typeof value.actorPlayerId === "string"
    && typeof value.dayId === "string"
    && isDayActionRecord(value.record)
    && value.characterId === value.record.kind
    && Array.isArray(value.activeReasons)
    && value.activeReasons.every(isDeliveryReason);
}

function isMadnessSource(value: unknown): value is "mutant" | "cerenovus" {
  return value === "mutant" || value === "cerenovus";
}

function isMadnessAssignment(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, [
      "assignmentId",
      "sourcePlayerId",
      "sourceCharacterId",
      "targetPlayerId",
      "requiredCharacterId",
      "status",
      "sourceEffective",
      "canCheck",
      "canExecute",
      "violationCheckEventId",
    ])
    && typeof value.assignmentId === "string"
    && typeof value.sourcePlayerId === "string"
    && isMadnessSource(value.sourceCharacterId)
    && typeof value.targetPlayerId === "string"
    && (value.requiredCharacterId === undefined || isKnownCharacter(value.requiredCharacterId))
    && ["unchecked", "clear", "violated"].includes(String(value.status))
    && typeof value.sourceEffective === "boolean"
    && typeof value.canCheck === "boolean"
    && typeof value.canExecute === "boolean"
    && isOptionalString(value.violationCheckEventId);
}

function isPendingMadnessExecution(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["eventId", "assignmentId", "sourceCharacterId", "targetPlayerId", "interruptedStepId"])
    && typeof value.eventId === "string"
    && typeof value.assignmentId === "string"
    && isMadnessSource(value.sourceCharacterId)
    && typeof value.targetPlayerId === "string"
    && typeof value.interruptedStepId === "string";
}

function isPendingVigormortisPoisonChoice(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, [
      "sourceEventId",
      "vigormortisPlayerId",
      "minionPlayerId",
      "previousTargetPlayerId",
      "allowedPlayerIds",
      "reason",
    ])
    && typeof value.sourceEventId === "string"
    && typeof value.vigormortisPlayerId === "string"
    && typeof value.minionPlayerId === "string"
    && isOptionalString(value.previousTargetPlayerId)
    && Array.isArray(value.allowedPlayerIds)
    && value.allowedPlayerIds.every(isString)
    && ["noCurrentTarget", "targetNotTownsfolk", "targetNotNearestTownsfolk"].includes(String(value.reason));
}

function isPendingDeathConsequence(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, [
      "stepId", "kind", "sourceEventId", "deathSequence", "actorPlayerId",
      "sourceAbilityInstanceId", "actorImpairedAtTrigger", "allowedPlayerIds",
      "eligibleChooserPlayerIds",
    ])
    && typeof value.stepId === "string"
    && ["sweetheart", "barber", "klutz"].includes(String(value.kind))
    && typeof value.sourceEventId === "string"
    && Number.isInteger(value.deathSequence)
    && (value.deathSequence as number) > 0
    && typeof value.actorPlayerId === "string"
    && typeof value.sourceAbilityInstanceId === "string"
    && typeof value.actorImpairedAtTrigger === "boolean"
    && Array.isArray(value.allowedPlayerIds)
    && value.allowedPlayerIds.every(isString)
    && Array.isArray(value.eligibleChooserPlayerIds)
    && value.eligibleChooserPlayerIds.every(isString);
}

function isGameEndCause(value: unknown): boolean {
  return ["demonAbsent", "twoLivingPlayers", "klutzChoice", "evilTwinExecution", "vortoxNoExecution"]
    .includes(String(value));
}

function isPendingGameEnd(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["sourceEventId", "winningTeam", "cause", "reasonKo"])
    && typeof value.sourceEventId === "string"
    && (value.winningTeam === "good" || value.winningTeam === "evil")
    && isGameEndCause(value.cause)
    && typeof value.reasonKo === "string";
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
    (value.madnessAssignments !== undefined &&
      (!Array.isArray(value.madnessAssignments) || !value.madnessAssignments.every(isMadnessAssignment))) ||
    (value.pendingMadnessExecution !== undefined && !isPendingMadnessExecution(value.pendingMadnessExecution)) ||
    (value.pendingVigormortisPoisonChoices !== undefined &&
      (!Array.isArray(value.pendingVigormortisPoisonChoices) ||
        !value.pendingVigormortisPoisonChoices.every(isPendingVigormortisPoisonChoice))) ||
    (value.pendingDeathConsequences !== undefined &&
      (!Array.isArray(value.pendingDeathConsequences) ||
        !value.pendingDeathConsequences.every(isPendingDeathConsequence))) ||
    (value.pendingGameEnd !== undefined &&
      !isPendingGameEnd(value.pendingGameEnd)) ||
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
    (value.abilityUse === undefined || isAbilityUseRef(value.abilityUse)) &&
    isRequiredInput(value.requiredInput) &&
    typeof value.canSkip === "boolean" &&
    (value.support === undefined || value.support === "automated" || value.support === "manual") &&
    (value.preActionReveal === undefined || isPreActionReveal(value.preActionReveal)) &&
    (value.informationPrompt === undefined ||
      isInformationPrompt(value.informationPrompt, value.requiredInput.kind))
  );
}

function isAbilityUseRef(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["ownerPlayerId", "characterId", "abilityInstanceId"]) &&
    typeof value.ownerPlayerId === "string" &&
    typeof value.characterId === "string" &&
    typeof value.abilityInstanceId === "string";
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
    (value.numberConstraint !== undefined && !isNumberConstraint(value.numberConstraint)) ||
    (value.booleanChoices !== undefined &&
      (!Array.isArray(value.booleanChoices) || !value.booleanChoices.every(isBooleanChoice))) ||
    !Array.isArray(value.setupInfoRegistrationOptions) ||
    !value.setupInfoRegistrationOptions.every(isSetupInfoRegistrationOption) ||
    (value.mathematicianAudit !== undefined && !isMathematicianAudit(value.mathematicianAudit)) ||
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

  const vortoxActive = value.activeReasons.some(
    (reason) => isRecord(reason) && reason.type === "vortox",
  );
  if (value.targetChecks && value.targetChecks.length > 0) {
    return (value.computedResult === undefined || isInformationResult(value.computedResult))
      && value.numberChoices.length === 0
      && value.numberConstraint === undefined
      && (value.booleanChoices?.length ?? 0) === 0
      && (!vortoxActive || value.targetChecks.every((check) =>
        isRecord(check)
        && Array.isArray(check.choices)
        && check.choices.every((choice: unknown) => isRecord(choice) && choice.isComputed === false)
      ));
  }
  if (value.computedResult === undefined) {
    return inputKind === "setupInfo" && value.numberChoices.length === 0 && value.numberConstraint === undefined && (value.booleanChoices?.length ?? 0) === 0;
  }
  if (!isInformationResult(value.computedResult)) return false;
  if (value.computedResult.kind === "boolean") {
    const computedValue = value.computedResult.value;
    const choices = value.booleanChoices ?? [];
    const computedChoices = choices.filter((choice) => choice.isComputed);
    const computedChoiceIsValid = vortoxActive
      ? computedChoices.length === 0 && choices.every((choice) => choice.value !== computedValue)
      : computedChoices.length === 1 && computedChoices[0]?.value === computedValue;
    return value.numberChoices.length === 0 && value.numberConstraint === undefined && computedChoiceIsValid &&
      new Set(choices.map((choice) => choice.value)).size === choices.length;
  }
  if (value.computedResult.kind !== "number") {
    return value.numberChoices.length === 0 && value.numberConstraint === undefined && (value.booleanChoices?.length ?? 0) === 0;
  }

  const computedChoices = value.numberChoices.filter((choice) => choice.isComputed);
  const uniqueValues = new Set(value.numberChoices.map((choice) => choice.value));
  const computedValue = value.computedResult.value;
  if (value.numberConstraint !== undefined) {
    return (impaired || vortoxActive)
      && value.deliveryMode === "selectable"
      && value.numberChoices.length === 0
      && (value.booleanChoices?.length ?? 0) === 0
      && value.numberConstraint.min === 0
      && value.numberConstraint.max === Number.MAX_SAFE_INTEGER
      && (vortoxActive
        ? value.numberConstraint.excludedValues.length === 1
          && value.numberConstraint.excludedValues[0] === computedValue
        : value.numberConstraint.excludedValues.length === 0);
  }
  return (
    (vortoxActive
      ? computedChoices.length === 0 && value.numberChoices.every((choice) => choice.value !== computedValue)
      : computedChoices.length === 1 && computedChoices[0]?.value === computedValue) &&
    uniqueValues.size === value.numberChoices.length &&
    (value.booleanChoices?.length ?? 0) === 0
  );
}

function isMathematicianAudit(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["records"])
    && Array.isArray(value.records)
    && value.records.every((record) => isRecord(record)
      && hasExactKeys(record, ["subjectPlayerId", "characterId", "abilityInstanceId", "evidence"])
      && typeof record.subjectPlayerId === "string"
      && typeof record.characterId === "string"
      && typeof record.abilityInstanceId === "string"
      && Array.isArray(record.evidence)
      && record.evidence.every(isMathematicianAuditEvidence));
}

function isMathematicianAuditEvidence(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["resolutionEventId", "stepId", "phase", "characterId", "abilityInstanceId", "outcome", "causes"])
    && typeof value.resolutionEventId === "string"
    && typeof value.stepId === "string"
    && isPhase(value.phase)
    && typeof value.characterId === "string"
    && typeof value.abilityInstanceId === "string"
    && isMathematicianAuditOutcome(value.outcome)
    && Array.isArray(value.causes)
    && value.causes.every(isDeliveryReason);
}

function isMathematicianAuditOutcome(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "incorrectInformation") {
    return hasExactKeys(value, ["kind", "computedResult", "deliveredResult"])
      && isInformationResult(value.computedResult)
      && isInformationResult(value.deliveredResult);
  }
  if (value.kind === "invalidSavantPattern") {
    return hasExactKeys(value, ["kind", "truthfulCount"])
      && Number.isInteger(value.truthfulCount);
  }
  return value.kind === "effectFailure"
    && hasExactKeys(value, ["kind", "effect"])
    && [
      "snakeCharmerSwap", "witchDeath", "sweetheartDrunkenness", "demonDeath",
      "pitHagCharacterChange", "noDashiiPoison", "vigormortisOngoingEffect",
      "vortoxFalseInformation", "vortoxExecution",
    ].includes(String(value.effect));
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
        Number.isSafeInteger(value.value) &&
        value.value >= 0 &&
        value.value <= Number.MAX_SAFE_INTEGER
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

function isNumberConstraint(value: unknown): value is NonNullable<InformationPrompt["numberConstraint"]> {
  if (!isRecord(value) || !hasExactKeys(value, ["min", "max", "excludedValues"])) return false;
  const { min, max, excludedValues } = value;
  return (
    typeof min === "number" && Number.isSafeInteger(min) && min >= 0 &&
    typeof max === "number" && Number.isSafeInteger(max) && max >= min &&
    Array.isArray(excludedValues) &&
    excludedValues.every((candidate) =>
      typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= min && candidate <= max
    ) &&
    new Set(excludedValues).size === excludedValues.length
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
    ["waiting", "current", "complete", "skipped", "needsFollowUp", "interrupted", "manualComplete", "notApplicable"].includes(
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
    (value.dependentPlayerSelections === undefined ||
      (Array.isArray(value.dependentPlayerSelections) && value.dependentPlayerSelections.every((selection) =>
        isRecord(selection) &&
        hasExactKeys(selection, ["triggerPlayerId", "selectionIndex", "allowedPlayerIds"]) &&
        typeof selection.triggerPlayerId === "string" &&
        typeof selection.selectionIndex === "number" &&
        Array.isArray(selection.allowedPlayerIds) && selection.allowedPlayerIds.every(isString)
      ))) &&
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
      "unannouncedNightResurrectionPlayerIds",
      "slayerAbility",
      "virginAbility",
      "butlerVote",
      "activeImpairments",
      "abilityGrants",
      "automaticReminders",
      "activeWitchCurse",
      "evilTwinRelationships",
    ]) &&
    isOptionalString(value.redHerringPlayerId) &&
    (value.activePoison === undefined || isActiveRuleEffect(value.activePoison)) &&
    (value.activeProtection === undefined || isActiveRuleEffect(value.activeProtection)) &&
    Array.isArray(value.unannouncedNightDeathPlayerIds) &&
    value.unannouncedNightDeathPlayerIds.every(isString) &&
    (value.unannouncedNightResurrectionPlayerIds === undefined ||
      (Array.isArray(value.unannouncedNightResurrectionPlayerIds) && value.unannouncedNightResurrectionPlayerIds.every(isString))) &&
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
    (value.abilityGrants === undefined ||
      (Array.isArray(value.abilityGrants) && value.abilityGrants.every(isAbilityGrant))) &&
    (value.automaticReminders === undefined ||
      (Array.isArray(value.automaticReminders) && value.automaticReminders.every(isAutomaticReminder))) &&
    (value.activeWitchCurse === undefined || isActiveWitchCurse(value.activeWitchCurse)) &&
    (value.evilTwinRelationships === undefined ||
      (Array.isArray(value.evilTwinRelationships) && value.evilTwinRelationships.every(isEvilTwinRelationship)))
  );
}

function isAbilityGrant(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["ownerPlayerId", "characterId", "sourceEventId", "sourceAbilityInstanceId", "abilityInstanceId"]) &&
    typeof value.ownerPlayerId === "string" &&
    typeof value.characterId === "string" &&
    typeof value.sourceEventId === "string" &&
    typeof value.sourceAbilityInstanceId === "string" &&
    typeof value.abilityInstanceId === "string";
}

function isActiveWitchCurse(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "sourcePlayerId", "sourceAbilityInstanceId", "targetPlayerId", "appliesToDay", "effective"]) &&
    [value.sourceEventId, value.sourcePlayerId, value.sourceAbilityInstanceId, value.targetPlayerId, value.appliesToDay].every(isString) &&
    typeof value.effective === "boolean";
}

function isEvilTwinRelationship(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "abilityOwnerPlayerId", "twinPlayerId", "sourceAbilityInstanceId"]) &&
    [value.sourceEventId, value.abilityOwnerPlayerId, value.twinPlayerId, value.sourceAbilityInstanceId].every(isString);
}

function isAutomaticReminder(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["playerId", "characterId", "tokenId", "label", "description"]) &&
    typeof value.playerId === "string" &&
    ["flowergirl", "townCrier", "mathematician", "philosopher", "vigormortis", "fangGu", "witch", "evilTwin", "seamstress"].includes(String(value.characterId)) &&
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
    if (outcome.kind === "fangGuJump") {
      if (!hasExactKeys(outcome, ["kind", "death", "sourceAbilityInstanceId", "identityTransition"]) ||
          typeof outcome.sourceAbilityInstanceId !== "string" ||
          !isRecord(outcome.death) || !isRecord(outcome.death.cause) ||
          !isRecord(outcome.identityTransition) || !isRecord(outcome.identityTransition.after) ||
          !isNightDeath(outcome.death) || !isPlayerIdentityTransition(outcome.identityTransition)) return false;
      const death = outcome.death;
      const transition = outcome.identityTransition;
      const cause = death.cause as Record<string, unknown>;
      const after = transition.after as Record<string, unknown>;
      return cause.kind === "demonAttack" &&
        death.playerId === cause.actorPlayerId &&
        cause.actorCharacterId === "fangGu" &&
        cause.targetPlayerId === value.targetPlayerId &&
        transition.playerId === value.targetPlayerId &&
        after.actualCharacter === "fangGu" &&
        after.shownCharacter === "fangGu" &&
        after.alignment === "evil";
    }
    return outcome.kind === "deaths" && hasOnlyKeys(outcome, ["kind", "deaths", "vigormortisEffect"]) &&
      Array.isArray(outcome.deaths) && outcome.deaths.length > 0 && outcome.deaths.every((death) => (
        isRecord(death) && hasExactKeys(death, ["playerId", "cause"]) &&
        typeof death.playerId === "string" && isRecord(death.cause) &&
        hasExactKeys(death.cause, ["kind", "actorPlayerId", "actorCharacterId", "targetPlayerId"]) &&
        death.cause.kind === "demonAttack" && typeof death.cause.actorPlayerId === "string" &&
        typeof death.cause.actorCharacterId === "string" && typeof death.cause.targetPlayerId === "string"
      )) && (outcome.vigormortisEffect === undefined || (
        isRecord(outcome.vigormortisEffect) &&
        hasOnlyKeys(outcome.vigormortisEffect, ["minionPlayerId", "sourceAbilityInstanceId", "poisonTargetPlayerId"]) &&
        typeof outcome.vigormortisEffect.minionPlayerId === "string" &&
        typeof outcome.vigormortisEffect.sourceAbilityInstanceId === "string" &&
        (outcome.vigormortisEffect.poisonTargetPlayerId === undefined || typeof outcome.vigormortisEffect.poisonTargetPlayerId === "string")
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

function isWitchNominationResolution(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "notApplicable") return hasExactKeys(value, ["kind"]);
  return value.kind === "deathPending" &&
    hasExactKeys(value, ["kind", "curseEventId", "witchPlayerId", "sourceAbilityInstanceId"]) &&
    typeof value.curseEventId === "string" && typeof value.witchPlayerId === "string" &&
    typeof value.sourceAbilityInstanceId === "string";
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
    (value.abilityInstance === undefined ||
      (isRecord(value.abilityInstance) &&
        hasExactKeys(value.abilityInstance, ["id", "characterId", "sourceEventId"]) &&
        typeof value.abilityInstance.id === "string" &&
        typeof value.abilityInstance.characterId === "string" &&
        typeof value.abilityInstance.sourceEventId === "string")) &&
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

function isPlayerTransitionedPayload(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["stepId", "sourcePlayerId", "sourceCharacterId", "transitions"]) &&
    typeof value.stepId === "string" &&
    typeof value.sourcePlayerId === "string" &&
    typeof value.sourceCharacterId === "string" &&
    Array.isArray(value.transitions) && value.transitions.length > 0 &&
    value.transitions.every((transition) =>
      isRecord(transition) &&
      hasExactKeys(transition, ["kind", "playerId", "before", "after"]) &&
      (transition.kind === "characterChange" || transition.kind === "resurrection") &&
      typeof transition.playerId === "string" &&
      isPlayerStateSnapshot(transition.before) && isPlayerStateSnapshot(transition.after)
    );
}

function isPlayerStateSnapshot(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["actualCharacter", "shownCharacter", "alignment", "alive"]) &&
    typeof value.actualCharacter === "string" && typeof value.shownCharacter === "string" &&
    (value.alignment === "good" || value.alignment === "evil") && typeof value.alive === "boolean";
}

function isActiveImpairment(value: unknown): value is ActiveImpairment {
  return isRecord(value) &&
    hasExactKeys(value, ["kind", "playerId", "sourceEventId", "sourceCharacterId", "expires"]) &&
    (value.kind === "poisoned" || value.kind === "drunk") &&
    typeof value.playerId === "string" &&
    typeof value.sourceEventId === "string" &&
    typeof value.sourceCharacterId === "string" &&
    (value.expires === "never" || value.expires === "whileSourceAbilityActive");
}

function isPhilosopherAbilityResolvedPayload(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["stepId", "actor", "selectedCharacterId", "outcome"]) ||
      typeof value.stepId !== "string" || !isAbilityUseRef(value.actor) ||
      (value.selectedCharacterId !== undefined && typeof value.selectedCharacterId !== "string") ||
      !isRecord(value.outcome)) {
    return false;
  }
  const outcome = value.outcome;
  if (outcome.kind === "deferred") {
    return hasExactKeys(outcome, ["kind"]) && value.selectedCharacterId === undefined;
  }
  if (outcome.kind === "acquired") {
    return hasExactKeys(outcome, ["kind", "grantedAbilityInstanceId"]) &&
      typeof outcome.grantedAbilityInstanceId === "string" &&
      typeof value.selectedCharacterId === "string";
  }
  if (outcome.kind === "selfDrunk") {
    return hasExactKeys(outcome, ["kind"]) && typeof value.selectedCharacterId === "string";
  }
  return outcome.kind === "noEffect" &&
    hasExactKeys(outcome, ["kind", "impairments"]) &&
    typeof value.selectedCharacterId === "string" &&
    Array.isArray(outcome.impairments) &&
    outcome.impairments.every(isActiveImpairment);
}

function isDeathTriggerRef(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["sourceEventId", "deathSequence", "playerId", "sourceAbilityInstanceId"])
    && typeof value.sourceEventId === "string"
    && Number.isInteger(value.deathSequence)
    && (value.deathSequence as number) > 0
    && typeof value.playerId === "string"
    && typeof value.sourceAbilityInstanceId === "string";
}

function isDeathConsequenceNoEffect(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["kind", "reason"])
    && value.kind === "noEffect"
    && ["actorImpairedAtDeath", "noLivingDemon"].includes(String(value.reason));
}

function isSweetheartConsequencePayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["stepId", "trigger", "targetPlayerId", "outcome"])
    || typeof value.stepId !== "string"
    || !isDeathTriggerRef(value.trigger)
    || (value.targetPlayerId !== undefined && typeof value.targetPlayerId !== "string")
    || !isRecord(value.outcome)) return false;
  if (isDeathConsequenceNoEffect(value.outcome)) {
    return value.targetPlayerId === undefined
      && value.outcome.reason === "actorImpairedAtDeath";
  }
  return typeof value.targetPlayerId === "string"
    && (hasExactKeys(value.outcome, ["kind", "impairment"])
      && value.outcome.kind === "drunkApplied"
      && isActiveImpairment(value.outcome.impairment)
      && value.outcome.impairment.kind === "drunk"
      && value.outcome.impairment.playerId === value.targetPlayerId
      && value.outcome.impairment.sourceCharacterId === "sweetheart"
      && value.outcome.impairment.expires === "never");
}

function isBarberDecision(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "decline") return hasExactKeys(value, ["kind"]);
  return value.kind === "swap"
    && hasExactKeys(value, ["kind", "playerIds"])
    && Array.isArray(value.playerIds)
    && value.playerIds.length === 2
    && value.playerIds.every(isString)
    && value.playerIds[0] !== value.playerIds[1];
}

function isBarberConsequencePayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["stepId", "trigger", "chooserDemonPlayerId", "decision", "outcome"])
    || typeof value.stepId !== "string"
    || !isDeathTriggerRef(value.trigger)
    || (value.chooserDemonPlayerId !== undefined && typeof value.chooserDemonPlayerId !== "string")
    || !isRecord(value.outcome)) return false;
  if (isDeathConsequenceNoEffect(value.outcome)) {
    return value.chooserDemonPlayerId === undefined && value.decision === undefined;
  }
  return typeof value.chooserDemonPlayerId === "string"
    && isBarberDecision(value.decision)
    && ((value.outcome.kind === "declined" && hasExactKeys(value.outcome, ["kind"]))
    || (value.outcome.kind === "noChangeSameCharacter" && hasExactKeys(value.outcome, ["kind"]))
    || (value.outcome.kind === "swapped"
      && hasExactKeys(value.outcome, ["kind", "identityTransitions"])
      && Array.isArray(value.outcome.identityTransitions)
      && value.outcome.identityTransitions.length === 2
      && value.outcome.identityTransitions.every(isPlayerIdentityTransition)));
}

function isKlutzConsequencePayload(value: unknown): boolean {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "stepId", "trigger", "targetPlayerId", "actorAlignment", "targetAlignment", "outcome",
    ])
    || typeof value.stepId !== "string"
    || !isDeathTriggerRef(value.trigger)
    || !isRecord(value.outcome)) return false;
  if (value.outcome.kind === "actorImpaired") {
    return value.targetPlayerId === undefined
      && value.actorAlignment === undefined
      && value.targetAlignment === undefined
      && hasExactKeys(value.outcome, ["kind"]);
  }
  if (typeof value.targetPlayerId !== "string"
    || !["good", "evil"].includes(String(value.actorAlignment))
    || !["good", "evil"].includes(String(value.targetAlignment))) return false;
  if (value.outcome.kind === "safe") {
    return hasExactKeys(value.outcome, ["kind"]);
  }
  return value.outcome.kind === "teamLost"
    && hasExactKeys(value.outcome, ["kind", "losingTeam", "winningTeam"])
    && ["good", "evil"].includes(String(value.outcome.losingTeam))
    && ["good", "evil"].includes(String(value.outcome.winningTeam));
}

function isPendingIdentityReveal(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "sequence", "payload"]) &&
    typeof value.sourceEventId === "string" &&
    Number.isInteger(value.sequence) &&
    (value.sequence as number) > 0 &&
    (isCharacterChangeRevealPayload(value.payload) || isMadnessAssignmentRevealPayload(value.payload) || isEvilTwinPairRevealPayload(value.payload));
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
    hasOnlyKeys(value, ["eventId", "winningTeam", "sourceEventId", "cause", "reasonKo"]) &&
    typeof value.eventId === "string" &&
    (value.winningTeam === "good" || value.winningTeam === "evil") &&
    (value.sourceEventId === undefined || typeof value.sourceEventId === "string") &&
    (value.cause === undefined || isGameEndCause(value.cause)) &&
    (value.reasonKo === undefined || typeof value.reasonKo === "string") &&
    ((value.sourceEventId === undefined && value.cause === undefined && value.reasonKo === undefined)
      || (typeof value.sourceEventId === "string" && isGameEndCause(value.cause) && typeof value.reasonKo === "string"));
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
