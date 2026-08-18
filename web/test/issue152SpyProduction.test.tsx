import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { RevealPayload } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver, createCoreHarness, event, gameFile, players, proposal, replayState, step } from "./clocktowerAppHarness";

test("opens the Spy Grimoire directly from 정보 공개 and returns to replay or continue", async () => {
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
  const currentTask = screen.getByRole("region", { name: "현재 단계" });
  expect(within(currentTask).queryByRole("button", { name: "확정" })).toBeNull();
  await user.click(within(currentTask).getByRole("button", { name: "정보 공개" }));

  await screen.findByRole("button", { name: "확인 완료" });
  const reveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  expect(screen.queryByRole("button", { name: "플레이어에게 공개" })).toBeNull();
  expect(within(reveal).getByRole("navigation", { name: "작업 단계" })).toBeTruthy();
  expect(within(reveal).getByRole("button", { name: "확인 완료" })).toBeTruthy();
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

  await user.click(within(reveal).getByRole("button", { name: "확인 완료" }));
  expect(await screen.findByRole("main", { name: "Trouble Brewing 진행" })).toBeTruthy();
  expect(screen.queryByRole("main", { name: "첩자 공개 종료" })).toBeNull();
  const reviewedTask = await screen.findByRole("region", { name: "첩자 정보" });
  const replayButton = within(reviewedTask).getByRole("button", { name: "마도서 다시 공개" });
  const continueButton = within(reviewedTask).getByRole("button", { name: "다음 단계" }) as HTMLButtonElement;
  expect(continueButton.disabled).toBe(false);

  await user.click(replayButton);
  await screen.findByRole("button", { name: "확인 완료" });
  const reopenedReveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  expect(core.propose).toHaveBeenCalledTimes(1);
  await user.click(within(reopenedReveal).getByRole("button", { name: "확인 완료" }));
  const replayedTask = await screen.findByRole("region", { name: "첩자 정보" });
  expect(within(replayedTask).getByRole("button", { name: "마도서 다시 공개" })).toBeTruthy();

  await user.click(within(replayedTask).getByRole("button", { name: "다음 단계" }));

  await waitFor(() => expect(screen.queryByRole("region", { name: "첩자 정보" })).toBeNull());
  expect(await screen.findByRole("heading", { name: "1일차 밤" })).toBeTruthy();
});

test("opens the locked Spy Grimoire from the proposal while canonical replay gates confirmation", async () => {
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
      reminderTokens: [],
    })),
  } as unknown as RevealPayload;
  const initialReplay = replayState({ currentStep: revealStep });
  const replayAfterProposal = replayState({ currentStep: followUpStep, eventCount: 2 });
  const core = createCoreHarness({
    initialReplay,
    replayAfterProposal,
    proposal: proposal(event("event-spy-delayed-replay", "첩자 정보 확정"), spyPayload),
  });
  let resolveReplayAfterProposal!: (result: { ok: true; value: typeof replayAfterProposal }) => void;
  const pendingReplay = new Promise<{ ok: true; value: typeof replayAfterProposal }>((resolve) => {
    resolveReplayAfterProposal = resolve;
  });
  vi.mocked(core.replay).mockImplementation(async (candidate) => {
    if (candidate.game.events.length < 2) return { ok: true, value: initialReplay };
    return pendingReplay;
  });
  const user = userEvent.setup();

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await screen.findByRole("heading", { name: "첩자: 4번 Dae" });
  await user.click(screen.getByRole("button", { name: "정보 공개" }));
  await waitFor(() => expect(core.propose).toHaveBeenCalledTimes(1));

  expect.soft(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  expect.soft(screen.queryByRole("region", { name: "첩자 정보" })).toBeNull();
  expect.soft(screen.queryByRole("button", { name: "마도서 다시 공개" })).toBeNull();
  const immediateConfirm = screen.queryByRole("button", { name: "확인 완료" });
  expect.soft(immediateConfirm).not.toBeNull();
  expect.soft((immediateConfirm as HTMLButtonElement | null)?.disabled).toBe(true);
  const immediateSeat = screen.queryByRole("button", { name: /2번 좌석/ });
  expect.soft(immediateSeat).not.toBeNull();
  const immediateReveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  expect.soft((within(immediateReveal).getByRole("button", { name: "직업" }) as HTMLButtonElement).disabled).toBe(true);
  expect.soft((within(immediateReveal).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);

  await act(async () => {
    resolveReplayAfterProposal({ ok: true, value: replayAfterProposal });
    await pendingReplay;
  });

  const readyConfirm = await screen.findByRole("button", { name: "확인 완료" }) as HTMLButtonElement;
  await waitFor(() => expect(readyConfirm.disabled).toBe(false));
  expect(core.propose).toHaveBeenCalledTimes(1);
});

test("closes the provisional Spy Grimoire and restores its action when canonical replay fails", async () => {
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
      reminderTokens: [],
    })),
  } as unknown as RevealPayload;
  const initialReplay = replayState({ currentStep: revealStep });
  const replayFailure = {
    ok: false as const,
    error: { code: "REPLAY_FAILED", messageKo: "저장 로그 무효" },
  };
  const core = createCoreHarness({
    initialReplay,
    replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
    proposal: proposal(event("event-spy-replay-failure", "첩자 정보 확정"), spyPayload),
  });
  let resolveReplayAfterProposal!: (result: typeof replayFailure) => void;
  const pendingReplay = new Promise<typeof replayFailure>((resolve) => {
    resolveReplayAfterProposal = resolve;
  });
  vi.mocked(core.replay).mockImplementation(async (candidate) => {
    if (candidate.game.events.length < 2) return { ok: true, value: initialReplay };
    return pendingReplay;
  });
  const user = userEvent.setup();

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await screen.findByRole("heading", { name: "첩자: 4번 Dae" });
  await user.click(screen.getByRole("button", { name: "정보 공개" }));

  const provisionalConfirm = await screen.findByRole("button", { name: "확인 완료" }) as HTMLButtonElement;
  expect(provisionalConfirm.disabled).toBe(true);
  expect(screen.getByRole("button", { name: /2번 좌석/ })).toBeTruthy();

  await act(async () => {
    resolveReplayAfterProposal(replayFailure);
    await pendingReplay;
  });

  await waitFor(() => expect(screen.queryByRole("button", { name: "확인 완료" })).toBeNull());
  expect(screen.queryByRole("region", { name: "첩자 정보" })).toBeNull();
  const restoredTask = screen.getByRole("region", { name: "현재 단계" });
  expect(within(restoredTask).getByRole("heading", { name: "첩자: 4번 Dae" })).toBeTruthy();
  const restoredReveal = within(restoredTask).getByRole("button", { name: "정보 공개" }) as HTMLButtonElement;
  expect(restoredReveal.disabled).toBe(false);
  expect(core.propose).toHaveBeenCalledTimes(1);
});
