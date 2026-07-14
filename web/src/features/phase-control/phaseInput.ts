import type {
  NumericReason,
  Phase,
  PhaseOverviewItem,
  PhaseStep,
  PhaseStepInput,
  Player,
  StepType,
} from "../../core/types";
import {
  characterLabel,
  characters,
  type CharacterKind,
} from "../../setupDraft";
import type { NominationDraft } from "../voting/useNominationDraft";

export function phaseLabel(phase: Phase): string {
  if (phase === "firstNight") return "첫 밤";
  if (phase === "day") return "낮";
  if (phase === "night") return "밤";
  return "설정";
}

export function stepTitle(step: PhaseStep, player?: Player): string {
  if (step.stepType === "phaseTransition") {
    const nextPhase = step.requiredInput.kind;
    if (nextPhase === "day" || nextPhase === "night") return `${phaseLabel(nextPhase)} 시작`;
  }
  if (step.character) {
    const label = characterLabel(step.character);
    return player ? `${label}: ${player.seat}번 ${player.name}` : label;
  }
  if (step.id.endsWith(":announceDeaths")) return "사망 발표";
  if (step.stepType === "nomination") return `지명과 투표 ${step.id.split(":").at(-1)}`;
  if (step.id.endsWith(":execution")) return "처형 확정";
  return step.id;
}

export function stepTypeLabel(stepType: StepType): string {
  if (stepType === "character") return "캐릭터";
  if (stepType === "phaseTransition") return "전환";
  if (stepType === "announcement") return "발표";
  if (stepType === "nomination") return "지명";
  if (stepType === "execution") return "처형";
  return stepType;
}

export function inputKindLabel(inputKind: string): string {
  if (inputKind === "none") return "없음";
  if (inputKind === "playerIds") return "플레이어";
  if (inputKind === "setupInfo") return "설정 정보";
  if (inputKind === "characterIds") return "캐릭터";
  if (inputKind === "number") return "숫자";
  if (inputKind === "nominationVote") return "지명 투표";
  if (inputKind === "executionDecision") return "처형 결정";
  if (inputKind === "day") return "낮";
  if (inputKind === "night") return "밤";
  return inputKind;
}

export function inputShapeLabel(input: PhaseStep["requiredInput"]): string {
  const parts = [inputKindLabel(input.kind)];
  if (input.target) parts.push(inputTargetLabel(input.target));
  if (input.minSelections !== undefined || input.maxSelections !== undefined) {
    const min = input.minSelections ?? 0;
    const max = input.maxSelections ?? "제한 없음";
    parts.push(`${min}-${max}`);
  }
  if (input.optional) parts.push("선택");
  return parts.join(" · ");
}

function inputTargetLabel(target: string): string {
  if (target === "player") return "플레이어";
  if (target === "players") return "플레이어들";
  if (target === "characters") return "캐릭터들";
  if (target === "number") return "숫자";
  if (target === "phase") return "페이즈";
  if (target === "execution") return "처형";
  return target;
}

function requiredSelectionValid(step: PhaseStep, selectedCount: number): boolean {
  const input = step.requiredInput;
  if (input.target !== "player" && input.target !== "players") return true;
  if (input.minSelections !== undefined && selectedCount < input.minSelections) return false;
  if (input.maxSelections !== undefined && selectedCount > input.maxSelections) return false;
  return true;
}

export function stepInputReady(
  step: PhaseStep,
  selectedCount: number,
  selectedCharacterCount: number,
  selectedCharacterId: string,
  nominationDraft: NominationDraft,
  zeroOutsiders: boolean,
  numberValue: string,
  numberReason: string,
): boolean {
  if (step.requiredInput.kind === "nominationVote") {
    return nominationDraft.nominatorId.length > 0 && nominationDraft.nomineeId.length > 0;
  }
  if (step.requiredInput.kind === "executionDecision") return true;
  if (step.requiredInput.kind === "setupInfo") {
    if (step.requiredInput.zeroAllowed && zeroOutsiders) return selectedCount === 0;
    return selectedCount === (step.requiredInput.maxSelections ?? 0) && selectedCharacterId.length > 0;
  }
  if (step.requiredInput.target === "characters") {
    return requiredSelectionCountValid(step, selectedCharacterCount);
  }
  if (step.requiredInput.kind === "number") {
    if (numberValue.trim().length === 0) return true;
    const value = Number(numberValue);
    return Number.isInteger(value) && value >= 0 && value <= 15 && numberReason.length > 0;
  }
  return requiredSelectionValid(step, selectedCount);
}

export function stepInputPayload(
  step: PhaseStep,
  selectedPlayerIds: string[],
  selectedCharacterId: string,
  selectedCharacterIds: string[],
  nominationDraft: NominationDraft,
  zeroOutsiders: boolean,
  numberValue: string,
  numberReason: string,
): PhaseStepInput {
  if (step.requiredInput.kind === "nominationVote") return nominationDraft;
  if (step.requiredInput.kind === "executionDecision") return { execute: true };
  if (step.requiredInput.kind === "setupInfo") {
    if (step.requiredInput.zeroAllowed && zeroOutsiders) return { zeroOutsiders: true };
    return { playerIds: selectedPlayerIds, characterId: selectedCharacterId };
  }
  if (step.requiredInput.target === "characters") return { characterIds: selectedCharacterIds };
  if (step.requiredInput.kind === "number") {
    if (numberValue.trim().length === 0) return null;
    return { value: Number(numberValue), reason: numberReason as NumericReason };
  }
  if (step.requiredInput.target === "player" || step.requiredInput.target === "players") {
    return { playerIds: selectedPlayerIds };
  }
  return null;
}

function requiredSelectionCountValid(step: PhaseStep, selectedCount: number): boolean {
  const input = step.requiredInput;
  if (input.minSelections !== undefined && selectedCount < input.minSelections) return false;
  if (input.maxSelections !== undefined && selectedCount > input.maxSelections) return false;
  return true;
}

export function setupInfoCharacterOptions(kind?: CharacterKind): typeof characters {
  if (!kind) return characters;
  return characters.filter((character) => character.kind === kind);
}

export function stepStatusLabel(status: PhaseOverviewItem["status"]): string {
  if (status === "current") return "현재";
  if (status === "complete") return "완료";
  if (status === "skipped") return "건너뜀";
  if (status === "needsFollowUp") return "후속 필요";
  return "대기";
}
