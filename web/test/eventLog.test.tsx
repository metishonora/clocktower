import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { EventLog } from "../src/features/event-log/EventLog";

test("collapsed Event Log keeps event, error, and warning counts visible", async () => {
  const user = userEvent.setup();
  render(
    <EventLog
      events={[]}
      proposalResult={{
        ok: false,
        error: { code: "invalid_step_input", messageKo: "입력을 확인하세요." },
      }}
      warnings={[{ code: "warning", severity: "warning", messageKo: "확인 필요" }]}
    />,
  );

  const details = screen.getByText("이벤트 로그").closest("details") as HTMLDetailsElement;
  expect(details.open).toBe(false);
  expect(within(details).getByText("0건 · 오류 1 · 경고 1")).toBeTruthy();
  await user.click(within(details).getByText("이벤트 로그"));
  expect(details.open).toBe(true);
  expect(screen.getByText("입력을 확인하세요.")).toBeTruthy();
  expect(screen.getByText("확인 필요")).toBeTruthy();
});
