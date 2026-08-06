import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ScriptSelectionPrototype } from "../src/scriptSelectionPrototype";

test("shows a themed synopsis before confirming a script", async () => {
  const user = userEvent.setup();
  render(<ScriptSelectionPrototype />);

  const selection = screen.getByRole("region", { name: "스크립트 선택" });
  expect(within(selection).getByRole("button", { name: "Trouble Brewing 선택" })).toBeTruthy();
  expect(within(selection).getByRole("button", { name: "Sects & Violets 선택" })).toBeTruthy();
  expect(screen.queryByText("최근 플레이")).toBeNull();
  expect(screen.queryByText("이제 시작할 스크립트를 선택합니다.")).toBeNull();
  expect(screen.queryByRole("button", { name: "계속하기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "새 게임" })).toBeNull();

  await user.click(within(selection).getByRole("button", { name: "Trouble Brewing 선택" }));
  expect(screen.getByRole("heading", { name: "Trouble Brewing" })).toBeTruthy();
  expect(screen.getByText(/먹구름이 레이븐스우드 블러프 위로 밀려들고/)).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByRole("button", { name: "Trouble Brewing 선택 확정" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "계속하기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "새 게임" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Trouble Brewing 선택 확정" }));
  expect(screen.getByRole("status").textContent).toContain("Trouble Brewing 준비 중");
  expect(
    await screen.findByText("기존 Trouble Brewing Grimoire가 이 진입점에 표시됩니다.", {}, { timeout: 1500 }),
  ).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "스크립트 선택" }));
  await user.click(screen.getByRole("button", { name: "Sects & Violets 선택" }));
  expect(screen.getByRole("heading", { name: "Sects & Violets" })).toBeTruthy();
  expect(screen.getByText(/찬란한 봄이 지나고 따뜻한 여름이 찾아옵니다/)).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByRole("button", { name: "Sects & Violets 선택 확정" })).toBeTruthy();
});
