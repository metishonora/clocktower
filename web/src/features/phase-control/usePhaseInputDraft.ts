import { useEffect, useMemo, useState } from "react";
import type {
  NumberChoice,
  PhaseStep,
  PhaseStepInput,
  Player,
  RegistrationJudgment,
} from "../../core/types";
import {
  setupInfoCharacterOptions,
  setupInfoRegistrationJudgments,
  setupInfoZeroOutsidersAvailable,
} from "./phaseInput";

export type PhaseInputDraft = {
  selectedPlayerIds: string[];
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  zeroOutsiders: boolean;
  selectedNumberChoice?: NumberChoice;
  registrationJudgments: RegistrationJudgment[];
};

export type PhaseInputDraftController = PhaseInputDraft & {
  zeroOutsidersAvailable: boolean;
  setSelectedPlayerIds: (playerIds: string[]) => void;
  togglePlayer: (playerId: string) => void;
  setSelectedCharacterId: (characterId: string) => void;
  setSelectedCharacterIds: (characterIds: string[]) => void;
  setZeroOutsiders: (checked: boolean) => void;
  setSelectedNumberChoice: (choice: NumberChoice) => void;
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
  };
}

export function usePhaseInputDraft(
  step: PhaseStep | undefined,
  players: Player[],
): PhaseInputDraftController {
  const [draft, setDraft] = useState<PhaseInputDraft>(emptyDraft);
  const zeroOutsidersAvailable = useMemo(
    () => setupInfoZeroOutsidersAvailable(players, step),
    [players, step],
  );

  useEffect(() => {
    setDraft(emptyDraft());
  }, [step?.id]);

  useEffect(() => {
    if (!zeroOutsidersAvailable) {
      setDraft((current) =>
        current.zeroOutsiders ? { ...current, zeroOutsiders: false } : current,
      );
    }
  }, [zeroOutsidersAvailable]);

  function setSelectedPlayerIds(playerIds: string[]) {
    setDraft((current) => updatePlayerSelection(current, playerIds, step, players));
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
    setSelectedPlayerIds,
    togglePlayer,
    setSelectedCharacterId,
    setSelectedCharacterIds: (selectedCharacterIds) =>
      setDraft((current) => ({ ...current, selectedCharacterIds })),
    setZeroOutsiders,
    setSelectedNumberChoice: (selectedNumberChoice) =>
      setDraft((current) => ({ ...current, selectedNumberChoice })),
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
    return { ...draft, selectedPlayerIds };
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
