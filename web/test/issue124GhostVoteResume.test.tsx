import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { GameEvent, GameFile, Player, ReplayState, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";

test("resumes a saved nomination vote with an unused dead-player ghost vote selectable", async () => {
  const game = savedVoteGame();
  const replay = voteReplayState();
  const core = {
    replay: vi.fn(async () => ({ ok: true as const, value: replay })),
    propose: vi.fn(),
    setupDistribution: vi.fn(async () => ({
      ok: true as const,
      value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 },
    })),
    setupDistributionSync: vi.fn(() => ({
      ok: true as const,
      value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 },
    })),
    suggestPhaseInput: vi.fn(),
  } as unknown as CoreAdapter;
  const user = userEvent.setup();
  render(
    <SectsAndVioletsApp
      coreAdapter={core}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  const grimoire = await screen.findByRole("region", { name: "낮 마도서" });
  expect(within(grimoire).getByRole("heading", { name: "투표" })).toBeTruthy();
  const deadSnakeCharmer = within(grimoire).getByRole("button", {
    name: /3번 좌석.*뱀 조련사.*사망, 투표 가능/,
  });
  expect(deadSnakeCharmer.hasAttribute("disabled")).toBe(false);
  expect(deadSnakeCharmer.classList.contains("snvDeadSeat")).toBe(true);
  expect(deadSnakeCharmer.querySelector(".snvFuneralIcon")).not.toBeNull();
  expect(deadSnakeCharmer.querySelector("img")).not.toBeNull();

  await user.click(deadSnakeCharmer);
  expect(within(grimoire).getByText("1표")).toBeTruthy();
  expect(deadSnakeCharmer.getAttribute("aria-pressed")).toBe("true");
  expect(deadSnakeCharmer.classList.contains("snvSeatStateSelected")).toBe(true);
});

function savedVoteGame(): GameFile {
  const players = setupPlayers();
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정: 7명",
    createdAt: "2026-07-24T00:00:00.000Z",
  };
  const nomination: GameEvent = {
    id: "nomination-started-2",
    type: "nominationStarted",
    phase: "day",
    payload: {
      stepId: "day2:nomination:1",
      nominatorId: "player-5",
      nomineeId: "player-7",
      registrationJudgments: [],
      virginResolution: { kind: "notApplicable" },
    },
    summary: "지목 확정: 5번 → 7번",
    createdAt: "2026-07-24T00:01:00.000Z",
  };
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "issue-124-saved-vote",
      name: "Issue 124 saved vote",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:01:00.000Z",
      events: [setup, nomination],
    },
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "seating",
        savedAt: "2026-07-24T00:01:00.000Z",
        setup: {
          playerCount: players.length,
          demon: "fangGu",
          selectedIds: players.map((player) => player.actualCharacter),
          seatAssignments: Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter])),
          seatAlignments: Object.fromEntries(players.map((player, index) => [player.seat, index >= 5 ? "evil" : "good"])),
          seatNames: Object.fromEntries(players.map((player) => [player.seat, player.name])),
          rosterConfirmed: true,
          seatingConfirmed: true,
        },
        phaseCheckpoints: [
          { id: setup.id, kind: "setup", eventCount: 1, summary: setup.summary, activeTab: "seating" },
          { id: nomination.id, kind: "phase", eventCount: 2, summary: nomination.summary, activeTab: "seating" },
        ],
      },
    },
  };
}

function voteReplayState(): ReplayState {
  const players = setupPlayers().map((player, index): Player => ({
    id: player.id!,
    seat: player.seat,
    name: player.name,
    actualCharacter: player.actualCharacter,
    shownCharacter: player.actualCharacter,
    alignment: index >= 5 ? "evil" : "good",
    alive: index !== 2,
    ghostVoteUsed: false,
    deathAnnounced: index === 2,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
  const currentStep = {
    id: "day2:nomination:1:vote",
    phase: "day" as const,
    stepType: "nomination" as const,
    requiredInput: { kind: "nominationVote" as const, target: "players" as const, minSelections: 0, optional: true },
    canSkip: false,
    support: "automated" as const,
  };
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "day",
    players,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    dayState: {
      nominations: [],
      eligibleNominatorIds: players.filter((player) => player.alive).map((player) => player.id),
      eligibleNomineeIds: players.map((player) => player.id),
      executionVoteThreshold: 3,
      highestVoteCount: 0,
      activeNomination: {
        eventId: "nomination-started-2",
        stepId: "day2:nomination:1",
        nominatorId: "player-5",
        nomineeId: "player-7",
      },
    },
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };
}

function setupPlayers(): SetupPlayerInput[] {
  return ["mathematician", "townCrier", "snakeCharmer", "philosopher", "oracle", "cerenovus", "fangGu"]
    .map((actualCharacter, index) => ({
      id: `player-${index + 1}`,
      seat: index + 1,
      name: `플레이어 ${index + 1}`,
      actualCharacter,
      shownCharacter: actualCharacter,
    }));
}
