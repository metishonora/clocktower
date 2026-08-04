import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { AvailableDayAction, Player } from "../src/core/types";
import { DayActionDock } from "../src/features/day-actions/DayActionDock";

const players: Player[] = [
  player("player-1", 1, "민지", "savant"),
  player("player-2", 2, "현우", "artist"),
  player("player-3", 3, "서준", "juggler"),
];

const availableActions: AvailableDayAction[] = [
  { actorPlayerId: "player-1", characterId: "savant", dayId: "day", activeReasons: [] },
  { actorPlayerId: "player-2", characterId: "artist", dayId: "day", activeReasons: [] },
  { actorPlayerId: "player-3", characterId: "juggler", dayId: "day", activeReasons: [] },
];

test("Savant records two optional Storyteller-authored statements and their truth values", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <DayActionDock
      players={players}
      availableActions={[...availableActions]}
      phaseLabel="2일차 낮"
      busy={false}
      onConfirm={onConfirm}
    />,
  );

  await user.click(screen.getByRole("button", { name: "백치천재 행동 열기, 1번 민지" }));
  const panel = screen.getByRole("dialog", { name: "백치천재 능력 사용" });
  expect(panel.getAttribute("aria-modal")).toBeNull();
  expect(screen.getByRole("button", { name: "백치천재 행동 창 닫기" })).toBeTruthy();
  expect(within(panel).queryByText(/두 가지 정보를 적고/)).toBeNull();
  await user.type(within(panel).getByRole("textbox", { name: "정보 1" }), "악마는 홀수 좌석에 있습니다.");
  const truthGroups = within(panel).getAllByRole("group");
  await user.click(within(truthGroups[0]).getByRole("button", { name: "진실" }));
  await user.click(within(truthGroups[1]).getByRole("button", { name: "거짓" }));
  await user.click(within(panel).getByRole("button", { name: "정보 전달" }));
  expect(onConfirm).toHaveBeenCalledWith(
    availableActions[0],
    {
      kind: "savant",
      statements: [
        { text: "악마는 홀수 좌석에 있습니다.", truthful: true },
        { text: "", truthful: false },
      ],
    },
  );
});

test("Artist and Juggler submit only their approved compact records", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <DayActionDock
      players={players}
      availableActions={[...availableActions]}
      phaseLabel="2일차 낮"
      busy={false}
      onConfirm={onConfirm}
    />,
  );

  await user.click(screen.getByRole("button", { name: "화가 행동 열기, 2번 현우" }));
  const artist = screen.getByRole("dialog", { name: "화가 능력 사용" });
  expect(artist.classList.contains("snvDayActionPanel--artist")).toBe(true);
  await user.clear(within(artist).getByRole("textbox", { name: "질문" }));
  await user.type(within(artist).getByRole("textbox", { name: "질문" }), "악마가 홀수 번호 좌석에 있나요?");
  await user.click(within(artist).getByRole("button", { name: "X 아니오" }));
  await user.click(within(artist).getByRole("button", { name: "정보 전달" }));
  expect(onConfirm).toHaveBeenLastCalledWith(availableActions[1], {
    kind: "artist",
    question: "악마가 홀수 번호 좌석에 있나요?",
    answer: "no",
    truthful: true,
  });

  await user.click(screen.getByRole("button", { name: "곡예사 행동 열기, 3번 서준" }));
  const juggler = screen.getByRole("dialog", { name: "곡예사 능력 사용" });
  expect(within(juggler).getByText("정답 개수")).toBeTruthy();
  expect(within(juggler).queryByText("공개 추측은 별도로 기록하지 않습니다.")).toBeNull();
  await user.click(within(juggler).getByRole("button", { name: "3" }));
  await user.click(within(juggler).getByRole("button", { name: "첫 낮 추측 완료" }));
  expect(onConfirm).toHaveBeenLastCalledWith(availableActions[2], {
    kind: "juggler",
    correctCount: 3,
  });
});

test("Vortox wins the influence priority and locks false Storyteller judgments", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const vortoxArtist = {
    ...availableActions[1],
    activeReasons: [
      { type: "drunk" as const },
      { type: "poisoned" as const, poisonerPlayerId: "player-9", poisonEventId: "poison-1" },
      { type: "vortox" as const, demonPlayerId: "player-7" },
    ],
  };
  render(<DayActionDock players={players} availableActions={[vortoxArtist]} phaseLabel="2일차 낮" busy={false} onConfirm={onConfirm} />);

  await user.click(screen.getByRole("button", { name: "화가 행동 열기, 2번 현우" }));
  const panel = screen.getByRole("dialog", { name: "화가 능력 사용" });
  expect(within(panel).getByText("보르톡스")).toBeTruthy();
  expect(within(panel).queryByText("중독")).toBeNull();
  expect(within(panel).queryByText("취함")).toBeNull();
  const falseButton = within(panel).getByRole("button", { name: "거짓" });
  expect(falseButton.getAttribute("aria-pressed")).toBe("true");
  expect(falseButton.hasAttribute("disabled")).toBe(true);
  await user.click(within(panel).getByRole("button", { name: "? 모르겠음" }));
  await user.click(within(panel).getByRole("button", { name: "거짓 정보 전달" }));
  expect(onConfirm).toHaveBeenCalledWith(vortoxArtist, {
    kind: "artist",
    question: "",
    answer: "unknown",
    truthful: false,
  });
});

test("an acquired day action keeps Philosopher as the actor and owns its role in the ability card", async () => {
  const user = userEvent.setup();
  const philosopher = player("player-4", 4, "하린", "philosopher");
  const artistAction: AvailableDayAction = {
    actorPlayerId: philosopher.id,
    characterId: "artist",
    dayId: "day",
    activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-9", poisonEventId: "poison-1" }],
  };
  render(
    <DayActionDock
      players={[philosopher]}
      availableActions={[artistAction]}
      phaseLabel="2일차 낮"
      busy={false}
      onConfirm={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "화가 행동 열기, 4번 하린" }));
  const panel = screen.getByRole("dialog", { name: "화가 능력 사용" });
  expect(within(panel).getByRole("button", { name: "철학자 캐릭터 상세 열기" })).toBeTruthy();
  expect(within(panel).getByRole("heading", { level: 2, name: "철학자" })).toBeTruthy();
  const ability = within(panel).getByRole("button", { name: "화가 캐릭터 상세 열기" });
  expect(within(ability).getByText("획득한 능력")).toBeTruthy();
  expect(within(ability).getByText("화가")).toBeTruthy();
  expect(within(ability).getByText("중독")).toBeTruthy();
});

test("shows an actor impairment on the Juggler day action without changing its record contract", async () => {
  const user = userEvent.setup();
  render(
    <DayActionDock
      players={players}
      availableActions={[availableActions[2]]}
      activeImpairments={[{
        kind: "drunk",
        playerId: "player-3",
        sourceEventId: "philosopher-copy",
        sourceCharacterId: "philosopher",
        expires: "whileSourceAbilityActive",
      }]}
      phaseLabel="첫 낮"
      busy={false}
      onConfirm={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "곡예사 행동 열기, 3번 서준" }));
  expect(within(screen.getByRole("dialog", { name: "곡예사 능력 사용" })).getByText("취함")).toBeTruthy();
});

function player(id: string, seat: number, name: string, character: string): Player {
  return {
    id,
    seat,
    name,
    actualCharacter: character,
    shownCharacter: character,
    alignment: "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
