import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { PromoCardPrototype } from "../src/promoCardPrototype";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

test("starts sealed and opens the invitation with one accessible activation", async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  const user = userEvent.setup();

  render(<PromoCardPrototype />);

  const trigger = screen.getByRole("button", { name: "봉투 열기" });
  const card = screen.getByLabelText("밀봉된 초대장 봉투");
  const letter = screen.getByLabelText("초대장 본문", { selector: "section" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(card.classList.contains("isOpen")).toBe(false);
  expect(letter.getAttribute("aria-hidden")).toBe("true");

  await user.click(trigger);

  expect(screen.getByRole("button", { name: "초대장이 열렸습니다" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByLabelText("뜯어진 봉투 속 초대장")).toBe(card);
  expect(card.classList.contains("isOpen")).toBe(true);
  expect(letter.getAttribute("aria-hidden")).toBe("false");
});
