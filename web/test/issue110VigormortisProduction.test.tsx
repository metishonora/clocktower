import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { GameEvent, GameFile, PhaseStep, Player, ReplayState } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import {
  SectsAndVioletsLiveGrimoire,
  type LivePlayer,
} from "../src/sectsAndVioletsLivePhase";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";

const players: LivePlayer[] = [
  ["player-1", "가람", "clockmaker", "시계공", "townsfolk", true],
  ["player-2", "나래", "mutant", "돌연변이", "outsider", true],
  ["player-3", "다온", "flowergirl", "꽃 파는 소녀", "townsfolk", true],
  ["player-4", "라온", "oracle", "신탁자", "townsfolk", false],
  ["player-5", "마루", "dreamer", "꿈꾸는 자", "townsfolk", true],
  ["player-6", "보라", "pitHag", "구덩이 마녀", "minion", true],
  ["player-7", "도윤", "vigormortis", "비고르모르티스", "demon", true],
].map(([id, name, actualCharacter, characterName, characterKind, alive], index) => ({
  id: String(id),
  seat: index + 1,
  name: String(name),
  actualCharacter: String(actualCharacter),
  shownCharacter: String(actualCharacter),
  characterName: String(characterName),
  characterKind: characterKind as LivePlayer["characterKind"],
  alignment: index >= 5 ? "evil" : "good",
  alive: Boolean(alive),
  ghostVoteUsed: false,
  deathAnnounced: false,
  systemTokenIds: [],
  scriptTokens: [],
  notes: "",
}));

const demonStep: PhaseStep = {
  id: "night:demon:player-7",
  phase: "night",
  stepType: "character",
  character: "vigormortis",
  playerId: "player-7",
  requiredInput: {
    kind: "playerIds",
    optional: false,
    allowedPlayerIds: players.map((player) => player.id),
    dependentPlayerSelections: [{
      triggerPlayerId: "player-6",
      selectionIndex: 1,
      allowedPlayerIds: ["player-1", "player-5"],
    }],
  },
  canSkip: false,
  support: "automated",
};

test("keeps the attack target while choosing the one-time Vigormortis poison target", () => {
  renderGrimoire({
    handoff: { kind: "demon", complete: false, actorPlayerId: "player-7", selectionStage: "poison" },
    targetId: "player-6",
    secondaryTargetId: "player-5",
    selectablePlayerIds: ["player-1", "player-5"],
  });

  const panel = screen.getByLabelText("현재 마도서 작업");
  expect(within(panel).getByRole("heading", { name: "중독 대상" })).toBeTruthy();
  expect(within(panel).getByText("6번 보라 · 생존")).toBeTruthy();
  expect(within(panel).getByText("5번 마루 · 생존")).toBeTruthy();
  expect(screen.getByRole("button", { name: /6번 좌석.*공격 대상/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /5번 좌석.*중독 대상/ }).classList.contains("snvSeatStatePoisonTarget")).toBe(true);
  expect(screen.getByRole("button", { name: /4번 좌석/ }).hasAttribute("disabled")).toBe(true);
});

test("offers only canonical replacement neighbors and keeps dead Townsfolk selectable", () => {
  renderGrimoire({
    handoff: { kind: "vigormortisPoison", complete: false, actorPlayerId: "player-7" },
    targetId: "player-4",
    referenceTargetId: "player-5",
    selectablePlayerIds: ["player-1", "player-4"],
  });

  const panel = screen.getByLabelText("현재 마도서 작업");
  expect(within(panel).getByRole("heading", { name: "비고르모르티스가 부여한 중독 이동" })).toBeTruthy();
  expect(within(panel).getByText("5번 마루 · 생존")).toBeTruthy();
  expect(within(panel).getByText("4번 라온 · 사망")).toBeTruthy();
  expect(screen.getByRole("button", { name: /4번 좌석.*사망.*중독 대상/ }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: /3번 좌석/ }).hasAttribute("disabled")).toBe(true);
});

test("shows an automatic ability-retained token on the Minion killed by Vigormortis", async () => {
  const state = vigormortisReplay(2);
  state.players = state.players.map((player) => player.id === "player-6"
    ? { ...player, alive: false }
    : player);
  state.ruleState.automaticReminders = [{
    playerId: "player-6",
    characterId: "vigormortis",
    tokenId: "hasAbility",
    label: "능력 있음",
    description: "비고르모르티스에게 죽었지만 하수인 능력을 유지합니다.",
  }];
  const core = {
    ...vigormortisCore(),
    replay: vi.fn(async () => ({ ok: true as const, value: state })),
  };
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(vigormortisGame())} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "마도서" }));
  const grimoire = within(app).getByLabelText("밤 마도서");
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석.*토큰 1개.*사망/ }));

  const detail = screen.getByRole("dialog", { name: "6번 보라 플레이어 상세" });
  expect(within(detail).getByLabelText("능력 있음 · 출처 비고르모르티스")).toBeTruthy();
});

test("submits the attack and one-time poison target together from the production flow", async () => {
  const core = vigormortisCore();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(vigormortisGame())} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "← 공격" }));
  await user.click(within(app).getByRole("button", { name: /6번 좌석, 보라/ }));
  expect(within(app).getByRole("heading", { name: "중독 대상" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: /5번 좌석, 마루/ }));
  await user.click(within(app).getByRole("button", { name: "5번 마루 중독 확정" }));

  await waitFor(() => expect(core.propose).toHaveBeenCalledWith(expect.anything(), {
    type: "confirmStep",
    payload: {
      stepId: "night:demon:player-7",
      input: { playerIds: ["player-6", "player-5"] },
    },
  }));
});

test("automatically applies the canonical replacement when only one neighbor remains", async () => {
  const core = automaticReplacementCore();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(vigormortisGame())} />);

  await waitFor(() => expect(core.propose).toHaveBeenCalledWith(expect.anything(), {
    type: "resolveVigormortisPoison",
    payload: {
      sourceEventId: "attack-1",
      targetPlayerId: "player-1",
      expectedEventCount: 2,
    },
  }));
  expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
});

test("waits for a pending identity reveal before automatic replacement", async () => {
  const core = automaticReplacementCore(true);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(vigormortisGame())} />);

  const prompt = await screen.findByRole("dialog", { name: "직업 변경 안내 1/1" });
  expect(core.propose).not.toHaveBeenCalled();
  await user.click(within(prompt).getByRole("button", { name: "공개" }));
  const reveal = await screen.findByRole("dialog", { name: "역할 변경 공개 1/1" });
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  await waitFor(() => expect(core.propose).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    type: "resolveVigormortisPoison",
  })));
});

function renderGrimoire({
  handoff,
  targetId,
  secondaryTargetId,
  referenceTargetId,
  selectablePlayerIds,
}: {
  handoff: { kind: "demon" | "vigormortisPoison"; complete: false; actorPlayerId: string; selectionStage?: "attack" | "poison" };
  targetId?: string;
  secondaryTargetId?: string;
  referenceTargetId?: string;
  selectablePlayerIds: string[];
}) {
  return render(
    <SectsAndVioletsLiveGrimoire
      players={players}
      phaseLabel="2일차 밤"
      currentStep={demonStep}
      handoff={handoff}
      voterIds={[]}
      targetId={targetId}
      secondaryTargetId={secondaryTargetId}
      referenceTargetId={referenceTargetId}
      selectablePlayerIds={selectablePlayerIds}
      operationBusy={false}
      onSeatClick={vi.fn()}
      onConfirm={vi.fn()}
      onReturn={vi.fn()}
      onCancelDayHandoff={vi.fn()}
      onResetDaySelection={vi.fn()}
      onGoToProgress={vi.fn()}
      onReturnToSetup={vi.fn()}
    />,
  );
}

function vigormortisCore(): CoreAdapter {
  return {
    replay: vi.fn(async (gameFile) => ({ ok: true as const, value: vigormortisReplay(gameFile.game.events.length) })),
    propose: vi.fn(async (_gameFile, command) => ({
      ok: true as const,
      value: {
        event: {
          id: "attack-3",
          type: "nightActionResolved" as const,
          phase: "night" as const,
          payload: {
            stepId: "night:demon:player-7",
            actorPlayerId: "player-7",
            actorCharacterId: "vigormortis",
            resolution: {
              kind: "demonAttack" as const,
              targetPlayerId: "player-6",
              outcome: {
                kind: "deaths" as const,
                deaths: [{
                  playerId: "player-6",
                  cause: {
                    kind: "demonAttack" as const,
                    actorPlayerId: "player-7",
                    actorCharacterId: "vigormortis",
                    targetPlayerId: "player-6",
                  },
                }],
                vigormortisEffect: {
                  minionPlayerId: "player-6",
                  sourceAbilityInstanceId: "setup-1:player-7",
                  poisonTargetPlayerId: command.type === "confirmStep"
                    ? command.payload.input?.playerIds?.[1]
                    : undefined,
                },
              },
            },
          },
          summary: "비고르모르티스 공격",
          createdAt: "2026-07-28T00:02:00.000Z",
        },
        warnings: [],
        followUpSteps: [],
        preview: null,
      },
    })),
    setupDistribution: vi.fn(async () => ({ ok: true as const, value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 } })),
    setupDistributionSync: vi.fn(() => ({ ok: true as const, value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 } })),
    suggestPhaseInput: vi.fn(async () => ({ ok: false as const, error: { code: "UNSUPPORTED", messageKo: "추천 불가" } })),
  };
}

function automaticReplacementCore(withIdentityReveal = false): CoreAdapter {
  return {
    ...vigormortisCore(),
    replay: vi.fn(async (gameFile) => {
      const resolved = gameFile.game.events.at(-1)?.type === "vigormortisPoisonTargetChanged";
      return {
        ok: true as const,
        value: {
          ...vigormortisReplay(gameFile.game.events.length),
          ...(resolved ? {} : {
            pendingVigormortisPoisonChoices: [{
              sourceEventId: "attack-1",
              vigormortisPlayerId: "player-7",
              minionPlayerId: "player-6",
              previousTargetPlayerId: "player-5",
              allowedPlayerIds: ["player-1"],
              reason: "targetNotTownsfolk" as const,
            }],
            ...(withIdentityReveal ? { pendingIdentityReveals: [{
              sourceEventId: "pit-hag-2",
              sequence: 1,
              payload: {
                kind: "characterChange" as const,
                playerId: "player-5",
                alignment: "good" as const,
                characterId: "klutz",
              },
            }] } : {}),
          }),
        },
      };
    }),
    propose: vi.fn(async () => ({
      ok: true as const,
      value: {
        event: {
          id: "vigormortis-poison-3",
          type: "vigormortisPoisonTargetChanged" as const,
          phase: "night" as const,
          payload: {
            sourceEventId: "attack-1",
            previousTargetPlayerId: "player-5",
            targetPlayerId: "player-1",
          },
          summary: "비고르모르티스 중독 이동",
          createdAt: "2026-07-28T00:02:00.000Z",
        },
        warnings: [],
        followUpSteps: [],
        preview: null,
      },
    })),
  };
}

function vigormortisReplay(eventCount: number): ReplayState {
  const roster = players.map(({ characterName: _name, characterKind: _kind, ...player }) => player satisfies Player);
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount,
    phase: "night",
    players: roster,
    currentStep: demonStep,
    phaseOverview: [{ ...demonStep, status: "current" }],
    ruleState: { unannouncedNightDeathPlayerIds: [], activeImpairments: [] },
    warnings: [],
    gameEnd: null,
  };
}

function vigormortisGame(): GameFile {
  const roster = players.map(({ characterName: _name, characterKind: _kind, id: _id, ...player }) => player);
  const roles = roster.map((player) => player.actualCharacter);
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players: roster },
    summary: "초기 설정",
    createdAt: "2026-07-28T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    ui: { sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-28T00:01:00.000Z",
      setup: {
        playerCount: 7,
        demon: "vigormortis",
        selectedIds: roles,
        seatAssignments: Object.fromEntries(roles.map((role, index) => [index + 1, role])),
        seatAlignments: Object.fromEntries(roster.map((player) => [player.seat, player.alignment])),
        seatNames: Object.fromEntries(roster.map((player) => [player.seat, player.name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [{ id: "setup-1", kind: "setup", eventCount: 1, summary: "초기 설정", activeTab: "seating" }],
    } },
    game: {
      id: "issue-110-game",
      name: "Sects & Violets",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:01:00.000Z",
      events: [setup, {
        id: "night-start",
        type: "manualPhaseStepResolved",
        phase: "night",
        payload: { stepId: "night:start", outcome: "handled" },
        summary: "밤 시작",
        createdAt: "2026-07-28T00:01:00.000Z",
      }],
    },
  };
}
