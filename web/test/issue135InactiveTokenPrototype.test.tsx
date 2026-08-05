import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue135InactiveTokenPrototype } from "../src/issue135InactiveTokenPrototype";

test("keeps an inactive token in the seat count and marks it only in player details", async () => {
  const user = userEvent.setup();
  render(<Issue135InactiveTokenPrototype />);

  await user.click(screen.getByRole("button", { name: "2 · 노 다시 취함" }));
  const grimoire = screen.getByRole("region", { name: "낮 마도서" });
  const targetSeat = within(grimoire).getByRole("button", { name: /1번 유나 좌석, 꿈꾸는 자, 토큰 2개/ });
  expect(within(targetSeat).getByText("+2")).toBeTruthy();

  const detail = screen.getByRole("dialog", { name: "1번 유나 플레이어 상세" });
  const tokens = within(detail).getByRole("list", { name: "부착된 토큰 2개" });
  const inactivePoison = within(tokens).getByLabelText(/중독 · 출처 노 다시 · 현재 효력 없음/);
  expect(inactivePoison.querySelector(".playerInactiveTokenX")).toBeTruthy();
  expect(within(tokens).getByLabelText("쌍둥이 · 출처 사악한 쌍둥이").querySelector(".playerInactiveTokenX")).toBeNull();
});

test("moves the inactive token when the deterministic target changes and removes only X on recovery", async () => {
  const user = userEvent.setup();
  render(<Issue135InactiveTokenPrototype />);

  await user.click(screen.getByRole("button", { name: "3 · 대상 직업 변경" }));
  const movedDetail = screen.getByRole("dialog", { name: "3번 지우 플레이어 상세" });
  const movedTokens = within(movedDetail).getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(movedTokens).getByLabelText(/중독 · 출처 노 다시 · 현재 효력 없음/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /1번 유나 좌석, 변종, 토큰 1개/ })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "4 · 취함 해제" }));
  const restoredDetail = screen.getByRole("dialog", { name: "3번 지우 플레이어 상세" });
  const restoredTokens = within(restoredDetail).getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(restoredTokens).getByLabelText("중독 · 출처 노 다시").querySelector(".playerInactiveTokenX")).toBeNull();
});
