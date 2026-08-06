import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue114CharacterDetailsPrototype } from "../src/issue114CharacterDetailsPrototype";

test("opens the complete character contract from the role identity without automation copy", async () => {
  const user = userEvent.setup();
  render(<Issue114CharacterDetailsPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 114 캐릭터 상세 프로토타입" });
  const identity = within(prototype).getByRole("button", { name: "철학자 캐릭터 상세 열기" });
  expect(identity.querySelector("img")).toBeTruthy();
  expect(within(identity).getByText("철학자")).toBeTruthy();

  await user.click(identity);
  const dialog = screen.getByRole("dialog", { name: "철학자 캐릭터 상세" });
  expect(within(dialog).getByText("공식 능력")).toBeTruthy();
  expect(within(dialog).getByText("핵심 판정")).toBeTruthy();
  expect(within(dialog).getByText("진행 방법")).toBeTruthy();
  expect(within(dialog).getByText("리마인더")).toBeTruthy();
  expect(within(dialog).getByText("취함")).toBeTruthy();
  expect(within(dialog).getByText("철학자임")).toBeTruthy();
  expect(within(dialog).queryByText(/자동화|자동 지원|수동 처리/)).toBeNull();

  const examples = within(dialog).getByText("공식 예시 3개 보기").closest("details");
  expect(examples?.hasAttribute("open")).toBe(false);
  await user.click(within(dialog).getByText("공식 예시 3개 보기"));
  expect(within(examples as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
  expect(within(dialog).getByRole("link", { name: "공식 규칙 열기" }).getAttribute("href"))
    .toBe("https://wiki.bloodontheclocktower.com/Philosopher");
});

test("opens character rules from the grimoire player identity and restores the nested focus", async () => {
  const user = userEvent.setup();
  render(<Issue114CharacterDetailsPrototype />);

  await user.click(screen.getByRole("button", { name: "마도서" }));
  const grimoire = screen.getByRole("region", { name: "캐릭터 상세 마도서 시료" });
  const seat = within(grimoire).getByRole("button", { name: "6번 유나 좌석, 꿈꾸는 자" });
  await user.click(seat);

  const playerDetail = screen.getByRole("dialog", { name: "6번 유나 플레이어 상세" });
  const identity = within(playerDetail).getByRole("button", { name: "꿈꾸는 자 캐릭터 상세 열기" });
  expect(within(playerDetail).queryByRole("button", { name: /상세 정보|세부 규칙/ })).toBeNull();
  await user.click(identity);

  const characterDetail = screen.getByRole("dialog", { name: "꿈꾸는 자 캐릭터 상세" });
  expect(characterDetail.parentElement?.parentElement).toBe(document.body);
  await user.click(within(characterDetail).getByRole("button", { name: "캐릭터 상세 닫기" }));

  expect(screen.queryByRole("dialog", { name: "꿈꾸는 자 캐릭터 상세" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "6번 유나 플레이어 상세" })).toBe(playerDetail);
  await waitFor(() => expect(document.activeElement).toBe(identity));

  await user.click(within(playerDetail).getByRole("button", { name: "플레이어 상세 닫기" }));
  await waitFor(() => expect(document.activeElement).toBe(seat));
});

test("opens the same rich panel from the current actor identity", async () => {
  const user = userEvent.setup();
  render(<Issue114CharacterDetailsPrototype />);

  await user.click(screen.getByRole("button", { name: "진행" }));
  const progress = screen.getByRole("region", { name: "캐릭터 상세 진행 시료" });
  const identity = within(progress).getByRole("button", { name: "보르톡스 캐릭터 상세 열기" });
  expect(within(identity).getByText("보르톡스")).toBeTruthy();
  expect(within(progress).queryByText("상세 정보")).toBeNull();

  await user.click(identity);
  const dialog = screen.getByRole("dialog", { name: "보르톡스 캐릭터 상세" });
  expect(within(dialog).getByText("공식 예시 5개 보기")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "보르톡스 캐릭터 상세" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(identity));
});
