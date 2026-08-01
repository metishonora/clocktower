import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SnvGameEndDialog, SnvGameEndDock } from "../src/features/snv-game-end/SnvGameEnd";

const pending = {
  sourceEventId: "no-execution-18",
  winningTeam: "evil" as const,
  cause: "vortoxNoExecution" as const,
  reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
};

describe("S&V rules-owned game end", () => {
  test("shows the approved non-dismissible team-colored dialog", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<SnvGameEndDialog pending={pending} busy={false} onConfirm={onConfirm} />);

    const dialog = screen.getByRole("dialog", { name: "악 진영 승리" });
    expect(dialog.getAttribute("data-team")).toBe("evil");
    expect(within(dialog).getByRole("heading", { name: "악 진영 승리" })).toBeTruthy();
    expect(within(dialog).getByText(pending.reasonKo)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /닫기|취소|최소화/ })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test("keeps winner, reason, and Undo in the post-end dock", async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<SnvGameEndDock gameEnd={{
      eventId: "game-ended-19",
      sourceEventId: pending.sourceEventId,
      winningTeam: pending.winningTeam,
      cause: pending.cause,
      reasonKo: pending.reasonKo,
    }} busy={false} onUndo={onUndo} />);

    const dock = screen.getByRole("region", { name: "게임 종료 상태" });
    expect(within(dock).getByText("악 진영 승리")).toBeTruthy();
    expect(within(dock).getByText(pending.reasonKo)).toBeTruthy();
    await user.click(within(dock).getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
