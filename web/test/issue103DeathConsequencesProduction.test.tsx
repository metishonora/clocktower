import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PendingDeathConsequence, PhaseStep, Player, ReplayState } from "../src/core/types";
import { DeathConsequencePanel } from "../src/features/death-consequences/DeathConsequencePanel";
import { SectsAndVioletsLiveGrimoire, SectsAndVioletsLiveProgress } from "../src/sectsAndVioletsLivePhase";

const players: Player[] = [
  player("player-1", 1, "가람", "klutz", "good", false),
  player("player-2", 2, "나래", "dreamer", "good", true),
  player("player-3", 3, "다온", "vortox", "evil", true),
];

test.each([
  ["sweetheart", "사랑꾼", "당신이 사망할 때, 지금부터 플레이어 1명은 취함 상태가 됩니다."],
  ["barber", "이발사", "오늘 낮 또는 오늘 밤에 사망했다면, 악마는 플레이어 2명(다른 악마는 제외)을 선택하여 그 두 명의 캐릭터를 맞바꿀 수 있습니다."],
  ["klutz", "얼뜨기", "당신이 사망했다는 사실을 알게 될 때, 생존한 플레이어 1명을 공개적으로 선택합니다: 그가 악한 플레이어라면, 당신이 속한 팀이 패배합니다."],
] as const)("shows the %s phase as a standard character action card", async (kind, roleName, ability) => {
  const onChooseTarget = vi.fn();
  const rolePlayers = consequencePlayers(kind);
  render(
    <DeathConsequencePanel
      pending={pending(kind)}
      players={rolePlayers}
      operationBusy={false}
      onResolve={vi.fn()}
      onChooseTarget={onChooseTarget}
    />,
  );

  const panel = screen.getByRole("group", { name: `${roleName} 능력 처리` });
  expect(panel.classList.contains("snvDeathConsequence")).toBe(true);
  expect(within(panel).getByRole("button", { name: `${roleName} 캐릭터 상세 열기` })).toBeTruthy();
  expect(within(panel).getByText("1번 가람")).toBeTruthy();
  expect(within(panel).getByRole("heading", { name: roleName, level: 3 })).toBeTruthy();
  expect(within(panel).getByText(ability)).toBeTruthy();
  await userEvent.setup().click(within(panel).getByRole("button", { name: "← 선택" }));
  expect(onChooseTarget).toHaveBeenCalledTimes(1);
});

test("an acquired death consequence keeps Philosopher as the actor and shows the triggering ability separately", () => {
  const philosopher = player("player-1", 1, "가람", "philosopher", "good", false);
  render(
    <DeathConsequencePanel
      pending={pending("sweetheart")}
      players={[philosopher]}
      operationBusy={false}
      onResolve={vi.fn()}
      onChooseTarget={vi.fn()}
    />,
  );

  const panel = screen.getByRole("group", { name: "사랑꾼 능력 처리" });
  expect(within(panel).getByRole("button", { name: "철학자 캐릭터 상세 열기" })).toBeTruthy();
  expect(within(panel).getByRole("heading", { level: 3, name: "철학자" })).toBeTruthy();
  const ability = within(panel).getByRole("button", { name: "사랑꾼 캐릭터 상세 열기" });
  expect(within(ability).getByText("획득한 능력")).toBeTruthy();
  expect(within(ability).getByText("사랑꾼")).toBeTruthy();
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
      priorityPanel={<DeathConsequencePanel pending={pending("klutz")} players={consequencePlayers("klutz")} operationBusy={false} onResolve={vi.fn()} />}
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

test("highlights the Sweetheart target strongly and uses seat-name labels without life state", async () => {
  const onSeatClick = vi.fn();
  const onConfirm = vi.fn();
  render(
    <SectsAndVioletsLiveGrimoire
      players={players.map((candidate) => ({
        ...candidate,
        characterName: candidate.actualCharacter,
        characterKind: candidate.actualCharacter === "vortox" ? "demon" : candidate.actualCharacter === "klutz" ? "outsider" : "townsfolk",
      }))}
      phaseLabel="1일차 낮"
      currentStep={{
        id: "day:executionDeath",
        phase: "day",
        stepType: "executionDeath",
        requiredInput: { kind: "executionDeathDecision", optional: false },
        canSkip: false,
      }}
      handoff={{ kind: "sweetheart", complete: false, actorPlayerId: "player-1" }}
      voterIds={[]}
      targetId="player-2"
      selectablePlayerIds={players.map((candidate) => candidate.id)}
      operationBusy={false}
      onSeatClick={onSeatClick}
      onConfirm={onConfirm}
      onReturn={vi.fn()}
      onCancelDayHandoff={vi.fn()}
      onResetDaySelection={vi.fn()}
      onGoToProgress={vi.fn()}
      onReturnToSetup={vi.fn()}
    />,
  );

  expect(screen.getByRole("region", { name: "낮 마도서" })).toBeTruthy();
  const selectedTarget = screen.getByRole("button", { name: /2번 좌석, 나래/ });
  expect(selectedTarget.classList.contains("snvSeatStateDrunkTarget")).toBe(true);
  await userEvent.setup().click(selectedTarget);
  expect(onSeatClick).toHaveBeenCalledWith("player-2");
  const work = screen.getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(work).getByText("1번 가람")).toBeTruthy();
  expect(within(work).getByText("2번 나래")).toBeTruthy();
  expect(work.textContent).not.toContain("생존");
  expect(work.textContent).not.toContain("사망");
  await userEvent.setup().click(within(work).getByRole("button", { name: "2번 나래 취함 적용" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("moves the Barber Demon and two-player swap decision into the grimoire", async () => {
  const onConfirm = vi.fn();
  const onDecline = vi.fn();
  render(
    <SectsAndVioletsLiveGrimoire
      players={livePlayers("barber")}
      phaseLabel="1일차 낮"
      currentStep={dayConsequenceStep("barber")}
      handoff={{ kind: "barber", complete: false, actorPlayerId: "player-3", selectionStage: "swap" }}
      chooserId="player-3"
      voterIds={[]}
      targetIds={["player-1", "player-2"]}
      selectablePlayerIds={["player-1", "player-2", "player-3"]}
      operationBusy={false}
      onSeatClick={vi.fn()}
      onConfirm={onConfirm}
      onDecline={onDecline}
      onReturn={vi.fn()}
      onCancelDayHandoff={vi.fn()}
      onResetDaySelection={vi.fn()}
      onGoToProgress={vi.fn()}
      onReturnToSetup={vi.fn()}
    />,
  );

  const work = screen.getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(work).getByRole("heading", { name: "이발사 직업 교환" })).toBeTruthy();
  expect(within(work).getByText("3번 다온")).toBeTruthy();
  expect(within(work).getByText("1번 가람")).toBeTruthy();
  expect(within(work).getByText("2번 나래")).toBeTruthy();
  expect(work.textContent).not.toContain("생존");
  expect(work.textContent).not.toContain("사망");
  await userEvent.setup().click(within(work).getByRole("button", { name: "교환하지 않음" }));
  await userEvent.setup().click(within(work).getByRole("button", { name: "직업 교환" }));
  expect(onDecline).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("moves the Klutz living-player choice into the grimoire", async () => {
  render(
    <SectsAndVioletsLiveGrimoire
      players={livePlayers("klutz")}
      phaseLabel="1일차 낮"
      currentStep={dayConsequenceStep("klutz")}
      handoff={{ kind: "klutz", complete: false, actorPlayerId: "player-1" }}
      voterIds={[]}
      targetId="player-2"
      selectablePlayerIds={["player-2", "player-3"]}
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

  expect((screen.getByRole("button", { name: /1번 좌석, 가람/ }) as HTMLButtonElement).disabled).toBe(true);
  const work = screen.getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(work).getByRole("heading", { name: "얼뜨기 선택" })).toBeTruthy();
  expect(within(work).getByText("1번 가람")).toBeTruthy();
  expect(within(work).getByText("2번 나래")).toBeTruthy();
  expect(within(work).getByRole("button", { name: "2번 나래 선택 확정" })).toBeTruthy();
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

function consequencePlayers(kind: PendingDeathConsequence["kind"]): Player[] {
  return players.map((candidate) => candidate.id === "player-1"
    ? {
        ...candidate,
        actualCharacter: kind,
        shownCharacter: kind,
        abilityInstance: { id: "ability-1", characterId: kind, sourceEventId: "setup" },
      }
    : candidate);
}

function livePlayers(kind: PendingDeathConsequence["kind"]) {
  return consequencePlayers(kind).map((candidate) => ({
    ...candidate,
    characterName: candidate.actualCharacter,
    characterKind: candidate.actualCharacter === "vortox" ? "demon" as const : candidate.actualCharacter === "dreamer" ? "townsfolk" as const : "outsider" as const,
  }));
}

function dayConsequenceStep(kind: PendingDeathConsequence["kind"]): PhaseStep {
  return {
    id: `day:death:${kind}`,
    phase: "day",
    stepType: "character",
    character: kind,
    playerId: "player-1",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
  };
}
