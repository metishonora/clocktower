import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { usePhaseInputDraft } from "../src/features/phase-control/usePhaseInputDraft";
import { emptyNominationDraft, useNominationDraft } from "../src/features/voting/useNominationDraft";
import { players, step } from "./clocktowerAppHarness";

test("confirmed Undo resets nomination drafts even when replay returns to the same step ID", () => {
  const { result, rerender } = renderHook(
    ({ resetRevision }) => useNominationDraft("day:nomination:1", resetRevision),
    { initialProps: { resetRevision: 0 } },
  );
  act(() => result.current[1]({ nominatorId: "player-1", nomineeId: "player-2", voterIds: ["player-1"] }));

  rerender({ resetRevision: 1 });

  expect(result.current[0]).toEqual(emptyNominationDraft());
});

test("confirmed Undo resets phase selections and suggestion state at the same step ID", () => {
  const currentStep = step({
    id: "firstNight:poisoner",
    character: "poisoner",
    playerId: "player-4",
    kind: "playerIds",
    minSelections: 1,
    maxSelections: 1,
  });
  const { result, rerender } = renderHook(
    ({ resetRevision }) => usePhaseInputDraft(currentStep, players(), "same-context", resetRevision),
    { initialProps: { resetRevision: 0 } },
  );
  act(() => result.current.togglePlayer("player-2"));
  expect(result.current.selectedPlayerIds).toEqual(["player-2"]);

  rerender({ resetRevision: 1 });

  expect(result.current.selectedPlayerIds).toEqual([]);
  expect(result.current.selectedTargetChoice).toBeUndefined();
});
