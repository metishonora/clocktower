import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { returnToLiveProgress, selectLivePlayers, startLiveTargetSelection } from "./livePlayTestHelpers";
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
      treatmentButton: "선한 팀으로 취급",
      treatmentLabel: "선",
      treatmentClass: "alignment-good",
      deliveredValue: false,
      revealValue: "없음",
      deliveryContext: { type: "fixed" },
    },
    {
      treatmentButton: "악한 팀으로 취급",
      treatmentLabel: "악",
      treatmentClass: "alignment-evil",
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
  ])("confirms the $treatmentButton judgment once when the Recluse is selected first", async ({
    treatmentButton,
    treatmentLabel,
    treatmentClass,
    deliveredValue,
    revealValue,
    deliveryContext,
  }) => {
    const game = loadFixture();
    const initialEventCount = game.game.events.length;
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    const grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));

    const selectionPanel = screen.getByLabelText("현재 마도서 작업");
    const treatment = within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" });
    expect(treatment.tagName).toBe("FIELDSET");
    expect(treatment.classList.contains("snvInformationBinary")).toBe(true);
    expect(treatment.classList.contains("tbSelectionChoices")).toBe(true);
    const treatmentButtons = within(treatment).getAllByRole("button");
    expect(treatmentButtons.map((button) => button.textContent)).toEqual(["선", "악"]);
    expect(within(treatment).getByRole("button", { name: "선한 팀으로 취급" }).classList.contains("alignment-good")).toBe(true);
    expect(within(treatment).getByRole("button", { name: "악한 팀으로 취급" }).classList.contains("alignment-evil")).toBe(true);
    const selectedTreatment = within(treatment).getByRole("button", { name: treatmentButton });
    expect(selectedTreatment.textContent).toBe(treatmentLabel);
    expect(selectedTreatment.classList.contains(treatmentClass)).toBe(true);
    const selectionConfirm = within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
    expect(selectionConfirm.disabled).toBe(true);

    await user.click(selectedTreatment);
    expect(selectedTreatment.getAttribute("aria-pressed")).toBe("true");
    expect(within(treatment).queryByText("✓")).toBeNull();
    expect(selectionConfirm.disabled).toBe(false);
    await user.click(selectionConfirm);

    expect(screen.queryByLabelText("전달 정보")).toBeNull();
    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect(screen.queryByRole("button", { name: "악마 있음" })).toBeNull();
    expect(screen.queryByRole("button", { name: "악마 없음" })).toBeNull();
    const result = screen.getByRole("group", { name: "정보 결과" });
    expect(within(result).getByText("결과", { exact: true })).toBeTruthy();
    expect(within(result).getByText(revealValue, { exact: true })).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "정보 공개" });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    await user.click(confirm);

    const reveal = await screen.findByLabelText("플레이어 공개 화면");
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

  test("replaces the treatment witness and clears the choice when the Recluse leaves the pair", async () => {
    const game = loadFixture();
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    const grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    const selectionPanel = screen.getByLabelText("현재 마도서 작업");
    expect(within(selectionPanel).queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect((within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    const treatment = within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" });
    const selectionConfirm = within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
    expect(selectionConfirm.disabled).toBe(true);
    const demon = within(treatment).getByRole("button", { name: "악한 팀으로 취급" });
    const notDemon = within(treatment).getByRole("button", { name: "선한 팀으로 취급" });
    expect(notDemon.getAttribute("aria-pressed")).toBe("false");
    expect(demon.getAttribute("aria-pressed")).toBe("false");
    expect(within(treatment).queryByText("✓")).toBeNull();

    await user.click(demon);
    expect(demon.getAttribute("aria-pressed")).toBe("true");
    expect(notDemon.getAttribute("aria-pressed")).toBe("false");
    expect(selectionConfirm.disabled).toBe(false);

    await user.click(notDemon);
    expect(notDemon.getAttribute("aria-pressed")).toBe("true");
    expect(demon.getAttribute("aria-pressed")).toBe("false");
    expect(within(treatment).queryByText("✓")).toBeNull();
    await user.click(selectionConfirm);

    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "정보 결과" })).getByText("없음", { exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "정보 공개" }));

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

  test("requires a Recluse treatment even when the real Demon already makes the result positive", async () => {
    const game = loadFixture();
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    const grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 8/ }));

    const selectionPanel = screen.getByLabelText("현재 마도서 작업");
    const treatment = within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" });
    const selectionConfirm = within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
    expect(selectionConfirm.disabled).toBe(true);

    await user.click(within(treatment).getByRole("button", { name: "악한 팀으로 취급" }));
    expect(selectionConfirm.disabled).toBe(false);
    await user.click(selectionConfirm);

    expect(within(screen.getByRole("group", { name: "정보 결과" })).getByText("있음", { exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "정보 공개" }));

    await waitFor(() => {
      expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
        payload: {
          input: { playerIds: ["player-6", "player-8"] },
          information: {
            computedResult: { kind: "boolean", value: true },
            deliveredResult: { kind: "boolean", value: true },
            deliveryContext: {
              type: "discretionary",
              reasons: [{
                type: "registrationJudgment",
                judgments: [{ playerId: "player-6", registeredAs: "demon" }],
              }],
            },
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

    let grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));
    await user.click(within(within(screen.getByLabelText("현재 마도서 작업"))
      .getByRole("group", { name: "이번 판정의 은둔자 취급" }))
      .getByRole("button", { name: "악한 팀으로 취급" }));

    const imported = loadFixture();
    imported.game.id = "reg-05-imported-again";
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");
    await user.upload(
      fileInput,
      new File([JSON.stringify(imported)], "reg-05.json", { type: "application/json" }),
    );

    expect(confirmImport).toHaveBeenCalled();
    grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
    const input = grimoire;
    expect(within(input).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(within(screen.getByLabelText("현재 마도서 작업"))
      .queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    await returnToLiveProgress(user);
    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect((screen.getByRole("button", { name: "정보 공개" }) as HTMLButtonElement).disabled).toBe(true);

    grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));
    const selectionPanel = screen.getByLabelText("현재 마도서 작업");
    await user.click(within(within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" }))
      .getByRole("button", { name: "악한 팀으로 취급" }));
    await user.click(within(selectionPanel).getByRole("button", { name: "선택 확정" }));
    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "정보 결과" })).getByText("있음", { exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "정보 공개" }));

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

    let grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));
    let selectionPanel = screen.getByLabelText("현재 마도서 작업");
    await user.click(within(within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" }))
      .getByRole("button", { name: "악한 팀으로 취급" }));
    await user.click(within(selectionPanel).getByRole("button", { name: "선택 확정" }));
    await user.click(screen.getByRole("button", { name: "정보 공개" }));
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

    const input = await startLiveTargetSelection(user);
    expect(within(input).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    await returnToLiveProgress(user);
    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();

    grimoire = await startLiveTargetSelection(user);
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /플레이어 3/ }));
    selectionPanel = screen.getByLabelText("현재 마도서 작업");
    await user.click(within(within(selectionPanel).getByRole("group", { name: "이번 판정의 은둔자 취급" }))
      .getByRole("button", { name: "선한 팀으로 취급" }));
    await user.click(within(selectionPanel).getByRole("button", { name: "선택 확정" }));
    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "정보 결과" })).getByText("없음", { exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "정보 공개" }));

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

  test.each([
    ["poisoned", loadPoisonedFixture, "중독 정보 공개", "poisoned"],
    ["drunk", loadDrunkFixture, "취한 정보 공개", "drunk"],
  ] as const)("keeps the %s Fortune Teller delivery freely selectable without a Recluse judgment", async (
    _state,
    buildGame,
    revealAction,
    reasonType,
  ) => {
    const game = buildGame();
    const replayed = await replayOrThrow(game);
    expect(replayed.currentStep?.id).toBe("firstNight:fortuneTeller");
    expect(replayed.currentStep?.informationPrompt?.activeReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: reasonType }),
    ]));

    const initialEventCount = game.game.events.length;
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await selectLivePlayers(user, /플레이어 6/, /플레이어 3/);

    expect(screen.queryByRole("group", { name: "이번 판정의 은둔자 취급" })).toBeNull();
    const delivery = screen.getByRole("group", { name: "전달할 정보" });
    expect(delivery.tagName).toBe("FIELDSET");
    expect(delivery.classList.contains("snvInformationBinary")).toBe(true);
    expect(within(delivery).queryByText("✓")).toBeNull();
    const deliveredDemon = within(delivery).getAllByRole("button")
      .find((button) => button.textContent?.includes("있음"));
    expect(deliveredDemon).toBeDefined();
    if (!deliveredDemon) throw new Error("악마 있음 전달 선택지가 없습니다.");

    const confirm = screen.getByRole("button", { name: revealAction }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.click(deliveredDemon);
    expect(deliveredDemon.getAttribute("aria-pressed")).toBe("true");
    expect(within(delivery).queryByText("✓")).toBeNull();
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    const reveal = await screen.findByLabelText("플레이어 공개 화면");
    expect(within(reveal).getByText("있음", { exact: true })).toBeTruthy();
    await waitFor(() => expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1));
    expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
      type: "phaseStepConfirmed",
      payload: {
        stepId: "firstNight:fortuneTeller",
        input: { playerIds: ["player-3", "player-6"] },
        information: {
          computedResult: { kind: "boolean", value: false },
          deliveredResult: { kind: "boolean", value: true },
          deliveryContext: {
            type: "discretionary",
            reasons: [expect.objectContaining({ type: reasonType })],
          },
        },
      },
    });
  });
});

function loadFixture(): GameFile {
  return importGameFileJson(readFileSync(fixturePath, "utf8"));
}

function loadPoisonedFixture(): GameFile {
  const game = loadFixture();
  const poisonerIndex = game.game.events.findIndex((event) => (
    event.type === "phaseStepSkipped" && event.payload.stepId === "firstNight:poisoner"
  ));
  if (poisonerIndex < 0) throw new Error("fixture poisoner step missing");
  const skipped = game.game.events[poisonerIndex];
  game.game.events[poisonerIndex] = {
    id: skipped.id,
    type: "nightActionResolved",
    phase: skipped.phase,
    payload: {
      stepId: "firstNight:poisoner",
      actorPlayerId: "player-7",
      resolution: { kind: "poison", targetPlayerId: "player-1", applied: true },
    },
    summary: "7번 플레이어 7(독살자) → 1번 플레이어 1(점쟁이) · 중독 적용",
    createdAt: skipped.createdAt,
  };
  return game;
}

function loadDrunkFixture(): GameFile {
  const game = loadFixture();
  const setup = game.game.events.find((event) => event.type === "setupConfirmed");
  if (!setup || setup.type !== "setupConfirmed") throw new Error("fixture setup missing");
  setup.payload.players = setup.payload.players.map((player) => (
    player.id === "player-1"
      ? { ...player, actualCharacter: "drunk", shownCharacter: "fortuneTeller" }
      : player
  ));
  game.game.events = game.game.events.filter((event) => event.type !== "redHerringAssigned");
  return game;
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}
