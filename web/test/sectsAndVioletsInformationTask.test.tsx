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
  const onContinue = vi.fn();
  const { rerender } = render(
    <SectsAndVioletsInformationTask
      step={step}
      actor={actor}
      revealed={false}
      busy={false}
      onReveal={onReveal}
    />,
  );

  const task = screen.getByRole("article", { name: "시계공 정보" });
  expect(task.querySelector(".snvSpaciousInformationContext")).toBeTruthy();
  expect(within(task).getByRole("button", { name: "시계공 캐릭터 상세 열기" }).textContent).toContain("시계공민서");
  expect(within(task).getByText("게임 시작 시, 악마와 가장 가까운 하수인 사이의 거리를 알게 됩니다.")).toBeTruthy();
  expect(within(task).getByText("진실").nextElementSibling?.textContent).toContain("1칸");
  const reveal = within(task).getByRole("button", { name: "정보 공개" });
  expect(reveal.classList.contains("prominent")).toBe(true);
  expect(within(task).queryByRole("button", { name: "다음" })).toBeNull();

  await userEvent.setup().click(reveal);
  expect(onReveal).toHaveBeenCalledTimes(1);

  rerender(
    <SectsAndVioletsInformationTask
      step={step}
      actor={actor}
      revealed
      busy={false}
      onReveal={onReveal}
      onContinue={onContinue}
    />,
  );
  const revealedTask = screen.getByRole("article", { name: "시계공 정보" });
  const repeat = within(revealedTask).getByRole("button", { name: "정보 공개" });
  expect(repeat.classList.contains("prominent")).toBe(false);
  expect(within(revealedTask).queryByText("Reveal 다시 보기")).toBeNull();
  await userEvent.setup().click(repeat);
  expect(onReveal).toHaveBeenCalledTimes(2);
  await userEvent.setup().click(within(revealedTask).getByRole("button", { name: "다음 단계" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test("Clockmaker keeps its selectable information editor spacious when impaired", () => {
  const impairedStep: PhaseStep = {
    ...step,
    informationPrompt: {
      ...step.informationPrompt!,
      deliveryMode: "selectable",
      activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }],
      numberChoices: [0, 1, 2].map((value) => ({ value, isComputed: value === 1, registrationJudgments: [] })),
    },
  };
  render(<SectsAndVioletsInformationTask step={impairedStep} actor={actor} revealed={false} busy={false} onReveal={() => undefined} />);

  const task = screen.getByRole("article", { name: "시계공 정보" });
  expect(task.querySelector(".snvSpaciousInformationContext")).toBeTruthy();
  expect(task.querySelector(".snvSpaciousInformationEditor")).toBeTruthy();
  expect(within(task).getByRole("button", { name: "중독 정보 공개" }).parentElement?.classList.contains("snvSpaciousInformationActions")).toBe(true);
});

test("shows only the highest-priority information influence and blocks Vortox truth", () => {
  const influencedStep: PhaseStep = {
    ...step,
    informationPrompt: {
      ...step.informationPrompt!,
      deliveryMode: "selectable",
      activeReasons: [
        { type: "drunk" },
        { type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" },
        { type: "vortox", demonPlayerId: "player-7" },
      ],
      numberChoices: [0, 1, 2].map((value) => ({ value, isComputed: value === 1, registrationJudgments: [] })),
    },
  };
  render(<SectsAndVioletsInformationTask step={influencedStep} actor={actor} revealed={false} busy={false} onReveal={() => undefined} />);

  const task = screen.getByRole("article", { name: "시계공 정보" });
  expect(within(task).getByText("보르톡스").classList.contains("vortox")).toBe(true);
  expect(within(task).queryByText("중독")).toBeNull();
  expect(within(task).queryByText("취함")).toBeNull();
  const reveal = within(task).getByRole("button", { name: "거짓 정보 공개" });
  expect(reveal.classList.contains("vortox")).toBe(true);
  expect(within(task).getByRole("combobox", { name: "전달할 정보" }).querySelectorAll("option")).toHaveLength(2);
  expect(within(task).queryByRole("option", { name: "1칸" })).toBeNull();
});

test.each([
  {
    reason: { type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" } as const,
    badge: "중독",
    action: "중독 정보 공개",
    className: "poisoned",
  },
  {
    reason: { type: "drunk" } as const,
    badge: "취함",
    action: "취한 정보 공개",
    className: "drunk",
  },
])("presents $badge as a purple discretionary information state", ({ reason, badge, action, className }) => {
  const influencedStep: PhaseStep = {
    ...step,
    informationPrompt: {
      ...step.informationPrompt!,
      deliveryMode: "selectable",
      activeReasons: [reason],
      numberChoices: [0, 1, 2].map((value) => ({ value, isComputed: value === 1, registrationJudgments: [] })),
    },
  };
  render(<SectsAndVioletsInformationTask step={influencedStep} actor={actor} revealed={false} busy={false} onReveal={() => undefined} />);

  const task = screen.getByRole("article", { name: "시계공 정보" });
  expect(within(task).getByText(badge).classList.contains(className)).toBe(true);
  expect(within(task).getByRole("button", { name: action }).classList.contains(className)).toBe(true);
  expect(within(task).getByRole("combobox", { name: "전달할 정보" }).querySelectorAll("option")).toHaveLength(3);
});

test("Dreamer exposes the selected target truth and the full legal opposite-alignment catalog", () => {
  const dreamerStep: PhaseStep = {
    ...step,
    id: "firstNight:dreamer",
    character: "dreamer",
    requiredInput: { kind: "playerIds", target: "player", minSelections: 1, maxSelections: 1, allowedPlayerIds: ["player-2"], optional: false },
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: [], numberChoices: [], setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: ["player-2"],
        computedResult: { kind: "character", characterId: "seamstress" },
        choices: ["evilTwin", "witch", "cerenovus", "pitHag", "fangGu", "vigormortis", "noDashii", "vortox"].map((evil) => ({
          result: { kind: "characterPair" as const, characterIds: ["seamstress", evil] as [string, string] },
          isComputed: true,
          registrationJudgments: [],
        })),
      }],
    },
  };
  const target: Player = { ...actor, id: "player-2", seat: 2, name: "유나", actualCharacter: "seamstress", shownCharacter: "seamstress" };
  render(<SectsAndVioletsInformationTask step={dreamerStep} actor={{ ...actor, actualCharacter: "dreamer" }} players={[actor, target]} selectedPlayerIds={["player-2"]} revealed={false} busy={false} onReveal={() => undefined} />);
  const context = screen.getByRole("group", { name: "대상과 진실" });
  expect(context.classList.contains("snvMobileStackedInformationContext")).toBe(true);
  expect(within(context).getByText("대상").nextElementSibling?.textContent).toContain("2번 유나");
  expect(within(context).getByText("진실").nextElementSibling?.textContent).toContain("재봉사");
  expect(screen.getByRole("group", { name: "전달할 캐릭터" }).classList.contains("snvDreamerEditor")).toBe(true);
  expect(screen.getByRole("button", { name: "정보 공개" }).parentElement?.classList.contains("snvTargetedInformationActions")).toBe(true);
  const fixedGoodCharacter = screen.getByRole("combobox", { name: "선한 캐릭터" }) as HTMLSelectElement;
  expect(fixedGoodCharacter.disabled).toBe(true);
  expect(fixedGoodCharacter.classList.contains("snvDreamerLockedSelect")).toBe(true);
  expect(screen.queryByText("고정")).toBeNull();
  expect(screen.getByRole("combobox", { name: "악한 캐릭터" }).querySelectorAll("option")).toHaveLength(8);
});

test("Dreamer pending-target card keeps the established manual-step presentation", () => {
  const dreamerStep: PhaseStep = {
    ...step,
    id: "firstNight:dreamer",
    character: "dreamer",
    requiredInput: { kind: "playerIds", target: "player", minSelections: 1, maxSelections: 1, allowedPlayerIds: ["player-2"], optional: false },
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: [], numberChoices: [], setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: ["player-2"],
        computedResult: { kind: "character", characterId: "seamstress" },
        choices: [{
          result: { kind: "characterPair", characterIds: ["seamstress", "witch"] },
          isComputed: true,
          registrationJudgments: [],
        }],
      }],
    },
  };
  const dreamer = { ...actor, actualCharacter: "dreamer", shownCharacter: "dreamer" };
  render(<SectsAndVioletsInformationTask step={dreamerStep} actor={dreamer} revealed={false} busy={false} onChooseTargets={() => undefined} onReveal={() => undefined} />);

  const task = screen.getByRole("article", { name: "꿈꾸는 자 정보" });
  expect(within(task).getByText("현재 할 일")).toBeTruthy();
  const identity = within(task).getByRole("button", { name: "꿈꾸는 자 캐릭터 상세 열기" });
  expect(identity.textContent).toBe("꿈꾸는 자민서");
  expect(within(task).getByRole("button", { name: "대상 선택" })).toBeTruthy();
});

test("Seamstress uses the spacious target context and compact tablet actions", () => {
  const seamstressStep: PhaseStep = {
    ...step,
    id: "firstNight:seamstress",
    character: "seamstress",
    requiredInput: { kind: "playerIds", target: "player", minSelections: 2, maxSelections: 2, allowedPlayerIds: ["player-2", "player-3"], optional: false },
    canSkip: true,
    informationPrompt: {
      deliveryMode: "selectable",
      activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }],
      registrationCandidatePlayerIds: [], numberChoices: [], setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: ["player-2", "player-3"],
        computedResult: { kind: "boolean", value: true },
        choices: [true, false].map((value) => ({ result: { kind: "boolean" as const, value }, isComputed: value, registrationJudgments: [] })),
      }],
    },
  };
  const seamstress = { ...actor, actualCharacter: "seamstress", shownCharacter: "seamstress" };
  const players = [
    seamstress,
    { ...actor, id: "player-2", seat: 2, name: "유나", actualCharacter: "dreamer", shownCharacter: "dreamer" },
    { ...actor, id: "player-3", seat: 3, name: "도윤", actualCharacter: "sage", shownCharacter: "sage" },
  ];
  const { rerender } = render(<SectsAndVioletsInformationTask step={seamstressStep} actor={seamstress} players={players} revealed={false} busy={false} onReveal={() => undefined} />);
  const pending = screen.getByRole("article", { name: "재봉사 정보" });
  expect(within(pending).getByText("현재 할 일")).toBeTruthy();
  expect(pending.classList.contains("snvInformationTaskPending")).toBe(true);

  rerender(<SectsAndVioletsInformationTask step={seamstressStep} actor={seamstress} players={players} selectedPlayerIds={["player-2", "player-3"]} revealed={false} busy={false} onReveal={() => undefined} />);
  const context = screen.getByRole("group", { name: "대상과 진실" });
  expect(context.classList.contains("snvMobileStackedInformationContext")).toBe(true);
  expect(within(context).getByText("대상").nextElementSibling?.textContent).toContain("2번 유나 · 3번 도윤");
  expect(within(context).getByText("진실").nextElementSibling?.textContent).toContain("같은 진영");
  expect(screen.getByRole("group", { name: "전달할 정보" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "중독 정보 공개" }).parentElement?.classList.contains("snvTargetedInformationActions")).toBe(true);
});

test("Sage uses the spacious killer and candidate layout with compact tablet actions", () => {
  const sageStep: PhaseStep = {
    ...step,
    id: "night:sage",
    phase: "night",
    character: "sage",
    requiredInput: { kind: "none", optional: false },
    informationPrompt: {
      computedResult: { kind: "player", playerId: "player-3" },
      deliveryMode: "selectable",
      activeReasons: [], registrationCandidatePlayerIds: [], numberChoices: [], setupInfoRegistrationOptions: [],
      targetChecks: [{
        targetPlayerIds: [],
        computedResult: { kind: "player", playerId: "player-3" },
        choices: [
          { result: { kind: "playerPair" as const, playerIds: ["player-2", "player-3"] as [string, string] }, isComputed: true, registrationJudgments: [] },
          { result: { kind: "playerPair" as const, playerIds: ["player-3", "player-2"] as [string, string] }, isComputed: true, registrationJudgments: [] },
        ],
      }],
    },
  };
  const sage = { ...actor, actualCharacter: "sage", shownCharacter: "sage" };
  const players = [sage, { ...actor, id: "player-2", seat: 2, name: "유나" }, { ...actor, id: "player-3", seat: 3, name: "도윤" }];
  render(<SectsAndVioletsInformationTask step={sageStep} actor={sage} players={players} revealed={false} busy={false} onReveal={() => undefined} />);

  expect(screen.getByRole("group", { name: "살해자 정보" }).textContent).toContain("3번 도윤");
  expect(screen.getByRole("group", { name: "전달할 두 후보" }).classList.contains("snvSageEditor")).toBe(true);
  expect(screen.getByRole("button", { name: "후보 순서 바꾸기" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "정보 공개" }).parentElement?.classList.contains("snvTargetedInformationActions")).toBe(true);
});

test("Flowergirl, Town Crier, and Oracle share the spacious tablet information layout", () => {
  for (const characterId of ["flowergirl", "townCrier", "oracle"] as const) {
    const informationPrompt: NonNullable<PhaseStep["informationPrompt"]> = characterId === "oracle" ? {
      computedResult: { kind: "number", value: 1 },
      deliveryMode: "selectable",
      activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }],
      registrationCandidatePlayerIds: [],
      numberChoices: [0, 1, 2].map((value) => ({ value, isComputed: value === 1, registrationJudgments: [] })),
      setupInfoRegistrationOptions: [],
    } : {
      computedResult: { kind: "boolean", value: true },
      deliveryMode: "selectable",
      activeReasons: [{ type: "poisoned", poisonerPlayerId: "player-4", poisonEventId: "poison-1" }],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      booleanChoices: [true, false].map((value) => ({ value, isComputed: value, registrationJudgments: [] })),
      setupInfoRegistrationOptions: [],
    };
    const informationStep: PhaseStep = { ...step, id: `night:${characterId}`, phase: "night", character: characterId, informationPrompt };
    const roleActor = { ...actor, actualCharacter: characterId, shownCharacter: characterId };
    const { unmount } = render(<SectsAndVioletsInformationTask step={informationStep} actor={roleActor} revealed={false} busy={false} onReveal={() => undefined} />);

    const task = screen.getByRole("article", { name: `${characterId === "flowergirl" ? "꽃팔이 소녀" : characterId === "townCrier" ? "포고꾼" : "예언자"} 정보` });
    expect(task.querySelector(".snvSpaciousInformationContext")).toBeTruthy();
    expect(task.querySelector(".snvSpaciousInformationEditor")).toBeTruthy();
    expect(within(task).getByRole("button", { name: "중독 정보 공개" }).parentElement?.classList.contains("snvSpaciousInformationActions")).toBe(true);
    unmount();
  }
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
