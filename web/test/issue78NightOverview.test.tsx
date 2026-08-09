import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PhaseOverviewItem, Player } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import {
  createCoreHarness,
  event,
  gameFile,
  MemoryGameStorageDriver,
  players,
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

test("condenses a multi-Minion night overview while preserving status, detail, and current-step scrolling", async () => {
  const playerRoster = [
    player("player-6", 6, "Faye", "spy", "evil"),
    ...players(),
  ];
  const minionInfo = step({
    id: "firstNight:minionInfo",
    stepType: "evilInfo",
  });
  const demonInfo = step({
    id: "firstNight:demonInfo",
    stepType: "evilInfo",
    kind: "characterIds",
    target: "characters",
  });
  const poisoner = step({
    id: "firstNight:poisoner",
    character: "poisoner",
    playerId: "player-4",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  });
  const imp = step({
    id: "firstNight:imp",
    character: "imp",
    playerId: "player-5",
  });
  const toDay = step({
    id: "firstNight:toDay",
    stepType: "phaseTransition",
    kind: "day",
  });
  const phaseOverview: PhaseOverviewItem[] = [
    { ...minionInfo, status: "complete" },
    { ...demonInfo, status: "skipped" },
    { ...poisoner, status: "current" },
    { ...imp, status: "waiting" },
    { ...toDay, status: "waiting" },
  ];
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  renderLiveOverview(poisoner, phaseOverview, playerRoster);

  await screen.findByRole("heading", { name: "독살범: 4번 Dae" });
  expect(screen.getByText("중독시킬 플레이어 1명을 선택하세요.")).toBeTruthy();

  const overview = screen.getByRole("region", { name: "단계 개요" });
  expect(overview.closest("details")).toBeNull();

  expect(within(overview).getByText("하수인 (4, 6)")).toBeTruthy();
  expect(within(overview).getByText("악마 (5)")).toBeTruthy();
  expect(within(overview).getByText("독살범 (4)")).toBeTruthy();
  expect(within(overview).getByText("임프 (5)")).toBeTruthy();
  expect(within(overview).getByText("낮 시작")).toBeTruthy();
  expect(within(overview).queryByText(/Dae|Eun|Faye|깨우기|블러프/)).toBeNull();

  const items = within(overview).getAllByRole("listitem");
  expect(items[0]?.textContent).toContain("완료");
  expect(items[1]?.textContent).toContain("건너뜀");
  expect(items[2]?.getAttribute("aria-current")).toBe("step");
  expect(items[2]?.textContent).toContain("현재");
  await waitFor(() =>
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" }),
  );
});

test("uses the acting shown role for a Drunk and keeps actorless night operations short", async () => {
  const playerRoster = players().map((candidate) =>
    candidate.id === "player-3"
      ? { ...candidate, actualCharacter: "drunk", shownCharacter: "fortuneTeller" }
      : candidate,
  );
  const drunkAction = step({
    id: "firstNight:fortuneTeller",
    character: "fortuneTeller",
    playerId: "player-3",
  });
  const announceDeaths = step({
    id: "night:announceDeaths",
    phase: "night",
    stepType: "announcement",
  });
  const toDay = step({
    id: "night:toDay",
    phase: "night",
    stepType: "phaseTransition",
    kind: "day",
  });
  const phaseOverview: PhaseOverviewItem[] = [
    { ...drunkAction, status: "current" },
    { ...announceDeaths, status: "waiting" },
    { ...toDay, status: "waiting" },
  ];

  renderLiveOverview(drunkAction, phaseOverview, playerRoster);

  await screen.findByRole("heading", { name: "점쟁이: 3번 Cy" });
  const overview = screen.getByRole("region", { name: "단계 개요" });
  expect(within(overview).getByText("점쟁이 (3)")).toBeTruthy();
  expect(within(overview).getByText("사망 발표")).toBeTruthy();
  expect(within(overview).getByText("낮 시작")).toBeTruthy();
  expect(within(overview).queryByText(/Cy|주정뱅이/)).toBeNull();
});

test.each([
  ["five", players()],
  ["six", [...players(), player("player-6", 6, "Faye", "washerwoman", "good")]],
])("keeps the existing %s-player evil-information steps but labels their single seats compactly", async (_size, playerRoster) => {
  const minionInfo = step({
    id: "firstNight:minionInfo",
    stepType: "evilInfo",
  });
  const demonInfo = step({
    id: "firstNight:demonInfo",
    stepType: "evilInfo",
  });
  const phaseOverview: PhaseOverviewItem[] = [
    { ...minionInfo, status: "current" },
    { ...demonInfo, status: "waiting" },
  ];

  renderLiveOverview(minionInfo, phaseOverview, playerRoster);

  await screen.findByRole("heading", { name: "하수인 정보" });
  const overview = screen.getByRole("region", { name: "단계 개요" });
  expect(within(overview).getByText("하수인 (4)")).toBeTruthy();
  expect(within(overview).getByText("악마 (5)")).toBeTruthy();
});

function renderLiveOverview(
  currentStep: ReturnType<typeof step>,
  phaseOverview: PhaseOverviewItem[],
  playerRoster: Player[],
) {
  const replay = replayState({ currentStep, phaseOverview, playerRoster });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused", currentStep.phase)),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

function player(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  alignment: Player["alignment"],
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
