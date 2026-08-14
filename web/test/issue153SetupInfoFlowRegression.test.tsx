import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { GameEvent, GameFile, PhaseStep, PhaseStepInput, SetupPlayerInput } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

describe("Issue 153 setup-information flow regressions", () => {
  test("keeps a healthy Librarian zero choice editable when a registration candidate path also exists", async () => {
    const currentStep = librarianStep();
    currentStep.informationPrompt = {
      deliveryMode: "fixed",
      activeReasons: [],
      registrationCandidatePlayerIds: ["player-4"],
      numberChoices: [],
      setupInfoRegistrationOptions: [{
        playerId: "player-4",
        registeredAs: "outsider",
        characterIds: ["saint"],
      }],
    };
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "사서: 1번 Ada" });

    const informationPicker = screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
    await user.selectOptions(informationPicker, "__zero_outsiders__");
    expect(screen.getByRole("combobox", { name: "보여줄 캐릭터" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "정보 공개" })).toBeTruthy();

    await user.selectOptions(screen.getByRole("combobox", { name: "보여줄 캐릭터" }), "");
    expect(screen.getByRole("button", { name: "대상 선택" })).toBeTruthy();
    expect(core.propose).not.toHaveBeenCalled();
  });

  test("keeps an impaired Librarian zero-Outsider choice editable in the SnV-style information picker", async () => {
    const currentStep = librarianStep({ impaired: true });
    const core = createCoreHarness({
      initialReplay: replayState({ currentStep }),
      replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
      proposal: proposal(event("unused", "unused")),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "사서: 1번 Ada" });

    expect(screen.queryByRole("checkbox", { name: "외지인 0명" })).toBeNull();
    const informationPicker = screen.getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
    expect(within(informationPicker).getByRole("option", { name: "외지인 없음" })).toBeTruthy();

    await user.selectOptions(informationPicker, "__zero_outsiders__");
    expect(informationPicker.value).toBe("__zero_outsiders__");
    expect(core.propose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "취한 정보 공개" })).toBeTruthy();

    await user.selectOptions(informationPicker, "");
    expect(informationPicker.value).toBe("");
    expect(screen.getByRole("button", { name: "대상 선택" })).toBeTruthy();
    expect(core.propose).not.toHaveBeenCalled();
  });

  test("keeps a revealed Librarian follow-up as the visible current step until Next", async () => {
    const librarian = librarianStep();
    const investigator = step({
      id: "firstNight:investigator",
      character: "investigator",
      playerId: "player-2",
      kind: "setupInfo",
      target: "players",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: "investigator",
      characterKind: "Minion",
    });
    const core = createCoreHarness({
      initialReplay: replayState({
        currentStep: librarian,
        phaseOverview: [
          overview(librarian, "current"),
          overview(investigator, "waiting"),
        ],
      }),
      replayAfterProposal: replayState({
        currentStep: investigator,
        eventCount: 2,
        phaseOverview: [
          overview(librarian, "complete"),
          overview(investigator, "current"),
        ],
      }),
      proposal: proposal(event("event-librarian-zero", "사서 외지인 없음 정보 확정"), {
        kind: "setupInformation",
        characterId: "librarian",
        candidatePlayers: [],
        zeroOutsiders: true,
      }),
    });
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
    await screen.findByRole("heading", { name: "사서: 1번 Ada" });
    await user.click(screen.getByRole("button", { name: "정보 공개" }));
    const reveal = await screen.findByRole("dialog", { name: "사서 정보 공개" });
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

    const followUp = await screen.findByRole("region", { name: "사서 정보" });
    const result = within(followUp).getByRole("group", { name: "정보 결과" });
    expect(within(result).getByText("외지인 없음", { exact: true })).toBeTruthy();
    expect(within(followUp).getByRole("button", { name: "정보 공개" })).toBeTruthy();
    expect(within(followUp).getByRole("button", { name: "다음 단계" })).toBeTruthy();

    const phaseOrder = screen.getByRole("list", { name: "첫날 밤 순서" });
    const visibleCurrent = phaseOrder.querySelector('[aria-current="step"]');
    expect(visibleCurrent?.textContent).toContain("사서");
    expect(visibleCurrent?.textContent).not.toContain("수사관");
    expect(screen.queryByRole("heading", { name: /수사관/ })).toBeNull();

    await user.click(within(followUp).getByRole("button", { name: "다음 단계" }));
    expect(await screen.findByRole("heading", { name: "수사관: 2번 Bert" })).toBeTruthy();
  });

  test("opens the poisoned Investigator Reveal from the attached imported-game state", async () => {
    const game = await attachedPoisonedInvestigatorGame();
    const importedState = await replayOrThrow(game);
    expect(importedState.currentStep?.id).toBe("firstNight:investigator");
    expect(importedState.currentStep?.informationPrompt?.activeReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "poisoned" })]),
    );
    const directProposal = await realWasmCore().propose(game, {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:investigator",
        input: {
          playerIds: ["player-6", "player-7"],
          characterId: "spy",
        },
      },
    });
    expect(directProposal).toEqual(expect.objectContaining({ ok: true }));
    if (!directProposal.ok) throw new Error(directProposal.error.messageKo);
    expect(directProposal.value.revealPayload).toEqual(expect.objectContaining({
      kind: "setupInformation",
      characterId: "investigator",
      revealedCharacterId: "spy",
    }));

    const underlyingCore = realWasmCore();
    const proposedResults: Array<Awaited<ReturnType<typeof underlyingCore.propose>>> = [];
    const proposeSpy = vi.fn(async (...args: Parameters<typeof underlyingCore.propose>) => {
      const result = await underlyingCore.propose(...args);
      proposedResults.push(result);
      return result;
    });
    const user = userEvent.setup();
    render(<ClocktowerApp
      coreAdapter={{ ...underlyingCore, propose: proposeSpy }}
      storageDriver={new MemoryGameStorageDriver(game)}
    />);
    await screen.findByRole("heading", { name: "수사관: 1번 플레이어 1" });

    await user.click(liveStageButton("마도서"));
    const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
    await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 플레이어 6/ }));
    await user.click(within(grimoire).getByRole("button", { name: /7번 좌석, 플레이어 7/ }));
    await user.click(liveStageButton("진행"));

    await user.selectOptions(screen.getByRole("combobox", { name: "보여줄 캐릭터" }), "spy");
    const revealButton = screen.getByRole("button", { name: "중독 정보 공개" });
    expect((revealButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(revealButton);
    expect(proposeSpy).toHaveBeenCalledTimes(1);
    expect(proposeSpy).toHaveBeenCalledWith(expect.any(Object), {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:investigator",
        input: {
          playerIds: ["player-6", "player-7"],
          characterId: "spy",
        },
      },
    });
    expect(proposedResults).toEqual([expect.objectContaining({ ok: true })]);

    const reveal = await screen.findByRole("dialog", { name: "수사관 정보 공개" });
    expect(within(reveal).getByRole("heading", { name: "첩자" })).toBeTruthy();
  });
});

function librarianStep({ impaired = false }: { impaired?: boolean } = {}): PhaseStep {
  return step({
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
    informationPrompt: impaired ? {
      deliveryMode: "selectable",
      activeReasons: [{ type: "drunk" }],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
    } : undefined,
  });
}

function overview(stepValue: PhaseStep, status: "complete" | "current" | "waiting") {
  return { ...stepValue, status };
}

function liveStageButton(name: "마도서" | "진행") {
  return within(screen.getByRole("main", { name: "Trouble Brewing 진행" }))
    .getByRole("button", { name });
}

async function attachedPoisonedInvestigatorGame(): Promise<GameFile> {
  const roster: SetupPlayerInput[] = [
    ["investigator", "investigator"],
    ["monk", "monk"],
    ["poisoner", "poisoner"],
    ["ravenkeeper", "ravenkeeper"],
    ["drunk", "librarian"],
    ["washerwoman", "washerwoman"],
    ["recluse", "recluse"],
    ["imp", "imp"],
    ["librarian", "librarian"],
    ["fortuneTeller", "fortuneTeller"],
    ["empath", "empath"],
    ["undertaker", "undertaker"],
    ["spy", "spy"],
    ["scarletWoman", "scarletWoman"],
    ["chef", "chef"],
  ].map(([actualCharacter, shownCharacter], index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter,
  }));
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    payload: { players: roster },
    phase: "setup",
    summary: "초기 설정 확정: 15명",
    createdAt: "2026-08-13T15:17:22.908Z",
  };
  const game: GameFile = {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id: "issue-153-attached-poisoned-investigator",
      name: "Trouble Brewing",
      createdAt: "2026-08-13T15:17:22.908Z",
      updatedAt: "2026-08-13T15:21:41.097Z",
      events: [setup],
    },
  };

  await confirmAttachedStep(game, "firstNight:minionInfo", null);
  await confirmAttachedStep(game, "firstNight:demonInfo", {
    characterIds: ["soldier", "mayor", "saint"],
  });
  await confirmAttachedStep(game, "firstNight:poisoner", { playerIds: ["player-1"] });
  await confirmAttachedStep(game, "firstNight:washerwoman", {
    playerIds: ["player-12", "player-11"],
    characterId: "undertaker",
  });
  await confirmAttachedStep(game, "firstNight:librarian", {
    playerIds: ["player-6", "player-5"],
    characterId: "drunk",
  });
  await confirmAttachedStep(game, "firstNight:librarian:player-5", { zeroOutsiders: true });
  return game;
}

async function confirmAttachedStep(
  game: GameFile,
  expectedStepId: string,
  input: PhaseStepInput,
) {
  const state = await replayOrThrow(game);
  expect(state.currentStep?.id).toBe(expectedStepId);
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: { stepId: expectedStepId, input },
  });
}
