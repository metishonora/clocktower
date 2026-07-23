import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { Issue120EventLogPrototype } from "../src/issue120EventLogPrototype";

beforeEach(() => window.history.replaceState(null, "", "/?prototype=issue-120-event-log"));

test("keeps one global Undo control beside the phase mark on every page", async () => {
  const user = userEvent.setup();
  render(<Issue120EventLogPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 120 이벤트 로그 프로토타입" });
  const header = within(prototype).getByRole("banner");
  const phaseActions = within(header).getByLabelText("현재 페이즈와 되돌리기");
  const undo = within(phaseActions).getByRole("button", {
    name: "최근 행동 되돌리기: 4번 도윤 처형 · 사망",
  });
  expect(undo.nextElementSibling?.getAttribute("aria-label")).toBe("2일차 낮");

  for (const tab of ["마도서", "진행", "저장 / 불러오기"]) {
    await user.click(within(prototype).getByRole("button", { name: tab }));
    expect(within(header).getByRole("button", { name: /최근 행동 되돌리기/ })).toBe(undo);
  }

  const storage = within(prototype).getByRole("region", { name: "저장 및 불러오기" });
  expect(within(storage).queryByRole("button", { name: /되돌리기/ })).toBeNull();
  expect(within(storage).queryByText("최근 완료 행동")).toBeNull();
});

test("shows an always-open scrollable Event Log in newest-first presentation order", async () => {
  const user = userEvent.setup();
  render(<Issue120EventLogPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 120 이벤트 로그 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "저장 / 불러오기" }));
  const log = within(prototype).getByRole("region", { name: "이벤트 로그" });
  expect(log.querySelector("details")).toBeNull();
  expect(within(log).getByText("10건")).toBeTruthy();
  const list = within(log).getByRole("list", { name: "확정 이벤트 최신순" });
  expect(list.classList.contains("issue120ScrollableEventList")).toBe(true);
  expect(list.getAttribute("tabindex")).toBe("0");
  const summaries = within(list).getAllByRole("listitem").map((item) => item.textContent);
  expect(summaries[0]).toContain("처형 결과: 4번 도윤 사망");
  expect(summaries.at(-1)).toContain("초기 설정 확정: 7명");
});

test("confirms the latest checkpoint summary and removes its grouped events", async () => {
  const user = userEvent.setup();
  render(<Issue120EventLogPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 120 이벤트 로그 프로토타입" });
  const undo = within(prototype).getByRole("button", { name: /최근 행동 되돌리기/ });

  await user.click(undo);
  let dialog = screen.getByRole("dialog", { name: "최근 완료 행동을 되돌릴까요?" });
  expect(within(dialog).getByText("되돌릴 행동: 4번 도윤 처형 · 사망")).toBeTruthy();
  const cancel = within(dialog).getByRole("button", { name: "취소" });
  const confirm = within(dialog).getByRole("button", { name: "되돌리기" });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(confirm);
  await user.tab();
  expect(document.activeElement).toBe(cancel);
  await user.click(cancel);
  await waitFor(() => expect(document.activeElement).toBe(undo));

  await user.click(undo);
  dialog = screen.getByRole("dialog", { name: "최근 완료 행동을 되돌릴까요?" });
  await user.click(within(dialog).getByRole("button", { name: "되돌리기" }));
  await user.click(within(prototype).getByRole("button", { name: "저장 / 불러오기" }));

  const log = within(prototype).getByRole("region", { name: "이벤트 로그" });
  expect(within(log).queryByText(/4번 도윤 처형 확정/)).toBeNull();
  expect(within(log).queryByText(/처형 결과: 4번 도윤 사망/)).toBeNull();
  expect(within(log).getByText("8건")).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: /최근 행동 되돌리기: 2번 현우 → 4번 도윤 지명 투표/ })).toBeTruthy();
});

test("hides setup-only Undo and disables an eligible Undo while a transition is busy", async () => {
  const user = userEvent.setup();
  render(<Issue120EventLogPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 120 이벤트 로그 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "설정만 확정" }));
  expect(within(prototype).queryByRole("button", { name: /최근 행동 되돌리기/ })).toBeNull();

  await user.click(within(prototype).getByRole("button", { name: "전환 중" }));
  const undo = within(prototype).getByRole("button", { name: /최근 행동 되돌리기/ }) as HTMLButtonElement;
  expect(undo.disabled).toBe(true);
});

test("uses a modal for serious failures and a persistent bottom notification for warnings", async () => {
  const user = userEvent.setup();
  render(<Issue120EventLogPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 120 이벤트 로그 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "심각한 오류 보기" }));
  const errorDialog = screen.getByRole("dialog", { name: "작업을 완료하지 못했습니다" });
  expect(within(errorDialog).getByText("가져온 게임을 끝까지 재생하지 못했습니다. 현재 게임은 그대로 유지됩니다.")).toBeTruthy();
  await user.click(within(errorDialog).getByRole("button", { name: "확인" }));

  await user.click(within(prototype).getByRole("button", { name: "경고 보기" }));
  const warning = within(prototype).getByRole("status", { name: "게임 경고" });
  expect(within(warning).getByText("보르톡스가 살아 있습니다. 정보가 거짓이어야 하는지 확인하세요.")).toBeTruthy();
  await user.click(within(warning).getByRole("button", { name: "경고 닫기" }));
  expect(within(prototype).queryByRole("status", { name: "게임 경고" })).toBeNull();
});
