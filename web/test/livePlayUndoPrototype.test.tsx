import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { LivePlayUndoPrototype } from "../src/livePlayUndoPrototype";

function prototypeState() {
  return JSON.parse(screen.getByTestId("live-play-undo-prototype-state").textContent ?? "{}");
}

beforeEach(() => window.history.replaceState(null, "", "/?prototype=live-play-undo"));

test.each([
  ["Variant A · 현재 행동", "현재 행동"],
  ["Variant B · 최근 이벤트", "최근 이벤트"],
])("%s keeps live Undo associated with the compared surface", async (variantLabel, surfaceLabel) => {
  const user = userEvent.setup();
  render(<LivePlayUndoPrototype />);

  await user.click(screen.getByRole("button", { name: variantLabel }));

  const surface = screen.getByLabelText(surfaceLabel);
  expect(within(surface).getByText("요리사 정보 확정 · 1쌍 공개")).toBeTruthy();
  expect(within(surface).getByRole("button", { name: "Undo" })).toBeTruthy();
});

test("keeps Undo discoverable while a confirmed Reveal follow-up is pending", async () => {
  const user = userEvent.setup();
  render(<LivePlayUndoPrototype />);

  await user.click(screen.getByRole("button", { name: "Reveal 후속" }));

  expect(screen.getByLabelText("확정된 Reveal 후속 조치")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  expect(screen.queryByLabelText("현재 단계 입력")).toBeNull();
});

test("identifies the latest event and cancellation leaves prototype state unchanged", async () => {
  const user = userEvent.setup();
  render(<LivePlayUndoPrototype />);
  const before = prototypeState();

  await user.click(screen.getByRole("button", { name: "Undo" }));
  const dialog = screen.getByRole("dialog", { name: "최근 확정 행동을 되돌릴까요?" });
  expect(within(dialog).getByText("되돌릴 항목: 요리사 정보 확정 · 1쌍 공개")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "취소" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(prototypeState()).toEqual(before);
  expect(screen.getAllByText("요리사 정보 확정 · 1쌍 공개").length).toBeGreaterThan(0);
});

test("mock confirmation removes only the latest item and returns to replayed prior state", async () => {
  const user = userEvent.setup();
  render(<LivePlayUndoPrototype />);

  await user.click(screen.getByRole("button", { name: "Undo" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "되돌리기" }));

  expect(screen.queryByText("요리사 정보 확정 · 1쌍 공개")).toBeNull();
  expect(screen.getAllByText("독살자가 2번 준호를 선택함").length).toBeGreaterThan(0);
  expect(screen.getByText("요리사 정보 입력")).toBeTruthy();
  expect(prototypeState()).toMatchObject({ eventCount: 2, replayedStep: "chef", dialogOpen: false });
});

test("hides generic Undo for setup-only and shows an eligible disabled action while busy", async () => {
  const user = userEvent.setup();
  render(<LivePlayUndoPrototype />);

  await user.click(screen.getByRole("button", { name: "설정만 확정" }));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(screen.getByRole("button", { name: "설정 다시 수정" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "전환 중" }));
  const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
  expect(undo.disabled).toBe(true);
  expect(screen.getByText("다음 상태 재생 중")).toBeTruthy();
});
