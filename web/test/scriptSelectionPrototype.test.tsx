import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ScriptSelectionPrototype } from "../src/scriptSelectionPrototype";

test("previews landing, continue, new-game replacement, draft exit, and the isolated S&V surface", async () => {
  const user = userEvent.setup();
  render(<ScriptSelectionPrototype />);

  expect(screen.getByText("이제 시작할 스크립트를 선택합니다.")).toBeTruthy();
  const troubleBrewing = screen.getByRole("article", { name: "Trouble Brewing" });
  expect(within(troubleBrewing).getByText("최근 플레이")).toBeTruthy();
  expect(within(troubleBrewing).getByRole("button", { name: "계속하기" })).toBeTruthy();

  const sectsAndViolets = screen.getByRole("article", { name: "Sects & Violets" });
  expect(within(sectsAndViolets).getByText("준비 중")).toBeTruthy();
  await user.click(within(sectsAndViolets).getByRole("button", { name: "미리 보기" }));
  expect(screen.getByRole("heading", { name: "Sects & Violets" })).toBeTruthy();
  expect(screen.getByText("이 화면에서는 게임을 만들거나 저장하지 않습니다.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "스크립트 선택" }));

  await user.click(within(screen.getByRole("article", { name: "Trouble Brewing" })).getByRole("button", { name: "새 게임" }));
  const replaceDialog = screen.getByRole("dialog", { name: "Trouble Brewing 새 게임" });
  await user.click(within(replaceDialog).getByRole("button", { name: "기존 게임 교체" }));
  expect(screen.getByRole("heading", { name: "Trouble Brewing" })).toBeTruthy();

  await user.type(screen.getByLabelText("초안 변경 체험"), "민지");
  await user.click(screen.getByRole("button", { name: "스크립트 선택" }));
  const discardDialog = screen.getByRole("dialog", { name: "설정 초안 폐기" });
  await user.click(within(discardDialog).getByRole("button", { name: "초안 폐기" }));
  expect(screen.queryByRole("button", { name: "계속하기" })).toBeNull();
  expect(screen.getByRole("button", { name: "새 게임 시작" })).toBeTruthy();
});
