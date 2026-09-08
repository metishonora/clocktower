import { isActionCause, isGuidanceCause, isCustomGameEnd } from "./customActionResultValidationBase.js";
import type { Phase, PhaseStep, CoreResult, GameEvent, ReplayState, Proposal, SetupDistributionResult, FirstNightOrderPlan, CustomFirstNightPlanResult, SetupDistribution, FirstNightActionRef, PhaseStepInput, AbilityUseRef, AbilityOrigin, InformationPrompt, ConfirmedInformation, InformationResult, DeliveryReason, ActiveImpairment, NumberChoice, RegistrationJudgment } from "./types.js";
import { customScriptCharacters } from "../characterCatalog.js";
import { isCharacterChangeRevealPayload, isEvilTwinPairRevealPayload, isMadnessAssignmentRevealPayload, isRevealPayload } from "./revealPayload.js";
import { isCustomActionResult as validateCustomActionResult } from "./customActionResultValidation.js";


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
const characterIds = new Set(customScriptCharacters.map(({ id }) => id));

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

const troubleBrewingAutomaticReminderPairs = new Set([
  "noDashii:poisoned", "snakeCharmer:poisoned", "philosopher:drunk", "philosopher:noAbility", "seamstress:noAbility", "witch:cursed", "cerenovus:mad", "evilTwin:twin",
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

const sectsAndVioletsAutomaticReminderCharacters = new Set([
  "flowergirl",
  "townCrier",
  "mathematician",
  "philosopher",
  "vigormortis",
  "noDashii",
  "fangGu",
  "witch",
  "evilTwin",
  "seamstress",
  "artist",
  "juggler",
  "barber",
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
  if (
    value.type === "customActionConfirmed" &&
    !hasExactKeys(value, ["id", "type", "phase", "payload", "summary", "createdAt"])
  ) {
    throw invalidEvent();
  }
  switch (value.type) {
    case "setupConfirmed":
      if (
        !hasOnlyKeys(payload, ["players", "setupChoiceId"]) ||
        !Array.isArray(payload.players) ||
        !payload.players.every(isSetupPlayer) ||
        (payload.setupChoiceId !== undefined && !isSetupChoiceId(payload.setupChoiceId))
      ) throw invalidEvent();
      break;
    case "phaseStepConfirmed":
      if (
        !hasOnlyKeys(payload, ["stepId", "actionRef", "abilityUse", "input", "information"]) ||
        typeof payload.stepId !== "string" ||
        !isPhaseStepInput(payload.input) ||
        (payload.actionRef !== undefined && !isFirstNightActionRef(payload.actionRef)) ||
        (payload.abilityUse !== undefined && !isAbilityUseRef(payload.abilityUse)) ||
        (payload.information !== undefined && !isConfirmedInformation(payload.information))
      ) {
        throw invalidEvent();
      }
      break;
    case "customActionConfirmed":
      if (
        !hasOnlyKeys(payload, ["stepId", "actionRef", "abilityUse", "simulationSource", "followUpCause", "actionCause", "deliveredResult", "registrationJudgments", "input", "result"]) ||
        typeof payload.stepId !== "string" || payload.stepId.trim().length === 0 ||
        !isCustomCharacterActionRef(payload.actionRef) || !isOccurrenceSource(payload) ||
        !isRecord(payload.result) || ((payload.simulationSource !== undefined) !== (["simulation", "simulationChoice"].includes(payload.result.kind as string)) && !(payload.simulationSource !== undefined && ["informationPrepared", "preparedInformationDelivered"].includes(payload.result.kind as string))) ||
        !isCustomPhaseStepInput(payload.input) ||
        (payload.deliveredResult !== undefined && !isInformationResult(payload.deliveredResult)) ||
        (payload.registrationJudgments !== undefined && (!Array.isArray(payload.registrationJudgments) || !payload.registrationJudgments.every(isRegistrationJudgment))) ||
        !validateCustomActionResult(payload.result, isKnownCharacter, isSpyGrimoirePlayer)
      ) {
        throw invalidEvent();
      }
      break;
    default: throw invalidEvent();
  }

  return value as GameEvent;
}
export function parseReplayState(value: unknown): ReplayState {
  if (!isRecord(value) || !optionalList(value.madnessAssignments, v => isAssignment(v, true)) || value.schemaVersion !== 4 || !isReplayScriptIdentity(value) || !Number.isInteger(value.eventCount) || !isPhase(value.phase) || !Array.isArray(value.players) || !value.players.every(isPlayer) || !(value.currentStep === null || isPhaseStep(value.currentStep)) || !Array.isArray(value.phaseOverview) || !value.phaseOverview.every(isPhaseOverviewItem) || !isRuleState(value.ruleState) || !Array.isArray(value.warnings) || !value.warnings.every(isWarning) || (value.pendingIdentityReveals !== undefined && !isPendingIdentityRevealList(value.pendingIdentityReveals)) || (value.gameEnd !== undefined && value.gameEnd !== null && !isCustomGameEnd(value.gameEnd)) || !optionalList(value.availableActions, isPhaseStep)) throw invalidCoreResponse();
  return value as ReplayState;
}
function isReplayScriptIdentity(value: Record<string, unknown>): boolean { return value.scriptId === undefined && isCustomReplayScriptReference(value.script); }


function isCustomReplayScriptReference(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["type", "definition"]) ||
    value.type !== "custom" ||
    !isRecord(value.definition) ||
    !hasExactKeys(value.definition, ["id", "name", "characterIds", "firstNightOrder"]) ||
    typeof value.definition.id !== "string" ||
    value.definition.id.trim().length === 0 ||
    typeof value.definition.name !== "string" ||
    value.definition.name.trim().length === 0 ||
    !Array.isArray(value.definition.characterIds) ||
    !value.definition.characterIds.every(
      (characterId) => typeof characterId === "string" && characterId.trim().length > 0,
    ) ||
    new Set(value.definition.characterIds).size !== value.definition.characterIds.length
  ) {
    return false;
  }
  return isFirstNightOrderPlan(value.definition.firstNightOrder);
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
export function parseSetupDistribution(value: unknown): SetupDistributionResult { if (!isSetupDistribution(value)) throw invalidCoreResponse(); return value; }


export function parseFirstNightOrderPlan(value: unknown): FirstNightOrderPlan {
  if (!isFirstNightOrderPlan(value)) throw invalidCoreResponse();
  return value;
}


export function parseCustomFirstNightPlanResult(value: unknown): CustomFirstNightPlanResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["source", "plan"]) ||
    (value.source !== "definition" && value.source !== "default") ||
    !isFirstNightOrderPlan(value.plan)
  ) {
    throw invalidCoreResponse();
  }
  return value as CustomFirstNightPlanResult;
}


function isSetupDistribution(value: unknown): value is SetupDistribution {
  return isRecord(value) &&
    hasExactKeys(value, ["Townsfolk", "Outsider", "Minion", "Demon"]) &&
    [value.Townsfolk, value.Outsider, value.Minion, value.Demon].every(
      (count) => typeof count === "number" && Number.isInteger(count) && count >= 0,
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
    isStepSource(value) &&
    isRequiredInput(value.requiredInput) &&
    typeof value.canSkip === "boolean" &&
    (value.support === undefined || value.support === "automated" || value.support === "manual") &&
    (value.preActionReveal === undefined || isPreActionReveal(value.preActionReveal)) &&
    (value.actionRef === undefined || isFirstNightActionRef(value.actionRef)) &&
    (value.informationPrompt === undefined ||
      isInformationPrompt(value.informationPrompt, value.requiredInput.kind))
  );
}


function isFirstNightOrderPlan(value: unknown): value is FirstNightOrderPlan {
  return Array.isArray(value) && value.every(isFirstNightActionRef);
}


function isFirstNightActionRef(value: unknown): value is FirstNightActionRef {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "system") {
    return hasExactKeys(value, ["kind", "actionId"])
      && ["dusk", "minionInfo", "demonInfo", "dawn"].includes(String(value.actionId));
  }
  return value.kind === "character"
    && hasExactKeys(value, ["kind", "characterId", "actionId"])
    && typeof value.characterId === "string"
    && value.characterId.trim().length > 0
    && typeof value.actionId === "string"
    && value.actionId.trim().length > 0;
}


function isCustomCharacterActionRef(
  value: unknown,
): value is Extract<FirstNightActionRef, { kind: "character" }> {
  return isRecord(value) &&
    hasExactKeys(value, ["kind", "characterId", "actionId"]) &&
    value.kind === "character" &&
    typeof value.characterId === "string" &&
    value.characterId.trim().length > 0 &&
    typeof value.actionId === "string" &&
    value.actionId.trim().length > 0;
}


function isCustomPhaseStepInput(value: unknown): value is PhaseStepInput {
  if (value === null) return true;
  return isRecord(value) &&
    hasOnlyKeys(value, [
      "playerIds",
      "characterIds",
      "characterId",
      "zeroOutsiders",
      "correctPlayerId",
      "value",
      "trueValue",
      "displayedValue",
      "reason",
      "nominatorId",
      "nomineeId",
      "voterIds",
      "execute",
      "died",
      "mayorDecision",
      "successorPlayerId",
    ]) &&
    isPhaseStepInput(value);
}


function isAbilityUseRef(value: unknown): value is AbilityUseRef {
  return isRecord(value) &&
    hasExactKeys(value, ["ownerPlayerId", "characterId", "abilityInstanceId"]) &&
    typeof value.ownerPlayerId === "string" &&
    typeof value.characterId === "string" &&
    typeof value.abilityInstanceId === "string";
}


function isAbilityOrigin(value: unknown): value is AbilityOrigin {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "identityBound") return hasExactKeys(value, ["kind"]);
  return value.kind === "acquired"
    && hasExactKeys(value, ["kind", "acquisitionEventId", "source"])
    && typeof value.acquisitionEventId === "string"
    && isAbilityUseRef(value.source);
}


function isAbilityContext(abilityUse: unknown, origin: unknown): abilityUse is AbilityUseRef {
  if (!isAbilityUseRef(abilityUse) || !isAbilityOrigin(origin)) return false;
  return origin.kind !== "acquired"
    || (isRecord(origin.source) && origin.source.ownerPlayerId === abilityUse.ownerPlayerId);
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
      : computedChoices.length >= 1 && computedChoices.every(choice => choice.value === computedValue);
    return value.numberChoices.length === 0 && value.numberConstraint === undefined && computedChoiceIsValid &&
      new Set(choices.map((choice) => choice.value)).size === choices.length;
  }
  if (value.computedResult.kind !== "number") {
    return value.numberChoices.length === 0 && value.numberConstraint === undefined && (value.booleanChoices?.length ?? 0) === 0;
  }

  const computedChoices = value.numberChoices.filter((choice) => choice.isComputed);
  const uniqueChoices = new Set(value.numberChoices.map(numberChoiceIdentity));
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
      : computedChoices.length >= 1 && computedChoices.every(choice => choice.value === computedValue)) &&
    value.numberChoices.every(choice => choice.isComputed === (choice.value === computedValue)) &&
    uniqueChoices.size === value.numberChoices.length &&
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
    return hasExactKeys(value, ["kind", "deliveredResult"])
      && isInformationResult(value.deliveredResult);
  }
  if (value.kind === "invalidSavantPattern") {
    return hasExactKeys(value, ["kind", "truthfulCount"])
      && Number.isInteger(value.truthfulCount);
  }
  return value.kind === "effectFailure"
    && hasExactKeys(value, ["kind", "effect"])
    && [
      "poisonerPoison", "butlerMaster", "mutantExecution", "philosopherAcquisition", "witchCurse", "cerenovusMadness", "evilTwinRelationship",
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
      hasOnlyKeys(value, [
        "playerId",
        "seat",
        "name",
        "characterId",
        "alive",
        "ghostVoteUsed",
        "reminderTokens",
        "automaticReminders",
        "alignment",
      ]) &&
      typeof value.playerId === "string" &&
      typeof value.seat === "number" &&
      Number.isInteger(value.seat) &&
      typeof value.name === "string" &&
      typeof value.characterId === "string" &&
      characterIds.has(value.characterId) && (value.alignment === undefined || value.alignment === "good" || value.alignment === "evil")
    )
  ) {
    return false;
  }
  const hasSnapshotFields =
    typeof value.alive === "boolean" &&
    typeof value.ghostVoteUsed === "boolean" &&
    Array.isArray(value.reminderTokens) &&
    value.reminderTokens.every((token) => token === "poisoned" || token === "protected") &&
    (value.automaticReminders === undefined || (
      Array.isArray(value.automaticReminders) &&
      value.automaticReminders.every((reminder) => isTroubleBrewingSpyReminder(reminder, value.playerId as string))
    ));
  const isLegacy =
    value.alive === undefined &&
    value.ghostVoteUsed === undefined &&
    value.reminderTokens === undefined &&
    value.automaticReminders === undefined;
  return hasSnapshotFields || isLegacy;
}


function isTroubleBrewingSpyReminder(value: unknown, playerId: string): boolean {
  return isAutomaticReminder(value) &&
    isRecord(value) &&
    value.playerId === playerId &&
    troubleBrewingAutomaticReminderPairs.has(`${value.characterId}:${value.tokenId}`);
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
    isRecord(value) && hasOnlyKeys(value,["playerId","registeredAs","characterId","scope"]) &&
    typeof value.playerId === "string" &&
    ["good", "evil", "townsfolk", "outsider", "minion", "demon"].includes(
      String(value.registeredAs),
    ) &&
    isOptionalKnownCharacter(value.characterId) && (value.scope === undefined || (isRecord(value.scope) && hasExactKeys(value.scope, ["kind", "playerIds"]) && value.scope.kind === "adjacentPair" && Array.isArray(value.scope.playerIds) && value.scope.playerIds.length === 2 && value.scope.playerIds.every(nonempty) && new Set(value.scope.playerIds).size === 2))
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
function isTargetAssignment(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value,["sourceEventId","abilityUse","targetPlayerId","day","initiallyEffective","effective"]) && isUseFact(value) && nonempty(value.targetPlayerId) && Number.isInteger(value.day) && Number(value.day)>0 && typeof value.initiallyEffective === "boolean" && typeof value.effective === "boolean";
}
function isPreparationRecord(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value,["sourceEventId","actionRef","abilityUse","simulationSource","result","registrationJudgments"]) && nonempty(value.sourceEventId) && isFirstNightActionRef(value.actionRef) && ((value.abilityUse !== undefined && isAbilityUseRef(value.abilityUse) && value.simulationSource === undefined) || (value.abilityUse === undefined && isSimulationSource(value.simulationSource))) && validateCustomActionResult(value.result,isKnownCharacter,isSpyGrimoirePlayer) && Array.isArray(value.registrationJudgments) && value.registrationJudgments.every(isRegistrationJudgment);
}
function isRuleState(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["unannouncedNightDeathPlayerIds", "activeImpairments", "abilityGrants", "abilityUses", "philosopherChoices", "witchCurses", "twinRelationships", "preparations", "poisonerChoices", "masterChoices", "guidance"]) &&
    Array.isArray(value.unannouncedNightDeathPlayerIds) && value.unannouncedNightDeathPlayerIds.every(isString) &&
    optionalList(value.activeImpairments, isActiveImpairment) && optionalList(value.abilityGrants, isAbilityGrant) &&
    optionalList(value.abilityUses, v => isRecord(v) && hasExactKeys(v, ["sourceEventId", "abilityUse"]) && isUseFact(v)) &&
    optionalList(value.philosopherChoices, v => isRecord(v) && hasExactKeys(v, ["sourceEventId", "abilityUse", "characterId", "outcome"]) && isUseFact(v) && isKnownCharacter(v.characterId) && ["acquired", "selfDrunk", "failed"].includes(v.outcome as string)) &&
    optionalList(value.witchCurses, v => isAssignment(v, false)) &&
    optionalList(value.preparations, isPreparationRecord) && optionalList(value.poisonerChoices, isTargetAssignment) && optionalList(value.masterChoices, isTargetAssignment) &&
    optionalList(value.guidance, v => isRecord(v) && hasExactKeys(v,["source","characterId","spent"]) && isSimulationSource(v.source) && isKnownCharacter(v.characterId) && typeof v.spent === "boolean") &&
    optionalList(value.twinRelationships, v => isRecord(v) && hasExactKeys(v, ["sourceEventId", "abilityUse", "targetPlayerId", "effective"]) && isUseFact(v) && nonempty(v.targetPlayerId) && typeof v.effective === "boolean");
}
function optionalList(value: unknown, predicate: (v: unknown) => boolean): boolean { return value === undefined || (Array.isArray(value) && value.every(predicate)); }
function isUseFact(v: Record<string, unknown>): boolean { return nonempty(v.sourceEventId) && isAbilityUseRef(v.abilityUse) && nonempty(v.abilityUse.ownerPlayerId) && nonempty(v.abilityUse.abilityInstanceId); }
function isAssignment(v: unknown, madness: boolean): boolean {
  const keys = ["sourceEventId", "abilityUse", "targetPlayerId", "day", "initiallyEffective", "effective"];
  if (madness) keys.push("characterId");
  return isRecord(v) && hasExactKeys(v, keys) && isUseFact(v) && nonempty(v.targetPlayerId) &&
    Number.isInteger(v.day) && (v.day as number) >= 1 && (v.day as number) <= 65535 &&
    typeof v.initiallyEffective === "boolean" && typeof v.effective === "boolean" && (!madness || isKnownCharacter(v.characterId));
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


function isAutomaticReminder(value: unknown): boolean {
  return isRecord(value) &&
    hasOnlyKeys(value, ["playerId", "characterId", "tokenId", "label", "description", "count", "sourceEventId", "inactiveReason"]) &&
    typeof value.playerId === "string" &&
    typeof value.tokenId === "string" &&
    (sectsAndVioletsAutomaticReminderCharacters.has(String(value.characterId)) ||
      troubleBrewingAutomaticReminderPairs.has(`${value.characterId}:${value.tokenId}`)) &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    (value.count === undefined || (Number.isInteger(value.count) && Number(value.count) >= 0)) &&
    (value.sourceEventId === undefined || typeof value.sourceEventId === "string") &&
    (value.inactiveReason === undefined ||
      (typeof value.inactiveReason === "string" && typeof value.sourceEventId === "string"));
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


function isActiveImpairment(value: unknown): value is ActiveImpairment {
  return isRecord(value) &&
    hasExactKeys(value, ["kind", "playerId", "sourceEventId", "sourceCharacterId", "expires"]) &&
    (value.kind === "poisoned" || value.kind === "drunk") &&
    typeof value.playerId === "string" &&
    typeof value.sourceEventId === "string" &&
    typeof value.sourceCharacterId === "string" &&
    (value.expires === "never" || value.expires === "whileSourceAbilityActive");
}


function isPendingIdentityReveal(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["sourceEventId", "sequence", "payload"]) &&
    typeof value.sourceEventId === "string" &&
    Number.isInteger(value.sequence) &&
    (value.sequence as number) >= 0 &&
    (isCharacterChangeRevealPayload(value.payload) || isMadnessAssignmentRevealPayload(value.payload) || isEvilTwinPairRevealPayload(value.payload));
}


function isPendingIdentityRevealList(value: unknown): boolean {
  if (!Array.isArray(value) || !value.every(isPendingIdentityReveal)) return false;
  const seen = new Set<string>();
  let sourceEventId: string | undefined;
  let nextSequence = 0;
  return value.every(reveal => {
    if (reveal.sourceEventId !== sourceEventId) {
      if (seen.has(reveal.sourceEventId)) return false;
      sourceEventId = reveal.sourceEventId;
      seen.add(reveal.sourceEventId);
      nextSequence = 0;
    }
    return reveal.sequence === nextSequence++;
  });
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


function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && phases.has(value as Phase);
}


function isSetupChoiceId(value: unknown): value is "addOutsider" | "removeOutsider" {
  return value === "addOutsider" || value === "removeOutsider";
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


function invalidEvent(): Error {
  return new Error("이벤트 형식이 올바르지 않습니다.");
}


function invalidCoreResponse(): Error {
  return new Error("코어 응답 형식이 올바르지 않습니다.");
}
const eventDiscriminatorSet = new Set(["setupConfirmed", "phaseStepConfirmed", "customActionConfirmed"]);


export function numberChoiceIdentity(choice: NumberChoice): string {
  return JSON.stringify([
    choice.value,
    choice.isComputed,
    normalizedRegistrationJudgments(choice.registrationJudgments),
  ]);
}


function normalizedRegistrationJudgments(judgments: RegistrationJudgment[]): string[][] {
  return judgments
    .map((judgment) => [
      judgment.playerId,
      judgment.registeredAs,
      judgment.characterId ?? "",
      JSON.stringify(judgment.scope ?? null),
    ])
    .sort(([leftPlayerId, leftValue, leftCharacterId], [rightPlayerId, rightValue, rightCharacterId]) =>
      leftPlayerId.localeCompare(rightPlayerId)
      || leftValue.localeCompare(rightValue)
      || leftCharacterId.localeCompare(rightCharacterId),
    );
}

function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isSimulationSource(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["selectionEventId", "sourceAbilityUse", "guidance"]) && (value.guidance === undefined || isGuidanceCause(value.guidance)) &&
    nonempty(value.selectionEventId) && isAbilityUseRef(value.sourceAbilityUse) &&
    (value.guidance === undefined ? value.sourceAbilityUse.characterId === "philosopher" : isRecord(value.guidance) && (value.guidance.kind === "choice" ? ["philosopher", "drunk"].includes(value.sourceAbilityUse.characterId) : value.sourceAbilityUse.characterId === "drunk")) && nonempty(value.sourceAbilityUse.ownerPlayerId) &&
    nonempty(value.sourceAbilityUse.abilityInstanceId);
}
function isOccurrenceSource(value: Record<string, unknown>): boolean {
  if (!isCustomCharacterActionRef(value.actionRef)) return false;
  const actual = isAbilityUseRef(value.abilityUse) && nonempty(value.abilityUse.ownerPlayerId) &&
    nonempty(value.abilityUse.abilityInstanceId) && value.abilityUse.characterId === value.actionRef.characterId;
  const simulation = isSimulationSource(value.simulationSource);
  if (!(actual && value.simulationSource === undefined) && !(simulation && value.abilityUse === undefined)) return false;
  if (value.actionCause !== undefined && (!isActionCause(value.actionCause) || value.followUpCause !== undefined)) return false;
  if (value.followUpCause !== undefined) {
    const cause = value.followUpCause;
    if (!actual || value.actionRef.characterId !== "evilTwin" || !isRecord(cause) ||
      !hasExactKeys(cause, ["triggerEventId", "relationshipEventId"]) ||
      !nonempty(cause.triggerEventId) || !nonempty(cause.relationshipEventId)) return false;
  }
  return true;
}
function isStepSource(value: Record<string, unknown>): boolean {
  if (isCustomCharacterActionRef(value.actionRef)) {
    if (!isOccurrenceSource(value)) return false;
    if (isAbilityUseRef(value.abilityUse)) return isAbilityContext(value.abilityUse, value.abilityOrigin) &&
      value.abilityUse.ownerPlayerId === value.playerId && value.abilityUse.characterId === value.character;
    return isRecord(value.simulationSource) && isAbilityUseRef(value.simulationSource.sourceAbilityUse) &&
      value.simulationSource.sourceAbilityUse.ownerPlayerId === value.playerId && value.abilityOrigin === undefined &&
      value.character === value.actionRef.characterId;
  }
  return value.abilityUse === undefined && value.abilityOrigin === undefined && value.simulationSource === undefined && value.followUpCause === undefined && value.actionCause === undefined;
}
