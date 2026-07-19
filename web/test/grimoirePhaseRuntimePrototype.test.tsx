import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { App } from "../src/main";
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
  window.history.replaceState(null, "", "/");
});

test("reviews the approved compact center treatment across phase, count, layout, and end states", async () => {
  window.history.replaceState(null, "", "/?prototype=grimoire-phase-runtime");
  const user = userEvent.setup();
  const currentStep = step({ id: "firstNight:chef" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });

  render(<App coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  const prototype = await screen.findByRole("main", { name: "마도서 중앙 페이즈 시간 프로토타입" });
  const center = within(prototype).getByLabelText("2일차 낮 경과 시간 12:34");
  expect(center.textContent).toBe("2일차 낮12:34");
  expect(within(center).queryByText("경과")).toBeNull();
  expect(center.parentElement?.classList.contains("issue67TableMark")).toBe(true);
  expect(within(prototype).getByRole("button", { name: "테이블 영역" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(prototype).getAllByLabelText(/경과 시간/)).toHaveLength(1);
  expect(within(prototype).getAllByRole("button", { name: /명$/ }).map((button) => button.textContent)).toEqual([
    "5명",
    "12명",
    "15명",
  ]);
  expect(within(prototype).getByRole("group", { name: "좌석 배치" })).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "1일차 밤" }));
  expect(within(prototype).getByLabelText("1일차 밤 경과 시간 12:34")).toBeTruthy();
  await user.click(within(prototype).getByRole("button", { name: "3일차 낮" }));
  expect(within(prototype).getByLabelText("3일차 낮 경과 시간 12:34")).toBeTruthy();
  await user.click(within(prototype).getByRole("button", { name: "2일차 밤" }));
  expect(within(prototype).getByLabelText("2일차 밤 경과 시간 12:34")).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "기존 중앙" }));
  expect(within(prototype).getByLabelText("2일차 밤 경과 시간 12:34").parentElement?.classList.contains("issue67TableMark"))
    .toBe(false);

  await user.click(within(prototype).getByRole("button", { name: "게임 종료" }));
  expect(within(prototype).getByText("게임 종료")).toBeTruthy();
  expect(within(prototype).queryByText("12:34")).toBeNull();
  await user.click(within(prototype).getByRole("button", { name: "입력 중" }));
  expect(within(prototype).getByText("입력 중")).toBeTruthy();
});
