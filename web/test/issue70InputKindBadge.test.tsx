import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ClocktowerApp } from "../src/main";
import {
  createCoreHarness,
  event,
  gameFile,
  MemoryGameStorageDriver,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

test("omits the input-kind badge from a no-input current step", async () => {
  const currentStep = step({
    id: "day:whisper",
    phase: "day",
    stepType: "whisper",
  });

  renderLiveStep(currentStep);

  await screen.findByRole("heading", { name: "밀담" });
  expect(screen.getByText("낮", { selector: ".eyebrow" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "토론 시작" })).toBeTruthy();
  expect(screen.queryByText("없음")).toBeNull();
  expect(screen.getByText("설정 확정")).toBeTruthy();
});

test("omits the input-kind badge from a player-selection current step", async () => {
  const currentStep = step({
    id: "firstNight:poisoner",
    character: "poisoner",
    playerId: "player-4",
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
  });

  renderLiveStep(currentStep);

  await screen.findByRole("heading", { name: "독살자: 4번 Dae" });
  expect(screen.getByText("첫 밤", { selector: ".eyebrow" })).toBeTruthy();
  expect(screen.getByText("중독시킬 플레이어 1명을 선택하세요.")).toBeTruthy();
  expect(screen.getByLabelText("단계 입력")).toBeTruthy();
  expect(screen.queryByText("플레이어")).toBeNull();
  expect(screen.getByText("설정 확정")).toBeTruthy();
});

test("omits the input-kind badge from a numeric-information current step", async () => {
  const currentStep = step({
    id: "firstNight:chef",
    character: "chef",
    playerId: "player-2",
    kind: "number",
    informationPrompt: {
      computedResult: { kind: "number", value: 0 },
      deliveryMode: "selectable",
      activeReasons: [],
      registrationCandidatePlayerIds: [],
      numberChoices: [
        { value: 0, isComputed: true, registrationJudgments: [] },
        { value: 1, isComputed: false, registrationJudgments: [] },
      ],
      setupInfoRegistrationOptions: [],
    },
  });

  renderLiveStep(currentStep);

  await screen.findByRole("heading", { name: "요리사: 2번 Bert" });
  expect(screen.getByText("첫 밤", { selector: ".eyebrow" })).toBeTruthy();
  expect(screen.getByText("전달할 악 팀 이웃 쌍의 수를 선택하세요.")).toBeTruthy();
  expect(screen.getByLabelText("전달할 숫자")).toBeTruthy();
  expect(screen.queryByText("숫자")).toBeNull();
  expect(screen.getByText("설정 확정")).toBeTruthy();
});

function renderLiveStep(currentStep: ReturnType<typeof step>) {
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused", currentStep.phase)),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}
