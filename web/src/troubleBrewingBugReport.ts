import {
  buildGameBugReport,
  type GameBugReportEnvironment,
  type GameBugReportInput,
  type GameBugReportMetadata,
  type GameBugReportContext,
  type GameBugReportContextInput,
  type GameBugReport,
} from "./gameBugReport.js";

export type TroubleBrewingBugReportEnvironment = GameBugReportEnvironment;
export type TroubleBrewingTab = "roles" | "seating" | "play" | "storage";
export type TroubleBrewingBugReportContextInput = GameBugReportContextInput<TroubleBrewingTab>;
export type TroubleBrewingBugReportContext = GameBugReportContext<TroubleBrewingTab>;
export type TroubleBrewingBugReportInput = GameBugReportInput<TroubleBrewingTab>;
export type TroubleBrewingBugReportMetadata = GameBugReportMetadata;

export type TroubleBrewingBugReport = GameBugReport<TroubleBrewingTab> & {
  subject: "[Clocktower Trouble Brewing] 버그 제보";
  reportType: "clocktower.trouble-brewing.bug-report";
  reportSchemaVersion: 2;
};

const config = {
  subject: "[Clocktower Trouble Brewing] 버그 제보",
  heading: "# Clocktower Trouble Brewing 버그 제보",
  reportType: "clocktower.trouble-brewing.bug-report",
  privacyNotice: "게임 이름 및 플레이어 이름 대체됨 · Storyteller 메모 제거됨 · 설정 초안 제외",
} as const;

export function buildTroubleBrewingBugReport(
  input: TroubleBrewingBugReportInput,
): TroubleBrewingBugReport {
  return buildGameBugReport(config, input) as TroubleBrewingBugReport;
}

export type { GameBugReportEnvironment, GameBugReportMetadata };
