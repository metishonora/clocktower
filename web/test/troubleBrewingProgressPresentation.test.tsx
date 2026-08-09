import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PhaseOverviewItem, PhaseStep, Player } from "../src/core/types";
import type { PhaseControlProps } from "../src/features/phase-control/PhaseControl";
import type { PhaseInputDraftController } from "../src/features/phase-control/usePhaseInputDraft";
import { TroubleBrewingProgress } from "../src/features/trouble-brewing/TroubleBrewingProgress";

const players: Player[] = [
  player("player-1", 1, "민지", "washerwoman"),
  player("player-2", 2, "서연", "fortuneTeller"),
  player("player-4", 4, "지우", "poisoner"),
  player("player-5", 5, "하린", "imp"),
  player("player-7", 7, "현우", "spy"),
];

test("uses the accepted S&V target hierarchy while keeping phase order expanded", () => {
  const currentStep = step({
    id: "firstNight:poisoner",
    phase: "firstNight",
    character: "poisoner",
    playerId: "player-4",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      allowedPlayerIds: players.map(({ id }) => id),
      supportsRandomSuggestion: true,
      optional: false,
    },
    canSkip: true,
  });

  renderProgress(currentStep, [
    overview(currentStep, "current"),
    overview(step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" }), "waiting"),
  ]);

  const task = screen.getByRole("region", { name: "현재 단계" });
  expect(task.classList.contains("issue116CurrentStep")).toBe(true);
  expect(task.classList.contains("issue116DemonStep")).toBe(true);
  expect(within(task).getByRole("heading", { name: "독살범: 4번 지우" })).toBeTruthy();
  expect(within(task).getByText("4번 지우")).toBeTruthy();
  expect(within(task).getByRole("button", { name: "대상 선택" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "건너뛰기" })).toBeTruthy();
  expect(within(task).queryByRole("button", { name: "지명 종료" })).toBeNull();
  expect(within(task).queryByRole("button", { name: "확정" })).toBeNull();

  const phaseOrder = screen.getByRole("list", { name: "첫날 밤 순서" });
  expect(phaseOrder.querySelectorAll(".snvPhaseOverviewAction")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /단계.*열기/ })).toBeNull();
  expect(screen.queryByText(/현재 \d+\/\d+/)).toBeNull();
});

test("uses the current Trouble Brewing phase theme for progress character details", async () => {
  const user = userEvent.setup();
  const currentStep = step({
    id: "firstNight:poisoner",
    phase: "firstNight",
    character: "poisoner",
    playerId: "player-4",
  });

  renderProgress(currentStep, [overview(currentStep, "current")]);
  await user.click(screen.getByRole("button", { name: "독살범 캐릭터 상세 열기" }));

  const characterRules = screen.getByRole("dialog", { name: "독살범 캐릭터 상세" });
  expect(characterRules.closest(".characterRulesBackdrop")?.classList.contains("tb-night")).toBe(true);
  expect(characterRules.closest(".characterRulesBackdrop")?.classList.contains("tb-day")).toBe(false);
});

test("uses the S&V nomination summary and execution decision shapes", () => {
  const nomination = step({
    id: "day1:nomination:1",
    phase: "day",
    stepType: "nomination",
    requiredInput: { kind: "nomination", target: "nomination", optional: false },
    canSkip: true,
  });
  const view = renderProgress(nomination, [overview(nomination, "current")], {
    nominations: [],
    eligibleNominatorIds: players.map(({ id }) => id),
    eligibleNomineeIds: players.map(({ id }) => id),
    executionVoteThreshold: 2,
    highestVoteCount: 4,
    executionCandidate: { nomineeId: "player-7", voteCount: 4 },
  });

  const nominationTask = screen.getByRole("region", { name: "현재 단계" });
  const candidate = within(nominationTask).getByLabelText("현재 최고 득표");
  expect(candidate.classList.contains("issue116CandidateSummary")).toBe(true);
  expect(candidate.textContent).toContain("7번 현우");
  expect(candidate.textContent).toContain("4표");
  expect(within(nominationTask).getByRole("button", { name: "지명 종료" })).toBeTruthy();

  const execution = step({
    id: "day1:execution",
    phase: "day",
    stepType: "execution",
    requiredInput: { kind: "executionDecision", optional: false },
  });
  view.rerender(progress(execution, [overview(execution, "current")], {
    nominations: [],
    eligibleNominatorIds: players.map(({ id }) => id),
    eligibleNomineeIds: players.map(({ id }) => id),
    executionVoteThreshold: 2,
    highestVoteCount: 4,
    executionCandidate: { nomineeId: "player-7", voteCount: 4 },
  }));

  const executionTask = screen.getByRole("region", { name: "현재 단계" });
  expect(executionTask.classList.contains("issue116ExecutionStep")).toBe(true);
  expect(within(executionTask).getByText("7번 현우")).toBeTruthy();
  expect(within(executionTask).getByText("첩자")).toBeTruthy();
  expect(within(executionTask).getByRole("button", { name: "처형 확정" }).classList.contains("issue116ExecutionConfirm")).toBe(true);
  expect(within(executionTask).getByRole("button", { name: "처형 없음" })).toBeTruthy();
});

test("uses the S&V evil-information task shape for Demon bluffs", () => {
  const demonInformation = step({
    id: "firstNight:demonInfo",
    phase: "firstNight",
    stepType: "evilInfo",
    requiredInput: {
      kind: "characterIds",
      target: "characters",
      minSelections: 3,
      maxSelections: 3,
      allowedCharacterIds: ["librarian", "undertaker", "butler"],
      supportsRandomSuggestion: true,
      optional: false,
    },
  });

  renderProgress(demonInformation, [overview(demonInformation, "current")]);

  const task = screen.getByRole("region", { name: "현재 단계" });
  expect(task.classList.contains("snvEvilInformationTask")).toBe(true);
  expect(task.classList.contains("snvDemonInformationTask")).toBe(true);
  expect(within(task).getByRole("heading", { name: "악마 정보" })).toBeTruthy();
  expect(within(task).getByText("0 / 3")).toBeTruthy();
  expect(task.querySelector(".snvEvilInformationWakeInstruction")?.textContent).toContain("5번 하린");
  expect(task.querySelector(".snvEvilInformationWakeInstruction")?.textContent).toContain("깨웁니다");
  expect(within(task).getByRole("button", { name: "속임수 무작위 추천" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "정보 확정" })).toBeTruthy();
});

function renderProgress(
  currentStep: PhaseStep,
  phaseOverview: PhaseOverviewItem[],
  dayState?: PhaseControlProps["dayState"],
) {
  return render(progress(currentStep, phaseOverview, dayState));
}

function progress(
  currentStep: PhaseStep,
  phaseOverview: PhaseOverviewItem[],
  dayState?: PhaseControlProps["dayState"],
) {
  return <TroubleBrewingProgress
    {...controlProps(currentStep, phaseOverview, dayState)}
    phaseLabel={currentStep.phase === "day" ? "1일차 낮" : "1일차 밤"}
    phaseRuntime="03:12"
    theme={currentStep.phase === "day" ? "day" : "night"}
    onGoToGrimoire={vi.fn()}
  />;
}

function controlProps(
  currentStep: PhaseStep,
  phaseOverview: PhaseOverviewItem[],
  dayState?: PhaseControlProps["dayState"],
): PhaseControlProps {
  return {
    currentStep,
    phaseOverview,
    players,
    dayState,
    nominationDraft: { nominatorId: "", nomineeId: "", voterIds: [] },
    onNominationDraftChange: vi.fn(),
    phaseInputDraft: emptyPhaseInputDraft(),
    replayReady: true,
    busy: false,
    preActionRevealPending: false,
    onShowPreActionReveal: vi.fn(),
    onShowReveal: vi.fn(),
    onContinue: vi.fn(),
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    onSuggest: vi.fn(async () => ({ ok: false as const, error: { code: "UNSUPPORTED", messageKo: "추천 불가" } })),
    choiceTokenSource: () => 1,
    suggestionContextFingerprint: "fixture",
    warnings: [],
    onEndGame: vi.fn(),
    onRequestUndoGameEnd: vi.fn(),
  };
}

function emptyPhaseInputDraft(): PhaseInputDraftController {
  return {
    selectedPlayerIds: [],
    selectedCharacterId: "",
    selectedCharacterIds: [],
    zeroOutsiders: false,
    zeroOutsidersAvailable: false,
    registrationJudgments: [],
    setSelectedPlayerIds: vi.fn(),
    togglePlayer: vi.fn(),
    setSelectedCharacterId: vi.fn(),
    setSelectedCharacterIds: vi.fn(),
    setZeroOutsiders: vi.fn(),
    setSelectedNumberChoice: vi.fn(),
    setSelectedTargetChoice: vi.fn(),
    setMayorDecision: vi.fn(),
    setRegistrationJudgments: vi.fn(),
    reset: vi.fn(),
    applySuggestion: vi.fn(),
  };
}

function step(overrides: Partial<PhaseStep> & Pick<PhaseStep, "id">): PhaseStep {
  const { id, ...rest } = overrides;
  return {
    id,
    phase: "firstNight",
    stepType: "character",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    support: "automated",
    ...rest,
  };
}

function overview(stepValue: PhaseStep, status: PhaseOverviewItem["status"]): PhaseOverviewItem {
  return { ...stepValue, status };
}

function player(id: string, seat: number, name: string, character: string): Player {
  return {
    id,
    seat,
    name,
    actualCharacter: character,
    shownCharacter: character,
    alignment: character === "poisoner" || character === "spy" ? "evil" : "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
