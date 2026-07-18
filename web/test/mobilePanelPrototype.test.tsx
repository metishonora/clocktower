import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
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

const originalInnerHeight = window.innerHeight;

afterEach(() => {
  window.history.replaceState(null, "", "/");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
  vi.restoreAllMocks();
});

function renderPrototype(viewportHeight = 800) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewportHeight });
  window.history.replaceState(null, "", "/?prototype=mobile-panel");
  const currentStep = step({ id: "firstNight:chef" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });
  render(<App coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

test("compares a three-snap drag handle with a two-state bookmark on the same live-play surface", async () => {
  const user = userEvent.setup();
  renderPrototype();

  const prototype = await screen.findByRole("main", { name: "모바일 패널 전환 프로토타입" });
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("680px");
  expect(within(prototype).getByText("Trouble Brewing")).toBeTruthy();
  expect(within(prototype).getByText("현재 단계")).toBeTruthy();

  const dragHandle = within(prototype).getByTestId("drag-handle");
  fireEvent.pointerDown(dragHandle, { pointerId: 7, clientY: 680 });
  fireEvent.pointerMove(window, { pointerId: 7, clientY: 980 });
  fireEvent.pointerUp(window, { pointerId: 7, clientY: 980 });
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("400px");
  expect(prototype.dataset.panelState).toBe("middle");

  await user.click(within(prototype).getByRole("button", { name: "B · 책갈피" }));
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("680px");
  expect(prototype.dataset.panelState).toBe("controls");

  await user.click(within(prototype).getByTestId("bookmark-toggle"));
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("160px");
  expect(prototype.dataset.panelState).toBe("grimoire");
  await user.click(within(prototype).getByTestId("bookmark-toggle"));
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("680px");
});

test("recomputes the current state when the viewport changes without persisting it", async () => {
  const user = userEvent.setup();
  const storageGet = vi.spyOn(Storage.prototype, "getItem");
  const storageSet = vi.spyOn(Storage.prototype, "setItem");
  renderPrototype();

  const prototype = await screen.findByRole("main", { name: "모바일 패널 전환 프로토타입" });
  await user.click(within(prototype).getByRole("button", { name: "B · 책갈피" }));
  await user.click(within(prototype).getByTestId("bookmark-toggle"));
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("160px");

  Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
  fireEvent.resize(window);
  expect(prototype.style.getPropertyValue("--prototype-panel-height")).toBe("120px");
  expect(storageGet).not.toHaveBeenCalled();
  expect(storageSet).not.toHaveBeenCalled();
});

test("keeps the CCC notice in the Grimoire document flow instead of floating above the panel", async () => {
  renderPrototype();

  const prototype = await screen.findByRole("main", { name: "모바일 패널 전환 프로토타입" });
  const grimoire = within(prototype).getByText("Trouble Brewing").closest(".mobilePanelPrototypeGrimoire");
  const notice = within(prototype).getByLabelText("Community Created Content 안내");

  expect(grimoire).not.toBeNull();
  expect(notice.parentElement).toBe(grimoire);
});
