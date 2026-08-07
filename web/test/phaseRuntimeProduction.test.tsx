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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

test("shows one numbered First Night, Day, Night, and later Day runtime inside the Grimoire table marker", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let now = 1_000;
  const clock = { now: () => now };
  const firstNight = step({
    id: "firstNight:toDay",
    phase: "firstNight",
    stepType: "phaseTransition",
    kind: "day",
  });
  const firstDay = step({
    id: "day:toNight",
    phase: "day",
    stepType: "phaseTransition",
    kind: "night",
  });
  const secondNight = step({
    id: "night:toDay",
    phase: "night",
    stepType: "phaseTransition",
    kind: "day",
  });
  const secondDay = step({ id: "day2:whisper", phase: "day", stepType: "whisper" });
  const states = [firstNight, firstDay, secondNight, secondDay].map((currentStep, index) =>
    replayState({ currentStep, eventCount: index + 1 }),
  );
  const core = createCoreHarness({
    initialReplay: states[0],
    replayAfterProposal: states[1],
    proposal: proposal(event("unused", "단계 전환")),
  });
  vi.mocked(core.replay).mockImplementation(async (candidate) => ({
    ok: true,
    value: states[candidate.game.events.length - 1] ?? states.at(-1)!,
  }));
  vi.mocked(core.propose).mockImplementation(async (candidate) => ({
    ok: true,
    value: proposal(event(`event-${candidate.game.events.length + 1}`, "단계 전환")),
  }));
  const storage = new MemoryGameStorageDriver(gameFile());
  const user = userEvent.setup();

  render(
    <ClocktowerApp
      coreAdapter={core}
      storageDriver={storage}
      phaseRuntimeClock={clock}
    />,
  );

  await screen.findByRole("main", { name: "Trouble Brewing 진행" });
  const stages = screen.getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  let grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  const firstNightCenter = within(grimoire).getByLabelText("1일차 밤 경과 시간 00:00");
  const tableMarker = grimoire.querySelector<HTMLElement>(".draftLayoutTableMark");
  if (!tableMarker) throw new Error("Grimoire table marker was not rendered");
  expect(firstNightCenter.textContent).toBe("1일차 밤00:00");
  expect(within(firstNightCenter).queryByText("경과")).toBeNull();
  expect(firstNightCenter.parentElement).toBe(tableMarker);
  expect(firstNightCenter.classList.contains("mapCenter")).toBe(false);
  expect(within(tableMarker).queryByText("테이블")).toBeNull();
  expect(grimoire.querySelectorAll(".phaseRuntimeCenter")).toHaveLength(1);

  now += 5 * 60_000 + 7_000;
  await act(async () => vi.advanceTimersByTime(1_000));
  expect(within(grimoire).getByLabelText("1일차 밤 경과 시간 05:07")).toBeTruthy();

  await user.click(within(stages).getByRole("button", { name: "진행" }));
  await user.click(await screen.findByRole("button", { name: "확정" }));
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  await waitFor(() => expect(within(grimoire).getByLabelText("2일차 낮 경과 시간 00:00")).toBeTruthy());
  expect(screen.queryByLabelText("낮 경과 시간")).toBeNull();

  now += 2 * 60_000;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(within(grimoire).getByLabelText("2일차 낮 경과 시간 02:00")).toBeTruthy();

  await user.click(within(stages).getByRole("button", { name: "진행" }));
  await user.click(await screen.findByRole("button", { name: "확정" }));
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  await waitFor(() => expect(within(grimoire).getByLabelText("2일차 밤 경과 시간 00:00")).toBeTruthy());
  await user.click(within(stages).getByRole("button", { name: "진행" }));
  await user.click(await screen.findByRole("button", { name: "확정" }));
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  await waitFor(() => expect(within(grimoire).getByLabelText("3일차 낮 경과 시간 00:00")).toBeTruthy());

  const replayCallsBeforeTicks = vi.mocked(core.replay).mock.calls.length;
  await waitFor(() => expect(storage.savedGames.length).toBeGreaterThan(0));
  const savesBeforeTicks = storage.savedGames.length;
  await act(async () => vi.advanceTimersByTime(3_000));
  expect(vi.mocked(core.replay)).toHaveBeenCalledTimes(replayCallsBeforeTicks);
  expect(storage.savedGames).toHaveLength(savesBeforeTicks);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(4);
});

test("derives later Night numbering when reopening an active saved session", async () => {
  const laterNight = step({ id: "night3:poisoner", phase: "night" });
  const replay = replayState({ currentStep: laterNight });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });

  render(
    <ClocktowerApp
      coreAdapter={core}
      storageDriver={new MemoryGameStorageDriver(gameFile())}
      phaseRuntimeClock={{ now: () => 20_000 }}
    />,
  );

  await screen.findByRole("main", { name: "Trouble Brewing 진행" });
  const stages = screen.getByRole("navigation", { name: "작업 단계" });
  await userEvent.setup().click(within(stages).getByRole("button", { name: "마도서" }));
  const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByLabelText("4일차 밤 경과 시간 00:00")).toBeTruthy();
});
