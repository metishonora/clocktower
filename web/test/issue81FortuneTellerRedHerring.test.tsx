import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { startLiveTargetSelection } from "./livePlayTestHelpers";
import { phaseEvent, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

const playerIds = {
  fortuneTeller: "player-1",
  goodTarget: "player-2",
  chef: "player-3",
  empath: "player-4",
  virgin: "player-5",
  spy: "player-6",
  imp: "player-7",
} as const;

describe("issue #81 Fortune Teller Red Herring assignment", () => {
  test("confirms one real WASM event, restores it after save/load, and returns to the same legal assignment after Undo", async () => {
    const game = gameAtRedHerringAssignment();
    const initialEventCount = game.game.events.length;
    await expectValidSeed(game);
    const before = await replayOrThrow(game);
    expect(before.currentStep?.id).toBe("firstNight:fortuneTellerRedHerring");

    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();
    const firstRender = render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByText("점쟁이의 착각으로 지정할 플레이어 1명을 선택하세요.");
    const input = await startLiveTargetSelection(user);
    const goodTarget = within(input).getByRole("button", { name: /Good Target/ }) as HTMLButtonElement;
    const spy = within(input).getByRole("button", { name: /Spy/ }) as HTMLButtonElement;
    const imp = within(input).getByRole("button", { name: /Imp/ }) as HTMLButtonElement;

    expect(goodTarget.disabled).toBe(false);
    expect(spy.disabled).toBe(false);
    expect(imp.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "대상을 선택하세요" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(goodTarget);
    await user.click(spy);
    const confirm = screen.getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await user.dblClick(confirm);

    expect(await screen.findByRole("button", { name: "대상 선택" })).toBeTruthy();
    await waitFor(() => {
      expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1);
    });
    const saved = latestSavedGame(storage);
    expect(saved.game.events.at(-1)).toMatchObject({
      type: "redHerringAssigned",
      payload: {
        stepId: "firstNight:fortuneTellerRedHerring",
        playerId: playerIds.spy,
        registrationJudgments: [
          { playerId: playerIds.spy, registeredAs: "good" },
        ],
      },
    });

    const confirmed = await replayOrThrow(saved);
    expect(confirmed.ruleState.redHerringPlayerId).toBe(playerIds.spy);
    expect(confirmed.currentStep?.id).toBe("firstNight:fortuneTeller");

    firstRender.unmount();
    const reloadedStorage = new MemoryGameStorageDriver(saved);
    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={reloadedStorage} />);
    expect(await screen.findByRole("button", { name: "대상 선택" })).toBeTruthy();

    const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
    await user.click(undo);
    await user.click(screen.getByRole("button", { name: "되돌리기" }));

    expect(await screen.findByText("점쟁이의 착각으로 지정할 플레이어 1명을 선택하세요.")).toBeTruthy();
    const restoredInput = await startLiveTargetSelection(user);
    expect((within(restoredInput).getByRole("button", { name: /Good Target/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(restoredInput).getByRole("button", { name: /Spy/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(restoredInput).getByRole("button", { name: /Imp/ }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => {
      expect(latestSavedGame(reloadedStorage).game.events).toHaveLength(initialEventCount);
    });
    const undone = await replayOrThrow(latestSavedGame(reloadedStorage));
    expect(undone.currentStep?.id).toBe("firstNight:fortuneTellerRedHerring");
    expect(undone.ruleState.redHerringPlayerId).toBeUndefined();
  });
});

function gameAtRedHerringAssignment(): GameFile {
  const players: SetupPlayerInput[] = [
    { id: playerIds.fortuneTeller, seat: 1, name: "Fortune Teller", actualCharacter: "fortuneTeller", shownCharacter: "fortuneTeller" },
    { id: playerIds.goodTarget, seat: 2, name: "Good Target", actualCharacter: "washerwoman", shownCharacter: "washerwoman" },
    { id: playerIds.chef, seat: 3, name: "Chef", actualCharacter: "chef", shownCharacter: "chef" },
    { id: playerIds.empath, seat: 4, name: "Empath", actualCharacter: "empath", shownCharacter: "empath" },
    { id: playerIds.virgin, seat: 5, name: "Virgin", actualCharacter: "virgin", shownCharacter: "virgin" },
    { id: playerIds.spy, seat: 6, name: "Spy", actualCharacter: "spy", shownCharacter: "spy" },
    { id: playerIds.imp, seat: 7, name: "Imp", actualCharacter: "imp", shownCharacter: "imp" },
  ];
  const events: GameEvent[] = [
    {
      id: "seed-setup",
      type: "setupConfirmed",
      phase: "setup",
      payload: { players },
      summary: "초기 설정 확정",
      createdAt: "2026-07-19T00:00:00.000Z",
    },
    phaseEvent("phaseStepConfirmed", "firstNight:minionInfo"),
    phaseEvent("phaseStepConfirmed", "firstNight:demonInfo", { characterIds: [] }),
    phaseEvent("phaseStepSkipped", "firstNight:washerwoman"),
    phaseEvent("phaseStepSkipped", "firstNight:chef"),
    phaseEvent("phaseStepSkipped", "firstNight:empath"),
  ];
  return {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id: "issue-81",
      name: "Issue 81 regression",
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      events,
    },
  };
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}

async function expectValidSeed(game: GameFile): Promise<void> {
  for (let eventCount = 1; eventCount <= game.game.events.length; eventCount += 1) {
    const probe = structuredClone(game);
    probe.game.events = probe.game.events.slice(0, eventCount);
    const result = await realWasmCore().replay(probe);
    if (!result.ok) {
      throw new Error(
        `seed failed after ${game.game.events[eventCount - 1]?.id}: ${result.error.code} ${result.error.messageKo}`,
      );
    }
  }
}
