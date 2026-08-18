import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ManualTokensNotesPrototype } from "../src/manualTokensNotesPrototype";

function prototypeState() {
  return JSON.parse(screen.getByTestId("manual-tokens-notes-prototype-state").textContent ?? "{}");
}

function longPressPlayer(name: string) {
  vi.useFakeTimers();
  const seatAction = screen.getByRole("button", { name });
  fireEvent.pointerDown(seatAction, { pointerId: 1 });
  act(() => vi.advanceTimersByTime(550));
  fireEvent.pointerUp(seatAction, { pointerId: 1 });
  vi.useRealTimers();
}

beforeEach(() => window.history.replaceState(null, "", "/?prototype=manual-tokens-notes"));

afterEach(() => vi.useRealTimers());

test("opens a Player annotation sheet only from a seat long-press", () => {
  render(<ManualTokensNotesPrototype />);

  expect(screen.queryByRole("button", { name: "2번 준호 토큰 및 Notes 편집" })).toBeNull();
  longPressPlayer("2번 준호 좌석 선택");

  const dialog = screen.getByRole("dialog", { name: "2번 준호 토큰 및 Notes" });
  expect(within(dialog).getByRole("group", { name: "System Tokens" })).toBeTruthy();
  expect(within(dialog).getByRole("group", { name: "Script Tokens" })).toBeTruthy();
  expect(within(dialog).getByRole("textbox", { name: "Notes" })).toBeTruthy();
  expect((within(dialog).getByRole("button", { name: "수정 확정" }) as HTMLButtonElement).disabled).toBe(true);
  expect(document.activeElement).toBe(dialog);
});

test("confirms System Tokens, Script Tokens, and Notes as one mock event", async () => {
  const user = userEvent.setup();
  render(<ManualTokensNotesPrototype />);

  longPressPlayer("2번 준호 좌석 선택");
  const dialog = screen.getByRole("dialog", { name: "2번 준호 토큰 및 Notes" });
  await user.click(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }));
  await user.click(within(dialog).getByRole("button", { name: "Script Token · 점쟁이 · 착각" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "다음 낮에 개인 확인");
  await user.click(within(dialog).getByRole("button", { name: "수정 확정" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  const seat = screen.getByRole("group", { name: "2번 준호 좌석" });
  const systemBadge = within(seat).getByText("후속 처리");
  const scriptBadge = within(seat).getByText("착각");
  expect(systemBadge.className).toContain("manual");
  expect(scriptBadge.className).toContain("manual");
  expect(systemBadge.closest(".annotationManualTokens")).toBeTruthy();
  expect(scriptBadge.closest(".annotationManualTokens")).toBeTruthy();
  expect(systemBadge.closest(".annotationSeatCard")).toBeNull();
  expect(within(seat).getByLabelText("Notes 미리보기").textContent).toBe("다음 낮에 개인 확인");
  expect(prototypeState()).toMatchObject({ eventCount: 1, selectedPlayerId: null });
  expect(prototypeState().players.p2.notes).toBe("다음 낮에 개인 확인");
});

test("cancelling discards the local draft", async () => {
  const user = userEvent.setup();
  render(<ManualTokensNotesPrototype />);

  longPressPlayer("2번 준호 좌석 선택");
  let dialog = screen.getByRole("dialog", { name: "2번 준호 토큰 및 Notes" });
  await user.click(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "저장하지 않음");
  await user.click(within(dialog).getByRole("button", { name: "취소" }));

  longPressPlayer("2번 준호 좌석 선택");
  dialog = screen.getByRole("dialog", { name: "2번 준호 토큰 및 Notes" });
  expect(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }).getAttribute("aria-pressed")).toBe("false");
  expect((within(dialog).getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement).value).toBe("");
  expect(prototypeState().eventCount).toBe(0);
});

test("a voting seat long-press edits without toggling its vote, while a tap still votes", async () => {
  const user = userEvent.setup();
  render(<ManualTokensNotesPrototype />);

  await user.click(screen.getByRole("button", { name: "투표 중" }));
  longPressPlayer("2번 준호 투표 선택");
  expect(prototypeState().voterIds).toEqual([]);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }));

  await user.click(screen.getByRole("button", { name: "2번 준호 투표 선택" }));
  expect(prototypeState().voterIds).toEqual(["p2"]);
});

test("automatic tokens attach to a card edge while prominent manual tokens stay outside", () => {
  render(<ManualTokensNotesPrototype />);

  const poisonedSeat = screen.getByRole("group", { name: "4번 도윤 좌석" });
  const protectedSeat = screen.getByRole("group", { name: "5번 하린 좌석" });
  const manualSystemSeat = screen.getByRole("group", { name: "6번 현우 좌석" });
  const manualScriptSeat = screen.getByRole("group", { name: "7번 유진 좌석" });
  expect(within(poisonedSeat).getByText("중독").className).toContain("poisoned");
  expect(within(protectedSeat).getByText("보호").className).toContain("protected");
  const poisonedToken = within(poisonedSeat).getByText("중독");
  expect(poisonedToken.closest(".annotationSeatCard")).toBeTruthy();
  expect(poisonedToken.closest(".annotationAutomaticTokens")?.className).toContain("edgeRight");
  expect(poisonedToken.closest(".annotationSeatMain")).toBeNull();
  expect(within(manualSystemSeat).getByText("능력 소모").className).toContain("manual");
  expect(within(manualScriptSeat).getByText("중독").className).toContain("manual");
  expect(within(manualSystemSeat).getByText("능력 소모").className).toContain("prominent");
  expect(screen.queryByText("자동 · 중독")).toBeNull();
  expect(screen.queryByText("수동 · 능력 소모")).toBeNull();
});

test("shows up to two lines of Notes content at the bottom of its player card", () => {
  render(<ManualTokensNotesPrototype />);

  const seat = screen.getByRole("group", { name: "6번 현우 좌석" });
  const preview = within(seat).getByLabelText("Notes 미리보기");
  expect(preview.textContent).toBe("능력 사용 확인");
  expect(preview.closest(".annotationSeatCard")).toBeTruthy();
  expect(within(seat).queryByLabelText("Notes 있음")).toBeNull();
});

test("a failed Rust Proposal keeps the annotation draft for retry", async () => {
  const user = userEvent.setup();
  render(<ManualTokensNotesPrototype />);

  await user.click(screen.getByRole("button", { name: "확정 실패" }));
  longPressPlayer("2번 준호 좌석 선택");
  const dialog = screen.getByRole("dialog", { name: "2번 준호 토큰 및 Notes" });
  await user.click(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "입력 유지");
  await user.click(within(dialog).getByRole("button", { name: "수정 확정" }));

  expect(within(dialog).getByRole("alert").textContent).toContain("다른 이벤트가 먼저 확정");
  expect(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }).getAttribute("aria-pressed")).toBe("true");
  expect((within(dialog).getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement).value).toBe("입력 유지");
  expect(prototypeState().eventCount).toBe(0);
});
