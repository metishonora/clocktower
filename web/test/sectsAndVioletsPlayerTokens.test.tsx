import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { PhaseStep } from "../src/core/types";
import type { PlayerTokensByPlayerId } from "../src/features/grimoire/playerTokenPresentation";
import {
  SectsAndVioletsLiveGrimoire,
  type LiveHandoff,
  type LivePlayer,
} from "../src/sectsAndVioletsLivePhase";

const players: LivePlayer[] = [
  livePlayer("player-1", 1, "가람", "dreamer", "꿈꾸는 자", "townsfolk"),
  livePlayer("player-2", 2, "나래", "mutant", "변종", "outsider"),
];

const tokensByPlayerId: PlayerTokensByPlayerId = {
  "player-1": [
    {
      instanceId: "no-dashii-poison",
      label: "중독",
      sourceLabel: "노 다시",
      sourceIconSrc: "/assets/characters/snv/nodashii_e.webp",
      visualKind: "impairment",
      description: "노 다시에게 가장 가까운 주민입니다.",
    },
    {
      instanceId: "evil-twin-pair",
      label: "쌍둥이",
      sourceLabel: "사악한 쌍둥이",
      sourceIconSrc: "/assets/characters/snv/eviltwin_e.webp",
      visualKind: "relationship",
    },
  ],
  "player-2": [],
};

test("shows only an inward count in the overview and pins complete source tokens in player details", async () => {
  const user = userEvent.setup();
  renderGrimoire({ tokensByPlayerId });

  const grimoire = screen.getByLabelText("낮 마도서");
  const tokenSeat = within(grimoire).getByRole("button", {
    name: "1번 좌석, 가람, 꿈꾸는 자, 토큰 2개, 생존",
  });
  const countBadge = within(grimoire).getByText("+2");
  expect(countBadge.classList.contains("day")).toBe(true);
  expect(within(grimoire).queryByText("중독")).toBeNull();

  await user.click(tokenSeat);
  const detail = screen.getByRole("dialog", { name: "1번 가람 플레이어 상세" });
  expect(within(detail).getByText("꿈꾸는 자")).toBeTruthy();
  const tokenArea = within(detail).getByRole("region", { name: "부착된 토큰" });
  expect(tokenArea.classList.contains("day")).toBe(true);
  const tokens = within(tokenArea).getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(tokens).getByLabelText("중독 · 출처 노 다시")).toBeTruthy();
  expect(within(tokens).getByRole("img", { name: "노 다시 출처" })).toBeTruthy();
  expect(within(tokens).getByLabelText("쌍둥이 · 출처 사악한 쌍둥이")).toBeTruthy();
  expect(within(detail).queryByText("현재 토큰")).toBeNull();
  expect(within(detail).queryByRole("button", { name: /저장|확정|추가|제거/ })).toBeNull();

  const characterTrigger = within(detail).getByRole("button", { name: "꿈꾸는 자 캐릭터 상세 열기" });
  expect(within(characterTrigger).getByRole("img", { name: "꿈꾸는 자 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(within(characterTrigger).getByText("꿈꾸는 자")).toBeTruthy();
  expect(characterTrigger.textContent).not.toContain("ⓘ");
  await user.click(characterTrigger);

  const characterDetail = screen.getByRole("dialog", { name: "꿈꾸는 자 캐릭터 상세" });
  expect(within(characterDetail).getByText("공식 능력")).toBeTruthy();
  expect(within(characterDetail).getByText("핵심 판정")).toBeTruthy();
  expect(within(characterDetail).getByText("진행 방법")).toBeTruthy();
  expect(within(characterDetail).getByText("공식 예시 4개 보기").closest("details")?.hasAttribute("open")).toBe(false);
  expect(within(characterDetail).queryByText("자동화 지원")).toBeNull();
  expect(screen.getByRole("dialog", { name: "1번 가람 플레이어 상세" })).toBe(detail);

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "꿈꾸는 자 캐릭터 상세" })).toBeNull();
  expect(document.activeElement).toBe(characterTrigger);

  const close = within(detail).getByRole("button", { name: "플레이어 상세 닫기" });
  expect(document.activeElement).toBe(characterTrigger);
  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(tokenSeat));
});

test("keeps count badges and pinned tokens on the night theme at night", async () => {
  const user = userEvent.setup();
  renderGrimoire({
    tokensByPlayerId,
    currentStep: { ...dayStep, id: "night:manual", phase: "night" },
  });

  const grimoire = screen.getByLabelText("밤 마도서");
  expect(within(grimoire).getByText("+2").classList.contains("night")).toBe(true);

  await user.click(within(grimoire).getByRole("button", {
    name: "1번 좌석, 가람, 꿈꾸는 자, 토큰 2개, 생존",
  }));
  const detail = screen.getByRole("dialog", { name: "1번 가람 플레이어 상세" });
  expect(within(detail).getByRole("region", { name: "부착된 토큰" }).classList.contains("night")).toBe(true);
});

test("omits every token surface when a player has no tokens", async () => {
  const user = userEvent.setup();
  renderGrimoire({ tokensByPlayerId });

  const grimoire = screen.getByLabelText("낮 마도서");
  const emptySeat = within(grimoire).getByRole("button", {
    name: "2번 좌석, 나래, 변종, 토큰 없음, 생존",
  });
  await user.click(emptySeat);

  const detail = screen.getByRole("dialog", { name: "2번 나래 플레이어 상세" });
  expect(within(detail).getByText("변종")).toBeTruthy();
  expect(within(detail).queryByRole("region", { name: "부착된 토큰" })).toBeNull();
  expect(within(detail).queryByText(/토큰 없음|현재 토큰/)).toBeNull();
});

test("hides token affordances and keeps seat clicks in action selection mode", async () => {
  const user = userEvent.setup();
  const onSeatClick = vi.fn();
  renderGrimoire({
    tokensByPlayerId,
    handoff: { kind: "demon", complete: false },
    onSeatClick,
  });

  const grimoire = screen.getByLabelText("낮 마도서");
  expect(within(grimoire).queryByText("+2")).toBeNull();
  expect(within(grimoire).queryByLabelText(/토큰 \d+개/)).toBeNull();

  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 가람, 꿈꾸는 자/ }));
  expect(onSeatClick).toHaveBeenCalledWith("player-1");
  expect(screen.queryByRole("dialog", { name: /플레이어 상세/ })).toBeNull();
});

test("keeps the completed Demon handoff actor highlighted until Next", () => {
  const handoffPlayers: LivePlayer[] = [
    livePlayer("demon", 1, "악마", "fangGu", "팡 구", "demon"),
    livePlayer("next", 2, "다음 행동자", "dreamer", "꿈꾸는 자", "townsfolk"),
  ];
  const nextStep: PhaseStep = {
    id: "night:dreamer",
    phase: "night",
    stepType: "character",
    character: "dreamer",
    playerId: "next",
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
    support: "manual",
  };

  renderGrimoire({
    players: handoffPlayers,
    currentStep: nextStep,
    handoff: { kind: "demon", complete: true, actorPlayerId: "demon" },
  });

  const grimoire = screen.getByLabelText("밤 마도서");
  expect(within(grimoire).getByRole("button", { name: /1번 좌석.*현재 행동자/ })).toBeTruthy();
  expect(within(grimoire).queryByRole("button", { name: /2번 좌석.*현재 행동자/ })).toBeNull();
  expect(within(grimoire).getByRole("button", { name: "다음 →" })).toBeTruthy();
});

function renderGrimoire({
  players: visiblePlayers = players,
  currentStep = dayStep,
  tokensByPlayerId: tokenPresentations = {},
  handoff,
  onSeatClick = vi.fn(),
}: {
  players?: LivePlayer[];
  currentStep?: PhaseStep | null;
  tokensByPlayerId?: PlayerTokensByPlayerId;
  handoff?: LiveHandoff;
  onSeatClick?: (playerId: string) => void;
} = {}) {
  return render(
    <SectsAndVioletsLiveGrimoire
      players={visiblePlayers}
      phaseLabel="2일차 낮"
      currentStep={currentStep}
      handoff={handoff}
      voterIds={[]}
      operationBusy={false}
      tokensByPlayerId={tokenPresentations}
      onSeatClick={onSeatClick}
      onConfirm={vi.fn()}
      onReturn={vi.fn()}
      onCancelDayHandoff={vi.fn()}
      onResetDaySelection={vi.fn()}
      onGoToProgress={vi.fn()}
      onReturnToSetup={vi.fn()}
    />,
  );
}

const dayStep: PhaseStep = {
  id: "day:manual",
  phase: "day",
  stepType: "discussion",
  requiredInput: { kind: "none", optional: false },
  canSkip: false,
  support: "manual",
};

function livePlayer(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  characterName: string,
  characterKind: LivePlayer["characterKind"],
): LivePlayer {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    characterName,
    characterKind,
    alignment: characterKind === "minion" || characterKind === "demon" ? "evil" : "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
