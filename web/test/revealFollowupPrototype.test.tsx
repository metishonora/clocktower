import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { RevealFollowupPrototype } from "../src/revealFollowupPrototype";

test("prototype reopens the same confirmed Reveal until explicit continue", async () => {
  const user = userEvent.setup();

  render(<RevealFollowupPrototype />);

  const followup = screen.getByLabelText("확정된 Reveal 후속 조치");
  expect((within(followup).getByRole("button", { name: "다음 단계로 계속" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole("heading", { name: "초공감자: 3번 서연" })).toBeNull();

  await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));
  const firstReveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(firstReveal).getByRole("heading", { name: "서로 이웃한 악한 팀 쌍" })).toBeTruthy();
  expect(within(firstReveal).getByText("1쌍")).toBeTruthy();
  await user.click(within(firstReveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));

  await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));
  const reopenedReveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(reopenedReveal).getByRole("heading", { name: "서로 이웃한 악한 팀 쌍" })).toBeTruthy();
  expect(within(reopenedReveal).getByText("1쌍")).toBeTruthy();
  await user.click(within(reopenedReveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));

  expect(screen.getByText("확정 이벤트 3개")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "다음 단계로 계속" }));
  expect(await screen.findByRole("heading", { name: "초공감자: 3번 서연" })).toBeTruthy();
  expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
});
