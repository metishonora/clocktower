import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue64EvilInfoRevealPrototype } from "../src/issue64EvilInfoRevealPrototype";

test("keeps the confirmed Minion follow-up concise and opens a safe identity-only Reveal", async () => {
  const user = userEvent.setup();
  render(<Issue64EvilInfoRevealPrototype />);

  const followup = screen.getByRole("region", { name: "확정된 Reveal 후속 조치" });
  expect(within(followup).getByRole("heading", { name: "하수인 깨우기 · 악마와 동료 하수인 확인" })).toBeTruthy();
  expect(within(followup).getByRole("button", { name: "플레이어에게 공개" })).toBeTruthy();
  expect(within(followup).getByRole("button", { name: "다음 단계로 계속" })).toBeTruthy();
  expect(within(followup).queryByText(/확정됨|리플레이|다시 열|숨김/)).toBeNull();

  await user.click(within(followup).getByRole("button", { name: "플레이어에게 공개" }));

  const reveal = screen.getByRole("main", { name: "플레이어 공개 화면" });
  expect(within(reveal).getByText("하수인 정보")).toBeTruthy();
  expect(within(reveal).getByRole("heading", { name: "악마와 동료 하수인을 확인하세요" })).toBeTruthy();
  const content = within(reveal).getByRole("region", { name: "하수인 정보 내용" });
  expect(within(content).getByText("5번 하린")).toBeTruthy();
  expect(within(content).getByText("4번 도윤")).toBeTruthy();
  expect(within(content).getByText("7번 유진")).toBeTruthy();
  expect(within(content).queryByText(/독살자|남작|poisoner|baron/)).toBeNull();
});

test("renders Demon bluffs with official CharacterIcon assets without exposing Minion roles", async () => {
  const user = userEvent.setup();
  render(<Issue64EvilInfoRevealPrototype />);

  await user.click(screen.getByRole("button", { name: "악마 정보" }));
  expect(screen.getByRole("heading", { name: "악마 깨우기 · 하수인과 블러프 확인" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "플레이어에게 공개" }));

  const reveal = screen.getByRole("main", { name: "플레이어 공개 화면" });
  expect(within(reveal).getByText("악마 정보")).toBeTruthy();
  expect(within(reveal).getByRole("heading", { name: "하수인과 블러프를 확인하세요" })).toBeTruthy();
  const content = within(reveal).getByRole("region", { name: "악마 정보 내용" });
  expect(within(content).getByText("4번 도윤")).toBeTruthy();
  expect(within(content).getByText("7번 유진")).toBeTruthy();
  expect(within(content).queryByText(/독살자|남작|poisoner|baron/)).toBeNull();

  expect(within(content).getByRole("img", { name: "사서 공식 캐릭터 아이콘" }).getAttribute("src"))
    .toBe("/assets/characters/tb/librarian_g.webp");
  expect(within(content).getByRole("img", { name: "장의사 공식 캐릭터 아이콘" }).getAttribute("src"))
    .toBe("/assets/characters/tb/undertaker_g.webp");
  expect(within(content).getByRole("img", { name: "집사 공식 캐릭터 아이콘" }).getAttribute("src"))
    .toBe("/assets/characters/tb/butler_g.webp");
});

test("shows one concise waiting state and disables continue until replay is ready", async () => {
  const user = userEvent.setup();
  render(<Issue64EvilInfoRevealPrototype />);

  await user.click(screen.getByRole("button", { name: "리플레이 대기 상태 보기" }));

  const followup = screen.getByRole("region", { name: "확정된 Reveal 후속 조치" });
  expect(within(followup).getByText("다음 단계 준비 중")).toBeTruthy();
  expect((within(followup).getByRole("button", { name: "다음 단계로 계속" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(followup).queryByText(/이벤트 확정|다음 상태 재생|명시적으로 계속/)).toBeNull();
});
