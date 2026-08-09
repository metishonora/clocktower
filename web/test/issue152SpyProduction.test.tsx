import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { RevealPayload } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver, createCoreHarness, event, gameFile, players, proposal, replayState, step } from "./clocktowerAppHarness";

test("renders the Spy reveal in the locked live Trouble Brewing shell and advances from its center action", async () => {
  const revealStep = step({
    id: "firstNight:spy",
    character: "spy",
    playerId: "player-4",
  });
  const followUpStep = step({
    id: "firstNight:toDay",
    kind: "none",
    stepType: "phaseTransition",
  });
  const spyPayload = {
    kind: "spyGrimoire",
    players: players().map((player) => ({
      playerId: player.id,
      seat: player.seat,
      name: player.name,
      characterId: player.actualCharacter,
      alive: player.alive,
      ghostVoteUsed: player.ghostVoteUsed,
      reminderTokens: player.seat === 2 ? ["poisoned"] : [],
      automaticReminders: player.seat === 2 ? [{
        playerId: player.id,
        characterId: "poisoner",
        tokenId: "poisoned",
        label: "중독",
        description: "독살범의 능력으로 현재 중독된 상태입니다.",
        sourceEventId: "event-poison",
      }] : [],
    })),
  } as unknown as RevealPayload;
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep: revealStep }),
    replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
    proposal: proposal(event("event-spy", "첩자 정보 확정"), spyPayload),
  });
  const user = userEvent.setup();

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await screen.findByRole("heading", { name: "첩자: 4번 Dae" });
  await user.click(screen.getByRole("button", { name: "마도서" }));
  await user.click(screen.getByRole("button", { name: "진행" }));
  await user.click(screen.getByRole("button", { name: "확정" }));
  const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
  await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));

  const reveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  expect(within(reveal).getByRole("navigation", { name: "작업 단계" })).toBeTruthy();
  expect(within(reveal).getByRole("button", { name: "열람 종료" })).toBeTruthy();
  expect(within(reveal).queryByText("확인했으면 눈을 감으세요")).toBeNull();
  expect(within(reveal).queryByText("다시 열람")).toBeNull();
  expect((within(reveal).getByRole("button", { name: "직업" }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(reveal).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(reveal).getByRole("button", { name: "새 게임" }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(reveal).getByRole("button", { name: "저장 / 불러오기" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(reveal).getByRole("link", { name: "스크립트 선택" }).getAttribute("aria-disabled")).toBe("true");

  const seat = within(reveal).getByRole("button", { name: /2번 좌석/ });
  expect((seat as HTMLButtonElement).disabled).toBe(false);
  await user.click(seat);
  const detail = screen.getByRole("dialog", { name: "2번 Bert 플레이어 상세" });
  expect(within(detail).getByRole("list", { name: "부착된 토큰 1개" })).toBeTruthy();
  expect(within(detail).getByRole("listitem", { name: /자동 규칙 · 중독 · 출처 독살범/ })).toBeTruthy();

  await user.click(within(reveal).getByRole("button", { name: "열람 종료" }));
  expect(screen.queryByRole("main", { name: "Trouble Brewing 진행" })).toBeNull();
  const endedShell = screen.getByRole("main", { name: "첩자 공개 종료" });
  expect(within(endedShell).getByText("SPY REVEAL")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "열람을 종료했습니다" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "다시 열람" })).toBeNull();
  const ended = screen.getByRole("region", { name: "첩자 공개 종료 안내" });
  const continueButton = within(ended).getByRole("button", { name: "진행" }) as HTMLButtonElement;
  expect(continueButton.disabled).toBe(false);
  await user.click(continueButton);

  await waitFor(() => expect(screen.queryByRole("heading", { name: "열람을 종료했습니다" })).toBeNull());
  expect(await screen.findByRole("heading", { name: "1일차 밤" })).toBeTruthy();
});
