import type {
  ConfirmedInformation,
  CoreResult,
  DeliveryReason,
  GameEvent,
  InformationPrompt,
  InformationResult,
  Phase,
  PhaseStep,
  PhaseStepInput,
  Proposal,
  ReplayState,
  SetupDistribution,
} from "./types.js";
import { isRevealPayload } from "./revealPayload.js";
import { characters } from "../setupDraft.js";

const phases = new Set<Phase>(["setup", "firstNight", "day", "night"]);
const stepTypes = new Set<PhaseStep["stepType"]>([
  "evilInfo",
  "character",
  "phaseTransition",
  "announcement",
  "nomination",
  "execution",
]);
const inputKinds = new Set([
  "none",
  "playerIds",
  "characterIds",
  "setupInfo",
  "number",
  "nominationVote",
  "executionDecision",
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
const characterIds = new Set(characters.map((character) => character.id));

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
    case "nominationVoteConfirmed":
      if (typeof payload.stepId !== "string" || !isNominationRecord(payload.input)) throw invalidEvent();
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
      if (typeof payload.playerId !== "string") throw invalidEvent();
      break;
    default:
      throw new Error("지원하지 않는 이벤트입니다.");
  }

  return value as GameEvent;
}

export function parseReplayState(value: unknown): ReplayState {
  if (
    !isRecord(value) ||
    typeof value.schemaVersion !== "number" ||
    typeof value.eventCount !== "number" ||
    !isPhase(value.phase) ||
    !Array.isArray(value.players) ||
    !value.players.every(isPlayer) ||
    !(value.currentStep === null || isPhaseStep(value.currentStep)) ||
    !Array.isArray(value.phaseOverview) ||
    !value.phaseOverview.every(isPhaseOverviewItem) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(isWarning)
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
    (value.informationPrompt === undefined ||
      isInformationPrompt(value.informationPrompt, value.requiredInput.kind))
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
    !Array.isArray(value.setupInfoRegistrationOptions) ||
    !value.setupInfoRegistrationOptions.every(isSetupInfoRegistrationOption)
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

  if (value.computedResult === undefined) {
    return inputKind === "setupInfo" && value.numberChoices.length === 0;
  }
  if (!isInformationResult(value.computedResult)) return false;
  if (value.computedResult.kind !== "number") return value.numberChoices.length === 0;

  const computedChoices = value.numberChoices.filter((choice) => choice.isComputed);
  const uniqueValues = new Set(value.numberChoices.map((choice) => choice.value));
  return (
    computedChoices.length === 1 &&
    computedChoices[0]?.value === value.computedResult.value &&
    uniqueValues.size === value.numberChoices.length
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
  if (value.type === "drunk") return true;
  if (value.type === "poisoned") {
    return typeof value.poisonerPlayerId === "string" && typeof value.poisonEventId === "string";
  }
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
    ["waiting", "current", "complete", "skipped", "needsFollowUp"].includes(
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
    (value.zeroAllowed === undefined || typeof value.zeroAllowed === "boolean") &&
    typeof value.optional === "boolean"
  );
}

function isPhaseStepInput(value: unknown): value is PhaseStepInput {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if (Array.isArray(value.playerIds) && value.playerIds.every(isString)) return true;
  if (Array.isArray(value.characterIds) && value.characterIds.every(isString)) return true;
  if (typeof value.nominatorId === "string" && typeof value.nomineeId === "string") {
    return Array.isArray(value.voterIds) && value.voterIds.every(isString);
  }
  if (typeof value.execute === "boolean") return true;
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
    typeof value.stepId === "string" &&
    typeof value.nominatorId === "string" &&
    typeof value.nomineeId === "string" &&
    Array.isArray(value.voterIds) &&
    value.voterIds.every(isString) &&
    typeof value.voteCount === "number" &&
    Array.isArray(value.ghostVoteSpentPlayerIds) &&
    value.ghostVoteSpentPlayerIds.every(isString) &&
    typeof value.updatesExecutionCandidate === "boolean"
  );
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
    typeof value.notes === "string"
  );
}

function isWarning(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    (value.severity === "warning" || value.severity === "info") &&
    typeof value.messageKo === "string"
  );
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
