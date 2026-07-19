import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { MayorDecisionInput, PhaseStep, Player, RegistrationJudgment } from "../src/core/types";
import { StepInputFields } from "../src/features/phase-control/StepInputs";
import { emptyNominationDraft, type NominationDraft } from "../src/features/voting/useNominationDraft";

const players: Player[] = [
  player("spy", 1, "첩자", "spy", true),
  player("virgin", 2, "성결자", "virgin", true),
  player("mayor", 3, "시장", "mayor", true),
  player("dead", 4, "사망자", "chef", false),
];

describe("issue 11 production workflow", () => {
  test("confirms a nomination before voting and offers the Spy registration for that check", () => {
    const step: PhaseStep = {
      id: "day1:nomination:1",
      phase: "day",
      stepType: "nomination",
      requiredInput: {
        kind: "nomination",
        target: "nomination",
        playerRegistrationOptions: [{ playerId: "spy", registeredAs: "townsfolk" }],
        optional: false,
      },
      canSkip: false,
    };
    const judgments: RegistrationJudgment[][] = [];
    render(<InputHarness step={step} onJudgments={(value) => judgments.push(value)} />);

    fireEvent.change(screen.getByRole("combobox", { name: "지목자" }), { target: { value: "spy" } });
    fireEvent.change(screen.getByRole("combobox", { name: "피지목자" }), { target: { value: "virgin" } });
    expect(screen.queryByText("현재 표")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "주민으로 등록" }));
    expect(judgments.at(-1)).toEqual([{ playerId: "spy", registeredAs: "townsfolk" }]);
  });

  test("offers Mayor death or a bounce to an explicitly listed dead player", () => {
    const step: PhaseStep = {
      id: "night1:imp",
      phase: "night",
      stepType: "character",
      character: "imp",
      playerId: "spy",
      requiredInput: {
        kind: "playerIds",
        target: "player",
        minSelections: 1,
        maxSelections: 1,
        mayorDecision: { mayorPlayerId: "mayor", bounceTargetPlayerIds: ["dead"] },
        optional: false,
      },
      canSkip: false,
    };
    render(<InputHarness step={step} initialSelectedPlayerIds={["mayor"]} />);

    expect(screen.getByRole("button", { name: "시장이 사망" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "4번 사망자에게 튕김 · 사망" })).toBeTruthy();
  });
});

function InputHarness({
  step,
  initialSelectedPlayerIds = [],
  onJudgments = vi.fn(),
}: {
  step: PhaseStep;
  initialSelectedPlayerIds?: string[];
  onJudgments?: (judgments: RegistrationJudgment[]) => void;
}) {
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>(emptyNominationDraft);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(initialSelectedPlayerIds);
  const [mayorDecision, setMayorDecision] = useState<MayorDecisionInput>();
  return <StepInputFields
    step={step}
    players={players}
    dayState={{ nominations: [], eligibleNominatorIds: players.map(({ id }) => id), eligibleNomineeIds: players.map(({ id }) => id), executionVoteThreshold: 2, highestVoteCount: 0 }}
    nominationDraft={nominationDraft}
    onNominationDraftChange={setNominationDraft}
    selectedPlayerIds={selectedPlayerIds}
    selectedCharacterId=""
    selectedCharacterIds={[]}
    zeroOutsiders={false}
    zeroOutsidersAvailable
    mayorDecision={mayorDecision}
    busy={false}
    onSelectedPlayerIdsChange={setSelectedPlayerIds}
    onCharacterChange={vi.fn()}
    onCharactersChange={vi.fn()}
    onZeroOutsidersChange={vi.fn()}
    onNumberChoiceChange={vi.fn()}
    onTargetChoiceChange={vi.fn()}
    onMayorDecisionChange={setMayorDecision}
    onRegistrationJudgmentsChange={onJudgments}
  />;
}

function player(id: string, seat: number, name: string, actualCharacter: string, alive: boolean): Player {
  return { id, seat, name, actualCharacter, shownCharacter: actualCharacter, alignment: actualCharacter === "spy" ? "evil" : "good", alive, ghostVoteUsed: false, deathAnnounced: false, systemTokenIds: [], scriptTokens: [], notes: "" };
}
