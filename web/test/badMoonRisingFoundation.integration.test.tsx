import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { CanonicalSessionController } from "../src/core/canonicalSessionController";
import { BAD_MOON_RISING, TROUBLE_BREWING } from "../src/core/scripts";
import type { GameFile, SetupPlayerInput } from "../src/core/types";
import { wasmCoreAdapter } from "../src/core/wasmClient";
import { exportGameFileJson, importGameFileJson } from "../src/gameStorage";

beforeAll(() => {
  const wasm = readFileSync(join(
    process.cwd(),
    "src/generated/clocktower_wasm/clocktower_wasm_bg.wasm",
  ));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("clocktower_wasm_bg.wasm")) {
      return new Response(wasm, { headers: { "Content-Type": "application/wasm" } });
    }
    throw new Error(`unexpected fetch: ${String(input)}`);
  }));
});

afterAll(() => vi.unstubAllGlobals());

const players: SetupPlayerInput[] = [
  { seat: 1, name: "A", actualCharacter: "grandmother" },
  { seat: 2, name: "B", actualCharacter: "sailor" },
  { seat: 3, name: "C", actualCharacter: "chambermaid" },
  { seat: 4, name: "D", actualCharacter: "exorcist" },
  { seat: 5, name: "E", actualCharacter: "lunatic", shownCharacter: "shabaloth" },
  { seat: 6, name: "F", actualCharacter: "tinker" },
  { seat: 7, name: "G", actualCharacter: "godfather" },
  { seat: 8, name: "H", actualCharacter: "shabaloth" },
];

function emptyBmrGame(): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: BAD_MOON_RISING,
      id: "bmr-foundation-integration",
      name: "Bad Moon Rising",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      events: [],
    },
  };
}

describe("Bad Moon Rising production boundary", () => {
  test("preserves explicit setup choice and Lunatic identity through WASM, import/export, and undo", async () => {
    const distribution = await wasmCoreAdapter.setupDistribution({
      scriptId: BAD_MOON_RISING,
      playerCount: players.length,
      actualCharacters: players.map(({ actualCharacter }) => actualCharacter),
    });
    expect(distribution).toEqual({
      ok: true,
      value: {
        options: [
          {
            id: "addOutsider",
            distribution: { Townsfolk: 4, Outsider: 2, Minion: 1, Demon: 1 },
          },
          {
            id: "removeOutsider",
            distribution: { Townsfolk: 6, Outsider: 0, Minion: 1, Demon: 1 },
          },
        ],
      },
    });

    const controller = new CanonicalSessionController(BAD_MOON_RISING, wasmCoreAdapter);
    const empty = emptyBmrGame();
    const emptyReplay = await controller.replay(empty);
    expect(emptyReplay.ok).toBe(true);
    if (!emptyReplay.ok) return;

    const created = await controller.execute(empty, emptyReplay.value, {
      type: "createGame",
      payload: { players, setupChoiceId: "addOutsider" },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.replayState.setupChoiceId).toBe("addOutsider");
    expect(
      created.value.replayState.players.find(({ actualCharacter }) => actualCharacter === "lunatic"),
    ).toMatchObject({ actualCharacter: "lunatic", shownCharacter: "shabaloth" });

    const imported = importGameFileJson(
      exportGameFileJson(created.value.gameFile, new Date("2026-08-24T01:00:00.000Z")),
      BAD_MOON_RISING,
    );
    expect(() => importGameFileJson(JSON.stringify(imported), TROUBLE_BREWING)).toThrow(
      "현재 페이지와 다른 스크립트의 게임 파일입니다.",
    );
    const importedReplay = await controller.replay(imported);
    expect(importedReplay.ok).toBe(true);
    if (!importedReplay.ok) return;
    expect(importedReplay.value.setupChoiceId).toBe("addOutsider");
    expect(importedReplay.value.currentStep?.id).toBe("firstNight:minionInfo");

    const advanced = await controller.execute(imported, importedReplay.value, {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:minionInfo",
        expectedEventCount: imported.game.events.length,
      },
    });
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const undone = await controller.undo(
      advanced.value.gameFile,
      advanced.value.replayState,
      advanced.value.proposal.event.id,
    );
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.value.gameFile.game.events).toHaveLength(1);
    expect(undone.value.replayState.setupChoiceId).toBe("addOutsider");
    expect(undone.value.replayState.currentStep?.id).toBe("firstNight:minionInfo");
  });
});
