import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { openLiveGrimoire, returnToLiveProgress, selectLivePlayers } from "./livePlayTestHelpers";
import { realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

const fixturePath = resolve(
  process.cwd(),
  "../fixtures/acceptance/trouble-brewing/fortune-teller-recluse-registration.json",
);

describe("issue #85 Fortune Teller Recluse registration", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test.each([
    {
      resultButton: "악마 없음",
      deliveredValue: false,
      revealValue: "없음",
      deliveryContext: { type: "fixed" },
    },
    {
      resultButton: "악마 있음",
      deliveredValue: true,
      revealValue: "있음",
      deliveryContext: {
        type: "discretionary",
        reasons: [{
          type: "registrationJudgment",
          judgments: [{ playerId: "player-6", registeredAs: "demon" }],
        }],
      },
    },
  ])("confirms $resultButton once when the Recluse is selected first", async ({
    resultButton,
    deliveredValue,
    revealValue,
    deliveryContext,
  }) => {
    const game = loadFixture();
    const initialEventCount = game.game.events.length;
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);

    const delivery = screen.getByLabelText("전달 정보");
    await user.click(within(delivery).getByRole("button", { name: resultButton }));
    const confirm = screen.getByRole("button", { name: "확정" });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    await user.dblClick(confirm);

    const revealFollowup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(within(revealFollowup).getByText("점쟁이 정보")).toBeTruthy();
    await user.click(within(revealFollowup).getByRole("button", { name: "플레이어에게 공개" }));
    const reveal = screen.getByLabelText("플레이어 공개 화면");
    expect(within(reveal).getByText(revealValue)).toBeTruthy();
    await waitFor(() => {
      expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1);
    });

    const saved = latestSavedGame(storage);
    expect(saved.game.events.at(-1)).toMatchObject({
      type: "phaseStepConfirmed",
      payload: {
        stepId: "firstNight:fortuneTeller",
        input: { playerIds: ["player-3", "player-6"] },
        information: {
          targetPlayerIds: ["player-3", "player-6"],
          computedResult: { kind: "boolean", value: false },
          deliveredResult: { kind: "boolean", value: deliveredValue },
          deliveryContext,
        },
      },
    });

    const replayed = await replayOrThrow(saved);
    expect(replayed.currentStep?.id).not.toBe("firstNight:fortuneTeller");
  });

  test("replaces the result witness and clears the choice when the Recluse leaves the pair", async () => {
    const game = loadFixture();
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);

    let delivery = screen.getByLabelText("전달 정보");
    const demonPresent = within(delivery).getByRole("button", { name: "악마 있음" });
    const demonAbsent = within(delivery).getByRole("button", { name: "악마 없음" });
    await user.click(demonPresent);
    expect(within(demonPresent).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(demonAbsent).queryByText("✓")).toBeNull();

    await user.click(demonAbsent);
    expect(within(demonAbsent).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(demonPresent).queryByText("✓")).toBeNull();
    expect(within(delivery).getAllByText("✓")).toHaveLength(1);

    await selectLivePlayers(user, /플레이어 6/);
    expect(screen.queryByLabelText("전달 정보")).toBeNull();
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(true);

    await selectLivePlayers(user, /플레이어 6/);
    delivery = screen.getByLabelText("전달 정보");
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(delivery).getByRole("button", { name: "악마 없음" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(delivery).getByRole("button", { name: "악마 있음" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(delivery).queryByText("✓")).toBeNull();

    await user.click(within(delivery).getByRole("button", { name: "악마 없음" }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    await waitFor(() => {
      expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
        payload: {
          information: {
            deliveredResult: { kind: "boolean", value: false },
            deliveryContext: { type: "fixed" },
          },
        },
      });
    });
  });

  test("resets the in-progress choice when the REG-05 fixture is imported again", async () => {
    const game = loadFixture();
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    const confirmImport = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);
    await user.click(within(screen.getByLabelText("전달 정보")).getByRole("button", { name: "악마 있음" }));

    const imported = loadFixture();
    imported.game.id = "reg-05-imported-again";
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");
    await user.upload(
      fileInput,
      new File([JSON.stringify(imported)], "reg-05.json", { type: "application/json" }),
    );

    expect(confirmImport).toHaveBeenCalled();
    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    let input = await openLiveGrimoire(user);
    expect(within(input).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    await returnToLiveProgress(user);
    expect(screen.queryByLabelText("전달 정보")).toBeNull();
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(true);

    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);
    await user.click(within(screen.getByLabelText("전달 정보")).getByRole("button", { name: "악마 있음" }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    await waitFor(() => {
      expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
        payload: {
          input: { playerIds: ["player-3", "player-6"] },
          information: {
            deliveredResult: { kind: "boolean", value: true },
            deliveryContext: {
              reasons: [{
                judgments: [{ playerId: "player-6", registeredAs: "demon" }],
              }],
            },
          },
        },
      });
    });
  });

  test("keeps the same canonical confirmation contract after reload and Undo", async () => {
    const game = loadFixture();
    const initialEventCount = game.game.events.length;
    const firstStorage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    const firstRender = render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={firstStorage} />);

    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);
    await user.click(within(screen.getByLabelText("전달 정보")).getByRole("button", { name: "악마 있음" }));
    await user.click(screen.getByRole("button", { name: "확정" }));
    await waitFor(() => {
      expect(latestSavedGame(firstStorage).game.events).toHaveLength(initialEventCount + 1);
    });

    const confirmed = latestSavedGame(firstStorage);
    firstRender.unmount();
    const reloadedStorage = new MemoryGameStorageDriver(confirmed);
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={reloadedStorage} />);

    const undo = await screen.findByRole("button", { name: "Undo" });
    await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
    await user.click(undo);
    await user.click(screen.getByRole("button", { name: "되돌리기" }));

    await screen.findByText("확인할 플레이어 2명을 선택하세요.");
    const input = await openLiveGrimoire(user);
    expect(within(input).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    await returnToLiveProgress(user);
    expect(screen.queryByLabelText("전달 정보")).toBeNull();

    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);
    await user.click(within(screen.getByLabelText("전달 정보")).getByRole("button", { name: "악마 없음" }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    await waitFor(() => {
      const saved = latestSavedGame(reloadedStorage);
      expect(saved.game.events).toHaveLength(initialEventCount + 1);
      expect(saved.game.events.at(-1)).toMatchObject({
        payload: {
          input: { playerIds: ["player-3", "player-6"] },
          information: {
            deliveredResult: { kind: "boolean", value: false },
            deliveryContext: { type: "fixed" },
          },
        },
      });
    });
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
