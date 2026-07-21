import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { SlayerPublicAbilityPrototype } from "../src/slayerPublicAbilityPrototype";

function state() {
  return JSON.parse(screen.getByTestId("slayer-prototype-state").textContent ?? "{}");
}

test("opens the public ability only from the eligible Slayer icon", async () => {
  const user = userEvent.setup();
  render(<SlayerPublicAbilityPrototype />);

  await user.click(screen.getByRole("button", { name: "3번 서연 처단자 능력 사용" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  expect(within(dialog).getByText("3번 서연 · 처단자")).toBeTruthy();
  expect(within(dialog).getByText("확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.")).toBeTruthy();
  expect((within(dialog).getByRole("button", { name: "처단자 사용 확정" }) as HTMLButtonElement).disabled).toBe(true);
});

test("requires an explicit per-shot Recluse registration decision", async () => {
  const user = userEvent.setup();
  render(<SlayerPublicAbilityPrototype />);

  await user.click(screen.getByRole("button", { name: "3번 서연 처단자 능력 사용" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  await user.click(within(dialog).getByRole("button", { name: "5번 은지" }));
  expect(within(dialog).getByText("이번 판정의 은둔자 등록")).toBeTruthy();
  const confirm = within(dialog).getByRole("button", { name: "처단자 사용 확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await user.click(within(dialog).getByRole("button", { name: "악마로 등록" }));
  expect(confirm.disabled).toBe(false);
  expect(state().registrationDecision).toBe("demon");
});

test("records a miss as spent while keeping Discussion active", async () => {
  const user = userEvent.setup();
  render(<SlayerPublicAbilityPrototype />);

  await user.click(screen.getByRole("button", { name: "3번 서연 처단자 능력 사용" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  await user.click(within(dialog).getByRole("button", { name: "1번 민지" }));
  await user.click(within(dialog).getByRole("button", { name: "처단자 사용 확정" }));
  expect(screen.getByText("아무 일도 일어나지 않음")).toBeTruthy();
  expect(state()).toMatchObject({ stage: "discussion", slayerAbilitySpent: true, dialogOpen: false });
  expect((screen.getByRole("button", { name: "3번 서연 처단자 능력 사용 불가" }) as HTMLButtonElement).disabled).toBe(true);
});

test("routes a successful shot to a distinct Death follow-up", async () => {
  const user = userEvent.setup();
  render(<SlayerPublicAbilityPrototype />);

  await user.click(screen.getByRole("button", { name: "3번 서연 처단자 능력 사용" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  await user.click(within(dialog).getByRole("button", { name: "9번 태오" }));
  await user.click(within(dialog).getByRole("button", { name: "처단자 사용 확정" }));
  const followUp = screen.getByLabelText("처단자 사망 후속");
  expect(within(followUp).getByText("9번 태오")).toBeTruthy();
  expect(within(followUp).getByRole("button", { name: "사망 확정" })).toBeTruthy();
  expect(state()).toMatchObject({ stage: "slayerDeath", slayerAbilitySpent: true, pendingDeathPlayerId: "p9" });
});

test("disables the Slayer icon outside Discussion and after use", async () => {
  const user = userEvent.setup();
  render(<SlayerPublicAbilityPrototype />);

  await user.click(screen.getByRole("button", { name: "지목 단계" }));
  expect((screen.getByRole("button", { name: "3번 서연 처단자 능력 사용 불가" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "토론 · 사용 완료" }));
  expect((screen.getByRole("button", { name: "3번 서연 처단자 능력 사용 불가" }) as HTMLButtonElement).disabled).toBe(true);
});
