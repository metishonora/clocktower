import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue90SpyRevealPrototype } from "../src/issue90SpyRevealPrototype";

test("compares the same Grimoire geometry and opens a safe Reveal with only the close action", async () => {
  const user = userEvent.setup();
  render(<Issue90SpyRevealPrototype />);

  const comparison = screen.getByLabelText("이야기꾼 마도서와 첩자 Reveal 비교");
  const storyteller = within(comparison).getByLabelText("이야기꾼 화면 비교본");
  const revealComparison = within(comparison).getByLabelText("첩자 Reveal 비교본");
  const storytellerSeat = within(storyteller).getByText("플레이어 1").closest("button");
  const revealSeat = within(revealComparison).getByText("플레이어 1").closest("article");

  expect(storytellerSeat).toBeTruthy();
  expect(revealSeat).toBeTruthy();
  expect(revealSeat?.getAttribute("style")).toBe(storytellerSeat?.getAttribute("style"));
  expect(within(storyteller).getByText("현재 행동")).toBeTruthy();
  expect(within(revealComparison).queryByText("현재 행동")).toBeNull();
  expect(within(revealComparison).getByRole("button", { name: "확인했다면 눈을 감으세요." })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "전체 화면 Reveal 체험" }));

  const reveal = screen.getByLabelText("플레이어 공개 화면");
  expect(screen.queryByLabelText("이야기꾼 마도서와 첩자 Reveal 비교")).toBeNull();
  expect(within(reveal).getAllByRole("button")).toHaveLength(1);
  expect(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." })).toBeTruthy();
  expect(within(reveal).getAllByRole("article")).toHaveLength(10);
  expect(within(reveal).queryByText("현재 행동")).toBeNull();
  expect(within(reveal).queryByText("이벤트 로그")).toBeNull();
  expect(within(reveal).queryByText(/보여준 캐릭터/)).toBeNull();
  expect(within(reveal).queryByText("비공개 메모")).toBeNull();
  expect(within(reveal).queryByText(/악마임|능력 소모/)).toBeNull();
  expect(within(reveal).getByText("중독")).toBeTruthy();
  expect(within(reveal).getByText("보호")).toBeTruthy();

  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
  expect(screen.getByLabelText("이야기꾼 마도서와 첩자 Reveal 비교")).toBeTruthy();
});

test("reviews representative counts, presets, and a manual layout with shared coordinates", async () => {
  const user = userEvent.setup();
  render(<Issue90SpyRevealPrototype />);

  for (const count of [5, 10, 15]) {
    await user.selectOptions(screen.getByLabelText("플레이어 수"), String(count));
    const comparison = screen.getByLabelText("이야기꾼 마도서와 첩자 Reveal 비교");
    expect(within(comparison).getAllByText(new RegExp(`^플레이어 \\d+$`))).toHaveLength(count * 2);
  }

  for (const layout of ["circle", "oval", "longTable", "horseshoe", "manual"]) {
    await user.selectOptions(screen.getByLabelText("좌석 배치"), layout);
    const comparison = screen.getByLabelText("이야기꾼 마도서와 첩자 Reveal 비교");
    const storyteller = within(comparison).getByLabelText("이야기꾼 화면 비교본");
    const reveal = within(comparison).getByLabelText("첩자 Reveal 비교본");
    const storytellerSeat = within(storyteller).getByText("플레이어 1").closest("button");
    const revealSeat = within(reveal).getByText("플레이어 1").closest("article");
    expect(revealSeat?.getAttribute("style"), layout).toBe(storytellerSeat?.getAttribute("style"));
  }
});
