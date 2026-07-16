import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
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

type MutableDayRuntimeClock = {
  now: () => number;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

test("keeps one wall-clock runtime through Day steps and foreground catch-up without replay or saves on ticks", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let now = 1_000;
  const clock: MutableDayRuntimeClock = { now: () => now };
  const whisperStep = step({ id: "day:whisper", stepType: "whisper", phase: "day" });
  const discussionStep = step({ id: "day:discussion", stepType: "discussion", phase: "day" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep: whisperStep }),
    replayAfterProposal: replayState({ currentStep: discussionStep, eventCount: 2 }),
    proposal: proposal(event("event-whisper", "밀담 종료", "day")),
  });
  const storage = new MemoryGameStorageDriver(gameFile());
  const user = userEvent.setup();
  const props = {
    coreAdapter: core,
    storageDriver: storage,
    dayRuntimeClock: clock,
  };

  render(<ClocktowerApp {...props} />);

  expect((await screen.findByLabelText("낮 경과 시간")).textContent).toContain("낮 경과 00:00");
  await waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));

  now += 5 * 60_000 + 7_000;
  await act(async () => vi.advanceTimersByTime(1_000));
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("낮 경과 05:07");

  await user.click(screen.getByRole("button", { name: "토론 시작" }));
  expect(await screen.findByRole("button", { name: "지명 및 투표 시작" })).toBeTruthy();
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("낮 경과 05:07");

  const replayCallsBeforeCatchUp = vi.mocked(core.replay).mock.calls.length;
  await waitFor(() => expect(storage.savedGames.length).toBeGreaterThan(0));
  const savesBeforeCatchUp = storage.savedGames.length;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  now = 1_000 + 42 * 60_000 + 17_000;
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("낮 경과 05:07");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));

  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("낮 경과 42:17");
  await act(async () => vi.advanceTimersByTime(3_000));
  expect(vi.mocked(core.replay).mock.calls).toHaveLength(replayCallsBeforeCatchUp);
  expect(storage.savedGames).toHaveLength(savesBeforeCatchUp);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2);
});

test("starts on a Night-to-Day transition, clears in Night, and restarts for the next Day", async () => {
  let now = 10_000;
  const clock: MutableDayRuntimeClock = { now: () => now };
  const nightOne = step({ id: "night:end:1", phase: "night" });
  const dayOne = step({ id: "day:whisper:1", stepType: "whisper", phase: "day" });
  const nightTwo = step({ id: "night:end:2", phase: "night" });
  const dayTwo = step({ id: "day:whisper:2", stepType: "whisper", phase: "day" });
  const states = [nightOne, nightOne, dayOne, nightTwo, dayTwo].map((currentStep, eventCount) =>
    replayState({ currentStep, eventCount: Math.max(1, eventCount) }),
  );
  const core = createCoreHarness({
    initialReplay: states[1],
    replayAfterProposal: states[2],
    proposal: proposal(event("unused", "단계 전환")),
  });
  vi.mocked(core.replay).mockImplementation(async (candidate) => ({
    ok: true,
    value: states[candidate.game.events.length] ?? states[states.length - 1],
  }));
  vi.mocked(core.propose).mockImplementation(async (candidate) => ({
    ok: true,
    value: proposal(event(`event-${candidate.game.events.length + 1}`, "단계 전환")),
  }));
  const user = userEvent.setup();
  const props = {
    coreAdapter: core,
    storageDriver: new MemoryGameStorageDriver(gameFile()),
    dayRuntimeClock: clock,
  };

  render(<ClocktowerApp {...props} />);

  await screen.findByRole("heading", { name: "night:end:1" });
  expect(screen.queryByLabelText("낮 경과 시간")).toBeNull();
  await user.click(screen.getByRole("button", { name: "확정" }));
  expect((await screen.findByLabelText("낮 경과 시간")).textContent).toContain("00:00");

  now += 10 * 60_000;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("10:00");
  await user.click(screen.getByRole("button", { name: "토론 시작" }));
  await screen.findByRole("heading", { name: "night:end:2" });
  expect(screen.queryByLabelText("낮 경과 시간")).toBeNull();

  now += 5 * 60_000;
  await user.click(screen.getByRole("button", { name: "확정" }));
  expect((await screen.findByLabelText("낮 경과 시간")).textContent).toContain("00:00");
});

test("hides the runtime in full-screen Reveal and preserves elapsed wall-clock time on return", async () => {
  let now = 2_000;
  const clock: MutableDayRuntimeClock = { now: () => now };
  const revealStep = step({ id: "day:chef", character: "chef", playerId: "player-2", phase: "day" });
  const nextStep = step({ id: "day:discussion", stepType: "discussion", phase: "day" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep: revealStep }),
    replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
    proposal: proposal(event("event-chef", "요리사 정보 확정", "day"), {
      messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
      labelKo: "서로 이웃한 악한 팀 쌍",
      valueKo: "1쌍",
    }),
  });
  const user = userEvent.setup();
  const props = {
    coreAdapter: core,
    storageDriver: new MemoryGameStorageDriver(gameFile()),
    dayRuntimeClock: clock,
  };

  render(<ClocktowerApp {...props} />);

  await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
  now += 3 * 60_000;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  await user.click(screen.getByRole("button", { name: "확정" }));
  const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("03:00");
  await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));
  const reveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(reveal).queryByLabelText("낮 경과 시간")).toBeNull();

  now += 2 * 60_000;
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("05:00");
});

test("successful import of an already-Day game starts a fresh transient runtime", async () => {
  let now = 3_000;
  const clock: MutableDayRuntimeClock = { now: () => now };
  const dayStep = step({ id: "day:discussion", stepType: "discussion", phase: "day" });
  const dayReplay = replayState({ currentStep: dayStep });
  const core = createCoreHarness({
    initialReplay: dayReplay,
    replayAfterProposal: dayReplay,
    proposal: proposal(event("unused", "unused", "day")),
  });
  const storage = new MemoryGameStorageDriver(gameFile());
  const user = userEvent.setup();
  const props = {
    coreAdapter: core,
    storageDriver: storage,
    dayRuntimeClock: clock,
  };

  render(<ClocktowerApp {...props} />);

  expect((await screen.findByLabelText("낮 경과 시간")).textContent).toContain("00:00");
  now += 12 * 60_000;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByLabelText("낮 경과 시간").textContent).toContain("12:00");

  await user.click(screen.getByText("설정 및 불러오기"));
  const imported = gameFile();
  imported.game.id = "imported-day-game";
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error("JSON file input was not rendered");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await user.upload(fileInput, new File([JSON.stringify(imported)], "day.json", { type: "application/json" }));

  await waitFor(() => expect(vi.mocked(core.replay)).toHaveBeenCalledWith(imported));
  expect((await screen.findByLabelText("낮 경과 시간")).textContent).toContain("00:00");
});

test("Setup omits a Day runtime", async () => {
  const setupStep = step({ id: "setup", phase: "setup" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep: setupStep, playerRoster: [] }),
    replayAfterProposal: replayState({ currentStep: setupStep, playerRoster: [] }),
    proposal: proposal(event("unused", "unused")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

  await screen.findByRole("heading", { name: "Trouble Brewing" });
  expect(screen.queryByLabelText("낮 경과 시간")).toBeNull();
});
