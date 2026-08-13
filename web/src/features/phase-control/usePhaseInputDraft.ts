import { useEffect, useMemo, useState } from "react";
import type {
  NumberChoice,
  MayorDecisionInput,
  PhaseStep,
  PhaseStepInput,
  Player,
  RegistrationJudgment,
  TargetCheck,
} from "../../core/types";
import { characterKind } from "../../setupDraft";
import {
  mayorDecisionApplies,
  setupInfoCharacterOptions,
  setupInfoRegistrationJudgments,
  setupInfoSelectablePlayerIds,
  setupInfoSelectionCanComplete,
  setupInfoZeroOutsidersAvailable,
} from "./phaseInput";

export type PhaseInputDraft = {
  selectedPlayerIds: string[];
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  zeroOutsiders: boolean;
  selectedNumberChoice?: NumberChoice;
  registrationJudgments: RegistrationJudgment[];
  selectedTargetChoice?: TargetCheck["choices"][number];
  mayorDecision?: MayorDecisionInput;
};

export type PhaseInputDraftController = PhaseInputDraft & {
  zeroOutsidersAvailable: boolean;
  setupInfoSelectablePlayerIds?: string[];
  setSelectedPlayerIds: (playerIds: string[]) => void;
  togglePlayer: (playerId: string) => void;
  setSelectedCharacterId: (characterId: string) => void;
  setSelectedCharacterIds: (characterIds: string[]) => void;
  setZeroOutsiders: (checked: boolean) => void;
  setSelectedNumberChoice: (choice: NumberChoice | undefined) => void;
  setSelectedTargetChoice: (choice: TargetCheck["choices"][number]) => void;
  setMayorDecision: (decision: MayorDecisionInput | undefined) => void;
  setRegistrationJudgments: (judgments: RegistrationJudgment[]) => void;
  reset: () => void;
  applySuggestion: (input: PhaseStepInput) => void;
};

function emptyDraft(): PhaseInputDraft {
  return {
    selectedPlayerIds: [],
    selectedCharacterId: "",
    selectedCharacterIds: [],
    zeroOutsiders: false,
    selectedNumberChoice: undefined,
    registrationJudgments: [],
    selectedTargetChoice: undefined,
    mayorDecision: undefined,
  };
}

export function usePhaseInputDraft(
  step: PhaseStep | undefined,
  players: Player[],
  contextFingerprint = "",
  resetRevision = 0,
): PhaseInputDraftController {
  const [draft, setDraft] = useState<PhaseInputDraft>(emptyDraft);
  const zeroOutsidersAvailable = useMemo(
    () => setupInfoZeroOutsidersAvailable(players, step),
    [players, step],
  );
  const actualOutsidersAbsent = useMemo(
    () => players.every((player) => characterKind(player.actualCharacter) !== "Outsider"),
    [players],
  );
  const selectableSetupInfoPlayerIds = useMemo(
    () => step?.requiredInput.kind === "setupInfo"
      ? setupInfoSelectablePlayerIds(step, draft.selectedPlayerIds, players)
      : undefined,
    [draft.selectedPlayerIds, players, step],
  );

  useEffect(() => {
    setDraft(emptyDraft());
  }, [step?.id, contextFingerprint, resetRevision]);

  useEffect(() => {
    const autoZeroOutsiders = step?.character === "librarian"
      && step.requiredInput.kind === "setupInfo"
      && zeroOutsidersAvailable
      && actualOutsidersAbsent
      && !step.informationPrompt?.activeReasons.some(
        (reason) => reason.type === "poisoned" || reason.type === "drunk",
      );
    if (autoZeroOutsiders) {
      setDraft((current) => current.zeroOutsiders ? current : {
        ...emptyDraft(),
        zeroOutsiders: true,
      });
    } else if (!zeroOutsidersAvailable) {
      setDraft((current) =>
        current.zeroOutsiders ? { ...current, zeroOutsiders: false } : current,
      );
    }
  }, [actualOutsidersAbsent, step, zeroOutsidersAvailable]);

  function setSelectedPlayerIds(playerIds: string[]) {
    setDraft((current) => {
      const removesOnly = playerIds.length < current.selectedPlayerIds.length
        && playerIds.every((playerId) => current.selectedPlayerIds.includes(playerId));
      if (
        step?.requiredInput.kind === "setupInfo"
        && playerIds.length > 0
        && !removesOnly
        && !setupInfoSelectionCanComplete(step, playerIds, players)
      ) {
        return current;
      }
      return updatePlayerSelection(current, playerIds, step, players);
    });
  }

  function togglePlayer(playerId: string) {
    if (!step || draft.zeroOutsiders) return;
    if (draft.selectedPlayerIds.includes(playerId)) {
      setSelectedPlayerIds(draft.selectedPlayerIds.filter((selectedId) => selectedId !== playerId));
      return;
    }
    const max = step.requiredInput.maxSelections ?? players.length;
    if (max === 1) {
      setSelectedPlayerIds([playerId]);
      return;
    }
    if (draft.selectedPlayerIds.length >= max) return;
    setSelectedPlayerIds([...draft.selectedPlayerIds, playerId]);
  }

  function setSelectedCharacterId(characterId: string) {
    setDraft((current) => ({
      ...current,
      selectedCharacterId: characterId,
      registrationJudgments: step
        ? setupInfoRegistrationJudgments(
            step,
            current.selectedPlayerIds,
            characterId,
            players,
          )
        : [],
    }));
  }

  function setZeroOutsiders(checked: boolean) {
    if (checked && !zeroOutsidersAvailable) return;
    setDraft((current) => ({
      ...current,
      zeroOutsiders: checked,
      ...(checked
        ? {
            selectedPlayerIds: [],
            selectedCharacterId: "",
            registrationJudgments: [],
          }
        : {}),
    }));
  }

  function applySuggestion(input: PhaseStepInput) {
    if (input && "characterIds" in input && Array.isArray(input.characterIds)) {
      setDraft({ ...emptyDraft(), selectedCharacterIds: [...input.characterIds] });
      return;
    }
    if (input && "zeroOutsiders" in input && input.zeroOutsiders === true) {
      setDraft({ ...emptyDraft(), zeroOutsiders: true });
      return;
    }
    if (
      input &&
      "playerIds" in input &&
      Array.isArray(input.playerIds) &&
      "characterId" in input &&
      typeof input.characterId === "string"
    ) {
      setDraft({
        ...emptyDraft(),
        selectedPlayerIds: [...input.playerIds],
        selectedCharacterId: input.characterId,
      });
    }
  }

  return {
    ...draft,
    zeroOutsidersAvailable,
    setupInfoSelectablePlayerIds: selectableSetupInfoPlayerIds,
    setSelectedPlayerIds,
    togglePlayer,
    setSelectedCharacterId,
    setSelectedCharacterIds: (selectedCharacterIds) =>
      setDraft((current) => ({ ...current, selectedCharacterIds })),
    setZeroOutsiders,
    setSelectedNumberChoice: (selectedNumberChoice) =>
      setDraft((current) => ({ ...current, selectedNumberChoice })),
    setSelectedTargetChoice: (selectedTargetChoice) =>
      setDraft((current) => ({ ...current, selectedTargetChoice })),
    setMayorDecision: (mayorDecision) => setDraft((current) => ({ ...current, mayorDecision })),
    setRegistrationJudgments: (registrationJudgments) =>
      setDraft((current) => ({ ...current, registrationJudgments })),
    reset: () => setDraft(emptyDraft()),
    applySuggestion,
  };
}

function updatePlayerSelection(
  draft: PhaseInputDraft,
  selectedPlayerIds: string[],
  step: PhaseStep | undefined,
  players: Player[],
): PhaseInputDraft {
  if (!step || step.requiredInput.kind !== "setupInfo") {
    const check = step?.informationPrompt?.targetChecks?.find(
      (candidate) => samePlayerIds(candidate.targetPlayerIds, selectedPlayerIds),
    );
    return {
      ...draft,
      selectedPlayerIds,
      mayorDecision: step && mayorDecisionApplies(step, selectedPlayerIds)
        ? draft.mayorDecision
        : undefined,
      selectedTargetChoice: check?.choices.length === 1 ? check.choices[0] : undefined,
      registrationJudgments: registrationWitnessForPlayers(step, selectedPlayerIds),
    };
  }
  const validCharacterIds = new Set(
    setupInfoCharacterOptions(
      step.requiredInput.characterKind,
      selectedPlayerIds,
      players,
      step,
    ).map((character) => character.id),
  );
  const selectedCharacterId = validCharacterIds.has(draft.selectedCharacterId)
    ? draft.selectedCharacterId
    : "";
  return {
    ...draft,
    selectedPlayerIds,
    selectedCharacterId,
    registrationJudgments: setupInfoRegistrationJudgments(
      step,
      selectedPlayerIds,
      selectedCharacterId,
      players,
    ),
  };
}

function registrationWitnessForPlayers(step: PhaseStep | undefined, playerIds: string[]): RegistrationJudgment[] {
  if (!step) return [];
  return step.requiredInput.playerRegistrationOptions?.filter((option) => playerIds.includes(option.playerId)) ?? [];
}

function samePlayerIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}
