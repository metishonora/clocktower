import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("presents the attached healthy Chef alternatives as truthful registration treatments", async () => {
  const game = await attachedHealthyChefGame();
  const replayed = await replayOrThrow(game);

  expect(replayed.currentStep?.id).toBe("firstNight:chef");
  expect(replayed.currentStep?.informationPrompt).toMatchObject({
    computedResult: { kind: "number", value: 1 },
    deliveryMode: "selectable",
    activeReasons: [],
    numberChoices: [
      {
        value: 0,
        isComputed: false,
        registrationJudgments: [
          { playerId: "player-5", registeredAs: "good" },
          { playerId: "player-9", registeredAs: "good" },
        ],
      },
      { value: 1, isComputed: true, registrationJudgments: [] },
    ],
  });

  const arbitraryDelivery = await realWasmCore().propose(game, {
    type: "confirmStep",
    payload: {
      stepId: "firstNight:chef",
      input: null,
      deliveredResult: { kind: "number", value: 99 },
    },
  });
  expect(arbitraryDelivery).toMatchObject({
    ok: false,
    error: { code: "INVALID_REGISTRATION_JUDGMENT" },
  });

  const treatedDelivery = await realWasmCore().propose(game, {
    type: "confirmStep",
    payload: {
      stepId: "firstNight:chef",
      input: null,
      deliveredResult: { kind: "number", value: 0 },
      registrationJudgments: [
        { playerId: "player-5", registeredAs: "good" },
        { playerId: "player-9", registeredAs: "good" },
      ],
    },
  });
  expect(treatedDelivery).toMatchObject({
    ok: true,
    value: {
      event: {
        payload: {
          information: {
            computedResult: { kind: "number", value: 1 },
            deliveredResult: { kind: "number", value: 0 },
            deliveryContext: {
              type: "discretionary",
              reasons: [{
                type: "registrationJudgment",
                judgments: [
                  { playerId: "player-5", registeredAs: "good" },
                  { playerId: "player-9", registeredAs: "good" },
                ],
              }],
            },
          },
        },
      },
    },
  });

  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await screen.findByRole("heading", { name: "요리사: 14번 플레이어 14" });
  const choices = screen.getByLabelText("전달할 숫자");
  expect(within(choices).queryAllByText("거짓", { exact: true })).toHaveLength(0);
  expect(within(choices).getByRole("button", { name: /진실.*1/ })).toBeTruthy();
  const treatedChoice = within(choices).getByRole("button", {
    name: /취급.*0.*5번 플레이어 5.*선한 팀으로 취급.*9번 플레이어 9.*선한 팀으로 취급/,
  });
  expect(screen.queryByRole("spinbutton")).toBeNull();

  const revealButton = screen.getByRole("button", { name: "정보 공개" }) as HTMLButtonElement;
  expect(revealButton.disabled).toBe(true);
  await user.click(treatedChoice);
  expect(revealButton.disabled).toBe(false);
  await user.click(revealButton);

  const reveal = await screen.findByRole("dialog", { name: "요리사 정보 공개" });
  expect(within(reveal).getByText("0쌍", { exact: true })).toBeTruthy();
  await waitFor(() => expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
    type: "phaseStepConfirmed",
    payload: {
      stepId: "firstNight:chef",
      input: null,
      information: {
        computedResult: { kind: "number", value: 1 },
        deliveredResult: { kind: "number", value: 0 },
        deliveryContext: {
          type: "discretionary",
          reasons: [{
            type: "registrationJudgment",
            judgments: [
              { playerId: "player-5", registeredAs: "good" },
              { playerId: "player-9", registeredAs: "good" },
            ],
          }],
        },
      },
    },
  }));
});

test("keeps an impaired Chef freely editable while preserving the computed truth", async () => {
  const game = await poisonedChefGame();
  const replayed = await replayOrThrow(game);

  expect(replayed.currentStep?.id).toBe("firstNight:chef");
  expect(replayed.currentStep?.informationPrompt).toMatchObject({
    computedResult: { kind: "number" },
    deliveryMode: "selectable",
    activeReasons: [expect.objectContaining({ type: "poisoned" })],
    numberChoices: [],
    numberConstraint: {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      excludedValues: [],
    },
  });

  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await screen.findByRole("heading", { name: "요리사: 1번 Chef" });
  const result = screen.getByRole("group", { name: "정보 결과" });
  const deliveredNumber = within(result).getByRole("spinbutton", { name: "전달할 숫자" }) as HTMLInputElement;
  expect(deliveredNumber.value).toBe("0");
  await user.clear(deliveredNumber);
  await user.type(deliveredNumber, "99");
  await user.click(screen.getByRole("button", { name: "중독 정보 공개" }));

  const reveal = await screen.findByRole("dialog", { name: "요리사 정보 공개" });
  expect(within(reveal).getByText("99쌍", { exact: true })).toBeTruthy();
  await waitFor(() => expect(latestSavedGame(storage).game.events.at(-1)).toMatchObject({
    type: "phaseStepConfirmed",
    payload: {
      stepId: "firstNight:chef",
      information: {
        deliveredResult: { kind: "number", value: 99 },
        deliveryContext: {
          type: "discretionary",
          reasons: [expect.objectContaining({ type: "poisoned" })],
        },
      },
    },
  }));
});

async function attachedHealthyChefGame(): Promise<GameFile> {
  const game = gameWithRoster("issue-153-attached-healthy-chef", [
    ["imp", "imp"],
    ["undertaker", "undertaker"],
    ["empath", "empath"],
    ["scarletWoman", "scarletWoman"],
    ["spy", "spy"],
    ["ravenkeeper", "ravenkeeper"],
    ["investigator", "investigator"],
    ["fortuneTeller", "fortuneTeller"],
    ["recluse", "recluse"],
    ["monk", "monk"],
    ["washerwoman", "washerwoman"],
    ["poisoner", "poisoner"],
    ["librarian", "librarian"],
    ["chef", "chef"],
    ["drunk", "librarian"],
  ]);

  await confirm(game, "firstNight:minionInfo", null);
  await confirm(game, "firstNight:demonInfo", { characterIds: ["virgin", "slayer", "soldier"] });
  await confirm(game, "firstNight:poisoner", { playerIds: ["player-7"] });
  await confirm(game, "firstNight:washerwoman", {
    playerIds: ["player-14", "player-13"],
    characterId: "chef",
  });
  await confirm(game, "firstNight:librarian", {
    playerIds: ["player-5", "player-4"],
    characterId: "butler",
  });
  await confirm(game, "firstNight:librarian:player-13", {
    playerIds: ["player-5", "player-6"],
    characterId: "recluse",
  }, [{ playerId: "player-5", registeredAs: "outsider", characterId: "recluse" }]);
  await confirm(game, "firstNight:investigator", {
    playerIds: ["player-9", "player-8"],
    characterId: "poisoner",
  });
  return game;
}

async function poisonedChefGame(): Promise<GameFile> {
  const game = gameWithRoster("issue-153-poisoned-chef", [
    ["chef", "chef", "Chef"],
    ["empath", "empath", "Good"],
    ["fortuneTeller", "fortuneTeller", "Good 2"],
    ["poisoner", "poisoner", "Poisoner"],
    ["imp", "imp", "Imp"],
  ]);
  await confirm(game, "firstNight:minionInfo", null);
  await confirm(game, "firstNight:demonInfo", null);
  await confirm(game, "firstNight:poisoner", { playerIds: ["player-1"] });
  return game;
}

function gameWithRoster(
  id: string,
  roster: Array<[actualCharacter: string, shownCharacter: string, name?: string]>,
): GameFile {
  const players: SetupPlayerInput[] = roster.map(([actualCharacter, shownCharacter, name], index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: name ?? `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter,
  }));
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    payload: { players },
    phase: "setup",
    summary: `초기 설정 확정: ${players.length}명`,
    createdAt: "2026-08-14T08:41:16.171Z",
  };
  return {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id,
      name: "Trouble Brewing",
      createdAt: setup.createdAt,
      updatedAt: setup.createdAt,
      events: [setup],
    },
  };
}

async function confirm(
  game: GameFile,
  stepId: string,
  input: Extract<Command, { type: "confirmStep" }>["payload"]["input"],
  registrationJudgments?: Extract<Command, { type: "confirmStep" }>["payload"]["registrationJudgments"],
) {
  const replayed = await replayOrThrow(game);
  expect(replayed.currentStep?.id).toBe(stepId);
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: { stepId, input, registrationJudgments },
  });
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}
