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
    const identity = screen.getByRole("button", { name: "변종 캐릭터 상세 열기" });
    expect(within(identity).getByText("2일차 낮 · 2번 민준")).toBeTruthy();
    expect(within(identity).getByRole("heading", { name: "변종" })).toBeTruthy();
    expect(screen.getByText("당신이 \"외지인\"이라는 사실에 집착한다면, 당신은 처형당할 수도 있습니다.")).toBeTruthy();
    expect(screen.getByText("[7번 도윤]이 외지인임을 주장하며 집착하였나요?")).toBeTruthy();
    expect(screen.queryByText(/이야기꾼 판정/)).toBeNull();
    expect(screen.queryByRole("button", { name: "집착 확인 닫기" })).toBeNull();
    expect(screen.getByRole("button", { name: /변종 집착 확인 닫기/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "외지인임을 집착함" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "위반 없음" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "변종 캐릭터 상세 열기" }));
    expect(screen.getByRole("dialog", { name: "변종 캐릭터 상세" })).toBeTruthy();
  });

  it("changes the Cerenovus judgment with direct result buttons", async () => {
    const user = userEvent.setup();
    const onJudge = vi.fn();
    renderDock([
      assignment({
        assignmentId: "ceren-assignment",
        sourceCharacterId: "cerenovus" as const,
        sourcePlayerId: "ceren-player",
        requiredCharacterId: "artist",
      }),
    ], onJudge);

    await user.click(screen.getByRole("button", { name: /세레노버스 집착 확인 열기/ }));
    const identity = screen.getByRole("button", { name: "세레노버스 캐릭터 상세 열기" });
    expect(within(identity).getByText("2일차 낮 · 5번 서연")).toBeTruthy();
    expect(within(identity).getByRole("heading", { name: "세레노버스" })).toBeTruthy();
    expect(screen.getByText("[7번 도윤]이 화가에 충분히 집착하였나요?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "충분히 집착함" }));
    expect(onJudge).toHaveBeenCalledWith("ceren-assignment", "clear");

    await user.click(screen.getByRole("button", { name: "충분히 집착하지 않음" }));
    expect(onJudge).toHaveBeenLastCalledWith("ceren-assignment", "violation");
  });

  it.each([
    {
      description: "Mutant clear",
      overrides: { status: "clear" as const },
      openButton: /변종 집착 확인 열기/,
      selectedButton: "위반 없음",
      oppositeButton: "외지인임을 집착함",
      oppositeResult: "violation" as const,
    },
    {
      description: "Cerenovus clear",
      overrides: {
        assignmentId: "ceren-assignment",
        sourceCharacterId: "cerenovus" as const,
        sourcePlayerId: "ceren-player",
        requiredCharacterId: "artist",
        status: "clear" as const,
      },
      openButton: /세레노버스 집착 확인 열기/,
      selectedButton: "충분히 집착함",
      oppositeButton: "충분히 집착하지 않음",
      oppositeResult: "violation" as const,
    },
  ])("disables the already-recorded $description result without blocking a changed result", async ({
    overrides,
    openButton,
    selectedButton,
    oppositeButton,
    oppositeResult,
  }) => {
    const user = userEvent.setup();
    const onJudge = vi.fn();
    const currentAssignment = assignment(overrides);
    renderDock([currentAssignment], onJudge);

    await user.click(screen.getByRole("button", { name: openButton }));
    const selected = screen.getByRole<HTMLButtonElement>("button", { name: selectedButton });
    expect(selected.disabled).toBe(true);
    await user.click(selected);
    expect(onJudge).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: oppositeButton }));
    expect(onJudge).toHaveBeenCalledWith(currentAssignment.assignmentId, oppositeResult);
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

    expect(dock?.style.getPropertyValue("--snv-madness-dock-offset")).toBe("210px");
    expect(dock?.style.getPropertyValue("--snv-madness-mobile-dock-offset")).toBe("174px");
  });
});

function renderDock(
  assignments: MadnessAssignmentState[],
  onJudge = vi.fn(),
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
      onJudge={onJudge}
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
