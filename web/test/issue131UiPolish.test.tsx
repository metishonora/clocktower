import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PhaseStep, Player, ReplayState } from "../src/core/types";
import { EvilTwinRevealPrompt } from "../src/features/evil-twin/EvilTwinReveal";
import {
  SectsAndVioletsLiveGrimoire,
  SectsAndVioletsLiveProgress,
  type LivePlayer,
} from "../src/sectsAndVioletsLivePhase";

const setupCss = readFileSync(resolve("src/sectsAndVioletsFoundationPrototype.css"), "utf8");
const evilTwinCss = readFileSync(resolve("src/features/evil-twin/evilTwinReveal.css"), "utf8");

test("uses the Korean character label in the phase overview", () => {
  const currentStep = characterStep("night2:noDashii", "noDashii", "player-2");
  renderProgress(replayState(currentStep));

  const overview = screen.getByRole("list", { name: "이후 밤 순서" });
  expect(within(overview).getByText("노 다시")).toBeTruthy();
  expect(within(overview).queryByText("noDashii")).toBeNull();
});

test("labels the daytime discussion phase as 공개 토론", () => {
  const currentStep: PhaseStep = {
    id: "day2:discussion",
    phase: "day",
    stepType: "discussion",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    support: "manual",
  };
  renderProgress(replayState(currentStep));

  const progress = screen.getByRole("region", { name: "공개 토론" });
  expect(within(progress).getAllByText("공개 토론").length).toBeGreaterThan(0);
  expect(within(progress).queryByText("낮 진행")).toBeNull();
});

test.each([
  ["일반 처형", undefined],
  ["집착 위반 처형", {
    eventId: "madness-1",
    assignmentId: "assignment-1",
    sourceCharacterId: "cerenovus" as const,
    targetPlayerId: "player-1",
    interruptedStepId: "day2:discussion",
  }],
])("shows the target character for %s", (_label, pendingMadnessExecution) => {
  const currentStep: PhaseStep = {
    id: pendingMadnessExecution ? "day2:madnessExecution:death" : "day2:execution",
    phase: "day",
    stepType: pendingMadnessExecution ? "executionDeath" : "execution",
    requiredInput: {
      kind: pendingMadnessExecution ? "executionDeathDecision" : "executionDecision",
      optional: false,
    },
    canSkip: false,
    support: "automated",
  };
  const state = replayState(currentStep);
  state.dayState = {
    nominations: [],
    eligibleNominatorIds: [],
    eligibleNomineeIds: [],
    executionVoteThreshold: 3,
    highestVoteCount: 4,
    executionCandidate: { nomineeId: "player-1", voteCount: 4 },
  };
  state.pendingMadnessExecution = pendingMadnessExecution;

  renderProgress(state);

  const decision = screen.getByRole("group", {
    name: pendingMadnessExecution ? "집착 위반 처형 사망 확인" : "처형 결정",
  });
  expect(within(decision).getByText("꿈꾸는 자")).toBeTruthy();
});

test("gives the Evil Twin center prompt a dedicated safe layer and compact width", () => {
  const players = livePlayers();
  const payload = {
    kind: "evilTwinPair" as const,
    players: [
      { playerId: "player-1", seat: 1, name: "가람", alignment: "good" as const, characterId: "dreamer" },
      { playerId: "player-2", seat: 2, name: "나래", alignment: "evil" as const, characterId: "evilTwin" },
    ],
  };
  render(
    <SectsAndVioletsLiveGrimoire
      players={players}
      phaseLabel="첫 밤"
      currentStep={characterStep("firstNight:evilTwin", "evilTwin", "player-2")}
      voterIds={[]}
      centerPrompt={<EvilTwinRevealPrompt payload={payload} onReveal={vi.fn()} />}
      centerPromptClassName="evilTwinCenterPrompt"
      operationBusy={false}
      onSeatClick={vi.fn()}
      onConfirm={vi.fn()}
      onReturn={vi.fn()}
      onCancelDayHandoff={vi.fn()}
      onResetDaySelection={vi.fn()}
      onGoToProgress={vi.fn()}
      onReturnToSetup={vi.fn()}
    />,
  );

  const prompt = screen.getByRole("dialog", { name: "쌍둥이 확인 안내" }).closest(".snvGrimoireCenter");
  expect(prompt?.classList.contains("evilTwinCenterPrompt")).toBe(true);
  expect(evilTwinCss).toMatch(/\.evilTwinCenterPrompt[^}]*z-index:\s*7/s);
  expect(evilTwinCss).toMatch(/\.evilTwinCenterPrompt[^}]*width:\s*min\(220px, 40%\)/s);
  expect(setupCss).toMatch(/\.snvCatalogPreview\.rosterConfirmed article button\.selected/);
});

function renderProgress(state: ReplayState) {
  return render(
    <SectsAndVioletsLiveProgress
      replayState={state}
      phaseLabel={state.phase === "day" ? "2일차 낮" : "2일차 밤"}
      phaseRuntime="00:00"
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
}

function replayState(currentStep: PhaseStep): ReplayState {
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 4,
    phase: currentStep.phase,
    players: players(),
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };
}

function characterStep(id: string, character: string, playerId: string): PhaseStep {
  return {
    id,
    phase: id.startsWith("firstNight:") ? "firstNight" : "night",
    stepType: "character",
    character,
    playerId,
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    support: "automated",
  };
}

function players(): Player[] {
  return [
    player("player-1", 1, "가람", "dreamer", "good"),
    player("player-2", 2, "나래", "evilTwin", "evil"),
  ];
}

function livePlayers(): LivePlayer[] {
  return players().map((playerValue) => ({
    ...playerValue,
    characterName: playerValue.actualCharacter === "dreamer" ? "꿈꾸는 자" : "사악한 쌍둥이",
    characterKind: playerValue.actualCharacter === "dreamer" ? "townsfolk" : "minion",
  }));
}

function player(id: string, seat: number, name: string, actualCharacter: string, alignment: Player["alignment"]): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
