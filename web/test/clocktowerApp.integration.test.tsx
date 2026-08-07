import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GameFile, ReplayState, RevealPayload } from "../src/core/types";
import { IndexedDbGameStorageDriver } from "../src/gameStorage";
import type { TbSessionPresentation } from "../src/gameStore";
import { ClocktowerApp } from "../src/main";
import { seatLayoutPositions, type SetupDraft } from "../src/setupDraft";
import {
  MemoryGameStorageDriver,
  MemoryWebSessionStorageDriver,
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
  test("starts a new Trouble Brewing game in the approved shared role-selection shell", async () => {
    const currentStep = step({ id: "unused" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

    const stages = await screen.findByRole("navigation", { name: "작업 단계" });
    expect(within(stages).getByRole("button", { name: "직업" }).getAttribute("aria-current")).toBe("page");
    expect((within(stages).getByRole("button", { name: "마도서" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(stages).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "임프 직업 요약 보기" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("restores an unfinished shared-shell role roster from the script-keyed draft session", async () => {
    const currentStep = step({ id: "unused" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const storage = new MemoryWebSessionStorageDriver<SetupDraft, TbSessionPresentation>();
    const user = userEvent.setup();
    const firstRender = render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await user.click(await screen.findByRole("button", { name: "세탁부" }));
    await waitFor(() => expect(storage.savedSessions.at(-1)?.setupDraft).toMatchObject({
      selectedCharacterIds: ["imp", "washerwoman"],
      rosterConfirmed: false,
      setupStage: "roles",
    }));

    firstRender.unmount();
    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    expect((await screen.findByRole("button", { name: "세탁부" })).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "임프 직업 요약 보기" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("requires the Drunk shown Townsfolk token before seating confirmation", async () => {
    const currentStep = step({ id: "unused" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const sixPlayerDistribution = { Townsfolk: 3, Outsider: 1, Minion: 1, Demon: 1 } as const;
    vi.mocked(core.setupDistributionSync).mockReturnValue({ ok: true, value: sixPlayerDistribution });
    vi.mocked(core.setupDistribution).mockResolvedValue({ ok: true, value: sixPlayerDistribution });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

    await user.click(await screen.findByRole("button", { name: "6명" }));
    for (const characterName of ["세탁부", "사서", "요리사", "주정뱅이", "독살범"]) {
      await user.click(screen.getByRole("button", { name: characterName }));
    }
    await user.click(screen.getByRole("button", { name: "직업 선택 확정" }));

    const seatMap = await screen.findByLabelText("6자리 Trouble Brewing 마도서");
    for (const [seat, characterName] of ["세탁부", "사서", "요리사", "주정뱅이", "독살범", "임프"].entries()) {
      await user.click(screen.getByRole("button", { name: `${characterName} 배치` }));
      await user.click(within(seatMap).getByRole("button", { name: new RegExp(`${seat + 1}번 좌석`) }));
    }

    const confirmButton = screen.getByRole("button", { name: "배치 확정" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    await user.click(within(seatMap).getByRole("button", { name: /4번 좌석.*실제 주정뱅이/ }));
    await user.selectOptions(screen.getByLabelText("보여준 직업"), "fortuneTeller");
    expect(screen.getByRole("img", { name: "보여준 직업 점쟁이 토큰" })).toBeTruthy();
    expect(confirmButton.disabled).toBe(false);
  });

  test("random seating leaves the seat inspector closed", async () => {
    const currentStep = step({ id: "unused" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

    for (const characterName of ["세탁부", "사서", "요리사", "독살범"]) {
      await user.click(await screen.findByRole("button", { name: characterName }));
    }
    await user.click(screen.getByRole("button", { name: "직업 선택 확정" }));
    await user.click(await screen.findByRole("button", { name: "무작위 배치" }));

    expect(screen.queryByRole("button", { name: "좌석 편집 패널 닫기 배경" })).toBeNull();
    expect(screen.getByText("5/5")).toBeTruthy();
  });

  test("opens a confirmed Trouble Brewing game in the approved shared Play stage", async () => {
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

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await waitFor(() => {
      const stages = screen.getByRole("navigation", { name: "작업 단계" });
      expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
    });
    expect(screen.getByRole("main", { name: "Trouble Brewing 진행" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "세탁부: 1번 Ada" })).toBeTruthy();
  });

  test("uses the supported player range and the approved SnV-style progress structure", async () => {
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

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    const main = await screen.findByRole("main", { name: "Trouble Brewing 진행" });
    const progress = within(main).getByRole("region", { name: "Trouble Brewing 진행" });
    const applicationHeader = main.querySelector(".productionApplicationHeader");
    if (!applicationHeader) throw new Error("application header was not rendered");
    expect(within(applicationHeader as HTMLElement).getByText("5–15명")).toBeTruthy();
    expect(progress.querySelector(".snvCurrentStep.tbCurrentTask")).toBeTruthy();
    expect(within(progress).getByRole("list", { name: "첫날 밤 순서" })).toBeTruthy();
    expect(progress.querySelector(".phasePanelContent")).toBeNull();
    expect(progress.querySelector(".currentStepCard")).toBeNull();
    expect(progress.querySelector(".playerStepInput")).toBeNull();
    expect(progress.querySelector(".tbLiveAuxiliary")).toBeNull();
  });

  test("uses the approved prototype Grimoire for confirmed Trouble Brewing play", async () => {
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

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    const stages = screen.getByRole("navigation", { name: "작업 단계" });
    fireEvent.click(within(stages).getByRole("button", { name: "마도서" }));

    const grimoire = await screen.findByRole("region", { name: "Trouble Brewing 마도서 검토" });
    expect(grimoire.querySelector(".snvGrimoireDraft.rectangular")).toBeTruthy();
    expect(grimoire.querySelector(".seatMap, .confirmedSeatMap")).toBeNull();
    expect(within(grimoire).queryByLabelText("현재 행동자 안내")).toBeNull();
    expect(within(grimoire).getByRole("button", { name: /1번 좌석.*현재 행동자/ })).toBeTruthy();
    expect(within(grimoire).getByRole("group", { name: "현재 단계" })).toBeTruthy();

    fireEvent.click(within(grimoire).getByRole("button", { name: /2번 좌석/ }));
    const details = screen.getByRole("dialog", { name: "2번 Bert 플레이어 상세" });
    expect(within(details).getByText("캐릭터 능력")).toBeTruthy();
  });

  test("shows the supported player range before a Trouble Brewing game starts", async () => {
    const currentStep = step({ id: "unused" });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

    const main = await screen.findByRole("main", { name: "Trouble Brewing 게임 설정" });
    const applicationHeader = main.querySelector(".productionApplicationHeader");
    if (!applicationHeader) throw new Error("application header was not rendered");
    expect(within(applicationHeader as HTMLElement).getByText("5–15명")).toBeTruthy();
  });

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

    render(<ClocktowerApp coreAdapter={core} storageDriver={new IndexedDbGameStorageDriver("troubleBrewing", idb)} />);

    expect((await screen.findAllByText("지원하지 않는 게임 파일 버전입니다.")).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "6명" }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "6명" }));
    expect(screen.getByText("5–15명", { selector: ".productionApplicationHeader p" })).toBeTruthy();
    expect(await getRawLatestGame(idb)).toEqual(unsupportedGame);

    await user.click(screen.getByRole("button", { name: "새 게임" }));

    await waitFor(() => {
      expect(screen.queryAllByText("지원하지 않는 게임 파일 버전입니다.")).toHaveLength(0);
    });
    await waitFor(async () => {
      expect(await getRawLatestGame(idb, "latest:troubleBrewing")).toMatchObject({
        schemaVersion: 3,
        game: { scriptId: "troubleBrewing", events: [] },
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
              schemaVersion: 3,
              scriptId: "troubleBrewing",
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
    expect(storage.savedGames[0]?.schemaVersion).toBe(3);
    expect(storage.savedGames[0]?.game.scriptId).toBe("troubleBrewing");
    expect(storage.savedGames[0]?.game.events).toEqual([]);
  });

  test("keeps storage and the event log off the approved progress surface", async () => {
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
    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    expect(screen.queryByRole("region", { name: "저장 및 불러오기" })).toBeNull();
    fireEvent.click(liveStageButton("저장 / 불러오기"));
    const storage = await screen.findByRole("region", { name: "저장 및 불러오기" });
    expect(within(storage).getByRole("region", { name: "이벤트 로그" })).toBeTruthy();
    expect(within(storage).getByText("1건")).toBeTruthy();
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
    expect(screen.queryByRole("button", { name: "설정 다시 수정" })).toBeNull();
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
    await user.click(liveStageButton("저장 / 불러오기"));
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
    await user.click(liveStageButton("마도서"));
    expect(await screen.findByRole("button", { name: "배치로 돌아가기" })).toBeTruthy();
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
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "세탁부: 1번 Ada" });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await user.click(liveStageButton("마도서"));
    await user.click(await screen.findByRole("button", { name: "배치로 돌아가기" }));
    const recoveryDialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
    await user.click(within(recoveryDialog).getByRole("button", { name: "초기화하고 돌아가기" }));

    expect(await screen.findByLabelText("Trouble Brewing 마도서 배치")).toBeTruthy();
    expect(screen.getByDisplayValue("Ada")).toBeTruthy();
    await waitFor(() => expect(latestSavedGame(storage.savedGames).game.events).toHaveLength(0));
    expect(vi.mocked(core.replay).mock.calls.some(([candidate]) => candidate.game.events.length === 0)).toBe(true);
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

    await screen.findByLabelText("Trouble Brewing 직업 설정");
    for (const characterName of ["세탁부", "사서", "요리사", "독살범"]) {
      await user.click(screen.getByRole("button", { name: characterName }));
    }
    await user.click(screen.getByRole("button", { name: "직업 선택 확정" }));
    expect(core.propose).not.toHaveBeenCalled();

    const seatMap = await screen.findByLabelText("5자리 Trouble Brewing 마도서");
    for (const [seat, characterName] of ["세탁부", "사서", "요리사", "독살범", "임프"].entries()) {
      await user.click(screen.getByRole("button", { name: `${characterName} 배치` }));
      await user.click(within(seatMap).getByRole("button", { name: new RegExp(`${seat + 1}번 좌석`) }));
    }
    expect(screen.queryByRole("button", { name: "좌석 편집 패널 닫기 배경" })).toBeNull();

    const confirmButton = screen.getByRole("button", { name: "배치 확정" }) as HTMLButtonElement;
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
    expect(screen.getByRole("main", { name: "Trouble Brewing 진행" })).toBeTruthy();
    const liveStages = screen.getByRole("navigation", { name: "작업 단계" });
    expect(within(liveStages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
    await user.click(liveStageButton("저장 / 불러오기"));
    expect(screen.getByText("초기 설정 확정")).toBeTruthy();
    await waitFor(() => expect(seatLayoutOf(latestSavedGame(storage.savedGames))).toEqual({
      preset: "circle",
      positions: seatLayoutPositions(5, "circle"),
    }));
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
    expect(within(currentAction).getByRole("heading", { name: "독살범: 4번 Dae" })).toBeTruthy();
    expect(within(currentAction).getByText("4번 Dae")).toBeTruthy();
    expect(within(currentAction).getByText("매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다.")).toBeTruthy();
    expect(within(currentAction).getByText("중독시킬 플레이어 1명을 선택하세요.")).toBeTruthy();
    expect(storage.loadLatestGame).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "대상 선택" }));
    const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
    await user.click(within(grimoire).getByRole("button", { name: /Ada/ }));
    const readyConfirm = screen.getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
    expect(readyConfirm.disabled).toBe(false);
    await user.click(readyConfirm);

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
    await user.click(liveStageButton("저장 / 불러오기"));
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
    const grimoire = await openLiveGrimoire(user);
    const grimoireAda = within(grimoire).getByRole("button", { name: /Ada/ });
    const grimoireCy = within(grimoire).getByRole("button", { name: /Cy.*실제 주정뱅이.*표시 사서/ });
    expect(grimoireAda.classList.contains("kind-townsfolk")).toBe(true);
    expect(grimoireCy.classList.contains("kind-outsider")).toBe(true);
    expect(screen.queryByRole("button", { name: "위치 조정" })).toBeNull();
    await user.click(grimoireAda);
    expect(grimoireAda.getAttribute("aria-pressed")).toBe("true");
    await user.click(grimoireCy);
    await returnToLiveProgress(user);
    const characterSelect = screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
    expect(within(characterSelect).getByRole("option", { name: "세탁부" })).toBeTruthy();
    expect(within(characterSelect).queryByRole("option", { name: "요리사" })).toBeNull();
    expect(within(characterSelect).queryByRole("option", { name: "사서" })).toBeNull();
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

    await user.click(screen.getByRole("button", { name: "무작위 추천" }));
    expect(core.suggestPhaseInput).toHaveBeenLastCalledWith(expect.any(Object), {
      stepId: currentStep.id,
      currentInput: { playerIds: [], characterId: "" },
      choiceToken: 123,
    });
    let grimoire = await openLiveGrimoire(user);
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    await returnToLiveProgress(user);
    expect((screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("washerwoman");
    expect(core.propose).not.toHaveBeenCalled();
    expect(storage.savedGames).toHaveLength(savesBeforeSuggestion);

    await user.click(screen.getByRole("button", { name: "무작위 추천" }));
    grimoire = await openLiveGrimoire(user);
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("false");
    expect(within(grimoire).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(grimoire).getByRole("button", { name: /Cy/ }).getAttribute("aria-pressed")).toBe("true");
    await returnToLiveProgress(user);
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
    let grimoire = await openLiveGrimoire(user);
    await user.click(within(grimoire).getByRole("button", { name: /Ada/ }));
    await user.click(within(grimoire).getByRole("button", { name: /Bert/ }));
    await returnToLiveProgress(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "보여줄 캐릭터" }), "washerwoman");

    await user.click(screen.getByRole("button", { name: "무작위 추천" }));
    expect(screen.getByRole("alert").textContent).toContain("Actual Character 배정을 확인하세요.");
    grimoire = await openLiveGrimoire(user);
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(grimoire).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("true");
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    await user.click(within(grimoire).getByRole("button", { name: /Ada/ }));
    expect(within(grimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");

    pending.resolve({
      ok: true,
      value: {
        stepId: currentStep.id,
        input: { playerIds: ["player-2", "player-3"], characterId: "librarian" },
      },
    });

    await returnToLiveProgress(user);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "무작위 추천" }) as HTMLButtonElement).disabled).toBe(false),
    );
    const updatedGrimoire = await openLiveGrimoire(user);
    expect(within(updatedGrimoire).getByRole("button", { name: /Ada/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(updatedGrimoire).getByRole("button", { name: /Bert/ }).getAttribute("aria-pressed")).toBe("false");
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    expect(within(grimoire).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    await returnToLiveProgress(user);
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

    const grimoire = await openLiveGrimoire(user);
    await user.click(within(grimoire).getByRole("button", { name: /Bert/ }));
    await user.click(within(grimoire).getByRole("button", { name: /Cy/ }));
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    expect(within(grimoire).getByRole("button", { name: /Cy.*실제 주정뱅이.*표시 점쟁이/ })).toBeTruthy();
    await user.click(within(grimoire).getByRole("button", { name: /Bert/ }));
    await user.click(within(grimoire).getByRole("button", { name: /Cy/ }));
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    expect(
      (within(grimoire).getByRole("button", { name: /Bert/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    await user.click(within(grimoire).getByRole("button", { name: /Bert/ }));
    await user.click(within(grimoire).getByRole("button", { name: /Cy/ }));
    await returnToLiveProgress(user);
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
    const grimoire = await openLiveGrimoire(user);
    await user.click(within(grimoire).getByRole("button", { name: /Bert/ }));
    await user.click(within(grimoire).getByRole("button", { name: /Cy/ }));
    await returnToLiveProgress(user);
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

  test("submits an arbitrary safe integer for poisoned numeric information", async () => {
    const currentStep = step({
      id: "firstNight:chef",
      character: "chef",
      playerId: "player-2",
      kind: "number",
      informationPrompt: {
        computedResult: { kind: "number", value: 1 },
        deliveryMode: "selectable",
        activeReasons: [{
          type: "poisoned",
          poisonerPlayerId: "player-4",
          poisonEventId: "poison-1",
        }],
        registrationCandidatePlayerIds: [],
        numberChoices: [],
        numberConstraint: {
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          excludedValues: [],
        },
        setupInfoRegistrationOptions: [],
      },
    });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("event-poisoned-chef", "중독된 요리사 정보 확정")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
    const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByRole("spinbutton", { name: "전달할 숫자" }), "100");
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:chef",
        input: null,
        deliveredResult: { kind: "number", value: 100 },
      },
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

    await user.click(within(revealScreen).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    expect(screen.queryByLabelText("플레이어 공개 화면")).toBeNull();
    expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "초공감자: 3번 Cy" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
    const reopenedReveal = screen.getByLabelText("플레이어 공개 화면");
    await user.click(within(reopenedReveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

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
    await user.click(screen.getByRole("button", { name: "마도서" }));
    const storytellerSeatStyle = screen
      .getByRole("button", { name: /4번 좌석, Dae/ })
      .getAttribute("style");
    await user.click(screen.getByRole("button", { name: "진행" }));
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

    await user.click(within(revealScreen).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "낮 시작" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
    await user.click(
      within(screen.getByLabelText("플레이어 공개 화면")).getByRole("button", {
        name: "확인했으면 눈을 감으세요",
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
    await user.click(screen.getByRole("button", { name: "← 지명하기" }));
    const seatMap = await screen.findByLabelText("라이브 마도서 좌석 맵");
    await user.click(within(seatMap).getByRole("button", { name: /Ada/ }));
    await user.click(within(seatMap).getByRole("button", { name: /Dae/ }));
    await user.click(screen.getByRole("button", { name: "1번 → 4번 지명 확정" }));
    await user.click(within(seatMap).getByRole("button", { name: /Ada/ }));
    await user.click(within(seatMap).getByRole("button", { name: /Bert/ }));

    const votePreview = screen.getByText("현재").closest("dl");
    if (!votePreview) throw new Error("vote preview was not rendered");
    expect(within(votePreview).getByText("2표")).toBeTruthy();
    expect(within(votePreview).getByText("1번 Ada → 4번 Dae")).toBeTruthy();

    const confirmButton = screen.getByRole("button", { name: "2표로 투표 확정" }) as HTMLButtonElement;
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

    const seatMap = await screen.findByLabelText("라이브 마도서 좌석 맵");
    const blockedButler = within(seatMap).getByRole("button", { name: /Bert.*주인 미투표/ });
    expect((blockedButler as HTMLButtonElement).disabled).toBe(true);
    await user.click(blockedButler);
    expect(blockedButler.getAttribute("aria-pressed")).toBe("false");

    await user.click(within(seatMap).getByRole("button", { name: /Ada.*생존/ }));
    const enabledButler = within(seatMap).getByRole("button", { name: /Bert.*생존/ });
    expect((enabledButler as HTMLButtonElement).disabled).toBe(false);
    await user.click(enabledButler);
    expect(enabledButler.getAttribute("aria-pressed")).toBe("true");

    await user.click(within(seatMap).getByRole("button", { name: /Ada.*생존/ }));
    expect((within(seatMap).getByRole("button", { name: /Bert.*주인 미투표/ }) as HTMLButtonElement).disabled)
      .toBe(true);
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
    await userEvent.setup().click(screen.getByRole("button", { name: "마도서" }));
    const seatMap = await screen.findByLabelText("라이브 마도서 좌석 맵");
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

    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "지목 및 투표 2" });
    await user.click(screen.getByRole("button", { name: "← 지명하기" }));
    const seatMap = await screen.findByLabelText("라이브 마도서 좌석 맵");
    expect((within(seatMap).getByRole("button", { name: /Ada/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(seatMap).getByRole("button", { name: /Bert/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(seatMap).getByRole("button", { name: /Eun/ }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(within(seatMap).getByRole("button", { name: /Eun/ }));
    expect((within(seatMap).getByRole("button", { name: /Ada/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(seatMap).getByRole("button", { name: /Dae/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(seatMap).getByRole("button", { name: /Eun/ }) as HTMLButtonElement).disabled).toBe(false);
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
    await user.click(liveStageButton("저장 / 불러오기"));
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
    await user.click(liveStageButton("저장 / 불러오기"));
    await user.click(screen.getByRole("button", { name: "export JSON" }));
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
    await user.click(liveStageButton("진행"));
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
    const incompatibleGame = gameFile();
    incompatibleGame.game.scriptId = "sectsAndViolets";
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("JSON file input was not rendered");

    await user.upload(
      fileInput,
      new File([JSON.stringify(incompatibleGame)], "sects-and-violets.json", { type: "application/json" }),
    );

    expect(
      (await screen.findAllByText("현재 페이지와 다른 스크립트의 게임 파일입니다.")).length,
    ).toBeGreaterThan(0);
    expect(confirm).not.toHaveBeenCalled();
    await user.click(liveStageButton("저장 / 불러오기"));
    expect(screen.getAllByText("초기 설정 확정").length).toBeGreaterThan(0);
    expect(core.replay).not.toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ scriptId: "sectsAndViolets" }) }),
    );
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

    await screen.findByRole("heading", { name: "토론" });
    await user.click(screen.getByRole("button", { name: "마도서" }));
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
    await user.click(screen.getByRole("button", { name: "진행" }));
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

    const user = userEvent.setup();
    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

    await screen.findByRole("heading", { name: "밀담" });
    await user.click(screen.getByRole("button", { name: "마도서" }));
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

function liveStageButton(name: "직업" | "마도서" | "진행" | "저장 / 불러오기") {
  return within(screen.getByRole("main", { name: "Trouble Brewing 진행" }))
    .getByRole("button", { name });
}

async function openLiveGrimoire(user: ReturnType<typeof userEvent.setup>) {
  await user.click(liveStageButton("마도서"));
  return screen.findByLabelText("라이브 마도서 좌석 맵");
}

async function returnToLiveProgress(user: ReturnType<typeof userEvent.setup>) {
  await user.click(liveStageButton("진행"));
  return screen.findByRole("region", { name: "Trouble Brewing 진행" });
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

async function getRawLatestGame(idb: IDBFactory, key = "latest"): Promise<unknown> {
  const database = await openGameDatabase(idb);
  try {
    const transaction = database.transaction("game", "readonly");
    return await requestResult(transaction.objectStore("game").get(key));
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
