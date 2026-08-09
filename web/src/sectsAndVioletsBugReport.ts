import type {
  GameBugReport,
  GameBugReportContext,
  GameBugReportContextInput,
  GameBugReportEnvironment,
  GameBugReportInput,
  GameBugReportMetadata,
} from "./gameBugReport.js";
import { buildGameBugReport } from "./gameBugReport.js";
import type { SectsAndVioletsTab } from "./sectsAndVioletsSession.js";

export type SectsAndVioletsBugReportEnvironment = GameBugReportEnvironment;
export type SectsAndVioletsBugReportInput = GameBugReportInput<SectsAndVioletsTab>;
export type SectsAndVioletsBugReport = Omit<GameBugReport<SectsAndVioletsTab>, "reportType" | "reportSchemaVersion">;
export type SectsAndVioletsBugReportContextInput = GameBugReportContextInput<SectsAndVioletsTab>;
export type SectsAndVioletsBugReportContext = GameBugReportContext<SectsAndVioletsTab>;
export type SectsAndVioletsBugReportMetadata = GameBugReportMetadata;

const config = {
  subject: "[Clocktower S&V] 버그 제보",
  heading: "# Clocktower S&V 버그 제보",
  reportType: "clocktower.snv.bug-report",
} as const;

export function buildSectsAndVioletsBugReport(
  input: SectsAndVioletsBugReportInput,
): SectsAndVioletsBugReport {
  const report = buildGameBugReport(config, input);
  const { reportType: _reportType, reportSchemaVersion: _reportSchemaVersion, ...legacyReport } = report;
  return legacyReport;
}
