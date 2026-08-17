import { useState } from "react";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { NumberChoice, PhaseOverviewItem, PhaseStep, Player, RegistrationJudgment, RevealPayload } from "../src/core/types";
import type { PhaseControlProps } from "../src/features/phase-control/PhaseControl";
import { usePhaseInputDraft, type PhaseInputDraftController } from "../src/features/phase-control/usePhaseInputDraft";
import { TroubleBrewingProgress } from "../src/features/trouble-brewing/TroubleBrewingProgress";
import { abilityPresentationForStep } from "../src/features/phase-control/actingRoleContext";
import { TroubleBrewingScalarInformationEditor } from "../src/features/trouble-brewing/TroubleBrewingScalarInformationEditor";

const players: Player[] = [
  player("player-1", 1, "민지", "washerwoman"),
  player("player-2", 2, "서연", "fortuneTeller"),
  player("player-4", 4, "지우", "poisoner"),
  player("player-5", 5, "하린", "imp"),
  player("player-7", 7, "현우", "spy"),
];

const drunkPlayers: Player[] = [
  ...players,
  { ...player("player-6", 6, "도윤", "drunk"), shownCharacter: "washerwoman" },
];

test("resolves shown ability only for the step's actor and a changed identity", () => {
  const drunkWasherwoman = drunkWasherwomanStep();
  const drunk = drunkPlayers.find((candidate) => candidate.id === "player-6")!;
  expect(abilityPresentationForStep(drunkWasherwoman, drunk)).toEqual({
    kind: "shown",
    abilityCharacterId: "washerwoman",
  });
  expect(abilityPresentationForStep(drunkWasherwoman, { ...drunk, id: "other" })).toBeUndefined();
  expect(abilityPresentationForStep(drunkWasherwoman, { ...drunk, shownCharacter: "drunk" })).toBeUndefined();
});

test("uses the domain treatment choice when a legacy duplicate player id makes the visible alignment ambiguous", async () => {
  const user = userEvent.setup();
  const sharedPlayers = [
    player("chef", 1, "Chef", "chef"),
    player("shared", 2, "Recluse", "recluse"),
    player("imp", 3, "Imp", "imp"),
    player("shared", 4, "Spy", "spy"),
    player("empath", 5, "Empath", "empath"),
  ];
  const chef = step({
    id: "firstNight:chef",
    character: "chef",
    playerId: "chef",
    requiredInput: { kind: "number", target: "number", optional: false },
    informationPrompt: {
      computedResult: { kind: "number", value: 1 },
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: ["shared"],
      numberChoices: [
        {
          value: 0,
          isComputed: false,
          registrationJudgments: [{ playerId: "shared", registeredAs: "good" }],
        },
        { value: 1, isComputed: true, registrationJudgments: [] },
        {
          value: 2,
          isComputed: false,
          registrationJudgments: [{ playerId: "shared", registeredAs: "evil" }],
        },
      ],
      setupInfoRegistrationOptions: [],
    },
  });

  render(<ScalarEditorHarness stepValue={chef} playerRoster={sharedPlayers} />);
  const treatment = screen.getByRole("group", { name: "이번 판정의 은둔자 취급" });
  const [good, evil] = within(treatment).getAllByRole("button");
  expect([good.textContent, evil.textContent]).toEqual(["선", "악"]);
  expect(good.classList.contains("alignment-good")).toBe(true);
  expect(evil.classList.contains("alignment-evil")).toBe(true);
  await user.click(good);

  expect(good.getAttribute("aria-pressed")).toBe("true");
  expect(good.classList.contains("selected")).toBe(true);
  expect(within(screen.getByRole("group", { name: "정보 결과" })).getByText("0쌍")).toBeTruthy();
});

test("keeps every registration treatment in good-then-evil order with concise labels", () => {
  const character = "chef";
  const treatmentStep = step({
    id: `firstNight:${character}`,
    character,
    playerId: character,
    requiredInput: { kind: "number", target: "number", optional: false },
    informationPrompt: {
      computedResult: { kind: "number", value: 0 },
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: ["recluse", "spy"],
      numberChoices: [{ value: 0, isComputed: true, registrationJudgments: [] }],
      setupInfoRegistrationOptions: [],
    },
  });
  const playerRoster = [
    player(character, 1, character, character),
    player("recluse", 2, "Recluse", "recluse"),
    player("spy", 3, "Spy", "spy"),
  ];

  render(<ScalarEditorHarness stepValue={treatmentStep} playerRoster={playerRoster} />);

  for (const groupName of ["이번 판정의 은둔자 취급", "이번 판정의 첩자 취급"]) {
    const buttons = within(screen.getByRole("group", { name: groupName })).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["선", "악"]);
    expect(buttons[0]?.classList.contains("alignment-good")).toBe(true);
    expect(buttons[1]?.classList.contains("alignment-evil")).toBe(true);
  }
  expect(screen.queryByText(/팀으로 취급/)).toBeNull();
});

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

test("keeps reference Grimoire navigation separate from explicit target selection", async () => {
  const user = userEvent.setup();
  const onOpenReferenceGrimoire = vi.fn();
  const onStartGrimoireSelection = vi.fn();
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
      optional: false,
    },
  });

  render(<TroubleBrewingProgress
    {...controlProps(currentStep, [overview(currentStep, "current")])}
    phaseLabel="1일차 밤"
    phaseRuntime="03:12"
    theme="night"
    onOpenReferenceGrimoire={onOpenReferenceGrimoire}
    onStartGrimoireSelection={onStartGrimoireSelection}
  />);

  await user.click(screen.getByRole("button", { name: "마도서로 이동" }));
  expect(onOpenReferenceGrimoire).toHaveBeenCalledOnce();
  expect(onStartGrimoireSelection).not.toHaveBeenCalled();

  await user.click(within(screen.getByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: "대상 선택" }));
  expect(onStartGrimoireSelection).toHaveBeenCalledOnce();
  expect(onOpenReferenceGrimoire).toHaveBeenCalledOnce();
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

test("collapses every completed and current nomination round into one phase entry", () => {
  const nominationOne = step({
    id: "day1:nomination:1",
    phase: "day",
    stepType: "nomination",
    requiredInput: { kind: "nomination", target: "nomination", optional: true },
    canSkip: true,
  });
  const voteOne = step({
    id: "day1:nomination:1:vote",
    phase: "day",
    stepType: "nomination",
    requiredInput: { kind: "nominationVote", target: "players", optional: false },
  });
  const nominationTwo = step({
    id: "day1:nomination:2",
    phase: "day",
    stepType: "nomination",
    requiredInput: { kind: "nomination", target: "nomination", optional: true },
    canSkip: true,
  });

  renderProgress(nominationTwo, [
    overview(nominationOne, "complete"),
    overview(voteOne, "complete"),
    overview(nominationTwo, "current"),
  ], {
    nominations: [],
    eligibleNominatorIds: players.map(({ id }) => id),
    eligibleNomineeIds: players.map(({ id }) => id),
    executionVoteThreshold: 2,
    highestVoteCount: 0,
  });

  const phaseOrder = screen.getByRole("list", { name: "1일차 낮 순서" });
  expect(within(phaseOrder).getAllByText("지목 및 투표", { exact: true })).toHaveLength(1);
  expect(phaseOrder.querySelectorAll("li")).toHaveLength(1);
  expect(within(phaseOrder).queryByText(/지목 및 투표 \d/)).toBeNull();
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
  const wakeInstruction = task.querySelector(".snvEvilInformationWakeInstruction");
  expect(wakeInstruction?.children).toHaveLength(2);
  expect(wakeInstruction?.children[0]?.textContent).toBe("속임수를 선택하고,");
  expect(wakeInstruction?.children[1]?.textContent).toBe("5번 하린을 깨우십시오");
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

test("keeps the Spy task in place while its direct Grimoire Reveal is being prepared", () => {
  const spy = step({
    id: "firstNight:spy",
    phase: "firstNight",
    character: "spy",
    playerId: "player-7",
    requiredInput: { kind: "none", optional: false },
  });
  const onShowReveal = vi.fn();

  renderProgress(spy, [overview(spy, "needsFollowUp")], undefined, {
    pendingReveal: {
      step: spy,
      confirmedEventCount: 12,
      payload: spyGrimoirePayload(),
    },
    replayReady: false,
    busy: true,
    onShowReveal,
  });

  const task = screen.queryByRole("region", { name: "현재 단계" });
  expect.soft(task).not.toBeNull();
  if (task) expect(within(task).getByRole("heading", { name: "첩자: 7번 현우" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "첩자 정보" })).toBeNull();
  expect(screen.queryByRole("button", { name: "마도서 다시 공개" })).toBeNull();
  expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  expect(onShowReveal).not.toHaveBeenCalled();
});

test("uses the common poisoned Spy badge and poisoned Reveal actions before and after review", () => {
  const spy = step({
    id: "firstNight:spy",
    phase: "firstNight",
    character: "spy",
    playerId: "player-7",
    requiredInput: { kind: "none", optional: false },
  });
  const poisonedRuleState = {
    unannouncedNightDeathPlayerIds: [],
    activeImpairments: [{
      kind: "poisoned" as const,
      playerId: "player-7",
      sourceEventId: "poison-1",
      sourceCharacterId: "poisoner",
      expires: "whileSourceAbilityActive" as const,
    }],
  };
  const view = renderProgress(spy, [overview(spy, "current")], undefined, {
    ruleState: poisonedRuleState,
  });

  const initialTask = screen.getByRole("region", { name: "현재 단계" });
  const initialBadge = within(within(initialTask).getByLabelText("정보 영향"))
    .getByText("중독", { exact: true });
  expect(initialBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(initialBadge.classList.contains("poisoned")).toBe(true);
  const initialReveal = within(initialTask).queryByRole("button", { name: "중독 정보 공개" });
  expect.soft(initialReveal).not.toBeNull();
  expect.soft(initialReveal?.classList.contains("poisoned")).toBe(true);

  view.rerender(progress(spy, [overview(spy, "needsFollowUp")], undefined, {
    ruleState: poisonedRuleState,
    pendingReveal: {
      step: spy,
      confirmedEventCount: 12,
      payload: spyGrimoirePayload(),
    },
    replayReady: true,
  }));

  const reviewedTask = screen.getByRole("region", { name: "첩자 정보" });
  const reviewedBadge = within(within(reviewedTask).getByLabelText("정보 영향"))
    .getByText("중독", { exact: true });
  expect(reviewedBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(reviewedBadge.classList.contains("poisoned")).toBe(true);
  const reviewedReveal = within(reviewedTask).queryByRole("button", { name: "중독 마도서 다시 공개" });
  expect.soft(reviewedReveal).not.toBeNull();
  expect.soft(reviewedReveal?.classList.contains("poisoned")).toBe(true);
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
  const actorInfluence = within(actor).getByLabelText("정보 영향");
  const actorBadge = within(actorInfluence).getByText("중독", { exact: true });
  expect(actorBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(actorBadge.classList.contains("poisoned")).toBe(true);

  const phaseOverview = screen.getByRole("list", { name: "첫날 밤 순서" });
  const overviewInfluence = within(phaseOverview).getByLabelText("세탁부 행동자 상태");
  const overviewBadge = within(overviewInfluence).getByText("중독", { exact: true });
  expect(overviewBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(overviewBadge.classList.contains("poisoned")).toBe(true);
  expect(screen.getByRole("button", { name: "대상 선택" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "보여줄 캐릭터" })).toBeTruthy();
  expect(screen.queryByText("등록 판정")).toBeNull();
  expect(screen.queryByRole("button", { name: "무작위 추천" })).toBeNull();
  expect(screen.queryByLabelText("필요한 입력")).toBeNull();
});

test("presents a drunk actor as the primary identity with a nested Washerwoman ability", () => {
  const drunkWasherwoman = drunkWasherwomanStep();
  renderProgress(drunkWasherwoman, [overview(drunkWasherwoman, "current")], undefined, {
    players: drunkPlayers,
    ruleState: drunkRuleState(),
  });

  const task = screen.getByRole("region", { name: "현재 단계" });
  expect(within(task).getByRole("heading", { name: "주정뱅이" })).toBeTruthy();
  const shownAbility = within(task).getByRole("region", { name: "보여준 직업 · 세탁부" });
  expect(within(shownAbility).getByRole("heading", { name: "세탁부" })).toBeTruthy();
  expect(within(shownAbility).getByText(/게임 시작 시.*특정 주민/)).toBeTruthy();
  expect(within(shownAbility).queryByText("취함", { exact: true })).toBeNull();
  const actorBadge = within(within(task).getByLabelText("정보 영향")).getByText("취함", { exact: true });
  expect(actorBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(actorBadge.classList.contains("drunk")).toBe(true);
  const overviewBadge = within(screen.getByLabelText("주정뱅이 · 세탁부 행동자 상태"))
    .getByText("취함", { exact: true });
  expect(overviewBadge.classList.contains("snvInformationInfluenceBadge")).toBe(true);
  expect(overviewBadge.classList.contains("drunk")).toBe(true);
  expect(within(task).queryByText("실제 주정뱅이")).toBeNull();
  expect(within(task).getByRole("button", { name: "대상 선택" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "첫날 밤 순서" }).textContent).toContain("주정뱅이 · 세탁부");
});

test("keeps the drunk identity hierarchy in the Washerwoman Reveal follow-up", () => {
  const drunkWasherwoman = drunkWasherwomanStep();
  renderProgress(drunkWasherwoman, [overview(drunkWasherwoman, "needsFollowUp")], undefined, {
    players: drunkPlayers,
    ruleState: drunkRuleState(),
    pendingReveal: {
      step: drunkWasherwoman,
      confirmedEventCount: 18,
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
  });

  const task = screen.getByRole("region", { name: "세탁부 정보" });
  expect(within(task).getByRole("heading", { name: "주정뱅이" })).toBeTruthy();
  const shownAbility = within(task).getByRole("region", { name: "보여준 직업 · 세탁부" });
  expect(within(shownAbility).getByRole("heading", { name: "세탁부" })).toBeTruthy();
  expect(within(shownAbility).getByText(/게임 시작 시.*특정 주민/)).toBeTruthy();
  expect(within(shownAbility).queryByText("취함", { exact: true })).toBeNull();
  expect(within(within(task).getByLabelText("정보 영향")).getByText("취함", { exact: true })).toBeTruthy();
  expect(within(task).queryByText("실제 주정뱅이")).toBeNull();
  expect(within(task).getByRole("button", { name: "취한 정보 공개" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
});

test("keeps the Washerwoman information context visible and locked after a poisoned Reveal", () => {
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
  expect(within(task).queryByRole("group", { name: "전달할 정보" })).toBeNull();
  expect(within(task).getByText("2번 서연 · 7번 현우")).toBeTruthy();
  const picker = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(picker.value).toBe("chef");
  expect(picker.disabled).toBe(true);
  const reveal = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(reveal.classList.contains("poisoned")).toBe(true);
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
});

test("keeps the Librarian zero-outsider context visible and locked after Reveal", () => {
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
      characterKind: "Outsider",
      zeroAllowed: true,
      optional: false,
    },
  });
  renderProgress(librarian, [overview(librarian, "needsFollowUp")], undefined, {
    pendingReveal: {
      step: librarian,
      confirmedEventCount: 14,
      payload: { kind: "setupInformation", characterId: "librarian", candidatePlayers: [], zeroOutsiders: true },
    },
  });

  const task = screen.getByRole("region", { name: "사서 정보" });
  expect(within(task).queryByRole("group", { name: "전달할 정보" })).toBeNull();
  const result = within(task).getByRole("group", { name: "정보 결과" });
  expect(within(result).getByText("외지인 없음")).toBeTruthy();
  const picker = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(picker.value).toBe("__zero_outsiders__");
  expect(picker.disabled).toBe(true);
  expect(within(task).getByRole("button", { name: "정보 공개" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
});

test("keeps the Fortune Teller information follow-up compact after a poisoned Reveal", () => {
  const fortuneTeller = step({
    id: "firstNight:fortuneTeller",
    phase: "firstNight",
    character: "fortuneTeller",
    playerId: "player-2",
    requiredInput: {
      kind: "playerIds",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      allowedPlayerIds: players.map(({ id }) => id),
      optional: false,
    },
    informationPrompt: informationPrompt([{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }]),
  });

  renderProgress(fortuneTeller, [overview(fortuneTeller, "needsFollowUp")], undefined, {
    pendingReveal: {
      step: fortuneTeller,
      confirmedEventCount: 16,
      payload: {
        kind: "fortuneTellerInformation",
        targetPlayers: [
          { playerId: "player-3", seat: 3, name: "서연" },
          { playerId: "player-5", seat: 5, name: "하린" },
        ],
        hasDemon: true,
      },
    },
  });

  const task = screen.getByRole("region", { name: "점쟁이 정보" });
  expect(within(task).queryByRole("group", { name: "전달할 정보" })).toBeNull();
  expect(within(task).queryByText("3번 서연 · 5번 하린", { exact: true })).toBeNull();
  expect(within(task).queryByText("있음", { exact: true })).toBeNull();
  expect(within(task).getByRole("button", { name: "중독 정보 공개" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
});

test("hides the Washerwoman Grimoire target button after two valid targets are selected", () => {
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
      ...informationPrompt([]),
      setupInfoRegistrationOptions: [{ playerId: "player-7", registeredAs: "townsfolk", characterIds: ["chef"] }],
    },
  });

  renderProgress(washerwoman, [overview(washerwoman, "current")], undefined, {
    phaseInputDraft: {
      ...emptyPhaseInputDraft(),
      selectedPlayerIds: ["player-2", "player-7"],
      selectedCharacterId: "chef",
    },
  });

  const task = screen.getByRole("region", { name: "현재 단계" });
  expect(within(task).queryByRole("button", { name: "← 대상 선택" })).toBeNull();
  const selectedTargets = within(task).getByLabelText("선택한 대상");
  expect(selectedTargets.textContent).toContain("2번 서연");
  expect(selectedTargets.textContent).toContain("7번 현우");
  expect(within(task).getByRole("combobox", { name: "보여줄 캐릭터" })).toBeTruthy();
  expect(within(task).getByRole("button", { name: "정보 공개" })).toBeTruthy();
});

test("offers a fixed Chef result for immediate information reveal without a selection click", async () => {
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

  const result = screen.getByRole("group", { name: "정보 결과" });
  expect(within(result).getByText("결과").nextElementSibling?.textContent).toBe("2쌍");
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
  renderProgress(chef, [overview(chef, "current")], undefined, {
    onConfirm,
    phaseInputDraft: {
      ...emptyPhaseInputDraft(),
      selectedNumberChoice: { value: 0, isComputed: false, registrationJudgments: [] },
    },
  });

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
      characterKind: "Outsider",
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

function ScalarEditorHarness({
  stepValue,
  playerRoster,
}: {
  stepValue: PhaseStep;
  playerRoster: Player[];
}) {
  const [selectedNumberChoice, setSelectedNumberChoice] = useState<NumberChoice>();
  const [registrationJudgments, setRegistrationJudgments] = useState<RegistrationJudgment[]>([]);
  return <TroubleBrewingScalarInformationEditor
    step={stepValue}
    players={playerRoster}
    selectedNumberChoice={selectedNumberChoice}
    registrationJudgments={registrationJudgments}
    busy={false}
    onNumberChoiceChange={setSelectedNumberChoice}
    onRegistrationJudgmentsChange={setRegistrationJudgments}
  />;
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
    onOpenReferenceGrimoire={vi.fn()}
    onStartGrimoireSelection={vi.fn()}
  />;
}

function drunkWasherwomanStep(): PhaseStep {
  return step({
    id: "firstNight:washerwoman",
    phase: "firstNight",
    character: "washerwoman",
    playerId: "player-6",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      allowedPlayerIds: drunkPlayers.map(({ id }) => id),
      allowedCharacterIds: ["chef"],
      optional: false,
    },
    informationPrompt: informationPrompt([{ type: "drunk" }]),
  });
}

function drunkRuleState(): NonNullable<PhaseControlProps["ruleState"]> {
  return {
    unannouncedNightDeathPlayerIds: [],
    activeImpairments: [{
      kind: "drunk",
      playerId: "player-6",
      sourceEventId: "setup",
      sourceCharacterId: "drunk",
      expires: "never",
    }],
  };
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

function spyGrimoirePayload(): Extract<RevealPayload, { kind: "spyGrimoire" }> {
  return {
    kind: "spyGrimoire",
    players: players.map((candidate) => ({
      playerId: candidate.id,
      seat: candidate.seat,
      name: candidate.name,
      characterId: candidate.actualCharacter,
      alive: candidate.alive,
      ghostVoteUsed: candidate.ghostVoteUsed,
      reminderTokens: [],
    })),
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
