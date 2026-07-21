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

const confirmedLayout = {
  preset: "longTable",
  positions: {
    1: { x: 41, y: 31 },
    2: { x: 72, y: 24 },
    3: { x: 76, y: 68 },
    4: { x: 34, y: 77 },
    5: { x: 17, y: 48 },
  },
} as const;

describe.each([
  ["desktop", 1366],
  ["mobile", 390],
])("issue 71 production boundary at %s width", (_viewport, width) => {
  test("renders confirmed coordinates without any live layout-editing UI and keeps Player selection available", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    const currentStep = step({
      id: "firstNight:poisoner",
      character: "poisoner",
      playerId: "player-4",
      kind: "playerIds",
      target: "players",
      minSelections: 1,
      maxSelections: 1,
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(
      <ClocktowerApp
        coreAdapter={core}
        storageDriver={new MemoryGameStorageDriver(gameWithConfirmedLayout())}
      />,
    );

    await screen.findByRole("heading", { name: "독살범: 4번 Dae" });
    expect(screen.queryByRole("group", { name: "좌석 배치 프리셋" })).toBeNull();
    expect(screen.queryByText(/^겹침/)).toBeNull();
    expect(screen.queryByRole("button", { name: "위치 조정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "자동 배치" })).toBeNull();

    const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
    expect(grimoire.classList.contains("layoutEditing")).toBe(false);
    const ada = within(grimoire).getByRole("button", { name: /1번 Ada 좌석 선택/ });
    expect(ada.getAttribute("style")).toContain("left: 41%");
    expect(ada.getAttribute("style")).toContain("top: 31%");
    expect(ada.classList.contains("overlap")).toBe(false);
    await user.click(ada);
    expect(ada.getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByText("설정 및 불러오기"));
    const management = screen.getByText("초기 Grimoire 준비됨").parentElement;
    if (!management) throw new Error("setup management panel was not rendered");
    expect(within(management).queryByRole("button", { name: "위치 조정" })).toBeNull();
    expect(within(management).queryByRole("button", { name: "자동 배치" })).toBeNull();
  });
});

test("setup recovery restores the persisted confirmed coordinates and setup-only controls", async () => {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });
  const storage = new MemoryGameStorageDriver(gameWithConfirmedLayout());
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const user = userEvent.setup();

  render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);
  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  await user.click(screen.getByText("설정 및 불러오기"));
  await user.click(screen.getByRole("button", { name: "설정 다시 수정" }));

  const setupMap = await screen.findByLabelText("조정 가능한 마도서 좌석 맵");
  const ada = within(setupMap).getByText("Ada").closest("button");
  if (!ada) throw new Error("recovered Ada seat was not rendered");
  expect(ada.getAttribute("style")).toContain("left: 41%");
  expect(ada.getAttribute("style")).toContain("top: 31%");
  expect(screen.getByRole("group", { name: "좌석 배치 프리셋" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "위치 조정" })).toBeTruthy();
  await waitFor(() => {
    expect(storage.savedGames.at(-1)?.game.events).toEqual([]);
    expect(storage.savedGames.at(-1)?.ui).toBeUndefined();
  });
});

function gameWithConfirmedLayout(): GameFile {
  return {
    ...gameFile(),
    ui: { seatLayout: structuredClone(confirmedLayout) },
  } as GameFile;
}
