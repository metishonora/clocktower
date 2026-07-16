import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue11EdgeRulesPrototype } from "../src/issue11EdgeRulesPrototype";

test("splits a Virgin nomination from voting and exposes the passive ability state", async () => {
  const user = userEvent.setup();
  render(<Issue11EdgeRulesPrototype />);

  expect(screen.getByLabelText("4번 도윤 처녀 능력 사용 가능")).toBeTruthy();
  const nomination = screen.getByLabelText("처녀 지명 확인");
  expect(within(nomination).getByText("3번 서연 → 4번 도윤")).toBeTruthy();
  expect(within(nomination).queryByText(/표/)).toBeNull();

  await user.click(within(nomination).getByRole("button", { name: "지명 확정" }));

  expect(screen.getByLabelText("4번 도윤 처녀 능력 사용 완료")).toBeTruthy();
  const death = screen.getByLabelText("처녀 즉시 처형 사망 확인");
  expect(within(death).getByText("3번 서연")).toBeTruthy();
  expect(within(death).getByRole("button", { name: "사망 확정" })).toBeTruthy();
});

test("shows per-check Spy registration and sends no-execution outcomes to the linked vote", async () => {
  const user = userEvent.setup();
  render(<Issue11EdgeRulesPrototype />);

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "virgin-spy");
  const nomination = screen.getByLabelText("처녀 지명 확인");
  const confirm = within(nomination).getByRole("button", { name: "지명 확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await user.click(within(nomination).getByRole("button", { name: "선한 주민으로 등록" }));
  expect(confirm.disabled).toBe(false);

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "virgin-outsider");
  await user.click(within(screen.getByLabelText("처녀 지명 확인")).getByRole("button", { name: "지명 확정" }));
  const vote = screen.getByLabelText("확정된 지명의 투표");
  expect(within(vote).getByText("7번 현우 → 4번 도윤")).toBeTruthy();
  expect(within(vote).getByText("과반 기준 5표")).toBeTruthy();

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "virgin-poisoned");
  expect(screen.getByText("중독됨 · 능력 소모 · 처형 없음")).toBeTruthy();
});

test("keeps Mayor decisions conditional and previews the resolved death target", async () => {
  const user = userEvent.setup();
  render(<Issue11EdgeRulesPrototype />);

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "mayor-dies");
  expect(screen.getByText("최종 사망 · 7번 현우")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "mayor-living");
  const attack = screen.getByLabelText("시장 공격 해결");
  expect(within(attack).getByText("9번 태오 → 7번 현우")).toBeTruthy();
  await user.click(within(attack).getByRole("button", { name: "다른 플레이어에게 튕김" }));
  await user.click(within(attack).getByRole("button", { name: "1번 민지" }));
  expect(within(attack).getByText("최종 사망 · 1번 민지")).toBeTruthy();

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "mayor-dead");
  expect(screen.getByText("최종 결과 · 사망 없음 (이미 사망)")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "mayor-soldier");
  expect(screen.getByText("최종 결과 · 사망 없음 (군인 보호)")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "mayor-monk");
  expect(screen.getByText("최종 결과 · 사망 없음 (수도사 보호)")).toBeTruthy();
});

test("distinguishes fixed and selectable succession and hands off a narrow new-Imp Reveal", async () => {
  const user = userEvent.setup();
  render(<Issue11EdgeRulesPrototype />);

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "succession-fixed");
  const fixed = screen.getByLabelText("악마 승계 확인");
  expect(within(fixed).getByText("고정 후계자")).toBeTruthy();
  expect(within(fixed).getByText("8번 유나 · 붉은 여인")).toBeTruthy();

  await user.selectOptions(screen.getByLabelText("검토 시나리오"), "succession-selectable");
  const selectable = screen.getByLabelText("악마 승계 확인");
  expect(within(selectable).getByText("후계자 선택")).toBeTruthy();
  await user.click(within(selectable).getByRole("button", { name: "5번 은지 · 스파이" }));
  await user.click(within(selectable).getByRole("button", { name: "새 임프 확정" }));

  const revealEntry = screen.getByLabelText("새 임프 공개 후속");
  await user.click(within(revealEntry).getByRole("button", { name: "플레이어에게 공개" }));
  const reveal = screen.getByLabelText("새 임프 공개 화면");
  expect(within(reveal).getByRole("heading", { name: "당신은 임프입니다" })).toBeTruthy();
  expect(within(reveal).getByText("5번 은지")).toBeTruthy();
  expect(screen.queryByText("그리모어")).toBeNull();
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
  expect(screen.getByLabelText("새 임프 공개 후속")).toBeTruthy();
});
