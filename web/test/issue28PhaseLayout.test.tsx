import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { PhaseOverviewItem } from "../src/core/types";
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

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  });
});

test("renders the long phase order before the action and brings the current step into view", async () => {
  const user = userEvent.setup();
  const phaseSteps = Array.from({ length: 12 }, (_, index) =>
    step({
      id: `firstNight:layout-${index + 1}`,
      character: ["washerwoman", "chef", "librarian", "poisoner", "imp"][index % 5],
      playerId: `player-${(index % 5) + 1}`,
    }),
  );
  const currentStep = phaseSteps[9];
  const phaseOverview: PhaseOverviewItem[] = phaseSteps.map((phaseStep, index) => ({
    ...phaseStep,
    status: index < 9 ? "complete" : index === 9 ? "current" : "waiting",
  }));
  const initialReplay = replayState({ currentStep, phaseOverview });
  const core = createCoreHarness({
    initialReplay,
    replayAfterProposal: replayState({ currentStep, eventCount: 2, phaseOverview }),
    proposal: proposal(event("unused", "unused")),
  });
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await screen.findByRole("heading", { name: "임프: 5번 Eun" });
  const overview = screen.getByLabelText("단계 개요");
  const currentAction = screen.getByLabelText("현재 단계");
  expect(overview.compareDocumentPosition(currentAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(overview).getAllByRole("listitem")).toHaveLength(12);

  const disclosure = overview.closest("details") as HTMLDetailsElement | null;
  expect(disclosure).not.toBeNull();
  expect(disclosure?.open).toBe(false);
  expect(within(disclosure!).getByText("9 / 12 완료")).toBeTruthy();
  expect(overview.querySelector('li[aria-current="step"]')?.textContent).toContain("임프: 5번 Eun");
  await waitFor(() =>
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" }),
  );

  await user.click(within(disclosure!).getByText("첫 밤 순서", { selector: "summary span" }));
  expect(disclosure?.open).toBe(true);
});
