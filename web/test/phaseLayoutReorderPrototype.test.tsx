import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { PhaseLayoutReorderPrototype } from "../src/phaseLayoutReorderPrototype";

function prototypeState() {
  return JSON.parse(screen.getByTestId("phase-layout-reorder-prototype-state").textContent ?? "{}");
}

beforeEach(() => window.history.replaceState(null, "", "/?prototype=phase-layout-reorder"));

test.each([
  ["Variant A · 세로 목록", "vertical"],
  ["Variant B · 압축 진행표시", "compact"],
])("%s places the phase overview before the current action", async (variantLabel, variant) => {
  const user = userEvent.setup();
  render(<PhaseLayoutReorderPrototype />);

  await user.click(screen.getByRole("button", { name: variantLabel }));

  const panel = screen.getByLabelText("단계 제어 패널");
  const overview = within(panel).getByLabelText("첫 번째 밤 순서");
  const action = within(panel).getByLabelText("현재 단계");
  expect(overview.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(prototypeState()).toMatchObject({ view: "desktop", variant });
});

test("mobile keeps the overview collapsed by default and the current action immediately usable", async () => {
  const user = userEvent.setup();
  render(<PhaseLayoutReorderPrototype />);

  await user.click(screen.getByRole("button", { name: "모바일" }));

  const disclosure = screen.getByLabelText("첫 번째 밤 순서 접기") as HTMLDetailsElement;
  expect(disclosure.open).toBe(false);
  expect(screen.getByRole("button", { name: "확정" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "건너뛰기" })).toBeTruthy();
  expect(prototypeState()).toMatchObject({ view: "mobile", overviewOpen: false });

  await user.click(within(disclosure).getByText("첫 번째 밤 순서", { selector: "summary span" }));

  expect(disclosure.open).toBe(true);
  expect(within(disclosure).getByText("공감능력자: 3번 서연")).toBeTruthy();
  expect(prototypeState()).toMatchObject({ view: "mobile", overviewOpen: true });
});
