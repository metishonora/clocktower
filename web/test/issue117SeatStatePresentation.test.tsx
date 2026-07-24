import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  SectsAndVioletsLiveGrimoire,
  type LiveHandoff,
  type LivePlayer,
} from "../src/sectsAndVioletsLivePhase";
import type { PhaseStep } from "../src/core/types";

const dayStep: PhaseStep = {
  id: "day:discussion",
  phase: "day",
  stepType: "discussion",
  requiredInput: { kind: "none", optional: false },
  canSkip: false,
};

test.each([7, 15])(
  "renders persistent death presentation without hiding character identity at %i players",
  (playerCount) => {
    renderGrimoire({ players: players(playerCount, [3]) });

    const grimoire = screen.getByLabelText(`${playerCount}자리 그리모어`);
    const deadSeat = within(grimoire).getByRole("button", {
      name: /3번 좌석, 플레이어 3, 시계공.*사망/,
    });
    const livingSeat = within(grimoire).getByRole("button", {
      name: /2번 좌석, 플레이어 2, 시계공.*생존/,
    });

    expect(grimoire.querySelectorAll("button.assigned")).toHaveLength(playerCount);
    expect(deadSeat.classList.contains("snvDeadSeat")).toBe(true);
    expect(deadSeat.querySelector("img")).toBeTruthy();
    expect(deadSeat.querySelector(".snvFuneralIcon")).toBeTruthy();
    expect(livingSeat.classList.contains("snvDeadSeat")).toBe(false);
    expect(livingSeat.querySelector(".snvFuneralIcon")).toBeNull();
  },
);

test("preserves diffuse actor and target emphasis when both players are dead", () => {
  const currentStep: PhaseStep = {
    ...dayStep,
    id: "night:snakeCharmer:player-1",
    phase: "night",
    stepType: "character",
    character: "snakeCharmer",
    playerId: "player-1",
    requiredInput: {
      kind: "playerIds",
      optional: false,
      allowedPlayerIds: ["player-2", "player-3", "player-4", "player-5", "player-6", "player-7"],
    },
  };
  renderGrimoire({
    players: players(7, [1, 2]),
    currentStep,
    handoff: { kind: "snakeCharmer", complete: false, actorPlayerId: "player-1" },
    targetId: "player-2",
  });

  const actor = screen.getByRole("button", { name: /1번 좌석.*사망.*현재 행동자.*선택 불가/ });
  const target = screen.getByRole("button", { name: /2번 좌석.*사망.*선택 대상/ });

  expect(actor.classList.contains("snvDeadSeat")).toBe(true);
  expect(actor.classList.contains("snvSeatStateActor")).toBe(true);
  expect(actor.classList.contains("issue116IneligibleSeat")).toBe(true);
  expect(target.classList.contains("snvDeadSeat")).toBe(true);
  expect(target.classList.contains("snvSeatStateTarget")).toBe(true);
  expect(target.getAttribute("aria-pressed")).toBe("true");
});

test("keeps the completed Demon actor and result prominent without a duplicate center result", () => {
  renderGrimoire({
    players: players(7, [1, 2]),
    handoff: { kind: "demon", complete: true, actorPlayerId: "player-1" },
    targetId: "player-2",
  });

  const actor = screen.getByRole("button", { name: /1번 좌석.*현재 행동자/ });
  const target = screen.getByRole("button", { name: /2번 좌석.*공격 대상/ });
  const unrelated = screen.getByRole("button", { name: /3번 좌석/ });

  expect(actor.classList.contains("snvSettledOtherSeat")).toBe(false);
  expect(target.classList.contains("snvSettledOtherSeat")).toBe(false);
  expect(unrelated.classList.contains("snvSettledOtherSeat")).toBe(true);
  expect(screen.queryByRole("status", { name: "대상 선택 완료" })).toBeNull();
  expect(screen.getByRole("group", { name: "현재 단계" }).textContent).toContain("2일차 낮");
  const resultPanel = screen.getByLabelText("현재 마도서 작업");
  expect(resultPanel.classList.contains("snvSelectionCompletePanel")).toBe(true);
  expect(within(resultPanel).getByRole("heading", { name: "악마 공격 결과" })).toBeTruthy();
  expect(within(resultPanel).queryByText("처리 완료")).toBeNull();
});

test("keeps a completed Snake Charmer selection only in the result panel", () => {
  renderGrimoire({
    players: players(7, [1, 2]),
    currentStep: snakeCharmerStep(),
    phaseLabel: "2일차 밤",
    handoff: { kind: "snakeCharmer", complete: true, actorPlayerId: "player-1" },
    targetId: "player-2",
  });

  expect(screen.queryByRole("status", { name: "대상 선택 완료" })).toBeNull();
  expect(screen.getByRole("group", { name: "현재 단계" }).textContent).toContain("2일차 밤");
  const resultPanel = screen.getByLabelText("현재 마도서 작업");
  expect(within(resultPanel).getByRole("heading", { name: "뱀 조련사 결과" })).toBeTruthy();
  expect(within(resultPanel).queryByText("처리 완료")).toBeNull();
});

test.each([
  ["nomination", "지명 결과"],
  ["vote", "투표 결과"],
  ["demon", "악마 공격 결과"],
  ["snakeCharmer", "뱀 조련사 결과"],
] as const)("uses one result heading for a completed %s handoff", (kind, expectedHeading) => {
  renderGrimoire({
    players: players(7, []),
    handoff: { kind, complete: true, actorPlayerId: "player-1" },
    targetId: "player-2",
  });

  const resultPanel = screen.getByLabelText("현재 마도서 작업");
  expect(within(resultPanel).getByRole("heading", { name: expectedHeading })).toBeTruthy();
  expect(within(resultPanel).queryByText("처리 완료")).toBeNull();
});

function renderGrimoire({
  players: fixturePlayers,
  currentStep = dayStep,
  phaseLabel = "2일차 낮",
  handoff,
  targetId,
}: {
  players: LivePlayer[];
  currentStep?: PhaseStep;
  phaseLabel?: string;
  handoff?: LiveHandoff;
  targetId?: string;
}) {
  return render(
    <SectsAndVioletsLiveGrimoire
      players={fixturePlayers}
      phaseLabel={phaseLabel}
      currentStep={currentStep}
      handoff={handoff}
      voterIds={[]}
      targetId={targetId}
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
}

function snakeCharmerStep(): PhaseStep {
  return {
    ...dayStep,
    id: "night:snakeCharmer:player-1",
    phase: "night",
    stepType: "character",
    character: "snakeCharmer",
    playerId: "player-1",
    requiredInput: {
      kind: "playerIds",
      optional: false,
      allowedPlayerIds: ["player-2", "player-3", "player-4", "player-5", "player-6", "player-7"],
    },
  };
}

function players(count: number, deadSeats: number[]): LivePlayer[] {
  return Array.from({ length: count }, (_, index) => {
    const seat = index + 1;
    return {
      id: `player-${seat}`,
      seat,
      name: `플레이어 ${seat}`,
      actualCharacter: "clockmaker",
      shownCharacter: "clockmaker",
      alignment: "good",
      alive: !deadSeats.includes(seat),
      ghostVoteUsed: false,
      deathAnnounced: deadSeats.includes(seat),
      systemTokenIds: [],
      scriptTokens: [],
      notes: "",
      characterName: "시계공",
      characterKind: "townsfolk",
    };
  });
}
