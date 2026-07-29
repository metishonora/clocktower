import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { GameEvent, GameFile, Player, ReplayState } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";

test("hands the Barber choice to the selected Demon and blocks progress until every reveal is acknowledged", async () => {
  const core = barberCore();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(barberGame())} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "← 선택" }));
  const chooserPanel = within(app).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(chooserPanel).getByRole("heading", { name: "행동할 악마 선택" })).toBeTruthy();
  expect(within(chooserPanel).getByText("미선택")).toBeTruthy();
  expect(within(app).queryByText("1번 가람")).toBeNull();

  await user.click(within(app).getByRole("button", { name: /3번 좌석, 다온/ }));
  const instructionPrompt = await within(app).findByRole("dialog", { name: "이발사 능력 안내" });
  expect(within(instructionPrompt).getByText("플레이어 3")).toBeTruthy();
  expect((within(app).getByRole("button", { name: "마도서 작업을 완료하세요" }) as HTMLButtonElement).disabled).toBe(true);

  await user.click(within(instructionPrompt).getByRole("button", { name: "공개" }));
  const instructionReveal = await screen.findByRole("dialog", { name: "이발사 능력 공개" });
  expect(within(instructionReveal).getByRole("heading", { name: "이발사" })).toBeTruthy();
  expect(within(instructionReveal).getByText(/플레이어 2명/)).toBeTruthy();
  expect(within(instructionReveal).queryByText("3번 다온")).toBeNull();
  await user.click(within(instructionReveal).getByRole("button", { name: "결정했다면 눈을 감으세요" }));

  const swapPanel = within(app).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(swapPanel).getByRole("heading", { name: "이발사 직업 교환" })).toBeTruthy();
  expect(within(swapPanel).getByText("3번 다온")).toBeTruthy();
  expect(within(swapPanel).queryByText("1번 가람")).toBeNull();
  expect(within(app).getByRole("button", { name: /3번 좌석, 다온.*현재 행동자/ })).toBeTruthy();
  expect((within(app).getByRole("button", { name: /4번 좌석, 라온.*선택 불가/ }) as HTMLButtonElement).disabled).toBe(true);

  await user.click(within(app).getByRole("button", { name: /1번 좌석, 가람/ }));
  await user.click(within(app).getByRole("button", { name: /2번 좌석, 나래/ }));
  await user.click(within(swapPanel).getByRole("button", { name: "직업 교환" }));

  expect(core.propose).toHaveBeenCalledWith(expect.anything(), {
    type: "resolveBarberConsequence",
    payload: {
      stepId: "day1:deathConsequence:barber:player-1:1",
      chooserDemonPlayerId: "player-3",
      decision: { kind: "swap", playerIds: ["player-1", "player-2"] },
      expectedEventCount: 2,
    },
  });
  const firstPrompt = await screen.findByRole("dialog", { name: "직업 변경 안내 1/2" });
  expect((within(app).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(app).queryByRole("region", { name: "낮 진행" })).toBeNull();

  await user.click(within(firstPrompt).getByRole("button", { name: "공개" }));
  await user.click(within(await screen.findByRole("dialog", { name: "역할 변경 공개 1/2" })).getByRole("button", { name: "확인했다면 눈을 감으세요" }));
  const secondPrompt = await screen.findByRole("dialog", { name: "직업 변경 안내 2/2" });
  await user.click(within(secondPrompt).getByRole("button", { name: "공개" }));
  await user.click(within(await screen.findByRole("dialog", { name: "역할 변경 공개 2/2" })).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  await waitFor(() => expect(within(app).queryByRole("dialog", { name: /직업 변경 안내/ })).toBeNull());
  expect((within(app).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(false);
});

function barberCore(): CoreAdapter {
  return {
    replay: vi.fn(async (gameFile) => ({
      ok: true as const,
      value: barberReplay(gameFile.game.events.some((event) => event.type === "barberConsequenceResolved")),
    })),
    propose: vi.fn(async () => ({
      ok: true as const,
      value: { event: barberEvent(), warnings: [], followUpSteps: [], preview: null },
    })),
    setupDistribution: vi.fn(async () => ({ ok: true as const, value: { Townsfolk: 3, Outsider: 2, Minion: 1, Demon: 1 } })),
    setupDistributionSync: vi.fn(() => ({ ok: true as const, value: { Townsfolk: 3, Outsider: 2, Minion: 1, Demon: 1 } })),
    suggestPhaseInput: vi.fn(async () => ({ ok: false as const, error: { code: "UNSUPPORTED", messageKo: "추천 불가" } })),
  };
}

function barberPlayers(swapped = false): Player[] {
  const characters = swapped
    ? ["dreamer", "barber", "vortox", "noDashii", "seamstress", "artist", "evilTwin"]
    : ["barber", "dreamer", "vortox", "noDashii", "seamstress", "artist", "evilTwin"];
  const names = ["가람", "나래", "다온", "라온", "마루", "보라", "도윤"];
  return characters.map((character, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: names[index],
    actualCharacter: character,
    shownCharacter: character,
    alignment: index === 2 ? "good" : index === 3 || index === 6 ? "evil" : "good",
    alive: index !== 0,
    ghostVoteUsed: false,
    deathAnnounced: index === 0,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
    ...(index === 0 ? { abilityInstance: { id: "barber-instance", characterId: "barber", sourceEventId: "setup-1" } } : {}),
  }));
}

function barberReplay(swapped: boolean): ReplayState {
  const players = barberPlayers(swapped);
  const currentStep = {
    id: "day1:whisper",
    phase: "day" as const,
    stepType: "whisper" as const,
    character: "barber",
    playerId: "player-1",
    requiredInput: { kind: "none" as const, optional: false },
    canSkip: false,
  };
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: swapped ? 3 : 2,
    phase: "day",
    players,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    dayState: { nominationsOpen: false, nominations: [], eligibleNominatorIds: [], eligibleNomineeIds: [], livingPlayerCount: 6, executionThreshold: 3 },
    ruleState: { unannouncedNightDeathPlayerIds: [], activeImpairments: [] },
    warnings: [],
    gameEnd: null,
    ...(swapped ? {
      pendingIdentityReveals: [
        { sourceEventId: "barber-3", sequence: 1, payload: { kind: "characterChange" as const, playerId: "player-1", characterId: "dreamer", alignment: "good" as const } },
        { sourceEventId: "barber-3", sequence: 2, payload: { kind: "characterChange" as const, playerId: "player-2", characterId: "barber", alignment: "good" as const } },
      ],
    } : {
      pendingDeathConsequences: [{
        stepId: "day1:deathConsequence:barber:player-1:1",
        kind: "barber" as const,
        sourceEventId: "death-2",
        deathSequence: 1,
        actorPlayerId: "player-1",
        sourceAbilityInstanceId: "barber-instance",
        actorImpairedAtTrigger: false,
        allowedPlayerIds: players.map((player) => player.id),
        eligibleChooserPlayerIds: ["player-3", "player-4"],
      }],
    }),
  } as ReplayState;
}

function barberGame(): GameFile {
  const players = barberPlayers();
  const setup = {
    id: "setup-1", type: "setupConfirmed", phase: "setup",
    payload: { players: players.map(({ id: _id, ...player }) => player) },
    summary: "초기 설정", createdAt: "2026-07-29T00:00:00.000Z",
  } as GameEvent;
  const death = {
    id: "death-2", type: "executionDeathResolved", phase: "day",
    payload: {}, summary: "이발사 사망", createdAt: "2026-07-29T00:01:00.000Z",
  } as GameEvent;
  const roles = players.map((player) => player.actualCharacter);
  return {
    schemaVersion: 3,
    ui: { sectsAndVioletsSession: {
      version: 1, activeTab: "play", savedAt: "2026-07-29T00:01:00.000Z",
      setup: {
        playerCount: 7, demon: "vortox", selectedIds: roles,
        seatAssignments: Object.fromEntries(roles.map((role, index) => [index + 1, role])),
        seatAlignments: Object.fromEntries(players.map((player) => [player.seat, player.alignment])),
        seatNames: Object.fromEntries(players.map((player) => [player.seat, player.name])),
        rosterConfirmed: true, seatingConfirmed: true,
      },
      phaseCheckpoints: [{ id: "setup-1", kind: "setup", eventCount: 1, summary: "초기 설정", activeTab: "seating" }],
    } },
    game: {
      id: "issue-103-barber", name: "Sects & Violets", scriptId: "sectsAndViolets",
      createdAt: "2026-07-29T00:00:00.000Z", updatedAt: "2026-07-29T00:01:00.000Z",
      events: [setup, death],
    },
  };
}

function barberEvent(): GameEvent {
  return {
    id: "barber-3", type: "barberConsequenceResolved", phase: "day",
    payload: {}, summary: "이발사 직업 교환", createdAt: "2026-07-29T00:02:00.000Z",
  } as GameEvent;
}
