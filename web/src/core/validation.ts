import type {
  CoreResult,
  GameEvent,
  Phase,
  PhaseStep,
  PhaseStepInput,
  Proposal,
  ReplayState,
  SetupDistribution,
} from "./types.js";

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
      if (typeof payload.stepId !== "string" || !isPhaseStepInput(payload.input)) throw invalidEvent();
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
  if (
    value.revealPayload !== undefined &&
    (!isRecord(value.revealPayload) ||
      typeof value.revealPayload.messageKo !== "string" ||
      !isOptionalString(value.revealPayload.previewMessageKo))
  ) {
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
    typeof value.canSkip === "boolean"
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

function isRequiredInput(value: unknown): boolean {
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
