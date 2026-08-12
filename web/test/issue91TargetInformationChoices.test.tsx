import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { selectLivePlayers } from "./livePlayTestHelpers";
import { realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

const fixturePath = resolve(
  process.cwd(),
  "../fixtures/acceptance/trouble-brewing/ravenkeeper-spy-recluse-registration.json",
);

describe("issue #91 target-information selected choices", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("moves the visible check between REG-06 Spy Character results and confirms the matching witness", async () => {
    const game = loadFixture();
    const initialEventCount = game.game.events.length;
    const replayed = await replayOrThrow(game);
    expect(replayed.currentStep?.id).toBe("night:ravenkeeper");

    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "까마귀지기: 1번 플레이어 1" });
    await selectLivePlayers(user, /플레이어 8/);

    const delivery = screen.getByLabelText("전달 정보");
    const actualSpy = within(delivery).getByRole("button", { name: "첩자" });
    const registeredChef = within(delivery).getByRole("button", { name: "요리사" });
    expect(within(delivery).queryByText("✓")).toBeNull();

    await user.click(actualSpy);
    expect(actualSpy.getAttribute("aria-pressed")).toBe("true");
    expect(within(actualSpy).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(registeredChef).queryByText("✓")).toBeNull();

    await user.click(registeredChef);
    expect(actualSpy.getAttribute("aria-pressed")).toBe("false");
    expect(within(actualSpy).queryByText("✓")).toBeNull();
    expect(registeredChef.getAttribute("aria-pressed")).toBe("true");
    expect(within(registeredChef).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(delivery).getAllByText("✓")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "정보 공개" }));
    const reveal = await screen.findByLabelText("플레이어 공개 화면");
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    const informationTask = await screen.findByRole("region", { name: "까마귀지기 정보" });
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(within(informationTask).getByRole("button", { name: "정보 공개" })).toBeTruthy();
    expect(within(informationTask).getByRole("button", { name: "다음 단계" })).toBeTruthy();
    await waitFor(() => {
      expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1);
    });

    expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
      type: "phaseStepConfirmed",
      payload: {
        stepId: "night:ravenkeeper",
        input: { playerIds: ["player-8"] },
        information: {
          targetPlayerIds: ["player-8"],
          computedResult: { kind: "character", characterId: "spy" },
          deliveredResult: { kind: "character", characterId: "chef" },
          deliveryContext: {
            reasons: [{
              judgments: [{
                playerId: "player-8",
                registeredAs: "townsfolk",
                characterId: "chef",
              }],
            }],
          },
        },
      },
    });
  });

  test("clears the selected check and draft when the REG-06 target changes", async () => {
    const game = loadFixture();
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "까마귀지기: 1번 플레이어 1" });
    await selectLivePlayers(user, /플레이어 8/);
    let delivery = screen.getByLabelText("전달 정보");
    const registeredChef = within(delivery).getByRole("button", { name: "요리사" });
    await user.click(registeredChef);
    expect(within(registeredChef).getByText("✓")).toBeTruthy();

    await selectLivePlayers(user, /플레이어 6/);
    delivery = screen.getByLabelText("전달 정보");
    expect(within(delivery).queryByText("✓")).toBeNull();
    expect(within(delivery).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect((screen.getByRole("button", { name: "정보 공개" }) as HTMLButtonElement).disabled).toBe(true);

    const registeredImp = within(delivery).getByRole("button", { name: "임프" });
    await user.click(registeredImp);
    expect(registeredImp.getAttribute("aria-pressed")).toBe("true");
    expect(within(registeredImp).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(delivery).getAllByText("✓")).toHaveLength(1);
  });
});

function loadFixture(): GameFile {
  return importGameFileJson(readFileSync(fixturePath, "utf8"));
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}
