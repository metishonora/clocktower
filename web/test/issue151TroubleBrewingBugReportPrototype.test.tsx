import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  buildTroubleBrewingBugReport,
  Issue151TroubleBrewingBugReportPrototype,
} from "../src/issue151TroubleBrewingBugReportPrototype";

test("starts with the setup-night TB shell and the full report contract", async () => {
  const user = userEvent.setup();
  render(<Issue151TroubleBrewingBugReportPrototype />);

  const app = screen.getByRole("main", { name: "Trouble Brewing 게임 버그 제보 fixture" });
  expect(app.getAttribute("data-theme")).toBe("night");
  expect(within(app).getByRole("heading", { name: "Trouble Brewing" })).toBeTruthy();
  expect(within(app).getByRole("button", { name: "버그 제보" })).toBeTruthy();
  expect(within(app).getByRole("button", { name: "새 게임" })).toBeTruthy();
  expect(within(app).getByRole("button", { name: "저장 / 불러오기" })).toBeTruthy();
  expect(within(app).getByRole("button", { name: "직업" }).getAttribute("aria-current")).toBe("page");
  expect(within(app).queryByRole("button", { name: "낮" })).toBeNull();

  const report = buildTroubleBrewingBugReport("setup-night");
  expect(report.subject).toBe("[Clocktower Trouble Brewing] 버그 제보");
  expect(report.reportType).toBe("clocktower.trouble-brewing.bug-report");
  expect(report.reportSchemaVersion).toBe(2);
  expect(report.filename).toMatch(/^clocktower-trouble-brewing-bug-report-/);
  expect(report.fixture.game.scriptId).toBe("troubleBrewing");
  expect(report.body).toContain("# Clocktower Trouble Brewing 버그 제보");
  expect(report.body).toContain('"activeTab": "roles"');
  expect(report.body).toContain('"replayPhase": "setup"');
  expect(report.body).toContain('"eventCount": 0');
  expect(report.body).not.toMatch(/setupDraft|Alice|Bob|Private game|플레이어 1/);
  const attachment = JSON.parse(report.attachmentJson);
  expect(attachment).not.toHaveProperty("filename");
  expect(attachment.redaction).toEqual({
    gameName: "replaced",
    playerNames: "seatLabels",
    storytellerNotes: "removed",
  });

  await user.click(within(app).getByRole("button", { name: "버그 제보" }));
  const dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(dialog.getAttribute("data-report-type")).toBe("clocktower.trouble-brewing.bug-report");
  expect(dialog.getAttribute("data-report-schema-version")).toBe("2");
  expect(dialog.getAttribute("data-script-id")).toBe("troubleBrewing");
  expect((within(dialog).getByRole("checkbox", { name: "원본 GameFile JSON도 포함" }) as HTMLInputElement).checked).toBe(false);
  expect(within(dialog).getByText("전송 내용 미리보기").closest("details")?.open).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "버그 제보 닫기" })));
});

test("switching to live day updates the shell and preview context while keeping the dialog open", async () => {
  const user = userEvent.setup();
  render(<Issue151TroubleBrewingBugReportPrototype />);

  await user.click(screen.getByRole("button", { name: "라이브 · 낮" }));
  const app = screen.getByRole("main", { name: "Trouble Brewing 게임 버그 제보 fixture" });
  expect(app.getAttribute("data-theme")).toBe("day");
  expect(within(app).getByRole("img", { name: "낮" })).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "버그 제보" }).getAttribute("data-theme")).toBe("day");
  expect(screen.getByText(/현재 단계 · 지명 및 투표/)).toBeTruthy();

  const preview = screen.getByRole("dialog", { name: "버그 제보" }).querySelector("[data-preview-content]");
  expect(preview?.textContent).toContain('"activeTab": "play"');
  expect(preview?.textContent).toContain('"replayPhase": "day"');
  expect(preview?.textContent).toContain('"currentStepId": "day:nomination"');
  expect(preview?.textContent).toContain('"currentStepType": "nomination"');
  expect(preview?.textContent).not.toContain("automaticReminderApplied");
});

test("shows approved missing, oversized, copy-failure, and save-failure recovery actions", async () => {
  const user = userEvent.setup();
  render(<Issue151TroubleBrewingBugReportPrototype />);

  await user.click(screen.getByRole("button", { name: "이메일 불가" }));
  let dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(within(dialog).getByText("제보 이메일 주소가 설정되지 않았습니다.")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "파일 저장" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "보고서 복사" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "긴 보고서" }));
  dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(within(dialog).getByText("이메일 본문으로 보내기에는 보고서가 깁니다.")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "보고서 파일 저장" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "메일 전송" })).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "보고서 복사" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "복사 실패" }));
  dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(within(dialog).getByRole("alert").textContent).toContain("보고서를 복사하지 못했습니다");
  expect(within(dialog).getByRole("button", { name: "보고서 복사" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "저장 실패" }));
  dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(within(dialog).getByRole("alert").textContent).toContain("보고서 파일을 저장하지 못했습니다");
  expect(within(dialog).getByRole("button", { name: "파일 저장" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "보고서 복사" })).toBeTruthy();
});

test("closes by escape or backdrop and returns focus to the report trigger", async () => {
  const user = userEvent.setup();
  render(<Issue151TroubleBrewingBugReportPrototype />);
  const app = screen.getByRole("main", { name: "Trouble Brewing 게임 버그 제보 fixture" });
  const trigger = within(app).getByRole("button", { name: "버그 제보" });

  await user.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "버그 제보 닫기" })));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.queryByRole("dialog", { name: "버그 제보" })).toBeNull();

  await user.click(trigger);
  const backdrop = screen.getByRole("dialog", { name: "버그 제보" }).parentElement;
  expect(backdrop).toBeTruthy();
  fireEvent.mouseDown(backdrop!);
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.queryByRole("dialog", { name: "버그 제보" })).toBeNull();
});
