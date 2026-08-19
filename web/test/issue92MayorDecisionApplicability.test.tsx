import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { GameFile, MayorDecisionInput, PhaseStep, Player } from "../src/core/types";
import { StepInputFields } from "../src/features/phase-control/StepInputs";
import { usePhaseInputDraft } from "../src/features/phase-control/usePhaseInputDraft";
import { emptyNominationDraft } from "../src/features/voting/useNominationDraft";
import { importGameFileJson } from "../src/gameStorage";
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
import { confirmLivePlayerSelection, startLiveTargetSelection } from "./livePlayTestHelpers";
import { realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

const fixturePath = resolve(
  process.cwd(),
  "../fixtures/acceptance/trouble-brewing/imp-poisoned-no-kill.json",
);

const players: Player[] = [
  player("mayor", 1, "시장", "mayor"),
  player("chef", 2, "요리사", "chef"),
  player("imp", 3, "임프", "imp", "evil"),
];

test("an impaired Imp step does not render Mayor controls even with a stale decision", () => {
  renderFields(impairedImpStep(), ["mayor"], { kind: "mayorDies" });

  expect(screen.queryByRole("group", { name: "시장 공격 결과" })).toBeNull();
  expect(screen.queryByRole("button", { name: "시장이 사망" })).toBeNull();
});

test("switching away from and back to the Mayor requires a fresh decision", () => {
  const step = healthyImpStep();
  const { result } = renderHook(() => usePhaseInputDraft(step, players));

  act(() => result.current.setSelectedPlayerIds(["mayor"]));
  act(() => result.current.setMayorDecision({ kind: "mayorDies" }));
  expect(result.current.mayorDecision).toEqual({ kind: "mayorDies" });

  act(() => result.current.setSelectedPlayerIds(["chef"]));
  expect(result.current.mayorDecision).toBeUndefined();

  act(() => result.current.setSelectedPlayerIds(["mayor"]));
  expect(result.current.mayorDecision).toBeUndefined();
});

test("a healthy Imp resolves a Mayor bounce entirely inside the Grimoire before returning to Progress", async () => {
  const impStep = healthyImpStep();
  const nextStep = step({ id: "night:empath", character: "empath", playerId: "chef", phase: "night" });
  const attackEvent = {
    ...event("imp-attacks-mayor", "임프가 시장을 공격함", "night"),
    type: "nightActionResolved" as const,
    payload: {
      stepId: impStep.id,
      actorPlayerId: "imp",
      resolution: {
        kind: "impAttack" as const,
        targetPlayerId: "mayor",
        mayorContext: {
          kind: "bounced" as const,
          mayorPlayerId: "mayor",
          bounceTargetPlayerId: "chef",
        },
        outcome: { kind: "death" as const, playerId: "chef" },
      },
    },
  };
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep: impStep, playerRoster: players }),
    replayAfterProposal: replayState({ currentStep: nextStep, playerRoster: players, eventCount: 2 }),
    proposal: proposal(attackEvent),
  });
  const user = userEvent.setup();

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await screen.findByRole("heading", { name: "임프: 3번 임프" });
  const grimoire = await startLiveTargetSelection(user);
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 시장/ }));
  let selectionPanel = screen.getByLabelText("현재 마도서 작업");
  expect(within(selectionPanel).getByText("시장 공격 결과", { exact: true })).toBeTruthy();
  expect((within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(selectionPanel).getByRole("button", { name: "다른 플레이어가 대신 사망" }));

  selectionPanel = screen.getByLabelText("현재 마도서 작업");
  expect(within(selectionPanel).getByRole("heading", { name: "시장 능력" })).toBeTruthy();
  expect(within(selectionPanel).getByText("대신 사망 대상", { exact: true })).toBeTruthy();
  expect((screen.getByRole("button", { name: "마도서 작업을 완료하세요" }) as HTMLButtonElement).disabled).toBe(true);
  const attackedMayorSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 시장.*공격 대상/ });
  expect(attackedMayorSeat.classList.contains("tbSeatStateAttack")).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 요리사/ }));
  expect((within(selectionPanel).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(within(selectionPanel).getByRole("button", { name: "선택 확정" }));

  const completed = await screen.findByRole("heading", { name: "악마 공격 결과" });
  const completedPanel = completed.closest("aside");
  expect(completedPanel).not.toBeNull();
  expect(within(completedPanel as HTMLElement).getByText("1번 시장 · 생존", { exact: true })).toBeTruthy();
  expect(within(completedPanel as HTMLElement).getByText("2번 요리사 · 사망", { exact: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");
  await user.click(within(completedPanel as HTMLElement).getByRole("button", { name: "다음 →" }));
  expect(await screen.findByRole("heading", { name: "초공감자: 2번 요리사" })).toBeTruthy();

  expect(core.propose).toHaveBeenCalledWith(expect.any(Object), {
    type: "confirmStep",
    payload: {
      stepId: "night:imp",
      input: {
        playerIds: ["mayor"],
        mayorDecision: { kind: "bounce", targetPlayerId: "chef" },
      },
    },
  });
});

test("IMP-04 confirms a poisoned Imp attack on the Mayor exactly once through real WASM", async () => {
  const game = importGameFileJson(readFileSync(fixturePath, "utf8"));
  const initialEventCount = game.game.events.length;
  const before = await replayOrThrow(game);
  expect(before.currentStep?.id).toBe("night:imp");
  expect(before.currentStep?.requiredInput.mayorDecision).toBeUndefined();

  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await screen.findByRole("heading", { name: "임프: 8번 플레이어 8" });
  await confirmLivePlayerSelection(user, /플레이어 3/);
  expect(screen.queryByRole("group", { name: "시장 공격 결과" })).toBeNull();

  await waitFor(() => {
    expect(latestSavedGame(storage).game.events).toHaveLength(initialEventCount + 1);
  });

  const saved = latestSavedGame(storage);
  expect(saved.game.events.at(-1)).toMatchObject({
    type: "nightActionResolved",
    payload: {
      stepId: "night:imp",
      actorPlayerId: "player-8",
      resolution: {
        kind: "impAttack",
        targetPlayerId: "player-3",
        mayorContext: { kind: "notApplicable" },
        outcome: { kind: "noDeath", reason: "actorImpaired" },
      },
    },
  });
  const after = await replayOrThrow(saved);
  expect(after.currentStep?.id).toBe("night:empath");
  expect(after.players.find((candidate) => candidate.id === "player-3")?.alive).toBe(true);
});

function renderFields(
  step: PhaseStep,
  selectedPlayerIds: string[],
  mayorDecision?: MayorDecisionInput,
) {
  return render(
    <StepInputFields
      step={step}
      players={players}
      nominationDraft={emptyNominationDraft()}
      onNominationDraftChange={vi.fn()}
      selectedPlayerIds={selectedPlayerIds}
      selectedCharacterId=""
      selectedCharacterIds={[]}
      zeroOutsiders={false}
      zeroOutsidersAvailable
      mayorDecision={mayorDecision}
      busy={false}
      onSelectedPlayerIdsChange={vi.fn()}
      onCharacterChange={vi.fn()}
      onCharactersChange={vi.fn()}
      onZeroOutsidersChange={vi.fn()}
      onNumberChoiceChange={vi.fn()}
      onTargetChoiceChange={vi.fn()}
      onMayorDecisionChange={vi.fn()}
      onRegistrationJudgmentsChange={vi.fn()}
    />,
  );
}

function impairedImpStep(): PhaseStep {
  const step = healthyImpStep();
  return {
    ...step,
    requiredInput: { ...step.requiredInput, mayorDecision: undefined },
  };
}

function healthyImpStep(): PhaseStep {
  return {
    id: "night:imp",
    phase: "night",
    stepType: "character",
    character: "imp",
    playerId: "imp",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      mayorDecision: { mayorPlayerId: "mayor", bounceTargetPlayerIds: ["chef", "imp"] },
      optional: false,
    },
    canSkip: true,
  };
}

function player(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  alignment: Player["alignment"] = "good",
): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}

function latestSavedGame(storage: MemoryGameStorageDriver): GameFile {
  const saved = storage.savedGames.at(-1);
  if (!saved) throw new Error("expected an autosaved GameFile");
  return saved;
}
