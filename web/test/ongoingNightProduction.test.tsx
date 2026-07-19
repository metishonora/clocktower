import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {
  GameEvent,
  GameFile,
  InformationPrompt,
  PhaseStep,
  Player,
  Proposal,
  ReplayState,
} from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  gameFile,
  players,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

describe("ongoing-night production UI", () => {
  test("renders replay-derived poison and protection as distinct read-only Grimoire badges", async () => {
    const currentStep = step({
      id: "night1:imp",
      phase: "night",
      character: "imp",
      playerId: "player-5",
    });
    const playerRoster = koreanPlayers();
    const initialReplay = replayWithRuleState(
      replayState({ currentStep, playerRoster }),
      {
        activePoison: {
          playerId: "player-2",
          sourcePlayerId: "player-4",
          sourceEventId: "event-poison",
        },
        activeProtection: {
          playerId: "player-3",
          sourcePlayerId: "player-1",
          sourceEventId: "event-protection",
        },
        unannouncedNightDeathPlayerIds: [],
      },
    );
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal: initialReplay,
      proposal: proposal(phaseEvent("unused", "unused")),
    });

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "임프: 5번 하린" });
    const grimoire = screen.getByLabelText("라이브 그리모어 좌석 맵");
    const poisonedSeat = within(grimoire).getByRole("button", { name: /2.*민준|민준/ });
    const protectedSeat = within(grimoire).getByRole("button", { name: /3.*서연|서연/ });
    const poisonBadge = within(poisonedSeat).getByText("중독");
    const protectionBadge = within(protectedSeat).getByText("보호");

    expect(poisonBadge.className).toMatch(/poison/i);
    expect(protectionBadge.className).toMatch(/protect/i);
    expect(poisonBadge.className).not.toBe(protectionBadge.className);
    expect(poisonBadge.tagName).not.toBe("BUTTON");
    expect(protectionBadge.tagName).not.toBe("BUTTON");
  });

  test("uses the Red Herring allowlist and automatically submits the Spy's Good-registration witness without rationale copy", async () => {
    const playerRoster = koreanPlayers().map((player) =>
      player.id === "player-4"
        ? { ...player, actualCharacter: "spy", shownCharacter: "spy" }
        : player,
    );
    const currentStep = ongoingStep(
      step({
        id: "firstNight:fortuneTellerRedHerring",
        phase: "firstNight",
        stepType: "character",
        character: "fortuneTeller",
        playerId: "player-1",
        kind: "playerIds",
        target: "player",
        minSelections: 1,
        maxSelections: 1,
      }),
      {
        stepType: "redHerringAssignment",
        allowedPlayerIds: ["player-2", "player-4"],
        playerRegistrationOptions: [
          { playerId: "player-4", registeredAs: "good" },
        ],
      },
    );
    const nextStep = step({ id: "firstNight:fortuneTeller", character: "fortuneTeller", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      proposal: proposal(redHerringEvent()),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const input = await screen.findByLabelText("단계 입력");
    const spy = within(input).getByRole("button", { name: /도윤/ }) as HTMLButtonElement;
    const disallowedImp = within(input).getByRole("button", { name: /하린/ }) as HTMLButtonElement;
    expect(spy.disabled).toBe(false);
    expect(disallowedImp.disabled).toBe(true);
    expect(screen.queryByText(/등록 판정|선한 팀으로 등록|스파이.*등록/)).toBeNull();

    await user.click(spy);
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:fortuneTellerRedHerring",
        input: { playerIds: ["player-4"] },
        registrationJudgments: [
          { playerId: "player-4", registeredAs: "good" },
        ],
      },
    });
  });

  test.each([
    {
      outcome: { kind: "prevented", reason: "monkProtection", sourceEventId: "event-protection" },
      summary: "임프 공격: 3번 서연 · 사망 없음 (수도승 보호)",
      expected: "3번 서연 - 수도승에 의해 보호됨",
      warning: {
        code: "DEMON_ATTACK_PREVENTED",
        severity: "warning" as const,
        messageKo: "수도승 보호로 사망하지 않았습니다.",
      },
    },
    {
      outcome: { kind: "death", playerId: "player-5" },
      summary: "임프 공격: 5번 하린 · 사망",
      expected: "5번 하린 - 사망",
      warning: undefined,
    },
  ])("renders only the concise Imp outcome line: $expected", async ({ outcome, summary, expected, warning }) => {
    const playerRoster = koreanPlayers();
    const currentStep = ongoingStep(
      step({
        id: "night1:imp",
        phase: "night",
        character: "imp",
        playerId: "player-5",
        kind: "playerIds",
        target: "player",
        minSelections: 1,
        maxSelections: 1,
      }),
      { allowedPlayerIds: playerRoster.map((player) => player.id) },
    );
    const nextStep = step({ id: "night1:empath", phase: "night", character: "empath", playerId: "player-2" });
    const canonicalEvent = nightActionEvent(summary, outcome);
    const result = proposal(canonicalEvent) as Proposal;
    result.warnings = warning ? [warning] : [];
    result.followUpSteps = [];
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      proposal: result,
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const input = await screen.findByLabelText("단계 입력");
    const targetName = outcome.kind === "death" ? /하린/ : /서연/;
    await user.click(within(input).getByRole("button", { name: targetName }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    const actionResult = await screen.findByLabelText("밤 행동 결과");
    expect(within(actionResult).getByText(expected)).toBeTruthy();
    expect(within(actionResult).queryByText(summary)).toBeNull();
    expect(within(actionResult).queryByText(/DEMON_ATTACK|ravenkeeperReveal|레이븐키퍼 후속|사망 없음/)).toBeNull();
  });

  test("freezes Grimoire editing after a Fortune Teller pair is confirmed and shows only the approved result/Reveal controls", async () => {
    const playerRoster = koreanPlayers().map((player) =>
      player.id === "player-1" ? { ...player, actualCharacter: "drunk", shownCharacter: "fortuneTeller" } : player,
    );
    const targetCheck = {
      targetPlayerIds: ["player-3", "player-5"],
      computedResult: { kind: "boolean", value: true },
      choices: [
        {
          result: { kind: "boolean", value: true },
          isComputed: true,
          registrationJudgments: [],
        },
      ],
    };
    const currentStep = ongoingStep(
      step({
        id: "night1:fortuneTeller",
        phase: "night",
        character: "fortuneTeller",
        playerId: "player-1",
        kind: "playerIds",
        target: "players",
        minSelections: 2,
        maxSelections: 2,
      }),
      {
        allowedPlayerIds: playerRoster.map((player) => player.id),
        informationPrompt: ongoingPrompt([targetCheck]),
      },
    );
    const nextStep = step({ id: "night1:undertaker", phase: "night", character: "undertaker", playerId: "player-2" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      proposal: proposal(phaseEvent("event-ft", "점쟁이 정보 확정", "night"), {
        kind: "fortuneTellerInformation",
        targetPlayers: [
          { playerId: "player-3", seat: 3, name: "서연" },
          { playerId: "player-5", seat: 5, name: "하린" },
        ],
        hasDemon: true,
      }),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    expect(await screen.findByText("실제 술꾼")).toBeTruthy();
    const input = await screen.findByLabelText("단계 입력");
    await user.click(within(input).getByRole("button", { name: /서연/ }));
    await user.click(within(input).getByRole("button", { name: /하린/ }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    const result = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(within(result).getByText("점쟁이 정보")).toBeTruthy();
    expect(within(result).getByRole("button", { name: "플레이어에게 공개" })).toBeTruthy();
    expect(within(result).queryByText(/정보 전달|계산값|2명/)).toBeNull();
    await user.click(within(result).getByRole("button", { name: "플레이어에게 공개" }));
    const reveal = screen.getByLabelText("플레이어 공개 화면");
    expect(within(reveal).getByText("이 중에 악마는…")).toBeTruthy();
    expect(within(reveal).getByText("있음")).toBeTruthy();
    expect(within(reveal).getByText("서연")).toBeTruthy();
    expect(within(reveal).getByText("하린")).toBeTruthy();
    await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
    expect(screen.queryByRole("button", { name: "위치 조정" })).toBeNull();
  });

  test("confirms an empty following-Day death announcement explicitly and advances", async () => {
    const playerRoster = koreanPlayers();
    const currentStep = step({
      id: "day2:announceDeaths",
      phase: "day",
      stepType: "announcement",
    });
    const nextStep = step({
      id: "day2:whisper",
      phase: "day",
      stepType: "whisper",
    });
    const initialReplay = replayWithRuleState(
      replayState({ currentStep, playerRoster }),
      { unannouncedNightDeathPlayerIds: [] },
    );
    const replayAfterProposal = replayWithRuleState(
      replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      { unannouncedNightDeathPlayerIds: [] },
    );
    const canonicalEvent = nightDeathsAnnouncedEvent([]);
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal,
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    const announcement = await screen.findByLabelText("밤 사망 발표");
    expect(within(announcement).getByText("사망자 없음")).toBeTruthy();
    expect(within(announcement).queryByRole("img", { name: "사망" })).toBeNull();
    const playerStatusesBefore = within(screen.getByLabelText("라이브 그리모어 좌석 맵"))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

    await user.click(screen.getByRole("button", { name: "사망자 없음 발표 확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: { stepId: "day2:announceDeaths", input: null },
    });
    await waitFor(() => {
      expect(storage.savedGames.at(-1)?.game.events.at(-1)).toEqual(canonicalEvent);
    });
    expect(await screen.findByRole("button", { name: "토론 시작" })).toBeTruthy();
    expect(
      within(screen.getByLabelText("라이브 그리모어 좌석 맵"))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(playerStatusesBefore);
  });

  test("renders and confirms a non-empty following-Day death announcement", async () => {
    const playerRoster = koreanPlayers().map((player) =>
      player.id === "player-5" ? { ...player, alive: false, deathAnnounced: false } : player,
    );
    const currentStep = step({
      id: "day2:announceDeaths",
      phase: "day",
      stepType: "announcement",
    });
    const initialReplay = replayWithRuleState(
      replayState({ currentStep, playerRoster }),
      { unannouncedNightDeathPlayerIds: ["player-5"] },
    );
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal: initialReplay,
      proposal: proposal(nightDeathsAnnouncedEvent(["player-5"])),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const announcement = await screen.findByLabelText("밤 사망 발표");
    expect(within(announcement).getByRole("img", { name: "사망" })).toBeTruthy();
    expect(within(announcement).getByText("5번")).toBeTruthy();
    expect(within(announcement).getByText("하린")).toBeTruthy();
    expect(within(announcement).queryByText("사망자 없음")).toBeNull();
    expect(within(announcement).queryByText(/살아있는 플레이어|생존자|6명/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "사망 발표 확정" }));
    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: { stepId: "day2:announceDeaths", input: null },
    });
  });

  test("renders an Undertaker's derived target choices without Player input and submits the selected registration witness", async () => {
    const playerRoster = koreanPlayers().map((player) => {
      if (player.id === "player-2") {
        return { ...player, actualCharacter: "undertaker", shownCharacter: "undertaker", alive: true };
      }
      if (player.id === "player-3") {
        return { ...player, actualCharacter: "spy", shownCharacter: "spy", alive: false };
      }
      return player;
    });
    const witness = { playerId: "player-3", registeredAs: "townsfolk" as const, characterId: "librarian" };
    const currentStep = ongoingStep(
      step({
        id: "night1:undertaker",
        phase: "night",
        character: "undertaker",
        playerId: "player-2",
        kind: "none",
      }),
      {
        informationPrompt: {
          ...ongoingPrompt([
            {
              targetPlayerIds: ["player-3"],
              computedResult: { kind: "character", characterId: "spy" },
              choices: [
                {
                  result: { kind: "character", characterId: "spy" },
                  isComputed: true,
                  registrationJudgments: [],
                },
                {
                  result: { kind: "character", characterId: "librarian" },
                  isComputed: false,
                  registrationJudgments: [witness],
                },
              ],
            },
          ]),
          deliveryMode: "selectable",
        },
      },
    );
    const nextStep = step({ id: "night1:empath", phase: "night", character: "empath", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      proposal: proposal(phaseEvent("event-undertaker", "장의사 정보 확정", "night"), {
        kind: "characterInformation",
        characterId: "undertaker",
        targetPlayer: { playerId: "player-3", seat: 3, name: "서연" },
        revealedCharacterId: "librarian",
      }),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "장의사: 2번 민준" });
    expect(screen.queryByLabelText("단계 입력")).toBeNull();
    const choices = screen.getByLabelText("전달 정보");
    expect(within(choices).getByRole("button", { name: "스파이" })).toBeTruthy();
    await user.click(within(choices).getByRole("button", { name: "사서" }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "night1:undertaker",
        input: null,
        deliveredResult: { kind: "character", characterId: "librarian" },
        registrationJudgments: [witness],
      },
    });
  });

  test("does not enable confirmation when selected Players match no targetCheck", async () => {
    const playerRoster = koreanPlayers();
    const currentStep = ongoingStep(
      step({
        id: "night1:fortuneTeller",
        phase: "night",
        character: "fortuneTeller",
        playerId: "player-1",
        kind: "playerIds",
        target: "players",
        minSelections: 2,
        maxSelections: 2,
      }),
      {
        allowedPlayerIds: playerRoster.map((player) => player.id),
        informationPrompt: ongoingPrompt([
          {
            targetPlayerIds: ["player-3", "player-5"],
            computedResult: { kind: "boolean", value: true },
            choices: [
              {
                result: { kind: "boolean", value: true },
                isComputed: true,
                registrationJudgments: [],
              },
            ],
          },
        ]),
      },
    );
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster }),
      proposal: proposal(phaseEvent("unused", "unused", "night")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const input = await screen.findByLabelText("단계 입력");
    await user.click(within(input).getByRole("button", { name: /지우/ }));
    await user.click(within(input).getByRole("button", { name: /민준/ }));
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("clears an in-progress selection when an imported game reaches the same step id", async () => {
    const confirmImport = vi.spyOn(window, "confirm").mockReturnValue(true);
    const currentStep = ongoingStep(
      step({
        id: "night1:fortuneTeller",
        phase: "night",
        character: "fortuneTeller",
        playerId: "player-1",
        kind: "playerIds",
        target: "players",
        minSelections: 2,
        maxSelections: 2,
      }),
      { allowedPlayerIds: ["player-1", "player-2", "player-3", "player-4", "player-5"] },
    );
    const originalPlayers = koreanPlayers();
    const importedPlayers = originalPlayers.map((player) => ({ ...player, name: `${player.name}-새게임` }));
    const initial = replayState({ currentStep, playerRoster: originalPlayers });
    const imported = replayState({ currentStep, playerRoster: importedPlayers });
    const core = createCoreHarness({
      initialReplay: initial,
      replayAfterProposal: initial,
      proposal: proposal(phaseEvent("unused", "unused", "night")),
    });
    vi.mocked(core.replay).mockImplementation(async (candidate: GameFile) => ({
      ok: true,
      value: candidate.game.id === "imported-game" ? imported : initial,
    }));
    const user = userEvent.setup();
    const { container } = render(
      <ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />,
    );

    const input = await screen.findByLabelText("단계 입력");
    const firstPlayer = within(input).getByRole("button", { name: /지우/ });
    await user.click(firstPlayer);
    expect(firstPlayer.getAttribute("aria-pressed")).toBe("true");

    const importedFile = gameFile();
    importedFile.game.id = "imported-game";
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File([JSON.stringify(importedFile)], "imported.json", { type: "application/json" })] },
    });

    await screen.findByRole("heading", { name: "점쟁이: 1번 지우-새게임" });
    await waitFor(() => {
      expect(
        within(screen.getByLabelText("단계 입력")).getByRole("button", { name: /지우-새게임/ }).getAttribute("aria-pressed"),
      ).toBe("false");
    });
    confirmImport.mockRestore();
  });
});

function koreanPlayers(): Player[] {
  const names = ["지우", "민준", "서연", "도윤", "하린"];
  return players().map((player, index) => ({ ...player, name: names[index] ?? player.name }));
}

function replayWithRuleState(
  state: ReplayState,
  ruleState: {
    redHerringPlayerId?: string;
    activePoison?: { playerId: string; sourcePlayerId: string; sourceEventId: string };
    activeProtection?: { playerId: string; sourcePlayerId: string; sourceEventId: string };
    unannouncedNightDeathPlayerIds: string[];
  },
): ReplayState {
  return { ...state, ruleState } as unknown as ReplayState;
}

function ongoingStep(
  base: PhaseStep,
  additions: {
    stepType?: string;
    allowedPlayerIds?: string[];
    playerRegistrationOptions?: Array<{
      playerId: string;
      registeredAs: "good";
      characterId?: string;
    }>;
    informationPrompt?: InformationPrompt;
  },
): PhaseStep {
  return {
    ...base,
    ...(additions.stepType ? { stepType: additions.stepType } : {}),
    requiredInput: {
      ...base.requiredInput,
      allowedPlayerIds: additions.allowedPlayerIds,
      playerRegistrationOptions: additions.playerRegistrationOptions,
    },
    informationPrompt: additions.informationPrompt,
  } as unknown as PhaseStep;
}

function ongoingPrompt(targetChecks: unknown[]): InformationPrompt {
  return {
    deliveryMode: "fixed",
    activeReasons: [],
    registrationCandidatePlayerIds: [],
    numberChoices: [],
    setupInfoRegistrationOptions: [],
    targetChecks,
  } as unknown as InformationPrompt;
}

function phaseEvent(id: string, summary: string, phase: "firstNight" | "night" | "day" = "firstNight"): GameEvent {
  return {
    id,
    type: "phaseStepConfirmed",
    phase,
    payload: { stepId: id, input: null },
    summary,
    createdAt: "2026-07-16T00:01:00.000Z",
  };
}

function nightDeathsAnnouncedEvent(playerIds: string[]): GameEvent {
  return {
    id: "event-announce",
    type: "nightDeathsAnnounced",
    phase: "day",
    payload: { stepId: "day2:announceDeaths", playerIds },
    summary: playerIds.length === 0 ? "밤 사망 발표: 없음" : "밤 사망 발표: 5번 하린(까마귀지기)",
    createdAt: "2026-07-16T00:01:00.000Z",
  };
}

function redHerringEvent(): GameEvent {
  return {
    id: "event-red-herring",
    type: "redHerringAssigned",
    phase: "firstNight",
    payload: {
      stepId: "firstNight:fortuneTellerRedHerring",
      playerId: "player-4",
      registrationJudgments: [
        { playerId: "player-4", registeredAs: "good" },
      ],
    },
    summary: "레드 헤링 지정",
    createdAt: "2026-07-16T00:01:00.000Z",
  } as unknown as GameEvent;
}

function nightActionEvent(summary: string, outcome: Record<string, unknown>): GameEvent {
  return {
    id: "event-imp",
    type: "nightActionResolved",
    phase: "night",
    payload: {
      stepId: "night1:imp",
      actorPlayerId: "player-5",
      resolution: { kind: "impAttack", targetPlayerId: outcome.kind === "death" ? "player-5" : "player-3", outcome },
    },
    summary,
    createdAt: "2026-07-16T00:01:00.000Z",
  } as unknown as GameEvent;
}
