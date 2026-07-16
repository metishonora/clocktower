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

test("compares both compact day-runtime placements across representative live-play surfaces", async () => {
  window.history.replaceState(null, "", "/?prototype=day-runtime");
  const user = userEvent.setup();
  const currentStep = step({ id: "firstNight:chef" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });

  render(<App coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  const prototype = await screen.findByRole("main", { name: "낮 경과 시간 배치 프로토타입" });
  expect(within(prototype).getByLabelText("제목 아래 낮 경과 시간").textContent).toContain("12:34");
  expect(within(prototype).getByText("입력 없음")).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "A · 헤더 우측" }));
  expect(within(prototype).getByLabelText("헤더 우측 낮 경과 시간").textContent).toContain("12:34");
  await user.click(within(prototype).getByRole("button", { name: "B · 제목 아래" }));
  expect(within(prototype).getByLabelText("제목 아래 낮 경과 시간").textContent).toContain("12:34");

  await user.click(within(prototype).getByRole("button", { name: "60:00" }));
  expect(within(prototype).getByLabelText("제목 아래 낮 경과 시간").textContent).toContain("60:00");

  for (const surface of ["Whisper", "Discussion", "Nomination / Voting", "Execution", "확정 후속"]) {
    await user.click(within(prototype).getByRole("button", { name: surface }));
    expect(within(prototype).getByLabelText("제목 아래 낮 경과 시간").textContent).toContain("60:00");
  }

  await user.click(within(prototype).getByRole("button", { name: "Night" }));
  expect(within(prototype).queryByText(/낮 경과 60:00/)).toBeNull();
  await user.click(within(prototype).getByRole("button", { name: "Setup" }));
  expect(within(prototype).queryByText(/낮 경과 60:00/)).toBeNull();

  await user.click(within(prototype).getByRole("button", { name: "Reveal" }));
  const reveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(reveal).queryByText(/낮 경과/)).toBeNull();
});
