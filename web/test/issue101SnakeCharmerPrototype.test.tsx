import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue101SnakeCharmerPrototype } from "../src/issue101SnakeCharmerPrototype";

test("shows the two private identity reveals in order, then the canonical poison token", async () => {
  const user = userEvent.setup();
  render(<Issue101SnakeCharmerPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 101 뱀 조련사 프로토타입" });
  expect(within(prototype).getByRole("heading", { name: "뱀 조련사" })).toBeTruthy();
  expect(within(prototype).getByText("7번 도윤")).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "선택 확정" }));

  let reveal = screen.getByRole("dialog", { name: "첫 번째 역할 변경 공개" });
  expect(within(reveal).getByText("1 / 2")).toBeTruthy();
  expect(within(reveal).getByText("비고르모르티스")).toBeTruthy();
  expect(within(reveal).getByText("악")).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  reveal = screen.getByRole("dialog", { name: "두 번째 역할 변경 공개" });
  expect(within(reveal).getByText("2 / 2")).toBeTruthy();
  expect(within(reveal).getByText("뱀 조련사")).toBeTruthy();
  expect(within(reveal).getByText("선")).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));

  const grimoire = within(prototype).getByRole("region", { name: "교환 후 밤 마도서" });
  expect(within(grimoire).getByText("비고르모르티스 · 1번 민서")).toBeTruthy();
  expect(within(grimoire).getByLabelText("중독 · 출처 뱀 조련사 · 자동 토큰 · 편집 불가")).toBeTruthy();
  expect(within(grimoire).queryByRole("button", { name: /중독/ })).toBeNull();
});

test("a reload rehearsal restarts the ordered reveal at the first player", async () => {
  const user = userEvent.setup();
  render(<Issue101SnakeCharmerPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 101 뱀 조련사 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "선택 확정" }));
  await user.click(screen.getByRole("button", { name: "확인했다면 눈을 감으세요" }));
  await user.click(screen.getByRole("button", { name: "새로고침 동작 재현" }));

  const reveal = screen.getByRole("dialog", { name: "첫 번째 역할 변경 공개" });
  expect(within(reveal).getByText("1 / 2")).toBeTruthy();
  expect(within(reveal).getByText("비고르모르티스")).toBeTruthy();
});
