import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ReplayState } from "../src/core/types";
import { SectsAndVioletsLiveProgress } from "../src/sectsAndVioletsLivePhase";

test("shows deaths and resurrections together before the dawn announcement", () => {
  render(
    <SectsAndVioletsLiveProgress
      replayState={announcementState()}
      phaseLabel="3일차 낮"
      phaseRuntime="00:12"
      operationBusy={false}
      onGoToGrimoire={vi.fn()}
      onStartNomination={vi.fn()}
      onEndNominations={vi.fn()}
      onConfirmExecution={vi.fn()}
      onStartDemonAttack={vi.fn()}
      onStartSnakeCharmer={vi.fn()}
      onStartCerenovus={vi.fn()}
      onAdvance={vi.fn()}
      onResolveManual={vi.fn()}
    />,
  );

  const result = screen.getByRole("group", { name: "밤 결과 확인" });
  expect(within(result).getByText("사망자:")).toBeTruthy();
  expect(within(result).getByText("2번 나래")).toBeTruthy();
  expect(within(result).getByText("부활:")).toBeTruthy();
  expect(within(result).getByText("4번 라온")).toBeTruthy();
  expect(within(result).getByRole("button", { name: "발표 완료" })).toBeTruthy();
});

function announcementState(): ReplayState {
  const players = ["가람", "나래", "다온", "라온", "마루", "보라", "도윤"].map((name, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name,
    actualCharacter: index === 6 ? "vortox" : "mutant",
    shownCharacter: index === 6 ? "vortox" : "mutant",
    alignment: index === 6 ? "evil" as const : "good" as const,
    alive: index !== 1,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
  const currentStep = {
    id: "day3:announceDeaths",
    phase: "day" as const,
    stepType: "announcement" as const,
    requiredInput: { kind: "none" as const, optional: false },
    canSkip: false,
    support: "automated" as const,
  };
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 20,
    phase: "day",
    players,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    ruleState: {
      unannouncedNightDeathPlayerIds: ["player-2"],
      unannouncedNightResurrectionPlayerIds: ["player-4"],
    },
    warnings: [],
    gameEnd: null,
  };
}
