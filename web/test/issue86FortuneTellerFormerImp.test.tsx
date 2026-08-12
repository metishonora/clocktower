import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { openLiveGrimoire, returnToLiveProgress } from "./livePlayTestHelpers";
import { realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

const fixturePath = resolve(
  process.cwd(),
  "../fixtures/acceptance/trouble-brewing/fortune-teller-detects-dead-demon.json",
);

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalVisualViewport = window.visualViewport;
const originalScreenWidth = window.screen.width;
const originalScreenHeight = window.screen.height;
const originalUserAgent = window.navigator.userAgent;
const originalPlatform = window.navigator.platform;
const originalMaxTouchPoints = window.navigator.maxTouchPoints;

describe("issue #86 Fortune Teller checks after Scarlet Woman succession", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: originalVisualViewport });
    Object.defineProperty(window.screen, "width", { configurable: true, value: originalScreenWidth });
    Object.defineProperty(window.screen, "height", { configurable: true, value: originalScreenHeight });
    Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: originalUserAgent });
    Object.defineProperty(window.navigator, "platform", { configurable: true, value: originalPlatform });
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: originalMaxTouchPoints });
  });

  test.each([
    { surface: "phase input", demonSeat: 7, demonPlayerId: "player-7", description: "dead former Imp" },
    { surface: "phase input", demonSeat: 6, demonPlayerId: "player-6", description: "living successor Imp" },
    { surface: "Grimoire", demonSeat: 7, demonPlayerId: "player-7", description: "dead former Imp" },
    { surface: "Grimoire", demonSeat: 6, demonPlayerId: "player-6", description: "living successor Imp" },
  ])("selects, clears, reselects, and confirms the $description from the $surface", async ({
    surface,
    demonSeat,
    demonPlayerId,
  }) => {
    installIpadProLandscapeSafari();
    const game = loadFixture();
    const initialEventCount = game.game.events.length;
    const initialReplay = await replayOrThrow(game);
    expect(initialReplay.currentStep?.id).toBe("night:fortuneTeller");
    expect(initialReplay.gameEnd).toBeNull();
    expect(initialReplay.warnings.map(({ code }) => code)).not.toContain("DEMON_DEAD_GOOD_WIN");
    expect(initialReplay.players.find(({ id }) => id === "player-7")?.alive).toBe(false);
    expect(initialReplay.players.find(({ id }) => id === "player-6")).toMatchObject({
      alive: true,
      actualCharacter: "imp",
    });

    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByRole("button", { name: "대상 선택" });
    const selectionSurface = await openLiveGrimoire(user);
    const fortuneTeller = within(selectionSurface).getByRole("button", {
      name: /5번 플레이어 5 좌석 선택/,
    });
    const demon = within(selectionSurface).getByRole("button", {
      name: new RegExp(`${demonSeat}번 플레이어 ${demonSeat} 좌석 선택`),
    });
    const third = within(selectionSurface).getByRole("button", {
      name: /4번 플레이어 4 좌석 선택/,
    });

    expect((fortuneTeller as HTMLButtonElement).disabled).toBe(false);
    expect((demon as HTMLButtonElement).disabled).toBe(false);

    await user.click(fortuneTeller);
    await user.click(demon);
    expect(fortuneTeller.getAttribute("aria-pressed")).toBe("true");
    expect(demon.getAttribute("aria-pressed")).toBe("true");

    await user.click(third);
    expect(third.getAttribute("aria-pressed")).toBe("false");

    await user.click(demon);
    expect(demon.getAttribute("aria-pressed")).toBe("false");

    await user.click(demon);
    expect(demon.getAttribute("aria-pressed")).toBe("true");
    await returnToLiveProgress(user);
    const confirm = screen.getByRole("button", { name: "정보 공개" });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    await user.click(confirm);

    expect(within(await screen.findByLabelText("플레이어 공개 화면")).getByText("있음")).toBeTruthy();

    await waitFor(() => {
      expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1);
    });
    expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
      type: "phaseStepConfirmed",
      payload: {
        stepId: "night:fortuneTeller",
        input: { playerIds: ["player-5", demonPlayerId] },
        information: {
          targetPlayerIds: ["player-5", demonPlayerId],
          computedResult: { kind: "boolean", value: true },
          deliveredResult: { kind: "boolean", value: true },
          deliveryContext: { type: "fixed" },
        },
      },
    });
  });
});

function installIpadProLandscapeSafari() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } satisfies MediaQueryList)),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: { width: 1236 } });
  Object.defineProperty(window.screen, "width", { configurable: true, value: 1024 });
  Object.defineProperty(window.screen, "height", { configurable: true, value: 1366 });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  });
  Object.defineProperty(window.navigator, "platform", { configurable: true, value: "iPad" });
  Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 5 });
}

function loadFixture(): GameFile {
  return importGameFileJson(readFileSync(fixturePath, "utf8"));
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}
