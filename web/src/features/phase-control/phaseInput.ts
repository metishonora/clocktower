import type {
  NumberChoice,
  Phase,
  PhaseOverviewItem,
  PhaseStep,
  PhaseStepConfirmation,
  PhaseStepInput,
  Player,
  RegistrationJudgment,
  MayorDecisionInput,
  StepType,
  TargetCheck,
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
  if (step.id.endsWith(":minionInfo")) return "하수인 깨우기 · 악마와 동료 하수인 확인";
  if (step.id.endsWith(":demonInfo")) return "악마 깨우기 · 하수인과 블러프 확인";
  if (step.stepType === "demonSuccession") {
    return step.requiredInput.demonSuccession?.kind === "fixed" ? "탕녀 승계" : "새 임프 선택";
  }
  if (step.character) {
    const label = characterLabel(step.character);
    return player ? `${label}: ${player.seat}번 ${player.name}` : label;
  }
  if (step.id.endsWith(":announceDeaths")) return "사망 발표";
  if (step.stepType === "whisper") return "밀담";
  if (step.stepType === "discussion") return "토론";
  if (step.stepType === "nomination") return `지목 및 투표 ${step.id.split(":").at(-1)}`;
  if (step.id.endsWith(":execution")) return "처형 확정";
  if (step.stepType === "executionDeath") return player ? `처형 결과: ${player.seat}번 ${player.name}` : "처형 결과";
  if (step.stepType === "slayerDeath") return player ? `처단자 결과: ${player.seat}번 ${player.name}` : "처단자 결과";
  return step.id;
}

export function phaseOverviewTitle(step: PhaseOverviewItem, players: Player[]): string {
  const player = step.playerId
    ? players.find((candidate) => candidate.id === step.playerId)
    : undefined;
  if (step.phase !== "firstNight" && step.phase !== "night") {
    return stepTitle(step, player);
  }
  if (step.id.endsWith(":minionInfo")) {
    return factionOverviewTitle("하수인", "Minion", players);
  }
  if (step.id.endsWith(":demonInfo")) {
    return factionOverviewTitle("악마", "Demon", players);
  }
  if (step.character) {
    const label = characterLabel(step.character);
    return player ? `${label} (${player.seat})` : label;
  }
  return stepTitle(step, player);
}

function factionOverviewTitle(
  label: string,
  kind: CharacterKind,
  players: Player[],
): string {
  const seats = players
    .filter((player) => characterKind(player.actualCharacter) === kind)
    .map((player) => player.seat)
    .sort((left, right) => left - right);
  return seats.length > 0 ? `${label} (${seats.join(", ")})` : label;
}

export function stepTypeLabel(stepType: StepType): string {
  if (stepType === "character") return "캐릭터";
  if (stepType === "phaseTransition") return "전환";
  if (stepType === "announcement") return "발표";
  if (stepType === "whisper") return "밀담";
  if (stepType === "discussion") return "토론";
  if (stepType === "nomination") return "지목";
  if (stepType === "execution") return "처형";
  if (stepType === "executionDeath") return "처형 결과";
  if (stepType === "slayerDeath") return "사망 확인";
  if (stepType === "demonSuccession") return "임프 승계";
  return stepType;
}

export function inputKindLabel(inputKind: string): string {
  if (inputKind === "none") return "없음";
  if (inputKind === "playerIds") return "플레이어";
  if (inputKind === "setupInfo") return "설정 정보";
  if (inputKind === "characterIds") return "캐릭터";
  if (inputKind === "number") return "숫자";
  if (inputKind === "nominationVote") return "지목 투표";
  if (inputKind === "nomination") return "지목 확인";
  if (inputKind === "executionDecision") return "처형 결정";
  if (inputKind === "executionDeathDecision") return "처형 결과";
  if (inputKind === "slayerDeathDecision") return "사망 결정";
  if (inputKind === "demonSuccession") return "새 임프";
  if (inputKind === "day") return "낮";
  if (inputKind === "night") return "밤";
  return inputKind;
}

export function currentActionPrompt(step: PhaseStep): string | undefined {
  if (step.stepType === "executionDeath" || step.stepType === "slayerDeath") return undefined;
  if (step.id.endsWith(":fortuneTellerRedHerring")) {
    return "점쟁이의 선한 미끼 플레이어 1명을 선택하세요.";
  }
  if (step.requiredInput.kind === "demonSuccession") {
    return step.requiredInput.demonSuccession?.kind === "selectable"
      ? "새 임프가 될 플레이어를 선택하세요."
      : undefined;
  }

  const characterPrompt = step.character ? characterActionPrompt(step.character) : undefined;
  if (characterPrompt) return characterPrompt;
  if (step.id.endsWith(":demonInfo")) {
    return "악마에게 보여줄 블러프 캐릭터를 최대 3개 선택하세요.";
  }

  const input = step.requiredInput;
  if (input.kind === "nomination") return "지목자와 지목 대상을 선택하세요.";
  if (input.kind === "nominationVote") return "찬성한 플레이어를 선택하세요.";
  if (input.kind === "number") return "전달할 숫자를 선택하세요.";
  if (input.kind === "setupInfo") {
    return input.zeroAllowed
      ? "후보 플레이어 2명과 보여줄 캐릭터를 선택하거나, 외지인 0명을 선택하세요."
      : "후보 플레이어 2명과 보여줄 캐릭터를 선택하세요.";
  }
  if (input.target === "player" || input.target === "players") {
    return selectionPrompt("플레이어", "명", "을", input.minSelections, input.maxSelections);
  }
  if (input.target === "characters") {
    return selectionPrompt("캐릭터", "개", "를", input.minSelections, input.maxSelections);
  }
  return undefined;
}

function characterActionPrompt(characterId: string): string | undefined {
  if (characterId === "washerwoman") {
    return "세탁부 정보로 보여줄 플레이어 2명과 주민 캐릭터를 선택하세요.";
  }
  if (characterId === "librarian") {
    return "사서 정보로 보여줄 플레이어 2명과 외지인 캐릭터를 선택하거나, 외지인 0명을 선택하세요.";
  }
  if (characterId === "investigator") {
    return "수사관 정보로 보여줄 플레이어 2명과 하수인 캐릭터를 선택하세요.";
  }
  if (characterId === "chef") return "전달할 악한 팀 이웃 쌍의 수를 선택하세요.";
  if (characterId === "empath") return "전달할 살아있는 이웃 중 악한 팀 수를 선택하세요.";
  if (characterId === "fortuneTeller") return "확인할 플레이어 2명을 선택하세요.";
  if (characterId === "poisoner") return "중독시킬 플레이어 1명을 선택하세요.";
  if (characterId === "monk") return "악마로부터 보호할 플레이어 1명을 선택하세요.";
  if (characterId === "imp") return "오늘 밤 공격할 플레이어 1명을 선택하세요.";
  if (characterId === "ravenkeeper") return "캐릭터를 확인할 플레이어 1명을 선택하세요.";
  if (characterId === "butler") return "주인으로 정할 플레이어 1명을 선택하세요.";
  return undefined;
}

function selectionPrompt(
  target: string,
  unit: string,
  exactParticle: string,
  minSelections: number | undefined,
  maxSelections: number | undefined,
): string {
  const min = minSelections ?? 0;
  if (maxSelections !== undefined && min === maxSelections) {
    return `${target} ${maxSelections}${unit}${exactParticle} 선택하세요.`;
  }
  if (maxSelections !== undefined && min === 0) {
    return `${target}를 최대 ${maxSelections}${unit} 선택하세요.`;
  }
  if (maxSelections !== undefined) {
    return `${target}를 ${min}-${maxSelections}${unit} 선택하세요.`;
  }
  if (min > 0) return `${target}를 ${min}${unit} 이상 선택하세요.`;
  return `${target}를 선택하세요.`;
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
  mayorDecision?: MayorDecisionInput,
  selectedPlayerIds: string[] = [],
): boolean {
  if (step.requiredInput.kind === "nomination") {
    return nominationDraft.nominatorId.length > 0 && nominationDraft.nomineeId.length > 0;
  }
  if (step.requiredInput.kind === "nominationVote") {
    return step.id.endsWith(":vote") ||
      (nominationDraft.nominatorId.length > 0 && nominationDraft.nomineeId.length > 0);
  }
  if (step.requiredInput.kind === "demonSuccession") {
    return step.requiredInput.demonSuccession?.kind === "fixed" || selectedCount === 1;
  }
  if (step.requiredInput.mayorDecision && selectedPlayerIds.includes(step.requiredInput.mayorDecision.mayorPlayerId)) {
    return Boolean(mayorDecision);
  }
  if (step.requiredInput.kind === "executionDecision") return true;
  if (step.requiredInput.kind === "executionDeathDecision") return true;
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
  mayorDecision?: MayorDecisionInput,
): PhaseStepInput {
  if (step.requiredInput.kind === "nomination") {
    return { nominatorId: nominationDraft.nominatorId, nomineeId: nominationDraft.nomineeId };
  }
  if (step.requiredInput.kind === "nominationVote") {
    return step.id.endsWith(":vote")
      ? { voterIds: nominationDraft.voterIds }
      : nominationDraft;
  }
  if (step.requiredInput.kind === "demonSuccession") {
    const fixedSuccessor = step.requiredInput.demonSuccession?.kind === "fixed"
      ? step.requiredInput.demonSuccession.successorPlayerId
      : undefined;
    return { successorPlayerId: fixedSuccessor ?? selectedPlayerIds[0] ?? "" };
  }
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
    return mayorDecision
      ? { playerIds: selectedPlayerIds, mayorDecision }
      : { playerIds: selectedPlayerIds };
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
    selectedTargetChoice?: TargetCheck["choices"][number];
    mayorDecision?: MayorDecisionInput;
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
      draft.mayorDecision,
    ),
  };

  if (step.requiredInput.kind === "setupInfo" && draft.registrationJudgments.length) {
    confirmation.registrationJudgments = draft.registrationJudgments;
  }
  if (step.requiredInput.kind !== "setupInfo" && draft.registrationJudgments.length) {
    confirmation.registrationJudgments = draft.registrationJudgments;
  }

  const targetCheck = targetCheckForSelection(step, draft.selectedPlayerIds);
  if (targetCheck && confirmation.input && "playerIds" in confirmation.input) {
    confirmation.input = {
      ...confirmation.input,
      playerIds: [...targetCheck.targetPlayerIds],
    };
    delete confirmation.registrationJudgments;
  }
  const selectedTargetChoice = draft.selectedTargetChoice;
  const targetChoice = selectedTargetChoice && targetCheck?.choices.includes(selectedTargetChoice)
    ? selectedTargetChoice
    : targetCheck?.choices.length === 1
      ? targetCheck.choices[0]
      : undefined;
  if (targetChoice) {
    if (!targetChoice.isComputed || step.informationPrompt?.deliveryMode === "selectable") {
      confirmation.deliveredResult = targetChoice.result;
    }
    if (targetChoice.registrationJudgments.length) {
      confirmation.registrationJudgments = targetChoice.registrationJudgments;
    }
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

export function targetCheckForSelection(
  step: PhaseStep,
  selectedPlayerIds: string[],
): TargetCheck | undefined {
  const checks = step.informationPrompt?.targetChecks;
  if (!checks?.length) return undefined;
  if (step.requiredInput.target !== "player" && step.requiredInput.target !== "players") {
    return checks.length === 1 ? checks[0] : undefined;
  }
  return checks.find(
    (check) =>
      check.targetPlayerIds.length === selectedPlayerIds.length &&
      check.targetPlayerIds.every((id) => selectedPlayerIds.includes(id)),
  );
}

export function stepStatusLabel(status: PhaseOverviewItem["status"]): string {
  if (status === "current") return "현재";
  if (status === "complete") return "완료";
  if (status === "skipped") return "건너뜀";
  if (status === "needsFollowUp") return "후속 필요";
  return "대기";
}
