import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Player } from "../src/core/types";
import { DayActionDock } from "../src/features/day-actions/DayActionDock";

const players: Player[] = [
  player("player-1", 1, "민지", "savant"),
  player("player-2", 2, "현우", "artist"),
  player("player-3", 3, "서준", "juggler"),
];

const availableActions = [
  { actorPlayerId: "player-1", characterId: "savant", dayId: "day" },
  { actorPlayerId: "player-2", characterId: "artist", dayId: "day" },
  { actorPlayerId: "player-3", characterId: "juggler", dayId: "day" },
] as const;

const savantCategories = [
  {
    title: "악마 좁히기",
    references: [
      { id: "demon-player", text: "현재 악마는 준호입니다." },
      { id: "demon-character", text: "현재 악마의 캐릭터는 보르톡스입니다." },
      { id: "demon-pair", text: "준호와 유나 중 한 명은 악마입니다." },
    ],
  },
];

test("Savant selects zero to two reference sentences in a cancellable non-modal floating panel", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <DayActionDock
      players={players}
      availableActions={[...availableActions]}
      phaseLabel="2일차 낮"
      savantCategories={savantCategories}
      busy={false}
      onConfirm={onConfirm}
    />,
  );

  await user.click(screen.getByRole("button", { name: "백치천재 행동 열기, 1번 민지" }));
  const panel = screen.getByRole("dialog", { name: "백치천재 능력 사용" });
  expect(panel.getAttribute("aria-modal")).toBeNull();
  expect(screen.getByRole("button", { name: "백치천재 행동 창 닫기" })).toBeTruthy();
  expect(within(panel).getByRole("heading", { name: "악마 좁히기" })).toBeTruthy();

  await user.click(within(panel).getByRole("button", { name: "현재 악마는 준호입니다." }));
  await user.click(within(panel).getByRole("button", { name: "현재 악마의 캐릭터는 보르톡스입니다." }));
  expect(within(panel).getByRole("button", { name: "준호와 유나 중 한 명은 악마입니다." }).hasAttribute("disabled")).toBe(true);

  await user.click(within(panel).getByRole("button", { name: "오늘 정보 전달 완료" }));
  expect(onConfirm).toHaveBeenCalledWith(
    availableActions[0],
    {
      kind: "savant",
      referenceSentences: [
        "현재 악마는 준호입니다.",
        "현재 악마의 캐릭터는 보르톡스입니다.",
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
      savantCategories={savantCategories}
      busy={false}
      onConfirm={onConfirm}
    />,
  );

  await user.click(screen.getByRole("button", { name: "화가 행동 열기, 2번 현우" }));
  const artist = screen.getByRole("dialog", { name: "화가 능력 사용" });
  expect(artist.classList.contains("snvDayActionPanel--artist")).toBe(true);
  await user.clear(within(artist).getByRole("textbox", { name: "질문" }));
  await user.type(within(artist).getByRole("textbox", { name: "질문" }), "악마가 홀수 번호 좌석에 있나요?");
  await user.click(within(artist).getByRole("button", { name: "아니오" }));
  await user.click(within(artist).getByRole("button", { name: "질문과 답변 기록" }));
  expect(onConfirm).toHaveBeenLastCalledWith(availableActions[1], {
    kind: "artist",
    question: "악마가 홀수 번호 좌석에 있나요?",
    answer: "no",
  });

  await user.click(screen.getByRole("button", { name: "곡예사 행동 열기, 3번 서준" }));
  const juggler = screen.getByRole("dialog", { name: "곡예사 능력 사용" });
  await user.click(within(juggler).getByRole("button", { name: "3" }));
  await user.click(within(juggler).getByRole("button", { name: "첫 낮 추측 완료" }));
  expect(onConfirm).toHaveBeenLastCalledWith(availableActions[2], {
    kind: "juggler",
    correctCount: 3,
  });
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
