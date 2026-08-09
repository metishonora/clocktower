import type { GameBugReportEnvironment } from "./gameBugReport.js";

export const DEFAULT_BUG_REPORT_EMAIL = "metishonora@icloud.com";
export const MAX_BUG_REPORT_MAILTO_LENGTH = 24_000;

export type BugReportEmailAvailability = "ready" | "recipientMissing" | "oversized";

export type BugReportDelivery = {
  openEmail(mailtoUrl: string): void;
  copyReport(report: string): Promise<void>;
  downloadReport(report: string, filename: string): void;
};

export function bugReportMailto(
  recipient: string,
  report: { subject: string; body: string },
) {
  return `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.body)}`;
}

export function bugReportMetadataMailto<Report extends {
  subject: string;
  metadata: {
    reportSchemaVersion: number;
    schemaVersion: number;
    scriptId: string;
    appVersion: string;
    buildCommit: string;
    pageUrl: string;
    viewport: string;
    gameUpdatedAt: string;
    eventCount: number;
  };
}>(
  recipient: string,
  report: Report,
  heading = "Clocktower S&V 버그 제보",
) {
  const metadata = report.metadata;
  const body = [
    `# ${heading}`,
    "",
    "저장한 JSON 보고서 파일을 이 메일에 첨부해 주세요.",
    "",
    "[메타데이터]",
    `reportSchemaVersion: ${metadata.reportSchemaVersion}`,
    `schemaVersion: ${metadata.schemaVersion}`,
    `scriptId: ${metadata.scriptId}`,
    `appVersion: ${metadata.appVersion}`,
    `buildCommit: ${metadata.buildCommit}`,
    `pageUrl: ${metadata.pageUrl}`,
    `viewport: ${metadata.viewport}`,
    `gameUpdatedAt: ${metadata.gameUpdatedAt}`,
    `eventCount: ${metadata.eventCount}`,
  ].join("\n");
  return `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(body)}`;
}

export function bugReportEmailAvailability(
  recipient: string,
  mailtoUrl: string,
  maxLength = MAX_BUG_REPORT_MAILTO_LENGTH,
): BugReportEmailAvailability {
  if (!recipient.trim()) return "recipientMissing";
  return mailtoUrl.length <= maxLength ? "ready" : "oversized";
}

export function currentBugReportEnvironment(): GameBugReportEnvironment {
  const buildCommit = import.meta.env.VITE_BUILD_COMMIT?.trim() || "development";
  return {
    appVersion: import.meta.env.VITE_APP_VERSION?.trim() || buildCommit.slice(0, 12),
    buildCommit,
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

export const browserBugReportDelivery: BugReportDelivery = {
  openEmail(mailtoUrl) {
    window.location.href = mailtoUrl;
  },
  async copyReport(report) {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(report);
  },
  downloadReport(report, filename) {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
