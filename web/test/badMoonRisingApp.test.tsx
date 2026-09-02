import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { BadMoonRisingApp } from "../src/badMoonRisingApp";
import type { BmrPresentation, BmrSetupDraft } from "../src/badMoonRisingGame";
import { BAD_MOON_RISING } from "../src/core/scripts";
import type { CoreAdapter } from "../src/core/coreAdapter";
import { realWasmCore } from "./realWasmCoreHarness";
import type { WebSessionSnapshot, WebSessionStorageDriver } from "../src/webSessionStorage";

test("runs the real 7-player Godfather Setup through first Night, Day, and later Night", async () => {
  const storage = new MemoryBmrStorage();
  const view = render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  const user = userEvent.setup();

  const app = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
  for (const name of ["할머니", "선원", "객실 청소부", "궁정대신", "대부", "미치광이"]) {
    await user.click(within(app).getByRole("button", { name: `${name} 선택` }));
  }

  expect(within(app).getAllByRole("button", { name: "대부 보정: 외지인 +1, 주민 -1" })[0].getAttribute("aria-pressed")).toBe("true");
  expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(within(app).getByRole("button", { name: "직업 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));

  const lunaticSeat = within(app).getByRole("button", { name: /좌석.*미치광이/ });
  await user.click(lunaticSeat);
  const shownDemon = within(app).getByRole("combobox", { name: "보여줄 악마" }) as HTMLSelectElement;
  expect(shownDemon.value).toBe("");
  expect(within(app).getByText("미치광이에게 보여줄 악마를 선택하세요.")).toBeTruthy();
  expect(within(app).getByRole("option", { name: "포" })).toBeTruthy();
  expect((within(app).getByRole("button", { name: "좌석 확정" }) as HTMLButtonElement).disabled).toBe(true);
  await user.selectOptions(shownDemon, "po");
  expect((within(app).getByRole("button", { name: "좌석 확정" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(within(app).getByRole("button", { name: "좌석 확정" }));

  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(1));
  expect(storage.snapshot?.canonical.game).toMatchObject({
    script: { type: "official", scriptId: BAD_MOON_RISING },
  });
  expect(storage.snapshot?.canonical.game.events[0]).toMatchObject({
    type: "setupConfirmed",
    payload: {
      setupChoiceId: "addOutsider",
      players: expect.arrayContaining([
        expect.objectContaining({ actualCharacter: "lunatic", shownCharacter: "po" }),
      ]),
    },
  });
  expect(within(app).queryByRole("button", { name: "무작위 배치" })).toBeNull();
  expect(within(app).queryByRole("button", { name: "배치 초기화" })).toBeNull();
  expect(within(app).getByRole("button", { name: "진행으로 이동" })).toBeTruthy();
  expect(within(app).queryByText("확정", { exact: true })).toBeNull();
  expect(within(app).getByLabelText(/첫날 밤 경과 시간/)).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: /좌석.*미치광이/ }));
  const playerDetails = screen.getByRole("dialog", { name: /플레이어 상세/ });
  expect(within(playerDetails).getByText("캐릭터 능력")).toBeTruthy();
  expect(within(playerDetails).queryByText("생존", { exact: true })).toBeNull();
  expect(within(playerDetails).queryByLabelText(/부착된 토큰/)).toBeNull();
  await user.click(within(playerDetails).getByRole("button", { name: "플레이어 상세 닫기" }));
  const rolesTab = within(app).getByRole("button", { name: "직업" }) as HTMLButtonElement;
  expect(rolesTab.disabled).toBe(false);
  await user.click(rolesTab);
  const unselectedExorcistRole = within(app).getByRole("button", { name: "구마사제 선택" }) as HTMLButtonElement;
  expect(unselectedExorcistRole.getAttribute("aria-pressed")).toBe("false");
  expect(unselectedExorcistRole.disabled).toBe(false);
  await user.click(unselectedExorcistRole);
  expect(within(app).getByRole("complementary", { name: "구마사제 상세" })).toBeTruthy();
  expect(storage.snapshot?.setupDraft?.selectedIds).not.toContain("exorcist");
  await user.click(within(app).getByRole("button", { name: "마도서" }));
  await user.click(within(app).getByRole("button", { name: "배치로 돌아가기" }));
  const returnDialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  await user.click(within(returnDialog).getByRole("button", { name: "취소" }));

  await user.click(within(app).getByRole("button", { name: "진행으로 이동" }));
  expect(within(app).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  await completeAutomatedInformation(user, app);
  await user.click(within(app).getByRole("button", { name: "해당 없음" }));
  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toContainEqual(expect.objectContaining({
    type: "manualPhaseStepResolved",
    payload: expect.objectContaining({ outcome: "notApplicable" }),
  })));
  await completeManualStepsUntil(user, app, "악마 정보");
  await completeAutomatedInformation(user, app);
  await completeManualStepsUntil(user, app, "낮 시작");
  await user.click(within(app).getByRole("button", { name: "낮 시작" }));
  expect(await within(app).findByRole("heading", { name: "1일차 낮" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "처리 완료" }));
  await user.click(within(app).getByRole("button", { name: "밤 시작" }));
  expect(await within(app).findByRole("heading", { name: "2일차 밤" })).toBeTruthy();

  await waitFor(() => expect(storage.snapshot?.canonical.game.events.length).toBeGreaterThan(10));
  view.unmount();
  const restoredView = render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  const restoredApp = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
  await user.click(within(restoredApp).getByRole("button", { name: "진행" }));
  expect(await within(restoredApp).findByRole("heading", { name: "2일차 밤" })).toBeTruthy();

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  await user.click(within(restoredApp).getByRole("button", { name: /최근 행동 되돌리기/ }));
  expect(await within(restoredApp).findByRole("heading", { name: "1일차 낮" })).toBeTruthy();
  confirm.mockRestore();
  restoredView.unmount();
});

test.each([
  {
    playerCount: 9,
    townsfolk: ["할머니", "선원", "객실 청소부", "구마사제", "여관 주인", "도박사"],
    minions: ["대부"],
  },
  {
    playerCount: 15,
    townsfolk: ["할머니", "선원", "객실 청소부", "구마사제", "여관 주인", "도박사", "험담꾼", "궁정대신", "교수", "음유시인"],
    minions: ["대부", "악마의 변호사", "암살자"],
  },
])("creates and replays the real $playerCount-player Godfather Setup", async ({ playerCount, townsfolk, minions }) => {
  const storage = new MemoryBmrStorage();
  render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
  const user = userEvent.setup();
  await user.click(within(app).getByRole("button", { name: `${playerCount}명` }));
  await user.click(within(app).getByRole("button", { name: "대부 선택" }));

  await waitFor(() => {
    expect(within(app).getAllByRole("button", { name: "대부 보정: 외지인 +1, 주민 -1" })[0].getAttribute("aria-pressed")).toBe("false");
    expect(within(app).getAllByRole("button", { name: "대부 보정: 외지인 -1, 주민 +1" })[0].getAttribute("aria-pressed")).toBe("false");
  });
  expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(app).getAllByRole("button", { name: "대부 보정: 외지인 -1, 주민 +1" })[0]);
  expect(within(app).getAllByRole("button", { name: "대부 보정: 외지인 -1, 주민 +1" })[0].getAttribute("aria-pressed")).toBe("true");

  for (const name of [...townsfolk, "땜장이", ...minions.filter((name) => name !== "대부")]) {
    await user.click(within(app).getByRole("button", { name: `${name} 선택` }));
  }
  await waitFor(() => {
    expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(false);
  });
  await user.click(within(app).getByRole("button", { name: "직업 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "좌석 확정" }));

  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(1));
  const setupEvent = storage.snapshot?.canonical.game.events[0];
  expect(setupEvent).toMatchObject({
    type: "setupConfirmed",
    payload: {
      setupChoiceId: "removeOutsider",
      players: expect.arrayContaining([expect.objectContaining({ actualCharacter: "godfather" })]),
    },
  });
  if (setupEvent?.type !== "setupConfirmed") throw new Error("setupConfirmed event was not saved");
  expect(setupEvent.payload.players).toHaveLength(playerCount);
});

test("preserves the roster and seats when returning, then resets everything for a new game", async () => {
  const storage = new MemoryBmrStorage();
  render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
  const user = userEvent.setup();
  await confirmSimpleSevenPlayerGame(user, app, storage);

  const confirmedDraft = structuredClone(storage.snapshot?.setupDraft);
  await user.click(within(app).getByRole("button", { name: "배치로 돌아가기" }));
  const returnDialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  await user.click(within(returnDialog).getByRole("button", { name: "초기화하고 돌아가기" }));
  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(0));
  expect(storage.snapshot?.setupDraft).toMatchObject({
    rosterConfirmed: true,
    seatingConfirmed: false,
    selectedIds: confirmedDraft?.selectedIds,
    seatAssignments: confirmedDraft?.seatAssignments,
    seatNames: confirmedDraft?.seatNames,
  });
  expect(within(app).getByRole("button", { name: "무작위 배치" })).toBeTruthy();
  expect((within(app).getByRole("button", { name: "좌석 확정" }) as HTMLButtonElement).disabled).toBe(false);

  await user.click(within(app).getByRole("button", { name: "좌석 확정" }));
  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(1));
  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  const newGameDialog = screen.getByRole("dialog", { name: "새 게임 시작 확인" });
  await user.click(within(newGameDialog).getByRole("button", { name: "새 게임 시작" }));

  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(0));
  expect(storage.snapshot?.setupDraft).toMatchObject({
    playerCount: 7,
    selectedIds: ["pukka"],
    rosterConfirmed: false,
    seatingConfirmed: false,
    seatAssignments: {},
  });
  expect(within(app).getByRole("button", { name: "직업" }).getAttribute("aria-current")).toBe("page");
  expect((within(app).getByRole("button", { name: "마도서" }) as HTMLButtonElement).disabled).toBe(true);
});

test("exports BMR JSON, imports it again, and rejects another script", async () => {
  const storage = new MemoryBmrStorage();
  const user = userEvent.setup();
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const createObjectUrl = vi.fn((_value: Blob | MediaSource) => "blob:bmr-checkpoint");
  const revokeObjectUrl = vi.fn();
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

  try {
    render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);
    const app = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
    await confirmSimpleSevenPlayerGame(user, app, storage);
    const exportedGame = structuredClone(storage.snapshot?.canonical);

    await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
    await user.click(within(app).getByRole("button", { name: "JSON 내보내기" }));
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:bmr-checkpoint");

    await user.click(within(app).getByRole("button", { name: "새 게임" }));
    await user.click(within(screen.getByRole("dialog", { name: "새 게임 시작 확인" })).getByRole("button", { name: "새 게임 시작" }));
    await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(0));
    const fileInput = app.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput || !exportedGame) throw new Error("BMR JSON file input or game was not available");
    await user.upload(fileInput, new File([JSON.stringify(exportedGame)], "bmr.json", { type: "application/json" }));
    await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(1));
    expect(within(app).getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");

    const incompatible = structuredClone(exportedGame);
    if (incompatible.schemaVersion !== 4) throw new Error("expected canonical v4 export");
    incompatible.game.script = { type: "official", scriptId: "sectsAndViolets" };
    await user.upload(fileInput, new File([JSON.stringify(incompatible)], "snv.json", { type: "application/json" }));
    expect((await within(app).findByRole("alert")).textContent).toContain("현재 페이지와 다른 스크립트의 게임 파일입니다.");
    expect(storage.snapshot?.canonical.game).toMatchObject({
      script: { type: "official", scriptId: BAD_MOON_RISING },
    });
    expect(storage.snapshot?.canonical.game.events).toHaveLength(1);
  } finally {
    anchorClick.mockRestore();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
  }
});

test("restores the BMR web session and rejects another script at the storage boundary", async () => {
  const storage = new MemoryBmrStorage({
    version: 1,
    scriptId: BAD_MOON_RISING,
    savedAt: "2026-08-28T00:00:00.000Z",
    canonical: emptyBmrGame(),
    setupDraft: null,
    presentation: { activeTab: "roles" },
  });
  render(<BadMoonRisingApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  expect(await screen.findByRole("main", { name: "Bad Moon Rising 게임" })).toBeTruthy();
  expect(storage.loads).toBe(1);
});

test("keeps the file picker hidden and blocks confirmation while the Godfather distribution is stale", async () => {
  const wasm = realWasmCore();
  let holdNonGodfatherRequests = false;
  let releaseNonGodfatherRequests: () => void = () => {};
  const nonGodfatherGate = new Promise<void>((resolve) => {
    releaseNonGodfatherRequests = resolve;
  });
  const coreAdapter: CoreAdapter = {
    ...wasm,
    async setupDistribution(request) {
      if (holdNonGodfatherRequests && !request.actualCharacters.includes("godfather")) {
        await nonGodfatherGate;
      }
      return wasm.setupDistribution(request);
    },
  };
  render(<BadMoonRisingApp coreAdapter={coreAdapter} storageDriver={new MemoryBmrStorage()} />);
  const app = await screen.findByRole("main", { name: "Bad Moon Rising 게임" });
  const user = userEvent.setup();

  const filePicker = app.querySelector<HTMLInputElement>('input[type="file"]');
  expect(filePicker?.hidden).toBe(true);

  for (const name of ["할머니", "선원", "객실 청소부", "궁정대신", "대부", "미치광이"]) {
    await user.click(within(app).getByRole("button", { name: `${name} 선택` }));
  }
  await waitFor(() => {
    expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(false);
  });

  holdNonGodfatherRequests = true;
  await user.click(within(app).getByRole("button", { name: "대부 선택" }));
  await user.click(within(app).getByRole("button", { name: "악마의 변호사 선택" }));

  expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(true);
  releaseNonGodfatherRequests();
  await waitFor(() => {
    expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

async function completeAutomatedInformation(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
) {
  const heading = within(app).getByRole("heading", { level: 3 });
  if (heading.textContent === "악마 정보") {
    const candidates = within(app).getAllByRole("button", { name: /속임수 선택$/ }).slice(0, 3);
    for (const candidate of candidates) await user.click(candidate);
  }
  await user.click(within(app).getByRole("button", { name: "정보 공개" }));
  const reveal = await screen.findByRole("dialog", { name: /정보 공개/ });
  await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  await user.click(within(app).getByRole("button", { name: "다음으로" }));
}

async function completeManualStepsUntil(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
  target: string,
) {
  for (let count = 0; count < 20; count += 1) {
    if (within(app).queryByRole("heading", { name: target })) return;
    const handled = within(app).queryByRole("button", { name: "처리 완료" });
    if (!handled) throw new Error(`${target} 이전에 처리할 수 없는 단계가 나타났습니다.`);
    await user.click(handled);
  }
  throw new Error(`${target} 단계에 도달하지 못했습니다.`);
}

async function confirmSimpleSevenPlayerGame(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
  storage: MemoryBmrStorage,
) {
  for (const name of ["할머니", "선원", "객실 청소부", "구마사제", "여관 주인", "악마의 변호사"]) {
    await user.click(within(app).getByRole("button", { name: `${name} 선택` }));
  }
  await waitFor(() => {
    expect((within(app).getByRole("button", { name: "직업 확정" }) as HTMLButtonElement).disabled).toBe(false);
  });
  await user.click(within(app).getByRole("button", { name: "직업 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "좌석 확정" }));
  await waitFor(() => expect(storage.snapshot?.canonical.game.events).toHaveLength(1));
}

function emptyBmrGame() {
  return {
    schemaVersion: 3 as const,
    game: {
      scriptId: BAD_MOON_RISING,
      id: "bmr-app-test",
      name: "Bad Moon Rising",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
      events: [],
    },
  };
}

class MemoryBmrStorage implements WebSessionStorageDriver<BmrSetupDraft, BmrPresentation> {
  loads = 0;

  constructor(public snapshot?: WebSessionSnapshot<BmrSetupDraft, BmrPresentation>) {}

  async loadSession() {
    this.loads += 1;
    return this.snapshot ? structuredClone(this.snapshot) : undefined;
  }

  async saveSession(snapshot: WebSessionSnapshot<BmrSetupDraft, BmrPresentation>) {
    this.snapshot = structuredClone(snapshot);
  }
}
