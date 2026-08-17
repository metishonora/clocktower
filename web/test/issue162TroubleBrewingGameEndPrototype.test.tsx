import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Issue162TroubleBrewingGameEndPrototype } from "../src/issue162TroubleBrewingGameEndPrototype";

describe("issue 162 Trouble Brewing game-end prototype", () => {
  test("shows every canonical cause with the approved winner and complete Korean reason", async () => {
    const user = userEvent.setup();
    render(<Issue162TroubleBrewingGameEndPrototype />);
    const tools = screen.getByRole("region", { name: "Issue 162 종료 상태 검토 도구" });

    assertPending("선 진영 승리", "살아 있는 악마가 없습니다.");

    await user.click(within(tools).getByRole("button", { name: "생존자 2명" }));
    assertPending("악 진영 승리", "생존자가 2명 이하로 남았습니다.");

    await user.click(within(tools).getByRole("button", { name: "성자 처형" }));
    assertPending("악 진영 승리", "성자가 처형되어 사망했습니다.");

    await user.click(within(tools).getByRole("button", { name: "시장 무처형" }));
    assertPending(
      "선 진영 승리",
      "시장을 포함해 정확히 3명이 살아 있고, 오늘 아무도 처형되지 않았습니다.",
    );

    await user.click(within(tools).getByRole("button", { name: "동시 성립" }));
    assertPending("선 진영 승리", "살아 있는 악마가 없습니다.");
    expect(screen.queryByText("승리 조건 확인")).toBeNull();
    expect(screen.queryByText("동시에 성립 · 선 승리 우선")).toBeNull();
    expect(screen.queryByRole("button", { name: "수동 게임 종료" })).toBeNull();
  });

  test("covers pending, busy, error, and read-only ended states without a dedicated Undo", async () => {
    const user = userEvent.setup();
    render(<Issue162TroubleBrewingGameEndPrototype />);
    const tools = screen.getByRole("region", { name: "Issue 162 종료 상태 검토 도구" });

    await user.click(within(tools).getByRole("button", { name: "종료 중" }));
    const busyDialog = screen.getByRole("dialog", { name: "선 진영 승리" });
    expect((within(busyDialog).getByRole("button", { name: "종료 중…" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(within(tools).getByRole("button", { name: "확정 실패" }));
    const failure = screen.getByRole("dialog", { name: "작업 실패" });
    expect(within(failure).getByText("게임 종료를 확정하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.")).toBeTruthy();
    await user.click(within(failure).getByRole("button", { name: "확인" }));
    expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "선 진영 승리" })).toBeTruthy();

    await user.click(within(tools).getByRole("button", { name: "종료 후" }));
    expect(screen.queryByRole("dialog", { name: "선 진영 승리" })).toBeNull();
    const dock = screen.getByRole("region", { name: "게임 종료 상태" });
    expect(within(dock).getByText("선 진영 승리")).toBeTruthy();
    expect(within(dock).queryByText("악마 부재")).toBeNull();
    expect(within(dock).getByText("살아 있는 악마가 없습니다.")).toBeTruthy();
    expect(within(dock).queryByRole("button")).toBeNull();
    const globalUndo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    expect(globalUndo.disabled).toBe(false);
    expect((within(screen.getByLabelText("라이브 마도서 좌석 맵")).getByRole("button", { name: /1번 민지 좌석 선택/ }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(globalUndo);
    const undoDialog = screen.getByRole("dialog", { name: "Undo" });
    expect(within(undoDialog).getByText("7번 현우(임프) 처형 사망")).toBeTruthy();
    expect(within(undoDialog).getByText("게임 종료 · 선한 팀 승리")).toBeTruthy();
    await user.click(within(undoDialog).getByRole("button", { name: "되돌리기" }));
    expect(screen.getByRole("heading", { name: "직전 진행 상태로 돌아왔습니다" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "게임 종료 상태" })).toBeNull();
  });

  test("lets reviewers inspect day and night themes independently", async () => {
    const user = userEvent.setup();
    render(<Issue162TroubleBrewingGameEndPrototype />);
    const tools = screen.getByRole("region", { name: "Issue 162 종료 상태 검토 도구" });
    const shell = screen.getByRole("main", { name: "Trouble Brewing 게임 종료 fixture" });

    expect(shell.getAttribute("data-theme")).toBe("day");
    await user.click(within(tools).getByRole("button", { name: "밤" }));
    expect(shell.getAttribute("data-theme")).toBe("night");
  });
});

function assertPending(title: string, reason: string) {
  const dialog = screen.getByRole("dialog", { name: title });
  expect(within(dialog).getByRole("heading", { name: title })).toBeTruthy();
  expect(within(dialog).getByText(reason)).toBeTruthy();
  expect(within(dialog).queryByText(/악마 부재|생존자 2명|성자 처형 사망|시장 무처형/)).toBeNull();
  expect(within(dialog).queryByRole("button", { name: /닫기|취소|최소화/ })).toBeNull();
}
