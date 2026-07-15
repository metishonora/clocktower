import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { SetupInfoContextPrototype } from "../src/setupInfoContextPrototype";

test("compares three Storyteller-only candidate context placements", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-context&variant=C");

  render(<SetupInfoContextPrototype />);

  const variants = screen.getByLabelText("프로토타입 표시 방식");
  expect(within(variants).getByRole("button", { name: /별도 비교 영역/ }).getAttribute("aria-pressed")).toBe("true");
  const comparison = screen.getByLabelText("선택한 후보 비교");
  expect(within(comparison).getByText("실제: 술꾼")).toBeTruthy();
  expect(within(comparison).getByText("본인 인식: 수도사")).toBeTruthy();

  await user.click(within(variants).getByRole("button", { name: /선택 카드만 확장/ }));
  expect(screen.queryByLabelText("선택한 후보 비교")).toBeNull();
  const candidateGrid = screen.getByLabelText("설정 정보 후보 선택");
  const drunkCandidate = within(candidateGrid).getByRole("button", { name: /3.*서연/ });
  expect(within(drunkCandidate).getByText("실제: 술꾼")).toBeTruthy();
  expect(within(candidateGrid).getByRole("button", { name: /1.*민지/ }).textContent).not.toContain("실제:");
});

test("constrains options to selected Actual Characters and removes Storyteller context from Reveal", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-context&variant=C");

  render(<SetupInfoContextPrototype />);

  const characterSelect = screen.getByRole("combobox", { name: /보여줄 캐릭터/ });
  expect(within(characterSelect).getAllByRole("option").map((option) => option.textContent)).toEqual(["술꾼", "성자"]);
  await user.selectOptions(characterSelect, "drunk");
  await user.click(screen.getByRole("button", { name: "안전한 Reveal 확인" }));

  const reveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(reveal).getByText("사서 정보: 3번 서연 또는 5번 하린 중 한 명은 술꾼입니다.")).toBeTruthy();
  expect(screen.queryByText("실제: 술꾼")).toBeNull();
  expect(screen.queryByText("본인 인식: 수도사")).toBeNull();
  expect(screen.queryByText("그리모어 · 이야기꾼 전용")).toBeNull();
});
