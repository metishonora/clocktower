import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MadnessAssignmentState, Player } from "../src/core/types";
import { MadnessActionDock } from "../src/features/madness/MadnessActionDock";

const players = [
  player("mutant-player", 2, "민준", "mutant"),
  player("ceren-player", 5, "서연", "cerenovus"),
  player("target-player", 7, "도윤", "artist"),
];

describe("#105 madness free actions", () => {
  it("names the exact target and never shows the removed generic judgment wording", async () => {
    const user = userEvent.setup();
    renderDock([assignment({ sourceCharacterId: "mutant", sourcePlayerId: "mutant-player" })]);

    await user.click(screen.getByRole("button", { name: /변종 집착 확인 열기/ }));

    expect(screen.getByRole("img", { name: "변종 공식 캐릭터 아이콘" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "[7번 도윤] 외지인 집착 확인" })).toBeTruthy();
    expect(screen.getByText("[7번 도윤]이 외지인임을 주장하며 집착하였나요?")).toBeTruthy();
    expect(screen.queryByText(/이야기꾼 판정/)).toBeNull();
    expect(screen.getByRole("button", { name: "외지인임을 집착함" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "위반 없음" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "변종 캐릭터 상세 열기" }));
    expect(screen.getByRole("dialog", { name: "변종 캐릭터 상세" })).toBeTruthy();
  });

  it("records Cerenovus clear and violation with direct result buttons", async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();
    renderDock([
      assignment({
        assignmentId: "ceren-assignment",
        sourceCharacterId: "cerenovus",
        sourcePlayerId: "ceren-player",
        requiredCharacterId: "artist",
      }),
    ], onRecord);

    await user.click(screen.getByRole("button", { name: /세레노버스 집착 확인 열기/ }));
    expect(screen.getByRole("heading", { name: "[7번 도윤] 집착 확인" })).toBeTruthy();
    expect(screen.getByText("[7번 도윤]이 화가에 충분히 집착하였나요?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "충분히 집착함" }));
    expect(onRecord).toHaveBeenCalledWith("ceren-assignment", "clear");

    await user.click(screen.getByRole("button", { name: "충분히 집착하지 않음" }));
    expect(onRecord).toHaveBeenLastCalledWith("ceren-assignment", "violation");
  });

  it("requires a separate confirmation before executing a violated target", async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn();
    renderDock([assignment({ status: "violated", canExecute: true })], vi.fn(), onExecute);

    await user.click(screen.getByRole("button", { name: /변종 집착 확인 열기/ }));
    await user.click(screen.getByRole("button", { name: "[7번 도윤] 처형" }));

    const dialog = screen.getByRole("alertdialog", { name: "[7번 도윤] 처형 확인" });
    expect(within(dialog).getByText(/사망은 다음 단계에서 별도로 확인합니다/)).toBeTruthy();
    expect(onExecute).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "처형 확정" }));
    expect(onExecute).toHaveBeenCalledWith("assignment-1");
  });

  it("exposes the current phase theme on the horizontal action dock and panel", async () => {
    const user = userEvent.setup();
    const { container } = renderDock([assignment()], vi.fn(), vi.fn(), "night");

    expect(container.querySelector(".snvMadnessDock.night")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /변종 집착 확인 열기/ }));
    expect(container.querySelector(".snvMadnessPanel.night")).toBeTruthy();
  });

  it("offsets madness actions beside the existing daytime actions in one row", () => {
    const { container } = renderDock([assignment()], vi.fn(), vi.fn(), "day", 3);
    const dock = container.querySelector<HTMLElement>(".snvMadnessDock");

    expect(dock?.style.getPropertyValue("--snv-madness-dock-offset")).toBe("186px");
    expect(dock?.style.getPropertyValue("--snv-madness-mobile-dock-offset")).toBe("174px");
  });
});

function renderDock(
  assignments: MadnessAssignmentState[],
  onRecord = vi.fn(),
  onExecute = vi.fn(),
  theme: "day" | "night" = "day",
  dayActionCount = 0,
) {
  return render(
    <MadnessActionDock
      players={players}
      assignments={assignments}
      phaseLabel="2일차 낮"
      theme={theme}
      precedingActionCount={dayActionCount}
      busy={false}
      onRecord={onRecord}
      onExecute={onExecute}
    />,
  );
}

function assignment(overrides: Partial<MadnessAssignmentState> = {}): MadnessAssignmentState {
  return {
    assignmentId: "assignment-1",
    sourcePlayerId: "mutant-player",
    sourceCharacterId: "mutant",
    targetPlayerId: "target-player",
    status: "unchecked",
    sourceEffective: true,
    canCheck: true,
    canExecute: false,
    ...overrides,
  };
}

function player(id: string, seat: number, name: string, actualCharacter: string): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment: actualCharacter === "cerenovus" ? "evil" : "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
