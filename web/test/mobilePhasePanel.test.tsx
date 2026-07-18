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

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
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
