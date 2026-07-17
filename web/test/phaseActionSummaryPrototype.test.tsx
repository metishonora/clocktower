import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { App } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

function renderPrototype() {
  window.history.replaceState(null, "", "/?prototype=phase-action-summaries");
  const currentStep = step({ id: "firstNight:chef" });
  const replay = replayState({ currentStep });
  const core = createCoreHarness({
    initialReplay: replay,
    replayAfterProposal: replay,
    proposal: proposal(event("unused", "unused")),
  });

  render(<App coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

test("compares current and proposed summaries inside the existing Event Log surface", async () => {
  renderPrototype();

  const prototype = await screen.findByRole("main", { name: "단계 행동 상세 요약 프로토타입" });
  const current = within(prototype).getByLabelText("현재 요약 이벤트 로그");
  const proposed = within(prototype).getByLabelText("제안 요약 이벤트 로그");

  expect(within(current).getByText("요리사가 0쌍을 확인했습니다.")).toBeTruthy();
  expect(
    within(proposed).getByText("2번 준호(요리사)가 0쌍을 확인했습니다."),
  ).toBeTruthy();
  expect(within(current).getByText("이벤트 로그")).toBeTruthy();
  expect(within(proposed).getByText("이벤트 로그")).toBeTruthy();
});

test("switches between information, targeting, drunk, and mayor-bounce examples", async () => {
  const user = userEvent.setup();
  renderPrototype();
  const prototype = await screen.findByRole("main", { name: "단계 행동 상세 요약 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "대상 정보" }));
  expect(
    within(prototype).getByText(
      "4번 도윤(점쟁이)가 1번 민지(세탁부), 6번 현우(임프)를 확인: 악마 있음",
    ),
  ).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "술꾼 행동자" }));
  expect(
    within(prototype).getByText(
      "8번 유나(세탁부 능력, 실제 술꾼)가 2번 준호(요리사), 3번 서연(공감능력자) 중 한 명을 요리사로 확인했습니다.",
    ),
  ).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "시장 바운스" }));
  expect(
    within(prototype).getByText(
      "6번 현우(임프) → 7번 하린(시장) 공격 · 3번 서연(공감능력자)에게 바운스 · 사망",
    ),
  ).toBeTruthy();
});

test("shows outcome and audit context for applied and no-effect actions", async () => {
  const user = userEvent.setup();
  renderPrototype();
  const prototype = await screen.findByRole("main", { name: "단계 행동 상세 요약 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "대상 행동" }));
  expect(
    within(prototype).getByText("5번 지우(독살자) → 2번 준호(요리사) · 중독 적용"),
  ).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "효과 없음" }));
  expect(
    within(prototype).getByText(
      "8번 유나(수도사 능력, 실제 술꾼) → 6번 현우(임프) · 효과 없음 (실제 수도사 아님)",
    ),
  ).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "재량 정보" }));
  expect(
    within(prototype).getByText(
      "2번 준호(요리사)가 0쌍을 확인했습니다. (실제 1쌍 · 중독)",
    ),
  ).toBeTruthy();
});
