import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { BugReportDelivery } from "../src/bugReportDelivery";
import type { GameFile } from "../src/core/types";
import {
  GameBugReportDialog,
  type BugReportBuildInput,
  type BugReportDialogTheme,
  type BugReportResult,
} from "../src/features/bug-report/GameBugReportDialog";
import { TroubleBrewingBugReportDialog } from "../src/features/bug-report/TroubleBrewingBugReportDialog";

const gameFile: GameFile = {
  schemaVersion: 3,
  game: {
    scriptId: "troubleBrewing",
    id: "dialog-test",
    name: "Private game",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:01:00.000Z",
    events: [],
  },
};

const environment = {
  appVersion: "test",
  buildCommit: "test-commit",
  pageUrl: "https://example.test/clocktower/trouble-brewing/",
  userAgent: "Test Browser",
  viewport: { width: 390, height: 844 },
};

const theme: BugReportDialogTheme = {
  id: "tb-night",
  classPrefix: "tb",
};

function buildReport(input: BugReportBuildInput<{ activeTab: string }>): BugReportResult<{ activeTab: string }> {
  const eventCount = input.gameFile.game.events.length;
  return {
    subject: "[Clocktower Trouble Brewing] 버그 제보",
    body: `symptom=${input.symptom || "(작성하지 않음)"}`,
    attachmentJson: JSON.stringify({ original: input.includeOriginalGameFile }),
    metadata: {
      reportSchemaVersion: 2,
      schemaVersion: 3,
      scriptId: "troubleBrewing",
      appVersion: input.environment.appVersion,
      buildCommit: input.environment.buildCommit,
      pageUrl: input.environment.pageUrl,
      userAgent: input.environment.userAgent,
      viewport: "390x844",
      gameUpdatedAt: input.gameFile.game.updatedAt,
      eventCount,
    },
    fixture: input.gameFile,
    reproductionContext: { ...input.reproductionContext, eventCount },
    reportType: "clocktower.trouble-brewing.bug-report",
    reportSchemaVersion: 2,
  };
}

function buildOversizedReport(input: BugReportBuildInput<{ activeTab: string }>): BugReportResult<{ activeTab: string }> {
  return {
    ...buildReport(input),
    body: "oversized report ".repeat(2_000),
  };
}

function renderConfigurableDialog({
  recipient = "bugs@example.test",
  delivery = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => undefined),
    downloadReport: vi.fn(),
  },
  builder = buildReport,
}: {
  recipient?: string;
  delivery?: TestDelivery;
  builder?: typeof buildReport;
} = {}) {
  const renderResult = render(
    <GameBugReportDialog
      gameFile={gameFile}
      environment={environment}
      reproductionContext={{ activeTab: "play" }}
      recipient={recipient}
      delivery={delivery as unknown as BugReportDelivery}
      onClose={vi.fn()}
      builder={builder}
      theme={theme}
      scriptName="Clocktower Trouble Brewing"
      scriptId="troubleBrewing"
      downloadPrefix="clocktower-trouble-brewing-bug-report-"
    />,
  );
  return { dialog: screen.getByRole("dialog", { name: "버그 제보" }), delivery, renderResult };
}

type TestDelivery = {
  openEmail: ReturnType<typeof vi.fn>;
  copyReport: ReturnType<typeof vi.fn>;
  downloadReport: ReturnType<typeof vi.fn>;
};

test("renders the configurable script identity and keeps the report preview collapsed", async () => {
  const user = userEvent.setup();
  const delivery = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => undefined),
    downloadReport: vi.fn(),
  };
  const onClose = vi.fn();
  render(
    <GameBugReportDialog
      gameFile={gameFile}
      environment={environment}
      reproductionContext={{ activeTab: "play" }}
      recipient="bugs@example.test"
      delivery={delivery}
      onClose={onClose}
      builder={buildReport}
      theme={theme}
      scriptName="Clocktower Trouble Brewing"
      scriptId="troubleBrewing"
      downloadPrefix="clocktower-trouble-brewing-bug-report-"
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(dialog.getAttribute("data-script-id")).toBe("troubleBrewing");
  expect(dialog.getAttribute("data-report-type")).toBe("clocktower.trouble-brewing.bug-report");
  expect(within(dialog).getByText("Clocktower Trouble Brewing")).toBeTruthy();
  expect(within(dialog).getByText("전송 내용 미리보기").closest("details")?.open).toBe(false);

  await user.type(within(dialog).getByRole("textbox", { name: "무슨 문제가 있었나요?" }), "버튼 오류");
  await user.click(within(dialog).getByRole("button", { name: "이메일 작성" }));
  expect(delivery.openEmail).toHaveBeenCalledWith(expect.stringContaining("Clocktower%20Trouble%20Brewing"));
});

test("uses the TB wrapper's explicit day theme and download identity", () => {
  render(
    <TroubleBrewingBugReportDialog
      gameFile={gameFile}
      environment={environment}
      reproductionContext={{
        activeTab: "play",
        replayPhase: "day",
        currentStepId: "day:nomination",
        currentStepType: "nomination",
      }}
      recipient="bugs@example.test"
      theme="day"
      onClose={vi.fn()}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "버그 제보" });
  expect(dialog.getAttribute("data-theme")).toBe("day");
  expect(dialog.getAttribute("data-script-id")).toBe("troubleBrewing");
  expect(dialog.getAttribute("data-filename-prefix")).toBe("clocktower-trouble-brewing-bug-report-");
  expect(within(dialog).getByText("Clocktower Trouble Brewing")).toBeTruthy();
});

test("keeps copy, download, and explicit original-file opt-in recovery for a missing recipient", async () => {
  const user = userEvent.setup();
  const delivery = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => undefined),
    downloadReport: vi.fn(),
  };
  const { dialog } = renderConfigurableDialog({ recipient: "", delivery });

  expect(within(dialog).getByRole("button", { name: "보고서 복사" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "파일 저장" })).toBeTruthy();
  await user.click(within(dialog).getByRole("checkbox", { name: "원본 GameFile JSON도 포함" }));
  await user.click(within(dialog).getByRole("button", { name: "파일 저장" }));
  expect(delivery.downloadReport).toHaveBeenCalledWith(
    expect.stringContaining('"original":true'),
    expect.stringMatching(/^clocktower-trouble-brewing-bug-report-.*\.json$/),
  );
  await user.click(within(dialog).getByRole("button", { name: "보고서 복사" }));
  expect(delivery.copyReport).toHaveBeenCalledWith(expect.stringContaining("symptom="));
});

test("uses a JSON attachment and metadata-only email for an oversized report", async () => {
  const user = userEvent.setup();
  const delivery = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => undefined),
    downloadReport: vi.fn(),
  };
  const { dialog } = renderConfigurableDialog({ delivery, builder: buildOversizedReport });

  expect(within(dialog).getByText("보고서 파일 미리보기")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "보고서 복사" })).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "보고서 파일 저장" }));
  expect(delivery.downloadReport).toHaveBeenCalledWith(
    expect.stringContaining('"original":false'),
    expect.stringMatching(/\.json$/),
  );
  await user.click(within(dialog).getByRole("button", { name: "메일 전송" }));
  const mailto = delivery.openEmail.mock.calls[0]?.[0] as string;
  expect(decodeURIComponent(mailto.split("&body=")[1])).toContain("eventCount: 0");
  expect(decodeURIComponent(mailto.split("&body=")[1])).not.toContain("oversized report");
});

test("reports copy and download failures without losing recovery actions", async () => {
  const user = userEvent.setup();
  const copyFailure = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => { throw new Error("clipboard unavailable"); }),
    downloadReport: vi.fn(),
  };
  const first = renderConfigurableDialog({ recipient: "", delivery: copyFailure });
  const { dialog } = first;
  await user.click(within(dialog).getByRole("button", { name: "보고서 복사" }));
  expect(within(dialog).getByRole("alert").textContent).toContain("보고서를 복사하지 못했습니다");
  first.renderResult.unmount();

  const downloadFailure = {
    openEmail: vi.fn(),
    copyReport: vi.fn(async () => undefined),
    downloadReport: vi.fn(() => { throw new Error("download unavailable"); }),
  };
  const second = renderConfigurableDialog({ recipient: "", delivery: downloadFailure });
  await user.click(within(second.dialog).getByRole("button", { name: "파일 저장" }));
  expect(within(second.dialog).getByRole("alert").textContent).toContain("보고서 파일을 저장하지 못했습니다");
});
