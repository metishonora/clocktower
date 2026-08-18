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
  const dialog = screen.getByRole("dialog", { name: "Undo" });
  expect(dialog.classList.contains("snvHistoryDialog")).toBe(true);
  expect(dialog.classList.contains("snvUndoHistoryDialog")).toBe(true);
  expect(dialog.classList.contains("tbLiveUndoDialog")).toBe(true);
  expect(dialog.parentElement?.classList.contains("snvDetailsBackdrop")).toBe(true);
  expect(dialog.parentElement?.classList.contains("snvHistoryDialogBackdrop")).toBe(true);
  expect(dialog.parentElement?.classList.contains("tbLiveUndoDialogBackdrop")).toBe(true);
  expect(within(dialog).getByRole("heading", { name: "Undo" })).toBeTruthy();
  expect(within(dialog).getByText("되돌릴 행동")).toBeTruthy();
  expect(within(dialog).getByText("위 이벤트를 취소하고 직전 상태로 돌아갑니다.")).toBeTruthy();
  const eventStack = within(dialog).getByRole("list", { name: "취소될 이벤트" });
  expect(eventStack.tagName).toBe("OL");
  expect(within(eventStack).getByRole("listitem").textContent).toBe("01요리사 정보 확정 · 1쌍 공개");
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
  const dialog = screen.getByRole("dialog", { name: "Undo" });
  const events = within(within(dialog).getByRole("list", { name: "취소될 이벤트" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(events).toEqual(["01지명", "02투표"]);
});
