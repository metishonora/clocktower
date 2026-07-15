import type {
  NumberChoice,
  Phase,
  PhaseOverviewItem,
  PhaseStep,
  PhaseStepConfirmation,
  PhaseStepInput,
  Player,
  RegistrationJudgment,
  StepType,
} from "../../core/types.js";
import {
  characterKind,
  characterLabel,
  characters,
  type CharacterKind,
} from "../../setupDraft.js";
import type { NominationDraft } from "../voting/useNominationDraft.js";

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
  if (step.stepType === "whisper") return "밀담";
  if (step.stepType === "discussion") return "토론";
  if (step.stepType === "nomination") return `지명 및 투표 ${step.id.split(":").at(-1)}`;
  if (step.id.endsWith(":execution")) return "처형 확정";
  return step.id;
}

export function stepTypeLabel(stepType: StepType): string {
  if (stepType === "character") return "캐릭터";
  if (stepType === "phaseTransition") return "전환";
  if (stepType === "announcement") return "발표";
  if (stepType === "whisper") return "밀담";
  if (stepType === "discussion") return "토론";
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
  selectedNumberChoice: NumberChoice | undefined,
  zeroOutsidersAvailable = true,
): boolean {
  if (step.requiredInput.kind === "nominationVote") {
    return nominationDraft.nominatorId.length > 0 && nominationDraft.nomineeId.length > 0;
  }
  if (step.requiredInput.kind === "executionDecision") return true;
  if (step.informationPrompt?.numberChoices.length) {
    if (!selectedNumberChoice) return false;
    if (
      !step.informationPrompt.numberChoices.some(
        (choice) => choice.value === selectedNumberChoice.value,
      )
    ) {
      return false;
    }
  }
  if (step.requiredInput.kind === "setupInfo") {
    if (step.requiredInput.zeroAllowed && zeroOutsiders) {
      return zeroOutsidersAvailable && selectedCount === 0;
    }
    return selectedCount === (step.requiredInput.maxSelections ?? 0) && selectedCharacterId.length > 0;
  }
  if (step.requiredInput.target === "characters") {
    return requiredSelectionCountValid(step, selectedCharacterCount);
  }
  if (step.requiredInput.kind === "number") {
    return true;
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
): PhaseStepInput {
  if (step.requiredInput.kind === "nominationVote") return nominationDraft;
  if (step.requiredInput.kind === "executionDecision") return { execute: true };
  if (step.requiredInput.kind === "setupInfo") {
    if (step.requiredInput.zeroAllowed && zeroOutsiders) return { zeroOutsiders: true };
    return { playerIds: selectedPlayerIds, characterId: selectedCharacterId };
  }
  if (step.requiredInput.target === "characters") return { characterIds: selectedCharacterIds };
  if (step.requiredInput.kind === "number") {
    return null;
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

export function setupInfoCharacterOptions(
  kind: CharacterKind | undefined,
  selectedPlayerIds: string[],
  players: Player[],
  step?: PhaseStep,
): typeof characters {
  if (step && setupInfoDeliveryIsImpaired(step)) {
    return characters.filter((character) => !kind || character.kind === kind);
  }

  const selectedActualCharacters = new Set(
    players
      .filter((player) => selectedPlayerIds.includes(player.id))
      .map((player) => player.actualCharacter),
  );

  const registeredCharacterIds = new Set(
    step?.informationPrompt?.setupInfoRegistrationOptions
      .filter((option) => selectedPlayerIds.includes(option.playerId))
      .flatMap((option) => option.characterIds) ?? [],
  );

  return characters.filter((character) => {
    if (kind && character.kind !== kind) return false;
    return selectedActualCharacters.has(character.id) || registeredCharacterIds.has(character.id);
  });
}

export function characterInputOptions(allowedCharacterIds?: string[]): typeof characters {
  if (allowedCharacterIds === undefined) return characters;
  const allowed = new Set(allowedCharacterIds);
  return characters.filter((character) => allowed.has(character.id));
}

export function setupInfoZeroOutsidersAvailable(players: Player[], step?: PhaseStep): boolean {
  if (step && setupInfoDeliveryIsImpaired(step)) return true;
  return players.every((player) => characterKind(player.actualCharacter) !== "Outsider");
}

export function setupInfoDeliveryIsImpaired(step: PhaseStep): boolean {
  return Boolean(
    step.informationPrompt?.activeReasons.some(
      (reason) => reason.type === "drunk" || reason.type === "poisoned",
    ),
  );
}

export function setupInfoRegistrationJudgments(
  step: PhaseStep,
  selectedPlayerIds: string[],
  selectedCharacterId: string,
  players: Player[],
): RegistrationJudgment[] {
  if (step.requiredInput.kind !== "setupInfo" || !selectedCharacterId) return [];
  const representedByActualCharacter = players.some(
    (player) =>
      selectedPlayerIds.includes(player.id) && player.actualCharacter === selectedCharacterId,
  );
  if (representedByActualCharacter) return [];

  const option = step.informationPrompt?.setupInfoRegistrationOptions.find(
    (candidate) =>
      selectedPlayerIds.includes(candidate.playerId) &&
      candidate.characterIds.includes(selectedCharacterId),
  );
  if (!option) return [];
  return [
    {
      playerId: option.playerId,
      registeredAs: option.registeredAs,
      characterId: selectedCharacterId,
    },
  ];
}

export function phaseStepConfirmation(
  step: PhaseStep,
  draft: {
    selectedPlayerIds: string[];
    selectedCharacterId: string;
    selectedCharacterIds: string[];
    zeroOutsiders: boolean;
    selectedNumberChoice?: NumberChoice;
    registrationJudgments: RegistrationJudgment[];
  },
  nominationDraft: NominationDraft,
): PhaseStepConfirmation {
  const confirmation: PhaseStepConfirmation = {
    input: stepInputPayload(
      step,
      draft.selectedPlayerIds,
      draft.selectedCharacterId,
      draft.selectedCharacterIds,
      nominationDraft,
      draft.zeroOutsiders,
    ),
  };

  if (step.requiredInput.kind === "setupInfo" && draft.registrationJudgments.length) {
    confirmation.registrationJudgments = draft.registrationJudgments;
  }

  const choice = step.informationPrompt?.numberChoices.find(
    (candidate) => candidate.value === draft.selectedNumberChoice?.value,
  );
  if (!choice) return confirmation;
  const impaired = setupInfoDeliveryIsImpaired(step);
  if (!choice.isComputed || impaired) {
    confirmation.deliveredResult = { kind: "number", value: choice.value };
  }
  if (!impaired && choice.registrationJudgments.length) {
    confirmation.registrationJudgments = choice.registrationJudgments;
  }
  return confirmation;
}

export function stepStatusLabel(status: PhaseOverviewItem["status"]): string {
  if (status === "current") return "현재";
  if (status === "complete") return "완료";
  if (status === "skipped") return "건너뜀";
  if (status === "needsFollowUp") return "후속 필요";
  return "대기";
}
