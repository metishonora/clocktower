import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ClocktowerApp } from "../src/main";
import type { Proposal } from "../src/core/types";
import {
  createCoreHarness,
  gameFile,
  MemoryGameStorageDriver,
  replayState,
  step,
} from "./clocktowerAppHarness";

test("warning confirmation ends the game and protected Undo restores the live step", async () => {
  let now = 1_000;
  const currentStep = step({ id: "day:discussion", phase: "day", stepType: "discussion" });
  const initialReplay = replayState({ currentStep });
  initialReplay.warnings = [{
    code: "DEMON_DEAD_GOOD_WIN",
    severity: "warning",
    messageKo: "악마 사망: 선 승리 확인 필요",
    winningTeam: "good",
  }];
  const endedReplay = replayState({ currentStep, eventCount: 2 });
  endedReplay.currentStep = null;
  endedReplay.phaseOverview = [];
  endedReplay.gameEnd = { eventId: "game-ended-2", winningTeam: "good" };
  const proposal: Proposal = {
    event: {
      id: "game-ended-2",
      type: "gameEnded",
      phase: "day",
      payload: { winningTeam: "good" },
      summary: "게임 종료 · 선한 팀 승리",
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    warnings: [],
    followUpSteps: [],
    preview: {},
  };
  const core = createCoreHarness({ initialReplay, replayAfterProposal: endedReplay, proposal });
  const user = userEvent.setup();
  render(
    <ClocktowerApp
      coreAdapter={core}
      storageDriver={new MemoryGameStorageDriver(gameFile())}
      phaseRuntimeClock={{ now: () => now }}
    />,
  );

  const warning = await screen.findByRole("region", { name: "승리 조건 경고" });
  expect(screen.getByLabelText("2일차 낮 경과 시간 00:00")).toBeTruthy();
  now += 5 * 60_000;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByLabelText("2일차 낮 경과 시간 05:00")).toBeTruthy();
  await user.click(within(warning).getByRole("button", { name: "게임 종료 확인" }));
  const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
  expect(within(dialog).queryByRole("button", { name: "악" })).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));

  expect(await screen.findByRole("heading", { name: "선한 팀 승리" })).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "마도서" }));
  const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByText("게임 종료")).toBeTruthy();
  expect(within(grimoire).queryByLabelText(/경과 시간/)).toBeNull();
  expect(screen.queryByLabelText("단계 입력")).toBeNull();
  const endedSeat = within(grimoire).getByRole("button", { name: /1번 Ada 좌석 선택/ });
  expect((endedSeat as HTMLButtonElement).disabled).toBe(true);
  await user.click(endedSeat);
  expect(core.propose).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "진행" }));
  await user.click(screen.getByRole("button", { name: "게임 종료 되돌리기" }));
  const undo = screen.getByRole("dialog", { name: "최근 확정 행동을 되돌릴까요?" });
  await user.click(within(undo).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => expect(screen.getByRole("region", { name: "현재 단계" })).not.toBeNull());
  expect(screen.getByRole("region", { name: "승리 조건 경고" })).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "마도서" }));
  expect(within(await screen.findByLabelText("라이브 마도서 좌석 맵")).getByLabelText("2일차 낮 경과 시간 00:00")).toBeTruthy();
});
