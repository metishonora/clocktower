import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PendingDeathConsequence, Player, ReplayState } from "../src/core/types";
import { DeathConsequencePanel } from "../src/features/death-consequences/DeathConsequencePanel";
import { SectsAndVioletsLiveProgress } from "../src/sectsAndVioletsLivePhase";

const players: Player[] = [
  player("player-1", 1, "가람", "klutz", "good", false),
  player("player-2", 2, "나래", "dreamer", "good", true),
  player("player-3", 3, "다온", "vortox", "evil", true),
];

test("keeps the Klutz choice player-safe and submits one living player", async () => {
  const onResolve = vi.fn();
  render(
    <DeathConsequencePanel
      pending={pending("klutz")}
      players={players}
      operationBusy={false}
      onResolve={onResolve}
    />,
  );

  const panel = screen.getByRole("group", { name: "얼뜨기 공개 선택" });
  expect(within(panel).getByText("2번 나래 · 생존")).toBeTruthy();
  expect(within(panel).getByText("3번 다온 · 생존")).toBeTruthy();
  expect(within(panel).queryByText("꿈꾸는 자")).toBeNull();
  expect(within(panel).queryByText("보르톡스")).toBeNull();
  expect(within(panel).queryByText("선")).toBeNull();
  expect(within(panel).queryByText("악")).toBeNull();

  await userEvent.setup().click(within(panel).getByRole("button", { name: "2번 나래 · 생존" }));
  await userEvent.setup().click(within(panel).getByRole("button", { name: "선택 확정" }));
  expect(onResolve).toHaveBeenCalledWith({ targetPlayerId: "player-2" });
});

test("hides the private phase overview while the Klutz choice is public", () => {
  const currentStep = {
    id: "day1:whisper", phase: "day" as const, stepType: "whisper" as const,
    requiredInput: { kind: "none" as const, optional: false }, canSkip: false,
  };
  const replayState = {
    schemaVersion: 3, scriptId: "sectsAndViolets", eventCount: 3, phase: "day",
    players, currentStep,
    phaseOverview: [
      { ...currentStep, status: "current" as const },
      { ...currentStep, id: "day1:secret", character: "vortox", status: "pending" as const },
    ],
    ruleState: { unannouncedNightDeathPlayerIds: [] }, warnings: [],
  } as ReplayState;
  render(
    <SectsAndVioletsLiveProgress
      replayState={replayState}
      phaseLabel="2일차 낮"
      phaseRuntime="00:00"
      operationBusy={false}
      priorityPanelPlayerSafe
      priorityPanel={<DeathConsequencePanel pending={pending("klutz")} players={players} operationBusy={false} onResolve={vi.fn()} />}
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
  expect(screen.queryByRole("list", { name: "낮 순서" })).toBeNull();
  expect(screen.queryByText("vortox")).toBeNull();
});

test("offers every player to the Storyteller for Sweetheart, including dead and self", async () => {
  const onResolve = vi.fn();
  render(
    <DeathConsequencePanel
      pending={pending("sweetheart")}
      players={players}
      operationBusy={false}
      onResolve={onResolve}
    />,
  );

  const target = screen.getByRole("combobox", { name: "취하게 할 플레이어" });
  expect(within(target).getByRole("option", { name: "1번 가람 · 사망" })).toBeTruthy();
  await userEvent.setup().selectOptions(target, "player-1");
  await userEvent.setup().click(screen.getByRole("button", { name: "취함 적용" }));
  expect(onResolve).toHaveBeenCalledWith({ targetPlayerId: "player-1" });
});

test("lets the Storyteller designate the living Demon and either decline or swap two distinct players", async () => {
  const onResolve = vi.fn();
  render(
    <DeathConsequencePanel
      pending={pending("barber")}
      players={players.map((candidate) => candidate.id === "player-1"
        ? { ...candidate, actualCharacter: "barber", shownCharacter: "barber", abilityInstance: {
          id: "ability-1", characterId: "barber", sourceEventId: "setup",
        } }
        : candidate)}
      operationBusy={false}
      onResolve={onResolve}
    />,
  );

  await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "결정할 악마" }), "player-3");
  await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "첫 번째 플레이어" }), "player-1");
  await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "두 번째 플레이어" }), "player-2");
  await userEvent.setup().click(screen.getByRole("button", { name: "직업 교환" }));
  expect(onResolve).toHaveBeenCalledWith({
    chooserDemonPlayerId: "player-3",
    decision: { kind: "swap", playerIds: ["player-1", "player-2"] },
  });
});

function pending(kind: PendingDeathConsequence["kind"]): PendingDeathConsequence {
  return {
    stepId: `night:death:${kind}`,
    kind,
    sourceEventId: "death-1",
    deathSequence: 1,
    actorPlayerId: "player-1",
    sourceAbilityInstanceId: "ability-1",
    actorImpairedAtTrigger: false,
    allowedPlayerIds: kind === "klutz" ? ["player-2", "player-3"] : players.map((candidate) => candidate.id),
    eligibleChooserPlayerIds: ["player-3"],
  };
}

function player(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  alignment: "good" | "evil",
  alive: boolean,
): Player {
  return {
    id, seat, name, actualCharacter, shownCharacter: actualCharacter, alignment, alive,
    ghostVoteUsed: false, deathAnnounced: !alive, systemTokenIds: [], scriptTokens: [], notes: "",
  };
}
