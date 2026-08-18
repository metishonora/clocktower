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

const setupCss = readFileSync(resolve("src/shared-ui/styles/productionShell.css"), "utf8");
const evilTwinCss = readFileSync(resolve("src/features/evil-twin/evilTwinReveal.css"), "utf8");
const troubleBrewingCss = readFileSync(resolve("src/features/trouble-brewing/troubleBrewingProduction.css"), "utf8");

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
  expect(setupCss).toMatch(/:is\(\.snvCatalogPreview, \.roleCatalog\)\.rosterConfirmed article button\.selected/);
});

test("keeps selected Trouble Brewing setup roles in the forest and gold palette", () => {
  expect(troubleBrewingCss).toMatch(/\.tbProductionShell \.tbCatalog article button\.selected,[\s\S]*?background: linear-gradient\(135deg, rgba\(55, 107, 80, \.84\), rgba\(126, 81, 46, \.62\)\)/);
  expect(troubleBrewingCss).toMatch(/\.tbProductionShell \.tbCatalog\.rosterConfirmed article button\.selected,[\s\S]*?background: linear-gradient\(135deg, #376b50, #7e512e\)/);
  expect(troubleBrewingCss).toMatch(/\.tbProductionShell\[data-theme="day"\] \.tbCatalog article button\.selected,[\s\S]*?background: linear-gradient\(135deg, #d8e4c8, #ead8aa\)/);
});

test("keeps the entire Trouble Brewing day role picker out of the S&V purple palette", () => {
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\] \.tbPlayerCounts button:not\(\[aria-pressed="true"\]\),[\s\S]*?\.tbCatalog article button:not\(\.selected\):not\(\[aria-pressed="true"\]\)[\s\S]*?color: #385042;[\s\S]*?background: rgba\(255, 253, 238, \.58\)/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\] \.snvModifierNote \{[\s\S]*?color: #53644f;[\s\S]*?background: rgba\(57, 83, 55, \.08\)/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\] \.tbPinnedDemon\[aria-pressed="true"\][\s\S]*?border-color: #b79245;[\s\S]*?background: linear-gradient\(135deg, #f2d8cf, #ead8aa\)/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\] \.tbRoleDetail \.snvRoleDetailButton[\s\S]*?color: #385042;[\s\S]*?background: rgba\(255, 253, 238, \.56\)/,
  );
});

test("keeps inactive Trouble Brewing day navigation readable without changing active or destructive actions", () => {
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\][\s\S]*?:is\(\.productionApplicationUtilities, \.productionApplicationStages\)[\s\S]*?button:not\(:disabled\):not\(\[aria-current="page"\]\):not\(\.snvNewGameTab\)[\s\S]*?color: #385042;[\s\S]*?background: rgba\(255, 253, 238, \.62\)/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell :is\(\.productionApplicationUtilities, \.productionApplicationStages\) button\[aria-current="page"\],[\s\S]*?color: #fff8e8;[\s\S]*?background: #376b50/,
  );
  expect(setupCss).toMatch(/\.snvNewGameTab[^}]*color: #8f2f43/s);
});

test("keeps Trouble Brewing day task actions out of the S&V purple palette", () => {
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme\] \.tbCurrentTask \.snvStepActions button \{[\s\S]*?color: var\(--tb-ui-action-text\);[\s\S]*?background: var\(--tb-ui-action\)/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\] \.tbCurrentTask \.snvStepActions button\.secondary \{[\s\S]*?color: #385042;[\s\S]*?background: rgba\(255, 253, 238, \.62\)/,
  );
});

test("keeps dead Trouble Brewing seats visible over day alignment colors during nomination and voting", () => {
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\][\s\S]*?:is\(\.issue116NominationMode, \.issue116VoteMode\)[\s\S]*?> button\.assigned\.snvDeadSeat:not\(\.snvSeatStateSelected\):not\(\.snvSeatStateStrong\)[\s\S]*?border-color: #525a64;[\s\S]*?background: linear-gradient\(145deg, #59616b, #343a42\);[\s\S]*?opacity: 1;/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\][\s\S]*?> button\.assigned\.snvDeadSeat\.issue116IneligibleSeat:not\(\.snvSeatStateSelected\)[\s\S]*?opacity: \.68;/,
  );
  expect(troubleBrewingCss).toMatch(
    /\.tbProductionShell\[data-theme="day"\][\s\S]*?\.issue116VoteMode[\s\S]*?> button\.assigned\.snvDeadSeat\.snvGhostVoteSpent:not\(\.snvSeatStateSelected\)[\s\S]*?background: linear-gradient\(145deg, #d4d6d8, #b7bbc0\);[\s\S]*?filter: grayscale\(1\);/,
  );
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
