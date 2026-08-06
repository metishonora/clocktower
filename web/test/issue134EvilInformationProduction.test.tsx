import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameFile, SetupPlayerInput } from "../src/core/types";
import type { GameStorageDriver } from "../src/gameStorage";
import { SectsAndVioletsGameSurface } from "../src/sectsAndVioletsGame";
import { realWasmCore } from "./realWasmCoreHarness";

test("issue #134 confirms once, reopens safely, and continues through S&V Minion and Demon Reveal", async () => {
  const storage = new MemoryStorage(seedGame());
  const user = userEvent.setup();
  render(
    <SectsAndVioletsGameSurface
      coreAdapter={realWasmCore()}
      storageDriver={storage}
      production
      choiceTokenSource={() => 11}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByRole("heading", { name: "하수인 정보" })).toBeTruthy();
  expect(app.querySelector(".snvEvilInformationWakeInstruction")?.textContent).toBe(
    "8번 Minion Eight, 9번 Minion Nine를 깨웁니다.",
  );
  expect(within(app).getByRole("button", { name: "다음으로" }).hasAttribute("disabled")).toBe(true);
  await user.click(within(app).getByRole("button", { name: "정보 공개" }));
  await waitFor(() => expect(storage.latest.game.events).toHaveLength(2));
  let dialog = screen.getByRole("dialog", { name: "하수인 정보 공개" });
  expect(within(dialog).getByRole("heading", { name: "당신은 하수인입니다" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "악마는" })).toBeTruthy();
  expect(within(dialog).getByText("Demon Ten")).toBeTruthy();
  expect(within(dialog).queryByText("Minion Eight")).toBeNull();
  expect(within(dialog).queryByText("Minion Nine")).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(storage.latest.game.events).toHaveLength(2);

  await user.click(within(app).getByRole("button", { name: "정보 공개" }));
  dialog = screen.getByRole("dialog", { name: "하수인 정보 공개" });
  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(storage.latest.game.events).toHaveLength(2);
  await user.click(within(app).getByRole("button", { name: "다음으로" }));

  expect(await within(app).findByRole("heading", { name: "악마 정보" })).toBeTruthy();
  expect(app.querySelector(".snvEvilInformationWakeInstruction")?.textContent).toBe(
    "10번 Demon Ten를 깨웁니다.",
  );
  expect(within(app).getByText("0 / 3")).toBeTruthy();
  expect(within(app).getByRole("button", { name: "정보 공개" }).hasAttribute("disabled")).toBe(true);
  expect(within(app).getByRole("button", { name: "다음으로" }).hasAttribute("disabled")).toBe(true);
  await user.click(within(app).getByRole("button", { name: "속임수 무작위 추천" }));
  await waitFor(() => expect(within(app).getAllByText("선택됨")).toHaveLength(3));
  expect(within(app).getByRole("button", { name: "정보 공개" }).hasAttribute("disabled")).toBe(false);
  await user.click(within(app).getByRole("button", { name: "정보 공개" }));
  await waitFor(() => expect(storage.latest.game.events).toHaveLength(3));

  dialog = screen.getByRole("dialog", { name: "악마 정보 공개" });
  expect(within(dialog).getByRole("heading", { name: "당신은 악마입니다" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "당신의 하수인" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "속임수" })).toBeTruthy();
  expect(within(dialog).getByText("Minion Eight")).toBeTruthy();
  expect(within(dialog).getByText("Minion Nine")).toBeTruthy();
  expect(dialog.textContent).not.toContain("마녀");
  expect(dialog.textContent).not.toContain("세레노버스");
  expect(storage.latest.game.events).toHaveLength(3);
  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(within(app).getByRole("button", { name: "다음으로" }).hasAttribute("disabled")).toBe(false);
});

class MemoryStorage implements GameStorageDriver {
  constructor(public latest: GameFile) {}

  async loadLatestGame() {
    return structuredClone(this.latest);
  }

  async saveLatestGame(gameFile: GameFile) {
    this.latest = structuredClone(gameFile);
  }
}

function seedGame(): GameFile {
  const players: SetupPlayerInput[] = [
    ["clockmaker", "긴이름가나다라마바사아자차카타파하"],
    ["dreamer", "B"],
    ["snakeCharmer", "C"],
    ["mathematician", "D"],
    ["flowergirl", "E"],
    ["townCrier", "F"],
    ["oracle", "G"],
    ["witch", "Minion Eight"],
    ["cerenovus", "Minion Nine"],
    ["vortox", "Demon Ten"],
  ].map(([actualCharacter, name], index) => ({ seat: index + 1, name, actualCharacter }));
  const selectedIds = players.map(({ actualCharacter }) => actualCharacter);
  return {
    schemaVersion: 3,
    game: {
      id: "issue-134-web",
      name: "issue 134",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-31T00:00:00.000Z",
      updatedAt: "2026-07-31T00:00:00.000Z",
      events: [{
        id: "setup-134-web",
        type: "setupConfirmed",
        phase: "setup",
        payload: { players },
        summary: "초기 설정 확정: 10명",
        createdAt: "2026-07-31T00:00:00.000Z",
      }],
    },
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "play",
        savedAt: "2026-07-31T00:00:00.000Z",
        setup: {
          playerCount: 10,
          demon: "vortox",
          selectedIds,
          seatAssignments: Object.fromEntries(players.map(({ seat, actualCharacter }) => [seat, actualCharacter])),
          seatAlignments: Object.fromEntries(players.map(({ seat }, index) => [seat, index >= 7 ? "evil" : "good"])),
          seatNames: Object.fromEntries(players.map(({ seat, name }) => [seat, name])),
          rosterConfirmed: true,
          seatingConfirmed: true,
        },
        phaseCheckpoints: [{
          id: "setup-134-web",
          eventIds: ["setup-134-web"],
          kind: "setup",
          eventCount: 1,
          summary: "초기 설정 확정: 10명",
          activeTab: "seating",
        }],
      },
    },
  };
}
