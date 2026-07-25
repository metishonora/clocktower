import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue105MadnessPrototype } from "../src/issue105MadnessPrototype";

test("ends the remaining day after a madness execution", async () => {
  const user = userEvent.setup();
  render(<Issue105MadnessPrototype />);

  await user.click(screen.getByRole("button", { name: /변종의 외지인 집착 확인 열기/ }));
  const check = screen.getByRole("dialog", { name: "변종의 외지인 집착 확인" });
  await user.click(within(check).getByRole("button", { name: "외지인임을 집착함" }));
  await user.click(within(check).getByRole("button", { name: "처형" }));
  await user.click(within(screen.getByRole("alertdialog", { name: "광기 처형 확인" })).getByRole("button", { name: "처형 확정" }));

  const progress = screen.getByRole("region", { name: "2일차 낮 진행" });
  expect(within(progress).getByText("남은 낮 진행").previousElementSibling?.textContent).toBe("종료");
  await user.click(within(progress).getByRole("button", { name: "사망 확인" }));
  expect(screen.getByRole("region", { name: "2일차 밤 진행" })).toBeTruthy();
  expect(screen.getByRole("status", { name: "광기 처형 후 밤 시작" })).toBeTruthy();
});

test("returns to the interrupted night action after a madness execution", async () => {
  const user = userEvent.setup();
  render(<Issue105MadnessPrototype />);

  await user.click(screen.getByRole("button", { name: "밤 · 처형 후 복귀" }));
  const check = screen.getByRole("dialog", { name: "세레노버스 대상의 집착 확인" });
  await user.click(within(check).getByRole("button", { name: "처형" }));
  await user.click(within(screen.getByRole("alertdialog", { name: "광기 처형 확인" })).getByRole("button", { name: "처형 확정" }));

  const death = screen.getByRole("group", { name: "광기 처형 사망 확인" });
  expect(within(death).getByAltText("세레노버스 공식 캐릭터 아이콘")).toBeTruthy();
  await user.click(within(death).getByRole("button", { name: "사망 확인" }));
  expect(screen.getByRole("status", { name: "광기 처형 후 밤 단계 복귀" })).toBeTruthy();
  expect(screen.getByText("중단 지점 복귀")).toBeTruthy();
});

test("shows both independent madness sources in player details", async () => {
  const user = userEvent.setup();
  render(<Issue105MadnessPrototype />);

  await user.click(screen.getByRole("button", { name: "마도서" }));
  await user.click(screen.getByRole("button", { name: "4번 좌석, 도윤, 변종, 광기 확인 2건" }));

  const details = screen.getByRole("dialog", { name: "4번 도윤 플레이어 상세" });
  expect(within(details).getByText("광기 확인")).toBeTruthy();
  expect(within(details).getByText("집착 · 시계공")).toBeTruthy();
});
