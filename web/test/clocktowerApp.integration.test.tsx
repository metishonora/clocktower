import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

describe("ClocktowerApp live-play integration", () => {
  test("confirms a current step through Command, canonical event, replay, event log, and autosave", async () => {
    const currentStep = step({
      id: "firstNight:poisoner",
      character: "poisoner",
      playerId: "player-4",
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
    });
    const nextStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
    });
    const canonicalEvent = event("event-poisoner", "중독자가 1번 Ada를 선택함");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "독살자: 4번 Dae" });
    expect(storage.loadLatestGame).toHaveBeenCalledTimes(1);
    const stepInput = screen.getByLabelText("단계 입력");
    await user.click(within(stepInput).getByRole("button", { name: /Ada/ }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledTimes(1);
    expect(core.propose).toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ events: [expect.any(Object)] }) }),
      {
        type: "confirmStep",
        payload: {
          stepId: "firstNight:poisoner",
          input: { playerIds: ["player-1"] },
        },
      },
    );
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    expect(screen.getByText("중독자가 1번 Ada를 선택함")).toBeTruthy();

    await waitFor(() => {
      const savedGame = latestSavedGame(storage.savedGames);
      expect(savedGame.game.events).toHaveLength(2);
      expect(savedGame.game.events[1]).toEqual(canonicalEvent);
      expect(
        savedGame.game.events.filter((savedEvent) => savedEvent.id === canonicalEvent.id),
      ).toHaveLength(1);
      expect(storage.saveLatestGame).toHaveBeenCalledWith(savedGame);
    });
    expect(core.replay).toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ events: [expect.any(Object), canonicalEvent] }) }),
    );
  });

  test("keeps a confirmed Reveal repeatable until explicit continue to the replayed current step", async () => {
    const revealStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
    });
    const followUpStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
    });
    const canonicalEvent = event("event-chef", "요리사 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep }),
      replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, {
        previewMessageKo: "악 팀 이웃 수를 공개합니다.",
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      }),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await user.click(screen.getByRole("button", { name: "확정" }));
    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(screen.getByRole("heading", { name: "확정된 정보 공개" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "공감능력자: 3번 Cy" })).toBeNull();
    const preview = within(followup).getByLabelText("Reveal 미리보기");
    expect(within(preview).getByText("악 팀 이웃 수를 공개합니다.")).toBeTruthy();

    await waitFor(() => {
      const continueButton = within(followup).getByRole("button", { name: "다음 단계로 계속" }) as HTMLButtonElement;
      expect(continueButton.disabled).toBe(false);
      const savedGame = latestSavedGame(storage.savedGames);
      expect(savedGame.game.events.filter((savedEvent) => savedEvent.id === canonicalEvent.id)).toHaveLength(1);
    });
    const replayCallsAfterConfirm = vi.mocked(core.replay).mock.calls.length;

    await user.click(within(preview).getByRole("button", { name: "플레이어에게 공개" }));
    const revealScreen = screen.getByLabelText("플레이어 공개 화면");
    expect(within(revealScreen).getByRole("heading", { name: "서로 이웃한 악한 팀 쌍" })).toBeTruthy();
    expect(within(revealScreen).getByText("1쌍")).toBeTruthy();
    expect(screen.queryByText("그리모어")).toBeNull();
    expect(screen.queryByText("이벤트 로그")).toBeNull();

    await user.click(within(revealScreen).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
    expect(screen.queryByLabelText("플레이어 공개 화면")).toBeNull();
    expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "공감능력자: 3번 Cy" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
    const reopenedReveal = screen.getByLabelText("플레이어 공개 화면");
    await user.click(within(reopenedReveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));

    expect(core.propose).toHaveBeenCalledTimes(1);
    expect(vi.mocked(core.replay).mock.calls).toHaveLength(replayCallsAfterConfirm);
    await user.click(screen.getByRole("button", { name: "다음 단계로 계속" }));
    expect(await screen.findByRole("heading", { name: "공감능력자: 3번 Cy" })).toBeTruthy();
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  });

  test("undoing the confirmed information clears its pending Reveal", async () => {
    const revealStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
    });
    const followUpStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
    });
    const canonicalEvent = event("event-chef", "요리사 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep }),
      replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, {
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      }),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const confirmDialog = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await user.click(screen.getByRole("button", { name: "확정" }));
    await screen.findByLabelText("확정된 Reveal 후속 조치");
    await user.click(screen.getByRole("button", { name: "설정 다시 수정" }));

    expect(await screen.findByRole("heading", { name: "요리사: 2번 Bert" })).toBeTruthy();
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    await waitFor(() => {
      expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(1);
    });
    confirmDialog.mockRestore();
  });

  test("selects nominator, nominee, and seat-map voters through the visible vote preview and confirm path", async () => {
    const votingStep = step({
      id: "day:nomination:1",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const nextVotingStep = step({
      id: "day:nomination:2",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const canonicalEvent = event("event-vote", "1번 Ada가 5번 Eun을 지명 · 2표", "day");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: votingStep, dayState: { nominations: [] } }),
      replayAfterProposal: replayState({
        currentStep: nextVotingStep,
        eventCount: 2,
        dayState: {
          nominations: [
            {
              stepId: votingStep.id,
              nominatorId: "player-1",
              nomineeId: "player-5",
              voterIds: ["player-1", "player-2"],
              voteCount: 2,
              ghostVoteSpentPlayerIds: ["player-2"],
              updatesExecutionCandidate: false,
            },
          ],
        },
      }),
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "지명과 투표 1" });
    await user.selectOptions(screen.getByRole("combobox", { name: "지명자" }), "player-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "피지명자" }), "player-5");
    const seatMap = screen.getByLabelText("조정 가능한 그리모어 좌석 맵");
    await user.click(within(seatMap).getByRole("button", { name: /Ada/ }));
    await user.click(within(seatMap).getByRole("button", { name: /Bert/ }));

    const votePreview = screen.getByText("현재 표").closest("dl");
    if (!votePreview) throw new Error("vote preview was not rendered");
    expect(within(votePreview).getByText("2표")).toBeTruthy();
    expect(within(votePreview).getByText(/2번 Bert/)).toBeTruthy();
    expect(within(votePreview).getByText("후보 갱신: 5번 Eun · 2표")).toBeTruthy();

    const confirmButton = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    await user.click(confirmButton);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "day:nomination:1",
        input: {
          nominatorId: "player-1",
          nomineeId: "player-5",
          voterIds: ["player-1", "player-2"],
        },
      },
    });
    expect(await screen.findByRole("heading", { name: "지명과 투표 2" })).toBeTruthy();
  });
});

function latestSavedGame(savedGames: GameFile[]): GameFile {
  const savedGame = savedGames.at(-1);
  if (!savedGame) throw new Error("game was not autosaved");
  return savedGame;
}
