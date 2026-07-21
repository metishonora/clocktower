import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { SeatLayoutBoundaryPrototype } from "../src/seatLayoutBoundaryPrototype";

describe.each([
  ["desktop", 1366],
  ["mobile", 390],
])("seat-layout visibility boundary at %s width", (_viewport, width) => {
  test("keeps layout tools in setup, preserves a custom position in live play, and restores it on setup recovery", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    fireEvent(window, new Event("resize"));
    const user = userEvent.setup();

    render(<SeatLayoutBoundaryPrototype />);

    const setupMap = screen.getByLabelText("설정 좌석 맵");
    expect(screen.getByRole("group", { name: "좌석 배치 프리셋" })).toBeTruthy();
    expect(screen.getByText("겹침 없음")).toBeTruthy();
    expect(screen.getByRole("button", { name: "위치 조정" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "자동 배치" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "긴 테이블" }));
    const setupSeat = within(setupMap).getByRole("button", { name: /1번 민서/ });
    expect(setupSeat.getAttribute("style")).toContain("82%");
    Object.defineProperty(setupMap, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 1_000, bottom: 1_000, width: 1_000, height: 1_000 }),
    });
    await user.click(screen.getByRole("button", { name: "위치 조정" }));
    fireEvent.pointerDown(setupSeat, { pointerId: 1, clientX: 820, clientY: 180 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 700, clientY: 300 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    const confirmedPosition = setupSeat.getAttribute("style");
    expect(confirmedPosition).toContain("left: 70%");
    expect(confirmedPosition).toContain("top: 30%");

    await user.click(screen.getByRole("button", { name: "설정 확정" }));

    expect(screen.queryByRole("group", { name: "좌석 배치 프리셋" })).toBeNull();
    expect(screen.queryByText(/^겹침/)).toBeNull();
    expect(screen.queryByRole("button", { name: "위치 조정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "자동 배치" })).toBeNull();

    const liveMap = screen.getByLabelText("라이브 마도서 좌석 맵");
    const liveSeat = within(liveMap).getByRole("button", { name: /1번 민서/ });
    expect(liveSeat.getAttribute("style")).toBe(confirmedPosition);
    expect(liveSeat.classList.contains("overlap")).toBe(false);
    await user.click(liveSeat);
    expect(liveSeat.getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByText("설정 및 불러오기"));
    const management = screen.getByLabelText("설정 및 불러오기 메뉴");
    expect(within(management).queryByRole("button", { name: "위치 조정" })).toBeNull();
    expect(within(management).queryByRole("button", { name: "자동 배치" })).toBeNull();
    await user.click(within(management).getByRole("button", { name: "설정 다시 수정" }));

    const recoveredSeat = within(screen.getByLabelText("설정 좌석 맵")).getByRole("button", { name: /1번 민서/ });
    expect(recoveredSeat.getAttribute("style")).toBe(confirmedPosition);
    expect(screen.getByRole("button", { name: "위치 조정" })).toBeTruthy();
  });
});

test("overlap feedback belongs to setup and is absent from live play", async () => {
  const user = userEvent.setup();
  render(<SeatLayoutBoundaryPrototype />);

  await user.click(screen.getByRole("checkbox", { name: "겹침 상태 보기" }));
  expect(screen.getByText("겹침 1, 2")).toBeTruthy();
  expect(within(screen.getByLabelText("설정 좌석 맵")).getAllByLabelText(/겹침$/)).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: "설정 확정" }));

  expect(screen.queryByText("겹침 1, 2")).toBeNull();
  expect(within(screen.getByLabelText("라이브 마도서 좌석 맵")).queryByLabelText(/겹침$/)).toBeNull();
});
