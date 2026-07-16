import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { GameEndControls } from "../src/features/game-end/GameEndControls";

const demonWarning = {
  code: "DEMON_DEAD_GOOD_WIN",
  severity: "warning" as const,
  messageKo: "악마 사망: 선 승리 확인 필요",
  winningTeam: "good" as const,
};

describe("production game-end controls", () => {
  test("locks one rules-owned warning to its winning alignment", async () => {
    const user = userEvent.setup();
    const onEndGame = vi.fn();
    render(<GameEndControls warnings={[demonWarning]} busy={false} onEndGame={onEndGame} onRequestUndo={() => {}} />);

    await user.click(screen.getByRole("button", { name: "게임 종료 확인" }));
    const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
    expect(dialog.textContent).toContain("선팀 승리로 종료합니다");
    expect(within(dialog).queryByRole("button", { name: "악" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));

    expect(onEndGame).toHaveBeenCalledWith("good");
  });

  test("manual end allows the Storyteller to choose 선 or 악", async () => {
    const user = userEvent.setup();
    const onEndGame = vi.fn();
    render(<GameEndControls warnings={[]} busy={false} onEndGame={onEndGame} onRequestUndo={() => {}} />);

    await user.click(screen.getByRole("button", { name: "수동 게임 종료" }));
    const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
    await user.click(within(dialog).getByRole("button", { name: "악" }));
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));

    expect(onEndGame).toHaveBeenCalledWith("evil");
  });

  test("ended state emphasizes only the result and delegates undo", async () => {
    const user = userEvent.setup();
    const onRequestUndo = vi.fn();
    render(<GameEndControls warnings={[]} gameEnd={{ eventId: "game-ended-12", winningTeam: "evil" }} busy={false} onEndGame={() => {}} onRequestUndo={onRequestUndo} />);

    const ended = screen.getByRole("region", { name: "게임 종료 상태" });
    expect(within(ended).getByText("게임 종료", { selector: "strong" })).not.toBeNull();
    expect(within(ended).getByRole("heading", { name: "악팀 승리" })).not.toBeNull();
    expect(within(ended).queryByText("마지막 이벤트")).toBeNull();
    await user.click(within(ended).getByRole("button", { name: "게임 종료 되돌리기" }));

    expect(onRequestUndo).toHaveBeenCalledOnce();
  });
});
