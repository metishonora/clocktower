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
    name: "1번 좌석, 가람, 꿈꾸는 자, 토큰 2개",
  });
  expect(within(grimoire).getByText("+2")).toBeTruthy();
  expect(within(grimoire).queryByText("중독")).toBeNull();

  await user.click(tokenSeat);
  const detail = screen.getByRole("dialog", { name: "1번 가람 플레이어 상세" });
  expect(within(detail).getByText("꿈꾸는 자")).toBeTruthy();
  const tokens = within(detail).getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(tokens).getByLabelText("중독 · 출처 노 다시")).toBeTruthy();
  expect(within(tokens).getByRole("img", { name: "노 다시 출처" })).toBeTruthy();
  expect(within(tokens).getByLabelText("쌍둥이 · 출처 사악한 쌍둥이")).toBeTruthy();
  expect(within(detail).queryByText("현재 토큰")).toBeNull();
  expect(within(detail).queryByRole("button", { name: /저장|확정|추가|제거/ })).toBeNull();

  const close = within(detail).getByRole("button", { name: "플레이어 상세 닫기" });
  expect(document.activeElement).toBe(close);
  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(tokenSeat));
});

test("omits every token surface when a player has no tokens", async () => {
  const user = userEvent.setup();
  renderGrimoire({ tokensByPlayerId });

  const grimoire = screen.getByLabelText("낮 마도서");
  const emptySeat = within(grimoire).getByRole("button", {
    name: "2번 좌석, 나래, 변종, 토큰 없음",
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

function renderGrimoire({
  tokensByPlayerId: tokenPresentations = {},
  handoff,
  onSeatClick = vi.fn(),
}: {
  tokensByPlayerId?: PlayerTokensByPlayerId;
  handoff?: LiveHandoff;
  onSeatClick?: (playerId: string) => void;
} = {}) {
  return render(
    <SectsAndVioletsLiveGrimoire
      players={players}
      phaseLabel="2일차 낮"
      currentStep={dayStep}
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
