import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { CharacterRulesTooltipPrototype } from "../src/characterRulesTooltipPrototype";

test("opens a compact character rules card from an info control", async () => {
  const user = userEvent.setup();
  render(<CharacterRulesTooltipPrototype />);

  expect(screen.queryByRole("dialog", { name: "독살범 세부 규칙" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "독살범 세부 규칙 보기" }));

  const rules = screen.getByRole("dialog", { name: "독살범 세부 규칙" });
  expect(within(rules).getByText("공식 능력")).toBeTruthy();
  expect(within(rules).getByText("핵심 판정")).toBeTruthy();
  expect(within(rules).getByText("중독된 플레이어는 능력이 작동하지 않지만, 평소처럼 깨워 행동하게 합니다.")).toBeTruthy();
  expect(within(rules).getByRole("link", { name: "공식 규칙" }).getAttribute("href"))
    .toBe("https://wiki.bloodontheclocktower.com/Poisoner");
  expect(within(rules).queryByText(/번역/)).toBeNull();
});

test("switches between representative characters and keeps examples collapsed", async () => {
  const user = userEvent.setup();
  render(<CharacterRulesTooltipPrototype />);

  await user.click(screen.getByRole("button", { name: "주정뱅이 세부 규칙 보기" }));

  const rules = screen.getByRole("dialog", { name: "주정뱅이 세부 규칙" });
  expect(within(rules).getByText("실제 캐릭터는 주정뱅이이며 외지인입니다. 보여준 주민의 능력은 없습니다.")).toBeTruthy();
  expect(within(rules).getByText("예시 보기").closest("details")?.hasAttribute("open")).toBe(false);

  await user.click(within(rules).getByRole("button", { name: "세부 규칙 닫기" }));
  expect(screen.queryByRole("dialog", { name: "주정뱅이 세부 규칙" })).toBeNull();
});
