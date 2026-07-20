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
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
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
  const input = screen.getByLabelText("단계 입력");
  await user.click(within(input).getByRole("button", { name: /3플레이어 3/ }));
  expect(screen.queryByRole("group", { name: "시장 공격 결과" })).toBeNull();

  const confirm = screen.getByRole("button", { name: "확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(false);
  await user.dblClick(confirm);

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
