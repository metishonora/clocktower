import { render, screen, waitFor, within } from "@testing-library/react";
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

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalVisualViewport = window.visualViewport;
const originalScreenWidth = window.screen.width;
const originalScreenHeight = window.screen.height;
const originalUserAgent = window.navigator.userAgent;
const originalPlatform = window.navigator.platform;
const originalMaxTouchPoints = window.navigator.maxTouchPoints;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: originalVisualViewport });
  Object.defineProperty(window.screen, "width", { configurable: true, value: originalScreenWidth });
  Object.defineProperty(window.screen, "height", { configurable: true, value: originalScreenHeight });
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: originalUserAgent });
  Object.defineProperty(window.navigator, "platform", { configurable: true, value: originalPlatform });
  Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: originalMaxTouchPoints });
});

function installMobileViewport(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      get matches() { return matches; },
      media,
      onchange: null,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change") listeners.add(listener);
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change") listeners.delete(listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } satisfies MediaQueryList)),
  });
  return {
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next, media: "(max-width: 900px)" } as MediaQueryListEvent;
      listeners.forEach((listener) => {
        if (typeof listener === "function") listener(event);
        else listener.handleEvent(event);
      });
    },
  };
}

function installIpadPro12_9Gen5Viewport(orientation: "portrait" | "landscape") {
  installMobileViewport(false);
  const layoutWidth = orientation === "portrait" ? 960 : 1280;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: layoutWidth,
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: { width: layoutWidth - 44 },
  });
  Object.defineProperty(window.screen, "width", { configurable: true, value: 1024 });
  Object.defineProperty(window.screen, "height", { configurable: true, value: 1366 });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  });
  Object.defineProperty(window.navigator, "platform", { configurable: true, value: "iPad" });
  Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 5 });
}

function renderLivePlay() {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });
  return render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

test("toggles the mobile live-play sheet between approved control and Grimoire heights", async () => {
  installMobileViewport(true);
  const user = userEvent.setup();
  renderLivePlay();

  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  const app = screen.getByTestId("clocktower-app");
  const panel = document.querySelector(".phasePanel");
  const toggle = screen.getByTestId("mobile-phase-panel-toggle");

  expect(app.dataset.mobilePanelState).toBe("controls");
  expect(app.style.getPropertyValue("--mobile-phase-panel-height")).toContain("85dvh");
  expect(toggle.dataset.direction).toBe("down");
  expect(panel?.querySelector(".phasePanelContent")).not.toBeNull();

  await user.click(toggle);
  expect(app.dataset.mobilePanelState).toBe("grimoire");
  expect(app.style.getPropertyValue("--mobile-phase-panel-height")).toContain("20dvh");
  expect(toggle.dataset.direction).toBe("up");

  await user.click(toggle);
  expect(app.dataset.mobilePanelState).toBe("controls");
  expect(toggle.dataset.direction).toBe("down");
});

test("keeps the mobile CCC notice in the Grimoire flow and resets panel state on remount", async () => {
  installMobileViewport(true);
  const user = userEvent.setup();
  const firstRender = renderLivePlay();

  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  const notice = screen.getByLabelText("Community Created Content 안내");
  expect(notice.closest(".grimoire")).not.toBeNull();
  await user.click(screen.getByTestId("mobile-phase-panel-toggle"));
  expect(screen.getByTestId("clocktower-app").dataset.mobilePanelState).toBe("grimoire");

  firstRender.unmount();
  renderLivePlay();
  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  expect(screen.getByTestId("clocktower-app").dataset.mobilePanelState).toBe("controls");
});

test("removes the mobile control and restores the existing notice placement above 900px", async () => {
  const viewport = installMobileViewport(true);
  renderLivePlay();

  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  expect(screen.getByTestId("mobile-phase-panel-toggle")).toBeTruthy();

  viewport.setMatches(false);
  await waitFor(() => expect(screen.queryByTestId("mobile-phase-panel-toggle")).toBeNull());
  const app = screen.getByTestId("clocktower-app");
  expect(app.dataset.mobilePanelState).toBeUndefined();
  expect(within(app).getByLabelText("Community Created Content 안내").closest(".grimoire")).toBeNull();
});

test.each(["portrait", "landscape"] as const)(
  "uses only the vertical phase overview accordion on a full-screen 12.9-inch fifth-generation iPad Pro in %s",
  async (orientation) => {
    installIpadPro12_9Gen5Viewport(orientation);
    renderLivePlay();

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const overview = document.querySelector<HTMLDetailsElement>(".phaseOverviewDisclosure");
    const app = screen.getByTestId("clocktower-app");

    expect(overview?.dataset.layout).toBe("accordion");
    expect(overview?.open).toBe(false);
    expect(screen.queryByTestId("mobile-phase-panel-toggle")).toBeNull();
    expect(app.dataset.mobilePanelState).toBeUndefined();
    expect(within(app).getByLabelText("Community Created Content 안내").closest(".grimoire")).toBeNull();
  },
);

test("keeps the horizontal phase overview on a same-width mouse desktop", async () => {
  installMobileViewport(false);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1366 });
  Object.defineProperty(window.screen, "width", { configurable: true, value: 1024 });
  Object.defineProperty(window.screen, "height", { configurable: true, value: 1366 });
  Object.defineProperty(window.navigator, "platform", { configurable: true, value: "MacIntel" });
  Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 0 });
  renderLivePlay();

  await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
  const overview = document.querySelector<HTMLDetailsElement>(".phaseOverviewDisclosure");

  expect(overview?.dataset.layout).toBe("horizontal");
  expect(overview?.open).toBe(true);
});
