import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue27CurrentActionPrototype } from "../src/issue27CurrentActionPrototype";

test("shows representative verbose current-action instructions and gates required selections", async () => {
  const user = userEvent.setup();
  render(<Issue27CurrentActionPrototype />);

  const prototype = screen.getByRole("main", { name: "현재 행동 안내 프로토타입" });
  expect(within(prototype).getByText("6번 지우")).toBeTruthy();
  expect(within(prototype).getByRole("heading", { name: "독살자" })).toBeTruthy();
  expect(within(prototype).getByText("밤마다 한 명을 다음 해질녘까지 중독시킵니다.")).toBeTruthy();
  expect(within(prototype).getByText("중독시킬 플레이어 1명을 선택하세요.")).toBeTruthy();

  const confirm = within(prototype).getByRole("button", { name: "확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await user.click(within(prototype).getByRole("button", { name: /2번 준호/ }));
  expect(confirm.disabled).toBe(false);

  await user.click(within(prototype).getByRole("button", { name: "요리사 · 정보 전용" }));
  expect(within(prototype).getByText("전달할 악 팀 이웃 쌍의 수를 선택하세요.")).toBeTruthy();
  const chefConfirm = within(prototype).getByRole("button", { name: "확정" }) as HTMLButtonElement;
  expect(chefConfirm.disabled).toBe(true);
  await user.click(within(prototype).getByRole("radio", { name: "1쌍" }));
  expect(chefConfirm.disabled).toBe(false);

  await user.click(within(prototype).getByRole("button", { name: "처형 · 결과 대상" }));
  const subject = within(prototype).getByLabelText("처형 대상");
  expect(within(subject).getByText("5번 하린")).toBeTruthy();
  expect(within(subject).getByText("은둔자")).toBeTruthy();
  expect(within(prototype).queryByText("행동자")).toBeNull();
  expect(within(prototype).queryByText("처형된 플레이어가 사망했는지 확인하세요.")).toBeNull();
  expect(within(prototype).queryByRole("button", { name: "생존 확정" })).toBeNull();
  expect(within(prototype).queryByRole("button", { name: "사망 확정" })).toBeNull();
  expect(within(prototype).getByRole("button", { name: "확정" })).toBeTruthy();
});
