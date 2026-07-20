import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile, ReplayState, RevealPayload } from "../src/core/types";
import { IndexedDbGameStorageDriver } from "../src/gameStorage";
import { ClocktowerApp } from "../src/main";
import { seatLayoutPositions } from "../src/setupDraft";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  proposal,
  players,
  replayState,
  step,
} from "./clocktowerAppHarness";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
});

describe("ClocktowerApp live-play integration", () => {
  test("keeps an unsupported IndexedDB autosave until the existing new-game recovery is chosen", async () => {
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: step({ id: "unused" }) }),
      replayAfterProposal: replayState({ currentStep: step({ id: "unused" }), eventCount: 2 }),
      proposal: proposal(gameFile().game.events[0]),
    });
    const idb = new IDBFactory();
    const unsupportedGame = { ...gameFile(), schemaVersion: 1 };
    await putRawLatestGame(idb, unsupportedGame);
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ClocktowerApp coreAdapter={core} storageDriver={new IndexedDbGameStorageDriver(idb)} />);

    expect((await screen.findAllByText("지원하지 않는 게임 파일 버전입니다.")).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "플레이어 추가" }) as HTMLButtonElement).disabled).toBe(false);

    const seatMap = screen.getByLabelText("조정 가능한 마도서 좌석 맵");
    const assignments = [
      ["플레이어 1", "세탁부"],
      ["플레이어 2", "사서"],
      ["플레이어 3", "요리사"],
      ["플레이어 4", "독살범"],
      ["플레이어 5", "임프"],
    ] as const;
    for (const [playerName, characterName] of assignments) {
      await user.click(within(seatMap).getByRole("button", { name: new RegExp(playerName) }));
      const characterButton = screen.getByText(characterName, { selector: ".characterText strong" }).closest("button");
      if (!characterButton) throw new Error(`${characterName} character card was not rendered`);
      await user.click(characterButton);
    }

    expect((screen.getByRole("button", { name: "설정 확정" }) as HTMLButtonElement).disabled).toBe(true);
    expect(await getRawLatestGame(idb)).toEqual(unsupportedGame);

    await user.click(screen.getByRole("button", { name: "새 게임" }));

    await waitFor(() => {
      expect(screen.queryAllByText("지원하지 않는 게임 파일 버전입니다.")).toHaveLength(0);
    });
    await waitFor(async () => {
      expect(await getRawLatestGame(idb)).toMatchObject({
        schemaVersion: 2,
        game: { events: [] },
      });
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  test("rejects an invalid stored log as a whole and replaces it only after starting a new game", async () => {
    const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    vi.mocked(core.replay).mockImplementation(async (candidate) =>
      candidate.game.events.length > 0
        ? { ok: false, error: { code: "REPLAY_FAILED", messageKo: "저장 로그 무효" } }
        : {
            ok: true,
            value: {
              schemaVersion: 2,
              eventCount: 0,
              phase: "setup",
              players: [],
              currentStep: null,
              phaseOverview: [],
              ruleState: { unannouncedNightDeathPlayerIds: [] },
              warnings: [],
            },
          },
    );
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    expect((await screen.findAllByText("저장 로그 무효")).length).toBeGreaterThan(0);
    expect(storage.savedGames).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "새 게임" }));

    await waitFor(() => expect(storage.savedGames).toHaveLength(1));
    expect(storage.savedGames[0]?.schemaVersion).toBe(2);
    expect(storage.savedGames[0]?.game.events).toEqual([]);
  });

  test("starts confirmed setup and Event Log collapsed and expands them independently", async () => {
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const setupDetails = screen.getByText("설정 및 불러오기").closest("details") as HTMLDetailsElement;
    const logDetails = screen.getByText("이벤트 로그").closest("details") as HTMLDetailsElement;
    expect(setupDetails.open).toBe(false);
    expect(logDetails.open).toBe(false);
    expect(within(logDetails).getByText("1건")).toBeTruthy();

    await user.click(within(setupDetails).getByText("설정 및 불러오기"));
    expect(setupDetails.open).toBe(true);
    expect(logDetails.open).toBe(false);
    await user.click(within(logDetails).getByText("이벤트 로그"));
    expect(setupDetails.open).toBe(true);
    expect(logDetails.open).toBe(true);
  });

  test("shows the latest event Undo beside the collapsed log and cancellation changes nothing", async () => {
    const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
    const latestEvent = event("event-poisoner", "독살범이 2번 Bert를 선택함");
    const storedGame = gameFile();
    storedGame.game.events.push(latestEvent);
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const storage = new MemoryGameStorageDriver(storedGame);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    const logDetails = screen.getByText("이벤트 로그").closest("details") as HTMLDetailsElement;
    expect(logDetails.open).toBe(false);
    expect(screen.queryByRole("button", { name: "설정 다시 수정" })).toBeNull();
    expect(screen.getAllByText(latestEvent.summary).length).toBeGreaterThan(0);
    const undo = screen.getByRole("button", { name: "Undo" });
    await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(2));
    const replayCallsBefore = vi.mocked(core.replay).mock.calls.length;
    const savesBefore = storage.savedGames.length;

    await user.click(undo);
    const dialog = screen.getByRole("dialog", { name: "최근 확정 행동을 되돌릴까요?" });
    expect(within(dialog).getByText(`되돌릴 항목: ${latestEvent.summary}`)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog", { name: "최근 확정 행동을 되돌릴까요?" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(undo));
    expect(screen.getAllByText(latestEvent.summary).length).toBeGreaterThan(0);
    expect(vi.mocked(core.replay).mock.calls).toHaveLength(replayCallsBefore);
    expect(storage.savedGames).toHaveLength(savesBefore);
    expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(2);
  });

  test("each confirmed Undo removes one latest live event, replays, autosaves, then exposes setup recovery", async () => {
    const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
    const firstLiveEvent = event("event-poisoner", "독살범이 2번 Bert를 선택함");
    const secondLiveEvent = event("event-chef", "요리사 정보 확정 · 1쌍 공개");
    const storedGame = gameFile();
    storedGame.game.events.push(firstLiveEvent, secondLiveEvent);
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 3 }),
      proposal: proposal(event("unused", "unused")),
    });
    vi.mocked(core.replay).mockImplementation(async (candidate) => ({
      ok: true,
      value: replayState({ currentStep, eventCount: candidate.game.events.length }),
    }));
    const storage = new MemoryGameStorageDriver(storedGame);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await waitFor(() => expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(false));

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(`되돌릴 항목: ${secondLiveEvent.summary}`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "되돌리기" }));
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(2));
    expect(latestSavedGame(storage.savedGames).game.events.at(-1)).toEqual(firstLiveEvent);
    expect(screen.queryByText(secondLiveEvent.summary)).toBeNull();
    await waitFor(() => expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(false));

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(`되돌릴 항목: ${firstLiveEvent.summary}`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "되돌리기" }));
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(1));

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await user.click(screen.getByText("설정 및 불러오기"));
    expect(screen.getByRole("button", { name: "설정 다시 수정" })).toBeTruthy();
    expect(vi.mocked(core.replay).mock.calls.some(([candidate]) => candidate.game.events.length === 2)).toBe(true);
    expect(vi.mocked(core.replay).mock.calls.some(([candidate]) => candidate.game.events.length === 1)).toBe(true);
  });

  test("setup recovery remains separate, restores the confirmed Players, replays, and autosaves", async () => {
    const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const confirmSetupRecovery = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await user.click(screen.getByText("설정 및 불러오기"));
    await user.click(screen.getByRole("button", { name: "설정 다시 수정" }));

    expect(confirmSetupRecovery).toHaveBeenCalledWith("설정 확정을 되돌리고 다시 수정할까요?");
    expect(await screen.findByText("마도서 초안")).toBeTruthy();
    expect(screen.getByDisplayValue("Ada")).toBeTruthy();
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(0));
    expect(vi.mocked(core.replay).mock.calls.some(([candidate]) => candidate.game.events.length === 0)).toBe(true);
    confirmSetupRecovery.mockRestore();
  });

  test("confirms a completed setup draft through the visible setup form", async () => {
    const firstStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
    const setupEvent = gameFile().game.events[0];
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: firstStep }),
      replayAfterProposal: replayState({ currentStep: firstStep, eventCount: 2 }),
      proposal: proposal(setupEvent),
    });
    const storage = new MemoryGameStorageDriver(undefined);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    const seatMap = await screen.findByLabelText("조정 가능한 마도서 좌석 맵");
    await user.click(screen.getByRole("button", { name: "긴 테이블" }));
    const assignments = [
      ["플레이어 1", "세탁부"],
      ["플레이어 2", "사서"],
      ["플레이어 3", "요리사"],
      ["플레이어 4", "독살범"],
      ["플레이어 5", "임프"],
    ] as const;
    for (const [playerName, characterName] of assignments) {
      await user.click(within(seatMap).getByRole("button", { name: new RegExp(playerName) }));
      const characterButton = screen.getByText(characterName, { selector: ".characterText strong" }).closest("button");
      if (!characterButton) throw new Error(`${characterName} character card was not rendered`);
      await user.click(characterButton);
    }

    const confirmButton = screen.getByRole("button", { name: "설정 확정" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    await user.click(confirmButton);

    expect(core.propose).toHaveBeenLastCalledWith(expect.any(Object), {
      type: "createGame",
      payload: {
        players: [
          { seat: 1, name: "플레이어 1", actualCharacter: "washerwoman" },
          { seat: 2, name: "플레이어 2", actualCharacter: "librarian" },
          { seat: 3, name: "플레이어 3", actualCharacter: "chef" },
          { seat: 4, name: "플레이어 4", actualCharacter: "poisoner" },
          { seat: 5, name: "플레이어 5", actualCharacter: "imp" },
        ],
      },
    });
    expect(await screen.findByRole("heading", { name: "세탁부: 1번 Ada" })).toBeTruthy();
    expect(screen.getByText("초기 설정 확정")).toBeTruthy();
    await waitFor(() => {
      expect(seatLayoutOf(latestSavedGame(storage.savedGames))).toEqual({
        preset: "longTable",
        positions: seatLayoutPositions(5, "longTable"),
      });
    });
  });

  test("confirms a current step through Command, canonical event, replay, event log, and autosave", async () => {
    const currentStep = step({
      id: "firstNight:poisoner",
      character: "poisoner",
      playerId: "player-4",
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
    });
    const nextStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
    });
    const canonicalEvent = event("event-poisoner", "독살범이 1번 Ada를 선택함");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "독살범: 4번 Dae" });
    const currentAction = screen.getByLabelText("현재 단계");
    const actor = within(currentAction).getByLabelText("현재 행동자");
    expect(within(actor).getByText("행동자")).toBeTruthy();
    expect(within(actor).getByRole("heading", { name: "독살범" })).toBeTruthy();
    expect(within(actor).getByText("4번 Dae")).toBeTruthy();
    expect(within(actor).getByText("매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다.")).toBeTruthy();
    expect(within(currentAction).getByText("중독시킬 플레이어 1명을 선택하세요.")).toBeTruthy();
    expect(storage.loadLatestGame).toHaveBeenCalledTimes(1);
    const stepInput = screen.getByLabelText("단계 입력");
    expect(stepInput.querySelector(".setupInfoCandidate")).toBeNull();
    expect(within(stepInput).queryByText(/실제:/)).toBeNull();
    const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.click(within(stepInput).getByRole("button", { name: /Ada/ }));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledTimes(1);
    expect(core.propose).toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ events: [expect.any(Object)] }) }),
      {
        type: "confirmStep",
        payload: {
          stepId: "firstNight:poisoner",
          input: { playerIds: ["player-1"] },
        },
      },
    );
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    expect(screen.getAllByText("독살범이 1번 Ada를 선택함").length).toBeGreaterThan(0);

    await waitFor(() => {
      const savedGame = latestSavedGame(storage.savedGames);
      expect(savedGame.game.events).toHaveLength(2);
      expect(savedGame.game.events[1]).toEqual(canonicalEvent);
      expect(
        savedGame.game.events.filter((savedEvent) => savedEvent.id === canonicalEvent.id),
      ).toHaveLength(1);
      expect(storage.saveLatestGame).toHaveBeenCalledWith(savedGame);
    });
    expect(core.replay).toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ events: [expect.any(Object), canonicalEvent] }) }),
    );
  });

  test("constrains setup-information context and character choices to candidate Actual Characters", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-3"
        ? { ...player, actualCharacter: "drunk", shownCharacter: "librarian" }
        : player,
    );
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
    });
    const nextStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: nextStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("event-washerwoman", "세탁부 정보 확정"), {
        messageKo: "두 후보 중 한 명은 세탁부입니다.",
      }),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const candidateInput = screen.getByLabelText("단계 입력");
    const ada = within(candidateInput).getByRole("button", { name: /Ada/ });
    const bert = within(candidateInput).getByRole("button", { name: /Bert/ });
    const cy = within(candidateInput).getByRole("button", { name: /Cy/ });
    const dae = within(candidateInput).getByRole("button", { name: /Dae/ });
    const eun = within(candidateInput).getByRole("button", { name: /Eun/ });

    expect(ada.classList.contains("setupInfoCandidate")).toBe(true);
    expect(ada.classList.contains("character-kind-townsfolk")).toBe(true);
    expect(cy.classList.contains("character-kind-outsider")).toBe(true);
    expect(dae.classList.contains("character-kind-minion")).toBe(true);
    expect(eun.classList.contains("character-kind-demon")).toBe(true);
    expect(within(cy).getByText("실제: 주정뱅이")).toBeTruthy();
    expect(within(cy).getByText("본인 인식: 사서")).toBeTruthy();

    const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
    const grimoireAda = within(grimoire).getByRole("button", { name: /Ada/ });
    const grimoireBert = within(grimoire).getByRole("button", { name: /Bert/ });
    expect(screen.queryByRole("button", { name: "위치 조정" })).toBeNull();
    await user.click(grimoireAda);
    expect(grimoireAda.getAttribute("aria-pressed")).toBe("true");
    await user.click(grimoireBert);
    expect(bert.getAttribute("aria-pressed")).toBe("true");
    await user.click(within(grimoire).getByRole("button", { name: /Cy/ }));
    expect(cy.getAttribute("aria-pressed")).toBe("false");
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
    expect(within(characterSelect).getByRole("option", { name: "세탁부" })).toBeTruthy();
    expect(within(characterSelect).getByRole("option", { name: "요리사" })).toBeTruthy();
    expect(within(characterSelect).queryByRole("option", { name: "사서" })).toBeNull();
    await user.selectOptions(characterSelect, "chef");
    expect(characterSelect.value).toBe("chef");

    await user.click(bert);
    expect(characterSelect.value).toBe("");
    await user.click(cy);
    expect(within(characterSelect).queryByRole("option", { name: "요리사" })).toBeNull();
    expect(within(characterSelect).queryByRole("option", { name: "사서" })).toBeNull();
    expect(within(characterSelect).queryByRole("option", { name: "주정뱅이" })).toBeNull();
    await user.selectOptions(characterSelect, "washerwoman");
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:washerwoman",
        input: { playerIds: ["player-1", "player-3"], characterId: "washerwoman" },
      },
    });

    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));
    const revealScreen = screen.getByLabelText("플레이어 공개 화면");
    expect(within(revealScreen).queryByText(/실제:/)).toBeNull();
    expect(within(revealScreen).queryByText(/본인 인식:/)).toBeNull();
  });

  test("suggests and atomically re-suggests a draft without persistence, then uses the existing confirm and Reveal path", async () => {
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
      supportsRandomSuggestion: true,
    });
    const nextStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
    const canonicalEvent = event("event-washerwoman-suggested", "세탁부 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, { messageKo: "세탁부 정보: 2번 Bert 또는 3번 Cy 중 한 명은 요리사입니다." }),
    });
    vi.mocked(core.suggestPhaseInput)
      .mockResolvedValueOnce({
        ok: true,
        value: {
          stepId: currentStep.id,
          input: { playerIds: ["player-1", "player-2"], characterId: "washerwoman" },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          stepId: currentStep.id,
          input: { playerIds: ["player-2", "player-3"], characterId: "librarian" },
        },
      });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} choiceTokenSource={() => 123} />);
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    await waitFor(() => expect(storage.savedGames.length).toBeGreaterThan(0));
    const savesBeforeSuggestion = storage.savedGames.length;
    const input = screen.getByLabelText("단계 입력");

    await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
    expect(core.suggestPhaseInput).toHaveBeenLastCalledWith(expect.any(Object), {
      stepId: currentStep.id,
      currentInput: { playerIds: [], characterId: "" },
      choiceToken: 123,
    });
    expect(within(input).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("washerwoman");
    expect(core.propose).not.toHaveBeenCalled();
    expect(storage.savedGames).toHaveLength(savesBeforeSuggestion);

    await user.click(within(input).getByRole("button", { name: "다시 추천" }));
    expect(within(input).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("false");
    expect(within(input).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(input).getByRole("button", { name: /Cy/ }).getAttribute("aria-pressed")).toBe("true");
    const character = screen.getByRole("combobox", { name: "보여줄 캐릭터" });
    expect((character as HTMLSelectElement).value).toBe("librarian");

    await user.selectOptions(character, "chef");
    expect((character as HTMLSelectElement).value).toBe("chef");
    expect(storage.savedGames).toHaveLength(savesBeforeSuggestion);
    await user.click(screen.getByRole("button", { name: "확정" }));
    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: currentStep.id,
        input: { playerIds: ["player-2", "player-3"], characterId: "chef" },
      },
    });

    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));
    expect(within(screen.getByLabelText("플레이어 공개 화면")).getByText(/2번 Bert 또는 3번 Cy/)).toBeTruthy();
  });

  test("keeps the current manual draft when a suggestion request fails", async () => {
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
      supportsRandomSuggestion: true,
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
      suggestion: {
        ok: false,
        error: { code: "NO_VALID_DRAFT_SUGGESTION", messageKo: "Actual Character 배정을 확인하세요." },
      },
    });
    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} choiceTokenSource={() => 9} />);
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const input = screen.getByLabelText("단계 입력");
    await user.click(within(input).getByRole("button", { name: /Ada/ }));
    await user.click(within(input).getByRole("button", { name: /Bert/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "보여줄 캐릭터" }), "washerwoman");

    await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
    expect(screen.getByRole("alert").textContent).toContain("Actual Character 배정을 확인하세요.");
    expect(within(input).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(input).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("washerwoman");
    expect(core.propose).not.toHaveBeenCalled();
  });

  test("discards a deferred suggestion when the Grimoire draft changes during the request", async () => {
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
      supportsRandomSuggestion: true,
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const pending = deferred<Awaited<ReturnType<typeof core.suggestPhaseInput>>>();
    vi.mocked(core.suggestPhaseInput).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    render(
      <ClocktowerApp
        coreAdapter={core}
        storageDriver={new MemoryGameStorageDriver(gameFile())}
        choiceTokenSource={() => 17}
      />,
    );
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });

    await user.click(screen.getByRole("button", { name: "무작위 추천" }));
    const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
    await user.click(within(grimoire).getByRole("button", { name: /Ada/ }));
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");

    pending.resolve({
      ok: true,
      value: {
        stepId: currentStep.id,
        input: { playerIds: ["player-2", "player-3"], characterId: "librarian" },
      },
    });

    await waitFor(() =>
      expect((screen.getByRole("button", { name: "무작위 추천" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(grimoire).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("");
  });

  test("discards a deferred suggestion after importing another game at the same step ID", async () => {
    const currentStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "washerwoman",
      characterKind: "Townsfolk",
      supportsRandomSuggestion: true,
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const pending = deferred<Awaited<ReturnType<typeof core.suggestPhaseInput>>>();
    vi.mocked(core.suggestPhaseInput).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    render(
      <ClocktowerApp
        coreAdapter={core}
        storageDriver={new MemoryGameStorageDriver(gameFile())}
        choiceTokenSource={() => 23}
      />,
    );
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    await user.click(screen.getByRole("button", { name: "무작위 추천" }));

    const imported = gameFile();
    imported.game.id = "different-game-at-same-step";
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.upload(
      fileInput,
      new File([JSON.stringify(imported)], "different-game.json", { type: "application/json" }),
    );
    await waitFor(() => expect(core.replay).toHaveBeenCalledWith(imported));

    pending.resolve({
      ok: true,
      value: {
        stepId: currentStep.id,
        input: { playerIds: ["player-2", "player-3"], characterId: "librarian" },
      },
    });
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "무작위 추천" }) as HTMLButtonElement).disabled).toBe(false),
    );
    const input = screen.getByLabelText("단계 입력");
    expect(within(input).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect((screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("");
    confirm.mockRestore();
  });

  test("atomically applies zero-Outsider and exact-three Demon suggestions", async () => {
    const librarianStep = step({
      id: "firstNight:librarian",
      character: "librarian",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 0,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      supportsRandomSuggestion: true,
    });
    const librarianCore = createCoreHarness({
      initialReplay: replayState({ currentStep: librarianStep }),
      replayAfterProposal: replayState({ currentStep: librarianStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
      suggestion: {
        ok: true,
        value: { stepId: librarianStep.id, input: { zeroOutsiders: true } },
      },
    });
    const user = userEvent.setup();
    const librarianView = render(
      <ClocktowerApp coreAdapter={librarianCore} storageDriver={new MemoryGameStorageDriver(gameFile())} choiceTokenSource={() => 1} />,
    );
    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    await user.click(screen.getByRole("button", { name: "무작위 추천" }));
    expect((screen.getByRole("checkbox", { name: "외지인 0명" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(false);
    expect(librarianCore.propose).not.toHaveBeenCalled();
    librarianView.unmount();

    const demonStep = step({
      id: "firstNight:demonInfo",
      kind: "characterIds",
      target: "characters",
      minSelections: 0,
      maxSelections: 3,
      stepType: "evilInfo",
      allowedCharacterIds: ["librarian", "undertaker", "butler", "monk"],
      supportsRandomSuggestion: true,
    });
    const demonCore = createCoreHarness({
      initialReplay: replayState({ currentStep: demonStep }),
      replayAfterProposal: replayState({ currentStep: demonStep, eventCount: 2 }),
      proposal: proposal(event("unused-demon", "unused")),
      suggestion: {
        ok: true,
        value: {
          stepId: demonStep.id,
          input: { characterIds: ["librarian", "undertaker", "butler"] },
        },
      },
    });
    render(<ClocktowerApp coreAdapter={demonCore} storageDriver={new MemoryGameStorageDriver(gameFile())} choiceTokenSource={() => 2} />);
    const characterInput = await screen.findByLabelText("캐릭터 입력");
    expect(screen.getByText("악마에게 보여줄 블러프 캐릭터를 최대 3개 선택하세요.")).toBeTruthy();
    await user.click(within(characterInput).getByRole("button", { name: "무작위 추천" }));
    expect(within(characterInput).getAllByRole("button", { pressed: true })).toHaveLength(3);
    await user.click(within(characterInput).getByRole("button", { name: /사서/ }));
    expect(within(characterInput).getAllByRole("button", { pressed: true })).toHaveLength(2);
    expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(false);
    expect(demonCore.propose).not.toHaveBeenCalled();
  });

  test("shows only core-allowed Demon bluffs and confirms the selected safe Reveal", async () => {
    const currentStep = step({
      id: "firstNight:demonInfo",
      kind: "characterIds",
      target: "characters",
      minSelections: 0,
      maxSelections: 3,
      stepType: "evilInfo",
      allowedCharacterIds: ["librarian", "undertaker", "butler"],
    });
    const nextStep = step({
      id: "firstNight:washerwoman",
      character: "washerwoman",
      playerId: "player-1",
    });
    const canonicalEvent = event("event-demon-info", "악마 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, {
        kind: "demonInformation",
        minionPlayers: [{ seat: 4, name: "Dae" }],
        bluffCharacterIds: ["librarian", "undertaker", "butler"],
      }),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "악마 깨우기 · 하수인과 블러프 확인" });
    await user.click(screen.getByText("0 / 1 완료"));
    const phaseOverview = screen.getByRole("region", { name: "단계 개요" });
    expect(within(phaseOverview).getByText("악마 (5)")).toBeTruthy();
    const characterInput = await screen.findByLabelText("캐릭터 입력");
    expect(within(characterInput).getByRole("button", { name: /사서/ })).toBeTruthy();
    expect(within(characterInput).getByRole("button", { name: /장의사/ })).toBeTruthy();
    expect(within(characterInput).getByRole("button", { name: /집사/ })).toBeTruthy();
    expect(within(characterInput).queryByRole("button", { name: /세탁부/ })).toBeNull();
    expect(within(characterInput).queryByRole("button", { name: /독살범/ })).toBeNull();
    expect(within(characterInput).queryByRole("button", { name: /임프/ })).toBeNull();

    await user.click(within(characterInput).getByRole("button", { name: /사서/ }));
    await user.click(within(characterInput).getByRole("button", { name: /장의사/ }));
    await user.click(within(characterInput).getByRole("button", { name: /집사/ }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:demonInfo",
        input: { characterIds: ["librarian", "undertaker", "butler"] },
      },
    });
    await waitFor(() => {
      expect(latestSavedGame(storage.savedGames).game.events[1]).toEqual(canonicalEvent);
    });

    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(screen.getByRole("heading", { name: "악마 깨우기 · 하수인과 블러프 확인" })).toBeTruthy();
    expect(within(followup).queryByText(/확정됨|리플레이|다시 열|숨김/)).toBeNull();
    expect(within(followup).queryByLabelText("Reveal 미리보기")).toBeNull();
    await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));
    const revealScreen = screen.getByLabelText("플레이어 공개 화면");
    expect(within(revealScreen).getByText("악마 정보")).toBeTruthy();
    expect(within(revealScreen).getByRole("heading", { name: "하수인과 블러프를 확인하세요" })).toBeTruthy();
    expect(within(revealScreen).getByText("4번 Dae")).toBeTruthy();
    for (const character of ["사서", "장의사", "집사"]) {
      expect(within(revealScreen).getByRole("img", { name: `${character} 공식 캐릭터 아이콘` })).toBeTruthy();
    }
    expect(within(revealScreen).queryByText(/독살범|poisoner/)).toBeNull();
    expect(screen.queryByText("마도서")).toBeNull();
    expect(screen.queryByText("이벤트 로그")).toBeNull();
  });

  test("treats Drunk as an Actual Outsider for Librarian choices and disables zero Outsiders", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-3"
        ? { ...player, actualCharacter: "drunk", shownCharacter: "chef" }
        : player,
    );
    const currentStep = step({
      id: "firstNight:librarian",
      character: "librarian",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    const zeroOutsiders = screen.getByRole("checkbox", { name: "외지인 0명" }) as HTMLInputElement;
    expect(zeroOutsiders.disabled).toBe(true);
    expect(screen.getByText("실제 외지인이 있어 0명을 선택할 수 없습니다.")).toBeTruthy();

    const candidateInput = screen.getByLabelText("단계 입력");
    await user.click(within(candidateInput).getByRole("button", { name: /Bert/ }));
    await user.click(within(candidateInput).getByRole("button", { name: /Cy/ }));
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" });
    expect(within(characterSelect).getByRole("option", { name: "주정뱅이" })).toBeTruthy();
    expect(within(characterSelect).queryByRole("option", { name: "요리사" })).toBeNull();
  });

  test("allows Librarian zero Outsiders only when the Actual roster has none", async () => {
    const currentStep = step({
      id: "firstNight:librarian",
      character: "librarian",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
    });
    const nextStep = step({ id: "firstNight:investigator", character: "investigator" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(event("event-librarian-zero", "사서 외지인 0명 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    const zeroOutsiders = screen.getByRole("checkbox", { name: "외지인 0명" }) as HTMLInputElement;
    expect(zeroOutsiders.disabled).toBe(false);
    await user.click(zeroOutsiders);
    const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:librarian",
        input: { zeroOutsiders: true },
      },
    });
  });

  test("lets a poisoned Librarian choose any pair and any Outsider without Actual representation", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-3"
        ? { ...player, actualCharacter: "drunk", shownCharacter: "fortuneTeller" }
        : player,
    );
    const currentStep = step({
      id: "firstNight:librarian",
      character: "librarian",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      informationPrompt: {
        deliveryMode: "selectable",
        activeReasons: [
          { type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "event-poison" },
        ],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        setupInfoRegistrationOptions: [],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("event-librarian", "중독된 사서 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    expect((screen.getByRole("checkbox", { name: "외지인 0명" }) as HTMLInputElement).disabled).toBe(false);
    const candidates = screen.getByLabelText("단계 입력");
    expect(
      within(within(candidates).getByRole("button", { name: /Cy/ })).getByText(
        "본인 인식: 점쟁이",
      ),
    ).toBeTruthy();
    await user.click(within(candidates).getByRole("button", { name: /Bert/ }));
    await user.click(within(candidates).getByRole("button", { name: /Cy/ }));
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" });
    expect(within(characterSelect).getByRole("option", { name: "성자" })).toBeTruthy();
    expect(within(characterSelect).getByRole("option", { name: "주정뱅이" })).toBeTruthy();
    expect(within(characterSelect).queryByRole("option", { name: "요리사" })).toBeNull();
    await user.selectOptions(characterSelect, "saint");
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:librarian",
        input: { playerIds: ["player-2", "player-3"], characterId: "saint" },
      },
    });
  });

  test("allows poisoned Librarian zero even when an Actual Outsider exists", async () => {
    const currentStep = step({
      id: "firstNight:librarian",
      character: "librarian",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "librarian",
      characterKind: "Outsider",
      zeroAllowed: true,
      informationPrompt: {
        deliveryMode: "selectable",
        activeReasons: [{ type: "drunk" }],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        setupInfoRegistrationOptions: [],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("event-librarian-zero", "사서 외지인 0명 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    const zero = screen.getByRole("checkbox", { name: "외지인 0명" });
    await user.click(zero);
    const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
    expect(
      within(grimoire).getByRole("button", { name: /Bert/ }).getAttribute("aria-disabled"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: { stepId: "firstNight:librarian", input: { zeroOutsiders: true } },
    });
  });

  test("submits one input-only editor for a Drunk Investigator delivery", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-1"
        ? { ...player, actualCharacter: "drunk", shownCharacter: "investigator" }
        : player,
    );
    const currentStep = step({
      id: "firstNight:investigator",
      character: "investigator",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "investigator",
      characterKind: "Minion",
      informationPrompt: {
        deliveryMode: "selectable",
        activeReasons: [{ type: "drunk" }],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        setupInfoRegistrationOptions: [],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("event-drunk-investigator", "주정뱅이 수사관 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "수사관: 1번 Ada" });
    expect(screen.getAllByRole("combobox", { name: "보여줄 캐릭터" })).toHaveLength(1);
    const candidates = screen.getByLabelText("단계 입력");
    await user.click(within(candidates).getByRole("button", { name: /Bert/ }));
    await user.click(within(candidates).getByRole("button", { name: /Cy/ }));
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" });
    expect(within(characterSelect).getByRole("option", { name: "남작" })).toBeTruthy();
    await user.selectOptions(characterSelect, "baron");
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:investigator",
        input: { playerIds: ["player-2", "player-3"], characterId: "baron" },
      },
    });
  });

  test("expands one Investigator editor from a selected Recluse and submits its concrete witness", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-3"
        ? { ...player, actualCharacter: "recluse", shownCharacter: "recluse" }
        : player,
    );
    const currentStep = step({
      id: "firstNight:investigator",
      character: "investigator",
      playerId: "player-1",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "investigator",
      characterKind: "Minion",
      informationPrompt: {
        computedResult: {
          kind: "setupInfo",
          playerIds: ["player-2", "player-3"],
          characterId: "poisoner",
          zeroOutsiders: false,
        },
        deliveryMode: "selectable",
        activeReasons: [],
        registrationCandidatePlayerIds: ["player-3"],
        numberChoices: [],
        setupInfoRegistrationOptions: [
          {
            playerId: "player-3",
            registeredAs: "minion",
            characterIds: ["poisoner", "spy", "baron", "scarletWoman"],
          },
        ],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("event-investigator", "수사관 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "수사관: 1번 Ada" });
    const candidates = screen.getByLabelText("단계 입력");
    await user.click(within(candidates).getByRole("button", { name: /Bert/ }));
    await user.click(within(candidates).getByRole("button", { name: /Cy/ }));
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" });
    await user.selectOptions(characterSelect, "poisoner");
    expect(screen.getAllByRole("combobox", { name: "보여줄 캐릭터" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:investigator",
        input: { playerIds: ["player-2", "player-3"], characterId: "poisoner" },
        registrationJudgments: [
          { playerId: "player-3", registeredAs: "minion", characterId: "poisoner" },
        ],
      },
    });
  });

  test("renders a fixed computed number as a truth button and submits no redundant delivery", async () => {
    const currentStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
      kind: "number",
      informationPrompt: {
        computedResult: { kind: "number", value: 0 },
        deliveryMode: "fixed",
        activeReasons: [],
        registrationCandidatePlayerIds: [],
        numberChoices: [{ value: 0, isComputed: true, registrationJudgments: [] }],
        setupInfoRegistrationOptions: [],
      },
    });
    const nextStep = step({ id: "firstNight:empath", character: "empath", playerId: "player-3" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(event("event-chef", "요리사가 0쌍을 확인했습니다.")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    expect(screen.getByText("전달할 악한 팀 이웃 쌍의 수를 선택하세요.")).toBeTruthy();
    const delivery = screen.getByLabelText("전달 정보");
    const truth = within(delivery).getByRole("button", { name: /진실.*0/ });
    expect(within(delivery).queryByRole("spinbutton")).toBeNull();
    const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.click(truth);
    expect(confirm.disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: { stepId: "firstNight:chef", input: null },
    });
  });

  test("submits the exact hidden witness attached to a selected numeric choice", async () => {
    const currentStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
      kind: "number",
      informationPrompt: {
        computedResult: { kind: "number", value: 0 },
        deliveryMode: "selectable",
        activeReasons: [],
        registrationCandidatePlayerIds: ["player-4", "player-5"],
        numberChoices: [
          { value: 0, isComputed: true, registrationJudgments: [] },
          {
            value: 1,
            isComputed: false,
            registrationJudgments: [
              { playerId: "player-4", registeredAs: "good" },
              { playerId: "player-5", registeredAs: "evil" },
            ],
          },
        ],
        setupInfoRegistrationOptions: [],
      },
    });
    const nextStep = step({ id: "firstNight:toDay", stepType: "phaseTransition" });
    const canonicalEvent = event("event-empath", "초공감자가 1을 확인했습니다. (실제 0 · 등록 판정)");
    if (canonicalEvent.type !== "phaseStepConfirmed") throw new Error("unexpected event type");
    canonicalEvent.payload.information = {
      actor: { playerId: "player-3", characterId: "empath" },
      targetPlayerIds: [],
      computedResult: { kind: "number", value: 0 },
      deliveredResult: { kind: "number", value: 1 },
      deliveryContext: {
        type: "discretionary",
        reasons: [
          {
            type: "registrationJudgment",
            judgments: [
              { playerId: "player-4", registeredAs: "good" },
              { playerId: "player-5", registeredAs: "evil" },
            ],
          },
        ],
      },
    };
    const storage = new MemoryGameStorageDriver(gameFile());
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "초공감자: 3번 Cy" });
    const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const choices = screen.getByLabelText("전달할 숫자");
    expect(within(choices).getByRole("button", { name: /진실.*0/ })).toBeTruthy();
    await user.click(within(choices).getByRole("button", { name: /거짓.*1/ }));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:empath",
        input: null,
        deliveredResult: { kind: "number", value: 1 },
        registrationJudgments: [
          { playerId: "player-4", registeredAs: "good" },
          { playerId: "player-5", registeredAs: "evil" },
        ],
      },
    });
    await waitFor(() => {
      expect(latestSavedGame(storage.savedGames).game.events[1]).toEqual(canonicalEvent);
    });
  });

  test("shows a Recluse and adjacent Demon before dynamic Chef truth and alternate buttons", async () => {
    const playerRoster = players().map((player) =>
      player.id === "player-4"
        ? { ...player, actualCharacter: "recluse", shownCharacter: "recluse", alignment: "good" as const }
        : player,
    );
    const currentStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
      kind: "number",
      informationPrompt: {
        computedResult: { kind: "number", value: 0 },
        deliveryMode: "selectable",
        activeReasons: [],
        registrationCandidatePlayerIds: ["player-4"],
        numberChoices: [
          { value: 0, isComputed: true, registrationJudgments: [] },
          {
            value: 1,
            isComputed: false,
            registrationJudgments: [{ playerId: "player-4", registeredAs: "evil" }],
          },
          {
            value: 2,
            isComputed: false,
            registrationJudgments: [{ playerId: "player-4", registeredAs: "evil" }],
          },
        ],
        setupInfoRegistrationOptions: [],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep, playerRoster, eventCount: 2 }),
      proposal: proposal(event("event-chef-recluse", "요리사 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    const neighbors = screen.getByLabelText("이웃 관계");
    expect(within(neighbors).getByText("은둔자")).toBeTruthy();
    expect(within(neighbors).getByText("임프")).toBeTruthy();
    const choices = screen.getByLabelText("전달할 숫자");
    expect(within(choices).getByRole("button", { name: /진실.*0/ })).toBeTruthy();
    expect(within(choices).getByRole("button", { name: /거짓.*1/ })).toBeTruthy();
    expect(within(choices).getByRole("button", { name: /거짓.*2/ })).toBeTruthy();
    await user.click(within(choices).getByRole("button", { name: /거짓.*1/ }));
    await user.click(screen.getByRole("button", { name: "확정" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:chef",
        input: null,
        deliveredResult: { kind: "number", value: 1 },
        registrationJudgments: [{ playerId: "player-4", registeredAs: "evil" }],
      },
    });
  });

  test("keeps a confirmed Reveal repeatable until explicit continue to the replayed current step", async () => {
    const revealStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
    });
    const followUpStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
    });
    const canonicalEvent = event("event-chef", "요리사 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep }),
      replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, {
        previewMessageKo: "악한 팀 이웃 수를 공개합니다.",
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      }),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await user.click(screen.getByRole("button", { name: "확정" }));
    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(screen.getByRole("heading", { name: "요리사: 2번 Bert" })).toBeTruthy();
    expect(within(followup).queryByText(/확정됨|리플레이|다시 열|숨김/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "초공감자: 3번 Cy" })).toBeNull();
    const preview = within(followup).getByLabelText("Reveal 미리보기");
    expect(within(preview).getByText("악한 팀 이웃 수를 공개합니다.")).toBeTruthy();

    await waitFor(() => {
      const continueButton = within(followup).getByRole("button", { name: "다음 단계로 계속" }) as HTMLButtonElement;
      expect(continueButton.disabled).toBe(false);
      const savedGame = latestSavedGame(storage.savedGames);
      expect(savedGame.game.events.filter((savedEvent) => savedEvent.id === canonicalEvent.id)).toHaveLength(1);
    });
    const replayCallsAfterConfirm = vi.mocked(core.replay).mock.calls.length;

    await user.click(within(preview).getByRole("button", { name: "플레이어에게 공개" }));
    const revealScreen = screen.getByLabelText("플레이어 공개 화면");
    expect(within(revealScreen).getByRole("heading", { name: "서로 이웃한 악한 팀 쌍" })).toBeTruthy();
    expect(within(revealScreen).getByText("1쌍")).toBeTruthy();
    expect(screen.queryByText("마도서")).toBeNull();
    expect(screen.queryByText("이벤트 로그")).toBeNull();

    await user.click(within(revealScreen).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
    expect(screen.queryByLabelText("플레이어 공개 화면")).toBeNull();
    expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "초공감자: 3번 Cy" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
    const reopenedReveal = screen.getByLabelText("플레이어 공개 화면");
    await user.click(within(reopenedReveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));

    expect(core.propose).toHaveBeenCalledTimes(1);
    expect(vi.mocked(core.replay).mock.calls).toHaveLength(replayCallsAfterConfirm);
    await user.click(screen.getByRole("button", { name: "다음 단계로 계속" }));
    expect(await screen.findByRole("heading", { name: "초공감자: 3번 Cy" })).toBeTruthy();
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
  });

  test("keeps continue disabled with one concise waiting state until replay catches up", async () => {
    const revealStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
    });
    const followUpStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
    });
    const replayAfterProposal = replayState({ currentStep: followUpStep, eventCount: 2 });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep }),
      replayAfterProposal,
      proposal: proposal(event("event-chef-pending-replay", "요리사 정보 확정"), {
        previewMessageKo: "악한 팀 이웃 수를 공개합니다.",
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      }),
    });
    const initialReplay = replayState({ currentStep: revealStep });
    let resolveReplayAfterProposal!: (result: { ok: true; value: ReplayState }) => void;
    const pendingReplay = new Promise<{ ok: true; value: ReplayState }>((resolve) => {
      resolveReplayAfterProposal = resolve;
    });
    vi.mocked(core.replay).mockImplementation(async (candidate) => {
      if (candidate.game.events.length < 2) return { ok: true, value: initialReplay };
      return pendingReplay;
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await user.click(screen.getByRole("button", { name: "확정" }));

    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    const continueButton = within(followup).getByRole("button", { name: "다음 단계로 계속" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    expect(within(followup).getAllByText("다음 단계 준비 중")).toHaveLength(1);
    expect(within(followup).queryByText(/리플레이|동기화|기다려/)).toBeNull();

    await act(async () => {
      resolveReplayAfterProposal({ ok: true, value: replayAfterProposal });
      await pendingReplay;
    });

    await waitFor(() => expect(continueButton.disabled).toBe(false));
    expect(within(followup).queryByText("다음 단계 준비 중")).toBeNull();
  });

  test("keeps the production Grimoire layout during a safe read-only Spy Reveal", async () => {
    const revealStep = step({
      id: "firstNight:spy",
      character: "spy",
      playerId: "player-4",
    });
    const followUpStep = step({
      id: "firstNight:toDay",
      kind: "day",
      stepType: "phaseTransition",
    });
    const playerRoster = players().map((player, index) => ({
      ...player,
      actualCharacter: index === 3 ? "spy" : player.actualCharacter,
      shownCharacter: index === 0 ? "slayer" : index === 3 ? "spy" : player.shownCharacter,
      systemTokenIds: index === 0 ? ["abilitySpent" as const] : [],
      scriptTokens: index === 0 ? [{ characterId: "scarletWoman", tokenId: "isTheDemon" }] : [],
      notes: index === 0 ? "비공개 메모" : "",
    }));
    const spyPayload = {
      kind: "spyGrimoire",
      players: playerRoster.map((player) => ({
        playerId: player.id,
        seat: player.seat,
        name: player.name,
        characterId: player.actualCharacter,
        alive: player.alive,
        ghostVoteUsed: player.ghostVoteUsed,
        reminderTokens: player.seat === 2 ? ["poisoned", "protected"] : [],
      })),
    } as unknown as RevealPayload;
    const canonicalEvent = event("event-spy", "첩자 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep, playerRoster }),
      replayAfterProposal: replayState({ currentStep: followUpStep, playerRoster, eventCount: 2 }),
      proposal: proposal(canonicalEvent, spyPayload),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "첩자: 4번 Dae" });
    const storytellerSeatStyle = screen
      .getByRole("button", { name: /4번 Dae 좌석 선택/ })
      .getAttribute("style");
    await user.click(screen.getByRole("button", { name: "확정" }));
    const followup = await screen.findByLabelText("확정된 Reveal 후속 조치");
    expect(within(followup).queryByLabelText("Reveal 미리보기")).toBeNull();
    expect(within(followup).queryByText(`${playerRoster.length}명`)).toBeNull();
    expect(within(followup).queryByText(/실제 캐릭터와 현재 상태|읽기 전용 공개/)).toBeNull();
    const showButton = within(followup).getByRole("button", { name: "플레이어에게 공개" });

    await user.click(showButton);
    const revealScreen = screen.getByLabelText("플레이어 공개 화면");
    const revealSeat = within(revealScreen).getByText("Dae").closest("article");
    expect(revealSeat?.getAttribute("style")).toBe(storytellerSeatStyle);
    expect(within(revealScreen).getByRole("heading", { name: "Trouble Brewing" })).toBeTruthy();
    expect(within(revealScreen).getByLabelText("첩자 공개 마도서 좌석 맵")).toBeTruthy();
    expect(within(revealScreen).getAllByRole("article")).toHaveLength(playerRoster.length);
    expect(within(revealScreen).getAllByRole("button")).toHaveLength(1);
    expect(within(revealScreen).getByText("중독")).toBeTruthy();
    expect(within(revealScreen).getByText("보호")).toBeTruthy();
    expect(within(revealScreen).queryByText(/보여준 캐릭터/)).toBeNull();
    expect(within(revealScreen).queryByText("비공개 메모")).toBeNull();
    expect(within(revealScreen).queryByText(/악마임|능력 소모/)).toBeNull();
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(screen.queryByText("이벤트 로그")).toBeNull();
    expect(screen.queryByText("설정 및 불러오기")).toBeNull();

    await user.click(within(revealScreen).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
    expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "낮 시작" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
    await user.click(
      within(screen.getByLabelText("플레이어 공개 화면")).getByRole("button", {
        name: "확인했다면 눈을 감으세요.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "다음 단계로 계속" }));

    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(await screen.findByRole("heading", { name: "낮 시작" })).toBeTruthy();
    expect(core.propose).toHaveBeenCalledTimes(1);
  });

  test("Undo remains discoverable beside a pending Reveal and clears it after confirmation", async () => {
    const revealStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
    });
    const followUpStep = step({
      id: "firstNight:empath",
      character: "empath",
      playerId: "player-3",
    });
    const canonicalEvent = event("event-chef", "요리사 정보 확정");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: revealStep }),
      replayAfterProposal: replayState({ currentStep: followUpStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent, {
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      }),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    await user.click(screen.getByRole("button", { name: "확정" }));
    await screen.findByLabelText("확정된 Reveal 후속 조치");
    const undo = screen.getByRole("button", { name: "Undo" });
    await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
    await user.click(undo);
    expect(screen.getByText(`되돌릴 항목: ${canonicalEvent.summary}`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "되돌리기" }));

    expect(await screen.findByRole("heading", { name: "요리사: 2번 Bert" })).toBeTruthy();
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    await waitFor(() => {
      expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(1);
    });
  });

  test("selects nominator, nominee, and seat-map voters through the visible vote preview and confirm path", async () => {
    const votingStep = step({
      id: "day:nomination:1",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const nextVotingStep = step({
      id: "day:nomination:2",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const canonicalEvent = event("event-vote", "1번 Ada가 4번 Dae를 지목 · 2표", "day");
    const confirmedStanding = {
      nominations: [
        {
          stepId: "day:nomination:0",
          nominatorId: "player-4",
          nomineeId: "player-5",
          voterIds: ["player-1", "player-2", "player-4", "player-5"],
          voteCount: 4,
          ghostVoteSpentPlayerIds: ["player-2"],
        },
      ],
      executionVoteThreshold: 2,
      highestVoteCount: 4,
      executionCandidate: { nomineeId: "player-5", voteCount: 4 },
      eligibleNominatorIds: ["player-1", "player-5"],
      eligibleNomineeIds: ["player-1", "player-4"],
    } as unknown as ReplayState["dayState"];
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: votingStep, dayState: confirmedStanding }),
      replayAfterProposal: replayState({
        currentStep: nextVotingStep,
        eventCount: 2,
        dayState: {
          nominations: [
            {
              stepId: "day:nomination:0",
              nominatorId: "player-4",
              nomineeId: "player-5",
              voterIds: ["player-1", "player-2", "player-4", "player-5"],
              voteCount: 4,
              ghostVoteSpentPlayerIds: ["player-2"],
            },
            {
              stepId: votingStep.id,
              nominatorId: "player-1",
              nomineeId: "player-4",
              voterIds: ["player-1", "player-2"],
              voteCount: 2,
              ghostVoteSpentPlayerIds: ["player-2"],
            },
          ],
          executionVoteThreshold: 2,
          highestVoteCount: 4,
          executionCandidate: { nomineeId: "player-5", voteCount: 4 },
          eligibleNominatorIds: ["player-5"],
          eligibleNomineeIds: ["player-1"],
        } as unknown as ReplayState["dayState"],
      }),
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "지목 및 투표 1" });
    expect(screen.getByText("5번 Eun — 4표")).toBeTruthy();
    expect(screen.getByText("기준 2표 · 생존자 3명")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "지목자" }), "player-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "피지목자" }), "player-4");
    const seatMap = screen.getByLabelText("라이브 마도서 좌석 맵");
    await user.click(within(seatMap).getByRole("button", { name: /Ada/ }));
    await user.click(within(seatMap).getByRole("button", { name: /Bert/ }));

    const votePreview = screen.getByText("현재 표").closest("dl");
    if (!votePreview) throw new Error("vote preview was not rendered");
    expect(within(votePreview).getByText("2표")).toBeTruthy();
    expect(within(votePreview).getByText(/2번 Bert/)).toBeTruthy();
    expect(screen.getByText("5번 Eun — 4표")).toBeTruthy();
    expect(screen.queryByText("확정된 투표만 반영")).toBeNull();

    const confirmButton = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    await user.click(confirmButton);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "day:nomination:1",
        input: {
          nominatorId: "player-1",
          nomineeId: "player-4",
          voterIds: ["player-1", "player-2"],
        },
      },
    });
    expect(await screen.findByRole("heading", { name: "지목 및 투표 2" })).toBeTruthy();
  });

  test("blocks the Butler until the master votes and removes both when the master is cleared", async () => {
    const votingStep = step({
      id: "day:nomination:1:vote",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const playerRoster = players().map((player) =>
      player.id === "player-2"
        ? {
            ...player,
            actualCharacter: "butler",
            shownCharacter: "butler",
            alive: true,
            ghostVoteUsed: false,
          }
        : player,
    );
    const initialReplay = {
      ...replayState({
        currentStep: votingStep,
        playerRoster,
        dayState: {
          nominations: [],
          eligibleNominatorIds: playerRoster.map(({ id }) => id),
          eligibleNomineeIds: playerRoster.map(({ id }) => id),
          executionVoteThreshold: 3,
          highestVoteCount: 0,
          activeNomination: {
            eventId: "nomination-started-1",
            stepId: "day:nomination:1",
            nominatorId: "player-4",
            nomineeId: "player-5",
          },
        },
      }),
      ruleState: {
        unannouncedNightDeathPlayerIds: [],
        butlerVote: {
          butlerPlayerId: "player-2",
          masterPlayerId: "player-1",
          restrictionApplies: true,
        },
      },
    } as unknown as ReplayState;
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal: initialReplay,
      proposal: proposal(event("unused", "unused", "day")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByText("찬성한 플레이어를 선택하세요.");
    const seatMap = screen.getByLabelText("라이브 마도서 좌석 맵");
    const blockedButler = within(seatMap).getByRole("button", { name: /Bert.*주인 미투표/ });
    expect(blockedButler.getAttribute("aria-disabled")).toBe("true");
    await user.click(blockedButler);
    expect(screen.getByText("0표")).toBeTruthy();

    await user.click(within(seatMap).getByRole("button", { name: /Ada.*생존/ }));
    const enabledButler = within(seatMap).getByRole("button", { name: /Bert.*생존/ });
    expect(enabledButler.getAttribute("aria-disabled")).toBe("false");
    await user.click(enabledButler);
    expect(screen.getByText("2표")).toBeTruthy();

    await user.click(within(seatMap).getByRole("button", { name: /Ada.*생존/ }));
    expect(screen.getByText("0표")).toBeTruthy();
    expect(within(seatMap).getByRole("button", { name: /Bert.*주인 미투표/ }).getAttribute("aria-disabled"))
      .toBe("true");
  });

  test("always exposes concise life and ghost-vote state on confirmed Grimoire seats", async () => {
    const currentStep = step({ id: "day:whisper", stepType: "whisper" as never, phase: "day" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused", "day")),
    });

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "밀담" });
    const seatMap = screen.getByLabelText("라이브 마도서 좌석 맵");
    expect(within(seatMap).getByRole("button", { name: /Ada.*생존/ })).toBeTruthy();
    expect(within(seatMap).getByRole("button", { name: /Bert.*사망 · 유령표 남음/ })).toBeTruthy();
    expect(within(seatMap).getByRole("button", { name: /Cy.*사망 · 유령표 사용됨/ })).toBeTruthy();
  });

  test("confirms a rule-derived Trouble Brewing execution death without offering a survival choice", async () => {
    const executionDeathStep = {
      ...step({ id: "day:executionDeath", phase: "day" }),
      stepType: "executionDeath",
      playerId: "player-5",
      requiredInput: {
        kind: "executionDeathDecision",
        target: "execution",
        executionSurvivalAllowed: false,
        optional: false,
      },
    } as unknown as NonNullable<ReplayState["currentStep"]>;
    const nextStep = step({ id: "day:toNight", kind: "night", stepType: "phaseTransition", phase: "day" });
    const canonicalEvent = event("event-execution-death", "5번 Eun 사망 확정", "day");
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: executionDeathStep }),
      replayAfterProposal: replayState({ currentStep: nextStep, eventCount: 2 }),
      proposal: proposal(canonicalEvent),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "처형 결과: 5번 Eun" });
    const currentAction = screen.getByLabelText("현재 단계");
    const subject = within(currentAction).getByLabelText("처형 대상");
    expect(within(subject).getByText("5번 Eun")).toBeTruthy();
    expect(within(subject).getByText("임프")).toBeTruthy();
    expect(within(currentAction).queryByText("해당 플레이어가 사망했는지 확인하세요.")).toBeNull();
    expect(within(currentAction).queryByRole("button", { name: "사망 확정" })).toBeNull();
    expect(within(currentAction).queryByRole("button", { name: "사망하지 않음" })).toBeNull();
    const confirm = within(currentAction).getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "day:executionDeath",
        input: { died: true },
      },
    });
  });

  test("offers only each core-derived nomination role list while preserving self-selection", async () => {
    const votingStep = step({
      id: "day:nomination:2",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
    });
    const dayState = {
      nominations: [
        {
          stepId: "day:nomination:1",
          nominatorId: "player-4",
          nomineeId: "player-1",
          voterIds: [],
          voteCount: 0,
          ghostVoteSpentPlayerIds: [],
        },
      ],
      executionVoteThreshold: 2,
      highestVoteCount: 0,
      eligibleNominatorIds: ["player-1", "player-5"],
      eligibleNomineeIds: ["player-4", "player-5"],
    } as unknown as ReplayState["dayState"];
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: votingStep, dayState }),
      replayAfterProposal: replayState({ currentStep: votingStep, dayState, eventCount: 2 }),
      proposal: proposal(event("unused", "unused", "day")),
    });

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "지목 및 투표 2" });
    const nominators = screen.getByRole("combobox", { name: "지목자" });
    const nominees = screen.getByRole("combobox", { name: "피지목자" });
    expect(within(nominators).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "선택",
      "1번 Ada",
      "5번 Eun",
    ]);
    expect(within(nominees).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "선택",
      "4번 Dae",
      "5번 Eun",
    ]);
    expect(within(nominators).getByRole("option", { name: "5번 Eun" })).toBeTruthy();
    expect(within(nominees).getByRole("option", { name: "5번 Eun" })).toBeTruthy();
  });

  test("renders concise typed Day workflow actions for Whisper and Discussion", async () => {
    const whisperStep = step({
      id: "day:whisper",
      stepType: "whisper" as never,
      phase: "day",
    });
    const discussionStep = step({
      id: "day:discussion",
      stepType: "discussion" as never,
      phase: "day",
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep: whisperStep }),
      replayAfterProposal: replayState({ currentStep: discussionStep, eventCount: 2 }),
      proposal: proposal(event("event-whisper", "밀담 종료", "day")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await user.click(await screen.findByRole("button", { name: "토론 시작" }));
    expect(await screen.findByRole("button", { name: "지목 및 투표 시작" })).toBeTruthy();
  });

  test("skips a skippable phase step through its canonical event and replay path", async () => {
    const currentStep = step({
      id: "day:nomination:1",
      kind: "nominationVote",
      stepType: "nomination",
      phase: "day",
      canSkip: true,
    });
    const nextStep = step({ id: "day:execution", kind: "executionDecision", stepType: "execution", phase: "day" });
    const canonicalEvent = event("event-skip", "지목 종료", "day");
    const core = createCoreHarness({
      initialReplay: replayState({
        currentStep,
        dayState: {
          nominations: [],
          executionVoteThreshold: 2,
          highestVoteCount: 0,
          eligibleNominatorIds: ["player-1", "player-4", "player-5"],
          eligibleNomineeIds: ["player-1", "player-4", "player-5"],
        } as unknown as ReplayState["dayState"],
      }),
      replayAfterProposal: replayState({
        currentStep: nextStep,
        eventCount: 2,
        dayState: {
          nominations: [],
          executionVoteThreshold: 2,
          highestVoteCount: 0,
          eligibleNominatorIds: ["player-1", "player-4", "player-5"],
          eligibleNomineeIds: ["player-1", "player-4", "player-5"],
        } as unknown as ReplayState["dayState"],
      }),
      proposal: proposal(canonicalEvent),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "지목 및 투표 1" });
    await user.click(screen.getByRole("button", { name: "지목 종료" }));

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "skipStep",
      payload: { stepId: "day:nomination:1", input: null },
    });
    expect(await screen.findByRole("heading", { name: "처형 확정" })).toBeTruthy();
    expect(screen.getAllByText("지목 종료").length).toBeGreaterThan(0);
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(2));
  });

  test("keeps the visible JSON export and import controls connected to game-file boundaries", async () => {
    const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const storage = new MemoryGameStorageDriver(gameFile());
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:clocktower-export");
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const setupSummary = screen.getByText("설정 및 불러오기").closest("summary");
    if (!setupSummary) throw new Error("setup summary was not rendered");
    await user.click(setupSummary);
    await user.click(screen.getByRole("button", { name: "JSON 내보내기" }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:clocktower-export");

    const imported = gameFile();
    imported.game.id = "imported-game";
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.upload(fileInput, new File([JSON.stringify(imported)], "clocktower.json", { type: "application/json" }));

    await waitFor(() => expect(core.replay).toHaveBeenCalledWith(imported));
    expect(await screen.findByRole("heading", { name: "세탁부: 1번 Ada" })).toBeTruthy();
  });

  test("reports an incompatible import without confirming or replacing the current game", async () => {
    const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const storedGame = gameFile();
    const storage = new MemoryGameStorageDriver(storedGame);
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    await waitFor(() => expect(storage.savedGames.length).toBeGreaterThan(0));
    const savesBeforeImport = storage.savedGames.length;
    const incompatibleGame = { ...gameFile(), schemaVersion: 1 };
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");

    await user.upload(
      fileInput,
      new File([JSON.stringify(incompatibleGame)], "old-clocktower.json", { type: "application/json" }),
    );

    expect((await screen.findAllByText("지원하지 않는 게임 파일 버전입니다.")).length).toBeGreaterThan(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getAllByText("초기 설정 확정").length).toBeGreaterThan(0);
    expect(core.replay).not.toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1 }));
    expect(storage.savedGames).toHaveLength(savesBeforeImport);
    expect(latestSavedGame(storage.savedGames)).toEqual(storedGame);
  });

  test("uses the living Slayer icon to resolve an explicit Recluse shot into a death confirmation", async () => {
    const discussionStep = step({ id: "day:discussion", stepType: "discussion", phase: "day" });
    const slayerDeathStep = {
      ...step({
        id: "day:discussion:slayerDeath",
        stepType: "slayerDeath" as never,
        phase: "day",
        playerId: "player-3",
        kind: "slayerDeathDecision" as never,
      }),
      requiredInput: {
        kind: "slayerDeathDecision",
        playerId: "player-3",
        survivalAllowed: false,
        optional: false,
      },
    } as unknown as NonNullable<ReplayState["currentStep"]>;
    const playerRoster = players().map((player) => {
      if (player.id === "player-1") {
        return { ...player, actualCharacter: "slayer", shownCharacter: "slayer", alive: true };
      }
      if (player.id === "player-3") {
        return { ...player, actualCharacter: "recluse", shownCharacter: "recluse", alive: true };
      }
      if (player.id === "player-4") {
        return { ...player, actualCharacter: "spy", shownCharacter: "spy", alive: true };
      }
      return player;
    });
    const initialReplay = {
      ...replayState({ currentStep: discussionStep, playerRoster }),
      ruleState: {
        unannouncedNightDeathPlayerIds: [],
        slayerAbility: { actorPlayerId: "player-1", spent: false, canUseNow: true },
      },
    } as unknown as ReplayState;
    const replayAfterProposal = {
      ...replayState({ currentStep: slayerDeathStep, playerRoster, eventCount: 2 }),
      ruleState: {
        unannouncedNightDeathPlayerIds: [],
        slayerAbility: { actorPlayerId: "player-1", spent: true, canUseNow: false },
      },
    } as unknown as ReplayState;
    const slayerEvent = {
      id: "event-slayer-shot",
      type: "slayerAbilityUsed",
      phase: "day",
      payload: {
        discussionStepId: "day:discussion",
        actorPlayerId: "player-1",
        targetPlayerId: "player-3",
        impairmentContext: { kind: "healthy" },
        registrationContext: {
          kind: "recluseDecision",
          registeredAsDemon: true,
          registeredCharacterId: "imp",
        },
        outcome: { kind: "deathPending", playerId: "player-3" },
      },
      summary: "처단자가 3번 Cy를 선택함",
      createdAt: "2026-07-14T00:01:00.000Z",
    } as unknown as GameFile["game"]["events"][number];
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal,
      proposal: proposal(slayerEvent),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await user.click(await screen.findByRole("button", { name: "1번 Ada 처단자 능력 사용" }));
    const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
    expect(within(dialog).getByText("확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /2번 Bert/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /4번 Dae/ })).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: /3번 Cy/ }));
    const confirm = within(dialog).getByRole("button", { name: "처단자 사용 확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "악마로 등록" }));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "useSlayerAbility",
      payload: {
        discussionStepId: "day:discussion",
        expectedEventCount: 1,
        actorPlayerId: "player-1",
        targetPlayerId: "player-3",
        targetRegistration: { kind: "recluseAsDemon", registeredCharacterId: "imp" },
      },
    });
    expect(await screen.findByText("사망 확인")).toBeTruthy();
    const currentStep = screen.getByRole("region", { name: "현재 단계" });
    expect(within(currentStep).getByLabelText("처단자 결과 대상")).toBeTruthy();
    expect(within(currentStep).getByText("3번 Cy")).toBeTruthy();
    expect(within(currentStep).getByText("은둔자")).toBeTruthy();
    expect(within(currentStep).getByText("처단자 능력으로 사망합니다.")).toBeTruthy();
    expect(within(currentStep).getByRole("button", { name: "확정" })).toBeTruthy();
    expect(within(currentStep).queryByRole("button", { name: "사망 확정" })).toBeNull();
    expect(within(currentStep).queryByRole("button", { name: "사망하지 않음" })).toBeNull();
  });

  test("keeps the actual Slayer icon disabled when Rust marks the action unavailable", async () => {
    const whisperStep = step({ id: "day:whisper", stepType: "whisper" as never, phase: "day" });
    const playerRoster = players().map((player) =>
      player.id === "player-1"
        ? { ...player, actualCharacter: "slayer", shownCharacter: "slayer", alive: true }
        : player,
    );
    const initialReplay = {
      ...replayState({ currentStep: whisperStep, playerRoster }),
      ruleState: {
        unannouncedNightDeathPlayerIds: [],
        slayerAbility: { actorPlayerId: "player-1", spent: false, canUseNow: false },
      },
    } as unknown as ReplayState;
    const core = createCoreHarness({
      initialReplay,
      replayAfterProposal: initialReplay,
      proposal: proposal(event("unused", "unused", "day")),
    });

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const icon = await screen.findByRole("button", { name: "1번 Ada 처단자 능력 사용" });
    expect((icon as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("dialog", { name: "처단자 능력 사용" })).toBeNull();
  });
});

function latestSavedGame(savedGames: GameFile[]): GameFile {
  const savedGame = savedGames.at(-1);
  if (!savedGame) throw new Error("game was not autosaved");
  return savedGame;
}

function seatLayoutOf(game: GameFile) {
  return game.ui?.seatLayout;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function putRawLatestGame(idb: IDBFactory, value: unknown): Promise<void> {
  const database = await openGameDatabase(idb);
  try {
    const transaction = database.transaction("game", "readwrite");
    transaction.objectStore("game").put(value, "latest");
    await transactionCompletion(transaction);
  } finally {
    database.close();
  }
}

async function getRawLatestGame(idb: IDBFactory): Promise<unknown> {
  const database = await openGameDatabase(idb);
  try {
    const transaction = database.transaction("game", "readonly");
    return await requestResult(transaction.objectStore("game").get("latest"));
  } finally {
    database.close();
  }
}

function openGameDatabase(idb: IDBFactory): Promise<IDBDatabase> {
  const request = idb.open("clocktower", 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("game")) {
      request.result.createObjectStore("game");
    }
  };
  return requestResult(request);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
