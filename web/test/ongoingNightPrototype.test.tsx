import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { OngoingNightPrototype } from "../src/ongoingNightPrototype";

function state() {
  return JSON.parse(screen.getByTestId("ongoing-night-prototype-state").textContent ?? "{}");
}

test("covers deterministic ongoing-night scenarios and exact operational cues", async () => {
  const user = userEvent.setup();
  render(<OngoingNightPrototype />);

  expect(screen.queryByText("등록 판정")).toBeNull();
  expect(screen.queryByText("선한 팀으로 등록")).toBeNull();
  expect(screen.queryByText(/주민/)).toBeNull();
  expect(screen.getByText("독살범")).toBeTruthy();
  expect(state().selectedPlayerIds).toEqual(["p2"]);

  await user.click(screen.getByRole("button", { name: "중독 · 보호" }));
  expect(screen.getAllByText("중독").length).toBeGreaterThan(0);
  expect(screen.getAllByText("보호").length).toBeGreaterThan(0);
  expect(screen.getByText("중독", { selector: ".onpSeatBadge.poison" })).toBeTruthy();
  expect(screen.getByText("보호", { selector: ".onpSeatBadge.protect" })).toBeTruthy();
  expect(state().badges).toEqual({ p1: "중독", p3: "보호" });
  expect(state().selectedPlayerIds).toEqual([]);
  expect(screen.queryByRole("button", { name: "확정" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "임프 결과" }));
  expect(state().selectedPlayerIds).toEqual(["p3"]);
  expect(screen.getByText("3번 서연 - 수도승에 의해 보호됨")).toBeTruthy();
  expect(screen.queryByText("DEMON_ATTACK_PREVENTED")).toBeNull();
  await user.click(screen.getByRole("button", { name: "까마귀지기 사망" }));
  expect(screen.getByText("5번 하린 - 사망")).toBeTruthy();
  expect(screen.queryByText("다음: 까마귀지기 정보 전달")).toBeNull();
  expect(state().impOutcome).toBe("ravenkeeperDeath");
  expect(state().selectedPlayerIds).toEqual(["p5"]);

  await user.click(screen.getByRole("button", { name: "정보" }));
  expect(state().infoRole).toBe("fortuneTeller");
  expect(state().selectedPlayerIds).toEqual(["p3", "p7"]);
  expect(screen.getByRole("heading", { name: "점쟁이 결과" })).toBeTruthy();
  expect(screen.getByText("악마 있음")).toBeTruthy();
  expect(screen.queryByText("정보 전달")).toBeNull();
  expect(screen.queryByText("계산값")).toBeNull();
  expect(screen.queryByText("2명")).toBeNull();
  expect(screen.getByRole("button", { name: "Reveal" })).toBeTruthy();
  expect(
    screen
      .getAllByRole("button")
      .filter((button) => button.classList.contains("onpSeat"))
      .every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true);

  await user.click(screen.getByRole("button", { name: "사망 없음" }));
  expect(state().selectedPlayerIds).toEqual([]);
  const emptyAnnouncementPanel = within(screen.getByLabelText("밤 행동 패널"));
  expect(emptyAnnouncementPanel.getByText("사망자 없음")).toBeTruthy();
  expect(emptyAnnouncementPanel.queryByLabelText("사망")).toBeNull();
  expect(screen.getByRole("button", { name: "사망자 없음 발표 확정" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "사망 있음" }));
  expect(state().selectedPlayerIds).toEqual(["p5"]);
  const announcementPanel = within(screen.getByLabelText("밤 행동 패널"));
  expect(announcementPanel.getByLabelText("사망")).toBeTruthy();
  expect(announcementPanel.getByText("5번")).toBeTruthy();
  expect(announcementPanel.getByText("하린")).toBeTruthy();
  expect(announcementPanel.queryByText("사망자 없음")).toBeNull();
  expect(screen.queryByText("살아있는 플레이어 6")).toBeNull();
  await user.click(screen.getByRole("button", { name: "사망 발표 확정" }));
  expect(state().confirmed).toBe(true);
});
