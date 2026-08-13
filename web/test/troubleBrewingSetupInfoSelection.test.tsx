import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Player, SetupInfoRegistrationOption } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  players,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

const setupInformationCases = [
  {
    label: "세탁부",
    character: "washerwoman",
    characterKind: "Townsfolk",
    selectedSeat: 4,
    impossibleSeat: 5,
    qualifyingSeat: 1,
    roster: players(),
  },
  {
    label: "사서",
    character: "librarian",
    characterKind: "Outsider",
    selectedSeat: 4,
    impossibleSeat: 5,
    qualifyingSeat: 3,
    roster: players().map((player) => player.id === "player-3"
      ? { ...player, actualCharacter: "recluse", shownCharacter: "recluse" }
      : player),
  },
  {
    label: "수사관",
    character: "investigator",
    characterKind: "Minion",
    selectedSeat: 1,
    impossibleSeat: 5,
    qualifyingSeat: 4,
    roster: players(),
  },
] as const satisfies ReadonlyArray<{
  label: string;
  character: "washerwoman" | "librarian" | "investigator";
  characterKind: "Townsfolk" | "Outsider" | "Minion";
  selectedSeat: number;
  impossibleSeat: number;
  qualifyingSeat: number;
  roster: Player[];
}>;

test.each(setupInformationCases)(
  "$label 마도서는 첫 대상 이후 유효한 최종 조합으로 이어지지 않는 좌석을 막는다",
  async ({ character, characterKind, selectedSeat, impossibleSeat, qualifyingSeat, roster }) => {
    const user = userEvent.setup();
    renderSetupInformationStep({ character, characterKind, roster });

    const progress = await screen.findByRole("region", { name: "현재 단계" });
    await user.click(within(progress).getByRole("button", { name: "대상 선택" }));

    const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
    const selected = seatButton(grimoire, selectedSeat);
    const impossible = seatButton(grimoire, impossibleSeat);
    const qualifying = seatButton(grimoire, qualifyingSeat);
    await user.click(selected);

    expect((selected as HTMLButtonElement).disabled).toBe(false);
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect((impossible as HTMLButtonElement).disabled).toBe(true);
    expect((qualifying as HTMLButtonElement).disabled).toBe(false);

    await user.click(impossible);
    expect(impossible.getAttribute("aria-pressed")).toBe("false");
    const panel = screen.getByRole("complementary", { name: "현재 마도서 작업" });
    expect((within(panel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(qualifying);
    expect(qualifying.getAttribute("aria-pressed")).toBe("true");
    expect((within(panel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(false);
  },
);

test("중독된 setup 정보는 건강할 때 불가능한 좌석 조합도 선택할 수 있다", async () => {
  const user = userEvent.setup();
  renderSetupInformationStep({
    character: "washerwoman",
    characterKind: "Townsfolk",
    roster: players(),
    impaired: true,
  });

  const progress = await screen.findByRole("region", { name: "현재 단계" });
  await user.click(within(progress).getByRole("button", { name: "대상 선택" }));

  const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  const minion = seatButton(grimoire, 4);
  const demon = seatButton(grimoire, 5);
  await user.click(minion);

  expect((demon as HTMLButtonElement).disabled).toBe(false);
  await user.click(demon);

  const panel = screen.getByRole("complementary", { name: "현재 마도서 작업" });
  expect((within(panel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(false);
});

test.each([
  {
    label: "세탁부",
    character: "washerwoman",
    characterKind: "Townsfolk",
    registeredCharacter: "spy",
    registeredAs: "townsfolk",
    shownCharacter: "chef",
  },
  {
    label: "사서",
    character: "librarian",
    characterKind: "Outsider",
    registeredCharacter: "spy",
    registeredAs: "outsider",
    shownCharacter: "recluse",
  },
  {
    label: "수사관",
    character: "investigator",
    characterKind: "Minion",
    registeredCharacter: "recluse",
    registeredAs: "minion",
    shownCharacter: "poisoner",
  },
] as const)(
  "$label 마도서는 취급 가능한 플레이어를 유효한 조합 후보로 남긴다",
  async ({ character, characterKind, registeredCharacter, registeredAs, shownCharacter }) => {
    const user = userEvent.setup();
    const roster = players().map((player) => {
      if (player.id === "player-3") {
        return { ...player, actualCharacter: registeredCharacter, shownCharacter: registeredCharacter };
      }
      if (character === "librarian" && player.id === "player-2") {
        return { ...player, actualCharacter: "recluse", shownCharacter: "recluse" };
      }
      return player;
    });
    renderSetupInformationStep({
      character,
      characterKind,
      roster,
      registrationOptions: [{
        playerId: "player-3",
        registeredAs,
        characterIds: [shownCharacter],
      }],
    });

    const progress = await screen.findByRole("region", { name: "현재 단계" });
    await user.click(within(progress).getByRole("button", { name: "대상 선택" }));

    const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
    await user.click(seatButton(grimoire, 5));
    const registrationCandidate = seatButton(grimoire, 3);
    expect(registrationCandidate.disabled).toBe(false);

    await user.click(registrationCandidate);
    const panel = screen.getByRole("complementary", { name: "현재 마도서 작업" });
    expect((within(panel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(false);
  },
);

function renderSetupInformationStep({
  character,
  characterKind,
  roster,
  impaired = false,
  registrationOptions = [],
}: {
  character: "washerwoman" | "librarian" | "investigator";
  characterKind: "Townsfolk" | "Outsider" | "Minion";
  roster: Player[];
  impaired?: boolean;
  registrationOptions?: SetupInfoRegistrationOption[];
}) {
  const currentStep = step({
    id: `firstNight:${character}`,
    character,
    playerId: roster[0]?.id,
    kind: "setupInfo",
    target: "players",
    minSelections: 2,
    maxSelections: 2,
    setupInfo: character,
    characterKind,
    informationPrompt: impaired || registrationOptions.length ? {
      deliveryMode: impaired ? "selectable" : "fixed",
      activeReasons: impaired
        ? [{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-event" }]
        : [],
      registrationCandidatePlayerIds: registrationOptions.map(({ playerId }) => playerId),
      numberChoices: [],
      setupInfoRegistrationOptions: registrationOptions,
    } : undefined,
  });
  const replay = replayState({ currentStep, playerRoster: roster });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: { ...replay, eventCount: replay.eventCount + 1 },
    proposal: proposal(event("event-setup-information", "정보 확정")),
  });

  render(
    <ClocktowerApp
      coreAdapter={core}
      storageDriver={new MemoryGameStorageDriver(gameFile())}
    />,
  );
}

function seatButton(grimoire: HTMLElement, seat: number): HTMLButtonElement {
  return within(grimoire).getByRole("button", { name: new RegExp(`^${seat}번 좌석,`) }) as HTMLButtonElement;
}
