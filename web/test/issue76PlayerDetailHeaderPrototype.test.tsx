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
  window.history.pushState({}, "", "/");
});

function renderPrototype() {
  window.history.pushState({}, "", "/?prototype=issue-76-player-detail-header");
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const initialReplay = replayState({ currentStep });
  render(
    <App
      coreAdapter={createCoreHarness({
        initialReplay,
        replayAfterProposal: initialReplay,
        proposal: proposal(event("unused", "unused")),
      })}
      storageDriver={new MemoryGameStorageDriver(gameFile())}
    />,
  );
}

test("compares the approved player-detail identity hierarchy at iPad and mobile sizes", async () => {
  renderPrototype();

  expect(await screen.findByRole("heading", { name: "플레이어 상세 헤더 배치" })).toBeTruthy();
  for (const label of ["iPad 1024 × 768 상세 창", "모바일 390 × 844 상세 창"]) {
    const preview = screen.getByRole("region", { name: label });
    expect(within(preview).getByAltText("주정뱅이 공식 캐릭터 아이콘")).toBeTruthy();
    expect(within(preview).getByRole("heading", { name: "서연" })).toBeTruthy();
    expect(within(preview).getByText("좌석 7")).toBeTruthy();
    expect(within(preview).getByText("주정뱅이")).toBeTruthy();
    expect(within(preview).getByRole("button", { name: "주정뱅이 세부 규칙 보기" })).toBeTruthy();
    expect(within(preview).getByRole("button", { name: "플레이어 상세 닫기" })).toBeTruthy();
  }
});

test("opens rules from the role label and preserves the player-detail draft after closing them", async () => {
  const user = userEvent.setup();
  renderPrototype();

  const preview = await screen.findByRole("region", { name: "iPad 1024 × 768 상세 창" });
  const notes = within(preview).getByRole("textbox", { name: "iPad Notes" });
  await user.type(notes, "다음 밤 확인");
  await user.click(within(preview).getByRole("button", { name: "주정뱅이 세부 규칙 보기" }));

  const rules = screen.getByRole("dialog", { name: "주정뱅이 세부 규칙" });
  await user.click(within(rules).getByRole("button", { name: "세부 규칙 닫기" }));

  expect((notes as HTMLTextAreaElement).value).toBe("다음 밤 확인");
  expect(document.activeElement).toBe(
    within(preview).getByRole("button", { name: "주정뱅이 세부 규칙 보기" }),
  );
});
