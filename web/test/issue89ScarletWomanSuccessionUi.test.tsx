import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { PhaseStep, Player } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  createCoreHarness,
  event,
  gameFile,
  MemoryGameStorageDriver,
  proposal,
  replayState,
} from "./clocktowerAppHarness";

test("renders fixed Scarlet Woman succession as a concise day confirmation rather than an Imp attack", async () => {
  const players: Player[] = [
    player("player-1", 1, "Ada", "washerwoman", "good"),
    player("player-2", 2, "Bert", "chef", "good"),
    player("player-3", 3, "Cy", "empath", "good"),
    player("player-4", 4, "Dae", "mayor", "good"),
    player("player-5", 5, "Eun", "scarletWoman", "evil"),
    player("player-6", 6, "Finn", "imp", "evil", false),
  ];
  const currentStep: PhaseStep = {
    id: "execution-death-18:demonSuccession",
    phase: "day",
    stepType: "demonSuccession",
    character: "imp",
    playerId: "player-5",
    requiredInput: {
      kind: "demonSuccession",
      demonSuccession: {
        kind: "fixed",
        triggerEventId: "execution-death-18",
        successorPlayerId: "player-5",
      },
      optional: false,
    },
    canSkip: false,
  };
  const replay = replayState({ currentStep, playerRoster: players });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused", "day")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  expect(await screen.findByRole("heading", { name: "탕녀 승계" })).toBeTruthy();
  const current = screen.getByLabelText("현재 단계");
  expect(within(current).getByText("5번 Eun · 탕녀 → 임프")).toBeTruthy();
  expect(within(current).getByRole("button", { name: "승계 확정" })).toBeTruthy();
  expect(within(current).queryByLabelText("현재 행동자")).toBeNull();
  expect(within(current).queryByLabelText("단계 입력")).toBeNull();
  expect(within(current).queryByText("오늘 밤 공격할 플레이어 1명을 선택하세요.")).toBeNull();
});

test("requires the new Imp role reveal before showing the next-night attack controls", async () => {
  const user = userEvent.setup();
  const players: Player[] = [
    player("player-1", 1, "Ada", "washerwoman", "good"),
    player("player-2", 2, "Bert", "chef", "good"),
    player("player-3", 3, "Cy", "empath", "good"),
    player("player-4", 4, "Dae", "mayor", "good"),
    player("player-5", 5, "Eun", "imp", "evil"),
    player("player-6", 6, "Finn", "scarletWoman", "evil"),
  ];
  const currentStep: PhaseStep = {
    id: "night:imp",
    phase: "night",
    stepType: "character",
    character: "imp",
    playerId: "player-5",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      optional: false,
    },
    canSkip: true,
    preActionReveal: {
      kind: "characterChange",
      sourceEventId: "demon-succession-19",
      playerId: "player-5",
      alignment: "evil",
      characterId: "imp",
    },
  };
  const replay = replayState({ currentStep, playerRoster: players });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused", "night")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  expect(await screen.findByRole("heading", { name: "새 임프 직업 변경 안내" })).toBeTruthy();
  expect(screen.queryByText("오늘 밤 공격할 플레이어 1명을 선택하세요.")).toBeNull();
  await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
  expect(screen.getByRole("heading", { name: "당신의 역할이 변경되었습니다." })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "확인했다면 눈을 감으세요." }));
  expect(await screen.findByRole("heading", { name: "임프: 5번 Eun" })).toBeTruthy();
  expect(screen.getByText("오늘 밤 공격할 플레이어 1명을 선택하세요.")).toBeTruthy();
});

function player(
  id: string,
  seat: number,
  name: string,
  character: string,
  alignment: Player["alignment"],
  alive = true,
): Player {
  return {
    id,
    seat,
    name,
    actualCharacter: character,
    shownCharacter: character,
    alignment,
    alive,
    ghostVoteUsed: false,
    deathAnnounced: !alive,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
