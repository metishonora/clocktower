import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { LiveUndoDialog } from "../src/features/event-log/LiveUndoDialog";

test("live Undo dialog starts on the safe action, traps focus, and cancels with Escape", async () => {
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <LiveUndoDialog
      events={[{ id: "event-chef", summary: "요리사 정보 확정 · 1쌍 공개" }]}
      onCancel={onCancel}
      onConfirm={vi.fn()}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "최근 확정 행동을 되돌릴까요?" });
  const cancel = within(dialog).getByRole("button", { name: "취소" });
  const confirm = within(dialog).getByRole("button", { name: "되돌리기" });

  await waitFor(() => expect(document.activeElement).toBe(cancel));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(confirm);
  await user.tab();
  expect(document.activeElement).toBe(cancel);
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test("live Undo dialog lists every event in a canonical action group", () => {
  render(
    <LiveUndoDialog
      events={[
        { id: "nomination", summary: "지명" },
        { id: "vote", summary: "투표" },
      ]}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );
  expect(screen.getByText("함께 되돌릴 항목 2개")).toBeTruthy();
  expect(screen.getByText("지명")).toBeTruthy();
  expect(screen.getByText("투표")).toBeTruthy();
});
