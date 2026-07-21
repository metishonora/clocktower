import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ScriptLanding } from "../src/features/script-selection/ScriptLanding";

afterEach(() => {
  vi.useRealTimers();
});

test("uses official script logos and enters Trouble Brewing through its permanent page", () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  render(<ScriptLanding onNavigate={navigate} />);

  const selection = screen.getByRole("region", { name: "스크립트 선택" });
  const troubleBrewing = within(selection).getByRole("button", { name: "Trouble Brewing 선택" });
  const sectsAndViolets = within(selection).getByRole("button", { name: "Sects & Violets 선택" });
  expect(within(troubleBrewing).getByRole("img", { name: "Trouble Brewing" }).getAttribute("src"))
    .toBe("/clocktower/assets/scripts/trouble-brewing.png");
  expect(within(sectsAndViolets).getByRole("img", { name: "Sects & Violets" }).getAttribute("src"))
    .toBe("/clocktower/assets/scripts/sects-and-violets.png");
  expect(screen.queryByRole("button", { name: "계속하기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "새 게임" })).toBeNull();

  fireEvent.click(troubleBrewing);
  expect(screen.getByRole("heading", { name: "Trouble Brewing" })).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Trouble Brewing 선택 확정" }));
  expect(screen.getByRole("status").textContent).toContain("Trouble Brewing 준비 중");

  act(() => vi.advanceTimersByTime(650));
  expect(navigate).toHaveBeenCalledWith("/clocktower/trouble-brewing/");
});

test("enters the isolated Sects & Violets page after its synopsis", () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  render(<ScriptLanding onNavigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "Sects & Violets 선택" }));
  expect(screen.getByRole("heading", { name: "Sects & Violets" })).toBeTruthy();
  expect(screen.getByText(/찬란한 봄이 지나고 따뜻한 여름이 찾아옵니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sects & Violets 선택 확정" }));

  act(() => vi.advanceTimersByTime(650));
  expect(navigate).toHaveBeenCalledWith("/clocktower/sects-and-violets/");
});
