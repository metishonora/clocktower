import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SectsAndVioletsInformationTask } from "../src/features/phase-control/SectsAndVioletsInformationTask";
import type { PhaseStep, Player } from "../src/core/types";
import { RevealScreen } from "../src/reveal";

const actor: Player = {
  id: "player-1",
  seat: 1,
  name: "민서",
  actualCharacter: "clockmaker",
  shownCharacter: "clockmaker",
  alignment: "good",
  alive: true,
  ghostVoteUsed: false,
  deathAnnounced: false,
  systemTokenIds: [],
  scriptTokens: [],
  notes: "",
};

const step: PhaseStep = {
  id: "firstNight:clockmaker",
  phase: "firstNight",
  stepType: "character",
  character: "clockmaker",
  playerId: "player-1",
  requiredInput: { kind: "number", target: "number", optional: false },
  canSkip: false,
  support: "automated",
  informationPrompt: {
    computedResult: { kind: "number", value: 1 },
    deliveryMode: "fixed",
    activeReasons: [],
    registrationCandidatePlayerIds: [],
    numberChoices: [{ value: 1, isComputed: true, registrationJudgments: [] }],
    setupInfoRegistrationOptions: [],
  },
};

test("uses the approved identity, ability, truth, information reveal, and next layout", async () => {
  const onReveal = vi.fn();
  const onNext = vi.fn();
  const { rerender } = render(
    <SectsAndVioletsInformationTask
      step={step}
      actor={actor}
      revealed={false}
      busy={false}
      onReveal={onReveal}
      onNext={onNext}
    />,
  );

  const task = screen.getByRole("article", { name: "시계공 정보" });
  expect(within(task).getByRole("button", { name: "시계공 캐릭터 상세 열기" }).textContent).toContain("시계공민서");
  expect(within(task).getByText("게임 시작 시, 악마와 가장 가까운 하수인 사이의 거리를 알게 됩니다.")).toBeTruthy();
  expect(within(task).getByText("진실").nextElementSibling?.textContent).toContain("1칸");
  const reveal = within(task).getByRole("button", { name: "정보 공개" });
  expect(reveal.classList.contains("prominent")).toBe(true);
  expect(within(task).getByRole("button", { name: "다음" }).hasAttribute("disabled")).toBe(true);

  await userEvent.setup().click(reveal);
  expect(onReveal).toHaveBeenCalledTimes(1);

  rerender(
    <SectsAndVioletsInformationTask
      step={step}
      actor={actor}
      revealed
      busy={false}
      onReveal={onReveal}
      onNext={onNext}
    />,
  );
  const revealedTask = screen.getByRole("article", { name: "시계공 정보" });
  const repeat = within(revealedTask).getByRole("button", { name: "정보 공개" });
  expect(repeat.classList.contains("prominent")).toBe(false);
  expect(within(revealedTask).queryByText("Reveal 다시 보기")).toBeNull();
  await userEvent.setup().click(repeat);
  expect(onReveal).toHaveBeenCalledTimes(2);
  await userEvent.setup().click(within(revealedTask).getByRole("button", { name: "다음" }));
  expect(onNext).toHaveBeenCalledTimes(1);
});

test("renders Flowergirl and Town Crier Reveal as status statements", () => {
  for (const payload of [
    { kind: "booleanInformation" as const, characterId: "flowergirl" as const, value: true },
    { kind: "booleanInformation" as const, characterId: "flowergirl" as const, value: false },
    { kind: "booleanInformation" as const, characterId: "townCrier" as const, value: true },
    { kind: "booleanInformation" as const, characterId: "townCrier" as const, value: false },
  ]) {
    const { container } = render(<RevealScreen payload={payload} onClose={() => undefined} />);
    const reveal = within(container).getByLabelText("플레이어 공개 화면");
    if (payload.characterId === "flowergirl") {
      expect(reveal.textContent).toContain("오늘 악마가…");
      expect(reveal.textContent).toContain(payload.value ? "투표함" : "투표하지 않음");
    } else {
      expect(reveal.textContent).toContain("오늘 하수인이…");
      expect(reveal.textContent).toContain(payload.value ? "지목함" : "지목하지 않음");
    }
    expect(reveal.textContent).not.toMatch(/[?？]|예|아니오/);
    cleanup();
  }
});
