import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { GameEvent, GameFile, Player, ReplayState } from "../src/core/types";
import { PitHagSelectionPanel } from "../src/features/pitHag/PitHagSelectionPanel";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";

const players: Player[] = [
  {
    id: "player-1", seat: 1, name: "가람", actualCharacter: "pitHag", shownCharacter: "pitHag",
    alignment: "evil", alive: true, ghostVoteUsed: false, deathAnnounced: false,
    systemTokenIds: [], scriptTokens: [], notes: "",
  },
  {
    id: "player-2", seat: 2, name: "나래", actualCharacter: "mutant", shownCharacter: "mutant",
    alignment: "good", alive: false, ghostVoteUsed: false, deathAnnounced: true,
    systemTokenIds: [], scriptTokens: [], notes: "",
  },
];

test("keeps both Pit-Hag choices unset and disables confirmation until both exist", async () => {
  const onCharacterChange = vi.fn();
  const onConfirm = vi.fn();
  const view = render(
    <PitHagSelectionPanel
      players={players}
      allowedCharacterIds={["mutant", "noDashii"]}
      onCharacterChange={onCharacterChange}
      onConfirm={onConfirm}
    />,
  );

  const panel = screen.getByRole("complementary", { name: "마귀할멈 선택" });
  const steps = within(panel).getByRole("list");
  expect(within(steps).getByText("대상").nextElementSibling?.textContent).toBe("-");
  expect(within(steps).getByText("새 캐릭터").nextElementSibling?.textContent).toBe("-");
  expect(panel.querySelector(".pitHagCharacterPlaceholder")?.textContent).toContain("캐릭터를 선택하세요");
  expect((within(panel).getByRole("button", { name: "변신 확정" }) as HTMLButtonElement).disabled).toBe(true);

  await userEvent.setup().selectOptions(within(panel).getByRole("combobox", { name: "바꿀 캐릭터" }), "noDashii");
  expect(onCharacterChange).toHaveBeenCalledWith("noDashii");

  view.rerender(
    <PitHagSelectionPanel
      players={players}
      targetPlayerId="player-2"
      characterId="noDashii"
      allowedCharacterIds={["mutant", "noDashii"]}
      onCharacterChange={onCharacterChange}
      onConfirm={onConfirm}
    />,
  );
  const selectedPanel = screen.getByRole("complementary", { name: "마귀할멈 선택" });
  expect(within(selectedPanel).getByText("2번 나래 · 사망")).toBeTruthy();
  const card = within(selectedPanel).getByLabelText("선택한 직업 노 다시 · 선 진영");
  expect(Array.from(card.children).map((element) => element.tagName)).toEqual(["IMG", "STRONG", "SPAN"]);
  expect(within(card).getByText("노 다시")).toBeTruthy();
  expect(within(card).getByLabelText("선 진영")).toBeTruthy();
  expect(within(card).queryByText(/매일 밤/)).toBeNull();
  expect((within(selectedPanel).getByRole("button", { name: "변신 확정" }) as HTMLButtonElement).disabled).toBe(false);
});

test("sends the combined choice and uses the existing centered identity reveal flow", async () => {
  const core = pitHagCore();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(pitHagGame())} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "대상 · 캐릭터 선택" }));
  const panel = within(app).getByRole("complementary", { name: "마귀할멈 선택" });
  expect((within(panel).getByRole("button", { name: "변신 확정" }) as HTMLButtonElement).disabled).toBe(true);
  const deadTarget = within(app).getByRole("button", { name: /2번 좌석, 나래.*사망/ });
  expect((deadTarget as HTMLButtonElement).disabled).toBe(false);
  await user.click(deadTarget);
  await user.selectOptions(within(panel).getByRole("combobox", { name: "바꿀 캐릭터" }), "noDashii");
  await user.click(within(panel).getByRole("button", { name: "변신 확정" }));

  expect(core.propose).toHaveBeenCalledWith(expect.anything(), {
    type: "confirmStep",
    payload: {
      stepId: "night:pitHag:player-1",
      input: { playerIds: ["player-2"], characterIds: ["noDashii"] },
    },
  });
  const prompt = await screen.findByRole("dialog", { name: "직업 변경 안내 1/1" });
  expect(prompt.closest(".snvGrimoireCenter")).toBeTruthy();
  expect(prompt.getAttribute("aria-modal")).toBeNull();
  await user.click(within(prompt).getByRole("button", { name: "공개" }));
  const reveal = await screen.findByRole("dialog", { name: "역할 변경 공개 1/1" });
  expect(reveal.classList.contains("snvInformationReveal")).toBe(true);
  expect(within(reveal).getByText("노 다시")).toBeTruthy();
  expect(within(reveal).getByLabelText("현재 진영 · 선")).toBeTruthy();
});

function pitHagCore(): CoreAdapter {
  return {
    replay: vi.fn(async (gameFile) => ({
      ok: true as const,
      value: pitHagReplay(gameFile.game.events.at(-1)?.type === "pitHagTransformationResolved"),
    })),
    propose: vi.fn(async () => ({
      ok: true as const,
      value: { event: pitHagEvent(), warnings: [], followUpSteps: [], preview: null },
    })),
    setupDistribution: vi.fn(async () => ({ ok: true as const, value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 } })),
    setupDistributionSync: vi.fn(() => ({ ok: true as const, value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 } })),
    suggestPhaseInput: vi.fn(async () => ({ ok: false as const, error: { code: "UNSUPPORTED", messageKo: "추천 불가" } })),
  };
}

function fullPlayers(changed = false): Player[] {
  const roles = ["pitHag", changed ? "noDashii" : "mutant", "dreamer", "seamstress", "artist", "evilTwin", "vigormortis"];
  const names = ["가람", "나래", "다온", "라온", "마루", "보라", "도윤"];
  return roles.map((role, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: names[index],
    actualCharacter: role,
    shownCharacter: role,
    alignment: index === 0 || index >= 5 ? "evil" : "good",
    alive: index !== 1,
    ghostVoteUsed: false,
    deathAnnounced: index === 1,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
}

function pitHagReplay(changed: boolean): ReplayState {
  const roster = fullPlayers(changed);
  const currentStep = changed ? {
    id: "night:demon:player-7",
    phase: "night" as const,
    stepType: "character" as const,
    character: "vigormortis",
    playerId: "player-7",
    requiredInput: { kind: "playerIds" as const, target: "player" as const, allowedPlayerIds: roster.map((player) => player.id), optional: false },
    canSkip: false,
    support: "automated" as const,
  } : {
    id: "night:pitHag:player-1",
    phase: "night" as const,
    stepType: "character" as const,
    character: "pitHag",
    playerId: "player-1",
    requiredInput: {
      kind: "characterTransformation" as const,
      minSelections: 1,
      maxSelections: 1,
      allowedPlayerIds: roster.map((player) => player.id),
      allowedCharacterIds: ["mutant", "noDashii"],
      optional: false,
    },
    canSkip: false,
    support: "automated" as const,
  };
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: changed ? 3 : 2,
    phase: "night",
    players: roster,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    ruleState: { unannouncedNightDeathPlayerIds: [], activeImpairments: [] },
    warnings: [],
    gameEnd: null,
    ...(changed ? { pendingIdentityReveals: [{
      sourceEventId: "pit-hag-3",
      sequence: 1,
      payload: { kind: "characterChange", playerId: "player-2", characterId: "noDashii", alignment: "good" },
    }] } : {}),
  };
}

function pitHagGame(): GameFile {
  const roles = fullPlayers().map((player) => player.actualCharacter);
  const setup: GameEvent = {
    id: "setup-1", type: "setupConfirmed", phase: "setup",
    payload: { players: fullPlayers().map(({ id: _id, ...player }) => player) },
    summary: "초기 설정", createdAt: "2026-07-26T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    ui: { sectsAndVioletsSession: {
      version: 1, activeTab: "play", savedAt: "2026-07-26T00:01:00.000Z",
      setup: {
        playerCount: 7, demon: "vigormortis", selectedIds: roles,
        seatAssignments: Object.fromEntries(roles.map((role, index) => [index + 1, role])),
        seatAlignments: Object.fromEntries(fullPlayers().map((player) => [player.seat, player.alignment])),
        seatNames: Object.fromEntries(fullPlayers().map((player) => [player.seat, player.name])),
        rosterConfirmed: true, seatingConfirmed: true,
      },
      phaseCheckpoints: [{ id: "setup-1", kind: "setup", eventCount: 1, summary: "초기 설정", activeTab: "seating" }],
    } },
    game: {
      id: "issue-104-game", name: "Sects & Violets", scriptId: "sectsAndViolets",
      createdAt: "2026-07-26T00:00:00.000Z", updatedAt: "2026-07-26T00:01:00.000Z",
      events: [setup, {
        id: "night-start", type: "manualPhaseStepResolved", phase: "night",
        payload: { stepId: "night:start", outcome: "handled" }, summary: "밤 시작", createdAt: "2026-07-26T00:01:00.000Z",
      }],
    },
  };
}

function pitHagEvent(): GameEvent {
  return {
    id: "pit-hag-3", type: "pitHagTransformationResolved", phase: "night",
    payload: {
      stepId: "night:pitHag:player-1", actorPlayerId: "player-1", targetPlayerId: "player-2", characterId: "noDashii",
      outcome: {
        kind: "changed", createdDemon: true,
        identityTransition: {
          playerId: "player-2",
          before: { actualCharacter: "mutant", shownCharacter: "mutant", alignment: "good" },
          after: { actualCharacter: "noDashii", shownCharacter: "noDashii", alignment: "good" },
        },
      },
    },
    summary: "마귀할멈 직업 변경 확정", createdAt: "2026-07-26T00:02:00.000Z",
  };
}
