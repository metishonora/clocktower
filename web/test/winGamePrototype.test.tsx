import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { WinGamePrototype } from "../src/winGamePrototype";

describe("issue 12 win-game prototype", () => {
  test("locks a single-condition end to its rules-owned winning team", async () => {
    const user = userEvent.setup();
    render(<WinGamePrototype />);

    await user.click(screen.getByRole("button", { name: "게임 종료 확인" }));

    const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
    expect(dialog.textContent).toContain("선한 팀 승리로 종료합니다");
    expect(within(dialog).queryByRole("button", { name: "악" })).toBeNull();
    expect((within(dialog).getByRole("button", { name: "게임 종료" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("surfaces simultaneous warnings and requires an explicit team confirmation", async () => {
    const user = userEvent.setup();
    render(<WinGamePrototype />);

    await user.selectOptions(screen.getByLabelText("검토 시나리오"), "simultaneous");

    const warningCard = screen.getByRole("region", { name: "승리 조건 경고" });
    expect(within(warningCard).getByText("악마 사망")).not.toBeNull();
    expect(within(warningCard).getByText("생존자 2명")).not.toBeNull();

    await user.click(within(warningCard).getByRole("button", { name: "게임 종료 확인" }));

    const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
    expect(within(dialog).getByRole("button", { name: "선" })).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: "악" })).not.toBeNull();
    expect(within(dialog).queryByLabelText("종료 사유")).toBeNull();
    expect((within(dialog).getByRole("button", { name: "게임 종료" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "선" }));
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));

    const ended = screen.getByRole("region", { name: "게임 종료 상태" });
    expect(ended.textContent).toContain("선한 팀 승리");
    expect(within(ended).getByText("게임 종료", { selector: "strong" })).not.toBeNull();
    expect(within(ended).queryByText("마지막 이벤트")).toBeNull();
    expect(screen.getByRole("region", { name: "프로토타입 마도서" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "게임 종료 되돌리기" })).not.toBeNull();
    expect(screen.queryByRole("region", { name: "현재 단계" })).toBeNull();
  });

  test("allows a manual end without a warning and restores play on undo", async () => {
    const user = userEvent.setup();
    render(<WinGamePrototype />);

    await user.selectOptions(screen.getByLabelText("검토 시나리오"), "manual");

    expect(screen.queryByRole("region", { name: "승리 조건 경고" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "수동 게임 종료" }));
    const dialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
    await user.click(within(dialog).getByRole("button", { name: "악" }));
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));

    expect(screen.getByRole("region", { name: "게임 종료 상태" }).textContent).toContain("악한 팀 승리");
    await user.click(screen.getByRole("button", { name: "게임 종료 되돌리기" }));

    expect(screen.getByRole("region", { name: "현재 단계" }).textContent).toContain("지목 및 투표");
    expect(screen.getByRole("button", { name: "수동 게임 종료" })).not.toBeNull();
  });
});
