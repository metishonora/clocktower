import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue152SpyGrimoirePrototype } from "../src/issue152SpyGrimoirePrototype";

test("defaults to the live Grimoire shell and keeps its tabs/actions blocked during Spy review", async () => {
  const user = userEvent.setup();
  render(<Issue152SpyGrimoirePrototype />);

  const review = screen.getByRole("region", { name: "Issue 152 Spy 마도서 프로토타입 검토 도구" });
  expect(within(review).getByRole("button", { name: "B · 실제 마도서" }).getAttribute("aria-pressed")).toBe("true");
  const shell = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  const stages = within(shell).getByRole("navigation", { name: "작업 단계" });
  const utilities = within(shell).getByRole("navigation", { name: "게임 데이터" });
  expect(within(stages).getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");
  expect((within(utilities).getByRole("button", { name: "새 게임" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(shell).getByLabelText("라이브 마도서 좌석 맵")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "열람 종료" })).toHaveLength(1);

  await user.click(within(stages).getByRole("button", { name: "진행" }));
  await user.click(within(utilities).getByRole("button", { name: "새 게임" }));
  expect(screen.getByRole("main", { name: "Trouble Brewing 진행" })).toBe(shell);
  expect(within(shell).getByLabelText("라이브 마도서 좌석 맵")).toBeTruthy();

  const seat = within(shell).getByRole("button", { name: /1번 좌석, 민지/ });
  await user.click(seat);
  const detail = screen.getByRole("dialog", { name: "1번 민지 플레이어 상세" });
  expect(detail).toBeTruthy();
  expect(within(detail).queryByRole("button", { name: /토큰 \/ Notes 편집/ })).toBeNull();

  await user.click(within(detail).getByRole("button", { name: "플레이어 상세 닫기" }));
  const center = within(shell).getByRole("group", { name: "현재 단계" });
  const close = within(center).getByRole("button", { name: "열람 종료" });
  expect(close.closest(".snvGrimoireCenter")?.classList.contains("issue116PhaseClock")).toBe(true);
  expect(screen.getAllByRole("button", { name: "열람 종료" })).toHaveLength(1);
  await user.click(close);
  expect(screen.getByRole("main", { name: "첩자 공개 종료" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "열람을 종료했습니다" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "진행" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "다시 열람" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "진행" }));
  expect(screen.getByRole("main", { name: "Spy reveal fixture handoff" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "fixture 전용 handoff 확인" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "다시 열람" })).toBeNull();
});

test("lets review switch to A static reveal while preserving one close action per variant", async () => {
  const user = userEvent.setup();
  render(<Issue152SpyGrimoirePrototype />);
  const review = screen.getByRole("region", { name: "Issue 152 Spy 마도서 프로토타입 검토 도구" });

  await user.click(within(review).getByRole("button", { name: "A · 정적 reveal" }));
  const staticShell = screen.getByRole("main", { name: "Trouble Brewing 첩자 마도서 프로토타입" });
  expect(within(staticShell).queryByRole("navigation")).toBeNull();
  expect(within(staticShell).queryByRole("button", { name: /좌석 선택/ })).toBeNull();
  expect(within(staticShell).getAllByRole("button", { name: "열람 종료" })).toHaveLength(1);
  expect(within(staticShell).getAllByText("중독").length).toBeGreaterThan(0);

  await user.click(within(staticShell).getByRole("button", { name: "열람 종료" }));
  expect(screen.queryByRole("main", { name: "Trouble Brewing 첩자 마도서 프로토타입" })).toBeNull();
  expect(screen.getByRole("region", { name: "첩자 공개 종료 상태" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "다시 열람" }));
  expect(screen.getByRole("main", { name: "Trouble Brewing 첩자 마도서 프로토타입" })).toBeTruthy();
});

test("keeps the prototype route development-only", () => {
  const main = readFileSync(resolve("src/main.tsx"), "utf8");
  expect(main).toMatch(/const DevIssue152SpyGrimoirePrototype = import\.meta\.env\.DEV/);
  expect(main).toContain('prototype") === "issue-152-spy-grimoire"');
  expect(main).toContain("./issue152SpyGrimoirePrototype");
});
