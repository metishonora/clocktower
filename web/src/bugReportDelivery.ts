import type {
  SectsAndVioletsBugReport,
  SectsAndVioletsBugReportEnvironment,
} from "./sectsAndVioletsBugReport.js";

export const DEFAULT_BUG_REPORT_EMAIL = "metishonora@icloud.com";
export const MAX_BUG_REPORT_MAILTO_LENGTH = 24_000;

export type BugReportEmailAvailability = "ready" | "recipientMissing" | "oversized";

export type BugReportDelivery = {
  openEmail(mailtoUrl: string): void;
  copyReport(report: string): Promise<void>;
  downloadReport(report: string, filename: string): void;
};

export function bugReportMailto(recipient: string, report: SectsAndVioletsBugReport) {
  return `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.body)}`;
}

export function bugReportEmailAvailability(
  recipient: string,
  mailtoUrl: string,
  maxLength = MAX_BUG_REPORT_MAILTO_LENGTH,
): BugReportEmailAvailability {
  if (!recipient.trim()) return "recipientMissing";
  return mailtoUrl.length <= maxLength ? "ready" : "oversized";
}

export function currentBugReportEnvironment(): SectsAndVioletsBugReportEnvironment {
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
