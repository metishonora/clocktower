import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Player, ReplayState } from "../src/core/types";
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
import { openLiveGrimoire } from "./livePlayTestHelpers";

test("uses the S&V player-detail hierarchy for Trouble Brewing tokens and Notes", async () => {
  const user = userEvent.setup();
  const playerRoster = players().map((player) => player.id === "player-1" ? {
    ...player,
    systemTokenIds: ["abilitySpent" as const],
    scriptTokens: [{ characterId: "poisoner", tokenId: "poisoned" }],
    notes: "다음 낮에 능력 사용을 확인",
  } : player);
  renderLiveGrimoire(playerRoster);

  const grimoire = await openLiveGrimoire(user);
  const seat = within(grimoire).getByRole("button", { name: /1번 좌석, Ada.*토큰 2개/ });
  expect(within(grimoire).getByText("+2")).toBeTruthy();
  await user.click(seat);

  const detail = screen.getByRole("dialog", { name: "1번 Ada 플레이어 상세" });
  expect(detail.classList.contains("playerTokenDetailDialog")).toBe(true);
  expect(within(detail).getByRole("heading", { name: "Ada" })).toBeTruthy();
  expect(within(detail).getByText("세탁부")).toBeTruthy();
  expect(within(detail).getByLabelText("현재 진영 · 선")).toBeTruthy();
  expect(within(detail).getByText("게임 시작 시, 플레이어 2명 중 1명이 특정 주민임을 알게 됩니다.")).toBeTruthy();
  expect(within(detail).getByRole("list", { name: "부착된 토큰 2개" })).toBeTruthy();
  expect(within(detail).getByText("능력 소모")).toBeTruthy();
  expect(within(detail).getByText("중독")).toBeTruthy();
  expect(within(detail).getByText("다음 낮에 능력 사용을 확인")).toBeTruthy();
  expect(within(detail).getByRole("button", { name: "토큰 / Notes 편집" })).toBeTruthy();
  expect(within(detail).queryByLabelText("현재 상태")).toBeNull();

  await user.click(within(detail).getByRole("button", { name: "토큰 / Notes 편집" }));
  expect(screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" })).toBeTruthy();
});

test("shows Drunk actual and shown identities in the shared detail and restores seat focus", async () => {
  const user = userEvent.setup();
  const playerRoster = players().map((player) => player.id === "player-3" ? {
    ...player,
    actualCharacter: "drunk",
    shownCharacter: "fortuneTeller",
  } : player);
  renderLiveGrimoire(playerRoster);

  const grimoire = await openLiveGrimoire(user);
  const seat = within(grimoire).getByRole("button", { name: /3번 좌석, Cy, 실제 주정뱅이, 표시 점쟁이/ });
  expect(within(seat).getByRole("img", { name: "보여준 직업 점쟁이 토큰" })).toBeTruthy();
  await user.click(seat);

  const detail = screen.getByRole("dialog", { name: "3번 Cy 플레이어 상세" });
  const identities = within(detail).getByRole("region", { name: "주정뱅이 아이덴티티" });
  expect(within(identities).getByText("실제 직업")).toBeTruthy();
  expect(within(identities).getByText("보여준 직업")).toBeTruthy();
  expect(within(identities).getByText("주정뱅이")).toBeTruthy();
  expect(within(identities).getByText("점쟁이")).toBeTruthy();

  await user.click(within(detail).getByRole("button", { name: "플레이어 상세 닫기" }));
  await waitFor(() => expect(document.activeElement).toBe(seat));
});

test("keeps S&V death and ghost-vote state semantics on Trouble Brewing seats", async () => {
  const user = userEvent.setup();
  renderLiveGrimoire(players());

  const grimoire = await openLiveGrimoire(user);
  const currentActor = within(grimoire).getByRole("button", { name: /1번 좌석, Ada.*현재 행동자/ });
  const ghostVoteAvailable = within(grimoire).getByRole("button", {
    name: /2번 좌석, Bert.*사망 · 유령표 남음/,
  });
  const ghostVoteSpent = within(grimoire).getByRole("button", {
    name: /3번 좌석, Cy.*사망 · 유령표 사용됨/,
  });
  expect(currentActor.classList.contains("snvSeatStateActor")).toBe(true);
  expect(ghostVoteAvailable.classList.contains("snvDeadSeat")).toBe(true);
  expect(ghostVoteSpent.classList.contains("snvDeadSeat")).toBe(true);
  expect(ghostVoteAvailable.querySelector(".snvFuneralIcon")).not.toBeNull();
  expect(ghostVoteSpent.querySelector(".snvFuneralIcon")).not.toBeNull();
});

function renderLiveGrimoire(playerRoster: Player[]) {
  const currentStep = step({
    id: "firstNight:washerwoman",
    character: "washerwoman",
    playerId: "player-1",
  });
  const replay = replayState({ currentStep, playerRoster });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replayAfterAnnotation(replay),
    proposal: proposal(event("event-annotations", "플레이어 표시 수정")),
  });
  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

function replayAfterAnnotation(replay: ReplayState): ReplayState {
  return { ...replay, eventCount: replay.eventCount + 1 };
}
