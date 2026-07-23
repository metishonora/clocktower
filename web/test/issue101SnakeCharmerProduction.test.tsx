import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { GameEvent, GameFile, Player, ReplayState } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";

const characters = [
  "snakeCharmer",
  "clockmaker",
  "dreamer",
  "seamstress",
  "artist",
  "evilTwin",
  "vigormortis",
];

test("runs the Snake Charmer target, ordered identity reveals, and permanent poison workflow", async () => {
  const storage = new MemoryGameStorageDriver(savedGame());
  const core = snakeCharmerCore();
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  await user.click(within(app).getByRole("button", { name: /7번 좌석, 도윤/ }));
  await user.click(within(app).getByRole("button", { name: "7번 도윤 선택 확정" }));

  expect(core.propose).toHaveBeenCalledWith(
    expect.anything(),
    {
      type: "confirmStep",
      payload: {
        stepId: "night:snakeCharmer:player-1",
        input: { playerIds: ["player-7"] },
      },
    },
  );

  const firstPrompt = await screen.findByRole("dialog", { name: "직업 변경 안내 1/2" });
  expect(within(firstPrompt).getByText("직업이 변경됩니다")).toBeTruthy();
  expect(within(firstPrompt).getByText("플레이어 1")).toBeTruthy();
  expect(firstPrompt.getAttribute("aria-modal")).toBeNull();
  expect(firstPrompt.closest(".snvGrimoireCenter")).toBeTruthy();
  expect(firstPrompt.closest(".snakeCharmerRevealBackdrop")).toBeNull();
  expect(within(firstPrompt).queryByText("비고르모르티스")).toBeNull();
  expect(within(app).queryByText("00:00")).toBeNull();
  expect(within(app).queryByRole("button", { name: "다음 →" })).toBeNull();
  expect(within(app).queryByText("+1")).toBeNull();
  expect((within(app).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);

  const undo = within(app).getByRole("button", { name: /최근 행동 되돌리기/ });
  await user.click(undo);
  const undoDialog = screen.getByRole("dialog", { name: "Undo" });
  await user.click(within(undoDialog).getByRole("button", { name: "취소" }));
  expect(screen.getByRole("dialog", { name: "직업 변경 안내 1/2" })).toBe(firstPrompt);
  await user.click(within(firstPrompt).getByRole("button", { name: "공개" }));

  const firstReveal = await screen.findByRole("dialog", { name: "역할 변경 공개 1/2" });
  expect(firstReveal.classList.contains("snvInformationReveal")).toBe(true);
  expect(within(firstReveal).getByRole("heading", { level: 1, name: "당신의 직업이 변경되었습니다" })).toBeTruthy();
  expect(
    Array.from(firstReveal.querySelector(".snakeCharmerRevealIdentity")?.children ?? []).map((element) => element.tagName),
  ).toEqual(["H1", "IMG", "H2", "SPAN"]);
  expect(within(firstReveal).getByText("비고르모르티스")).toBeTruthy();
  expect(within(firstReveal).getByText("악")).toBeTruthy();
  expect(within(firstReveal).queryByText("1번 가람")).toBeNull();
  expect(within(firstReveal).queryByText("1 / 2")).toBeNull();
  expect(within(firstReveal).queryByText("악한 진영")).toBeNull();
  await user.click(within(firstReveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  const secondPrompt = await screen.findByRole("dialog", { name: "직업 변경 안내 2/2" });
  expect(within(secondPrompt).getByText("플레이어 7")).toBeTruthy();
  expect(secondPrompt.closest(".snvGrimoireCenter")).toBeTruthy();
  await user.click(within(secondPrompt).getByRole("button", { name: "공개" }));

  const secondReveal = await screen.findByRole("dialog", { name: "역할 변경 공개 2/2" });
  expect(within(secondReveal).getByText("뱀 조련사")).toBeTruthy();
  expect(within(secondReveal).queryByText("7번 도윤")).toBeNull();
  expect(within(secondReveal).queryByText("2 / 2")).toBeNull();
  expect(within(secondReveal).queryByText("선한 진영")).toBeNull();
  await user.click(within(secondReveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  await user.click(within(app).getByRole("button", { name: /7번 좌석, 도윤, 뱀 조련사, 토큰 1개/ }));
  const details = await screen.findByRole("dialog", { name: "7번 도윤 플레이어 상세" });
  expect(within(details).getByRole("img", { name: "현재 진영 · 선" }).textContent).toBe("선");
  expect(within(details).queryByText("현재 진영 · 선")).toBeNull();
  expect(within(details).getByText("중독")).toBeTruthy();
  expect(within(details).getByLabelText("중독 · 출처 뱀 조련사")).toBeTruthy();
});

test("starts the pending reveal sequence from the first player after a reload", async () => {
  const storage = new MemoryGameStorageDriver(savedGame(true));
  const core = snakeCharmerCore();

  const first = render(<SectsAndVioletsApp coreAdapter={core} storageDriver={storage} />);
  expect(await screen.findByRole("dialog", { name: "직업 변경 안내 1/2" })).toBeTruthy();
  first.unmount();

  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={storage} />);
  expect(await screen.findByRole("dialog", { name: "직업 변경 안내 1/2" })).toBeTruthy();
});

test("undoes the swap while the centered change prompt is waiting", async () => {
  const storage = new MemoryGameStorageDriver(savedGame(true));
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={snakeCharmerCore()} storageDriver={storage} />);
  expect(await screen.findByRole("dialog", { name: "직업 변경 안내 1/2" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /최근 행동 되돌리기: 뱀 조련사 교환/ }));
  const undoDialog = screen.getByRole("dialog", { name: "Undo" });
  await user.click(within(undoDialog).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "직업 변경 안내 1/2" })).toBeNull();
  });
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1);
});

function snakeCharmerCore(): CoreAdapter {
  return {
    replay: vi.fn(async (gameFile) => ({
      ok: true as const,
      value: replayState(gameFile.game.events.at(-1)?.type === "snakeCharmerActionResolved"),
    })),
    propose: vi.fn(async () => ({
      ok: true as const,
      value: {
        event: snakeCharmerEvent(),
        warnings: [],
        followUpSteps: [],
        preview: null,
      },
    })),
    setupDistribution: vi.fn(async () => ({
      ok: true as const,
      value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 },
    })),
    setupDistributionSync: vi.fn(() => ({
      ok: true as const,
      value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 },
    })),
    suggestPhaseInput: vi.fn(async () => ({
      ok: false as const,
      error: { code: "UNSUPPORTED", messageKo: "추천 불가" },
    })),
  };
}

function savedGame(swapped = false): GameFile {
  const events: GameEvent[] = [
    {
      id: "setup-1",
      type: "setupConfirmed",
      phase: "setup",
      payload: { players: players(false).map(({ id: _id, ...player }) => player) },
      summary: "초기 설정",
      createdAt: "2026-07-23T00:00:00.000Z",
    },
    swapped ? snakeCharmerEvent() : {
      id: "night-1",
      type: "manualPhaseStepResolved",
      phase: "night",
      payload: { stepId: "night:start", outcome: "handled" },
      summary: "밤 시작",
      createdAt: "2026-07-23T00:01:00.000Z",
    },
  ];
  return {
    schemaVersion: 3,
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "play",
        savedAt: "2026-07-23T00:01:00.000Z",
        setup: {
          playerCount: 7,
          demon: "vigormortis",
          selectedIds: characters,
          seatAssignments: Object.fromEntries(characters.map((character, index) => [index + 1, character])),
          seatAlignments: Object.fromEntries(characters.map((_character, index) => [index + 1, index >= 5 ? "evil" : "good"])),
          seatNames: Object.fromEntries(players(false).map((player) => [player.seat, player.name])),
          rosterConfirmed: true,
          seatingConfirmed: true,
        },
        phaseCheckpoints: [
          { id: "setup-1", kind: "setup", eventCount: 1, summary: "초기 설정", activeTab: "seating" },
          ...(swapped ? [{
            id: "snake-charmer-2",
            kind: "phase" as const,
            eventCount: 2,
            summary: "뱀 조련사 교환",
            activeTab: "seating" as const,
          }] : []),
        ],
      },
    },
    game: {
      scriptId: "sectsAndViolets",
      id: "issue-101-game",
      name: "Sects & Violets",
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:01:00.000Z",
      events,
    },
  };
}

function replayState(swapped: boolean): ReplayState {
  const roster = players(swapped);
  const currentStep = {
    id: swapped ? "night:demon:player-1" : "night:snakeCharmer:player-1",
    phase: "night" as const,
    stepType: "character" as const,
    character: swapped ? "vigormortis" : "snakeCharmer",
    playerId: "player-1",
    requiredInput: {
      kind: "playerIds" as const,
      target: "player" as const,
      minSelections: 1,
      maxSelections: 1,
      allowedPlayerIds: roster.filter((player) => player.alive).map((player) => player.id),
      optional: false,
    },
    canSkip: false,
    support: "automated" as const,
  };
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "night",
    players: roster,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      ...(swapped ? {
        activeImpairments: [{
          kind: "poisoned",
          playerId: "player-7",
          sourceEventId: "snake-charmer-2",
          sourceCharacterId: "snakeCharmer",
          expires: "never",
        }],
      } : { activeImpairments: [] }),
    },
    warnings: [],
    gameEnd: null,
    ...(swapped ? {
      pendingIdentityReveals: [
        { sourceEventId: "snake-charmer-2", sequence: 1, payload: { kind: "characterChange", playerId: "player-1", characterId: "vigormortis", alignment: "evil" } },
        { sourceEventId: "snake-charmer-2", sequence: 2, payload: { kind: "characterChange", playerId: "player-7", characterId: "snakeCharmer", alignment: "good" } },
      ],
    } : {}),
  } as ReplayState;
}

function players(swapped: boolean): Player[] {
  const names = ["가람", "나래", "다온", "라온", "마루", "보라", "도윤"];
  return characters.map((character, index) => {
    const isSnake = index === 0;
    const isDemon = index === 6;
    const actualCharacter = swapped
      ? isSnake ? "vigormortis" : isDemon ? "snakeCharmer" : character
      : character;
    return {
      id: `player-${index + 1}`,
      seat: index + 1,
      name: names[index],
      actualCharacter,
      shownCharacter: actualCharacter,
      alignment: swapped ? isSnake ? "evil" : isDemon ? "good" : index === 5 ? "evil" : "good" : index >= 5 ? "evil" : "good",
      alive: true,
      ghostVoteUsed: false,
      deathAnnounced: false,
      systemTokenIds: [],
      scriptTokens: [],
      notes: "",
    };
  });
}

function snakeCharmerEvent(): GameEvent {
  const snakeBefore = { actualCharacter: "snakeCharmer", shownCharacter: "snakeCharmer", alignment: "good" as const };
  const snakeAfter = { actualCharacter: "vigormortis", shownCharacter: "vigormortis", alignment: "evil" as const };
  const demonBefore = { actualCharacter: "vigormortis", shownCharacter: "vigormortis", alignment: "evil" as const };
  const demonAfter = { actualCharacter: "snakeCharmer", shownCharacter: "snakeCharmer", alignment: "good" as const };
  return {
    id: "snake-charmer-2",
    type: "snakeCharmerActionResolved",
    phase: "night",
    payload: {
      stepId: "night:snakeCharmer:player-1",
      actorPlayerId: "player-1",
      targetPlayerId: "player-7",
      outcome: {
        kind: "swap",
        identityTransitions: [
          { playerId: "player-1", before: snakeBefore, after: snakeAfter },
          { playerId: "player-7", before: demonBefore, after: demonAfter },
        ],
        impairment: {
          kind: "poisoned",
          playerId: "player-7",
          sourceEventId: "snake-charmer-2",
          sourceCharacterId: "snakeCharmer",
          expires: "never",
        },
      },
    },
    summary: "뱀 조련사 교환",
    createdAt: "2026-07-23T00:02:00.000Z",
  };
}
