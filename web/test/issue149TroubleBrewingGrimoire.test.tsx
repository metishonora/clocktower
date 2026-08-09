import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameFile, Player, ReplayState, RuleState } from "../src/core/types";
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
  expect(detail.closest(".playerTokenDetailBackdrop")?.classList.contains("tbTheme")).toBe(true);
  expect(detail.classList.contains("playerTokenDetailDialog")).toBe(true);
  expect(within(detail).getByRole("heading", { name: "Ada" })).toBeTruthy();
  expect(within(detail).getByText("세탁부")).toBeTruthy();
  expect(within(detail).getByLabelText("현재 진영 · 선")).toBeTruthy();
  expect(within(detail).getByText("게임 시작 시, 플레이어 2명 중 1명이 특정 주민임을 알게 됩니다.")).toBeTruthy();
  expect(within(detail).getByRole("list", { name: "부착된 토큰 2개" })).toBeTruthy();
  expect(within(detail).getByText("능력 소모")).toBeTruthy();
  expect(within(detail).getByText("중독")).toBeTruthy();
  expect(within(detail).getByText("다음 낮에 능력 사용을 확인")).toBeTruthy();
  expect(within(detail).queryByRole("button", { name: "토큰 / Notes 편집" })).toBeNull();
  expect(within(detail).queryByLabelText("현재 상태")).toBeNull();

  await user.click(within(detail).getByRole("button", { name: "세탁부 캐릭터 상세 열기" }));
  const characterRules = screen.getByRole("dialog", { name: "세탁부 캐릭터 상세" });
  expect(characterRules.closest(".characterRulesBackdrop")?.classList.contains("tb-night")).toBe(true);
  expect(characterRules.closest(".characterRulesBackdrop")?.classList.contains("snv-night")).toBe(false);
});

test("uses the S&V center clock layout on the Trouble Brewing grimoire", async () => {
  const user = userEvent.setup();
  renderLiveGrimoire(players());

  const grimoire = await openLiveGrimoire(user);
  expect(screen.getByRole("navigation", { name: "게임 데이터" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "작업 단계" })).toBeTruthy();
  const toolbar = screen.getByLabelText("확정된 마도서 도구");
  expect(within(toolbar).getByRole("button", { name: "배치로 돌아가기" })).toBeTruthy();
  expect(within(toolbar).queryByText("1일차 밤")).toBeNull();
  expect(within(toolbar).queryByLabelText("현재 행동자 안내")).toBeNull();
  const center = grimoire.querySelector(".snvGrimoireCenter");
  expect(center?.classList.contains("issue116PhaseClock")).toBe(true);
  expect(center?.classList.contains("tbPhaseClock")).toBe(false);
  expect(center?.getAttribute("role")).toBe("group");
  expect(center?.getAttribute("aria-label")).toBe("현재 단계");
  expect(Array.from(center?.children ?? []).map((child) => child.tagName)).toEqual([
    "STRONG",
    "TIME",
    "BUTTON",
  ]);
});

test("presents the spent Virgin ability as the official no-ability token instead of V", async () => {
  const user = userEvent.setup();
  const playerRoster = players().map((player) => player.id === "player-1" ? {
    ...player,
    actualCharacter: "virgin",
    shownCharacter: "virgin",
  } : player);
  renderLiveGrimoire(playerRoster, {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: [{
      playerId: "player-1",
      characterId: "virgin",
      tokenId: "noAbility",
      label: "능력 없음",
      description: "성결자의 능력이 소모되었습니다.",
      sourceEventId: "event-nomination",
    }],
    virginAbility: {
      actorPlayerId: "player-1",
      spent: true,
      spentByNominationEventId: "event-nomination",
    },
  });

  const grimoire = await openLiveGrimoire(user);
  expect(within(grimoire).queryByLabelText("1번 Ada 성결자 능력 소모")).toBeNull();
  expect(within(grimoire).getByText("+1")).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ }));

  const detail = screen.getByRole("dialog", { name: "1번 Ada 플레이어 상세" });
  expect(within(detail).getByText("능력 없음")).toBeTruthy();
  expect(within(detail).getByRole("listitem", { name: /자동 규칙 · 능력 없음 · 출처 성결자/ })).toBeTruthy();
});

test("does not show a dedicated Slayer ability action beside the seat", async () => {
  const user = userEvent.setup();
  const playerRoster = players().map((player) => player.id === "player-1" ? {
    ...player,
    actualCharacter: "slayer",
    shownCharacter: "slayer",
  } : player);
  renderLiveGrimoire(playerRoster, {
    unannouncedNightDeathPlayerIds: [],
    slayerAbility: {
      actorPlayerId: "player-1",
      spent: false,
      canUseNow: true,
    },
  });

  const grimoire = await openLiveGrimoire(user);
  expect(within(grimoire).queryByRole("button", { name: "1번 Ada 처단자 능력 사용" })).toBeNull();
});

test("presents the spent Slayer ability as its official no-ability token", async () => {
  const user = userEvent.setup();
  const playerRoster = players().map((player) => player.id === "player-1" ? {
    ...player,
    actualCharacter: "slayer",
    shownCharacter: "slayer",
  } : player);
  renderLiveGrimoire(playerRoster, {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: [{
      playerId: "player-1",
      characterId: "slayer",
      tokenId: "noAbility",
      label: "능력 없음",
      description: "처단자의 능력이 소모되었습니다.",
    }],
    slayerAbility: {
      actorPlayerId: "player-1",
      spent: true,
      canUseNow: false,
    },
  });

  const grimoire = await openLiveGrimoire(user);
  expect(within(grimoire).queryByRole("button", { name: "1번 Ada 처단자 능력 사용" })).toBeNull();
  expect(within(grimoire).getByText("+1")).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ }));

  const detail = screen.getByRole("dialog", { name: "1번 Ada 플레이어 상세" });
  expect(within(detail).getByText("능력 없음")).toBeTruthy();
  expect(within(detail).getByRole("listitem", { name: /자동 규칙 · 능력 없음 · 출처 처단자/ })).toBeTruthy();
});

test("confirms a player target inside the S&V grimoire work panel", async () => {
  const user = userEvent.setup();
  renderStep(step({
    id: "firstNight:poisoner",
    character: "poisoner",
    playerId: "player-4",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  }));

  const progress = await screen.findByRole("region", { name: "현재 단계" });
  expect(within(progress).queryByRole("button", { name: "확정" })).toBeNull();
  await user.click(within(progress).getByRole("button", { name: "대상 선택" }));

  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  const toolbar = screen.getByLabelText("마도서 도구");
  expect(within(toolbar).queryByRole("button", { name: "배치로 돌아가기" })).toBeNull();
  expect(Array.from(toolbar.children).map((child) => child.tagName)).toEqual(["SPAN", "DIV", "BUTTON"]);
  expect(within(toolbar).getByText("1일차 밤")).toBeTruthy();
  expect(within(toolbar).getByLabelText("현재 행동자 안내")).toBeTruthy();
  expect(within(toolbar).getByRole("button", { name: "선택 취소 →" })).toBeTruthy();
  expect(within(toolbar).queryByRole("button", { name: "돌아가기 →" })).toBeNull();
  const target = within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ });
  await user.click(target);
  expect(target.classList.contains("snvSeatStateTarget")).toBe(true);
  expect(target.classList.contains("tbSeatStatePoison")).toBe(true);
  expect(target.classList.contains("snvSeatStateSelected")).toBe(false);
  expect(target.classList.contains("issue116SelectedSeat")).toBe(false);
  expect(within(target).getByText("중독")).toBeTruthy();
  expect(within(target).queryByText("세탁부")).toBeNull();
  expect(within(panel).getByRole("heading", { name: "독살범 능력" })).toBeTruthy();
  expect(within(panel).getByText("중독 대상")).toBeTruthy();

  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));
  await waitFor(() => expect(within(screen.getByRole("navigation", { name: "작업 단계" }))
    .getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page"));
});

test("describes the Fortune Teller action and numbers both targets without an actor row", async () => {
  const user = userEvent.setup();
  renderStep(step({
    id: "night:fortuneTeller",
    character: "fortuneTeller",
    playerId: "player-1",
    kind: "playerIds",
    target: "players",
    minSelections: 2,
    maxSelections: 2,
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: "대상 선택" }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "점쟁이 능력" })).toBeTruthy();
  expect(within(panel).queryByRole("heading", { name: "대상 선택" })).toBeNull();
  expect(within(panel).queryByText("행동자")).toBeNull();

  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, Bert/ }));
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, Cy/ }));
  expect(within(grimoire).getAllByText("선택")).toHaveLength(2);
  expect(within(grimoire).getByRole("button", { name: /2번 좌석.*선택/ }).classList.contains("tbSeatStateSelection")).toBe(true);
  expect(within(panel).getByText("첫 번째")).toBeTruthy();
  expect(within(panel).getByText("2번 Bert")).toBeTruthy();
  expect(within(panel).getByText("두 번째")).toBeTruthy();
  expect(within(panel).getByText("3번 Cy")).toBeTruthy();
});

test("uses the S&V numbered target summary for setup information", async () => {
  const user = userEvent.setup();
  renderStep(step({
    id: "firstNight:washerwoman",
    character: "washerwoman",
    playerId: "player-1",
    kind: "setupInfo",
    target: "players",
    minSelections: 2,
    maxSelections: 2,
    setupInfo: "washerwoman",
    characterKind: "Townsfolk",
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: /대상 선택/ }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "세탁부 능력" })).toBeTruthy();
  expect(within(panel).queryByText("행동자")).toBeNull();

  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ }));
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, Bert/ }));
  expect(within(panel).getByText("첫 번째")).toBeTruthy();
  expect(within(panel).getByText("1번 Ada")).toBeTruthy();
  expect(within(panel).getByText("두 번째")).toBeTruthy();
  expect(within(panel).getByText("2번 Bert")).toBeTruthy();

  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));
  await waitFor(() => expect(within(screen.getByRole("navigation", { name: "작업 단계" }))
    .getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page"));
});

test("uses attack semantics and a distinct attack highlight for the Imp", async () => {
  const user = userEvent.setup();
  renderStep(step({
    id: "night:imp",
    character: "imp",
    playerId: "player-4",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: "대상 선택" }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ });
  await user.click(target);

  expect(within(panel).getByRole("heading", { name: "임프 능력" })).toBeTruthy();
  expect(within(panel).getByText("공격 대상")).toBeTruthy();
  expect(within(target).getByText("공격")).toBeTruthy();
  expect(target.classList.contains("tbSeatStateAttack")).toBe(true);
  expect(target.classList.contains("tbSeatStatePoison")).toBe(false);
  expect(target.classList.contains("tbSeatStateSelection")).toBe(false);
});

test("uses the official red-herring reminder wording in the grimoire", async () => {
  const user = userEvent.setup();
  renderStep(step({
    id: "firstNight:fortuneTellerRedHerring",
    character: "fortuneTeller",
    playerId: "player-1",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: "대상 선택" }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /2번 좌석, Bert/ });
  await user.click(target);

  expect(within(panel).getByRole("heading", { name: "오답 대상 지정" })).toBeTruthy();
  expect(within(panel).getByText("오답 대상")).toBeTruthy();
  expect(within(target).getByText("오답 대상")).toBeTruthy();
});

test.each([
  { character: "librarian", title: "사서 능력" },
  { character: "investigator", title: "수사관 능력" },
] as const)("labels $character setup information as an ability", async ({ character, title }) => {
  const user = userEvent.setup();
  renderStep(step({
    id: `firstNight:${character}`,
    character,
    playerId: "player-1",
    kind: "setupInfo",
    target: "players",
    minSelections: 2,
    maxSelections: 2,
    setupInfo: character,
    characterKind: character === "librarian" ? "Outsider" : "Minion",
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: /대상 선택/ }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ });
  await user.click(target);

  expect(within(panel).getByRole("heading", { name: title })).toBeTruthy();
  expect(within(panel).getByText("첫 번째")).toBeTruthy();
  expect(within(target).getByText("선택")).toBeTruthy();
});

test.each([
  { character: "ravenkeeper", title: "까마귀지기 능력", field: "확인 대상", seat: "선택", stateClass: "tbSeatStateSelection" },
  { character: "monk", title: "수도사 능력", field: "보호 대상", seat: "보호", stateClass: "tbSeatStateSelection" },
  { character: "butler", title: "집사 능력", field: "주인", seat: "주인", stateClass: "tbSeatStateSelection" },
] as const)("uses semantic labels for the $character target", async ({ character, title, field, seat, stateClass }) => {
  const user = userEvent.setup();
  renderStep(step({
    id: `night:${character}`,
    character,
    playerId: "player-4",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  }));

  await user.click(within(await screen.findByRole("region", { name: "현재 단계" }))
    .getByRole("button", { name: "대상 선택" }));
  const panel = await screen.findByRole("complementary", { name: "현재 마도서 작업" });
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /1번 좌석, Ada/ });
  await user.click(target);

  expect(within(panel).getByRole("heading", { name: title })).toBeTruthy();
  expect(within(panel).getByText(field)).toBeTruthy();
  expect(within(target).getByText(seat)).toBeTruthy();
  expect(target.classList.contains(stateClass)).toBe(true);
});

test("runs nomination and vote through the S&V grimoire modes", async () => {
  const user = userEvent.setup();
  const nominationStep = step({
    id: "day:nomination:1",
    kind: "nomination",
    stepType: "nomination",
    phase: "day",
    canSkip: true,
  });
  renderStep(nominationStep, {
    nominations: [],
    executionVoteThreshold: 2,
    highestVoteCount: 0,
    eligibleNominatorIds: ["player-1", "player-4", "player-5"],
    eligibleNomineeIds: ["player-1", "player-4", "player-5"],
  } as ReplayState["dayState"]);

  await user.click(await screen.findByRole("button", { name: "← 지명하기" }));
  const nominationSurface = await screen.findByLabelText("Trouble Brewing 마도서 검토");
  expect(nominationSurface.classList.contains("issue116NominationMode")).toBe(true);
  const panel = within(nominationSurface).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(nominationSurface).getByRole("button", { name: /1번 좌석, Ada/ }));
  await user.click(within(nominationSurface).getByRole("button", { name: /4번 좌석, Dae/ }));
  expect(nominationSurface.querySelector(".issue116NominationArrow")).not.toBeNull();
  expect(within(panel).getByRole("button", { name: "1번 → 4번 지명 확정" })).toBeTruthy();
});

test("opens an active nomination vote directly in the S&V vote grimoire", async () => {
  const voteStep = step({
    id: "day:nomination:1:vote",
    kind: "nominationVote",
    stepType: "nomination",
    phase: "day",
    canSkip: true,
  });
  renderStep(voteStep, {
    nominations: [],
    activeNomination: {
      eventId: "event-nomination",
      stepId: "day:nomination:1",
      nominatorId: "player-1",
      nomineeId: "player-4",
    },
    executionVoteThreshold: 2,
    highestVoteCount: 0,
    eligibleNominatorIds: ["player-1", "player-4", "player-5"],
    eligibleNomineeIds: ["player-1", "player-4", "player-5"],
  } as ReplayState["dayState"]);

  const surface = await screen.findByLabelText("Trouble Brewing 마도서 검토");
  expect(surface.classList.contains("issue116VoteMode")).toBe(true);
  const panel = within(surface).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByText("처형 기준 2표")).toBeTruthy();
  expect(within(panel).getByRole("button", { name: "0표로 투표 확정" })).toBeTruthy();
});

test("starts a fresh game after one S&V-style confirmation and clears the selected roles", async () => {
  const user = userEvent.setup();
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });
  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  await waitFor(() => expect((screen.getByRole("button", { name: "새 게임" }) as HTMLButtonElement).disabled).toBe(false));
  await user.click(screen.getByRole("button", { name: "새 게임" }));
  const dialog = await screen.findByRole("dialog", { name: "새 게임 시작 확인" });
  await user.click(within(dialog).getByRole("button", { name: "새 게임 시작" }));

  const setup = screen.getByRole("main", { name: "Trouble Brewing 게임 설정" });
  expect(within(setup).getByRole("button", { name: "세탁부" }).getAttribute("aria-pressed")).toBe("false");
  expect((within(setup).getByRole("button", { name: "마도서" }) as HTMLButtonElement).disabled).toBe(true);
});

test("returns from progressed play to preserved seating after the S&V-style confirmation", async () => {
  const user = userEvent.setup();
  const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
  const replay = replayState({ currentStep, eventCount: 2 });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });
  const storage = new MemoryGameStorageDriver(progressedGameFile());
  render(<ClocktowerApp coreAdapter={core} storageDriver={storage} />);

  const grimoire = await openLiveGrimoire(user);
  await user.click(within(grimoire.closest("section")!).getByRole("button", { name: "배치로 돌아가기" }));
  const dialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  expect(within(dialog).getByText("좌석 이름과 직업 배치는 유지됩니다.", { exact: false })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "초기화하고 돌아가기" }));

  expect(await screen.findByLabelText("Trouble Brewing 마도서 배치")).toBeTruthy();
  expect(screen.getByDisplayValue("Ada")).toBeTruthy();
  expect(screen.getByRole("button", { name: /1번 좌석.*세탁부/ })).toBeTruthy();
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(0));
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

function renderLiveGrimoire(playerRoster: Player[], ruleState?: RuleState) {
  const currentStep = step({
    id: "firstNight:washerwoman",
    character: "washerwoman",
    playerId: "player-1",
  });
  const replay = {
    ...replayState({ currentStep, playerRoster }),
    ...(ruleState ? { ruleState } : {}),
  };
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replayAfterAnnotation(replay),
    proposal: proposal(event("event-annotations", "플레이어 표시 수정")),
  });
  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

function renderStep(currentStep: ReturnType<typeof step>, dayState?: ReplayState["dayState"]) {
  const replay = replayState({ currentStep, dayState });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: { ...replay, eventCount: replay.eventCount + 1 },
    proposal: proposal(event("event-confirm", "단계 확정", currentStep.phase)),
  });
  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

function replayAfterAnnotation(replay: ReplayState): ReplayState {
  return { ...replay, eventCount: replay.eventCount + 1 };
}

function progressedGameFile(): GameFile {
  const stored = gameFile();
  return {
    ...stored,
    game: {
      ...stored.game,
      events: [...stored.game.events, event("event-progress", "첫 단계 완료")],
    },
  };
}
