import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue121TokenOverviewPrototype } from "../src/issue121TokenOverviewPrototype";

test("shows inward token badges on every seat for each supported player count", async () => {
  const user = userEvent.setup();
  render(<Issue121TokenOverviewPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 121 토큰 표시 프로토타입" });
  const playerCount = within(prototype).getByRole("combobox", { name: "프로토타입 인원" });

  for (let count = 5; count <= 15; count += 1) {
    await user.selectOptions(playerCount, String(count));
    const grimoire = within(prototype).getByRole("region", { name: "평상시 마도서 overview" });
    expect(within(grimoire).getAllByRole("button", { name: /좌석, .*토큰 \d+개/ })).toHaveLength(count);
    expect(within(grimoire).getAllByText(/^\+\d+$/)).toHaveLength(count);
  }
});

test("pins complete tokens with their source character icons inside player details", async () => {
  const user = userEvent.setup();
  render(<Issue121TokenOverviewPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 121 토큰 표시 프로토타입" });
  const grimoire = within(prototype).getByRole("region", { name: "평상시 마도서 overview" });

  expect(within(grimoire).getByRole("button", { name: /4번 지우 좌석, 시계공, 토큰 1개/ })).toBeTruthy();
  expect(within(grimoire).getByRole("button", { name: /6번 유나 좌석, 꿈꾸는 자, 토큰 2개/ })).toBeTruthy();
  expect(within(grimoire).getAllByText("+1").length).toBeGreaterThan(0);
  expect(within(grimoire).getByText("+2")).toBeTruthy();
  expect(within(grimoire).queryByText("중독")).toBeNull();
  expect(within(grimoire).queryByText("쌍둥이")).toBeNull();

  await user.click(within(grimoire).getByRole("button", { name: /6번 유나 좌석/ }));

  const detail = within(prototype).getByRole("dialog", { name: "6번 유나 플레이어 상세" });
  expect(within(detail).getByRole("heading", { name: "유나" })).toBeTruthy();
  expect(within(detail).getByText("꿈꾸는 자")).toBeTruthy();
  const tokens = within(detail).getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(tokens).getByLabelText("중독 · 출처 노 다시")).toBeTruthy();
  expect(within(tokens).getByLabelText("쌍둥이 · 출처 사악한 쌍둥이")).toBeTruthy();
  expect(within(tokens).getByRole("img", { name: "노 다시 출처" })).toBeTruthy();
  expect(within(tokens).getByRole("img", { name: "사악한 쌍둥이 출처" })).toBeTruthy();
  expect(within(detail).queryByText("현재 토큰")).toBeNull();
  expect(within(detail).queryByRole("button", { name: /저장|확정|추가|제거/ })).toBeNull();
});

test("hides token affordances and player details during nomination, voting, and attack work", async () => {
  const user = userEvent.setup();
  render(<Issue121TokenOverviewPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 121 토큰 표시 프로토타입" });
  await user.click(within(prototype).getByRole("button", { name: "지명 · 투표 · 공격" }));
  const grimoire = within(prototype).getByRole("region", { name: "액션 선택 마도서" });

  expect(within(grimoire).queryByText("+1")).toBeNull();
  expect(within(grimoire).queryByText("+2")).toBeNull();
  expect(within(grimoire).queryByLabelText(/토큰 \d+개/)).toBeNull();

  await user.click(within(grimoire).getByRole("button", { name: /6번 유나 선택/ }));
  expect(within(prototype).queryByRole("dialog", { name: /플레이어 상세/ })).toBeNull();
  expect(within(grimoire).getByRole("button", { name: /6번 유나 선택됨/ })).toBeTruthy();
});

test("keeps keyboard focus inside the player detail and returns it to the originating seat", async () => {
  const user = userEvent.setup();
  render(<Issue121TokenOverviewPrototype />);

  const seat = screen.getByRole("button", { name: /6번 유나 좌석/ });
  await user.click(seat);
  const close = screen.getByRole("button", { name: "플레이어 상세 닫기" });
  expect(document.activeElement).toBe(close);

  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "6번 유나 플레이어 상세" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(seat));
});
