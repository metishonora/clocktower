import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PhaseOverviewItem, PhaseStep, Player } from "../src/core/types";
import type { PhaseControlProps } from "../src/features/phase-control/PhaseControl";
import { usePhaseInputDraft, type PhaseInputDraftController } from "../src/features/phase-control/usePhaseInputDraft";
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
  expect(within(task).queryByRole("button", { name: "건너뛰기" })).toBeNull();
  expect(within(task).queryByRole("button", { name: "지명 종료" })).toBeNull();
  expect(within(task).queryByRole("button", { name: "확정" })).toBeNull();
  expect(screen.queryByRole("button", { name: "수동 게임 종료" })).toBeNull();

  const phaseOrder = screen.getByRole("list", { name: "첫날 밤 순서" });
  expect(phaseOrder.querySelectorAll(".snvPhaseOverviewAction")).toHaveLength(2);
  expect(within(phaseOrder).getByText("독살범", { exact: true })).toBeTruthy();
  expect(within(phaseOrder).getByText("세탁부", { exact: true })).toBeTruthy();
  expect(within(phaseOrder).queryByText(/\(\d+(?:,\s*\d+)*\)/)).toBeNull();
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

test("uses the S&V evil-information task shape and Reveal action for Demon bluffs", () => {
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
  expect(within(task).getByRole("button", { name: "정보 공개" })).toBeTruthy();
  expect(within(task).queryByRole("button", { name: "정보 확정" })).toBeNull();
});

test("opens evil-team information immediately, then returns to the compact S&V Reveal controls", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onShowReveal = vi.fn();
  const onContinue = vi.fn();
  const minionInformation = step({
    id: "firstNight:minionInfo",
    phase: "firstNight",
    stepType: "evilInfo",
    requiredInput: { kind: "none", optional: false },
  });
  const overviewItems = [overview(minionInformation, "current")];
  const view = renderProgress(minionInformation, overviewItems, undefined, {
    onConfirm,
    onShowReveal,
    onContinue,
  });

  await user.click(screen.getByRole("button", { name: "정보 공개" }));
  expect(onConfirm).toHaveBeenCalledWith({ input: null });

  const payload = {
    kind: "minionInformation" as const,
    demonPlayers: [{ seat: 5, name: "하린" }],
    minionPlayers: [{ seat: 4, name: "지우" }],
  };
  view.rerender(progress(minionInformation, overviewItems, undefined, {
    onConfirm,
    onShowReveal,
    onContinue,
    replayReady: true,
    pendingReveal: {
      step: minionInformation,
      confirmedEventCount: 2,
      payload,
    },
  }));

  await waitFor(() => expect(onShowReveal).toHaveBeenCalledWith(payload));
  expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  const task = screen.getByRole("region", { name: "현재 단계" });
  expect(within(task).getByRole("button", { name: "정보 공개" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "다음으로" })).toBeTruthy();

  await user.click(within(task).getByRole("button", { name: "정보 공개" }));
  expect(onShowReveal).toHaveBeenCalledTimes(2);
  await user.click(within(task).getByRole("button", { name: "다음으로" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test("shows an impaired actor badge before choosing information targets", () => {
  const washerwoman = step({
    id: "firstNight:washerwoman",
    phase: "firstNight",
    character: "washerwoman",
    playerId: "player-1",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      allowedPlayerIds: players.map(({ id }) => id),
      allowedCharacterIds: ["chef"],
      optional: false,
    },
    informationPrompt: {
      ...informationPrompt([{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }]),
      setupInfoRegistrationOptions: [{ playerId: "player-7", registeredAs: "townsfolk", characterIds: ["chef"] }],
    },
  });

  renderProgress(washerwoman, [overview(washerwoman, "current")], undefined, {
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      activeImpairments: [{
        kind: "poisoned",
        playerId: "player-1",
        sourceEventId: "poison-1",
        sourceCharacterId: "poisoner",
        expires: "whileSourceAbilityActive",
      }],
    },
  });

  const actor = screen.getByLabelText("현재 행동자");
  expect(within(actor).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(screen.getByLabelText("세탁부 행동자 상태").textContent).toBe("중독");
  expect(screen.getByRole("button", { name: /대상 선택/ })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "보여줄 캐릭터" })).toBeTruthy();
  expect(screen.queryByText("등록 판정")).toBeNull();
  expect(screen.queryByRole("button", { name: "무작위 추천" })).toBeNull();
  expect(screen.queryByLabelText("필요한 입력")).toBeNull();
});

test("summarizes confirmed setup information and marks the first poisoned reveal action", () => {
  const washerwoman = step({
    id: "firstNight:washerwoman",
    phase: "firstNight",
    character: "washerwoman",
    playerId: "player-1",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
      optional: false,
    },
    informationPrompt: {
      ...informationPrompt([{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }]),
      setupInfoRegistrationOptions: [{ playerId: "player-7", registeredAs: "townsfolk", characterIds: ["chef"] }],
    },
  });
  const onShowReveal = vi.fn();
  renderProgress(washerwoman, [overview(washerwoman, "needsFollowUp")], undefined, {
    pendingReveal: {
      step: washerwoman,
      confirmedEventCount: 12,
      payload: {
        kind: "setupInformation",
        characterId: "washerwoman",
        candidatePlayers: [
          { playerId: "player-2", seat: 2, name: "서연" },
          { playerId: "player-7", seat: 7, name: "현우" },
        ],
        revealedCharacterId: "chef",
        zeroOutsiders: false,
      },
    },
    replayReady: false,
    onShowReveal,
  });

  const task = screen.getByRole("region", { name: "세탁부 정보" });
  expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  expect(within(task).getByText("2번 서연 · 7번 현우")).toBeTruthy();
  expect(within(task).getByRole("group", { name: "전달할 정보" }).textContent).toContain("요리사");
  const reveal = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(reveal.classList.contains("poisoned")).toBe(true);
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
});

test("summarizes Librarian zero outsiders as a target without requiring target selection", () => {
  const librarian = step({
    id: "firstNight:librarian",
    phase: "firstNight",
    character: "librarian",
    playerId: "player-2",
  });
  renderProgress(librarian, [overview(librarian, "needsFollowUp")], undefined, {
    pendingReveal: {
      step: librarian,
      confirmedEventCount: 14,
      payload: { kind: "setupInformation", characterId: "librarian", candidatePlayers: [], zeroOutsiders: true },
    },
  });

  const summary = screen.getByRole("group", { name: "전달할 정보" });
  expect(within(summary).getByText("대상").nextElementSibling?.textContent).toBe("외지인 없음");
  expect(within(summary).queryByText("진실")).toBeNull();
  expect(screen.getByRole("button", { name: "정보 공개" })).toBeTruthy();
});

test("offers a fixed Chef truth for immediate information reveal without a truth-selection click", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const chef = step({
    id: "firstNight:chef",
    phase: "firstNight",
    character: "chef",
    playerId: "player-2",
    requiredInput: { kind: "number", target: "number", optional: false },
    informationPrompt: {
      ...informationPrompt([]),
      computedResult: { kind: "number", value: 2 },
      numberChoices: [{ value: 2, isComputed: true, registrationJudgments: [] }],
    },
  });
  renderProgress(chef, [overview(chef, "current")], undefined, { onConfirm });

  const truth = screen.getByRole("group", { name: "정보 결과" });
  expect(within(truth).getByText("진실").nextElementSibling?.textContent).toBe("2쌍");
  expect(screen.queryByLabelText("전달 정보")).toBeNull();
  const reveal = screen.getByRole("button", { name: "정보 공개" });
  expect((reveal as HTMLButtonElement).disabled).toBe(false);
  await user.click(reveal);
  expect(onConfirm).toHaveBeenCalledWith({ input: null });
});

test("shows poisoned Chef truth separately and defaults free-form delivery to zero", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const chef = step({
    id: "firstNight:chef",
    phase: "firstNight",
    character: "chef",
    playerId: "player-2",
    requiredInput: { kind: "number", target: "number", optional: false },
    informationPrompt: {
      ...informationPrompt([{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }]),
      computedResult: { kind: "number", value: 1 },
      numberConstraint: { min: 0, max: Number.MAX_SAFE_INTEGER, excludedValues: [] },
    },
  });
  renderProgress(chef, [overview(chef, "current")], undefined, { onConfirm });

  const information = screen.getByRole("group", { name: "정보 결과" });
  expect(within(information).getByText("진실").nextElementSibling?.textContent).toBe("1쌍");
  expect((within(information).getByRole("spinbutton", { name: "전달할 숫자" }) as HTMLInputElement).value).toBe("0");
  const reveal = screen.getByRole("button", { name: "중독 정보 공개" });
  expect(reveal.classList.contains("poisoned")).toBe(true);
  await user.click(reveal);
  expect(onConfirm).toHaveBeenCalledWith({ input: null, deliveredResult: { kind: "number", value: 0 } });
});

test("skips target selection for a Librarian zero-outsider result", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const librarian = step({
    id: "firstNight:librarian",
    phase: "firstNight",
    character: "librarian",
    playerId: "player-2",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      allowedPlayerIds: players.map(({ id }) => id),
      allowedCharacterIds: ["recluse"],
      zeroAllowed: true,
      optional: false,
    },
    informationPrompt: informationPrompt([]),
  });
  renderProgress(librarian, [overview(librarian, "current")], undefined, {
    phaseInputDraft: { ...emptyPhaseInputDraft(), zeroOutsiders: true, zeroOutsidersAvailable: true },
    onConfirm,
  });

  const information = screen.getByRole("group", { name: "정보 결과" });
  expect(within(information).getByText("대상").nextElementSibling?.textContent).toBe("외지인 없음");
  expect(screen.queryByRole("button", { name: /대상 선택/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "정보 공개" }));
  expect(onConfirm).toHaveBeenCalledWith({ input: { zeroOutsiders: true } });
});

test("defaults a healthy Librarian to zero outsiders only when the actual roster has none", async () => {
  const librarian = step({
    id: "firstNight:librarian",
    character: "librarian",
    playerId: "player-2",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      zeroAllowed: true,
      optional: false,
    },
    informationPrompt: informationPrompt([]),
  });
  const { result } = renderHook(() => usePhaseInputDraft(librarian, players));
  await waitFor(() => expect(result.current.zeroOutsiders).toBe(true));

  const rosterWithOutsider = players.map((candidate) => candidate.id === "player-7"
    ? { ...candidate, actualCharacter: "recluse", shownCharacter: "recluse" }
    : candidate);
  const poisoned = { ...librarian, informationPrompt: informationPrompt([{ type: "poisoned" as const, poisonerPlayerId: "player-4", poisonEventId: "poison-1" }]) };
  const poisonedDraft = renderHook(() => usePhaseInputDraft(poisoned, rosterWithOutsider));
  await waitFor(() => expect(poisonedDraft.result.current.zeroOutsidersAvailable).toBe(true));
  expect(poisonedDraft.result.current.zeroOutsiders).toBe(false);
});

function renderProgress(
  currentStep: PhaseStep,
  phaseOverview: PhaseOverviewItem[],
  dayState?: PhaseControlProps["dayState"],
  overrides?: Partial<PhaseControlProps>,
) {
  return render(progress(currentStep, phaseOverview, dayState, overrides));
}

function progress(
  currentStep: PhaseStep,
  phaseOverview: PhaseOverviewItem[],
  dayState?: PhaseControlProps["dayState"],
  overrides?: Partial<PhaseControlProps>,
) {
  return <TroubleBrewingProgress
    {...controlProps(currentStep, phaseOverview, dayState)}
    {...overrides}
    phaseLabel={currentStep.phase === "day" ? "1일차 낮" : "1일차 밤"}
    phaseRuntime="03:12"
    theme={currentStep.phase === "day" ? "day" : "night"}
    onGoToGrimoire={vi.fn()}
  />;
}

function informationPrompt(activeReasons: NonNullable<PhaseStep["informationPrompt"]>["activeReasons"]): NonNullable<PhaseStep["informationPrompt"]> {
  return {
    deliveryMode: activeReasons.length ? "selectable" : "fixed",
    activeReasons,
    registrationCandidatePlayerIds: [],
    numberChoices: [],
    setupInfoRegistrationOptions: [],
  };
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
